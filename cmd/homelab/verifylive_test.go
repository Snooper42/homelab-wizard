package main

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// verify-live (homelab doctor --live) runs every live check against the
// engine and prints a PASS/FAIL table, and it touches nothing but what it
// made: every container and volume it removes is its own homelab-verify-…,
// its workspace goes, and the household's apps are only read.
// asOtherThanMac makes verify-live take the same path on every runner: a CI
// Mac's own LaunchAgents (none installed) are not the test's to judge.
func asOtherThanMac(t *testing.T) {
	was := liveOS
	liveOS = "linux"
	t.Cleanup(func() { liveOS = was })
}

func TestVerifyLiveChecksAndCleansUp(t *testing.T) {
	asOtherThanMac(t)
	root, _ := repoCopy(t)
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server", Running: true, Project: "homelab_security", Service: "vaultwarden"},
	})
	t.Setenv("FAKE_IMAGE_ID", "sha256:here")
	t.Setenv("FAKE_PSQL_OUT", `psql:<stdin>:3: ERROR:  current user cannot be dropped\n`)
	out, code := homelabCmd(t, root, "", "doctor", "--live")
	log := readCalls(t, calls)
	if code != 0 {
		t.Fatalf("exit %d:\n%s\n%s", code, out, log)
	}
	for _, want := range []string{"Docker engine", "Container start, stop, remove", "A folder shared with a container", "A volume backed up and restored", "A database dumped and restored", "A database put back after a schema change", "Immich's database dumped and restored", "Duplicati: a blind restore", "The scheduled agent (launchd)", "Disk space", "0 failed"} {
		if !strings.Contains(out, want) {
			t.Errorf("no %q in:\n%s", want, out)
		}
	}
	if strings.Count(out, "PASS") < 6 {
		t.Errorf("fewer passes than checks that ran:\n%s", out)
	}

	// Only its own: every removal names homelab-verify-…, nothing is stopped
	// but its own, and no Compose project is touched.
	// Each docker removal, stop or kill, and the name it was given (a line
	// of a script passed to a container, which the calls log keeps too, is
	// not one: its arguments start with a dash or a quote).
	removal := regexp.MustCompile(`(?m)^(?:rm|stop|volume rm|kill)(?: -f| -v| --time \d+)* ([^-"\s]\S*)`)
	found := removal.FindAllStringSubmatch(log, -1)
	if len(found) == 0 {
		t.Fatal("no removal seen: the check is not reading the calls")
	}
	for _, m := range found {
		if !strings.HasPrefix(m[1], "homelab-verify-") {
			t.Errorf("touched something not its own: %s", m[0])
		}
	}
	if strings.Contains(log, "compose") && regexp.MustCompile(`compose .*(stop|down|rm|up)`).MatchString(log) {
		t.Errorf("changed a Compose project:\n%s", log)
	}
	for _, made := range regexp.MustCompile(`homelab-verify-[0-9a-f]+-[a-z-]+`).FindAllString(log, -1) {
		if !strings.Contains(log, "rm -f -v "+made) && !strings.Contains(log, "volume rm -f "+made) {
			t.Errorf("%s was not removed", made)
		}
	}
	if left, _ := filepath.Glob(filepath.Join(root, "recovery-staging", "verify-live-*")); len(left) != 0 {
		t.Errorf("its workspace is still there: %v", left)
	}
}

// A check that fails is FAIL with what it found, the run exits non-zero, and
// it still removes what it made.
func TestVerifyLiveSaysWhatFailed(t *testing.T) {
	asOtherThanMac(t)
	root, _ := repoCopy(t)
	calls := fakeDocker(t, nil)
	t.Setenv("FAKE_IMAGE_ID", "sha256:here")
	t.Setenv("FAKE_PSQL_OUT", `psql:<stdin>:9: ERROR:  relation "photos" already exists\n`)
	out, code := homelabCmd(t, root, "", "verify-live")
	if code == 0 || !strings.Contains(out, "FAIL") || !strings.Contains(out, `relation "photos" already exists`) || !strings.Contains(out, "3 failed") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if !strings.Contains(readCalls(t, calls), "rm -f -v homelab-verify-") {
		t.Error("a failed run left its containers")
	}

	// No engine: Docker's own row says what to do, and the rest wait for it.
	_ = os.WriteFile(filepath.Join(filepath.Dir(calls), "down"), nil, 0o644)
	out, code = homelabCmd(t, root, "", "verify-live")
	if code == 0 || !strings.Contains(out, ", then run this again") || !strings.Contains(out, "needs the Docker engine") {
		t.Fatalf("no engine: exit %d\n%s", code, out)
	}
}

// On a Mac, the agent's plist not installed is a FAIL saying how to install
// it, before macOS's own tools are asked anything.
func TestVerifyLiveLaunchdNotInstalled(t *testing.T) {
	was := liveOS
	liveOS = "darwin"
	t.Cleanup(func() { liveOS = was })
	home := t.TempDir()
	t.Setenv("HOME", home)
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	r := &liveRun{h: h, ws: t.TempDir()}
	r.launchd(context.Background())
	if len(r.results) != 1 || r.results[0].State != "FAIL" || !strings.Contains(r.results[0].Detail, "schedule install --apply") {
		t.Fatalf("%+v", r.results)
	}
}
