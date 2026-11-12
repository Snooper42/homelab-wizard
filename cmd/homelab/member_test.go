package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func memberHomelab(t *testing.T, list []people.Person) *homelab {
	t.Helper()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := people.Save(people.Path(root), list); err != nil {
		t.Fatal(err)
	}
	return &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}}
}

var sam = people.Person{Username: "sam", Name: "Sam", Apps: []string{"immich-server", "audiobookshelf"}, Shares: []string{"bills", "budgets"}}

// A member's phone gets their apps and nothing said of the rest.
func TestAMemberSeesOnlyTheirApps(t *testing.T) {
	st := api.Status{
		Apps:          []api.AppStatus{{ID: "immich-server", Name: "Immich"}, {ID: "vaultwarden", Name: "Vaultwarden"}, {ID: "audiobookshelf", Name: "Audiobookshelf"}},
		Savings:       1200,
		Pinned:        []string{"vaultwarden", "immich-server"},
		BatteryPaused: []string{"vaultwarden"},
		Stopped:       stopped.Record{"vaultwarden": {}, "audiobookshelf": {}},
		Missing:       2,
	}
	got := onlyTheirs(st, sam)
	if len(got.Apps) != 2 || got.Apps[0].ID != "immich-server" || got.Apps[1].ID != "audiobookshelf" {
		t.Errorf("apps: %+v", got.Apps)
	}
	if got.Savings != 0 || got.Missing != 0 || len(got.BatteryPaused) != 0 {
		t.Errorf("the rest leaked: %+v", got)
	}
	if len(got.Pinned) != 1 || got.Pinned[0] != "immich-server" {
		t.Errorf("pinned: %v", got.Pinned)
	}
	if _, ok := got.Stopped["vaultwarden"]; ok || len(got.Stopped) != 1 {
		t.Errorf("stopped: %v", got.Stopped)
	}
	data, _ := json.Marshal(got)
	if strings.Contains(string(data), "Vaultwarden") {
		t.Errorf("another app's name in a member's Status: %s", data)
	}

	h := memberHomelab(t, []people.Person{sam})
	ctx := companion.WithCaller(context.Background(), companion.Device{ID: "p1", Person: "sam", PersonName: "Sam"})
	if got, err := h.forCaller(ctx, st); err != nil || len(got.Apps) != 2 {
		t.Errorf("forCaller, member: %d apps, %v", len(got.Apps), err)
	}
	owner := companion.WithCaller(context.Background(), companion.Device{ID: "p0"})
	if got, err := h.forCaller(owner, st); err != nil || len(got.Apps) != 3 {
		t.Errorf("forCaller, owner: %d apps, %v", len(got.Apps), err)
	}
	// Removed from the household, or a name that can't be a folder: nothing.
	for _, who := range []string{"ben", "../sam", ".", "Sam"} {
		ctx := companion.WithCaller(context.Background(), companion.Device{ID: "p2", Person: who})
		if _, err := h.forCaller(ctx, st); !errors.Is(err, errNotMember) {
			t.Errorf("%q: %v", who, err)
		}
	}
}

// Changes on /api/events: theirs, cut down; others' alone, not at all.
func TestAMemberFollowsOnlyTheirChanges(t *testing.T) {
	h := memberHomelab(t, []people.Person{sam})
	d := companion.Device{Person: "sam"}
	if _, ok := h.forMember(d, engine.Change{Apps: []string{"vaultwarden"}}); ok {
		t.Error("another app's change reached a member")
	}
	st := api.Status{Apps: []api.AppStatus{{ID: "immich-server"}, {ID: "vaultwarden"}}}
	c, ok := h.forMember(d, engine.Change{Apps: []string{"immich-server", "vaultwarden"}, Status: &st})
	if !ok || len(c.Apps) != 1 || c.Status == nil || len(c.Status.Apps) != 1 {
		t.Errorf("their change: %+v %v", c, ok)
	}
	if _, ok := h.forMember(d, engine.Change{Again: true}); !ok {
		t.Error("read again (after a gap) didn't reach a member")
	}
	if _, ok := h.forMember(companion.Device{Person: "ben"}, engine.Change{Again: true}); ok {
		t.Error("a phone for someone not in the household followed changes")
	}
}

