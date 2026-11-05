package updates

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

// The watchdog's look at updates, homelab update, and homelab rollback
// each read the history, work with Docker for a while, and save it. Each
// saves only the apps it changed, so another's change to another app made
// meanwhile is kept, and an app one of them stopped tracking goes.
func TestSaveChangesKeepsAnothersChange(t *testing.T) {
	path := HistoryPath(t.TempDir())
	day := time.Date(2026, 11, 5, 4, 0, 0, 0, time.UTC)
	start := History{Apps: map[string]*Record{
		"sonarr":  {Ref: "lscr.io/linuxserver/sonarr:latest", Current: "sha256:a"},
		"immich":  {Ref: "ghcr.io/immich-app/immich-server:v3", Current: "sha256:b"},
		"vikunja": {Ref: "vikunja/vikunja:latest", Current: "sha256:c"},
	}}
	if err := start.Save(path); err != nil {
		t.Fatal(err)
	}
	// Two runs read it at once.
	first, second := LoadHistory(path), LoadHistory(path)
	firstWas, secondWas := first.Clone(), second.Clone()
	first.Apps["sonarr"].Previous, first.Apps["sonarr"].Updated = "sha256:a0", day
	second.Apps["immich"].RolledBack = day
	delete(second.Apps, "vikunja")
	if err := SaveChanges(path, firstWas, first); err != nil {
		t.Fatal(err)
	}
	if err := SaveChanges(path, secondWas, second); err != nil {
		t.Fatal(err)
	}
	got := LoadHistory(path)
	if r := got.Apps["sonarr"]; r == nil || r.Previous != "sha256:a0" || !r.Updated.Equal(day) {
		t.Errorf("the first run's change was lost: %+v", r)
	}
	if r := got.Apps["immich"]; r == nil || !r.RolledBack.Equal(day) {
		t.Errorf("the second run's change was lost: %+v", r)
	}
	if _, ok := got.Apps["vikunja"]; ok {
		t.Error("an app the second run dropped is still there")
	}
	// Clone is a copy: changing it leaves the original.
	c := got.Clone()
	c.Apps["sonarr"].Previous = "x"
	if got.Apps["sonarr"].Previous == "x" {
		t.Error("Clone shares its records")
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("updates.json is %v, want 0600", info.Mode().Perm())
	}
	if left, _ := filepath.Glob(path + ".tmp*"); len(left) != 0 {
		t.Errorf("left behind: %v", left)
	}
}
