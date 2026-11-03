package main

import (
	"encoding/json"
	"os"
	"path/filepath"
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
	} {
		got, err := tidyArgs(c.kind, c.action, c.args, c.yes)
		if err != nil || strings.Join(got, " ") != c.want {
			t.Errorf("%s %s: %v %v", c.kind, c.action, got, err)
		}
	}
	if _, err := tidyArgs("music", "rm-rf", nil, false); err == nil {
		t.Error("an action the engines don't have")
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
