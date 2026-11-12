package upgrade

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/kit"
)

func TestNewNotes(t *testing.T) {
	cur := "# Changelog\n\n## [Unreleased]\n\n- Old thing. With detail.\n"
	next := "# Changelog\n\n## [Unreleased]\n\n- Phone companion: `homelab serve` shows Status. More words.\n- Old thing. With detail.\n- Small fix\n  - a nested line\n"
	got := NewNotes(cur, next)
	if len(got) != 2 || got[0] != "Phone companion: `homelab serve` shows Status." || got[1] != "Small fix" {
		t.Fatalf("%q", got)
	}
	if got := NewNotes(next, next); len(got) != 0 {
		t.Fatalf("nothing new: %q", got)
	}
	// Notes reworded under a version both have are not news; a version
	// only next has is.
	cur = "## [Unreleased]\n\n- Kept.\n\n## [0.2.0] - 2026-10-02\n\n- Old wording.\n"
	next = "## [Unreleased]\n\n- Kept.\n\n## [0.3.0] - 2026-10-03\n\n- Released since.\n\n## [0.2.0] - 2026-10-02\n\n- New wording.\n"
	if got := NewNotes(cur, next); len(got) != 1 || got[0] != "Released since." {
		t.Fatalf("%q", got)
	}
	if got := NewNotes("", "- **SteamOS:** Setup installs Docker. More.\n"); len(got) != 1 || got[0] != "SteamOS: Setup installs Docker." {
		t.Fatalf("bold: %q", got)
	}
}

func TestBackInAGitCheckout(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	base := t.TempDir()
	origin, home, dev := filepath.Join(base, "origin.git"), filepath.Join(base, "home"), filepath.Join(base, "dev")
	run(t, base, "init", "--bare", "-b", "main", origin)
	run(t, base, "clone", origin, dev)
	write(t, filepath.Join(dev, "VERSION"), "0.1.0\n")
	write(t, filepath.Join(dev, "CHANGELOG.md"), "# Changelog\n\n- First. Detail.\n")
	run(t, dev, "add", ".")
	run(t, dev, "commit", "-m", "First")
	run(t, dev, "push", "origin", "main")
	run(t, base, "clone", origin, home)
	write(t, filepath.Join(dev, "VERSION"), "0.2.0\n")
	write(t, filepath.Join(dev, "CHANGELOG.md"), "# Changelog\n\n- Second thing: new. More.\n- First. Detail.\n")
	run(t, dev, "commit", "-am", "Second")
	run(t, dev, "tag", "v0.2.0")
	run(t, dev, "push", "origin", "main", "--tags")
	ctx := context.Background()
	releasedFrom(t, origin)
	onGitHub(t, home, origin)

	c, err := Inspect(ctx, home, true)
	if err != nil || len(c.Notes) != 1 || c.Notes[0] != "Second thing: new." {
		t.Fatalf("notes: %q %v", c.Notes, err)
	}
	if _, ok := LoadPoint(home); ok {
		t.Fatal("no point before an upgrade")
	}
	if _, err := Mark(ctx, home, c); err != nil {
		t.Fatal(err)
	}
	if _, err := PullTo(ctx, home, c); err != nil {
		t.Fatal(err)
	}
	p, ok := LoadPoint(home)
	if !ok || p.Version != "0.1.0" {
		t.Fatalf("point: %+v %v", p, ok)
	}
	if err := Back(ctx, home, p); err != nil {
		t.Fatal(err)
	}
	if v, _ := os.ReadFile(filepath.Join(home, "VERSION")); strings.TrimSpace(string(v)) != "0.1.0" {
		t.Fatalf("VERSION after going back: %q", v)
	}
	if _, ok := LoadPoint(home); ok {
		t.Error("the point is used up")
	}
	if c, _ := Inspect(ctx, home, false); c.Behind != 1 {
		t.Errorf("after going back the update waits again: behind %d", c.Behind)
	}
}

func TestBackInAKitFolder(t *testing.T) {
	src, home := t.TempDir(), t.TempDir()
	write(t, filepath.Join(src, "VERSION"), "0.1.0\n")
	write(t, filepath.Join(src, "compose.yaml"), "services: {}\n")
	pack := func(version, commit string) string {
		t.Helper()
		path := filepath.Join(t.TempDir(), kit.FileName)
		f, err := os.Create(path)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := kit.Pack(f, src, []string{"VERSION", "compose.yaml"}, version, commit); err != nil {
			t.Fatal(err)
		}
		f.Close()
		return path
	}
	if _, err := kit.Extract(pack("0.1.0", "aaaaaaaaaa"), home+"/h"); err != nil {
		t.Fatal(err)
	}
	home += "/h"
	ctx := context.Background()
	if _, err := Mark(ctx, home, Check{Version: "0.1.0"}); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(src, "VERSION"), "0.2.0\n")
	if _, _, err := kit.Update(pack("0.2.0", "bbbbbbbbbb"), home); err != nil {
		t.Fatal(err)
	}
	p, ok := LoadPoint(home)
	if !ok || p.Kit == "" {
		t.Fatalf("point: %+v", p)
	}
	if err := Back(ctx, home, p); err != nil {
		t.Fatal(err)
	}
	if v, _ := os.ReadFile(filepath.Join(home, "VERSION")); strings.TrimSpace(string(v)) != "0.1.0" {
		t.Fatalf("VERSION after going back: %q", v)
	}
	if m, _ := kit.Installed(home); m.Commit != "aaaaaaaaaa" {
		t.Errorf("manifest after going back: %s", m.Commit)
	}
}

