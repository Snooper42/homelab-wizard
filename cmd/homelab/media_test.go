package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/media"
)

// fakePython makes this test binary answer as the engines' Python: it
// replays a fixture's event lines and exit code, and records how it was
// called (fakePythonMain), so no Python, Docker, or Tdarr runs.
const fakePython = "HOMELAB_FAKE_PYTHON"

type pythonFixture struct {
	Lines []string `json:"lines"`
	Exit  int      `json:"exit"`
	Calls string   `json:"calls"`
	// Hold: it waits for this file to appear before ending (a job that runs a while).
	Hold string `json:"hold"`
}

func fakePythonMain(fixture string, args []string) int {
	data, err := os.ReadFile(fixture)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	var f pythonFixture
	_ = json.Unmarshal(data, &f)
	if f.Calls != "" {
		line, _ := json.Marshal(map[string]any{"args": args, "jellyfinKey": os.Getenv("JELLYFIN_API_KEY")})
		c, _ := os.OpenFile(f.Calls, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		fmt.Fprintln(c, string(line))
		c.Close()
	}
	for _, l := range f.Lines {
		fmt.Println(l)
	}
	for f.Hold != "" {
		if _, err := os.Stat(f.Hold); err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	return f.Exit
}

// mediaHomelab is a homelab with the engines stubbed: the fixture says what
// "Python" prints, and every check passes.
func mediaHomelab(t *testing.T, fx pythonFixture, env ...string) (root, calls string) {
	t.Helper()
	root, _ = repoCopy(t, env...)
	// Its own home: a run looks at the beets venv under it.
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	tools := media.ToolsDir(root)
	_ = os.MkdirAll(tools, 0o755)
	for _, s := range []string{"music_organizer.py", "music_tidy.py", "books_organizer.py", "movies_organizer.py", "tv_organizer.py",
		"audiobook_organizer.py", "inbox.py", "scrubber.py", "tdarr_setup.py"} {
		_ = os.WriteFile(filepath.Join(tools, s), []byte("# stub\n"), 0o644)
	}
	calls = filepath.Join(t.TempDir(), "python-calls.jsonl")
	fx.Calls = calls
	fixture := filepath.Join(t.TempDir(), "fixture.json")
	data, _ := json.Marshal(fx)
	_ = os.WriteFile(fixture, data, 0o644)
	self, _ := os.Executable()
	t.Setenv(fakePython, "")
	t.Setenv("HOMELAB_PYTHON", self)
	saved := mediaProbe
	mediaProbe = func() media.Probe {
		return media.Probe{GOOS: "linux", LookPath: func(s string) (string, error) { return "/usr/bin/" + s, nil },
			Stat: os.Stat, Output: func(context.Context, string, ...string) (string, error) { return "", errors.New("none") },
			Power: func() (bool, bool) { return false, true }}
	}
	savedPort := portAnswers
	portAnswers = func(string) bool { return false }
	t.Cleanup(func() { mediaProbe, portAnswers = saved, savedPort })
	// The engine is started with the fixture in its environment, not this process's.
	t.Setenv(fakePython, fixture)
	return root, calls
}

func pythonCalls(t *testing.T, path string) []map[string]any {
	t.Helper()
	var out []map[string]any
	data, _ := os.ReadFile(path)
	for _, l := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		if l == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(l), &m); err != nil {
			t.Fatal(err)
		}
		out = append(out, m)
	}
	return out
}

