package main

import (
	"errors"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/people"
)

// SendTarget is a paired phone a page can be sent to (Send to my phone):
// never a wall screen. Finances: it may see them. Member: a household
// member's phone, sent only Status and Apps, their own apps (none listed:
// every app).
type SendTarget struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Finances bool     `json:"finances,omitempty"`
	Member   bool     `json:"member,omitempty"`
	Apps     []string `json:"apps,omitempty"`
}

// SendTargets lists the phones a page can be sent to, in the order paired.
func (a *App) SendTargets() []SendTarget {
	out := []SendTarget{}
	list, _ := people.Load(people.Path(a.root))
	for _, d := range companion.NewStore(companion.StorePath(a.root)).Devices() {
		if d.Kiosk {
			continue
		}
		t := SendTarget{ID: d.ID, Name: d.Name, Finances: companion.MayOpen(d, "homelab://finances", nil)}
		if d.Person != "" {
			t.Member, t.Finances = true, false
			if i, ok := people.Find(list, d.Person); ok {
				t.Apps = list[i].Apps
			}
		}
		out = append(out, t)
	}
	return out
}

// SendToPhone sends one of the app's own pages (a homelab:// link) to a
// paired phone, which shows it with one tap to open. Title is its name
// there ("Radarr", "Finances › Recurring"). A wall screen, a phone not
// allowed to see the page, and a link that isn't the app's own are
// refused.
func (a *App) SendToPhone(device, link, title string) error {
	for _, d := range companion.NewStore(companion.StorePath(a.root)).Devices() {
		if d.ID != device {
			continue
		}
		uses := func(string) bool { return false }
		if d.Person != "" {
			list, _ := people.Load(people.Path(a.root))
			if i, ok := people.Find(list, d.Person); ok && list[i].Active() {
				uses = list[i].Uses
			}
		}
		if !companion.MayOpen(d, link, uses) {
			return errors.New(d.Name + " can't open that page")
		}
		return companion.Send(a.root, companion.Sent{Device: d.ID, Link: link, Title: title})
	}
	return errors.New("that phone isn't paired any more")
}
