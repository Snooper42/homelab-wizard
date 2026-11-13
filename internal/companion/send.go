package companion

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// Send to my phone (unison-handoff.md item 7; the owner, Nov 12: pick a
// phone each time, never a wall screen): the computer's window sends one
// of the app's own links to one paired phone, which shows it with one tap
// to open. The desktop app and the companion are two processes, so a send
// is a small file in the homelab folder that the companion picks up, passes
// to that phone's stream once, and removes. One not picked up within
// sentFor (the companion is off) is dropped: a phone that comes back an
// hour later should not open something it was sent then.

// Sent is one send: the phone it is for (its ID), the link, a name to show
// (the app's or the page's), and when it was sent.
type Sent struct {
	Device string    `json:"device"`
	Link   string    `json:"link"`
	Title  string    `json:"title,omitempty"`
	At     time.Time `json:"at"`
}

// SentDir is where sends wait for the companion, beside phones.json.
func SentDir(root string) string { return filepath.Join(root, "data", "phone-sent") }

// sentFor is how long a send waits for the companion to pass it on.
const sentFor = 2 * time.Minute

// openLink is every link a send may carry: a page of the app, never one
// with an action (a link never changes anything by itself, and a send asks
// for no tap to confirm), nor anything but a page's name; only the pages a
// phone has (no Tidy Up, no Setup, no Settings).
var openLink = regexp.MustCompile(`^homelab://(status|backups|finances(/[a-z]{1,20})?|app/[a-z0-9][a-z0-9_-]{0,62})$`)

// OpenLink reports whether link is one a send may carry.
func OpenLink(link string) bool { return openLink.MatchString(link) }

// MayOpen reports whether d may be sent link: never a wall screen (anyone
// walking past uses it); Finances only to a phone allowed to see them; a
// member's phone only their own apps (uses) and Status, which it reads cut
// down to theirs.
func MayOpen(d Device, link string, uses func(id string) bool) bool {
	if d.Kiosk || !OpenLink(link) {
		return false
	}
	page := strings.TrimPrefix(link, "homelab://")
	if d.Person != "" {
		if page == "status" {
			return true
		}
		id, ok := strings.CutPrefix(page, "app/")
		return ok && uses != nil && uses(id)
	}
	if page == "finances" || strings.HasPrefix(page, "finances/") {
		return d.Finances == FinancesView || d.Finances == FinancesEdit
	}
	return true
}

// Send leaves s for the companion to pass on, now. The caller checks the
// phone may open it (MayOpen); this checks the link is the app's own.
func Send(root string, s Sent) error {
	if s.Device == "" {
		return errors.New("no phone to send it to")
	}
	if !OpenLink(s.Link) {
		return errors.New("only a page of the app can be sent to a phone")
	}
	s.Title = shownTitle(s.Title)
	s.At = time.Now().UTC()
	dir := SentDir(root)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	name := strconv.FormatInt(time.Now().UnixNano(), 10) + "-" + hex.EncodeToString(b)
	// Written whole, then named .json, so the companion never reads half of one.
	tmp := filepath.Join(dir, name+".tmp")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, name+".json"))
}

// shownTitle is a name to show on the phone: one line, at most 80 letters.
func shownTitle(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, strings.TrimSpace(s))
	if r := []rune(s); len(r) > 80 {
		s = string(r[:80])
	}
	return s
}

// FollowSent passes each send waiting in root to publish, once, oldest
// first, looking again every `every` until ctx ends. Each is removed as it
// is read; one too old, or not a send, is dropped.
func FollowSent(ctx context.Context, root string, every time.Duration, publish func(Sent)) {
	tick := time.NewTicker(every)
	defer tick.Stop()
	for {
		for _, s := range takeSent(root, time.Now()) {
			publish(s)
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

// takeSent reads and removes the sends waiting in root, keeping those sent
// within sentFor of now with a link a send may carry.
func takeSent(root string, now time.Time) []Sent {
	dir := SentDir(root)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []Sent
	for _, e := range entries { // ReadDir sorts by name: by when it was sent
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path) // #nosec G304 -- a file in the homelab's own folder, by its listed name
		_ = os.Remove(path)
		var s Sent
		if err != nil || json.Unmarshal(data, &s) != nil || s.Device == "" || !OpenLink(s.Link) || now.Sub(s.At) > sentFor || s.At.After(now.Add(time.Minute)) {
			continue
		}
		s.Title = shownTitle(s.Title)
		out = append(out, s)
	}
	return out
}
