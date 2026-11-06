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

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// Port is where homelab serve listens.
const Port = 8099

// PairFor is how long a pairing code works.
const PairFor = 10 * time.Minute

// What a phone may do on Finances: nothing (""), see only the money card
// (a wall screen: the next payday, what is left after it, the next bills),
// look, or change the plan. It is apart from CanChange: a phone that
// restarts apps need not see the household's money, and one that keeps the
// budget need not restart apps.
const (
	FinancesCard = "card"
	FinancesView = "view"
	FinancesEdit = "edit"
)

// FinancesAllow reports whether a phone's Finances level covers need.
func FinancesAllow(have, need string) bool {
	switch need {
	case "":
		return true
	case FinancesCard:
		return have == FinancesCard || have == FinancesView || have == FinancesEdit
	case FinancesView:
		return have == FinancesView || have == FinancesEdit
	}
	return have == FinancesEdit
}

func financesLevel(level string) (string, error) {
	switch level = strings.ToLower(strings.TrimSpace(level)); level {
	case "", "off", "none", "hidden":
		return "", nil
	case FinancesCard, FinancesView, FinancesEdit:
		return level, nil
	}
	return "", fmt.Errorf("finances is off, card, view, or edit, not %q", level)
}

// Device is one paired phone. Only a hash of its token is kept.
type Device struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	TokenHash string `json:"tokenHash"`
	CanChange bool   `json:"canChange"`
	// Finances is what it may do on Finances: "", FinancesCard, FinancesView, or FinancesEdit.
	Finances string `json:"finances,omitempty"`
	// Unencrypted: paired over plain HTTP on the home network, so its
	// token crosses the Wi-Fi readable; it may only look, for good.
	Unencrypted bool      `json:"unencrypted,omitempty"`
	Paired      time.Time `json:"paired"`
	LastSeen    time.Time `json:"lastSeen"`
	// Until is when what it may do beyond looking ends: making changes,
	// and seeing or changing Finances (a wall screen's money card stays).
	// Zero: until you change it. Reached, the phone only looks.
	Until time.Time `json:"until,omitzero"`
	// Kiosk: paired as a wall screen, which anyone walking past can use,
	// so it only looks (and may show the money card), for good (N26).
	Kiosk bool `json:"kiosk,omitempty"`
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
	// Until is when its changes and Finances end; zero: until you change it.
	Until time.Time `json:"until,omitzero"`
}

