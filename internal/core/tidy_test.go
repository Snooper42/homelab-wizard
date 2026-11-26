package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/media"
)

// Lane D, D4: Tidy Up on the phone's page, read only: what it did today, what needs a look, each library and the
// drive, and whether it's at work. No folder or file path leaves the machine, only names a household knows.
func TestTidyOverview(t *testing.T) {
	root := homelab(t, "")
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	music := filepath.Join(home, "Private", "music")
	waiting := filepath.Join(home, "Downloads", "Some.Film.2024.mkv")
	for _, d := range []string{music, filepath.Dir(waiting)} {
		os.MkdirAll(d, 0o755)
	}
	os.WriteFile(waiting, []byte("x"), 0o644)
	os.WriteFile(filepath.Join(root, ".env"), []byte("TIDY_MUSIC_LIBRARY="+music+"\nTIDY_INBOX_WHEN=daily\n"), 0o600)
	now := time.Now()
	data := filepath.Join(root, "data")
	os.MkdirAll(data, 0o755)
	at := now.Add(-time.Minute).Format("2006-01-02T15:04:05")
	filed := `{"id":"a1","kind":"movies","title":"Some Film (2024)","where":"` + filepath.ToSlash(filepath.Join(home, "Media", "movies")) + `","did":["renamed"],"from":"` + filepath.ToSlash(waiting) + `","undo":true,"at":"` + at + `"}` + "\n" +
		`{"id":"a2","kind":"music","title":"An Album","where":"x","did":["tagged"],"from":"y","undo":true,"at":"` + at + `"}` + "\n" +
		`{"undone":"a2"}` + "\n"
	os.WriteFile(media.FiledLogPath(root), []byte(filed), 0o644)
	needs, _ := json.Marshal([]media.Need{{Path: waiting, Name: "Some.Film.2024.mkv", Kind: "movies", Why: "two films match", Since: "2026-11-25"}, {Path: filepath.Join(home, "gone.mkv"), Name: "gone.mkv"}})
	os.WriteFile(media.NeedsPath(root), needs, 0o644)
	rec := media.Record{Freed: map[string]int64{"music": 1 << 30}, Last: map[string]map[string]media.Run{"inbox": {"scan": {Action: "scan", OK: true, At: now.Add(-time.Hour)}}, "music": {"verify": {Action: "verify", OK: true, At: now.Add(-2 * time.Hour)}}}}
	if err := rec.Save(root); err != nil {
		t.Fatal(err)
	}

	o := TidyOverview(root, now)
	if len(o.Today) != 2 || o.Today[0].Title == "" || o.Today[0].Kind == "" {
		t.Fatalf("today: %+v", o.Today)
	}
	undone := 0
	for _, f := range o.Today {
		if f.Undone {
			undone++
		}
	}
	if undone != 1 {
		t.Errorf("Undo put one back: %+v", o.Today)
	}
	if len(o.Needs) != 1 || o.Needs[0].Name != "Some.Film.2024.mkv" || o.Needs[0].Why != "two films match" {
		t.Errorf("needs: %+v", o.Needs)
	}
	if o.Freed != 1<<30 || len(o.Libraries) != len(media.Kinds) {
		t.Errorf("freed %d, libraries %+v", o.Freed, o.Libraries)
	}
	for _, l := range o.Libraries {
		if l.Kind == "music" && (!l.Found || l.Freed != 1<<30 || l.Last == nil || l.Last.Action != "verify" || !l.Last.OK) {
			t.Errorf("music: %+v", l)
		}
		if l.Kind == "books" && l.Found {
			t.Errorf("books found: %+v", l)
		}
	}
	if !o.Inbox.Watching || o.Inbox.When != "daily" || o.Inbox.Folders == 0 || o.Inbox.Last == nil || !o.Inbox.Last.OK {
		t.Errorf("inbox: %+v", o.Inbox)
	}
	if o.Running != nil {
		t.Errorf("at work: %+v", o.Running)
	}
	out, _ := json.Marshal(o)
	for _, leak := range []string{home, filepath.ToSlash(home), "Private", "Downloads", "TIDY_"} {
		if strings.Contains(string(out), leak) {
			t.Errorf("the phone hears %q: %s", leak, out)
		}
	}

	// A wall screen's: how many, without their names.
	wall := o.WithoutNames()
	if len(wall.Today) != 2 || wall.Today[0].Title != "" || len(wall.Needs) != 1 || wall.Needs[0].Name != "" || wall.Needs[0].Why == "" {
		t.Errorf("wall screen: %+v", wall)
	}
	if o.Today[0].Title == "" {
		t.Error("WithoutNames changed the overview it was given")
	}

	// Switched off in .env: not watching.
	os.WriteFile(filepath.Join(root, ".env"), []byte("TIDY_INBOX=off\n"), 0o600)
	if o := TidyOverview(root, now); o.Inbox.Watching || o.Inbox.When != "arrive" {
		t.Errorf("off: %+v", o.Inbox)
	}
}
