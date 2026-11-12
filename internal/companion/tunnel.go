package companion

// Away from home through the Cloudflare tunnel (ADR-0023). Four locks, each
// enough on its own to stop someone who got past the others:
//
//  1. Cloudflare Access with the household's service token, on the
//     companion's own hostname: a request without it never reaches the
//     house (set up by Setup's "Reach Finances away from home").
//  2. Access's signed pass, checked here (access.go).
//  3. The phone's own pairing: its device token, inside the sealed message.
//  4. End-to-end sealing: at pairing, at home, the phone and the computer
//     agree a key (X25519); every request and answer through the tunnel is
//     sealed with it (AES-256-GCM), so Cloudflare, which opens the tunnel's
//     TLS, reads nothing but which phone it is. A message carries its time
//     and is taken once.
//
// Through the tunnel the phone may only look: a method that changes
// something (Finances' edits too), the household's settings, a stream, pairing, and the frontend
// are never served there. Wrong attempts lock a phone, and an address, out
// for a while.

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sync"
	"time"
)

// TunnelPath is the companion's one address through the tunnel.
const TunnelPath = "/api/tunnel"

// tunnelInfo names the sealing key's use, so the key agreed at pairing is
// never the key of anything else.
const tunnelInfo = "homelab-wizard companion tunnel v1"

// Through the tunnel, the additional data each box is sealed with: which
// way it goes and which phone, and for an answer the request it answers.
const (
	tunnelAsk    = "homelab tunnel request\x00"
	tunnelAnswer = "homelab tunnel answer\x00"
)

// TunnelSkew is how far a sealed request's time may be from the computer's.
const TunnelSkew = 2 * time.Minute

// Through the tunnel, how many wrong attempts a phone or an address may
// make before it is locked out, and for how long they count.
const (
	TunnelFailures = 10
	TunnelLockout  = 10 * time.Minute
)

// MaxTunnel is the most a sealed request may be: a phone that only looks
// sends little.
const MaxTunnel = 64 << 10

// TunnelKeys agrees the sealing key with a phone pairing at home: its
// public key in, the computer's public key out, and the key both derive.
// The computer's private key is used once, and kept nowhere.
func TunnelKeys(phone []byte, deviceID string) (computer, key []byte, err error) {
	mine, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	return tunnelKeysWith(mine, phone, deviceID)
}

// tunnelKeysWith is TunnelKeys with the computer's private key given (the
// vectors the iPhone app is tested against are made with fixed ones).
func tunnelKeysWith(mine *ecdh.PrivateKey, phone []byte, deviceID string) (computer, key []byte, err error) {
	theirs, err := ecdh.X25519().NewPublicKey(phone)
	if err != nil {
		return nil, nil, errors.New("the phone's key is not an X25519 key")
	}
	shared, err := mine.ECDH(theirs)
	if err != nil {
		return nil, nil, err
	}
	key, err = hkdf.Key(sha256.New, shared, []byte(deviceID), tunnelInfo, 32)
	if err != nil {
		return nil, nil, err
	}
	return mine.PublicKey().Bytes(), key, nil
}

// Sealed is a box through the tunnel: a request also says which phone.
type Sealed struct {
	Device string `json:"device,omitempty"`
	Nonce  string `json:"nonce"`
	Box    string `json:"box"`
}

// TunnelRequest is a sealed request, opened.
type TunnelRequest struct {
	Token  string            `json:"token"`
	At     int64             `json:"at"` // Unix milliseconds
	Method string            `json:"method"`
	Args   []json.RawMessage `json:"args,omitempty"`
}

// TunnelAnswer is a sealed answer, opened: what /api/call (or /api/me)
// would have answered, with its status.
type TunnelAnswer struct {
	Status int    `json:"status"`
	Result any    `json:"result,omitempty"`
	Log    any    `json:"log,omitempty"`
	Error  string `json:"error,omitempty"`
}

func gcm(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// Seal seals plain with key, bound to ad.
func Seal(key []byte, ad string, plain []byte) (nonce, box []byte, err error) {
	aead, err := gcm(key)
	if err != nil {
		return nil, nil, err
	}
	nonce = make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, err
	}
	return nonce, aead.Seal(nil, nonce, plain, []byte(ad)), nil
}

