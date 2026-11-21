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
	// SABnzbd's sabnzbd.ini: the key under [misc], not another section's.
	write("sabnzbd.ini", "__version__ = 19\n[misc]\nport = 8080\napi_key = sab-key\nnzb_key = not-this\n[servers]\n[[news]]\napi_key = nor-this\n")
	if got, err := KeptKey(dir, "sabnzbd.ini"); err != nil || got != "sab-key" {
		t.Errorf("sabnzbd.ini: %q %v, want sab-key", got, err)
	}
	write("other.ini", "[servers]\napi_key = nor-this\n")
	if _, err := KeptKey(dir, "other.ini"); err == nil {
		t.Error("an .ini with no key under [misc] says so")
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
