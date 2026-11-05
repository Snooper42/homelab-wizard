package setup

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
)

// Steps marked done in the app while Setup is opened elsewhere (the CLI's
// homelab setup notes when it was first opened) are all kept, and the
// record is written whole, this account's alone.
func TestMarkDoneLosesNoStep(t *testing.T) {
	root := t.TempDir()
	var wg sync.WaitGroup
	for i := range 20 {
		wg.Add(2)
		go func() {
			defer wg.Done()
			if err := MarkDone(root, fmt.Sprintf("step%02d", i), true); err != nil {
				t.Error(err)
			}
		}()
		go func() {
			defer wg.Done()
			FirstSeen(root)
		}()
	}
	wg.Wait()
	if done := LoadDone(root); len(done) != 20 {
		t.Fatalf("%d of 20 steps kept: %v", len(done), done)
	}
	if Started(root).IsZero() {
		t.Error("when Setup was first opened was lost")
	}
	info, err := os.Stat(donePath(root))
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("setup.json is %v, want 0600", info.Mode().Perm())
	}
	if left, _ := filepath.Glob(donePath(root) + ".tmp*"); len(left) != 0 {
		t.Errorf("left behind: %v", left)
	}
}
