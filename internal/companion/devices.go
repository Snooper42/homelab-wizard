// Package companion is the phone companion: homelab serve shows the
// desktop app's Status and Backups screens, and Finances to the phones let
// see them, to paired phones, over the home network and the tailnet only.
// Each phone pairs once with a one-time code and gets its own token; phones
// are read-only unless allowed to make changes, and see no Finances unless
// allowed to.
package companion

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Port is where homelab serve listens.
const Port = 8099

// PairFor is how long a pairing code works.
const PairFor = 10 * time.Minute

// What a phone may do on Finances: nothing (""), look, or change the plan.
// It is apart from CanChange: a phone that restarts apps need not see the
// household's money, and one that keeps the budget need not restart apps.
const (
	FinancesView = "view"
	FinancesEdit = "edit"
)

// FinancesAllow reports whether a phone's Finances level covers need.
func FinancesAllow(have, need string) bool {
	switch need {
	case "":
		return true
	case FinancesView:
		return have == FinancesView || have == FinancesEdit
	}
	return have == FinancesEdit
}

func financesLevel(level string) (string, error) {
	switch level = strings.ToLower(strings.TrimSpace(level)); level {
	case "", "off", "none", "hidden":
		return "", nil
	case FinancesView, FinancesEdit:
		return level, nil
	}
	return "", fmt.Errorf("finances is off, view, or edit, not %q", level)
}

// Device is one paired phone. Only a hash of its token is kept.
type Device struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	TokenHash string `json:"tokenHash"`
	CanChange bool   `json:"canChange"`
	// Finances is what it may do on Finances: "", FinancesView, or FinancesEdit.
	Finances string `json:"finances,omitempty"`
	// Unencrypted: paired over plain HTTP on the home network, so its
	// token crosses the Wi-Fi readable; it may only look, for good.
	Unencrypted bool      `json:"unencrypted,omitempty"`
	Paired      time.Time `json:"paired"`
	LastSeen    time.Time `json:"lastSeen"`
}

// Phone is a paired phone as the screens show it (no token hash).
type Phone struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	CanChange   bool      `json:"canChange"`
	Finances    string    `json:"finances,omitempty"`
	Unencrypted bool      `json:"unencrypted,omitempty"`
	Paired      time.Time `json:"paired"`
	LastSeen    time.Time `json:"lastSeen"`
}

// Phones lists the paired phones for the screens.
func (s *Store) Phones() []Phone {
	out := []Phone{}
	for _, d := range s.Devices() {
		out = append(out, Phone{ID: d.ID, Name: d.Name, CanChange: d.CanChange, Finances: d.Finances, Unencrypted: d.Unencrypted, Paired: d.Paired, LastSeen: d.LastSeen})
	}
	return out
}

// Links are where a phone opens the companion with a pairing code: the
// domain's name, the tailnet address in Home mode, and this machine on the
// home network (lan, when known; else its Bonjour name, <host>.local,
// which iPhones and Macs resolve). The first is the best one.
// SecureBase is the companion's https address, as Links writes it: the
// homelab's domain, or else the tailnet's; "" with neither.
func SecureBase(env map[string]string) string {
	if d := env["HOMELAB_DOMAIN"]; d != "" {
		return "https://homelab." + d
	}
	if t := env["TAILSCALE_HOST"]; t != "" {
		return "https://" + t + ":" + strconv.Itoa(Port)
	}
	return ""
}

func Links(env map[string]string, lan, code string) []string {
	var out []string
	if d := env["HOMELAB_DOMAIN"]; d != "" {
		out = append(out, "https://homelab."+d)
	} else if t := env["TAILSCALE_HOST"]; t != "" {
		out = append(out, "https://"+t+":"+strconv.Itoa(Port))
	}
	if lan == "" {
		if h, err := os.Hostname(); err == nil && h != "" {
			lan = strings.TrimSuffix(h, ".local") + ".local"
		}
	}
	if lan != "" {
		out = append(out, "http://"+lan+":"+strconv.Itoa(Port))
	}
	for i := range out {
		out[i] += "/#pair=" + code
	}
	return out
}

// pairing is a code waiting to be used.
type pairing struct {
	CodeHash  string    `json:"codeHash"`
	Name      string    `json:"name"`
	CanChange bool      `json:"canChange"`
	Finances  string    `json:"finances,omitempty"`
	Expires   time.Time `json:"expires"`
}

type state struct {
	Devices  []Device  `json:"devices"`
	Pairings []pairing `json:"pairings,omitempty"`
}

// Store keeps the paired phones in a file only this user can read.
type Store struct {
	Path string
	Now  func() time.Time
	mu   sync.Mutex
}

// StorePath is the store in the homelab folder (backed up with data/).
func StorePath(root string) string { return filepath.Join(root, "data", "phones.json") }

// NewStore opens the store at path.
func NewStore(path string) *Store { return &Store{Path: path, Now: time.Now} }

func (s *Store) load() state {
	var st state
	if data, err := os.ReadFile(s.Path); err == nil {
		_ = json.Unmarshal(data, &st)
	}
	now := s.Now()
	live := st.Pairings[:0]
	for _, p := range st.Pairings {
		if now.Before(p.Expires) {
			live = append(live, p)
		}
	}
	st.Pairings = live
	return st
}

