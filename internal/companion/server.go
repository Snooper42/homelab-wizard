package companion

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/engine"
)

// Method is one of the desktop app's methods, answered for a phone.
type Method struct {
	// Change: only a device allowed to make changes may call it.
	Change bool
	// Private: the household's own setup (the Settings form, with its
	// addresses, folders, and email in it), sent only over an encrypted
	// connection and never to a wall screen, which anyone walking past can
	// read.
	Private bool
	// Member: a household member's phone (Device.Person) may call it too.
	// Every other method is the owner's alone. What a member's call
	// answers is theirs (Caller says whose): their own apps, their own
	// Finances.
	Member bool
	// Finances is the Finances level a device needs to call it
	// (FinancesView or FinancesEdit), over an encrypted connection only;
	// "" for a method that is not about money.
	Finances string
	// Call gets the method's arguments as the page sent them, and returns
	// its result and, for commands, the lines they printed.
	Call func(ctx context.Context, args []json.RawMessage) (result any, log []string, err error)
	// Stream, in place of Call, answers in lines of JSON as they come
	// (application/x-ndjson): {"result": ...} or {"error": "..."} once, as
	// soon as it is known, and {"event": name, "data": ...} for each event,
	// before or after it; the answer ends when Stream returns. Only for a
	// read: a change answers with Call.
	Stream func(ctx context.Context, args []json.RawMessage, result func(any, error), event func(name string, data any))
}

// Server is homelab serve's handler: the frontend, pairing, and the
// methods, for callers on the home network or the tailnet only.
type Server struct {
	Store   *Store
	Methods map[string]Method
	Files   fs.FS // the desktop app's frontend (web.Files)
	// Changes are the engine's changes, streamed to paired phones at
	// /api/events so Status updates as on the computer; nil leaves it out.
	Changes *engine.Hub
	// ProxyKey is COMPANION_PROXY_KEY, which the companion's own proxy host
	// sends in ProxyHeader (N25); nil or "" before a domain is set up again.
	ProxyKey func() string
	// ForMember is what a household member's phone may see of a change on
	// /api/events: their own apps only, or nothing (false). Nil: a
	// member's phone does not follow changes.
	ForMember func(d Device, c engine.Change) (engine.Change, bool)
	// Calendar is Finances' calendar feed for a link's key (the paydays and
	// bills as iCalendar), ok false for a key that is not the plan's; nil
	// leaves /finances.ics out.
	Calendar func(key string) (ics []byte, ok bool)
	// Access is the companion's Cloudflare Access application (.env), for
	// away from home through the tunnel (ADR-0023); nil, or not set up,
	// refuses the tunnel as before.
	Access func() Access
	// Now is the clock; nil is time.Now.
	Now func() time.Time

	mu       sync.Mutex
	failures []time.Time // recent wrong pairing codes
	guardT   tunnelGuard
}

func (s *Server) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// MaxFailures is how many wrong pairing codes are taken in PairFor before
// pairing stops answering until the oldest falls out of the window.
const MaxFailures = 10

// Handler serves everything.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/pair", s.pair)
	mux.HandleFunc("/api/me", s.me)
	mux.HandleFunc("/api/call/", s.call)
	mux.HandleFunc("GET /api/events", s.events)
	mux.HandleFunc("/manifest.webmanifest", manifest)
	mux.HandleFunc("GET /finances.ics", s.calendar)
	mux.HandleFunc("/", s.files)
	return s.guard(mux)
}

// guard turns away everything that is not from this machine, the home
// network, or the tailnet. What came through Cloudflare (the tunnel carries
// its headers) goes to the tunnel's one address, sealed and looking only
// (tunnel.go); nothing else of the companion is ever on the internet.
func (s *Server) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if throughTunnel(r) {
			s.tunnel(w, r)
			return
		}
		if !Local(r) {
			http.Error(w, "the phone companion answers only at home and on the tailnet", http.StatusForbidden)
			return
		}
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}

var (
	// tailnet is Tailscale's address range (CGNAT space).
	tailnet = netip.MustParsePrefix("100.64.0.0/10")
	// thisNetwork holds OrbStack's address for the Mac as containers see it
	// (0.250.250.254), so the proxy's requests are let in; nothing on the
	// internet can come from it.
	thisNetwork = netip.MustParsePrefix("0.0.0.0/8")
)

// Local reports whether the request comes from a private address (this
// machine, the home network, a container, or the tailnet) and not through
// Cloudflare.
func Local(r *http.Request) bool {
	if r.Header.Get("Cf-Connecting-Ip") != "" || r.Header.Get("Cf-Ray") != "" {
		return false
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return false
	}
	ip = ip.Unmap()
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || tailnet.Contains(ip) || thisNetwork.Contains(ip)
}

