package stopped

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
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
