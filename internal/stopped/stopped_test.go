package stopped

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestParseUntil(t *testing.T) {
	loc := time.FixedZone("EST", -5*3600)
	now := time.Date(2026, 11, 2, 14, 30, 0, 0, loc)
	for _, c := range []struct {
		in   string
		want time.Time
		bad  bool
	}{
		{in: "", want: time.Time{}},
		{in: "1h", want: now.Add(time.Hour)},
		{in: "90m", want: now.Add(90 * time.Minute)},
		{in: "21:00", want: time.Date(2026, 11, 2, 21, 0, 0, 0, loc)},
		{in: "8:00", want: time.Date(2026, 11, 3, 8, 0, 0, 0, loc)}, // past today: tomorrow's
		{in: "14:30", want: time.Date(2026, 11, 3, 14, 30, 0, 0, loc)},
		{in: "2026-11-03T08:00:00-05:00", want: time.Date(2026, 11, 3, 8, 0, 0, 0, loc)},
		{in: "2026-11-01T08:00:00-05:00", bad: true}, // passed
		{in: "-1h", bad: true},
		{in: "tonight", bad: true},
	} {
		got, err := ParseUntil(c.in, now)
		if c.bad {
			if err == nil {
				t.Errorf("%q: want an error, got %v", c.in, got)
			}
			continue
		}
		if err != nil || !got.Equal(c.want) {
			t.Errorf("%q: %v %v, want %v", c.in, got, err, c.want)
		}
	}
}

func TestRecord(t *testing.T) {
	path := Path(t.TempDir())
	if r := Load(path); len(r) != 0 {
		t.Fatalf("no file: %v", r)
	}
	now := time.Date(2026, 11, 2, 14, 0, 0, 0, time.UTC)
	r := Record{
		"sonarr":   {Since: now},
		"immich":   {Since: now, Until: now.Add(time.Hour)},
		"jellyfin": {Since: now, Until: now.Add(-time.Minute)},
	}
	if err := r.Save(path); err != nil {
		t.Fatal(err)
	}
	back := Load(path)
	if !slices.Equal(back.IDs(), []string{"immich", "jellyfin", "sonarr"}) || !back.Has("sonarr") || back.Has("ntfy") {
		t.Fatalf("read back: %v", back)
	}
	if !back["sonarr"].Until.IsZero() || !back["immich"].Until.Equal(now.Add(time.Hour)) {
		t.Fatalf("until: %v", back)
	}
	if data, _ := os.ReadFile(path); strings.Contains(string(data), "0001") {
		t.Fatalf("an empty until was written: %s", data)
	}
	if due := back.Due(now); !slices.Equal(due, []string{"jellyfin"}) {
		t.Fatalf("due now: %v", due)
	}
	if due := back.Due(now.Add(time.Hour)); !slices.Equal(due, []string{"immich", "jellyfin"}) {
		t.Fatalf("due in an hour: %v", due)
	}
	// Emptied, the file goes.
	if err := (Record{}).Save(path); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("an empty record left its file: %v", err)
	}
	// One that does not read is an empty record.
	os.MkdirAll(filepath.Dir(path), 0o755)
	os.WriteFile(path, []byte("not json"), 0o644)
	if r := Load(path); r == nil || len(r) != 0 {
		t.Fatalf("a bad file: %v", r)
	}
}

// Save never writes the record in place: another process reading it at that
// moment (the watchdog, the battery saver) must see the old record or the
// new one whole, never a half-written file it reads as "nothing stopped",
// which would start every app stopped on purpose. A link to the old file
// still holds the old record after a save, and the record is yours alone.
func TestSaveReplacesTheRecordWhole(t *testing.T) {
	path := Path(t.TempDir())
	now := time.Date(2026, 11, 5, 9, 0, 0, 0, time.UTC)
	if err := (Record{"sonarr": {Since: now}}).Save(path); err != nil {
		t.Fatal(err)
	}
	old := path + ".old"
	if err := os.Link(path, old); err != nil {
		t.Skipf("no hard links here: %v", err)
	}
	if err := (Record{"sonarr": {Since: now}, "radarr": {Since: now}}).Save(path); err != nil {
		t.Fatal(err)
	}
	if got := Load(old).IDs(); !slices.Equal(got, []string{"sonarr"}) {
		t.Errorf("the record was written in place: the old file now holds %v", got)
	}
	if got := Load(path).IDs(); !slices.Equal(got, []string{"radarr", "sonarr"}) {
		t.Errorf("saved %v", got)
	}
	if fi, err := os.Stat(path); err != nil || (runtimeHasModes && fi.Mode().Perm() != 0o600) {
		t.Errorf("the record's mode: %v %v, want 0600", fi.Mode().Perm(), err)
	}
	left, _ := filepath.Glob(filepath.Join(filepath.Dir(path), "*.tmp*"))
	if len(left) > 0 {
		t.Errorf("left behind: %v", left)
	}
}

// Writers at the same moment each keep their change: Update holds the
// record's lock from reading it to saving it.
func TestUpdateLosesNoChange(t *testing.T) {
	path := Path(t.TempDir())
	var wg sync.WaitGroup
	errs := make(chan error, 40)
	for i := range 40 {
		wg.Go(func() {
			errs <- Update(path, func(r Record) bool {
				r[fmt.Sprintf("app%02d", i)] = Stop{Since: time.Now()}
				return true
			})
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	if got := len(Load(path)); got != 40 {
		t.Errorf("%d of 40 stops kept", got)
	}
	if _, err := os.Stat(path + ".lock"); !os.IsNotExist(err) {
		t.Errorf("the lock was left: %v", err)
	}
}

// A lock left by a writer that died is taken over once it is stale.
func TestUpdateTakesOverAStaleLock(t *testing.T) {
	path := Path(t.TempDir())
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	if err := os.WriteFile(path+".lock", nil, 0o600); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-time.Hour)
	_ = os.Chtimes(path+".lock", old, old)
	if err := Update(path, func(r Record) bool { r["sonarr"] = Stop{Since: time.Now()}; return true }); err != nil {
		t.Fatal(err)
	}
	if !Load(path).Has("sonarr") {
		t.Error("not saved")
	}
}
