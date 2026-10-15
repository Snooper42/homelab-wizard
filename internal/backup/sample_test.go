package backup

import (
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSampleFiles(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	file := func(rel string, size int, age time.Duration) {
		p := filepath.Join(root, rel)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, make([]byte, size), 0o644); err != nil {
			t.Fatal(err)
		}
		_ = os.Chtimes(p, now.Add(-age), now.Add(-age))
	}
	old := 72 * time.Hour
	for i := 0; i < 5; i++ {
		file(filepath.Join("vikunja", "files", string(rune('a'+i))+".txt"), 10, old)
		file(filepath.Join("mealie", "recipes", string(rune('a'+i))+".json"), 10, old)
	}
	file("grocy/data/grocy.db", 10, old)
	file("grocy/data/grocy.db-wal", 10, old)           // live side file
	file("grocy/data/new.txt", 10, time.Hour)          // changed today
	file("grocy/data/empty.txt", 0, old)               // empty
	file("grocy/cache/x.bin", 10, old)                 // a cache
	file("duplicati/Duplicati-server.sqlite", 10, old) // skipped top-level folder
	file("loose.txt", 10, old)                         // not inside an app folder

	got, err := SampleFiles(root, 6, now, rand.New(rand.NewSource(1)), "duplicati")
	if err != nil || len(got) != 6 {
		t.Fatalf("sample: %v %v", err, got)
	}
	tops := map[string]int{}
	for _, f := range got {
		tops[strings.SplitN(f, "/", 2)[0]]++
		for _, bad := range []string{"-wal", "new.txt", "empty", "cache", "duplicati", "loose"} {
			if strings.Contains(f, bad) {
				t.Errorf("picked %s", f)
			}
		}
	}
	if len(tops) != 3 || tops["grocy"] != 1 {
		t.Errorf("should spread across the three app folders: %v", got)
	}
	all, _ := SampleFiles(root, 100, now, rand.New(rand.NewSource(1)), "duplicati")
	if len(all) != 11 {
		t.Errorf("all eligible files: %d %v", len(all), all)
	}
}
