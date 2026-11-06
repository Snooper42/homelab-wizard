package sso

import (
	"os"
	"path/filepath"
	"testing"
)

// An app's sign-in settings are replaced whole, never rewritten in place:
// Compose reads them at each up, and one read half-written starts the app
// without sign-in, or not at all. Still only this user's.
func TestSignInSettingsAreReplacedWhole(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "sso", "vikunja.env")
	if err := WriteEnv(path, map[string]string{"A": "1"}); err != nil {
		t.Fatal(err)
	}
	was, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := WriteEnv(path, map[string]string{"A": "1", "B": "2"}); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("the sign-in settings were rewritten in place")
	}
	if os.PathSeparator == '/' && now.Mode().Perm() != 0o600 {
		t.Errorf("mode %v, not 0600", now.Mode().Perm())
	}
}
