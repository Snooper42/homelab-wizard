package media

import (
	"context"
	"os"
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
