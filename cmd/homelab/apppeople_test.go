package main

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Who uses an app, on a phone: the owner's phones over https only (Private),
// never a member's; each active person who uses it, by name only (no email,
// username or sign-in id); and no card for an app people don't sign in to.
func TestPhoneAppPeople(t *testing.T) {
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	list := []people.Person{
		{Username: "alex", Name: "Alex Doe", Email: "alex@example.com", PocketID: "pid-1"},
		{Username: "sam", Name: "Sam Doe", Email: "sam@example.com", Apps: []string{"immich"}},
		{Username: "jo", Name: "Jo Doe", Apps: []string{"jellyfin"}},
		{Username: "gone", Name: "Gone Doe", Removed: time.Now()},
		{Username: "noname"},
	}
	if err := people.Save(people.Path(root), list); err != nil {
		t.Fatal(err)
	}
	m, ok := h.phoneMethods()["AppPeople"]
	if !ok || m.Call == nil {
		t.Fatal("no AppPeople")
	}
	if !m.Private || m.Member || m.Change {
		t.Fatalf("AppPeople: the owner's phones, over https, to look: %+v", m)
	}
	args := func(id string) []json.RawMessage { b, _ := json.Marshal(id); return []json.RawMessage{b} }
	ctx := companion.WithCaller(context.Background(), companion.Device{ID: "p1", Name: "iPhone"})

	v, _, err := m.Call(ctx, args("immich"))
	if err != nil {
		t.Fatal(err)
	}
	got := v.(phoneAppPeople)
	var names []string
	for _, p := range got.People {
		names = append(names, p.Name)
	}
	slices.Sort(names)
	if !got.Household || strings.Join(names, ", ") != "Alex Doe, Sam Doe, Someone in the household" {
		t.Errorf("who uses Immich: %+v", got)
	}
	b, _ := json.Marshal(v)
	for _, never := range []string{"@example.com", "pid-1", `"alex"`, "noname", "username", "Gone"} {
		if strings.Contains(string(b), never) {
			t.Errorf("%q sent to the phone: %s", never, b)
		}
	}

	// An app people don't sign in to: no card.
	v, _, err = m.Call(ctx, args("homepage"))
	if err != nil || v.(phoneAppPeople).Household || len(v.(phoneAppPeople).People) != 0 {
		t.Errorf("Homepage: %+v, %v", v, err)
	}
	for _, bad := range [][]json.RawMessage{nil, args(""), args("nothing-like-it"), {json.RawMessage(`1`)}} {
		if _, _, err := m.Call(ctx, bad); err == nil {
			t.Errorf("%s: no error", bad)
		}
	}
}
