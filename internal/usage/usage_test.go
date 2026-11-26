package usage

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

func TestMemBytes(t *testing.T) {
	for in, want := range map[string]float64{
		"12.5MiB": 12.5 * (1 << 20), "1.5GiB": 1.5 * (1 << 30), "512KiB": 512 << 10, "0B": 0, "100B": 100,
		"2GB": 2e9, "3.5MB": 3.5e6, "10kB": 1e4, " 7MiB ": 7 << 20, "": 0, "n/a": 0, "2TiB": 2 * (1 << 40),
	} {
		if got := MemBytes(in); got != want {
			t.Errorf("%q: %v, want %v", in, got, want)
		}
	}
}

func TestFromStats(t *testing.T) {
	r := FromStats([]docker.Stat{{Name: "immich-server", CPU: 12.5, Mem: "1GiB"}, {Name: "immich-server", CPU: 1, Mem: "1GiB"}, {Name: "vaultwarden", CPU: 0.04, Mem: "20MiB"}})
	if len(r) != 2 || r["immich-server"].CPU != 13.5 || r["immich-server"].Mem != 2<<30 || r["vaultwarden"].Mem != 20<<20 {
		t.Errorf("%+v", r)
	}
}

// Lane D, D2: one sample every 5 minutes, kept 31 days, read back oldest first in Day, Week and Month.
func TestRecordAndRead(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "usage-history.json")
	if h, err := Read(path, time.Now(), 1); err != nil || len(h.At) != 0 || h.Apps == nil || h.Jobs == nil || h.CPU == nil || h.Mem == nil {
		t.Fatalf("no file yet: %+v %v", h, err)
	}
	start := time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)
	// 40 days of samples, every 5 minutes; Jellyfin only from day 35.
	var at time.Time
	for i := 0; i < 40*288; i++ {
		at = start.Add(time.Duration(i) * Every)
		apps := map[string]Reading{"immich-server": {CPU: 10, Mem: 1 << 30}, "vaultwarden": {CPU: 1, Mem: 20 << 20}}
		if at.After(start.AddDate(0, 0, 35)) {
			apps["jellyfin"] = Reading{CPU: 50, Mem: 2 << 30}
		}
		if err := Record(path, at, apps); err != nil {
			t.Fatal(err)
		}
		if i > 300 && i < 32*288 {
			i += 20 // keep the test quick: a sample every 105 minutes before the last 8 days
		}
	}
	if err := RecordJob(path, "backup", at.Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := RecordJob(path, "update", start); err != nil { // older than a month: dropped at the next sample
		t.Fatal(err)
	}
	if err := Record(path, at.Add(Every), map[string]Reading{"vaultwarden": {CPU: 2, Mem: 30 << 20}}); err != nil {
		t.Fatal(err)
	}
	now := at.Add(Every)

	info, _ := os.Stat(path)
	if info.Size() > 3<<20 {
		t.Errorf("the file is %d bytes", info.Size())
	}

	month, err := Read(path, now, 31)
	if err != nil {
		t.Fatal(err)
	}
	if len(month.At) == 0 || len(month.At) > MaxPoints || len(month.CPU) != len(month.At) || len(month.Mem) != len(month.At) {
		t.Fatalf("month: %d points, %d cpu, %d mem", len(month.At), len(month.CPU), len(month.Mem))
	}
	first, _ := time.Parse(time.RFC3339, month.At[0])
	if now.Sub(first) > Keep {
		t.Errorf("the month starts %s, more than 31 days before %s", first, now)
	}
	for i := 1; i < len(month.At); i++ {
		if month.At[i] < month.At[i-1] {
			t.Fatalf("not oldest first at %d: %s %s", i, month.At[i-1], month.At[i])
		}
	}
	for id, s := range month.Apps {
		if len(s.CPU) != len(month.At) || len(s.Mem) != len(month.At) {
			t.Errorf("%s: %d cpu, %d mem for %d points", id, len(s.CPU), len(s.Mem), len(month.At))
		}
	}
	if len(month.Jobs) != 1 || month.Jobs[0].Name != "backup" {
		t.Errorf("jobs: %+v", month.Jobs)
	}

	day, err := Read(path, now, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(day.At) != 289 { // the last day's 288, and the last sample
		t.Errorf("a day: %d points", len(day.At))
	}
	last := len(day.At) - 1
	if day.CPU[last] != 2 || day.Mem[last] != 30<<20 || day.Apps["vaultwarden"].CPU[last] != 2 || day.Apps["jellyfin"].CPU[last] != 0 {
		t.Errorf("the last sample: cpu %v mem %v apps %+v", day.CPU[last], day.Mem[last], day.Apps["jellyfin"].CPU[last])
	}
	if day.CPU[0] != 61 || day.Mem[0] != (1<<30)+(20<<20)+(2<<30) {
		t.Errorf("the first sample of the day: cpu %v mem %v", day.CPU[0], day.Mem[0])
	}
	if _, ok := day.Apps["immich-server"]; !ok {
		t.Error("Immich is gone from the day")
	}
	if day.At[last] != now.Format(time.RFC3339) {
		t.Errorf("last at %s, want %s", day.At[last], now.Format(time.RFC3339))
	}

	// A week is averaged down to at most MaxPoints.
	week, _ := Read(path, now, 7)
	if len(week.At) > MaxPoints || len(week.At) < MaxPoints/2 {
		t.Errorf("a week: %d points", len(week.At))
	}
}

// A file the agent can't read (cut short, or an older shape) starts again rather than stopping the samples.
func TestRecordOverABrokenFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "usage-history.json")
	os.WriteFile(path, []byte(`{"at":[1,2`), 0o600)
	if _, err := Read(path, time.Now(), 1); err == nil {
		t.Error("a broken file reads")
	}
	now := time.Now()
	if err := Record(path, now, map[string]Reading{"a": {CPU: 1, Mem: 1}}); err != nil {
		t.Fatal(err)
	}
	if h, err := Read(path, now, 1); err != nil || len(h.At) != 1 {
		t.Errorf("%+v %v", h, err)
	}
	// Arrays of the wrong length (a file edited by hand) are evened up, not read past.
	os.WriteFile(path, []byte(`{"at":[`+itoa(now.Unix()-60)+`,`+itoa(now.Unix())+`],"cpu":[1],"mem":[],"apps":{"a":{"cpu":[1,2,3],"mem":[1]}}}`), 0o600)
	h, err := Read(path, now, 1)
	if err != nil || len(h.CPU) != 2 || len(h.Mem) != 2 || len(h.Apps["a"].CPU) != 2 || len(h.Apps["a"].Mem) != 2 {
		t.Errorf("uneven: %+v %v", h, err)
	}
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }
