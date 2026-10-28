//go:build forreal

package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"slices"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Native Mac apps opened after a restart, for real: Jellyfin, installed as
// its note says (brew install --cask jellyfin, CI's step before this),
// quit, then opened by what the startup runs once the media drive is there
// (openMacApps, from up --wait-media), and its server answering on 8096.
// One already running is left alone.
func TestNativeAppsOpenAfterARestartForReal(t *testing.T) {
	root, _ := repoCopy(t)
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	h := &homelab{root: root, catalog: c, ui: &ui.UI{Out: io.Discard}}
	quitJellyfin(t)
	t.Cleanup(func() { quitJellyfin(t) })

	ctx := context.Background()
	if opened := h.openMacApps(ctx); !slices.Contains(opened, "Jellyfin") {
		out, err := exec.Command("open", "-g", "-a", "Jellyfin").CombinedOutput()
		t.Fatalf("opened %q, want Jellyfin (open -a Jellyfin: %v %s)", opened, err, out)
	}
	jellyfinAnswers(t)
	if again := h.openMacApps(ctx); len(again) > 0 {
		t.Errorf("opened %q again while it runs", again)
	}
}

// quitJellyfin quits the Jellyfin app (by either of its names) and waits
// until nothing answers on its port.
func quitJellyfin(t *testing.T) {
	t.Helper()
	for _, name := range []string{"Jellyfin", "Jellyfin Server"} {
		// With a time limit: AppleScript can wait on a dialog (where an app
		// is, or the app's own) that no one answers on a runner.
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		_ = exec.CommandContext(ctx, "osascript", "-e", fmt.Sprintf("quit app %q", name)).Run()
		cancel()
	}
	for _, name := range []string{"jellyfin", "Jellyfin"} {
		_ = exec.Command("pkill", "-x", name).Run()
	}
	for end := time.Now().Add(time.Minute); api.NativeUp(context.Background(), 8096); time.Sleep(time.Second) {
		if time.Now().After(end) {
			t.Fatal("Jellyfin still answers on 8096 a minute after it was quit")
		}
	}
}

// jellyfinAnswers waits for Jellyfin's server to say it is healthy, as
// Status reads it.
func jellyfinAnswers(t *testing.T) {
	t.Helper()
	var last string
	for end := time.Now().Add(3 * time.Minute); time.Now().Before(end); time.Sleep(2 * time.Second) {
		resp, err := http.Get("http://127.0.0.1:8096/health")
		if err != nil {
			last = err.Error()
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK && string(body) == "Healthy" {
			return
		}
		last = fmt.Sprintf("%s %q", resp.Status, body)
	}
	t.Fatalf("Jellyfin did not answer healthy on 8096 within 3 minutes: %s", last)
}