func TestMediaRunsAnEngineAndRecordsItsResult(t *testing.T) {
	fakeDocker(t, nil)
	root, calls := mediaHomelab(t, pythonFixture{Lines: []string{
		`{"type": "title", "text": "Movies library", "sub": "scan only"}`,
		`{"type": "step", "n": 1, "total": 2, "text": "Reading 3 videos"}`,
		`{"type": "ok", "text": "Read them"}`,
		`{"type": "info", "text": "Fixes planned"}`,
		`{"type": "result", "action": "scan", "ok": true, "media": "movies", "files": 3, "bloated": 2, "saving": 5000000000}`,
	}}, "JELLYFIN_API_KEY=jf-secret-key")
	out, code := homelabCmd(t, root, "", "media", "movies", "scan")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	for _, want := range []string{"Movies library  ·  scan only", "[1/2] Reading 3 videos", "✓ Read them", "\n  Fixes planned\n"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
	c := pythonCalls(t, calls)
	if len(c) != 1 {
		t.Fatalf("calls: %v", c)
	}
	args := fmt.Sprint(c[0]["args"])
	if !strings.Contains(args, "movies_organizer.py scan --config "+media.SettingsPath(root)+" --events json") {
		t.Errorf("command: %s", args)
	}
	if strings.Contains(out, `"type"`) {
		t.Errorf("an engine's event shown as JSON:\n%s", out)
	}
	if strings.Contains(args, "jf-secret-key") || c[0]["jellyfinKey"] != "jf-secret-key" {
		t.Errorf("the key goes in the environment, never the command line: %v", c[0])
	}
	if strings.Contains(args, "--yes") {
		t.Errorf("homelab media never adds --yes by itself: %s", args)
	}
	rec := media.LoadRecord(root)
	if r := rec.Last["movies"]["scan"]; !r.OK || r.Result["bloated"] != float64(2) {
		t.Errorf("record: %+v", rec.Last)
	}
	var settings map[string]any
	data, _ := os.ReadFile(media.SettingsPath(root))
	if err := json.Unmarshal(data, &settings); err != nil {
		t.Fatal(err)
	}
	if settings["movies"].(map[string]any)["library"] == "" || settings["reports_dir"] != media.ReportsDir(root) {
		t.Errorf("settings: %v", settings)
	}
	if _, err := os.Stat(media.LockPath(root)); err == nil {
		t.Error("a scan reads only: it takes no lock")
	}
}

// An engine's status --json is one object of its own: printed as it is.
func TestMediaStatusJSONIsPrintedAsItIs(t *testing.T) {
	fakeDocker(t, nil)
	line := `{"library": "/music", "files": 3}`
	root, _ := mediaHomelab(t, pythonFixture{Lines: []string{line}})
	out, code := homelabCmd(t, root, "", "media", "music", "status", "--json")
	if code != 0 || !strings.Contains(out, line+"\n") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
}

func TestMediaEventsPassThroughForTheApp(t *testing.T) {
	fakeDocker(t, nil)
	line := `{"type": "progress", "label": "Reading", "done": 4, "total": 10}`
	root, calls := mediaHomelab(t, pythonFixture{Lines: []string{line, `{"type": "result", "action": "finalize", "ok": true}`}})
	out, code := homelabCmd(t, root, "", "media", "music", "finalize", "--events", "json", "--yes")
	if code != 0 || !strings.Contains(out, line) {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if args := fmt.Sprint(pythonCalls(t, calls)[0]["args"]); !strings.Contains(args, "--yes") {
		t.Errorf("finalize asks: the person's yes goes through: %s", args)
	}
	if media.LoadRecord(root).Activity[0].Text != "Cleaned library swapped in" {
		t.Errorf("activity: %+v", media.LoadRecord(root).Activity)
	}
}

// A Python upgrade left the beets venv pointing at nothing, and every
// music job failed making it again over itself: a run removes it first,
// says so, and the engine sets beets up anew.
func TestMediaRemovesABrokenBeetsVenv(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("a venv's Python is a link only off Windows")
	}
	fakeDocker(t, nil)
	root, calls := mediaHomelab(t, pythonFixture{Lines: []string{`{"type": "result", "action": "scan", "ok": true}`}})
	for _, events := range []bool{false, true} {
		venv := media.VenvPath(homeDir())
		if err := os.MkdirAll(filepath.Join(venv, "bin"), 0o755); err != nil {
			t.Fatal(err)
		}
		_ = os.Symlink(filepath.Join(t.TempDir(), "python3.13"), filepath.Join(venv, "bin", "python"))
		args := []string{"media", "music", "scan"}
		if events {
			args = append(args, "--events", "json")
		}
		out, code := homelabCmd(t, root, "", args...)
		if code != 0 {
			t.Fatalf("exit %d:\n%s", code, out)
		}
		if _, err := os.Stat(venv); !os.IsNotExist(err) {
			t.Errorf("the broken venv is still there: %v", err)
		}
		want := "beets setup stopped working"
		if events {
			want = `{"type":"warn","text":"Tidy Up's beets setup stopped working`
		}
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
	if n := len(pythonCalls(t, calls)); n != 2 {
		t.Errorf("the scans ran %d times, want 2", n)
	}
}

// A job that takes over the lock a stopped one left says so, in a terminal
// and to the app (a warn event with --events json), and runs on.
func TestMediaSaysAJobCarriesOnFromAStoppedOne(t *testing.T) {
	fakeDocker(t, nil)
	root, calls := mediaHomelab(t, pythonFixture{Lines: []string{`{"type": "result", "action": "run", "ok": true}`}})
	for _, events := range []bool{false, true} {
		// A job cut off: its process is gone (a PID no process has).
		left, _ := json.Marshal(media.Lock{PID: 1 << 30, Kind: "audiobooks", Action: "run", Start: time.Now().Add(-time.Hour).UTC()})
		if err := os.MkdirAll(filepath.Dir(media.LockPath(root)), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(media.LockPath(root), left, 0o644); err != nil {
			t.Fatal(err)
		}
		args := []string{"media", "audiobooks", "run"}
		want := "audiobooks run stopped part-way"
		if events {
			args = append(args, "--events", "json")
			want = `{"type":"warn","text":"audiobooks run stopped part-way`
		}
		out, code := homelabCmd(t, root, "", args...)
		if code != 0 {
			t.Fatalf("exit %d:\n%s", code, out)
		}
		if !strings.Contains(out, want) {
			t.Errorf("events %v: missing %q in:\n%s", events, want, out)
		}
	}
	if n := len(pythonCalls(t, calls)); n != 2 {
		t.Errorf("the jobs ran %d times, want 2", n)
	}
}

func TestMediaLockIsOneJobAtATime(t *testing.T) {
	fakeDocker(t, nil)
	hold := filepath.Join(t.TempDir(), "release")
	root, _ := mediaHomelab(t, pythonFixture{Lines: []string{`{"type": "result", "action": "run", "ok": true}`}, Hold: hold})
	done := make(chan string)
	go func() {
		out, _ := homelabCmd(t, root, "", "media", "audiobooks", "run")
		done <- out
	}()
	deadline := time.Now().Add(10 * time.Second)
	for !media.Held(root) {
		if time.Now().After(deadline) {
			t.Fatal("the run never took the lock")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if out, code := homelabCmd(t, root, "", "media", "music", "file", "/x"); code == 0 || !strings.Contains(out, "another Tidy Up job is moving files") {
		t.Errorf("a second job while the first moves files (exit %d):\n%s", code, out)
	}
	// While it holds the lock, the media apps aren't updated alone.
	if out, code := homelabCmd(t, root, "", "update", "navidrome", "--apply"); code == 0 || !strings.Contains(out, "Tidy Up is moving files") {
		t.Errorf("updating Navidrome mid-job (exit %d):\n%s", code, out)
	}
	_ = os.WriteFile(hold, nil, 0o644)
	<-done
	if media.Held(root) {
		t.Error("the lock stays after the job")
	}
}

func TestMediaNightlyUpdateLeavesTheMediaAppsWhileLocked(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:latest", Running: true, Health: "healthy", Project: "homelab_security", Service: "ntfy"},
		{Name: "homelab_media-navidrome-1", Image: "deluan/navidrome:latest", Running: true, Health: "healthy", Project: "homelab_media", Service: "navidrome"},
	})
	root, _ := repoCopy(t, "TUNNEL_TOKEN=")
	// A running job's lock (this test process stands in for it).
	l, _ := json.Marshal(media.Lock{PID: os.Getpid(), Kind: "music", Action: "finalize", Start: time.Now()})
	_ = os.MkdirAll(filepath.Join(root, "data"), 0o755)
	_ = os.WriteFile(media.LockPath(root), l, 0o644)
	out, code := homelabCmd(t, root, "", "update", "--all", "--nightly", "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if !strings.Contains(out, "these wait for the next update: navidrome") || strings.Contains(out, "Updating Navidrome") {
		t.Errorf("Navidrome waits, ntfy updates:\n%s", out)
	}
}

func TestMediaBatteryWaitsForPower(t *testing.T) {
	fakeDocker(t, nil)
	root, calls := mediaHomelab(t, pythonFixture{})
	mediaProbe = func() media.Probe {
		return media.Probe{GOOS: "linux", LookPath: func(s string) (string, error) { return s, nil }, Stat: os.Stat,
			Output: func(context.Context, string, ...string) (string, error) { return "", errors.New("none") },
			Power:  func() (bool, bool) { return true, true }}
	}
	out, code := homelabCmd(t, root, "", "media", "music", "run")
	if code == 0 || !strings.Contains(out, "on battery") {
		t.Errorf("exit %d:\n%s", code, out)
	}
	if len(pythonCalls(t, calls)) != 0 {
		t.Error("a heavy job never starts on battery")
	}
	// A look changes nothing: it runs on battery too.
	if _, code := homelabCmd(t, root, "", "media", "music", "scan"); code != 0 {
		t.Error("a scan on battery")
	}
}

// Setting lyrics right on this computer (--tidy) and counting them
// (--check) are minutes of light work: they run on battery, as a scan does;
// asking LRCLIB for thousands of songs waits for power.
func TestMediaLyricsTidyRunsOnBattery(t *testing.T) {
	fakeDocker(t, nil)
	root, calls := mediaHomelab(t, pythonFixture{Lines: []string{`{"type": "result", "action": "lyrics", "ok": true}`}})
	mediaProbe = func() media.Probe {
		return media.Probe{GOOS: "linux", LookPath: func(s string) (string, error) { return s, nil }, Stat: os.Stat,
			Output: func(context.Context, string, ...string) (string, error) { return "", errors.New("none") },
			Power:  func() (bool, bool) { return true, true }}
	}
	for _, flag := range []string{"--tidy", "--check"} {
		if out, code := homelabCmd(t, root, "", "media", "music", "lyrics", flag); code != 0 {
			t.Errorf("lyrics %s on battery (exit %d):\n%s", flag, code, out)
		}
	}
	if n := len(pythonCalls(t, calls)); n != 2 {
		t.Errorf("ran %d times, want 2", n)
	}
	if out, code := homelabCmd(t, root, "", "media", "music", "lyrics"); code == 0 || !strings.Contains(out, "on battery") {
		t.Errorf("asking LRCLIB on battery (exit %d):\n%s", code, out)
	}
}

func TestMediaTickRunsTheInboxOnlyWhenDownloadsChanged(t *testing.T) {
	fakeDocker(t, nil)
	root, calls := mediaHomelab(t, pythonFixture{Lines: []string{`{"type": "result", "action": "inbox", "ok": true, "filed": {}, "waiting": []}`}},
		"TIDY_SCRUB=false")
	inbox := filepath.Join(t.TempDir(), "Downloads")
	_ = os.MkdirAll(inbox, 0o755)
	f, err := os.ReadFile(filepath.Join(root, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(filepath.Join(root, ".env"), append(f, []byte("TIDY_INBOX_FOLDERS="+inbox+"\n")...), 0o600)
	for range 2 {
		if out, code := homelabCmd(t, root, "", "media", "tick"); code != 0 {
			t.Fatalf("tick (exit %d):\n%s", code, out)
		}
	}
	if n := len(pythonCalls(t, calls)); n != 1 {
		t.Fatalf("a quiet Downloads costs one sweep, not one a minute: %d", n)
	}
	_ = os.WriteFile(filepath.Join(inbox, "Heat.1995.mkv"), []byte("x"), 0o644)
	homelabCmd(t, root, "", "media", "tick")
	c := pythonCalls(t, calls)
	if len(c) != 2 || !strings.Contains(fmt.Sprint(c[1]["args"]), "inbox.py scan --apply") {
		t.Fatalf("a new download is swept: %v", c)
	}
}

func TestScrubDue(t *testing.T) {
	loc := time.Local
	day := func(h, m int) time.Time { return time.Date(2026, 11, 3, h, m, 0, 0, loc) }
	for _, c := range []struct {
		now, last time.Time
		want      bool
	}{
		{day(2, 59), time.Time{}, false},
		{day(3, 0), time.Time{}, true},
		{day(9, 0), day(3, 1), false},
		{day(9, 0), day(3, 1).AddDate(0, 0, -1), true},
	} {
		if got := scrubDue(c.now, c.last); got != c.want {
			t.Errorf("scrubDue(%v, %v) = %v", c.now, c.last, got)
		}
	}
}

func TestMediaUsage(t *testing.T) {
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "media", "help")
	if code != 0 || !strings.Contains(out, "homelab media <library> <action>") {
		t.Errorf("exit %d:\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "media", "films", "scan"); code == 0 || !strings.Contains(out, `no "films"`) {
		t.Errorf("exit %d:\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "media", "books", "shred"); code == 0 || !strings.Contains(out, "review") {
		t.Errorf("exit %d:\n%s", code, out)
	}
}

// A lock left by a job cut off before the computer restarted names a
// process ID another program has now: alive, but started after the lock.
// The agent's tick sweeps the inbox anyway, and a job takes the lock over,
// rather than every one waiting for a job that is gone.
func TestALeftoverLockStopsNothing(t *testing.T) {
	fakeDocker(t, nil)
	root, calls := mediaHomelab(t, pythonFixture{Lines: []string{`{"type": "result", "action": "inbox", "ok": true, "filed": {}, "waiting": []}`}},
		"TIDY_SCRUB=false")
	inbox := filepath.Join(t.TempDir(), "Downloads")
	_ = os.MkdirAll(inbox, 0o755)
	f, err := os.ReadFile(filepath.Join(root, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(filepath.Join(root, ".env"), append(f, []byte("TIDY_INBOX_FOLDERS="+inbox+"\n")...), 0o600)
	// This test's own process is alive, and started well after the lock.
	data, _ := json.Marshal(media.Lock{PID: os.Getpid(), Kind: "scrubber", Action: "scan", Start: time.Now().Add(-72 * time.Hour)})
	_ = os.MkdirAll(filepath.Dir(media.LockPath(root)), 0o755)
	if err := os.WriteFile(media.LockPath(root), data, 0o644); err != nil {
		t.Fatal(err)
	}
	if out, code := homelabCmd(t, root, "", "media", "tick"); code != 0 {
		t.Fatalf("tick (exit %d):\n%s", code, out)
	}
	if c := pythonCalls(t, calls); len(c) != 1 || !strings.Contains(fmt.Sprint(c[0]["args"]), "inbox.py scan --apply") {
		t.Fatalf("the inbox was not swept with a leftover lock: %v", c)
	}
}

// Nov 8, the owner: Tidy Up runs "automatically once a day maybe, or
// maybe even manually". TIDY_INBOX_WHEN: arrive (or unset) sweeps when the
// watched folders change, as before; daily once after 03:00; manual only
// on Tidy up now.
func TestInboxDue(t *testing.T) {
	loc := time.Local
	day := func(h int) time.Time { return time.Date(2026, 11, 8, h, 0, 0, 0, loc) }
	for _, c := range []struct {
		when    string
		changed bool
		now     time.Time
		last    time.Time
		want    bool
	}{
		{"", true, day(9), day(8), true},
		{"arrive", false, day(9), time.Time{}, false},
		{"Arrive", true, day(9), day(8), true},
		{"daily", true, day(2), day(1).AddDate(0, 0, -1), false},
		{"daily", false, day(3), day(1).AddDate(0, 0, -1), true},
		{"daily", true, day(9), day(3), false},
		{"manual", true, day(9), time.Time{}, false},
		{"something else", true, day(9), day(8), true},
	} {
		if got := inboxDue(c.when, c.changed, c.now, c.last); got != c.want {
			t.Errorf("inboxDue(%q, changed %v, %v, last %v) = %v", c.when, c.changed, c.now, c.last, got)
		}
	}
}

// Only when I press it: a new download waits for Tidy up now.
func TestMediaTickLeavesTheInboxWhenManual(t *testing.T) {
	fakeDocker(t, nil)
	root, calls := mediaHomelab(t, pythonFixture{Lines: []string{`{"type": "result", "action": "inbox", "ok": true, "filed": {}, "waiting": []}`}},
		"TIDY_SCRUB=false", "TIDY_INBOX_WHEN=manual")
	inbox := filepath.Join(t.TempDir(), "Downloads")
	_ = os.MkdirAll(inbox, 0o755)
	f, _ := os.ReadFile(filepath.Join(root, ".env"))
	_ = os.WriteFile(filepath.Join(root, ".env"), append(f, []byte("TIDY_INBOX_FOLDERS="+inbox+"\n")...), 0o600)
	_ = os.WriteFile(filepath.Join(inbox, "Heat.1995.mkv"), []byte("x"), 0o644)
	if out, code := homelabCmd(t, root, "", "media", "tick"); code != 0 {
		t.Fatalf("tick (exit %d):\n%s", code, out)
	}
	if c := pythonCalls(t, calls); len(c) != 0 {
		t.Fatalf("swept with manual: %v", c)
	}
}
