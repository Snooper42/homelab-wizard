package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/history"
	"github.com/Snooper42/homelab-wizard/internal/kept"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Sign-in details on the phone (arr-loop.md 1c): the list carries labels and
// whether each is saved, never a value; one value is copied only by a phone
// allowed to change things, over https, and only a row the ⚙ sheet shows
// (never a database password); every copy is kept in the app's history with
// the phone's name; the Saved tick is set the same way.
func TestSignInDetailsOnThePhone(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_system-duplicati-1", Image: "lscr.io/linuxserver/duplicati:latest", Running: true, Project: "homelab_system", Service: "duplicati"},
	})
	t.Setenv(asCLI, "1")
	const pass, phrase, internal = "s3cret-sign-in", "s3cret-recovery", "s3cret-internal"
	root, _ := repoCopy(t, "DUPLICATI_PASSWORD="+pass, "DUPLICATI_PASSPHRASE="+phrase, "IMMICH_DB_PASSWORD="+internal, "DUPLICATI_SECRETS_PASSPHRASE=")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	methods := h.phoneMethods()
	list, copyOne, mark := methods["SignInDetails"], methods["CopySignIn"], methods["MarkSignInSaved"]
	if list.Call == nil || list.Change || !list.Private || list.Member {
		t.Fatalf("SignInDetails: the owner's phones, over https: %+v", list)
	}
	for name, m := range map[string]companion.Method{"CopySignIn": copyOne, "MarkSignInSaved": mark} {
		if m.Call == nil || !m.Change || !m.Private || m.Member {
			t.Fatalf("%s: a change, the owner's phones', over https: %+v", name, m)
		}
	}
	args := func(raw ...string) []json.RawMessage {
		out := []json.RawMessage{}
		for _, r := range raw {
			out = append(out, json.RawMessage(r))
		}
		return out
	}
	ctx := companion.WithCaller(context.Background(), companion.Device{ID: "a1", Name: "Alex's iPhone", CanChange: true})

	v, _, err := list.Call(ctx, args(`"duplicati"`))
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(v)
	for _, secret := range []string{pass, phrase, internal} {
		if strings.Contains(string(b), secret) {
			t.Fatalf("a value in the list: %s", b)
		}
	}
	rows := map[string]phoneSignIn{}
	for _, r := range v.([]phoneSignIn) {
		rows[r.Key] = r
	}
	if r := rows["DUPLICATI_PASSWORD"]; r.Section != "sign-in" || r.App != "duplicati" || r.Label == "" {
		t.Errorf("the password, under Sign in: %+v", rows)
	}
	if r := rows["DUPLICATI_PASSPHRASE"]; r.Section != "keep-safe" {
		t.Errorf("the passphrase, under Keep safe: %+v", rows)
	}
	if _, ok := rows["DUPLICATI_SECRETS_PASSPHRASE"]; ok {
		t.Errorf("one not set is listed: %+v", rows)
	}

	got, _, err := copyOne.Call(ctx, args(`"duplicati"`, `"DUPLICATI_PASSWORD"`))
	if err != nil || got != pass {
		t.Fatalf("copied %v, %v", got, err)
	}
	for _, bad := range [][]string{
		{`"duplicati"`, `"IMMICH_DB_PASSWORD"`}, // an internal secret
		{`"immich"`, `"IMMICH_DB_PASSWORD"`},
		{`""`, `"DUPLICATI_PASSWORD"`},
		{`"duplicati"`, `"DUPLICATI_SECRETS_PASSPHRASE"`}, // not set
		{`"duplicati"`},
		{`"duplicati"`, `1`},
	} {
		if v, _, err := copyOne.Call(ctx, args(bad...)); err == nil || v != nil {
			t.Errorf("copied %v: %v", bad, v)
		}
	}
	entries, _ := history.List(root, history.Filter{App: "duplicati"})
	if len(entries) != 1 || entries[0].Kind != "copy" || entries[0].Who != "Alex's iPhone" ||
		!strings.Contains(entries[0].Text, "copied on Alex's iPhone") || strings.Contains(entries[0].Text, pass) {
		t.Fatalf("one copy in Duplicati's history, by the phone, without the value: %+v", entries)
	}

	if _, _, err := mark.Call(ctx, args(`"duplicati"`, `"DUPLICATI_PASSPHRASE"`, `true`)); err != nil {
		t.Fatal(err)
	}
	if !kept.Load(root)["DUPLICATI_PASSPHRASE"] {
		t.Error("not ticked Saved")
	}
	if _, _, err := mark.Call(ctx, args(`"duplicati"`, `"IMMICH_DB_PASSWORD"`, `true`)); err == nil {
		t.Error("ticked a row the sheet doesn't show")
	}
	v, _, _ = list.Call(ctx, nil)
	for _, r := range v.([]phoneSignIn) {
		if r.Key == "DUPLICATI_PASSPHRASE" && !r.Saved {
			t.Error("the list doesn't show the tick")
		}
	}
}