func (s *Store) save(st state) error {
	if err := os.MkdirAll(filepath.Dir(s.Path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(st, "", "  ")
	tmp := s.Path + ".tmp"
	if err := os.WriteFile(tmp, append(data, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.Path)
}

// Devices lists the paired phones.
func (s *Store) Devices() []Device {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.load().Devices
}

// codeAlphabet leaves out look-alikes (0/O, 1/I/L), for typing a code.
const codeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// NewPairing makes a one-time code for a phone, valid for PairFor, with
// what it may do: make changes, and on Finances ("", "view", or "edit").
func (s *Store) NewPairing(name string, canChange bool, finances string) (string, error) {
	finances, err := financesLevel(finances)
	if err != nil {
		return "", err
	}
	b := make([]byte, 8)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(codeAlphabet))))
		if err != nil {
			return "", err
		}
		b[i] = codeAlphabet[n.Int64()]
	}
	code := string(b)
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.load()
	st.Pairings = append(st.Pairings, pairing{CodeHash: hash(code), Name: strings.TrimSpace(name), CanChange: canChange, Finances: finances, Expires: s.Now().Add(PairFor)})
	return code, s.save(st)
}

// ErrBadCode means the code is wrong, used, or expired.
var ErrBadCode = errors.New("that code does not work: make a new one on the computer (it works once, for 10 minutes)")

// Pair uses a code: the phone becomes a device and gets its token, which
// is shown only this once.
func (s *Store) Pair(code, name string) (Device, string, error) {
	code = strings.ToUpper(strings.Join(strings.Fields(code), ""))
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.load()
	for i, p := range st.Pairings {
		if subtle.ConstantTimeCompare([]byte(p.CodeHash), []byte(hash(code))) != 1 {
			continue
		}
		st.Pairings = append(st.Pairings[:i], st.Pairings[i+1:]...)
		token, err := secret(32)
		if err != nil {
			return Device{}, "", err
		}
		idBytes := make([]byte, 3)
		if _, err := rand.Read(idBytes); err != nil {
			return Device{}, "", err
		}
		if p.Name != "" {
			name = p.Name
		}
		name = strings.TrimSpace(name)
		if name == "" {
			name = "Phone"
		}
		d := Device{ID: hex.EncodeToString(idBytes), Name: name, TokenHash: hash(token), CanChange: p.CanChange, Finances: p.Finances, Paired: s.Now()}
		st.Devices = append(st.Devices, d)
		return d, token, s.save(st)
	}
	return Device{}, "", ErrBadCode
}

// Lookup finds the device a token belongs to, and notes when it was last
// seen (at most once a minute, to spare the disk).
func (s *Store) Lookup(token string) (Device, bool) {
	if token == "" {
		return Device{}, false
	}
	want := hash(token)
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.load()
	for i, d := range st.Devices {
		if subtle.ConstantTimeCompare([]byte(d.TokenHash), []byte(want)) == 1 {
			if now := s.Now(); now.Sub(d.LastSeen) > time.Minute {
				st.Devices[i].LastSeen = now
				_ = s.save(st)
			}
			return st.Devices[i], true
		}
	}
	return Device{}, false
}

// find matches a device by its id or its name (case aside).
func find(st state, idOrName string) int {
	for i, d := range st.Devices {
		if d.ID == strings.ToLower(idOrName) || strings.EqualFold(d.Name, idOrName) {
			return i
		}
	}
	return -1
}

// Remove unpairs a device: its token stops working at once.
func (s *Store) Remove(idOrName string) (Device, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.load()
	i := find(st, idOrName)
	if i < 0 {
		return Device{}, fmt.Errorf("no paired phone %q (homelab phone list)", idOrName)
	}
	d := st.Devices[i]
	st.Devices = append(st.Devices[:i], st.Devices[i+1:]...)
	return d, s.save(st)
}

// ErrUnencrypted is a change allowed to a device paired without
// encryption.
var ErrUnencrypted = errors.New("was paired over the home Wi-Fi without encryption, so it can only look: remove it, then pair it again with the Tailscale (https) link")

// SetCanChange lets a device start, stop, and restart apps and back up, or
// makes it read-only again. A device paired without encryption stays
// read-only.
func (s *Store) SetCanChange(idOrName string, on bool) (Device, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.load()
	i := find(st, idOrName)
	if i < 0 {
		return Device{}, fmt.Errorf("no paired phone %q (homelab phone list)", idOrName)
	}
	if on && st.Devices[i].Unencrypted {
		return st.Devices[i], fmt.Errorf("%s %w", st.Devices[i].Name, ErrUnencrypted)
	}
	st.Devices[i].CanChange = on
	return st.Devices[i], s.save(st)
}

// ErrNoFinances is Finances allowed to a device paired without encryption.
var ErrNoFinances = errors.New("was paired over the home Wi-Fi without encryption, so it cannot see Finances: remove it, then pair it again with the Tailscale (https) link")

// SetFinances sets what a device may do on Finances: "" (or "off") hides
// them, "view" shows them, "edit" lets it change the plan. A device paired
// without encryption never sees them: the household's money would cross
// the Wi-Fi readable.
func (s *Store) SetFinances(idOrName, level string) (Device, error) {
	level, err := financesLevel(level)
	if err != nil {
		return Device{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.load()
	i := find(st, idOrName)
	if i < 0 {
		return Device{}, fmt.Errorf("no paired phone %q (homelab phone list)", idOrName)
	}
	if level != "" && st.Devices[i].Unencrypted {
		return st.Devices[i], fmt.Errorf("%s %w", st.Devices[i].Name, ErrNoFinances)
	}
	st.Devices[i].Finances = level
	return st.Devices[i], s.save(st)
}

// MarkUnencrypted notes that a device was paired without encryption and
// makes it read-only for good, without Finances.
func (s *Store) MarkUnencrypted(id string) (Device, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.load()
	i := find(st, id)
	if i < 0 {
		return Device{}, fmt.Errorf("no paired phone %q (homelab phone list)", id)
	}
	st.Devices[i].Unencrypted = true
	st.Devices[i].CanChange = false
	st.Devices[i].Finances = ""
	return st.Devices[i], s.save(st)
}

func hash(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func secret(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
