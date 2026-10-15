package companion

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"
)

// Method is one of the desktop app's methods, answered for a phone.
type Method struct {
	// Change: only a device allowed to make changes may call it.
	Change bool
	// Call gets the method's arguments as the page sent them, and returns
	// its result and, for commands, the lines they printed.
	Call func(ctx context.Context, args []json.RawMessage) (result any, log []string, err error)
}

// Server is homelab serve's handler: the frontend, pairing, and the
// methods, for callers on the home network or the tailnet only.
type Server struct {
	Store   *Store
	Methods map[string]Method
	Files   fs.FS // the desktop app's frontend (web.Files)

	mu       sync.Mutex
	failures []time.Time // recent wrong pairing codes
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
	mux.HandleFunc("/manifest.webmanifest", manifest)
	mux.HandleFunc("/", s.files)
	return guard(mux)
}

// guard turns away everything that is not from this machine, the home
// network, or the tailnet, and anything that came through Cloudflare (the
// tunnel would carry its headers): the companion is never on the internet.
func guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
}

func meOf(d Device) Me { return Me{ID: d.ID, Name: d.Name, CanChange: d.CanChange} }

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
	var body struct{ Code, Name string }
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		fail(w, http.StatusBadRequest, "send {\"code\": \"...\"}")
		return
	}
	if s.tooMany() {
		fail(w, http.StatusTooManyRequests, "too many wrong codes: wait 10 minutes, then make a new one on the Mac")
		return
	}
	d, token, err := s.Store.Pair(body.Code, body.Name)
	if errors.Is(err, ErrBadCode) {
		s.failed()
		fail(w, http.StatusForbidden, err.Error())
		return
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "device": meOf(d)})
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
		fail(w, http.StatusNotFound, "not on the phone: use Homelab Wizard on the Mac")
		return
	}
	if m.Change && !d.CanChange {
		fail(w, http.StatusForbidden, "this phone can look but not change anything: on the Mac, homelab phone allow "+d.ID)
		return
	}
	var args []json.RawMessage
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
	if err == nil && len(bytes.TrimSpace(data)) > 0 {
		err = json.Unmarshal(data, &args)
	}
	if err != nil {
		fail(w, http.StatusBadRequest, "the arguments must be a JSON array")
		return
	}
	result, log, err := m.Call(r.Context(), args)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error(), "log": log})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"result": result, "log": log})
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
<meta name="theme-color" content="#1f3a5f">
<link rel="apple-touch-icon" href="logo.svg">
</head>`
	out := bytes.Replace(index, []byte("</head>"), []byte(head), 1)
	out = bytes.Replace(out, []byte(`<html lang="en">`), []byte(`<html lang="en" class="companion">`), 1)
	return bytes.Replace(out, []byte(`<script src="app.js"></script>`), []byte(`<script src="companion.js"></script>
<script src="app.js"></script>`), 1)
}

func manifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/manifest+json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"name":             "Homelab",
		"short_name":       "Homelab",
		"start_url":        "./",
		"scope":            "./",
		"display":          "standalone",
		"background_color": "#ffffff",
		"theme_color":      "#1f3a5f",
		"icons":            []map[string]string{{"src": "logo.svg", "sizes": "any", "type": "image/svg+xml"}},
	})
}