// sealWith is Seal with the nonce given, for the iPhone app's vectors only:
// a nonce is never used twice with one key.
func sealWith(key []byte, ad string, nonce, plain []byte) ([]byte, error) {
	aead, err := gcm(key)
	if err != nil {
		return nil, err
	}
	return aead.Seal(nil, nonce, plain, []byte(ad)), nil
}

// Open opens a box Seal made with the same key and additional data.
func Open(key []byte, ad string, nonce, box []byte) ([]byte, error) {
	aead, err := gcm(key)
	if err != nil {
		return nil, err
	}
	if len(nonce) != aead.NonceSize() {
		return nil, errors.New("not a sealed box")
	}
	return aead.Open(nil, nonce, box, []byte(ad))
}

// tunnelGuard is the tunnel's memory: the messages already taken, and the
// wrong attempts by phone and by address.
type tunnelGuard struct {
	mu     sync.Mutex
	seen   map[string]time.Time // device + nonce → when taken
	wrong  map[string][]time.Time
	access accessKeys
	// since is when this run began taking messages: seen is empty before
	// it, so one sealed earlier may have been taken by the run before
	// (a restart within TunnelSkew) and is refused.
	since time.Time
}

// start notes when this run began taking messages, once.
func (g *tunnelGuard) start(now time.Time) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.since.IsZero() {
		g.since = now
	}
}

// sealedBefore is whether a message was sealed before this run began, so
// before the memory of what was taken: an earlier run may have taken it.
func (g *tunnelGuard) sealedBefore(at time.Time) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	return !g.since.IsZero() && at.Before(g.since)
}

func (g *tunnelGuard) init() {
	if g.seen == nil {
		g.seen, g.wrong = map[string]time.Time{}, map[string][]time.Time{}
	}
}

// lockedOut is whether any of keys has made too many wrong attempts lately.
func (g *tunnelGuard) lockedOut(now time.Time, keys ...string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.init()
	for _, k := range keys {
		recent := g.wrong[k][:0]
		for _, t := range g.wrong[k] {
			if now.Sub(t) < TunnelLockout {
				recent = append(recent, t)
			}
		}
		g.wrong[k] = recent
		if len(recent) == 0 {
			delete(g.wrong, k)
		}
		if len(recent) >= TunnelFailures {
			return true
		}
	}
	return false
}

func (g *tunnelGuard) failed(now time.Time, keys ...string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.init()
	for _, k := range keys {
		if k != "" {
			g.wrong[k] = append(g.wrong[k], now)
		}
	}
}

// fresh takes a message once: false for one already taken.
func (g *tunnelGuard) fresh(now time.Time, device, nonce string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.init()
	for k, t := range g.seen {
		if now.Sub(t) > 2*TunnelSkew {
			delete(g.seen, k)
		}
	}
	k := device + "\x00" + nonce
	if _, ok := g.seen[k]; ok {
		return false
	}
	g.seen[k] = now
	return true
}

// throughTunnel is whether a request came through Cloudflare.
func throughTunnel(r *http.Request) bool {
	return r.Header.Get("Cf-Connecting-Ip") != "" || r.Header.Get("Cf-Ray") != ""
}

// tunnelRefuse says no to a request through the tunnel, saying as little
// as can be: whoever sent it may not be the household.
func tunnelRefuse(w http.ResponseWriter, code int) {
	w.Header().Set("Cache-Control", "no-store")
	http.Error(w, http.StatusText(code), code)
}

