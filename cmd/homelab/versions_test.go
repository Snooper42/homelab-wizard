package main

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// .env keeps the version each app the nightly update moves forward runs,
// and a start puts that version back under the compose file's name.
func TestEnvKeepsEachAppsVersion(t *testing.T) {
	root, _ := repoCopy(t)
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("TZ=UTC\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: c}
	ctx := context.Background()
	sum := "sha256:" + strings.Repeat("a", 64)
	fake := &docker.FakeRunner{
		Containers: []docker.FakeContainer{
			sonarr("sha256:old", "healthy"),
			// No digest here (built or loaded locally): nothing to keep.
			{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:latest", ImageID: "sha256:ntfy", Running: true, Project: "homelab_security", Service: "ntfy"},
		},
		RepoDigests: map[string][]string{"sha256:old": {"lscr.io/linuxserver/sonarr@" + sum}},
	}
	client := &docker.Client{Runner: fake, Bin: "docker"}
	if got := h.keepVersions(ctx, client); strings.Join(got, ",") != "sonarr" {
		t.Fatalf("kept %v", got)
	}
	env, _ := os.ReadFile(h.envFile)
	if !strings.Contains(string(env), "SONARR_DIGEST="+sum) || strings.Contains(string(env), "NTFY_DIGEST") || !strings.Contains(string(env), "# The version each app runs") {
		t.Errorf(".env:\n%s", env)
	}
	if got := h.keepVersions(ctx, client); len(got) != 0 {
		t.Errorf("kept again with nothing changed: %v", got)
	}
	env, _ = os.ReadFile(h.envFile)
	if n := strings.Count(string(env), "# The version each app runs"); n != 1 {
		t.Errorf("the heading is there %d times", n)
	}

	sonarrApp, _ := c.Get("sonarr")
	apps := []*catalog.App{sonarrApp}
	pin := "lscr.io/linuxserver/sonarr@" + sum
	// A newer Sonarr has the name here: the kept one comes back under it.
	fresh := &docker.FakeRunner{Images: map[string]string{"lscr.io/linuxserver/sonarr:latest": "sha256:new"}}
	if put := h.useKeptVersions(ctx, &docker.Client{Runner: fresh, Bin: "docker"}, apps); strings.Join(put, ",") != "sonarr" {
		t.Fatalf("put back %v", put)
	}
	calls := strings.Join(fresh.Calls, "\n")
	if !strings.Contains(calls, "pull --quiet "+pin) || !strings.Contains(calls, "image tag "+pin+" lscr.io/linuxserver/sonarr:latest") {
		t.Errorf("calls:\n%s", calls)
	}
	// Already on it: nothing pulled or named.
	fresh = &docker.FakeRunner{
		Images:      map[string]string{"lscr.io/linuxserver/sonarr:latest": "sha256:old"},
		RepoDigests: map[string][]string{"lscr.io/linuxserver/sonarr:latest": {pin}},
	}
	if put := h.useKeptVersions(ctx, &docker.Client{Runner: fresh, Bin: "docker"}, apps); len(put) != 0 || strings.Contains(strings.Join(fresh.Calls, "\n"), "pull") {
		t.Errorf("put back %v with %v", put, fresh.Calls)
	}
	// Its registry cannot be reached: it starts on what is here.
	fresh = &docker.FakeRunner{PullErr: map[string]error{pin: errors.New("manifest unknown")}}
	if put := h.useKeptVersions(ctx, &docker.Client{Runner: fresh, Bin: "docker"}, apps); len(put) != 0 || strings.Contains(strings.Join(fresh.Calls, "\n"), "image tag") {
		t.Errorf("put back %v with %v", put, fresh.Calls)
	}
	// Its line taken out: the newest starts.
	if err := h.setEnv(versionKey("sonarr"), ""); err != nil {
		t.Fatal(err)
	}
	fresh = &docker.FakeRunner{}
	if put := h.useKeptVersions(ctx, &docker.Client{Runner: fresh, Bin: "docker"}, apps); len(put) != 0 || len(fresh.Calls) != 0 {
		t.Errorf("put back %v with %v", put, fresh.Calls)
	}
}

func TestVersionKey(t *testing.T) {
	for app, want := range map[string]string{"paperless": "PAPERLESS_DIGEST", "actual-budget": "ACTUAL_BUDGET_DIGEST"} {
		if got := versionKey(app); got != want {
			t.Errorf("%s: %s", app, got)
		}
	}
	if got := repositoryOf("ghcr.io/paperless-ngx/paperless-ngx:latest"); got != "ghcr.io/paperless-ngx/paperless-ngx" {
		t.Error(got)
	}
	if got := repositoryOf("localhost:5000/app"); got != "localhost:5000/app" {
		t.Error(got)
	}
}
