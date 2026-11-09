package media

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Removing the extra copies leaves a line in Recently done; finding none leaves none.
func TestDescribeDedupe(t *testing.T) {
	text, sub := Describe("movies", Run{Action: "dedupe", OK: true, Result: map[string]any{"removed": float64(3), "freed": float64(13e9)}})
	if text != "Extra copies in the Trash" || sub != "3 copies · 13 GB freed" {
		t.Errorf("got %q, %q", text, sub)
	}
	if text, _ := Describe("tv", Run{Action: "dedupe", OK: true, Result: map[string]any{"removed": float64(0)}}); text != "" {
		t.Errorf("nothing removed: %q", text)
	}
	if text, sub := Describe("tv", Run{Action: "posters", OK: true, Result: map[string]any{"asked": float64(2)}}); text != "Posters asked of Jellyfin" || sub != "2 shows · they show as Jellyfin finds them" {
		t.Errorf("posters: %q, %q", text, sub)
	}
}

// A run notes what it put in the Trash under its id; its line offers Undo,
// which a Tdarr copy's original never does; putting it back takes Undo away.
func TestUndoFromTheTrash(t *testing.T) {
	j := fakeJob(t, "scrubber", "scan", []string{`{"type":"result","action":"scrub","ok":true,"applied":true,"files":3,"folders":0}`}, 0)
	_ = os.MkdirAll(j.Root+"/data", 0o755)
	t.Setenv("TIDY_FAKE_THROW", "3")
	run, err := Execute(context.Background(), j)
	if err != nil || !strings.HasPrefix(run.ID, "scrubber-scan-") || run.Back != 2 {
		t.Fatalf("%+v %v (two of three can be put back)", run, err)
	}
	if all, back := Thrown(j.Root, run.ID); all != 3 || back != 2 {
		t.Errorf("thrown %d, back %d", all, back)
	}
	if all, _ := Thrown(j.Root, "another"); all != 0 {
		t.Error("another run's")
	}
	var r Record
	r.Note("scrubber", run)
	if len(r.Activity) != 1 || r.Activity[0].Undo != run.ID {
		t.Fatalf("%+v", r.Activity)
	}
	r.Note("movies", Run{Action: "collect", OK: true, At: time.Now(), ID: "m", Back: 4, Result: map[string]any{"replaced": float64(4), "freed": float64(1e9)}})
	if r.Activity[1].Undo != "" {
		t.Error("a shrunk film's original can't go back: the copy has its name")
	}
	r.Note("trash", Run{Action: "restore", OK: true, At: time.Now(), Result: map[string]any{"run": run.ID, "restored": float64(2)}})
	if r.Activity[0].Undo != "" || r.Activity[2].Text != "Put back from the Trash" || r.Activity[2].Sub != "2 things where they were" {
		t.Errorf("%+v", r.Activity)
	}
}

// Nov 8, the owner: Recent said "Movies: collect stopped · The log says
// why" every five minutes while Tdarr was paused on battery. A run that
// fails keeps the engine's own reason, and Recent shows it; the background
// collect that fails makes no line at all (the Movies and TV tabs say
// Tdarr isn't answering instead); Make a Calibre library is described.
func TestDescribeSaysWhy(t *testing.T) {
	if text, sub := Describe("books", Run{Action: "review", Exit: 1, Why: "Calibre is open"}); text != "Books: review stopped" || sub != "Calibre is open" {
		t.Errorf("with why: %q · %q", text, sub)
	}
	if _, sub := Describe("books", Run{Action: "review", Exit: 1}); sub != "The log says why" {
		t.Errorf("without: %q", sub)
	}
	for _, kind := range []string{"movies", "tv"} {
		if text, _ := Describe(kind, Run{Action: "collect", Exit: 1, Why: "Tdarr isn't answering"}); text != "" {
			t.Errorf("%s collect stopped: %q", kind, text)
		}
	}
	if text, sub := Describe("books", Run{Action: "build", OK: true, Result: map[string]any{"applied": true, "added": 301.0, "books": 301.0}}); text != "Calibre library made" || sub != "301 books" {
		t.Errorf("build: %q · %q", text, sub)
	}
	if text, _ := Describe("books", Run{Action: "build", OK: true, Result: map[string]any{"applied": false, "books": 301.0}}); text != "" {
		t.Errorf("a look is no line: %q", text)
	}
}

// What I did today reads the inbox's record (data/media-filed.jsonl): the
// day's lines, newest first, each marked once Undo put it back; an older
// day's and a line that isn't JSON are passed over. An inbox undo runs
// inbox.py undo <id>, with the record's place in its environment.
func TestFiledToday(t *testing.T) {
	root := t.TempDir()
	_ = os.MkdirAll(filepath.Join(root, "data"), 0o755)
	now := time.Date(2026, 11, 8, 15, 0, 0, 0, time.Local)
	lines := []string{
		`{"id":"a","kind":"movies","title":"Heat (1995)","where":"Movies › Heat (1995)","did":["renamed and filed"],"from":"/d/Heat.mkv","files":["/m/Heat (1995).mkv"],"undo":true,"run":"r1","at":"2026-11-07T21:00:00"}`,
		`{"id":"b","kind":"music","title":"Album · Artist","where":"Music › Artist › Album","did":["2 songs, tags cleaned"],"from":"/d/Album","files":["/l/1.m4a"],"undo":true,"run":"r2","at":"2026-11-08T09:41:00"}`,
		`not json`,
		`{"id":"c","kind":"tv","title":"Show · 2 episodes","where":"TV › Show › Season 03","did":["renamed and filed"],"from":"/d/Show","files":["/t/1.mkv"],"undo":true,"run":"r3","at":"2026-11-08T10:30:00"}`,
		`{"undone":"b","title":"Album · Artist","run":"r4","at":"2026-11-08T11:00:00"}`,
	}
	if err := os.WriteFile(FiledLogPath(root), []byte(strings.Join(lines, "\n")+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	got := FiledToday(root, now)
	if len(got) != 2 || got[0].ID != "c" || got[1].ID != "b" || got[0].Undone || !got[1].Undone || got[0].Where != "TV › Show › Season 03" || got[1].Did[0] != "2 songs, tags cleaned" {
		t.Errorf("today: %+v", got)
	}
	if len(FiledToday(t.TempDir(), now)) != 0 {
		t.Error("no record, nothing")
	}
	if text, _ := Describe("inbox", Run{Action: "undo", OK: true}); text != "Put back where it came from" {
		t.Errorf("undo's line: %q", text)
	}
	a, err := Lookup("inbox", "undo")
	if err != nil || !a.Lock || a.Script != "inbox.py" {
		t.Fatalf("inbox undo: %+v %v", a, err)
	}
	_ = os.MkdirAll(ToolsDir(root), 0o755)
	_ = os.WriteFile(filepath.Join(ToolsDir(root), "inbox.py"), nil, 0o644)
	argv, err := Job{Root: root, Kind: "inbox", Action: "undo", Args: []string{"c"}, Python: []string{"py"}}.Command()
	if err != nil || !strings.Contains(strings.Join(argv, " "), "inbox.py undo c --config") {
		t.Errorf("undo argv: %v %v", argv, err)
	}
}