// Encrypted reports whether a request reached the companion in a way
// nobody on the home Wi-Fi can read: from this machine (Tailscale Serve's
// https), over the tailnet (WireGuard), from OrbStack's containers (the
// proxy), or through the proxy's https, which it says in X-Forwarded-Proto. Plain
// HTTP from the home network is not. The header could be sent by anyone,
// but only someone holding a pairing code or a token gains by it, and the
// point is that a token is never sent where others can read it.
// ProxyHeader carries the companion's proxy host's key.
const ProxyHeader = "X-Homelab-Proxy"

// encrypted is Encrypted, believing "https" from the proxy only on its
// key once COMPANION_PROXY_KEY is set (N25): X-Forwarded-Proto alone can be
// sent by any device on the Wi-Fi, and through the proxy too, which passes
// a client's own on. The companion's proxy host sets it from what the proxy
// received and adds the key. With no key yet (a domain set up before), it is
// Encrypted as it was, until Set up the domain runs again.
func (s *Server) encrypted(r *http.Request) bool {
	key := ""
	if s.ProxyKey != nil {
		key = s.ProxyKey()
	}
	if key == "" {
		return Encrypted(r)
	}
	if r.TLS != nil {
		return true
	}
	if got := r.Header.Get(ProxyHeader); got != "" {
		return subtle.ConstantTimeCompare([]byte(got), []byte(key)) == 1 && r.Header.Get("X-Forwarded-Proto") == "https"
	}
	return direct(r)
}

func Encrypted(r *http.Request) bool {
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		return true
	}
	return direct(r)
}

// direct reports whether a request reached the companion straight from
// where nobody on the Wi-Fi can read it: this machine (Tailscale Serve's
// https), the tailnet, or OrbStack's address for this Mac.
func direct(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return false
	}
	ip = ip.Unmap()
	return ip.IsLoopback() || tailnet.Contains(ip) || thisNetwork.Contains(ip)
}

// calendar answers a calendar app subscribed to Finances' feed: by the
// link's key, as Finances on a phone, over an encrypted connection only,
// and never kept along the way.
func (s *Server) calendar(w http.ResponseWriter, r *http.Request) {
	if s.Calendar == nil {
		http.NotFound(w, r)
		return
	}
	if !s.encrypted(r) {
		http.Error(w, "the Finances calendar needs the Tailscale (https) link; over the home Wi-Fi it is not sent", http.StatusForbidden)
		return
	}
	ics, ok := s.Calendar(r.URL.Query().Get("key"))
	if !ok {
		http.Error(w, "no such calendar: make a new link in Finances › Pay", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(ics)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func (s *Server) device(r *http.Request) (Device, bool) {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return Device{}, false
	}
	return s.Store.Lookup(strings.TrimSpace(token))
}

// Me is what a phone learns about itself.
type Me struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CanChange bool   `json:"canChange"`
	Finances  string `json:"finances,omitempty"`
	// Person is the household member whose phone it is; "" for the owner's.
	Person     string `json:"person,omitempty"`
	PersonName string `json:"personName,omitempty"`
}

func meOf(d Device) Me {
	return Me{ID: d.ID, Name: d.Name, CanChange: d.CanChange, Finances: d.Finances, Person: d.Person, PersonName: d.PersonName}
}

type deviceKey struct{}

// WithCaller is ctx answering d, as a call from it is: for a method
// called in-process (and tests).
func WithCaller(ctx context.Context, d Device) context.Context {
	return context.WithValue(ctx, deviceKey{}, d)
}

// Caller is the paired device a method is answering, from its context.
func Caller(ctx context.Context) (Device, bool) {
	d, ok := ctx.Value(deviceKey{}).(Device)
	return d, ok
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	d, ok := s.device(r)
	if !ok {
		fail(w, http.StatusUnauthorized, "this phone is not paired")
		return
	}
	writeJSON(w, http.StatusOK, meOf(d))
}

func (s *Server) pair(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fail(w, http.StatusMethodNotAllowed, "POST a code")
		return
	}
	var body struct {
		Code, Name string
		Kiosk      bool // a TV or wall screen: never allowed changes
		// Key is the phone's X25519 public key (base64), for sealing what
		// goes through the tunnel away from home (ADR-0023); "" from a
		// phone that doesn't go out.
		Key string
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		fail(w, http.StatusBadRequest, "send {\"code\": \"...\"}")
		return
	}
	if s.tooMany() {
		fail(w, http.StatusTooManyRequests, "too many wrong codes: wait 10 minutes, then make a new one on the computer")
		return
	}
	d, token, err := s.Store.Pair(body.Code, body.Name)
	if errors.Is(err, ErrBadCode) {
		s.failed()
		fail(w, http.StatusForbidden, err.Error())
		return
	}
	if err == nil && body.Kiosk {
		// Kiosk mode hides the buttons, and anyone at the screen could
		// show them again, so the screen itself may not make changes, nor
		// show the household's money to whoever walks past; and it is
		// remembered as a screen, so neither is given back later (N26).
		d, err = s.Store.MarkKiosk(d.ID)
	}
	if err == nil && !s.encrypted(r) {
		// Its token will cross the home Wi-Fi readable with every request
		// (a page keeps it per address, so this phone keeps using this
		// one): someone on the Wi-Fi could copy it, so it may only look.
		d, err = s.Store.MarkUnencrypted(d.ID)
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	answer := map[string]any{"token": token, "device": meOf(d)}
	// Away from home: a key agreed here, at home, over a connection nobody
	// on the Wi-Fi can read, and never for a wall screen, which stays home.
	if body.Key != "" && s.encrypted(r) && !d.Kiosk {
		phone, err := base64.StdEncoding.DecodeString(body.Key)
		var computer, key []byte
		if err == nil {
			computer, key, err = TunnelKeys(phone, d.ID)
		}
		if err == nil {
			err = s.Store.SetTunnelKey(d.ID, key)
		}
		if err != nil {
			fail(w, http.StatusBadRequest, "the phone's key for away from home could not be used: pair again")
			return
		}
		answer["tunnelKey"] = base64.StdEncoding.EncodeToString(computer)
	}
	writeJSON(w, http.StatusOK, answer)
}

func (s *Server) tooMany() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	cut := time.Now().Add(-PairFor)
	recent := s.failures[:0]
	for _, t := range s.failures {
		if t.After(cut) {
			recent = append(recent, t)
		}
	}
	s.failures = recent
	return len(recent) >= MaxFailures
}

