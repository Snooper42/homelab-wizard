package media

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFollowReadsTheLastStepAndBarOfAJobAnotherProcessRuns(t *testing.T) {
	root := t.TempDir()
	dir := LogDir(root)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	log := filepath.Join(dir, "movies-collect-20261106-140200.jsonl")
	lines := []string{
		`{"type":"step","n":1,"total":2,"text":"Asking Tdarr what it finished"}`,
		`{"type":"progress","label":"Films","done":3,"total":9}`,
		`not an event`,
		`{"type":"step","n":2,"total":2,"text":"Swapping in the smaller copies"}`,
		`{"type":"ok","text":"Heat (1995) swapped in"}`,
		`{"type":"progress","label":"Films","done":1,"total":4,"note":"Heat (1995)","eta":120}`,
	}
	if err := os.WriteFile(log, []byte(strings.Join(lines, "\n")+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	f := Follow(root, Lock{Kind: "movies", Action: "collect", Log: log})
	if f.Step == nil || f.Step.N != 2 || f.Step.Text != "Swapping in the smaller copies" {
		t.Fatalf("step: %+v", f.Step)
	}
	if f.Progress == nil || f.Progress.Done != 1 || f.Progress.Total != 4 || f.Progress.Note != "Heat (1995)" || f.Progress.ETA != 120 {
		t.Fatalf("progress: %+v", f.Progress)
	}

	// A new step with no bar yet: the bar of the step before is not shown with it.
	if err := os.WriteFile(log, []byte(strings.Join(lines[:4], "\n")+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if f := Follow(root, Lock{Log: log}); f.Step == nil || f.Step.N != 2 || f.Progress != nil {
		t.Fatalf("a new step keeps the old bar: %+v %+v", f.Step, f.Progress)
	}
}

func TestFollowReadsOnlyTidyUpsOwnLogs(t *testing.T) {
	root := t.TempDir()
	other := filepath.Join(root, "elsewhere.jsonl")
	if err := os.WriteFile(other, []byte(`{"type":"step","n":1,"total":1,"text":"x"}`+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, l := range []Lock{{}, {Log: other}, {Log: filepath.Join(LogDir(root), "..", "elsewhere.jsonl")}, {Log: filepath.Join(LogDir(root), "missing.jsonl")}} {
		if f := Follow(root, l); f.Step != nil || f.Progress != nil {
			t.Errorf("%q was read: %+v", l.Log, f)
		}
	}
}

func TestFollowReadsTheEndOfALongLog(t *testing.T) {
	root := t.TempDir()
	dir := LogDir(root)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	log := filepath.Join(dir, "music-run-20261106-140200.jsonl")
	var b strings.Builder
	b.WriteString(`{"type":"step","n":2,"total":5,"text":"Matching albums"}` + "\n")
	for b.Len() < 2*followTail {
		b.WriteString(`{"type":"info","text":"` + strings.Repeat("a", 200) + `"}` + "\n")
	}
	b.WriteString(`{"type":"progress","label":"Albums","done":4812,"total":7233}` + "\n")
	if err := os.WriteFile(log, []byte(b.String()), 0o644); err != nil {
		t.Fatal(err)
	}
	f := Follow(root, Lock{Log: log})
	if f.Progress == nil || f.Progress.Done != 4812 {
		t.Fatalf("progress: %+v", f.Progress)
	}
	// The step is further back than the end that is read: the bar shows without it.
	if f.Step != nil {
		t.Fatalf("step from beyond the tail: %+v", f.Step)
	}
}