func TestStableChannel(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	base := t.TempDir()
	origin, home, dev := filepath.Join(base, "origin.git"), filepath.Join(base, "home"), filepath.Join(base, "dev")
	run(t, base, "init", "--bare", "-b", "main", origin)
	run(t, base, "clone", origin, dev)
	commit := func(version string) {
		write(t, filepath.Join(dev, "VERSION"), version+"\n")
		run(t, dev, "add", ".")
		run(t, dev, "commit", "-qm", version)
	}
	commit("0.1.0")
	run(t, dev, "push", "-q", "origin", "main")
	run(t, base, "clone", "-q", origin, home)
	write(t, filepath.Join(home, ".env"), "UPDATE_CHANNEL=stable\n")
	ctx := context.Background()
	releasedFrom(t, origin)
	onGitHub(t, home, origin)

	commit("0.2.0")
	run(t, dev, "push", "-q", "origin", "main")
	c, err := Inspect(ctx, home, true)
	if err != nil || c.Channel != Stable || c.Target != "" || c.Behind != 0 {
		t.Fatalf("no release yet: %+v %v", c, err)
	}

	run(t, dev, "tag", "v0.2.0")
	commit("0.3.0-dev")
	run(t, dev, "tag", "v0.2.1") // a build of main, which stable leaves for the next minor version
	run(t, dev, "push", "-q", "--tags", "origin", "main")
	c, _ = Inspect(ctx, home, true)
	if c.Target != "v0.2.0" || c.Behind != 1 || c.NewVersion != "0.2.0" {
		t.Fatalf("a release: %+v", c)
	}
	if _, err := PullTo(ctx, home, c); err != nil {
		t.Fatal(err)
	}
	if v, _ := os.ReadFile(filepath.Join(home, "VERSION")); strings.TrimSpace(string(v)) != "0.2.0" {
		t.Fatalf("stable moved to %q, not the release", v)
	}
	write(t, filepath.Join(home, ".env"), "UPDATE_CHANNEL=testing\n")
	// Testing takes every release of main, v0.2.1 here.
	if c, _ = Inspect(ctx, home, false); c.Channel != Testing || c.Target != "v0.2.1" || c.Behind != 1 || c.NewVersion != "0.3.0-dev" {
		t.Fatalf("testing: %+v", c)
	}
}

// A Mark replaces the rollback point and its kit whole (each a new file
// renamed in), never rewriting the last ones in place: a Mark cut short (a
// power cut, the app quitting) leaves the last point and its kit as they
// were, and homelab rollback can still use them.
func TestAMarkReplacesThePointWhole(t *testing.T) {
	src, home := t.TempDir(), t.TempDir()
	write(t, filepath.Join(src, "VERSION"), "0.1.0\n")
	write(t, filepath.Join(src, "compose.yaml"), "services: {}\n")
	path := filepath.Join(t.TempDir(), kit.FileName)
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := kit.Pack(f, src, []string{"VERSION", "compose.yaml"}, "0.1.0", "aaaaaaaaaa"); err != nil {
		t.Fatal(err)
	}
	f.Close()
	if _, err := kit.Extract(path, home+"/h"); err != nil {
		t.Fatal(err)
	}
	home += "/h"
	ctx := context.Background()
	first, err := Mark(ctx, home, Check{Version: "0.1.0"})
	if err != nil {
		t.Fatal(err)
	}
	was := map[string]os.FileInfo{}
	for _, p := range []string{PointPath(home), first.Kit} {
		fi, err := statNow(p)
		if err != nil {
			t.Fatal(err)
		}
		was[p] = fi
	}
	again, err := Mark(ctx, home, Check{Version: "0.1.0"})
	if err != nil {
		t.Fatal(err)
	}
	for p, fi := range was {
		now, err := os.Stat(p)
		if err != nil {
			t.Fatal(err)
		}
		if os.SameFile(fi, now) {
			t.Errorf("%s was rewritten in place", filepath.Base(p))
		}
	}
	if p, ok := LoadPoint(home); !ok || p.Kit != again.Kit {
		t.Errorf("point after the second Mark: %+v", p)
	}
	if left, _ := filepath.Glob(filepath.Join(filepath.Dir(PointPath(home)), "*.tmp*")); len(left) != 0 {
		t.Errorf("temporary files left: %v", left)
	}
}

// statNow stats the file at path as it is now. os.Stat on Windows reads
// the file's identity only when SameFile asks, by path, so it would see
// whatever file is there by then; a stat through an open file reads it at
// once.
func statNow(path string) (os.FileInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return f.Stat()
}
