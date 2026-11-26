package appdata

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDir(t *testing.T) {
	root := t.TempDir()
	if got := Dir(root); got != filepath.Join(root, "data", "appdata") {
		t.Errorf("no .env: %s", got)
	}
	home, _ := os.UserHomeDir()
	fast := filepath.Join(t.TempDir(), "fast") // absolute on every system (a drive letter on Windows)
	for v, want := range map[string]string{
		"":            filepath.Join(root, "data", "appdata"),
		fast:          fast,
		"~/Apps":      filepath.Join(home, "Apps"),
		"./elsewhere": filepath.Join(root, "elsewhere"),
	} {
		if err := os.WriteFile(filepath.Join(root, ".env"), []byte("APPDATA_ROOT="+v+"\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		if got := Dir(root); got != want {
			t.Errorf("APPDATA_ROOT=%q: %s, want %s", v, got, want)
		}
	}
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("APPDATA_ROOT=./elsewhere\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := Path(root, "homepage", "services.yaml"); got != filepath.Join(root, "elsewhere", "homepage", "services.yaml") {
		t.Errorf("Path: %s", got)
	}
}
