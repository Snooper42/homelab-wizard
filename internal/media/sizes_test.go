package media

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func writeFile(t *testing.T, p string, n int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, make([]byte, n), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestMeasureFolder(t *testing.T) {
	cases := []struct {
		name  string
		files map[string]int
		want  int64
	}{
		{"empty", nil, 0},
		{"files in folders", map[string]int{"A/a.flac": 100, "A/B/b.flac": 50, "c.mkv": 7}, 157},
		{"working and system folders left out", map[string]int{
			"Film/film.mkv": 10, ".tidy-staging/x.mkv": 1000, ".Trashes/501/y": 1000,
			"$RECYCLE.BIN/z": 1000, "@eaDir/t.jpg": 1000, "Film/.DS_Store": 3,
		}, 13},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := t.TempDir()
			for p, n := range c.files {
				writeFile(t, filepath.Join(dir, filepath.FromSlash(p)), n)
			}
			got, err := MeasureFolder(dir)
			if err != nil || got != c.want {
				t.Fatalf("MeasureFolder = %d, %v; want %d", got, err, c.want)
			}
		})
	}
	if _, err := MeasureFolder(filepath.Join(t.TempDir(), "unplugged")); err == nil {
		t.Fatal("a folder that isn't there measured as empty, not as missing")
	}
}

func TestMeasureFolderDoesNotFollowLinks(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlinks need an administrator or developer mode on Windows")
	}
	dir, elsewhere := t.TempDir(), t.TempDir()
	writeFile(t, filepath.Join(elsewhere, "big.mkv"), 5000)
	writeFile(t, filepath.Join(dir, "a.mkv"), 5)
	if err := os.Symlink(elsewhere, filepath.Join(dir, "linked")); err != nil {
		t.Fatal(err)
	}
	if got, _ := MeasureFolder(dir); got != 5 {
		t.Fatalf("a linked folder was counted: %d", got)
	}
}

func TestRefreshSizes(t *testing.T) {
	home, lib := t.TempDir(), t.TempDir()
	writeFile(t, filepath.Join(lib, "a.flac"), 40)
	clock := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	now := func() time.Time { return clock }
	folders := map[string]string{"music": lib, "audiobooks": filepath.Join(home, "unplugged")}

	wait := func() { sizing.Lock(); sizing.Unlock() }
	if !RefreshSizes(home, folders, time.Hour, now) {
		t.Fatal("nothing measured on the first read")
	}
	wait()
	got := LoadSizes(home)
	if got["music"].Bytes != 40 || !got["music"].At.Equal(clock) {
		t.Fatalf("music measured as %+v", got["music"])
	}
	if _, ok := got["audiobooks"]; ok {
		t.Fatal("a library that isn't there got a size")
	}

	// Fresh: nothing to do; music isn't walked again.
	writeFile(t, filepath.Join(lib, "b.flac"), 60)
	clock = clock.Add(30 * time.Minute)
	RefreshSizes(home, map[string]string{"music": lib}, time.Hour, now)
	wait()
	if LoadSizes(home)["music"].Bytes != 40 {
		t.Fatal("a fresh measure was taken again")
	}
	// Stale: measured again.
	clock = clock.Add(2 * time.Hour)
	if !RefreshSizes(home, map[string]string{"music": lib}, time.Hour, now) {
		t.Fatal("a stale measure was not refreshed")
	}
	wait()
	if LoadSizes(home)["music"].Bytes != 100 {
		t.Fatalf("music now %d", LoadSizes(home)["music"].Bytes)
	}
}
