package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Settings › Phones on the owner's phone (the owner's yes, Nov 19, from the
// mocks canvas): the paired phones, and only less from there. Both calls are
// for a phone that can make changes, never a household member's or a wall
// screen, over an encrypted connection only; no token is ever sent; a phone
// is given less (looks only, less of Finances, removed), never more, and
// never the phone asking.
func TestPhonesListsThemAndOnlyGivesLess(t *testing.T) {
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	methods := h.phoneMethods()
	list, lower := methods["Phones"], methods["LowerPhone"]
	for name, m := range map[string]companion.Method{"Phones": list, "LowerPhone": lower} {
		if m.Call == nil || !m.Change || !m.Private || m.Member {
			t.Fatalf("%s: change %v, private %v, member %v", name, m.Change, m.Private, m.Member)
		}
	}

	store := companion.NewStore(companion.StorePath(root))
	pair := func(name string, canChange bool, finances string) companion.Device {
		code, err := store.NewPairing(name, canChange, finances)
		if err != nil {
			t.Fatal(err)
		}
		d, _, err := store.Pair(code, name)
		if err != nil {
			t.Fatal(err)
		}
		return d
	}
	me := pair("Alex's iPhone", true, companion.FinancesEdit)
	guest := pair("Guest iPhone", true, companion.FinancesEdit)
	kitchen := pair("Kitchen iPad", false, companion.FinancesCard)
	if _, err := store.MarkKiosk(kitchen.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SetFinances(kitchen.ID, companion.FinancesCard); err != nil {
		t.Fatal(err)
	}
	old := pair("Old iPhone", true, companion.FinancesView)
	if _, err := store.SetUntil(old.ID, time.Now().Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}

	ctx := companion.WithCaller(context.Background(), me)
	phones := func(v any) map[string]phonePhone {
		t.Helper()
		b, _ := json.Marshal(v)
		if strings.Contains(string(b), "token") || strings.Contains(strings.ToLower(string(b)), "tunnel") {
			t.Fatalf("a secret sent: %s", b)
		}
		var got []phonePhone
		if err := json.Unmarshal(b, &got); err != nil {
			t.Fatal(err)
		}
		out := map[string]phonePhone{}
		for _, p := range got {
			out[p.ID] = p
		}
		return out
	}
	v, _, err := list.Call(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	got := phones(v)
	if len(got) != 4 || !got[me.ID].This || got[guest.ID].This {
		t.Fatalf("the list, this phone marked: %+v", got)
	}
	if !got[guest.ID].CanChange || got[guest.ID].Finances != companion.FinancesEdit {
		t.Errorf("guest: %+v", got[guest.ID])
	}
	if !got[kitchen.ID].Kiosk || got[kitchen.ID].CanChange || got[kitchen.ID].Finances != companion.FinancesCard {
		t.Errorf("a wall screen: %+v", got[kitchen.ID])
	}
	// A For a day that has ended: it only looks now, so it says so.
	if got[old.ID].CanChange || got[old.ID].Finances != "" || !got[old.ID].Until.IsZero() {
		t.Errorf("ended: %+v", got[old.ID])
	}

	call := func(id, what string) (map[string]phonePhone, error) {
		a, _ := json.Marshal(id)
		b, _ := json.Marshal(what)
		v, _, err := lower.Call(ctx, []json.RawMessage{a, b})
		return phones(v), err
	}
	// Never more: a higher Finances level, the same one, or one that isn't a level.
	for _, what := range []string{"finances:edit", "finances:bogus", "canChange", "pair"} {
		if _, err := call(kitchen.ID, what); err == nil {
			t.Errorf("%s on the wall screen was allowed", what)
		}
	}
	if _, err := call(guest.ID, "finances:edit"); err == nil {
		t.Error("the same Finances level was allowed")
	}
	// Never the phone asking, nor one that isn't paired.
	if _, err := call(me.ID, "looksOnly"); err == nil {
		t.Error("this phone lowered itself")
	}
	if _, err := call("nobody", "remove"); err == nil {
		t.Error("an unknown phone")
	}

	// Less, each in turn.
	if got, err = call(guest.ID, "looksOnly"); err != nil || got[guest.ID].CanChange {
		t.Fatalf("looks only: %v %+v", err, got[guest.ID])
	}
	if got, err = call(guest.ID, "finances:view"); err != nil || got[guest.ID].Finances != companion.FinancesView {
		t.Fatalf("less of Finances: %v %+v", err, got[guest.ID])
	}
	if got, err = call(guest.ID, "finances:"); err != nil || got[guest.ID].Finances != "" {
		t.Fatalf("Finances hidden: %v %+v", err, got[guest.ID])
	}
	if got, err = call(guest.ID, "remove"); err != nil || len(got) != 3 {
		t.Fatalf("removed: %v %+v", err, got)
	}
	if _, ok := got[guest.ID]; ok {
		t.Fatal("the removed phone is still listed")
	}
	if _, found := store.Lookup("anything"); found {
		t.Fatal("a token that was never given")
	}
}
