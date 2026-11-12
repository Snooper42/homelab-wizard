package upgrade

import (
	"context"
	"errors"
	"fmt"
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

// testWeb is the GitHub page the tests' checkouts say they come from.
const testWeb = "https://github.com/owner/homelab"

// releasedFrom makes ReleaseCommit answer as GitHub would for releases
// whose build provenance names the commits their tags point at in origin.
func releasedFrom(t *testing.T, origin string) {
	t.Helper()
	saved := ReleaseCommit
	ReleaseCommit = func(_ context.Context, repo, tag string) (string, error) {
		if repo != "owner/homelab" {
			return "", errors.New("another repository")
		}
		out, err := exec.Command("git", "-C", origin, "rev-parse", "--verify", "-q", tag+"^{commit}").Output()
		if err != nil {
			return "", fmt.Errorf("GitHub has no release %s", tag)
		}
		return strings.TrimSpace(string(out)), nil
	}
	t.Cleanup(func() { ReleaseCommit = saved })
}

// onGitHub points the checkout's origin at testWeb, which git fetches from
// the local origin instead.
func onGitHub(t *testing.T, home, origin string) {
	t.Helper()
	run(t, home, "remote", "set-url", "origin", testWeb)
	run(t, home, "config", "url."+origin+".insteadOf", testWeb)
}

func head(t *testing.T, dir string) string {
	t.Helper()
	out, err := exec.Command("git", "-C", dir, "rev-parse", "HEAD").Output()
	if err != nil {
		t.Fatal(err)
	}
	return strings.TrimSpace(string(out))
}

// Item 79: a checkout moves only to a release tag on its upstream branch,
// and only once the tag's build provenance names the very commit the tag
// points at; commits past the newest release wait for the next one.
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
	releasedFrom(t, origin)
	onGitHub(t, home, origin)

	// Before the first release there is nothing to move to.
	c, err := Inspect(ctx, home, true)
	if err != nil {
		t.Fatal(err)
	}
	if c.Branch != "main" || c.Upstream != "origin/main" || c.Web != testWeb || c.Target != "" || c.Behind != 0 || c.FetchError != "" || c.Version != "0.1.0-alpha" {
		t.Fatalf("fresh clone: %+v", c)
	}
	if _, err := PullTo(ctx, home, c); err == nil || !strings.Contains(err.Error(), "no release") {
		t.Errorf("no release: %v", err)
	}
	run(t, dev, "tag", "v0.1.0")
	run(t, dev, "push", "origin", "--tags")

	// New commits on main wait for their release.
	write(t, filepath.Join(dev, "web", "dist", "app.js"), "// new\n")
	run(t, dev, "add", ".")
	run(t, dev, "commit", "-m", "App: a new screen")
	write(t, filepath.Join(dev, ".env.example"), "NEW_KEY=\n")
	write(t, filepath.Join(dev, "VERSION"), "0.2.0-alpha\n")
	run(t, dev, "add", ".")
	run(t, dev, "commit", "-m", "A new setting")
	run(t, dev, "push", "origin", "main")
	// A tag on another branch is never a release to move to.
	run(t, dev, "checkout", "-q", "-b", "side")
	run(t, dev, "commit", "-q", "--allow-empty", "-m", "Elsewhere")
	run(t, dev, "tag", "v9.0.0")
	run(t, dev, "push", "origin", "side", "--tags")
	run(t, dev, "checkout", "-q", "main")
	if c, err = Inspect(ctx, home, true); err != nil {
		t.Fatal(err)
	}
	if c.Target != "v0.1.0" || c.Behind != 0 || c.Unreleased != 2 {
		t.Fatalf("unreleased commits: %+v", c)
	}

	run(t, dev, "tag", "v0.2.0")
	run(t, dev, "push", "origin", "--tags")
	write(t, filepath.Join(home, "compose.yaml"), "services: {} # edited here\n")
	if c, err = Inspect(ctx, home, true); err != nil {
		t.Fatal(err)
	}
	if c.Target != "v0.2.0" || c.Behind != 2 || c.Unreleased != 0 || len(c.Changes) != 2 || c.Changes[0].Subject != "A new setting" || !c.AppChanged || !c.SettingsChanged || c.NewVersion != "0.2.0-alpha" {
		t.Fatalf("behind: %+v", c)
	}
	if len(c.Dirty) != 1 || c.Dirty[0] != "compose.yaml" {
		t.Errorf("dirty: %v", c.Dirty)
	}
	if c.Changes[1].When.IsZero() || c.Changes[0].Hash == "" {
		t.Errorf("changes: %+v", c.Changes)
	}

	// A checkout from somewhere other than GitHub has no releases to check.
	before := head(t, home)
	elsewhere := c
	elsewhere.Web = ""
	if _, err := PullTo(ctx, home, elsewhere); err == nil || !strings.Contains(err.Error(), "not a GitHub repository") {
		t.Errorf("not GitHub: %v", err)
	}

	// An edit to a file the update does not touch is kept.
	if _, err := PullTo(ctx, home, c); err != nil {
		t.Fatal(err)
	}
	if c, _ = Inspect(ctx, home, false); c.Behind != 0 || c.Version != "0.2.0-alpha" || len(c.Dirty) != 1 || head(t, home) == before {
		t.Fatalf("after pull: %+v", c)
	}

	// A release whose provenance names another commit, or none, is not
	// taken: the tag moved after the build, or the build never ran.
	write(t, filepath.Join(dev, "compose.yaml"), "services: {a: {}}\n")
	run(t, dev, "commit", "-am", "Compose change")
	run(t, dev, "tag", "v0.2.1")
	run(t, dev, "push", "origin", "main", "--tags")
	if c, err = Inspect(ctx, home, true); err != nil || c.Target != "v0.2.1" || c.Behind != 1 {
		t.Fatalf("v0.2.1: %+v %v", c, err)
	}
	before = head(t, home)
	built := ReleaseCommit
	ReleaseCommit = func(context.Context, string, string) (string, error) { return before, nil }
	if _, err := PullTo(ctx, home, c); err == nil || !strings.Contains(err.Error(), "points at") {
		t.Errorf("another commit's provenance: %v", err)
	}
	ReleaseCommit = func(context.Context, string, string) (string, error) {
		return "", errors.New("GitHub has no build provenance for its files")
	}
	if _, err := PullTo(ctx, home, c); err == nil || !strings.Contains(err.Error(), "no build provenance") {
		t.Errorf("no provenance: %v", err)
	}
	if head(t, home) != before {
		t.Fatal("a refused release moved the checkout")
	}
	ReleaseCommit = built

	// An edit to a file the update changes makes git refuse; nothing is lost.
	if _, err := PullTo(ctx, home, c); err == nil || !strings.Contains(err.Error(), "git merge") {
		t.Fatalf("pull over a local edit: %v", err)
	}
	if data, _ := os.ReadFile(filepath.Join(home, "compose.yaml")); !strings.Contains(string(data), "edited here") {
		t.Error("the local edit was lost")
	}

	// The stable channel takes only a new minor or major version.
	write(t, filepath.Join(home, ".env"), "UPDATE_CHANNEL=stable\n")
	if c, err = Inspect(ctx, home, false); err != nil || c.Channel != Stable || c.Target != "v0.2.0" || c.Behind != 0 || c.Unreleased != 1 {
		t.Fatalf("stable: %+v %v", c, err)
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
	// A build from another line of history (the folder follows another
	// repository) is not behind by every app change on this one.
	main, _ := git(context.Background(), dir, "rev-parse", "--abbrev-ref", "HEAD")
	run(t, dir, "checkout", "-q", "--orphan", "other")
	write(t, filepath.Join(dir, "app", "app.go"), "package other\n")
	run(t, dir, "add", ".")
	run(t, dir, "commit", "-q", "-m", "Other")
	other, _ := git(context.Background(), dir, "rev-parse", "HEAD")
	run(t, dir, "checkout", "-q", main)
	if n, ok := AppBehind(context.Background(), dir, other); ok {
		t.Errorf("unrelated build: %d", n)
	}
}
