package main

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
)

// newerBuild serves a release of a newer build (the portable Windows one,
// which has a download for both kinds of processor), with what changed,
// and makes this app an installed copy built from an older commit.
func newerBuild(t *testing.T) (helpers *[]*exec.Cmd) {
	t.Helper()
	asset := "Homelab-Wizard-Windows-portable.zip"
	if goruntime.GOARCH == "arm64" {
		asset = "Homelab-Wizard-Windows-ARM64-portable.zip"
	}
	body := []byte("the newer build")
	sum := sha256.Sum256(body)
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/o/r/releases/latest":
			w.Write([]byte(`{"tag_name":"v0.9.9-beta","target_commitish":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","html_url":"https://github.com/o/r/releases/tag/v0.9.9-beta",` +
				`"assets":[{"name":"` + asset + `","browser_download_url":"` + srv.URL + `/dl","digest":"sha256:` + hex.EncodeToString(sum[:]) + `"}]}`))
		case "/repos/o/r/compare/aaaaaaa...bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb":
			w.Write([]byte(`{"commits":[{"commit":{"message":"Status: a faster first look (#200)"}}]}`))
		case "/dl":
			w.Write(body)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	oldAPI, oldCommit, oldRepo, oldCurrent, oldStart := selfupdate.API, commit, repo, selfupdate.Current, selfupdate.StartHelper
	t.Cleanup(func() {
		selfupdate.API, commit, repo, selfupdate.Current, selfupdate.StartHelper = oldAPI, oldCommit, oldRepo, oldCurrent, oldStart
	})
	selfupdate.API, commit, repo = srv.URL, "aaaaaaa", "o/r"
	selfupdate.Current = func() selfupdate.Installed {
		return selfupdate.Installed{Kind: selfupdate.KindWindowsPortable, Path: filepath.Join(t.TempDir(), "Homelab")}
	}
	var got []*exec.Cmd
	selfupdate.StartHelper = func(c *exec.Cmd) error { got = append(got, c); return nil }
	return &got
}

// The background check finds the newer build and what changed; with
// installing on quit turned on, it is downloaded ahead and put in place
// as the app quits.
func TestBackgroundUpdate(t *testing.T) {
	a, w := testApp(t)
	helpers := newerBuild(t)
	if a.PendingAppUpdate() != nil {
		t.Fatal("an update before any check")
	}
	a.checkAppUpdate()
	p := a.PendingAppUpdate()
	if p == nil || p.Version != "v0.9.9-beta" || len(p.Notes) != 1 || p.Notes[0] != "Status: a faster first look" || p.Ready || !p.CanInstallOnQuit {
		t.Fatalf("pending: %+v", p)
	}
	if len(w.sent("app:update")) != 1 {
		t.Fatalf("the window was not told: %v", w.sent("app:update"))
	}

	if err := savePrefs(prefs{InstallOnQuit: true}); err != nil {
		t.Fatal(err)
	}
	a.stageUpdate()
	if p := a.PendingAppUpdate(); !p.Ready || !p.InstallOnQuit {
		t.Fatalf("after downloading ahead: %+v", p)
	}
	a.checkAppUpdate() // the same build: kept, not fetched again
	a.shutdown(nil)
	if len(*helpers) != 1 || !strings.Contains(strings.Join((*helpers)[0].Args, " "), "-Reopen 0") {
		t.Fatalf("quitting put in place: %v", *helpers)
	}
	a.shutdown(nil)
	if len(*helpers) != 1 {
		t.Fatal("put in place twice")
	}
	if err := a.SetInstallOnQuit(false); err != nil || loadPrefs().InstallOnQuit {
		t.Fatalf("turned off: %v", err)
	}
}

// Update now: the newer build downloaded (or the one downloaded ahead),
// put in place, and the app quits so it can open again.
func TestInstallAppUpdate(t *testing.T) {
	a, w := testApp(t)
	helpers := newerBuild(t)
	if err := a.InstallAppUpdate(); err != nil {
		t.Fatal(err)
	}
	if len(*helpers) != 1 || !strings.Contains(strings.Join((*helpers)[0].Args, " "), "-Reopen 1") {
		t.Fatalf("the helper: %v", *helpers)
	}
	sent := w.sent("app:download")
	if len(sent) == 0 || sent[len(sent)-1].(Download).Percent != 100 {
		t.Fatalf("the download's progress: %v", sent)
	}
	for end := time.Now().Add(5 * time.Second); !w.quitting() && time.Now().Before(end); time.Sleep(20 * time.Millisecond) {
	}
	if !w.quitting() {
		t.Fatal("the app did not quit for the new one to open")
	}

	// Nothing newer, and an installed copy that cannot replace itself, are
	// both left alone in the background.
	commit = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	b, _ := testApp(t)
	b.checkAppUpdate()
	if b.PendingAppUpdate() != nil {
		t.Fatal("the same build was offered")
	}
	commit = ""
	b.checkAppUpdate()
	if b.PendingAppUpdate() != nil {
		t.Fatal("a local build was offered one")
	}
}

// The homelab folder against GitHub, as Settings › Updates shows it.
func TestUpgradeCheckInACheckout(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	a, _ := testApp(t)
	newerBuild(t)
	git := func(dir string, args ...string) {
		t.Helper()
		c := exec.Command("git", append([]string{"-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false"}, args...)...)
		if out, err := c.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	origin, dev := filepath.Join(t.TempDir(), "origin.git"), filepath.Join(t.TempDir(), "dev")
	git(a.root, "init", "--bare", "-b", "main", origin)
	git(a.root, "init", "-q", "-b", "main")
	git(a.root, "add", "compose.yaml", "VERSION")
	git(a.root, "commit", "-q", "-m", "First")
	git(a.root, "remote", "add", "origin", origin)
	git(a.root, "push", "-q", "-u", "origin", "main")
	git(a.root, "clone", "-q", origin, dev)
	os.WriteFile(filepath.Join(dev, "NEWS.md"), []byte("news\n"), 0o644)
	git(dev, "add", ".")
	git(dev, "commit", "-q", "-m", "News")
	git(dev, "push", "-q", "origin", "main")

	info, err := a.UpgradeCheck(true)
	if err != nil {
		t.Fatal(err)
	}
	if info.Behind != 1 || !info.SelfUpdates || info.AppUpdate == nil || info.AppUpdate.Version != "v0.9.9-beta" || !info.AppUpdate.CanInstall {
		t.Fatalf("%+v", info)
	}
	if again, _ := a.UpgradeCheck(false); again.Checked != info.Checked {
		t.Fatal("checked GitHub again within 10 minutes")
	}
}