func (s *Server) failed() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failures = append(s.failures, time.Now())
}

// MaxCall is the most a paired device may send in one call. A phone that
// may change Finances sends the whole plan, with the household's own logos
// (finance.MaxLogo each), so 64 KB, the limit before them, refused a save
// once there were a few.
const MaxCall = 4 << 20

func (s *Server) call(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fail(w, http.StatusMethodNotAllowed, "POST the arguments")
		return
	}
	d, ok := s.device(r)
	if !ok {
		fail(w, http.StatusUnauthorized, "this phone is not paired")
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/api/call/")
	m, ok := s.Methods[name]
	if !ok {
		fail(w, http.StatusNotFound, "not on the phone: use Homelab Wizard on the computer")
		return
	}
	if code, msg := allowed(d, m, s.encrypted(r)); code != 0 {
		fail(w, code, msg)
		return
	}
	var args []json.RawMessage
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, MaxCall))
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		fail(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("too large for the computer: at most %d MB", MaxCall>>20))
		return
	}
	if err == nil && len(bytes.TrimSpace(data)) > 0 {
		err = json.Unmarshal(data, &args)
	}
	if err != nil {
		fail(w, http.StatusBadRequest, "the arguments must be a JSON array")
		return
	}
	r = r.WithContext(WithCaller(r.Context(), d))
	if m.Stream != nil {
		stream(w, r, m, args)
		return
	}
	result, log, err := m.Call(r.Context(), args)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error(), "log": log})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"result": result, "log": log})
}

// allowed is whether device d may call m, and why not (an HTTP status and
// what to say) when it may not; encrypted is whether the call came where
// nobody on the Wi-Fi can read it. The home network and the tunnel both
// ask it, so the two never drift apart.
func allowed(d Device, m Method, encrypted bool) (int, string) {
	if d.Person != "" && !m.Member {
		return http.StatusForbidden, "this is " + d.PersonName + "'s phone: it shows their own apps and their own Finances, not the rest of the homelab"
	}
	if m.Change && d.CanChange && !encrypted {
		return http.StatusForbidden, "changes from a phone need the Tailscale (https) link; over the home Wi-Fi it can only look"
	}
	if m.Change && !d.CanChange {
		return http.StatusForbidden, "this phone can look but not change anything: on the computer, homelab phone allow " + d.ID
	}
	if m.Private && d.Kiosk {
		return http.StatusForbidden, "a wall screen does not see Settings: use a phone, or Homelab Wizard on the computer"
	}
	if m.Private && !encrypted {
		return http.StatusForbidden, "Settings on a phone need the https link; over the home Wi-Fi they are not sent"
	}
	if m.Finances != "" && !encrypted {
		return http.StatusForbidden, "Finances on a phone need the Tailscale (https) link; over the home Wi-Fi they are not sent"
	}
	if !FinancesAllow(d.Finances, m.Finances) {
		switch d.Finances {
		case "":
			return http.StatusForbidden, "this phone cannot see Finances: on the computer, Settings › Phones, or homelab phone finances " + d.ID + " view"
		case FinancesCard:
			return http.StatusForbidden, "this screen sees only the money card: on the computer, Settings › Phones, or homelab phone finances " + d.ID + " view"
		default:
			return http.StatusForbidden, "this phone can see Finances but not change them: on the computer, Settings › Phones, or homelab phone finances " + d.ID + " edit"
		}
	}
	return 0, ""
}

