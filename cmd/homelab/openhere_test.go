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

// Open on the computer (the owner, Nov 12: from a phone allowed to change
// things, no Face ID): the computer's window goes to the page the phone
// is on. A change, so a phone that only looks and a wall screen are
// refused before it runs; a page it may not see itself, and a link that
// isn't the app's own, are refused by it.
func TestOpenOnComputer(t *testing.T) {
	root, _ := repoCopy(t, "")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	m := h.phoneMethods()["OpenOnComputer"]
	if m.Call == nil || !m.Change || m.Member {
		t.Fatalf("OpenOnComputer is a change, the owner's phones' only: %+v", m)
	}
	arg := func(link string) []json.RawMessage { b, _ := json.Marshal(link); return []json.RawMessage{b} }
	sam := companion.WithCaller(context.Background(), companion.Device{ID: "a1", Name: "Sam's iPhone", CanChange: true, Finances: companion.FinancesEdit})
	ipad := companion.WithCaller(context.Background(), companion.Device{ID: "a2", Name: "The iPad", CanChange: true})
	for _, c := range []struct {
		ctx  context.Context
		link string
		ok   bool
	}{
		{sam, "homelab://finances/recurring", true}, {ipad, "homelab://app/vikunja", true},
		{ipad, "homelab://finances", false}, {sam, "https://example.com", false}, {sam, "homelab://app/vikunja?do=stop", false},
	} {
		if _, _, err := m.Call(c.ctx, arg(c.link)); (err == nil) != c.ok {
			t.Errorf("%s: %v", c.link, err)
		}
	}
	got, ok := companion.TakeAsked(root, time.Now())
	if !ok || got.Link != "homelab://app/vikunja" || got.From != "The iPad" {
		t.Errorf("the window is asked for: %+v %v (the last one asked)", got, ok)
	}
	if _, ok := companion.TakeAsked(root, time.Now()); ok {
		t.Error("asked twice")
	}
}
