package main

import (
	"fmt"

	"github.com/Snooper42/homelab-wizard/internal/people"
)

// Who uses an app, on a phone (apple-loop.md; the owner's yes, Nov 20, on
// the canvas's *Idea: Who uses it*), as the computer's app page shows it:
// the household members who sign in to it. Only each one's name goes to the
// phone, never an email, a username or a sign-in id.

// phoneAppPeople is who uses one app. Household is false for an app people
// don't sign in to (a helper, the network's or the system's), which shows no
// card on the phone, as on the computer.
type phoneAppPeople struct {
	Household bool          `json:"household"`
	People    []phonePerson `json:"people"`
}

type phonePerson struct {
	Name string `json:"name"`
}

func (h *homelab) appPeople(id string) (phoneAppPeople, error) {
	a, ok := h.catalog.Get(id)
	if !ok {
		return phoneAppPeople{}, fmt.Errorf("unknown app %q", id)
	}
	out := phoneAppPeople{People: []phonePerson{}}
	if !householdApp(a) {
		return out, nil
	}
	out.Household = true
	list, err := people.Load(people.Path(h.root))
	if err != nil {
		return out, err
	}
	for _, p := range list {
		if !p.Active() || !p.Uses(id) {
			continue
		}
		name := p.Name
		if name == "" {
			name = "Someone in the household" // never the username: it's their sign-in
		}
		out.People = append(out.People, phonePerson{Name: name})
	}
	return out, nil
}
