package upgrade

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// run runs git in dir with a fixed identity, failing the test on error.
func run(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false"}, args...)...)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

func write(t *testing.T, path, data string) {
	t.Helper()
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	if err := os.WriteFile(path, []byte(data), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestInspectAndPull(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	base := t.TempDir()
	origin, home, dev := filepath.Join(base, "origin.git"), filepath.Join(base, "home"), filepath.Join(base, "dev")
	run(t, base, "init", "--bare", "-b", "main", origin)
	run(t, base, "clone", origin, dev)
	write(t, filepath.Join(dev, "VERSION"), "0.1.0-alpha\n")
	write(t, filepath.Join(dev, "compose.yaml"), "services: {}\n")
	run(t, dev, "add", ".")
	run(t, dev, "commit", "-m", "First")
	run(t, dev, "push", "origin", "main")
	run(t, base, "clone", origin, home)
	ctx := context.Background()

	c, err := Inspect(ctx, home, true)
	if err != nil {
		t.Fatal(err)
	}
	if c.Branch != "main" || c.Upstream != "origin/main" || c.Behind != 0 || c.FetchError != "" || c.Version != "0.1.0-alpha" {
		t.Fatalf("fresh clone: %+v", c)
	}

	write(t, filepath.Join(dev, "web", "dist", "app.js"), "// new\n")
	run(t, dev, "add", ".")
	run(t, dev, "commit", "-m", "App: a new screen")
	write(t, filepath.Join(dev, ".env.example"), "NEW_KEY=\n")
	write(t, filepath.Join(dev, "VERSION"), "0.2.0-alpha\n")
	run(t, dev, "add", ".")
	run(t, dev, "commit", "-m", "A new setting")
	run(t, dev, "push", "origin", "main")

	write(t, filepath.Join(home, "compose.yaml"), "services: {} # edited here\n")
	c, err = Inspect(ctx, home, true)
	if err != nil {
		t.Fatal(err)
	}
	if c.Behind != 2 || len(c.Changes) != 2 || c.Changes[0].Subject != "A new setting" || !c.AppChanged || !c.SettingsChanged || c.NewVersion != "0.2.0-alpha" {
		t.Fatalf("behind: %+v", c)
	}
	if len(c.Dirty) != 1 || c.Dirty[0] != "compose.yaml" {
		t.Errorf("dirty: %v", c.Dirty)
	}
	if c.Changes[1].When.IsZero() || c.Changes[0].Hash == "" {
		t.Errorf("changes: %+v", c.Changes)
	}

	// An edit to a file the update does not touch is kept.
	if _, err := Pull(ctx, home); err != nil {
		t.Fatal(err)
	}
	if c, _ = Inspect(ctx, home, false); c.Behind != 0 || c.Version != "0.2.0-alpha" || len(c.Dirty) != 1 {
		t.Fatalf("after pull: %+v", c)
	}

	// An edit to a file the update changes makes git refuse; nothing is lost.
	write(t, filepath.Join(dev, "compose.yaml"), "services: {a: {}}\n")
	run(t, dev, "commit", "-am", "Compose change")
	run(t, dev, "push", "origin", "main")
	if _, err := Inspect(ctx, home, true); err != nil {
		t.Fatal(err)
	}
	if _, err := Pull(ctx, home); err == nil || !strings.Contains(err.Error(), "git pull") {
		t.Fatalf("pull over a local edit: %v", err)
	}
	if data, _ := os.ReadFile(filepath.Join(home, "compose.yaml")); !strings.Contains(string(data), "edited here") {
		t.Error("the local edit was lost")
	}

	// A branch that follows nothing, and a folder that is not a checkout.
	run(t, home, "checkout", "-q", "-b", "local-only")
	if _, err := Inspect(ctx, home, false); err == nil || !strings.Contains(err.Error(), "git checkout main") {
		t.Errorf("no upstream: %v", err)
	}
	if _, err := Inspect(ctx, t.TempDir(), false); err == nil || !strings.Contains(err.Error(), "not a git checkout") {
		t.Errorf("not a checkout: %v", err)
	}
}

func TestWebURL(t *testing.T) {
	for in, want := range map[string]string{
		"git@github.com:Snooper42/homelab-wizard.git":       "https://github.com/Snooper42/homelab-wizard",
		"https://github.com/Snooper42/homelab-wizard.git":   "https://github.com/Snooper42/homelab-wizard",
		"ssh://git@github.com/Snooper42/homelab-wizard.git": "https://github.com/Snooper42/homelab-wizard",
		"/tmp/origin.git": "",
	} {
		if got := WebURL(in); got != want {
			t.Errorf("%s: %q, want %q", in, got, want)
		}
	}
}

func TestAppBehind(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	dir := t.TempDir()
	run(t, dir, "init", "-q")
	write(t, filepath.Join(dir, "VERSION"), "1\n")
	run(t, dir, "add", ".")
	run(t, dir, "commit", "-q", "-m", "First")
	built, _ := git(context.Background(), dir, "rev-parse", "HEAD")
	write(t, filepath.Join(dir, "docs", "a.md"), "a\n")
	run(t, dir, "add", ".")
	run(t, dir, "commit", "-q", "-m", "Docs")
	if n, ok := AppBehind(context.Background(), dir, built); !ok || n != 0 {
		t.Errorf("docs only: %d %v", n, ok)
	}
	write(t, filepath.Join(dir, "app", "app.go"), "package main\n")
	run(t, dir, "add", ".")
	run(t, dir, "commit", "-q", "-m", "App")
	if n, ok := AppBehind(context.Background(), dir, built); !ok || n != 1 {
		t.Errorf("one app change: %d %v", n, ok)
	}
	if _, ok := AppBehind(context.Background(), dir, "0123456789abcdef0123456789abcdef01234567"); ok {
		t.Error("an unknown commit should not count")
	}
	if _, ok := AppBehind(context.Background(), dir, ""); ok {
		t.Error("a dev build has no commit")
	}
}
