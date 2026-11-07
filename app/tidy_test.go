package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/media"
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
