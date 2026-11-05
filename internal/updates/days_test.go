package updates

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestParseDays(t *testing.T) {
	for in, want := range map[string][]time.Weekday{
		"sun":                         {time.Sunday},
		"Sundays":                     {time.Sunday},
		"sat+sun":                     {time.Saturday, time.Sunday},
		"sunday, saturday":            {time.Saturday, time.Sunday},
		"weekend":                     {time.Saturday, time.Sunday},
		"tues":                        {time.Tuesday},
		"fri mon wed":                 {time.Monday, time.Wednesday, time.Friday},
		"every":                       nil,
		"":                            nil,
		"mon+tue+wed+thu+fri+sat+sun": nil,
	} {
		got, err := ParseDays(in)
		if err != nil || !slices.Equal(got, want) {
			t.Errorf("ParseDays(%q) = %v, %v; want %v", in, got, err, want)
		}
	}
	for _, in := range []string{"su", "funday", "sun+someday"} {
		if _, err := ParseDays(in); err == nil {
			t.Errorf("ParseDays(%q) read it as days", in)
		}
	}
}

func TestDaysKept(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "update-days.json")
	if d := LoadDays(path); len(d) != 0 || !DueOn(d, "immich", time.Saturday) {
		t.Fatalf("nothing kept: %v", d)
	}
	if err := SaveDays(path, "immich", []time.Weekday{time.Sunday}); err != nil {
		t.Fatal(err)
	}
	if err := SaveDays(path, "nextcloud", []time.Weekday{time.Sunday, time.Saturday}); err != nil {
		t.Fatal(err)
	}
	d := LoadDays(path)
	if len(d) != 2 || !slices.Equal(d["immich"], []time.Weekday{time.Sunday}) || !slices.Equal(d["nextcloud"], []time.Weekday{time.Saturday, time.Sunday}) {
		t.Fatalf("LoadDays = %v", d)
	}
	if DueOn(d, "immich", time.Saturday) || !DueOn(d, "immich", time.Sunday) || !DueOn(d, "sonarr", time.Saturday) {
		t.Error("DueOn")
	}
	if data, _ := os.ReadFile(path); !strings.Contains(string(data), `"nextcloud": [`) {
		t.Errorf("kept as:\n%s", data)
	}
	// Every night again: that app goes; the last one gone, the record too.
	if err := SaveDays(path, "immich", nil); err != nil {
		t.Fatal(err)
	}
	if d := LoadDays(path); len(d) != 1 || d["immich"] != nil {
		t.Errorf("after every night: %v", d)
	}
	if err := SaveDays(path, "nextcloud", nil); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("an empty record was kept")
	}
	// A record that does not read, or a day that is not one, is every night.
	_ = os.WriteFile(path, []byte(`{"immich": ["funday"], "x": `), 0o644)
	if d := LoadDays(path); len(d) != 0 {
		t.Errorf("a broken record read as %v", d)
	}
}

func TestDaysText(t *testing.T) {
	for want, days := range map[string][]time.Weekday{
		"every night":                     nil,
		"Sundays":                         {time.Sunday},
		"Saturdays and Sundays":           {time.Saturday, time.Sunday},
		"Mondays, Wednesdays and Fridays": {time.Monday, time.Wednesday, time.Friday},
	} {
		if got := DaysText(days); got != want {
			t.Errorf("DaysText(%v) = %q, want %q", days, got, want)
		}
	}
}