// stream answers a Stream method, a line at a time.
func stream(w http.ResponseWriter, r *http.Request, m Method, args []json.RawMessage) {
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	var mu sync.Mutex
	enc := json.NewEncoder(w)
	flusher, _ := w.(http.Flusher)
	line := func(v any) {
		mu.Lock()
		defer mu.Unlock()
		_ = enc.Encode(v)
		if flusher != nil {
			flusher.Flush()
		}
	}
	m.Stream(r.Context(), args, func(v any, err error) {
		if err != nil {
			line(map[string]any{"error": err.Error()})
			return
		}
		line(map[string]any{"result": v})
	}, func(name string, data any) { line(map[string]any{"event": name, "data": data}) })
}

// streamRecheck is how often a phone following Status changes is looked
// up again, so one removed on the computer stops getting them.
var streamRecheck = 5 * time.Second

// events streams the engine's changes to a paired phone, for as long as it
// stays paired: a stream stays open for hours, so the phone is looked up
// again every few seconds, and one removed on the computer (by another
// process too) is cut off, as its token stops working (N23).
func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	d, ok := s.device(r)
	if !ok {
		fail(w, http.StatusUnauthorized, "this phone is not paired")
		return
	}
	if s.Changes == nil || (d.Person != "" && s.ForMember == nil) {
		fail(w, http.StatusNotFound, "no changes to follow")
		return
	}
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	go func() {
		tick := time.NewTicker(streamRecheck)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				if _, ok := s.device(r); !ok {
					cancel()
					return
				}
			}
		}
	}()
	if d.Person != "" {
		s.Changes.StreamOnly(w, r.WithContext(ctx), func(c engine.Change) (engine.Change, bool) { return s.ForMember(d, c) })
		return
	}
	s.Changes.Stream(w, r.WithContext(ctx))
}

// files serves the frontend. index.html gets the companion's script (in
// place of the desktop app's bridge) and what makes it installable.
func (s *Server) files(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "GET only", http.StatusMethodNotAllowed)
		return
	}
	if r.URL.Path != "/" && r.URL.Path != "/index.html" {
		w.Header().Set("Cache-Control", "no-cache")
		http.FileServerFS(s.Files).ServeHTTP(w, r)
		return
	}
	page, err := fs.ReadFile(s.Files, "index.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(Page(page))
}

// Page turns the desktop app's index.html into the phone's.
func Page(index []byte) []byte {
	head := `<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Homelab">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="` + splashLight + `" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="` + splashDark + `" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" sizes="180x180" href="icon-180.png">
</head>`
	out := bytes.Replace(index, []byte("</head>"), []byte(head), 1)
	out = bytes.Replace(out, []byte(`<html lang="en">`), []byte(`<html lang="en" class="companion">`), 1)
	return bytes.Replace(out, []byte(`<script src="app.js"></script>`), []byte(`<script src="companion.js"></script>
<script src="app.js"></script>`), 1)
}

// Icons are the phone's Home Screen icons (web/dist, made from
// assets/appicon-phone.svg by app/preview/icons.mjs): PNGs, since an
// iPhone takes no SVG for one, and the 512 also maskable, its shield inside
// the middle 80% that Android's shapes keep.
var Icons = []map[string]string{
	{"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
	{"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
	{"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
	{"src": "logo.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
}

// The app's own background (style.css's --bg): the splash Android shows
// while the app opens from the Home Screen (a manifest has one colour, so
// the light one), and the bar above the app, light or dark with the phone.
const (
	splashLight = "#f4f6fa"
	splashDark  = "#0b1020"
)

func manifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/manifest+json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":               "./",
		"name":             "Homelab",
		"short_name":       "Homelab",
		"description":      "Your homelab's apps, backups, and alerts",
		"start_url":        "./",
		"scope":            "./",
		"display":          "standalone",
		"background_color": splashLight,
		"theme_color":      splashLight,
		"icons":            Icons,
	})
}
