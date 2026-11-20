package wiring

import (
	"os"
	"path/filepath"
	"testing"
)

// TestKeptKey: an app's own API key, read from the file it keeps it in:
// an *arr app's config.xml, Seerr's settings.json, Bazarr's config.yaml.
func TestKeptKey(t *testing.T) {
	dir := t.TempDir()
	write := func(name, text string) {
		p := filepath.Join(dir, name)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte(text), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write("config.xml", "<Config><Port>8989</Port><ApiKey>arr-key</ApiKey></Config>")
	write("settings.json", `{"main":{"apiKey":"seerr-key"}}`)
	write("config/config.yaml", "auth:\n  apikey: bazarr-key\n")
	for file, want := range map[string]string{"config.xml": "arr-key", "settings.json": "seerr-key", "config/config.yaml": "bazarr-key"} {
		if got, err := KeptKey(dir, file); err != nil || got != want {
			t.Errorf("%s: %q %v, want %q", file, got, err, want)
		}
	}
	if _, err := KeptKey(dir, "missing.xml"); err == nil {
		t.Error("a file the app hasn't made yet says so")
	}
	write("empty.xml", "<Config></Config>")
	if _, err := KeptKey(dir, "empty.xml"); err == nil {
		t.Error("no key in it says so")
	}
	if _, err := KeptKey(dir, "../config.xml"); err == nil {
		t.Error("nothing outside its folder is read")
	}
	if _, err := KeptKey("", "config.xml"); err == nil {
		t.Error("no folder: says so")
	}
}
