//go:build !windows

package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRunPassesTheExitCode(t *testing.T) {
	dir := t.TempDir()
	for code, body := range map[int]string{0: "exit 0\n", 3: "exit 3\n"} {
		script := filepath.Join(dir, "job.sh")
		if err := os.WriteFile(script, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
		if got := run(script); got != code {
			t.Errorf("%q: exit %d, want %d", body, got, code)
		}
	}
	if got := run(filepath.Join(dir, "missing.cmd")); got != 1 {
		t.Errorf("a missing script: exit %d, want 1", got)
	}
}
