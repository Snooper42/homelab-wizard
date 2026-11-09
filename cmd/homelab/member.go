package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
)

// A household member's phone (homelab phone person <phone> <name>): it
// sees only the apps they use (homelab person apps), their own Finances
// in a file of their own, and of the household's money only what the
// owner shares with them (homelab person share), to look at. It starts or
// stops no app, and nothing else of the homelab answers it
// (companion.Method.Member).

// memberName is a username safe as a folder's name: what people.json
// makes (lowercase letters, digits, dots, dashes, underscores), never
// "." or "..".
var memberName = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)

// memberRoot is a member's own homelab-like folder, where their Finances
// are kept as the household's are under the homelab folder:
// data/members/<username>/data/finance.json, and its ledger and receipts.
func memberRoot(root, username string) string {
	return filepath.Join(root, "data", "members", username)
}

// errNotMember is a phone given to someone no longer in the household.
var errNotMember = errors.New("this phone's person is no longer in the household: homelab phone person <phone> none gives it back to you")

// member is the household member a phone's call is for; ok false for the
// owner's phone. A phone given to someone removed, or never added, is an
// error: it gets nothing.
func (h *homelab) member(ctx context.Context) (people.Person, bool, error) {
	d, ok := companion.Caller(ctx)
	if !ok || d.Person == "" {
		return people.Person{}, false, nil
	}
	return h.memberNamed(d.Person)
}

func (h *homelab) memberNamed(username string) (people.Person, bool, error) {
	if !memberName.MatchString(username) || strings.Contains(username, "..") {
		return people.Person{}, true, errNotMember
	}
	list, err := people.Load(people.Path(h.root))
	if err != nil {
		return people.Person{}, true, err
	}
	for _, p := range list {
		if p.Username == username && p.Active() {
			return p, true, nil
		}
	}
	return people.Person{}, true, errNotMember
}

