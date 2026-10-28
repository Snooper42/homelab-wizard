package updates

import (
	"path/filepath"
	"testing"
	"time"
)

func TestHistory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "updates.json")
	h := LoadHistory(path)
	ref := "lscr.io/linuxserver/sonarr:latest"
	if got := h.Observe(map[string]Seen{"sonarr": {ref, "sha256:a"}}); len(got) != 0 {
		t.Fatalf("first look is no update: %v", got)
	}
	got := h.Observe(map[string]Seen{"sonarr": {ref, "sha256:b"}, "radarr": {"r", ""}})
	if len(got) != 1 || got[0] != (Change{App: "sonarr", From: "sha256:a", To: "sha256:b"}) {
		t.Fatalf("update: %v", got)
	}
	now := time.Date(2026, 10, 15, 4, 0, 0, 0, time.UTC)
	r := h.Apps["sonarr"]
	r.Previous, r.Updated = "sha256:a", now
	if err := h.Save(path); err != nil {
		t.Fatal(err)
	}
	h = LoadHistory(path)
	if !h.CanRollBack("sonarr") || h.CanRollBack("radarr") {
		t.Fatal("CanRollBack")
	}
	if h.Recent("sonarr", now.Add(10*time.Minute)) || !h.Recent("sonarr", now.Add(time.Hour)) || h.Recent("sonarr", now.Add(7*time.Hour)) {
		t.Fatal("Recent: only between Settle and Watch after the update")
	}
	if len(h.Expired(now.Add(6*24*time.Hour))) != 0 || len(h.Expired(now.Add(8*24*time.Hour))) != 1 {
		t.Fatal("Expired: after a week")
	}
}

func TestSetHeld(t *testing.T) {
	env := map[string]string{}
	env[HeldKey] = SetHeld(env, "sonarr", true)
	a := SetHeld(env, "radarr", true)
	if a != "sonarr,radarr" {
		t.Fatalf("%q", a)
	}
	env[HeldKey] = a
	if got := Held(env); len(got) != 2 {
		t.Fatalf("Held = %v", got)
	}
	if a = SetHeld(env, "sonarr", true); a != "radarr,sonarr" {
		t.Fatalf("held twice: %q", a)
	}
	if a = SetHeld(env, "sonarr", false); a != "radarr" {
		t.Fatalf("release: %q", a)
	}
}

func TestHealthyAfterStartsAgainWithEachUpdate(t *testing.T) {
	h := LoadHistory(filepath.Join(t.TempDir(), "updates.json"))
	h.Observe(map[string]Seen{"ntfy": {"binwiederhier/ntfy:latest", "sha256:a"}})
	h.Apps["ntfy"].HealthyAfter = time.Now()
	h.Observe(map[string]Seen{"ntfy": {"binwiederhier/ntfy:latest", "sha256:a"}})
	if h.Apps["ntfy"].HealthyAfter.IsZero() {
		t.Error("no update, yet the mark went")
	}
	h.Observe(map[string]Seen{"ntfy": {"binwiederhier/ntfy:latest", "sha256:b"}})
	if !h.Apps["ntfy"].HealthyAfter.IsZero() {
		t.Error("a new image: it has not been seen well on it yet")
	}
}