// Phones lists the paired phones for the screens.
func (s *Store) Phones() []Phone {
	out := []Phone{}
	for _, d := range s.Devices() {
		out = append(out, Phone{ID: d.ID, Name: d.Name, CanChange: d.CanChange, Finances: d.Finances, Unencrypted: d.Unencrypted, Paired: d.Paired, LastSeen: d.LastSeen, Until: d.Until})
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

// Store keeps the paired phones in a file only this user can read. Every
// change is made under the file's lock (internal/lockedfile): homelab serve,
// the app, and homelab phone are processes of their own, and mu is one
// process's only (N22).
type Store struct {
	Path string
	Now  func() time.Time
	mu   sync.Mutex
}

// StorePath is the store in the homelab folder (backed up with data/).
func StorePath(root string) string { return filepath.Join(root, "data", "phones.json") }

// NewStore opens the store at path.
func NewStore(path string) *Store { return &Store{Path: path, Now: time.Now} }

// parse reads a store's file, without the pairing codes that have run out
// and with each phone's time that is up ended (expire says whether any was).
func parse(data []byte, now time.Time) (state, bool) {
	var st state
	_ = json.Unmarshal(data, &st)
	live := st.Pairings[:0]
	for _, p := range st.Pairings {
		if now.Before(p.Expires) {
			live = append(live, p)
		}
	}
	st.Pairings = live
	return st, expire(st.Devices, now)
}

// update reads the store and passes it to change, holding the file's lock
// throughout, so a change another process makes meanwhile waits and is
// never saved over. The store is saved whole when change says so, or when
// a phone's time ran out.
func (s *Store) update(change func(st *state) bool) error {
	return lockedfile.Update(s.Path, 0o600, func(old []byte) ([]byte, bool) {
		st, expired := parse(old, s.Now())
		if !change(&st) && !expired {
			return nil, false
		}
		data, _ := json.MarshalIndent(st, "", "  ")
		return append(data, '\n'), true
	})
}

// view reads the store without saving: for a store not made yet, and for a
// reader the lock kept waiting too long.
func (s *Store) view() state {
	data, _ := os.ReadFile(s.Path)
	st, _ := parse(data, s.Now())
	return st
}

// read passes the store to look under its lock, as update does, saving it
// when look says so; with no store yet, or the lock not had, it looks
// without saving.
func (s *Store) read(look func(st *state) bool) {
	if _, err := os.Stat(s.Path); err != nil {
		st := s.view()
		look(&st)
		return
	}
	ran := false
	if err := s.update(func(st *state) bool { ran = true; return look(st) }); err != nil && !ran {
		st := s.view()
		look(&st)
	}
}

// expire takes from each device whose time is up what it may do beyond
// looking: it makes no more changes and sees no Finances (a wall screen
// keeps its money card). It says whether any changed.
func expire(devices []Device, now time.Time) bool {
	changed := false
	for i, d := range devices {
		if d.Until.IsZero() || now.Before(d.Until) {
			continue
		}
		devices[i].CanChange = false
		if d.Finances != FinancesCard {
			devices[i].Finances = ""
		}
		devices[i].Until = time.Time{}
		changed = true
	}
	return changed
}

// SetUntil ends what a device may do beyond looking at until (zero: never,
// until you change it). A time already past ends it now.
func (s *Store) SetUntil(idOrName string, until time.Time) (Device, error) {
	return s.change(idOrName, func(d *Device) error {
		d.Until = until.Truncate(time.Second)
		one := []Device{*d}
		expire(one, s.Now())
		*d = one[0]
		return nil
	})
}

// change applies fn to one device, found by its id or name, under the
// store's lock; an error from fn leaves the store as it was.
func (s *Store) change(idOrName string, fn func(d *Device) error) (Device, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var d Device
	var ferr error
	err := s.update(func(st *state) bool {
		i := find(*st, idOrName)
		if i < 0 {
			ferr = fmt.Errorf("no paired phone %q (homelab phone list)", idOrName)
			return false
		}
		if ferr = fn(&st.Devices[i]); ferr != nil {
			d = st.Devices[i]
			return false
		}
		d = st.Devices[i]
		return true
	})
	if ferr != nil {
		return d, ferr
	}
	return d, err
}

// Devices lists the paired phones.
func (s *Store) Devices() []Device {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Device
	s.read(func(st *state) bool { out = st.Devices; return false })
	return out
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
	return code, s.update(func(st *state) bool {
		st.Pairings = append(st.Pairings, pairing{CodeHash: hash(code), Name: strings.TrimSpace(name), CanChange: canChange, Finances: finances, Expires: s.Now().Add(PairFor)})
		return true
	})
}

// ErrBadCode means the code is wrong, used, or expired.
var ErrBadCode = errors.New("that code does not work: make a new one on the computer (it works once, for 10 minutes)")

// Pair uses a code: the phone becomes a device and gets its token, which
// is shown only this once.
func (s *Store) Pair(code, name string) (Device, string, error) {
	code = strings.ToUpper(strings.Join(strings.Fields(code), ""))
	token, err := secret(32)
	if err != nil {
		return Device{}, "", err
	}
	idBytes := make([]byte, 3)
	if _, err := rand.Read(idBytes); err != nil {
		return Device{}, "", err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	var d Device
	paired := false
	err = s.update(func(st *state) bool {
		for i, p := range st.Pairings {
			if subtle.ConstantTimeCompare([]byte(p.CodeHash), []byte(hash(code))) != 1 {
				continue
			}
			st.Pairings = append(st.Pairings[:i], st.Pairings[i+1:]...)
			if p.Name != "" {
				name = p.Name
			}
			name = strings.TrimSpace(name)
			if name == "" {
				name = "Phone"
			}
			d = Device{ID: hex.EncodeToString(idBytes), Name: name, TokenHash: hash(token), CanChange: p.CanChange, Finances: p.Finances, Paired: s.Now()}
			st.Devices = append(st.Devices, d)
			paired = true
			return true
		}
		return false
	})
	if err != nil {
		return Device{}, "", err
	}
	if !paired {
		return Device{}, "", ErrBadCode
	}
	return d, token, nil
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
	var found Device
	ok := false
	s.read(func(st *state) bool {
		for i, d := range st.Devices {
			if subtle.ConstantTimeCompare([]byte(d.TokenHash), []byte(want)) == 1 {
				ok = true
				if now := s.Now(); now.Sub(d.LastSeen) > time.Minute {
					st.Devices[i].LastSeen = now
					found = st.Devices[i]
					return true
				}
				found = st.Devices[i]
				return false
			}
		}
		return false
	})
	return found, ok
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
	var d Device
	var ferr error
	err := s.update(func(st *state) bool {
		i := find(*st, idOrName)
		if i < 0 {
			ferr = fmt.Errorf("no paired phone %q (homelab phone list)", idOrName)
			return false
		}
		d = st.Devices[i]
		st.Devices = append(st.Devices[:i], st.Devices[i+1:]...)
		return true
	})
	if ferr != nil {
		return Device{}, ferr
	}
	return d, err
}

// ErrUnencrypted is a change allowed to a device paired without
// encryption.
var ErrUnencrypted = errors.New("was paired over the home Wi-Fi without encryption, so it can only look: remove it, then pair it again with the Tailscale (https) link")

// ErrKiosk is changes, or Finances beyond the money card, allowed to a
// wall screen.
var ErrKiosk = errors.New("was paired as a wall screen, which anyone walking past can use, so it can only look (and show the money card): pair a phone for more")

// SetCanChange lets a device start, stop, and restart apps and back up, or
// makes it read-only again. A device paired without encryption stays
// read-only.
func (s *Store) SetCanChange(idOrName string, on bool) (Device, error) {
	return s.change(idOrName, func(d *Device) error {
		if on && d.Unencrypted {
			return fmt.Errorf("%s %w", d.Name, ErrUnencrypted)
		}
		if on && d.Kiosk {
			return fmt.Errorf("%s %w", d.Name, ErrKiosk)
		}
		d.CanChange = on
		return nil
	})
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
	return s.change(idOrName, func(d *Device) error {
		if level != "" && d.Unencrypted {
			return fmt.Errorf("%s %w", d.Name, ErrNoFinances)
		}
		if level != "" && level != FinancesCard && d.Kiosk {
			return fmt.Errorf("%s %w", d.Name, ErrKiosk)
		}
		d.Finances = level
		return nil
	})
}

// MarkKiosk notes that a device is a wall screen and takes away its
// changes and Finances, for good: the Phones page may give it the money
// card, nothing more (N26).
func (s *Store) MarkKiosk(id string) (Device, error) {
	return s.change(id, func(d *Device) error {
		d.Kiosk = true
		d.CanChange = false
		d.Finances = ""
		return nil
	})
}

// MarkUnencrypted notes that a device was paired without encryption and
// makes it read-only for good, without Finances.
func (s *Store) MarkUnencrypted(id string) (Device, error) {
	return s.change(id, func(d *Device) error {
		d.Unencrypted = true
		d.CanChange = false
		d.Finances = ""
		return nil
	})
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