// financeRoot is where a call's Finances are: the homelab folder for the
// owner's phone, a member's own folder for theirs (made when first needed,
// readable by the homelab's user only).
func (h *homelab) financeRoot(ctx context.Context) (string, error) {
	p, isMember, err := h.member(ctx)
	if err != nil || !isMember {
		return h.root, err
	}
	dir := memberRoot(h.root, p.Username)
	if err := os.MkdirAll(filepath.Join(dir, "data"), 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

// onlyTheirs is Status as a member's phone sees it: the apps they use and
// what is said of those, nothing of the rest of the homelab (the others'
// names, the savings, the nightly updates).
func onlyTheirs(st api.Status, p people.Person) api.Status {
	out := api.Status{Checking: st.Checking, Apps: []api.AppStatus{}}
	for _, a := range st.Apps {
		if p.Uses(a.ID) {
			out.Apps = append(out.Apps, a)
		}
	}
	for _, id := range st.Pinned {
		if p.Uses(id) {
			out.Pinned = append(out.Pinned, id)
		}
	}
	for _, id := range st.BatteryPaused {
		if p.Uses(id) {
			out.BatteryPaused = append(out.BatteryPaused, id)
		}
	}
	for id, s := range st.Stopped {
		if p.Uses(id) {
			if out.Stopped == nil {
				out.Stopped = stopped.Record{}
			}
			out.Stopped[id] = s
		}
	}
	return out
}

// forCaller is Status for whoever asked: whole for the owner's phone, only
// theirs for a member's.
func (h *homelab) forCaller(ctx context.Context, st api.Status) (api.Status, error) {
	p, isMember, err := h.member(ctx)
	if err != nil {
		return api.Status{}, err
	}
	if !isMember {
		return st, nil
	}
	return onlyTheirs(st, p), nil
}

// forMember is what a member's phone follows on /api/events: the changes
// to their own apps, with Status cut down to theirs.
func (h *homelab) forMember(d companion.Device, c engine.Change) (engine.Change, bool) {
	p, _, err := h.memberNamed(d.Person)
	if err != nil {
		return engine.Change{}, false
	}
	out := engine.Change{Runtime: c.Runtime, Again: c.Again}
	for _, id := range c.Apps {
		if p.Uses(id) {
			out.Apps = append(out.Apps, id)
		}
	}
	if c.Status != nil {
		st := onlyTheirs(*c.Status, p)
		out.Status = &st
	}
	if len(c.Apps) > 0 && len(out.Apps) == 0 && !c.Runtime && !c.Again {
		return engine.Change{}, false // only others' apps changed
	}
	return out, true
}

// shareKinds are what of the household's money the owner may share with a
// member, to look at.
var shareKinds = []string{"bills", "subscriptions", "budgets"}

// memberShared is the household's money as a member sees it: only what
// the owner shares, and of that only names, amounts and days. Never an
// account, a balance, net worth, the ledger or investments.
type memberShared struct {
	Currency string `json:"currency"`
	// Shares are what the owner shares: bills, subscriptions, budgets.
	Shares []string `json:"shares"`
	// Bills are the household's bills in the next five weeks, soonest first.
	Bills []sharedPayment `json:"bills,omitempty"`
	// Subscriptions are the household's subscriptions with what each costs a month.
	Subscriptions []sharedPayment `json:"subscriptions,omitempty"`
	Budgets       []sharedBudget  `json:"budgets,omitempty"`
}

type sharedPayment struct {
	Name        string  `json:"name"`
	Kind        string  `json:"kind,omitempty"`
	Institution string  `json:"institution,omitempty"`
	Amount      float64 `json:"amount"`
	Estimate    bool    `json:"estimate,omitempty"`
	// Date is when it next comes (YYYY-MM-DD), "" when not ahead.
	Date string `json:"date,omitempty"`
	// Every is how often it comes (finance.Schedule.Every).
	Every string `json:"every,omitempty"`
}

type sharedBudget struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
	Spent    float64 `json:"spent"`
	Left     float64 `json:"left"`
}

// sharedFor cuts the household's plan, read forward, down to what the
// owner shares with p.
func sharedFor(v finance.View, p people.Person, now time.Time) memberShared {
	out := memberShared{Currency: v.Plan.Currency, Shares: []string{}}
	shares := map[string]bool{}
	for _, k := range p.Shares {
		shares[k] = true
	}
	for _, k := range shareKinds {
		if shares[k] {
			out.Shares = append(out.Shares, k)
		}
	}
	// A bill: paid out of the household's accounts, not money coming in, a
	// card's payoff, or a move to the household's own accounts.
	isBill := func(pay finance.Payment) bool {
		return pay.Payer == "" && pay.Card == "" && pay.To == ""
	}
	isSub := func(pay finance.Payment) bool { return pay.Kind == "subscriptions" || pay.Kind == "subscription" }
	until := now.AddDate(0, 0, 35).Format("2006-01-02")
	today := now.Format("2006-01-02")
	for _, pay := range v.Plan.Payments {
		if !isBill(pay) || pay.Schedule.Every == "" {
			continue
		}
		next := v.Next[pay.ID]
		s := sharedPayment{Name: pay.Name, Kind: pay.Kind, Institution: pay.Institution, Amount: pay.Amount, Estimate: pay.Estimate, Date: next, Every: pay.Schedule.Every}
		if isSub(pay) {
			if shares["subscriptions"] && pay.Schedule.Every != "once" {
				out.Subscriptions = append(out.Subscriptions, s)
			}
			continue
		}
		if shares["bills"] && next != "" && next >= today && next <= until {
			out.Bills = append(out.Bills, s)
		}
	}
	sort.Slice(out.Bills, func(i, j int) bool {
		if out.Bills[i].Date != out.Bills[j].Date {
			return out.Bills[i].Date < out.Bills[j].Date
		}
		return out.Bills[i].Name < out.Bills[j].Name
	})
	sort.Slice(out.Subscriptions, func(i, j int) bool {
		return strings.ToLower(out.Subscriptions[i].Name) < strings.ToLower(out.Subscriptions[j].Name)
	})
	if shares["budgets"] {
		for _, b := range v.Budgets {
			out.Budgets = append(out.Budgets, sharedBudget{Category: b.Category, Amount: b.Amount, Spent: b.Spent, Left: b.Left})
		}
	}
	return out
}

// personShare is homelab person share <name> [bills,subscriptions,budgets|none]:
// what of the household's money their phone shows them, to look at.
func (h *homelab) personShare(list []people.Person, pos []string) error {
	if len(pos) == 0 {
		return fmt.Errorf("usage: homelab person share <name> [bills,subscriptions,budgets|none]")
	}
	i, ok := people.Find(list, pos[0])
	if !ok || !list[i].Active() {
		return fmt.Errorf("%s is not in the household (homelab person list)", pos[0])
	}
	p := &list[i]
	if len(pos) == 1 {
		if len(p.Shares) == 0 {
			h.ui.Info("%s's phone shows none of the household's money (homelab person share %s bills,subscriptions,budgets shares them)", p.Name, p.Username)
		} else {
			h.ui.Info("%s's phone shows the household's %s, to look at", p.Name, strings.Join(p.Shares, ", "))
		}
		return nil
	}
	var want []string
	for _, arg := range pos[1:] {
		for _, k := range splitList(arg) {
			k = strings.ToLower(strings.TrimSpace(k))
			switch {
			case k == "none" || k == "":
			case slices.Contains(shareKinds, k):
				if !slices.Contains(want, k) {
					want = append(want, k)
				}
			default:
				return fmt.Errorf("%q is not something to share: bills, subscriptions, budgets, or none", k)
			}
		}
	}
	p.Shares = want
	if err := people.Save(people.Path(h.root), list); err != nil {
		return err
	}
	if len(want) == 0 {
		h.ui.OK("%s's phone shows none of the household's money", p.Name)
	} else {
		h.ui.OK("%s's phone shows the household's %s, to look at", p.Name, strings.Join(want, ", "))
	}
	return nil
}
