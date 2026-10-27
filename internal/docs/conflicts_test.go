package docs

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCheckConflictsFindsWhatAMergeLeft(t *testing.T) {
	root := t.TempDir()
	write := func(rel, content string) {
		p := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("docs/Testing.md", "# Testing\n\nBefore\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> origin/main\nAfter\n")
	// A Setext heading's underline and markers inside a line are not merges.
	write("docs/Clean.md", "Title\n=======\n\nText with <<<<<<< inside.\n")
	write("compose/media.yaml", "services:\n<<<<<<< HEAD\n  a: {}\n")
	write("docs/notes.txt", "<<<<<<< HEAD\n") // not a kind a merge is checked in
	issues := CheckConflicts(root, "docs", "compose", "absent.md")
	if len(issues) != 3 {
		t.Fatalf("want 3 lines, got %v", issues)
	}
	for i, want := range []Issue{
		{"docs/Testing.md", "line 4 is left from a merge conflict: <<<<<<< HEAD"},
		{"docs/Testing.md", "line 8 is left from a merge conflict: >>>>>>> origin/main"},
		{"compose/media.yaml", "line 2 is left from a merge conflict: <<<<<<< HEAD"},
	} {
		if issues[i] != want {
			t.Errorf("issue %d: %+v, want %+v", i, issues[i], want)
		}
	}
}
