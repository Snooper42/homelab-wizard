package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// The crash note on a phone's Status (the owner's pick, Nov 16, on the
// mocks canvas): a paired phone hears which part of Homelab Wizard stopped
// and when, nothing from the crash's log; a wall screen hears nothing; a
// household member's phone isn't offered it; none when there's no crash.
func TestPhoneLastCrashSaysWhoAndWhenOnly(t *testing.T) {
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	m, ok := h.phoneMethods()["LastCrash"]
	if !ok {
		t.Fatal("no LastCrash")
	}
	if m.Member {
		t.Error("LastCrash answers a member's phone")
	}
	phone := companion.WithCaller(context.Background(), companion.Device{ID: "p1", Name: "iPhone"})
	if v, _, err := m.Call(phone, nil); err != nil || v != nil {
		t.Fatalf("no crash: %v %v", v, err)
	}

	logs := filepath.Join(root, "scripts", "logs")
	if err := os.MkdirAll(logs, 0o755); err != nil {
		t.Fatal(err)
	}
	when := time.Now().Add(-time.Hour).UTC().Truncate(time.Second)
	log := "== the app 0.9.7-beta, started " + when.Add(-time.Minute).Format(time.RFC3339) + ", process 1\nstopped unexpectedly " + when.Format(time.RFC3339) + "\n\npanic: a secret token here\n"
	if err := os.WriteFile(filepath.Join(logs, "crash-"+when.Format("2006-01-02")+".log"), []byte(log), 0o644); err != nil {
		t.Fatal(err)
	}
	v, _, err := m.Call(phone, nil)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(v)
	var got map[string]any
	_ = json.Unmarshal(b, &got)
	if got["who"] != "the app" || got["when"] != when.Format(time.RFC3339) || len(got) != 2 {
		t.Fatalf("who and when only: %s", b)
	}
	if strings.Contains(string(b), "token") || strings.Contains(string(b), "crash-") {
		t.Fatalf("something from the log: %s", b)
	}

	wall := companion.WithCaller(context.Background(), companion.Device{ID: "w1", Name: "Hall screen", Kiosk: true})
	if v, _, err := m.Call(wall, nil); err != nil || v != nil {
		t.Fatalf("a wall screen: %v %v", v, err)
	}
}
