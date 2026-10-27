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
	a, c := SetHeld(env, "sonarr", "homelab_media-automation-sonarr-1", true)
	env[HeldKey], env[HeldContainersKey] = a, c
	a, c = SetHeld(env, "radarr", "homelab_media-automation-radarr-1", true)
	if a != "sonarr,radarr" || c != "homelab_media-automation-sonarr-1,homelab_media-automation-radarr-1" {
		t.Fatalf("%q %q", a, c)
	}
	env[HeldKey], env[HeldContainersKey] = a, c
	if got := Held(env); len(got) != 2 {
		t.Fatalf("Held = %v", got)
	}
	a, c = SetHeld(env, "sonarr", "homelab_media-automation-sonarr-1", false)
	if a != "radarr" || c != "homelab_media-automation-radarr-1" {
		t.Fatalf("release: %q %q", a, c)
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
