//go:build forreal

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// The accent picked in GNOME's settings, set for real through gsettings
// (its schema and a keyfile of the test's own, since the runner's GNOME
// is older than accent colours), and KDE's from its kdeglobals.
func TestAccentReadForReal(t *testing.T) {
	run := func(name string, args ...string) {
		t.Helper()
		if out, err := exec.Command(name, args...).CombinedOutput(); err != nil {
			t.Fatalf("%s %s: %v\n%s", name, strings.Join(args, " "), err, out)
		}
	}
	dir := t.TempDir()
	schema := `<schemalist><enum id="org.gnome.desktop.interface.AccentColor">
<value nick="blue" value="0"/><value nick="teal" value="1"/><value nick="green" value="2"/><value nick="yellow" value="3"/>
<value nick="orange" value="4"/><value nick="red" value="5"/><value nick="pink" value="6"/><value nick="purple" value="7"/><value nick="slate" value="8"/>
</enum><schema id="org.gnome.desktop.interface" path="/org/gnome/desktop/interface/">
<key name="accent-color" enum="org.gnome.desktop.interface.AccentColor"><default>'blue'</default></key>
</schema></schemalist>`
	if err := os.WriteFile(filepath.Join(dir, "org.gnome.desktop.interface.gschema.xml"), []byte(schema), 0o644); err != nil {
		t.Fatal(err)
	}
	run("glib-compile-schemas", dir)
	t.Setenv("GSETTINGS_SCHEMA_DIR", dir)
	t.Setenv("GSETTINGS_BACKEND", "keyfile")
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("XDG_CURRENT_DESKTOP", "ubuntu:GNOME")
	if got := systemAccent(); got != nil {
		t.Errorf("GNOME's own blue reads %+v, want none", got)
	}
	run("gsettings", "set", "org.gnome.desktop.interface", "accent-color", "teal")
	if got, want := systemAccent(), gnomeAccent("'teal'"); got == nil || *got != *want {
		t.Fatalf("GNOME's teal reads %+v, want %+v", got, want)
	}

	// Plasma (SteamOS's desktop) from its own file.
	t.Setenv("XDG_CURRENT_DESKTOP", "KDE")
	kdeglobals := "[General]\nAccentColor=233,61,98\n"
	if err := os.WriteFile(filepath.Join(dir, "kdeglobals"), []byte(kdeglobals), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, want := systemAccent(), kdeAccent(kdeglobals); got == nil || want == nil || *got != *want {
		t.Fatalf("Plasma's accent reads %+v, want %+v", got, want)
	}
	if err := os.WriteFile(filepath.Join(dir, "kdeglobals"), []byte("[General]\nAccentColor=61,174,233\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := systemAccent(); got != nil {
		t.Errorf("Breeze's own blue reads %+v, want none", got)
	}
}
