package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	goruntime "runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func TestTidyUpReadsTheRecordWithoutPython(t *testing.T) {
	a, _ := testApp(t)
	home, _ := os.UserHomeDir()
	mediaRoot := filepath.Join(home, "Hobbies")
	_ = os.MkdirAll(filepath.Join(mediaRoot, "music"), 0o755)
	f, _ := os.OpenFile(filepath.Join(a.root, ".env"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	f.WriteString("MEDIA_ROOT=" + mediaRoot + "\nTIDY_VIDEO_CODEC=av1\n")
	f.Close()
	now := time.Now().UTC()
	rec := media.Record{TdarrLibraries: map[string]string{"movies": "tidyup-movies"}}
	rec.Note("music", media.Run{Action: "run", OK: true, At: now.Add(-3 * time.Hour), Result: map[string]any{"in_library": 10.0, "set_aside": 1.0}})
	rec.Note("music", media.Run{Action: "finalize", OK: true, At: now.Add(-2 * time.Hour)})
	rec.Note("music", media.Run{Action: "verify", OK: true, At: now.Add(-time.Hour), Result: map[string]any{"original": 11.0, "new": 10.0, "set_aside": 1.0}})
	rec.Note("movies", media.Run{Action: "collect", OK: true, At: now, Result: map[string]any{"replaced": 2.0, "freed": 5e9}})
	if err := rec.Save(a.root); err != nil {
		t.Fatal(err)
	}
	_ = os.MkdirAll(filepath.Join(home, ".homelab-media"), 0o755)
	_ = os.WriteFile(filepath.Join(home, ".homelab-media", "movies.json"), []byte(`{"files":{"/a":{"status":"lean"},"/b":{"status":"bloated"},"/c":{"status":"queued"}},"pending":{"/s":{}}}`), 0o644)
	_ = os.WriteFile(media.SizesPath(home), []byte(`{"music":{"bytes":520000000000,"at":"2026-11-03T10:00:00Z"}}`), 0o644)
	measured := map[string]string{}
	refreshSizes = func(_ string, folders map[string]string, _ time.Duration, _ func() time.Time) bool {
		for k, v := range folders {
			measured[k] = v
		}
		return true
	}
	defer func() { refreshSizes = media.RefreshSizes }()
	got, err := a.TidyUp()
	if err != nil {
		t.Fatal(err)
	}
	by := map[string]TidyLibrary{}
	for _, l := range got.Libraries {
		by[l.Kind] = l
	}
	if len(got.Libraries) != 5 || !by["music"].Found || by["movies"].Found || by["music"].Stage != "verified" {
		t.Errorf("libraries: %+v", got.Libraries)
	}
	if by["movies"].Counts["bloated"] != 1 || by["movies"].Counts["queued"] != 1 || by["movies"].Waiting != 1 || by["movies"].Freed != 5e9 || got.Freed != 5e9 {
		t.Errorf("movies: %+v, freed %d", by["movies"], got.Freed)
	}
	if got.Settings["TIDY_VIDEO_CODEC"] != "av1" || got.Tdarr["movies"] != "tidyup-movies" || got.Reports != media.ReportsDir(a.root) || len(got.Checks) == 0 {
		t.Errorf("%+v", got)
	}
	if by["music"].Size != 52e10 || by["movies"].Size != 0 {
		t.Errorf("sizes: music %d, movies %d", by["music"].Size, by["movies"].Size)
	}
	if _, ok := measured["music"]; !ok || len(measured) != 1 {
		t.Errorf("measured %v: only the libraries that are there", measured)
	}
	if got.Drive == nil || got.Drive.Total == 0 || got.Drive.Free > got.Drive.Total {
		t.Errorf("drive: %+v", got.Drive)
	}
	if len(got.Activity) != 4 {
		t.Errorf("activity: %+v", got.Activity)
	}
}

func TestTidyStage(t *testing.T) {
	at := func(h int) time.Time { return time.Date(2026, 11, 3, h, 0, 0, 0, time.UTC) }
	ok := func(h int) media.Run { return media.Run{OK: true, At: at(h)} }
	for _, c := range []struct {
		last map[string]media.Run
		want string
	}{
		{nil, "new"},
		{map[string]media.Run{"scan": ok(1)}, "scanned"},
		{map[string]media.Run{"scan": ok(1), "run": ok(2)}, "built"},
		{map[string]media.Run{"run": ok(2), "finalize": ok(3)}, "swapped"},
		{map[string]media.Run{"run": ok(2), "finalize": ok(3), "undo": ok(4)}, "built"},
		{map[string]media.Run{"run": ok(2), "finalize": ok(3), "verify": ok(4)}, "verified"},
		{map[string]media.Run{"run": ok(2), "finalize": ok(3), "verify": ok(4), "free-space": ok(5)}, "freed"},
		{map[string]media.Run{"run": ok(2), "finalize": ok(3), "verify": {OK: false, At: at(4)}}, "swapped"},
	} {
		if got := stage("music", c.last); got != c.want {
			t.Errorf("%v: %s, want %s", c.last, got, c.want)
		}
	}
	if stage("books", map[string]media.Run{"review": ok(1), "apply": ok(2)}) != "applied" || stage("books", map[string]media.Run{"review": ok(3), "apply": ok(2)}) != "reviewed" {
		t.Error("books")
	}
}

func TestTidyArgs(t *testing.T) {
	for _, c := range []struct {
		kind, action string
		args         []string
		yes          bool
		want         string
	}{
		{"music", "finalize", nil, true, "media music finalize --events json --yes"},
		{"books", "apply", []string{"--skip", "12,40", "--yes"}, false, "media books apply --skip 12,40 --events json"},
		{"inbox", "scan", []string{"--apply"}, false, "media inbox --apply --events json"},
		{"scrubber", "scan", nil, false, "media scrub --events json"},
		{"tdarr", "setup", []string{"--apply"}, false, "media tdarr setup --apply --events json"},
		{"arr", "apply", nil, false, "media arr --apply"},
		{"install", "ffmpeg", nil, true, "media install ffmpeg --events json --yes"},
	} {
		got, err := tidyArgs(c.kind, c.action, c.args, c.yes)
		if err != nil || strings.Join(got, " ") != c.want {
			t.Errorf("%s %s: %v %v", c.kind, c.action, got, err)
		}
	}
	if _, err := tidyArgs("music", "rm-rf", nil, false); err == nil {
		t.Error("an action the engines don't have")
	}
	if _, err := tidyArgs("install", "anything", nil, true); err == nil {
		t.Error("Install fetches ffmpeg alone")
	}
}

// The screen's arguments are the few the screen sends: never one that
// points an engine at another folder (--library), other settings
// (--config), or files of the page's choosing, so a bug in the page can't
// have Tidy Up sort, rename, or throw away anything but the libraries.
func TestTidyArgsTakesOnlyWhatTheScreenSends(t *testing.T) {
	for _, c := range []struct {
		kind, action string
		args         []string
		want         string
	}{
		{"music", "lyrics", []string{"--check"}, "media music lyrics --check --events json"},
		{"trash", "restore", []string{"scrubber-scan-1730770000000000000"}, "media restore scrubber-scan-1730770000000000000 --events json"},
		{"books", "apply", []string{"--skip", "1049"}, "media books apply --skip 1049 --events json"},
		// Tidy lyrics (Overview's and Music's): the songs' own lyrics set right, asking LRCLIB nothing.
		{"music", "lyrics", []string{"--tidy"}, "media music lyrics --tidy --events json"},
		// What I did today's Undo: one line of it.
		{"inbox", "undo", []string{"0123456789ab"}, "media inbox undo 0123456789ab --events json"},
		// Needs a look: the download, then what it is.
		{"inbox", "name", []string{vid, "movie", "Heat", "1995"}, "media inbox name " + vid + " movie Heat 1995 --events json"},
		{"inbox", "name", []string{vid, "movie", "The Thing"}, "media inbox name " + vid + " movie The Thing --events json"},
		{"inbox", "name", []string{show, "episode", "Show", "3", "4"}, "media inbox name " + show + " episode Show 3 4 --events json"},
		{"inbox", "leave", []string{vid}, "media inbox leave " + vid + " --events json"},
	} {
		got, err := tidyArgs(c.kind, c.action, c.args, false)
		if err != nil || strings.Join(got, " ") != c.want {
			t.Errorf("%s %s %v: %v %v", c.kind, c.action, c.args, got, err)
		}
	}
	for _, c := range []struct {
		kind, action string
		args         []string
	}{
		{"music", "run", []string{"--library", "/home/anna"}},
		{"music", "run", []string{"--library=/home/anna"}},
		{"movies", "scan", []string{"--config", "/tmp/other.json"}},
		{"movies", "file", []string{"/home/anna/.ssh/id_ed25519"}},
		{"books", "apply", []string{"--skip", "1,../2"}},
		{"books", "apply", []string{"--skip"}},
		{"trash", "restore", []string{"../../x"}},
		{"trash", "restore", []string{"a-b-1", "a-b-2"}},
		{"trash", "restore", nil},
		// --tidy is music lyrics' alone.
		{"movies", "scan", []string{"--tidy"}},
		{"music", "run", []string{"--tidy"}},
		{"inbox", "undo", nil},
		{"inbox", "undo", []string{"/Users/anna/Downloads"}},
		{"inbox", "undo", []string{"0123456789ab", "ba9876543210"}},
		{"inbox", "scan", []string{"0123456789ab"}},
		{"inbox", "name", []string{"vid.mkv", "movie", "Heat"}},
		{"inbox", "name", []string{vid, "movie", "--library=/x"}},
		{"inbox", "name", []string{vid, "movie", "Heat", "--config"}},
		{"inbox", "name", []string{vid, "song", "Heat"}},
		{"inbox", "name", []string{vid, "movie", ""}},
		{"inbox", "name", []string{vid, "movie", "Heat", "1995", "2"}},
		{"inbox", "name", []string{vid, "episode", "Show"}},
		{"inbox", "name", []string{vid, "episode", "Show", "three"}},
		{"inbox", "leave", []string{"/d/a", "/d/b"}},
		{"inbox", "leave", nil},
	} {
		if got, err := tidyArgs(c.kind, c.action, c.args, false); err == nil {
			t.Errorf("%s %s %v went through: %v", c.kind, c.action, c.args, got)
		}
	}
}

func TestTidyRunSendsTheEngineEvents(t *testing.T) {
	a, w := testApp(t)
	if err := a.TidyRun("movies", "scan", nil, false); err != nil {
		t.Fatal(err)
	}
	evs := w.sent("media:event")
	if len(evs) < 2 {
		t.Fatalf("events: %v", evs)
	}
	first := evs[0].(map[string]any)
	if first["type"] != "info" || !strings.Contains(first["text"].(string), "ran media movies scan --events json") {
		t.Errorf("the CLI's own line as info: %v", first)
	}
	if evs[1].(map[string]any)["type"] != "step" {
		t.Errorf("JSON lines as they are: %v", evs[1])
	}
	a.TidyStop() // nothing running: nothing to stop
}

// A job that stops says why, as the command said it, not "exit status 1"; the line is red on the screen too.
func TestTidyRunSaysWhyItStopped(t *testing.T) {
	if goruntime.GOOS == "windows" {
		t.Skip("the Windows launcher's echo can't write ✗")
	}
	a, w := testApp(t)
	err := a.TidyRun("movies", "scan", []string{"--check"}, false)
	if err == nil || err.Error() != "ffmpeg and ffprobe: Not installed. Install ffmpeg: brew install ffmpeg in Terminal" {
		t.Fatalf("the error: %v", err)
	}
	evs := w.sent("media:event")
	if last := evs[len(evs)-1].(map[string]any); last["type"] != "fail" || !strings.HasPrefix(last["text"].(string), "ffmpeg and ffprobe") {
		t.Errorf("the line as a failure: %v", last)
	}
}

func TestReadEventsAndTail(t *testing.T) {
	var got []map[string]any
	readEvents(strings.NewReader("{\"type\":\"ok\",\"text\":\"Done\"}\n  ✓ Sonarr stops renaming files\n\n{not json\n"), func(e map[string]any) { got = append(got, e) })
	if len(got) != 3 || got[0]["text"] != "Done" || got[1]["text"] != "Sonarr stops renaming files" || got[2]["type"] != "info" {
		t.Errorf("%v", got)
	}
	var tl tailLines
	tl.Write([]byte("✗ Tdarr isn't answering at http://localhost:8265\nexit status 1\n"))
	if tl.last() != "Tdarr isn't answering at http://localhost:8265" {
		t.Errorf("%q", tl.last())
	}
}

func TestTidyReviewAndCovers(t *testing.T) {
	a, _ := testApp(t)
	dir := media.ReportsDir(a.root)
	_ = os.MkdirAll(filepath.Join(dir, "calibre_covers", "new"), 0o755)
	_ = os.MkdirAll(filepath.Join(dir, "calibre_covers", "current"), 0o755)
	if b, err := a.TidyReview(); err != nil || len(b) != 0 {
		t.Errorf("no review yet: %v %v", b, err)
	}
	_ = os.WriteFile(filepath.Join(dir, "calibre_cleanup_preview.csv"), []byte("book_id,current_title,field,old,new,reason\n"+
		"12,dune,title,dune,Dune,case\n12,dune,series,,Dune,online\n77,Untitled,tags,Misc,Fiction,online\n"), 0o644)
	_ = os.WriteFile(filepath.Join(dir, "calibre_covers", "new", "5 - Frankenstein.jpg"), []byte("jpg"), 0o644)
	_ = os.WriteFile(filepath.Join(dir, "calibre_covers", "current", "5 - Frankenstein.jpg"), []byte("old"), 0o644)
	rec := media.Record{}
	rec.Note("books", media.Run{Action: "review", OK: true, At: time.Now(), Result: map[string]any{"held": []any{77.0}}})
	_ = rec.Save(a.root)
	books, err := a.TidyReview()
	if err != nil || len(books) != 3 {
		t.Fatalf("%v %v", books, err)
	}
	data, _ := json.Marshal(books)
	if books[0].Title != "dune" || len(books[0].Changes) != 2 || books[1].Title != "Frankenstein" || !books[1].Cover || !books[2].Held {
		t.Errorf("%s", data)
	}
	if c := a.TidyCover(5, "new"); c != "data:image/jpeg;base64,anBn" {
		t.Errorf("cover: %q", c)
	}
	if a.TidyCover(5, "../../etc") != "" || a.TidyCover(6, "new") != "" {
		t.Error("only the review's covers")
	}
}

func TestTidyRevealOnlyItsOwnFolders(t *testing.T) {
	a, _ := testApp(t)
	_ = os.MkdirAll(media.ReportsDir(a.root), 0o755)
	if err := a.TidyReveal(filepath.Join(a.root, ".env")); err == nil || !strings.Contains(err.Error(), "isn't one of Tidy Up's folders") {
		t.Errorf(".env: %v", err)
	}
	if err := a.TidyReveal(filepath.Join(media.ReportsDir(a.root), "gone.csv")); err == nil {
		t.Error("a report that isn't there")
	}
}

func TestDriveName(t *testing.T) {
	cases := []struct{ path, user, want string }{
		{"/Volumes/Hobbies/music", "you", "Hobbies"},
		{"/media/you/Hobbies/Movies", "you", "Hobbies"},
		{"/media/Hobbies/Movies", "you", "Hobbies"},
		{"/run/media/deck/Hobbies/tv", "deck", "Hobbies"},
		{"/mnt/media/Music", "you", "media"},
		{"/Users/you/Music", "you", ""},
		{"/home/you/Music", "you", ""},
	}
	if goruntime.GOOS == "windows" {
		cases = append(cases, struct{ path, user, want string }{`M:\Music`, "you", "M:"})
	}
	for _, c := range cases {
		if got := driveName(c.path, c.user); got != c.want {
			t.Errorf("driveName(%q) = %q, want %q", c.path, got, c.want)
		}
	}
}

// A job another process runs (the agent's Collect): the lock, and where its log says it is.
func TestTidyLockFollowsAJobItDidNotStart(t *testing.T) {
	a, _ := testApp(t)
	if got := a.TidyLock(); got.Lock != nil {
		t.Fatalf("nothing running: %+v", got)
	}
	if err := os.MkdirAll(media.LogDir(a.root), 0o755); err != nil {
		t.Fatal(err)
	}
	log := filepath.Join(media.LogDir(a.root), "movies-collect-20261106-140200.jsonl")
	if err := os.WriteFile(log, []byte(`{"type":"step","n":2,"total":2,"text":"Swapping in the smaller copies"}`+"\n"+`{"type":"progress","label":"Films","done":1,"total":4,"note":"Heat (1995)"}`+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := media.Acquire(a.root, "movies", "collect", log); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = media.Release(a.root) }()
	got := a.TidyLock()
	if got.Lock == nil || got.Lock.Kind != "movies" || got.Lock.Action != "collect" {
		t.Fatalf("lock: %+v", got.Lock)
	}
	if got.Now.Step == nil || got.Now.Step.Text != "Swapping in the smaller copies" || got.Now.Progress == nil || got.Now.Progress.Note != "Heat (1995)" {
		t.Errorf("where it is: %+v %+v", got.Now.Step, got.Now.Progress)
	}
}

// Every job a button on Tidy Up sends, with the flags written into the screen's code, is one the app runs. The
// preview's fake backend runs anything, so a smoke case can't see the app refuse a flag: Tidy lyrics sent --tidy,
// which the app refused, and every smoke case passed.
func TestTidyArgsTakeEveryJobTheScreenSends(t *testing.T) {
	call := regexp.MustCompile(`\brun\('([a-z]+)', '([a-z-]+)', \[([^\]]*)\]`)
	flag := regexp.MustCompile(`'(--[a-z-]+)'`)
	seen := 0
	for _, f := range []string{"../web/src/tidy/Tidy.tsx", "../web/src/screens/tidy.ts"} {
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range call.FindAllStringSubmatch(string(b), -1) {
			var args []string
			for _, a := range flag.FindAllStringSubmatch(m[3], -1) {
				args = append(args, a[1])
			}
			// --skip takes the books' ids, and Undo the run it puts back, which the screen fills in.
			if len(args) == 1 && args[0] == "--skip" {
				args = append(args, "1,2")
			}
			if m[1] == "trash" {
				args = append(args, "scrubber-scan-1")
			}
			// What I did today's Undo: the line it puts back.
			if m[1] == "inbox" && m[2] == "undo" {
				args = append(args, "0123456789ab")
			}
			// Needs a look's: the download, then what the sheet asked.
			if m[1] == "inbox" && m[2] == "leave" {
				args = []string{vid}
			}
			if m[1] == "inbox" && m[2] == "name" {
				args = []string{vid, "movie", "Heat", "1995"}
			}
			seen++
			if _, err := tidyArgs(m[1], m[2], args, false); err != nil {
				t.Errorf("%s: run(%q, %q, %v) is refused: %v", f, m[1], m[2], args, err)
			}
		}
	}
	if seen < 10 {
		t.Fatalf("found only %d jobs the screen runs: the pattern no longer matches its code", seen)
	}
}

// Books in folders of their own, as Calibre exports them, with no
// metadata.db: the Books tab is told how many, to offer Make a Calibre
// library; once there is one, it isn't.
func TestTidyUpBooksWithNoCalibreLibrary(t *testing.T) {
	a, _ := testApp(t)
	home, _ := os.UserHomeDir()
	mediaRoot := filepath.Join(home, "Hobbies")
	books := filepath.Join(mediaRoot, "Books")
	for _, p := range []string{"Ann Author/One/One.epub", "Ann Author/One/One.azw3", "Ann Author/Two/Two.epub", "Bob Writer/Three/Three.pdf", "Bob Writer/Three/metadata.opf", ".calnotes/notes.db", "loose.epub", "_Sync/system/collections.json"} {
		_ = os.MkdirAll(filepath.Dir(filepath.Join(books, p)), 0o755)
		_ = os.WriteFile(filepath.Join(books, p), nil, 0o644)
	}
	f, _ := os.OpenFile(filepath.Join(a.root, ".env"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	f.WriteString("MEDIA_ROOT=" + mediaRoot + "\n")
	f.Close()
	refreshSizes = func(string, map[string]string, time.Duration, func() time.Time) bool { return true }
	defer func() { refreshSizes = media.RefreshSizes }()
	book := func() TidyLibrary {
		got, err := a.TidyUp()
		if err != nil {
			t.Fatal(err)
		}
		for _, l := range got.Libraries {
			if l.Kind == "books" {
				return l
			}
		}
		t.Fatal("no books")
		return TidyLibrary{}
	}
	if l := book(); !l.Found || !l.NoCalibre || l.Loose != 3 {
		t.Errorf("no library: %+v", l)
	}
	_ = os.WriteFile(filepath.Join(books, "metadata.db"), nil, 0o644)
	if l := book(); l.NoCalibre || l.Loose != 0 {
		t.Errorf("a library: %+v", l)
	}
}

// The Inbox card: the folders Tidy Up watches (one gone with its drive is
// said), and when it files what's in them; saving writes both into .env.
// A folder to add comes from the system's picker; an empty list or an
// unknown when is refused.
func TestTidySetInbox(t *testing.T) {
	a, _ := testApp(t)
	home, _ := os.UserHomeDir()
	downloads, inbox := filepath.Join(home, "Downloads"), filepath.Join(home, "Hobbies", "Inbox")
	_ = os.MkdirAll(downloads, 0o755)
	refreshSizes = func(string, map[string]string, time.Duration, func() time.Time) bool { return true }
	defer func() { refreshSizes = media.RefreshSizes }()
	got, err := a.TidyUp()
	if err != nil || got.Inbox.When != "arrive" {
		t.Fatalf("before: %+v %v", got.Inbox, err)
	}
	got, err = a.TidySetInbox([]string{downloads, " " + inbox + " "}, "daily")
	if err != nil {
		t.Fatal(err)
	}
	env := core.Env(a.root)
	if env["TIDY_INBOX_FOLDERS"] != downloads+";"+inbox || env["TIDY_INBOX_WHEN"] != "daily" {
		t.Errorf(".env: %q %q", env["TIDY_INBOX_FOLDERS"], env["TIDY_INBOX_WHEN"])
	}
	if got.Inbox.When != "daily" || len(got.Inbox.Folders) != 2 || len(got.Inbox.Gone) != 1 || got.Inbox.Gone[0] != inbox {
		t.Errorf("after: %+v", got.Inbox)
	}
	// What I did today: the inbox's record of the day.
	line := `{"id":"x1","kind":"movies","title":"Heat (1995)","where":"Movies › Heat (1995)","did":["renamed and filed"],"from":"/d/Heat.mkv","files":["/m/Heat.mkv"],"undo":true,"run":"r","at":"` + time.Now().Format("2006-01-02T15:04:05") + `"}` + "\n"
	_ = os.MkdirAll(filepath.Join(a.root, "data"), 0o755)
	_ = os.WriteFile(media.FiledLogPath(a.root), []byte(line), 0o644)
	// Needs a look: what the inbox couldn't place; only what it lists can be named or left.
	stuck := filepath.Join(downloads, "vid_0042.mkv")
	_ = os.WriteFile(stuck, nil, 0o644)
	_ = os.WriteFile(media.NeedsPath(a.root), []byte(`[{"path":`+strconv.Quote(stuck)+`,"name":"vid_0042.mkv","kind":"movies","why":"Couldn't tell which film it is from its name."}]`), 0o644)
	if got, _ := a.TidyUp(); len(got.Needs) != 1 || got.Needs[0].Kind != "movies" {
		t.Errorf("needs: %+v", got.Needs)
	}
	if !needsListed(a.root, stuck) || needsListed(a.root, filepath.Join(home, ".ssh", "id_ed25519")) {
		t.Error("only what Needs a look lists")
	}
	if err := a.TidyRun("inbox", "leave", []string{filepath.Join(home, ".ssh")}, false); err == nil || !strings.Contains(err.Error(), "Needs a look") {
		t.Errorf("leave on a folder Needs a look didn't list: %v", err)
	}
	if got, _ := a.TidyUp(); len(got.Today) != 1 || got.Today[0].Title != "Heat (1995)" {
		t.Errorf("today: %+v", got.Today)
	}
	if _, err := a.TidySetInbox(nil, "daily"); err == nil {
		t.Error("no folder at all was taken")
	}
	if _, err := a.TidySetInbox([]string{downloads}, "hourly"); err == nil {
		t.Error("an unknown when was taken")
	}
	saved := directoryDialog
	defer func() { directoryDialog = saved }()
	var title string
	directoryDialog = func(_ context.Context, o runtime.OpenDialogOptions) (string, error) {
		title = o.Title
		return "/picked", nil
	}
	if p, err := a.TidyPickFolder(); err != nil || p != "/picked" || title != "Choose a folder for Tidy Up to watch" {
		t.Errorf("picker: %q %v %q", p, err, title)
	}
}

// Where should your libraries live?: each drive with where the libraries
// would go on it (a Media folder in the home folder on this computer's own
// disk), the libraries already there, the one Duplicati backs up to, and
// the one they're on now; a drive's libraries one by one, a Calibre
// library said; and the choice kept in .env, its folder made.
func TestTidyPicksWhereTheLibrariesLive(t *testing.T) {
	a, _ := testApp(t)
	home, _ := os.UserHomeDir()
	vols := t.TempDir()
	hobbies, backup, fresh := filepath.Join(vols, "Hobbies"), filepath.Join(vols, "Backup"), filepath.Join(vols, "New")
	for _, d := range []string{"music/Artist A", "music/Artist B", "music/.hidden", "Books/Author", "movies/Heat (1995)", "tv"} {
		_ = os.MkdirAll(filepath.Join(hobbies, d), 0o755)
	}
	_ = os.WriteFile(filepath.Join(hobbies, "Books", "metadata.db"), nil, 0o644)
	_ = os.MkdirAll(filepath.Join(backup, "duplicati"), 0o755)
	_ = os.MkdirAll(fresh, 0o755)
	saved := listDrives
	defer func() { listDrives = saved }()
	listDrives = func() []diskspace.Drive {
		return []diskspace.Drive{{Path: "/", Internal: true, Free: 100, Total: 500},
			{Path: backup, Name: "Backup", Free: 1, Total: 2}, {Path: hobbies, Name: "Hobbies", Free: 3, Total: 4}, {Path: fresh, Name: "New", Free: 5, Total: 6}}
	}
	if _, err := a.SaveSettings(map[string]string{"MEDIA_ROOT": hobbies, "BACKUP_DESTINATION": filepath.Join(backup, "duplicati")}); err != nil {
		t.Fatal(err)
	}
	got := a.TidyDrives()
	if len(got) != 4 || got[0].Root != filepath.Join(home, "Media") || got[0].Current || got[0].Backups {
		t.Fatalf("this computer: %+v", got)
	}
	if !got[1].Backups || got[1].Current || got[3].Backups || len(got[3].Found) != 0 {
		t.Errorf("the backup drive, a new one: %+v %+v", got[1], got[3])
	}
	if h := got[2]; !h.Current || h.Root != hobbies || strings.Join(h.Found, ",") != "music,books,movies,tv" {
		t.Errorf("the drive they're on: %+v", h)
	}
	place, err := a.TidyPlace(hobbies)
	if err != nil {
		t.Fatal(err)
	}
	shelf := map[string]TidyPlaceShelf{}
	for _, s := range place.Libraries {
		shelf[s.Kind] = s
	}
	if m := shelf["music"]; !m.Found || m.Items != 2 || m.Folder != filepath.Join(hobbies, "music") {
		t.Errorf("music: %+v", m)
	}
	if b := shelf["books"]; !b.Calibre || b.Items != 1 {
		t.Errorf("books: %+v", b)
	}
	if ab := shelf["audiobooks"]; ab.Found || ab.Items != 0 {
		t.Errorf("audiobooks, new: %+v", ab)
	}
	if _, err := a.TidyPlace("relative/folder"); err == nil {
		t.Error("a folder that isn't a whole path")
	}
	up, err := a.TidySetMediaRoot(filepath.Join(home, "Media"))
	if err != nil {
		t.Fatal(err)
	}
	if fi, err := os.Stat(filepath.Join(home, "Media")); err != nil || !fi.IsDir() || core.Env(a.root)["MEDIA_ROOT"] != filepath.Join(home, "Media") || up.MediaRoot != filepath.Join(home, "Media") {
		t.Errorf("kept: %v %q %q", err, core.Env(a.root)["MEDIA_ROOT"], up.MediaRoot)
	}
	if _, err := a.TidySetMediaRoot(filepath.Join(vols, "Unplugged", "Media")); err == nil || !strings.Contains(err.Error(), "plug in") {
		t.Errorf("a drive that isn't there: %v", err)
	}
	if _, err := a.TidySetMediaRoot("Media"); err == nil {
		t.Error("a folder that isn't a whole path")
	}
	sd := directoryDialog
	defer func() { directoryDialog = sd }()
	var title string
	directoryDialog = func(_ context.Context, o runtime.OpenDialogOptions) (string, error) {
		title = o.Title
		return "/picked", nil
	}
	if p, _ := a.TidyPickMediaFolder(); p != "/picked" || title != "Choose the folder for your libraries" {
		t.Errorf("picker: %q %q", p, title)
	}
}

// vid and show are a download's whole path on this system (Needs a look's
// name and leave take only whole paths; /d/vid.mkv isn't one on Windows).
var vid, show = func() (string, string) {
	if goruntime.GOOS == "windows" {
		return `C:\d\vid.mkv`, `C:\d\show`
	}
	return "/d/vid.mkv", "/d/show"
}()
