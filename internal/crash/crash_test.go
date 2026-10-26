package crash

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// crashDir set: this test binary is the process that crashes, in a
// goroutine of its own, as the agent's parts and the app's run.
func TestMain(m *testing.M) {
	if dir := os.Getenv("CRASH_TEST_DIR"); dir != "" {
		if err := Watch(dir, "agent", "0.9.7-beta"); err != nil {
			panic(err)
		}
		done := make(chan struct{})
		go func() {
			defer close(done)
			watchdogRun()
		}()
		<-done
		return
	}
	os.Exit(m.Run())
}

// watchdogRun stands for the part that crashes.
func watchdogRun() {
	var m map[string]int
	m["checks"]++ // a nil map: a panic no one recovers
}

func TestACrashIsKept(t *testing.T) {
	dir := t.TempDir()
	cmd := exec.Command(os.Args[0], "-test.run=^$")
	cmd.Env = append(os.Environ(), "CRASH_TEST_DIR="+dir)
	if err := cmd.Run(); err == nil {
		t.Fatal("the process should have crashed")
	}
	c, ok := Newest(dir)
	if !ok {
		files, _ := os.ReadDir(dir)
		t.Fatalf("no crash saved; the folder has %v", files)
	}
	if c.Who != "the background agent" || c.Version != "0.9.7-beta" || time.Since(c.When) > time.Minute {
		t.Errorf("crash %+v", c)
	}
	if !strings.Contains(c.Doing, "watchdogRun") {
		t.Errorf("what it was doing: %q", c.Doing)
	}
	if !strings.HasPrefix(c.File, "scripts/logs/crash-") || !strings.HasSuffix(c.File, ".log") {
		t.Errorf("file %q", c.File)
	}
	data, _ := os.ReadFile(filepath.Join(dir, filepath.Base(c.File)))
	for _, want := range []string{"== the background agent 0.9.7-beta", "stopped unexpectedly", "assignment to entry in nil map", "goroutine "} {
		if !strings.Contains(string(data), want) {
			t.Errorf("the crash log has no %q:\n%s", want, data)
		}
	}
	if files, _ := filepath.Glob(filepath.Join(dir, "*.pending")); len(files) != 0 {
		t.Errorf("a saved crash leaves no pending file: %v", files)
	}
}

func TestANormalRunLeavesNoCrash(t *testing.T) {
	dir := t.TempDir()
	// A run still going (or one that ended normally): its header alone.
	if err := os.WriteFile(pending(dir, "app"), []byte("== the app 0.9.7-beta, started 2026-10-26T09:00:00Z, process 1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if c, ok := Newest(dir); ok {
		t.Errorf("no crash happened, but Newest says %+v", c)
	}
	if _, err := os.Stat(pending(dir, "app")); err != nil {
		t.Error("the running app's file was taken away")
	}
}

func TestNewestIsTheLastOfTheNewestDay(t *testing.T) {
	dir := t.TempDir()
	day := func(name, who, when string) {
		body := "== " + who + " 0.9.6-beta, started " + when + ", process 2\nstopped unexpectedly " + when + "\n\npanic: x\n"
		f, _ := os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		f.WriteString(body)
		f.Close()
	}
	day("crash-2026-10-24.log", "the app", "2026-10-24T08:00:00Z")
	day("crash-2026-10-25.log", "the background agent", "2026-10-25T03:30:00Z")
	day("crash-2026-10-25.log", "the menu bar item", "2026-10-25T21:15:00Z")
	c, ok := Newest(dir)
	if !ok || c.Who != "the menu bar item" || c.When.Format(time.RFC3339) != "2026-10-25T21:15:00Z" {
		t.Errorf("newest = %+v, %v", c, ok)
	}
}
