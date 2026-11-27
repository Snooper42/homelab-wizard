//go:build unix

package backup

import (
	"context"
	"errors"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

// A placeholder the cloud drive never hands over (a FIFO stands in: its
// read blocks until something writes) fails within the limit, saying so.
func TestHydrateGivesUpOnASlowFile(t *testing.T) {
	dir := t.TempDir()
	stuck := filepath.Join(dir, "duplicati-9.dblock.zip.aes")
	if err := syscall.Mkfifo(stuck, 0o600); err != nil {
		t.Fatal(err)
	}
	// FIFOs are not regular files, so the walk is given the path directly.
	start := time.Now()
	err := readWithin(context.Background(), stuck, 100*time.Millisecond)
	if !errors.Is(err, errSlow) || time.Since(start) > 5*time.Second {
		t.Fatalf("%v after %s", err, time.Since(start))
	}
	// A cancelled restore stops waiting at once.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := readWithin(ctx, stuck, time.Hour); !errors.Is(err, context.Canceled) {
		t.Errorf("cancelled: %v", err)
	}
}
