//go:build forreal

package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// A native app started from Status, for real: Jellyfin, installed as its
// note says (brew install --cask jellyfin, CI's step before this), quit,
// then opened by Status's Open button (OpenNativeApp), and its server
// answering on 8096.
func TestNativeAppOpensForReal(t *testing.T) {
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	quitJellyfin(t)
	t.Cleanup(func() { quitJellyfin(t) })
	a := &App{root: root}
	if err := a.OpenNativeApp("jellyfin"); err != nil {
		t.Fatalf("OpenNativeApp(jellyfin): %v", err)
	}
	var last string
	for end := time.Now().Add(3 * time.Minute); ; time.Sleep(2 * time.Second) {
		if time.Now().After(end) {
			t.Fatalf("Jellyfin did not answer healthy on 8096 within 3 minutes: %s", last)
		}
		resp, err := http.Get("http://127.0.0.1:8096/health")
		if err != nil {
			last = err.Error()
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK && string(body) == "Healthy" {
			break
		}
		last = fmt.Sprintf("%s %q", resp.Status, body)
	}
	if err := a.OpenNativeApp("vaultwarden"); err == nil {
		t.Error("OpenNativeApp(vaultwarden) opened a container app")
	}
}

// quitJellyfin quits the Jellyfin app (by either of its names) and waits
// until nothing listens on its port.
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
	for end := time.Now().Add(time.Minute); ; time.Sleep(time.Second) {
		c, err := net.DialTimeout("tcp", "127.0.0.1:8096", time.Second)
		if err != nil {
			return
		}
		c.Close()
		if time.Now().After(end) {
			t.Fatal("Jellyfin still listens on 8096 a minute after it was quit")
		}
	}
}
