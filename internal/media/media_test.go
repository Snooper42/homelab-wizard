package media

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The engine stands in for Python: this test binary, replaying the lines
// in TIDY_FAKE_LINES and exiting with TIDY_FAKE_EXIT.
func TestMain(m *testing.M) {
	if lines, ok := os.LookupEnv("TIDY_FAKE_LINES"); ok {
		for _, l := range strings.Split(lines, "\n") {
			if l != "" {
				fmt.Println(l)
			}
		}
		// TIDY_FAKE_THROW: notes that many things put in the Trash under this run, as trash() does.
		var n int
		fmt.Sscan(os.Getenv("TIDY_FAKE_THROW"), &n)
		for i := 0; i < n; i++ {
			f, _ := os.OpenFile(os.Getenv("HOMELAB_MEDIA_TRASH_LOG"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
			to := fmt.Sprintf("/trash/%d", i)
			if i == n-1 && n > 1 {
				to = "" // the Recycle Bin's: not put back from here
			}
			fmt.Fprintf(f, "{\"run\":%q,\"from\":\"/lib/%d\",\"to\":%q}\n", os.Getenv("HOMELAB_MEDIA_RUN"), i, to)
			f.Close()
		}
		if hold := os.Getenv("TIDY_FAKE_HOLD"); hold != "" {
			time.Sleep(5 * time.Second)
		}
		code := 0
		fmt.Sscan(os.Getenv("TIDY_FAKE_EXIT"), &code)
		os.Exit(code)
	}
	os.Exit(m.Run())
}

func TestLookup(t *testing.T) {
	a, err := Lookup("music", "finalize")
	if err != nil || a.Script != "music_organizer.py" || !a.Lock || !a.Confirm {
		t.Errorf("music finalize: %+v %v", a, err)
	}
	if a, _ := Lookup("movies", "run"); a.Lock || !a.Power {
		t.Errorf("movies run hands files to Tdarr's queue: no lock, but it waits for power: %+v", a)
	}
	if _, err := Lookup("books", "run"); err == nil || !strings.Contains(err.Error(), "apply, genre-counts, init, review, status, undo") {
		t.Errorf("books run: %v", err)
	}
	if _, err := Lookup("films", "scan"); err == nil {
		t.Error("films is not a kind")
	}
	if !IsApp("navidrome") || IsApp("ntfy") {
		t.Error("IsApp")
	}
}

func TestSettings(t *testing.T) {
	env := map[string]string{"MEDIA_ROOT": "/Volumes/Hobbies", "DOWNLOADS_ROOT": "/Volumes/Hobbies/downloads",
		"NAVIDROME_PORT": "4533", "TIDY_KEEP_LANGUAGES": "eng, jpn", "TIDY_SHRINK_LOSSLESS": "false",
		"PLEX_URL": "http://plex:32400", "PLEX_PATH_MAP": "/Volumes/Hobbies=/data"}
	installed := map[string]bool{"navidrome": true, "tdarr": true, "jellyfin-container": true, "audiobookshelf": true}
	s := Settings(Inputs{Root: "/h", Env: env, Home: "/Users/me", Installed: func(id string) bool { return installed[id] },
		GPU: true, LocalEngine: true, Record: Record{TdarrLibraries: map[string]string{"movies": "LIBM"}}})
	get := func(path ...string) any {
		var v any = s
		for _, p := range path {
			v = v.(map[string]any)[p]
		}
		return v
	}
	if get("music", "library") != filepath.Join("/Volumes/Hobbies", "music") || get("books", "library") != filepath.Join("/Volumes/Hobbies", "Books") {
		t.Errorf("libraries: %v %v", get("music", "library"), get("books", "library"))
	}
	if get("music", "engine") != "local" || get("music", "shrink_lossless") != false {
		t.Errorf("music: %v", get("music"))
	}
	if fmt.Sprint(get("video", "keep_languages")) != "[eng jpn]" {
		t.Errorf("languages: %v", get("video", "keep_languages"))
	}
	if get("tdarr", "url") != "http://localhost:8265" || get("tdarr", "gpu") != true || get("tdarr", "libraries").(map[string]string)["movies"] != "LIBM" {
		t.Errorf("tdarr: %v", get("tdarr"))
	}
	// Tdarr's container mounts the media drive's movies and tv folders alone.
	if pm := fmt.Sprint(get("tdarr", "path_map")); pm != "[["+filepath.Join("/Volumes/Hobbies", "movies")+" /media/movies] ["+filepath.Join("/Volumes/Hobbies", "tv")+" /media/tv]]" {
		t.Errorf("tdarr path_map: %s", pm)
	}
	servers := get("servers").(map[string]any)
	if len(servers) != 4 {
		t.Errorf("servers: %v", servers)
	}
	if fmt.Sprint(servers["jellyfin"].(map[string]any)["path_map"]) != "[["+filepath.Join("/Volumes/Hobbies", "movies")+" /media/movies] ["+filepath.Join("/Volumes/Hobbies", "tv")+" /media/tv]]" {
		t.Errorf("Jellyfin in a container sees /media: %v", servers["jellyfin"])
	}
	if fmt.Sprint(servers["plex"].(map[string]any)["path_map"]) != "[[/Volumes/Hobbies /data]]" {
		t.Errorf("plex: %v", servers["plex"])
	}
	if fmt.Sprint(get("inbox", "folders")) != "["+filepath.Join("/Users/me", "Downloads")+" /Volumes/Hobbies/downloads]" {
		t.Errorf("inbox: %v", get("inbox", "folders"))
	}
	// Nothing installed: no addresses to call, and beets in its container.
	s = Settings(Inputs{Root: "/h", Env: map[string]string{}, Home: "/Users/me"})
	if _, ok := s["tdarr"]; ok || len(s["servers"].(map[string]any)) != 0 || s["music"].(map[string]any)["engine"] != "container" {
		t.Errorf("bare: %v", s)
	}
	if Library(map[string]string{"TIDY_TV_LIBRARY": "~/TV"}, "/Users/me", "tv") != filepath.Join("/Users/me", "TV") {
		t.Error("TIDY_TV_LIBRARY")
	}
	if got := InboxFolders(map[string]string{"TIDY_INBOX_FOLDERS": `E:\Downloads;e:\downloads;~/More`}, "/Users/me"); len(got) != 2 {
		t.Errorf("one folder once, whatever its case: %v", got)
	}
	root := t.TempDir()
	path, err := Write(root, s)
	if err != nil || path != SettingsPath(root) {
		t.Fatal(err)
	}
	if _, err := os.Stat(ReportsDir(root)); err != nil {
		t.Error("reports folder")
	}
	env2 := Environ(map[string]string{"JELLYFIN_API_KEY": "k", "TDARR_API_KEY": "__REPLACE_ME__", "OTHER_SECRET": "x"})
	joined := strings.Join(env2, "\n")
	if !strings.Contains(joined, "JELLYFIN_API_KEY=k") || strings.Contains(joined, "TDARR_API_KEY=__") || strings.Contains(joined, "OTHER_SECRET") {
		t.Error("only the engines' keys, and never a placeholder")
	}
}

func TestLock(t *testing.T) {
	root := t.TempDir()
	saved := alive
	t.Cleanup(func() { alive = saved })
	running := map[int]bool{os.Getpid(): true}
	alive = func(pid int) bool { return running[pid] }

	stale, err := Acquire(root, "music", "run", "")
	if err != nil || stale != nil {
		t.Fatal(stale, err)
	}
	if !Held(root) {
		t.Fatal("held")
	}
	if _, err := Acquire(root, "books", "apply", ""); !errors.Is(err, ErrBusy) || !strings.Contains(err.Error(), "music run") {
		t.Errorf("a second job: %v", err)
	}
	if err := Release(root); err != nil || Held(root) {
		t.Fatal("released", err)
	}
	// A job that crashed: its lock is taken over, and named.
	data, _ := json.Marshal(Lock{PID: 999999, Kind: "music", Action: "run", Start: time.Now()})
	_ = os.WriteFile(LockPath(root), data, 0o644)
	if Held(root) {
		t.Error("a dead job holds nothing")
	}
	stale, err = Acquire(root, "music", "run", "")
	if err != nil || stale == nil || stale.Action != "run" {
		t.Errorf("stale: %v %v", stale, err)
	}
	// Release leaves another process's lock alone.
	data, _ = json.Marshal(Lock{PID: 4242, Kind: "tv", Action: "collect"})
	_ = os.WriteFile(LockPath(root), data, 0o644)
	running[4242] = true
	_ = Release(root)
	if !Held(root) {
		t.Error("released someone else's lock")
	}
}

func TestRecordAndWords(t *testing.T) {
	var r Record
	now := time.Now()
	r.Note("music", Run{Action: "verify", OK: true, At: now, Result: map[string]any{"original": 14000.0, "new": 13932.0, "set_aside": 68.0}})
	r.Note("music", Run{Action: "free-space", OK: true, At: now, Result: map[string]any{"freed": 100e9}})
	r.Note("music", Run{Action: "navidrome-cleanup", OK: true, At: now, Result: map[string]any{"removed": 558.0}})
	r.Note("movies", Run{Action: "collect", OK: true, At: now, Result: map[string]any{"replaced": 0.0, "filed": []any{}}})
	r.Note("music", Run{Action: "run", OK: false, Exit: 130, At: now})
	r.Note("music", Run{Action: "verify", OK: false, Exit: 2, At: now, Result: map[string]any{"missing": 3.0}})
	got := []string{}
	for _, a := range r.Activity {
		got = append(got, a.Text+" · "+a.Sub)
	}
	want := []string{
		"Nothing went missing · 14,000 songs before = 13,932 songs + 68 songs set aside",
		"Old library in the Trash · 100 GB freed",
		"Navidrome tidied · 558 missing entries removed, full scan",
		"Some songs are missing · 3 songs not in the new library or set aside",
	}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Errorf("activity:\n%s", strings.Join(got, "\n"))
	}
	if r.Freed["music"] != 100e9 {
		t.Errorf("freed: %v", r.Freed)
	}
	if !r.Last["music"]["verify"].At.Equal(now) || r.Last["music"]["verify"].OK {
		t.Error("last verify is the failed one")
	}
	for in, want := range map[int64]string{999: "999 bytes", 1500: "1.5 KB", 4_200_000: "4.2 MB", 100e9: "100 GB", 2e12: "2 TB"} {
		if got := Bytes(in); got != want {
			t.Errorf("Bytes(%d) = %q", in, got)
		}
	}
	root := t.TempDir()
	if err := r.Save(root); err != nil {
		t.Fatal(err)
	}
	if back := LoadRecord(root); len(back.Activity) != 4 {
		t.Errorf("round trip: %+v", back)
	}
}

func TestEvents(t *testing.T) {
	ev, ok := ParseEvent(`{"type": "step", "n": 2, "total": 5, "text": "Build"}`)
	if !ok || ev.Line() != "\n[2/5] Build" || ev.Raw["n"] != 2.0 {
		t.Errorf("%+v", ev)
	}
	if _, ok := ParseEvent("not json"); ok {
		t.Error("plain text")
	}
	if _, ok := ParseEvent(`{"stage": "built"}`); ok {
		t.Error("status --json is no event")
	}
	for line, want := range map[string]string{
		`{"type":"ok","text":"Done"}`:                  "  ✓ Done",
		`{"type":"warn","text":"Hm"}`:                  "  ! Hm",
		`{"type":"kv","label":"Library","value":"/m"}`: "  Library          /m",
		`{"type":"progress","done":3,"total":9}`:       "",
		`{"type":"title","text":"Music","sub":"swap"}`: "\nMusic  ·  swap",
	} {
		ev, _ := ParseEvent(line)
		if got := ev.Line(); got != want {
			t.Errorf("%s → %q", line, got)
		}
	}
}

func fakeJob(t *testing.T, kind, action string, lines []string, exit int) Job {
	t.Helper()
	root := t.TempDir()
	_ = os.MkdirAll(ToolsDir(root), 0o755)
	a, _ := Lookup(kind, action)
	_ = os.WriteFile(filepath.Join(ToolsDir(root), a.Script), nil, 0o644)
	t.Setenv("TIDY_FAKE_LINES", strings.Join(lines, "\n"))
	t.Setenv("TIDY_FAKE_EXIT", fmt.Sprint(exit))
	self, _ := os.Executable()
	return Job{Root: root, Kind: kind, Action: action, Python: []string{self}}
}

func TestExecute(t *testing.T) {
	var seen []string
	j := fakeJob(t, "music", "verify", []string{`{"type":"step","n":1,"total":1,"text":"Checking"}`, "noise",
		`{"type":"result","action":"verify","ok":false,"missing":3}`}, 2)
	j.Out = func(ev Event, line string) { seen = append(seen, ev.Type) }
	run, err := Execute(context.Background(), j)
	if err == nil || !strings.Contains(err.Error(), "some songs are missing") || run.Exit != 2 || run.OK || run.Result["missing"] != 3.0 {
		t.Errorf("%+v %v", run, err)
	}
	if strings.Join(seen, ",") != "step,info,result" {
		t.Errorf("events: %v", seen)
	}
	j = fakeJob(t, "music", "status", []string{`{"stage": "built", "next": "finalize"}`}, 0)
	run, err = Execute(context.Background(), j)
	if err != nil || !run.OK || run.Result["next"] != "finalize" {
		t.Errorf("status --json is kept as the result: %+v %v", run, err)
	}
	argv, _ := fakeJob(t, "books", "apply", nil, 0).Command()
	if strings.Contains(strings.Join(argv, " "), "--yes") {
		t.Error("--yes only when the person agreed")
	}
	j = fakeJob(t, "books", "apply", nil, 0)
	j.Yes = true
	argv, _ = j.Command()
	if !strings.HasSuffix(strings.Join(argv, " "), "apply --config "+SettingsPath(j.Root)+" --events json --yes") {
		t.Errorf("%v", argv)
	}
	j = fakeJob(t, "inbox", "scan", nil, 0)
	j.Args = []string{"--apply"}
	argv, _ = j.Command()
	if !strings.Contains(strings.Join(argv, " "), "inbox.py scan --apply") {
		t.Errorf("%v", argv)
	}
	if _, err := Execute(context.Background(), Job{Root: t.TempDir(), Kind: "tv", Action: "scan", Python: []string{"x"}}); err == nil || !strings.Contains(err.Error(), "missing") {
		t.Errorf("no engines: %v", err)
	}
}

func TestExecuteStopsOnBattery(t *testing.T) {
	savedB, savedE := onBattery, powerEvery
	t.Cleanup(func() { onBattery, powerEvery = savedB, savedE })
	powerEvery = 50 * time.Millisecond
	j := fakeJob(t, "music", "run", nil, 0)
	t.Setenv("TIDY_FAKE_HOLD", "1")
	plugged := true
	onBattery = func() bool { return !plugged }
	go func() { time.Sleep(200 * time.Millisecond); plugged = false }()
	start := time.Now()
	run, err := Execute(context.Background(), j)
	if !errors.Is(err, ErrOnBattery) || run.Exit != 130 || time.Since(start) > 4*time.Second {
		t.Errorf("%+v %v after %s", run, err, time.Since(start))
	}
	if _, err := Execute(context.Background(), j); !errors.Is(err, ErrOnBattery) {
		t.Errorf("a heavy job doesn't start on battery: %v", err)
	}
	t.Setenv("TIDY_FAKE_HOLD", "")
	j2 := fakeJob(t, "music", "scan", []string{`{"type":"result","ok":true}`}, 0)
	if _, err := Execute(context.Background(), j2); err != nil {
		t.Errorf("a scan runs on battery: %v", err)
	}
}

func TestPreflight(t *testing.T) {
	have := map[string]bool{"python3": true, "ffmpeg": true}
	files := map[string]bool{"/Volumes/Hobbies": true}
	p := Probe{GOOS: "darwin",
		LookPath: func(s string) (string, error) {
			if have[s] {
				return "/usr/bin/" + s, nil
			}
			return "", errors.New("no")
		},
		Stat: func(s string) (os.FileInfo, error) {
			if files[s] {
				return nil, nil
			}
			return nil, os.ErrNotExist
		},
		Output: func(_ context.Context, name string, args ...string) (string, error) {
			if name == "xcode-select" {
				return "", errors.New("no developer tools")
			}
			return "3.12\n", nil
		},
		Power: func() (bool, bool) { return true, true },
	}
	checks := Preflight(context.Background(), p, map[string]string{"MEDIA_ROOT": "/Volumes/Hobbies"}, "/Users/me")
	by := map[string]Check{}
	for _, c := range checks {
		by[c.ID] = c
	}
	if by["python"].OK || !strings.Contains(by["python"].Fix, "brew install python") {
		t.Errorf("a Mac without Homebrew's Python or the developer tools: never runs /usr/bin/python3 (it asks to install them): %+v", by["python"])
	}
	if !by["drive"].OK || by["drive"].Name != "The Hobbies drive" {
		t.Errorf("drive: %+v", by["drive"])
	}
	if by["power"].OK || by["calibredb"].OK || !by["ffmpeg"].OK || by["gpu"].Note == "" {
		t.Errorf("%+v", checks)
	}
	if c := Blocking(checks, "movies", false); c == nil || c.ID != "python" {
		t.Errorf("blocking: %+v", c)
	}
	// Without ffmpeg, each system says its own way to install it, and only that.
	delete(have, "ffmpeg")
	for goos, want := range map[string]string{"darwin": "brew install ffmpeg", "windows": "winget install Gyan.FFmpeg", "linux": "apt install ffmpeg"} {
		q := p
		q.GOOS = goos
		var ff Check
		for _, c := range Preflight(context.Background(), q, map[string]string{"MEDIA_ROOT": "/Volumes/Hobbies"}, "/Users/me") {
			if c.ID == "ffmpeg" {
				ff = c
			}
		}
		others := 0
		for _, w := range []string{"brew install", "winget", "apt install"} {
			if strings.Contains(ff.Fix, w) {
				others++
			}
		}
		if ff.OK || !strings.Contains(ff.Fix, want) || others != 1 {
			t.Errorf("%s: ffmpeg's fix says %q", goos, ff.Fix)
		}
	}
	// With a build pinned here, Install offers it, saying what and from whom; once fetched, it's found.
	saved := FFmpegPins
	defer func() { FFmpegPins = saved }()
	sha := strings.Repeat("a", 64)
	FFmpegPins = map[string]Pin{"darwin/arm64": {Version: "7.1", Source: "builds.example.org", Licence: "GPL",
		Assets: []Asset{{URL: "https://builds.example.org/f.zip", SHA256: sha, Size: 50 << 20, Take: []string{"ffmpeg", "ffprobe"}}}}}
	mac := p
	mac.GOARCH = "arm64"
	ffOf := func(q Probe) Check {
		for _, c := range Preflight(context.Background(), q, map[string]string{"MEDIA_ROOT": "/Volumes/Hobbies"}, "/Users/me") {
			if c.ID == "ffmpeg" {
				return c
			}
		}
		return Check{}
	}
	if c := ffOf(mac); c.OK || c.Install != "ffmpeg" || !strings.HasPrefix(c.Fix, "Install gets ffmpeg 7.1 from builds.example.org (about 50 MB, GPL)") || !strings.Contains(c.Fix, "brew install ffmpeg") {
		t.Errorf("Install offered: %+v", c)
	}
	if c := ffOf(p); c.Install != "" {
		t.Errorf("no build pinned for this machine's processor: no Install: %+v", c)
	}
	files[filepath.Join(BinDir("/Users/me"), "ffmpeg")] = true
	files[filepath.Join(BinDir("/Users/me"), "ffprobe")] = true
	if c := ffOf(mac); !c.OK || c.Note != "Installed by Homelab Wizard" || c.Install != "" {
		t.Errorf("what Install fetched: %+v", c)
	}
	delete(files, filepath.Join(BinDir("/Users/me"), "ffmpeg"))
	delete(files, filepath.Join(BinDir("/Users/me"), "ffprobe"))
	// Homebrew here: Install runs it, ahead of the pinned build (Homebrew keeps it updated).
	files["/opt/homebrew/bin/brew"] = true
	if c := ffOf(mac); c.Install != "ffmpeg" || c.Fix != "Install runs brew install ffmpeg for you (Homebrew is installed here), no terminal needed" {
		t.Errorf("with Homebrew: %+v", c)
	}
	if m, ok := FFmpegManager(mac); !ok || strings.Join(m.Command, " ") != "/opt/homebrew/bin/brew install ffmpeg" {
		t.Errorf("Homebrew's command: %+v", m)
	}
	delete(files, "/opt/homebrew/bin/brew")
	FFmpegPins = saved
	if c := ffOf(mac); c.Install != "" {
		t.Errorf("no Homebrew and no pin: no Install: %+v", c)
	}
	winMac := mac
	winMac.GOOS = "windows"
	have["winget"] = true
	if m, ok := FFmpegManager(winMac); !ok || m.Name != "winget" || !strings.Contains(strings.Join(m.Command, " "), "install --id Gyan.FFmpeg --exact --silent") {
		t.Errorf("winget: %+v", m)
	}
	delete(have, "winget")
	have["ffmpeg"] = true
	files["/opt/homebrew/bin/python3"] = true
	if py, v := p.Python(context.Background()); len(py) != 1 || py[0] != "/opt/homebrew/bin/python3" || v != "3.12" {
		t.Errorf("Homebrew's Python: %v %s", py, v)
	}
	checks = Preflight(context.Background(), p, map[string]string{"MEDIA_ROOT": "/Volumes/Hobbies"}, "/Users/me")
	if c := Blocking(checks, "books", false); c == nil || c.ID != "calibredb" {
		t.Errorf("books need Calibre's tools: %+v", c)
	}
	if c := Blocking(checks, "movies", true); c == nil || c.ID != "power" {
		t.Errorf("a heavy job needs power: %+v", c)
	}
	if c := Blocking(checks, "movies", false); c != nil {
		t.Errorf("a look at the films needs nothing more: %+v", c)
	}
	win := Probe{GOOS: "windows", LookPath: func(s string) (string, error) { return s, nil }, Stat: p.Stat,
		Output: func(_ context.Context, name string, args ...string) (string, error) {
			if name == "py" {
				return "3.13", nil
			}
			return "", errors.New("no")
		}}
	if py, _ := win.Python(context.Background()); strings.Join(py, " ") != "py -3" {
		t.Errorf("Windows: the py launcher: %v", py)
	}
	if !versionAtLeast("3.10", 3, 8) || versionAtLeast("3.7", 3, 8) || versionAtLeast("2.7", 3, 8) {
		t.Error("versions")
	}
}

func TestInboxSignatureAndTdarrWork(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	a := InboxSignature([]string{dir}, now)
	_ = os.WriteFile(filepath.Join(dir, ".DS_Store"), nil, 0o644)
	if InboxSignature([]string{dir}, now) != a {
		t.Error("hidden files don't count")
	}
	_ = os.WriteFile(filepath.Join(dir, "x.mkv"), []byte("x"), 0o644)
	b := InboxSignature([]string{dir}, now)
	if b == a {
		t.Error("a new download changes it")
	}
	if InboxSignature([]string{dir}, now.Add(6*time.Minute)) == b {
		t.Error("settling changes it, so the sweep looks again")
	}
	home := t.TempDir()
	if HasTdarrWork(home, "movies") {
		t.Error("no record")
	}
	_ = os.MkdirAll(filepath.Join(home, ".homelab-media"), 0o755)
	_ = os.WriteFile(filepath.Join(home, ".homelab-media", "movies.json"), []byte(`{"files":{"/m/a.mkv":{"status":"lean"}},"pending":{}}`), 0o644)
	if HasTdarrWork(home, "movies") {
		t.Error("nothing queued")
	}
	_ = os.WriteFile(filepath.Join(home, ".homelab-media", "tv.json"), []byte(`{"files":{"/t/a.mkv":{"status":"queued"}}}`), 0o644)
	if !HasTdarrWork(home, "tv") {
		t.Error("queued")
	}
}
