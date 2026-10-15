package backup

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRestoreReminder(t *testing.T) {
	now := time.Date(2026, 10, 10, 4, 30, 0, 0, time.UTC)
	var l RestoreLog
	if !l.ReminderDue(now) {
		t.Fatal("never tested: a reminder is due")
	}
	l.LastReminder = now.Add(-2 * 24 * time.Hour)
	if l.ReminderDue(now) {
		t.Fatal("reminded two days ago: wait")
	}
	l = RestoreLog{LastTest: now.Add(-10 * 24 * time.Hour)}
	if l.ReminderDue(now) {
		t.Fatal("tested ten days ago: not due")
	}
	path := filepath.Join(t.TempDir(), "restore-test.json")
	l.LastSummary = "25 of 25 files match"
	if err := l.Save(path); err != nil {
		t.Fatal(err)
	}
	if got := LoadRestoreLog(path); !got.LastTest.Equal(l.LastTest) || got.LastSummary != l.LastSummary {
		t.Fatalf("round trip %+v", got)
	}
}

func TestVaultExports(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	for name, age := range map[string]time.Duration{
		"bitwarden_encrypted_export_20260901120000.json": 39 * 24 * time.Hour,
		"bitwarden_encrypted_export_20261001120000.json": 9 * 24 * time.Hour,
		"bitwarden_export_20261002120000.json":           8 * 24 * time.Hour,
		"bitwarden_export_20261002120000.csv":            8 * 24 * time.Hour,
		"homelab.env":                                    time.Hour,
	} {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(p, now.Add(-age), now.Add(-age)); err != nil {
			t.Fatal(err)
		}
	}
	newest, plain := VaultExports(dir)
	if !newest.Equal(now.Add(-9*24*time.Hour)) || len(plain) != 2 {
		t.Fatalf("newest %v, plain %v", newest, plain)
	}
	var l RestoreLog
	if l.VaultReminderDue(newest, now) {
		t.Error("an export 9 days old is not due")
	}
	if !l.VaultReminderDue(time.Time{}, now) {
		t.Error("never exported is due")
	}
	l.LastVaultReminder = now.Add(-2 * 24 * time.Hour)
	if l.VaultReminderDue(time.Time{}, now) {
		t.Error("reminded two days ago: not again yet")
	}
}

func TestRestoreHistory(t *testing.T) {
	now := time.Date(2026, 10, 11, 9, 0, 0, 0, time.UTC)
	var l RestoreLog
	if _, failed := l.LastFailed(); failed || l.LastTook() != 0 {
		t.Fatal("an empty log has a failure or a timing")
	}
	l.Record(RestoreRun{When: now.Add(-48 * time.Hour), Seconds: 200, Passed: true, Summary: "12 of 12 sampled files identical"})
	l.Record(RestoreRun{When: now.Add(-24 * time.Hour), Passed: true, Summary: "by hand"})
	if !l.LastTest.Equal(now.Add(-24*time.Hour)) || l.LastSummary != "by hand" {
		t.Errorf("last test: %v %q", l.LastTest, l.LastSummary)
	}
	// A test made by hand has no timing; the timed one before it counts.
	if l.LastTook() != 200*time.Second {
		t.Errorf("took %v", l.LastTook())
	}
	l.Record(RestoreRun{When: now, Seconds: 30, Summary: "Duplicati's restore failed: timeout"})
	if f, failed := l.LastFailed(); !failed || f.Summary != "Duplicati's restore failed: timeout" {
		t.Errorf("failure: %+v %v", f, failed)
	}
	if !l.LastTest.Equal(now.Add(-24 * time.Hour)) {
		t.Error("a failure became the last test")
	}

	// Saved and read back; the oldest drop off past the limit.
	for i := 0; i < MaxRestoreRuns+5; i++ {
		l.Record(RestoreRun{When: now.Add(time.Duration(i) * time.Hour), Seconds: 60, Passed: true})
	}
	path := filepath.Join(t.TempDir(), "restore-test.json")
	if err := l.Save(path); err != nil {
		t.Fatal(err)
	}
	back := LoadRestoreLog(path)
	if len(back.History) != MaxRestoreRuns || !back.History[MaxRestoreRuns-1].When.Equal(now.Add(time.Duration(MaxRestoreRuns+4)*time.Hour)) {
		t.Errorf("history: %d runs, newest %v", len(back.History), back.History[len(back.History)-1].When)
	}
	if _, failed := back.LastFailed(); failed {
		t.Error("a pass after the failure still reads as failed")
	}
}