// A member's Finances are their own file, apart from the household's.
func TestAMembersFinancesAreTheirOwn(t *testing.T) {
	h := memberHomelab(t, []people.Person{sam})
	ctx := companion.WithCaller(context.Background(), companion.Device{Person: "sam", Finances: companion.FinancesEdit})
	froot, err := h.financeRoot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(h.root, "data", "members", "sam")
	if froot != want {
		t.Errorf("member's root %s, want %s", froot, want)
	}
	// Readable by the homelab's user only (Windows has no such bits).
	if info, err := os.Stat(filepath.Join(want, "data")); err != nil || !info.IsDir() || (runtime.GOOS != "windows" && info.Mode().Perm() != 0o700) {
		t.Errorf("their folder: %v %v", info, err)
	}
	// N53: a person whose username was edited into a path gets no folder at all.
	bad := memberHomelab(t, []people.Person{{Username: "../../elsewhere", Name: "Elsewhere", Apps: []string{"immich"}}})
	if froot, err := bad.financeRoot(companion.WithCaller(context.Background(), companion.Device{Person: "../../elsewhere", Finances: companion.FinancesEdit})); err == nil {
		t.Errorf("a username edited into a path got a folder: %s", froot)
	}
	owner := companion.WithCaller(context.Background(), companion.Device{})
	if froot, _ := h.financeRoot(owner); froot != h.root {
		t.Errorf("owner's root %s", froot)
	}
	// Through the phone methods: Sam's save lands in Sam's file only.
	m := h.phoneMethods()
	plan, _ := json.Marshal(finance.Plan{Rev: "new", Currency: "USD"})
	if _, _, err := m["SaveFinances"].Call(ctx, []json.RawMessage{plan}); err != nil {
		t.Fatalf("Sam's save: %v", err)
	}
	if _, err := os.Stat(finance.Path(want)); err != nil {
		t.Errorf("Sam's plan: %v", err)
	}
	if _, err := os.Stat(finance.Path(h.root)); !os.IsNotExist(err) {
		t.Errorf("the household's plan was written by Sam's phone: %v", err)
	}
	for _, name := range []string{"Status", "StatusBoard", "LastStatus", "Catalog", "Screen", "AppIcon", "Finances", "FinancesWall", "SaveFinances", "FinancesLedger", "SaveFinancesLedger", "FinancesReceipt", "SaveFinancesReceipt", "FinancesShared"} {
		if !m[name].Member {
			t.Errorf("%s isn't for a member's phone", name)
		}
	}
	for _, name := range []string{"Backups", "Logs", "Settings", "SaveSettings", "Report", "FinancesReadInvestments", "Watchdog", "Alerts"} {
		if mm, ok := m[name]; ok && mm.Member {
			t.Errorf("%s answers a member's phone", name)
		}
	}
}

// Of the household's money, only what the owner shares: names, amounts
// and days.
func TestWhatAMemberSeesOfTheHouseholds(t *testing.T) {
	now := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)
	v := finance.View{
		Plan: finance.Plan{Currency: "USD", Payments: []finance.Payment{
			{ID: "rent", Name: "Rent", Amount: 1200, Kind: "home", Schedule: finance.Schedule{Every: "month"}},
			{ID: "netflix", Name: "Netflix", Amount: 15.49, Kind: "subscriptions", Schedule: finance.Schedule{Every: "month"}},
			{ID: "card", Name: "Visa", Card: "visa", Schedule: finance.Schedule{Every: "month"}},
			{ID: "save", Name: "To savings", To: "sav", Amount: 100, Schedule: finance.Schedule{Every: "month"}},
			{ID: "gift", Name: "From Grandma", Payer: "Grandma", Amount: 50, Schedule: finance.Schedule{Every: "month"}},
			{ID: "insure", Name: "Car insurance", Amount: 600, Schedule: finance.Schedule{Every: "year"}},
		}},
		Next:    map[string]string{"rent": "2026-12-01", "netflix": "2026-11-24", "card": "2026-11-25", "save": "2026-11-21", "gift": "2026-11-22", "insure": "2027-03-01"},
		Budgets: []finance.BudgetNow{{Category: "Groceries", Amount: 600, Spent: 410, Left: 190}},
	}
	got := sharedFor(v, sam, now)
	if len(got.Bills) != 1 || got.Bills[0].Name != "Rent" {
		t.Errorf("bills: %+v", got.Bills)
	}
	if len(got.Subscriptions) != 0 {
		t.Errorf("subscriptions not shared but sent: %+v", got.Subscriptions)
	}
	if len(got.Budgets) != 1 || got.Budgets[0].Left != 190 {
		t.Errorf("budgets: %+v", got.Budgets)
	}
	if len(got.Shares) != 2 {
		t.Errorf("shares: %v", got.Shares)
	}
	none := sharedFor(v, people.Person{Username: "kid"}, now)
	if len(none.Bills)+len(none.Subscriptions)+len(none.Budgets) != 0 {
		t.Errorf("nothing shared, something sent: %+v", none)
	}
	all := sharedFor(v, people.Person{Username: "sam", Shares: shareKinds}, now)
	if len(all.Subscriptions) != 1 || all.Subscriptions[0].Name != "Netflix" {
		t.Errorf("subscriptions: %+v", all.Subscriptions)
	}
}
