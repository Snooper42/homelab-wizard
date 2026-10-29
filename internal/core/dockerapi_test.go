package core

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// A read that went back to the CLI is kept for doctor for a week; the
// homelab's .env turns the API off.
func TestAPIFallbackKept(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	if _, ok := APIFallback(root, now); ok {
		t.Fatal("a fallback before any")
	}
	f := docker.Fallback{When: now.Add(-time.Hour), Read: "containers", Err: "engine API 500: something new"}
	if err := SaveAPIFallback(root, f); err != nil {
		t.Fatal(err)
	}
	if got, ok := APIFallback(root, now); !ok || got.Read != "containers" || got.Err != f.Err {
		t.Errorf("%+v %v", got, ok)
	}
	if _, ok := APIFallback(root, now.Add(8*24*time.Hour)); ok {
		t.Error("kept past a week")
	}

	home := t.TempDir()
	for _, k := range []string{"HOME", "XDG_CONFIG_HOME", "AppData"} {
		t.Setenv(k, home)
	}
	t.Setenv("HOMELAB_ROOT", root)
	for name, data := range map[string]string{".env": "DOCKER_API=off\n", ".env.example": "DOCKER_API=auto\n", "compose.yaml": "services: {}\n"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(data), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if Root() != root {
		t.Fatalf("Root %q, want %q", Root(), root)
	}
	if !docker.APIOff(docker.Settings()) {
		t.Error("DOCKER_API=off in .env is not read")
	}
	docker.OnFallback(docker.Fallback{When: now, Read: "info", Err: "x"})
	if got, ok := APIFallback(root, now); !ok || got.Read != "info" {
		t.Errorf("a fallback was not kept: %+v %v", got, ok)
	}
}