// tunnel answers a request that came through Cloudflare: only a sealed
// look, from a paired phone, with Access's pass.
func (s *Server) tunnel(w http.ResponseWriter, r *http.Request) {
	now := s.now()
	addr := "addr:" + r.Header.Get("Cf-Connecting-Ip")
	if r.URL.Path != TunnelPath || r.Method != http.MethodPost {
		s.guardT.failed(now, addr)
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	access := Access{}
	if s.Access != nil {
		access = s.Access()
	}
	if !access.On() {
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	if s.guardT.lockedOut(now, addr) {
		tunnelRefuse(w, http.StatusTooManyRequests)
		return
	}
	if err := s.guardT.access.checkPass(r.Context(), access, r.Header.Get("Cf-Access-Jwt-Assertion"), now); err != nil {
		s.guardT.failed(now, addr)
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	var in Sealed
	if err := json.NewDecoder(io.LimitReader(r.Body, MaxTunnel)).Decode(&in); err != nil || in.Device == "" {
		s.guardT.failed(now, addr)
		tunnelRefuse(w, http.StatusBadRequest)
		return
	}
	dev := "device:" + in.Device
	if s.guardT.lockedOut(now, dev) {
		tunnelRefuse(w, http.StatusTooManyRequests)
		return
	}
	key, ok := s.Store.tunnelKey(in.Device)
	nonce, err1 := base64.StdEncoding.DecodeString(in.Nonce)
	box, err2 := base64.StdEncoding.DecodeString(in.Box)
	if !ok || err1 != nil || err2 != nil {
		s.guardT.failed(now, addr, dev)
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	plain, err := Open(key, tunnelAsk+in.Device, nonce, box)
	var req TunnelRequest
	if err != nil || json.Unmarshal(plain, &req) != nil {
		s.guardT.failed(now, addr, dev)
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	at := time.UnixMilli(req.At)
	if at.Before(now.Add(-TunnelSkew)) || at.After(now.Add(TunnelSkew)) {
		s.guardT.failed(now, addr, dev)
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	// Sealed before this run began (a restart a moment ago): it may have
	// been taken already. Not a wrong attempt: a phone whose clock is a
	// little behind is refused only until its clock passes the restart.
	if s.guardT.sealedBefore(at) {
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	if !s.guardT.fresh(now, in.Device, in.Nonce) {
		s.guardT.failed(now, addr, dev)
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	d, ok := s.Store.Lookup(req.Token)
	if !ok || subtle.ConstantTimeCompare([]byte(d.ID), []byte(in.Device)) != 1 {
		s.guardT.failed(now, addr, dev)
		tunnelRefuse(w, http.StatusForbidden)
		return
	}
	// From here it is the household's own phone: what it may not do is
	// said to it, sealed.
	answer := s.tunnelCall(r, d, req)
	out, err := json.Marshal(answer)
	if err == nil {
		var n, b []byte
		if n, b, err = Seal(key, tunnelAnswer+in.Device+"\x00"+in.Nonce, out); err == nil {
			writeJSON(w, http.StatusOK, Sealed{Nonce: base64.StdEncoding.EncodeToString(n), Box: base64.StdEncoding.EncodeToString(b)})
			return
		}
	}
	tunnelRefuse(w, http.StatusInternalServerError)
}

// tunnelCall answers an opened request: me, or a method that only looks.
func (s *Server) tunnelCall(r *http.Request, d Device, req TunnelRequest) TunnelAnswer {
	if req.Method == "me" {
		return TunnelAnswer{Status: http.StatusOK, Result: s.MeFor(d)}
	}
	m, ok := s.Methods[req.Method]
	if !ok {
		return TunnelAnswer{Status: http.StatusNotFound, Error: "not on the phone: use Homelab Wizard on the computer"}
	}
	// Finances' edit level is how their writes are guarded (SaveFinances
	// and the like aren't marked Change, so a look-only phone may still
	// keep its own budget): never through the tunnel.
	if m.Change || m.Private || m.Stream != nil || m.Call == nil || m.Finances == FinancesEdit {
		return TunnelAnswer{Status: http.StatusForbidden, Error: "away from home the phone only looks: this waits until you're home"}
	}
	// Sealed end to end, so as private as the tailnet.
	if code, msg := allowed(d, m, true); code != 0 {
		return TunnelAnswer{Status: code, Error: msg}
	}
	ctx := WithCaller(r.Context(), d)
	result, log, err := m.Call(ctx, req.Args)
	if err != nil {
		return TunnelAnswer{Status: http.StatusInternalServerError, Error: err.Error(), Log: log}
	}
	return TunnelAnswer{Status: http.StatusOK, Result: result, Log: log}
}
