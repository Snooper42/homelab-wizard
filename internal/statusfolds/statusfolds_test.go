package statusfolds

import (
	"os"
	"runtime"
	"strings"
	"testing"
)

// The groups folded on Status are one record on the computer, so the app,
// the phone's page and the iPhone app show the same (the owner, Nov 10:
// "I would like it if they synced up"). Saved whole, as the device sent
// them; what isn't a group's name (too long, control characters, too
// many) is refused, and the file is the household's alone.
func TestFoldsAreKeptWhole(t *testing.T) {
	root := t.TempDir()
	if got := Load(root); len(got) != 0 {
		t.Fatalf("none yet: %v", got)
	}
	if err := Save(root, map[string]bool{"Media": false, "Photos": true}); err != nil {
		t.Fatal(err)
	}
	if got := Load(root); len(got) != 2 || got["Media"] || !got["Photos"] {
		t.Errorf("kept: %v", got)
	}
	// Fold them again: back to the defaults, everywhere.
	if err := Save(root, map[string]bool{}); err != nil {
		t.Fatal(err)
	}
	if got := Load(root); len(got) != 0 {
		t.Errorf("cleared: %v", got)
	}
	if runtime.GOOS != "windows" {
		_ = Save(root, map[string]bool{"Media": false})
		if fi, err := os.Stat(Path(root)); err != nil || fi.Mode().Perm() != 0o600 {
			t.Errorf("mode: %v %v", fi.Mode(), err)
		}
	}
	for name, bad := range map[string]map[string]bool{
		"empty name":    {"": true},
		"too long":      {strings.Repeat("a", 65): true},
		"control chars": {"Media\n": true},
		"too many":      many(65),
	} {
		if err := Save(root, bad); err == nil {
			t.Errorf("%s: saved", name)
		}
	}
	if got := Load(root); len(got) != 1 || got["Media"] {
		t.Errorf("a refused save changed it: %v", got)
	}
	// A record that can't be read is none, not an error on Status.
	_ = os.WriteFile(Path(root), []byte("{not json"), 0o600)
	if got := Load(root); len(got) != 0 {
		t.Errorf("unreadable: %v", got)
	}
}

func many(n int) map[string]bool {
	m := map[string]bool{}
	for i := range n {
		m["Group "+strings.Repeat("x", i%10)+string(rune('A'+i%26))+string(rune('a'+i/26))] = true
	}
	return m
}
