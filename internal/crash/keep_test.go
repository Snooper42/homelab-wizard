package crash

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// A day's crash log stays 90 days, then goes when the next crash is saved;
// other files beside them stay.
func TestOldCrashLogsGo(t *testing.T) {
	dir := t.TempDir()
	day := func(d time.Time) string { return filepath.Join(dir, "crash-"+d.Format("2006-01-02")+".log") }
	now := time.Now()
	old, recent := day(now.AddDate(0, 0, -120)), day(now.AddDate(0, 0, -10))
	other := filepath.Join(dir, "watchdog.log")
	for _, p := range []string{old, recent, other} {
		if err := os.WriteFile(p, []byte("homelab agent 0.9\nstopped unexpectedly\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(dir, "crash-agent.pending"), []byte("homelab agent 0.9.7\npanic: boom\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	Save(dir)
	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Errorf("a crash log 120 days old stayed: %v", err)
	}
	for _, p := range []string{recent, other, day(now)} {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("%s went: %v", filepath.Base(p), err)
		}
	}
}
