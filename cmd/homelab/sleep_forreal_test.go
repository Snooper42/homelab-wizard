//go:build forreal

package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

// The sleep setting doctor warns about, changed and read back on the
// machine this runs on through each system's own tool: pmset on macOS
// and powercfg on Windows (each put back as it was), and on Linux GNOME's
// keys through gsettings and Plasma's powerdevilrc, in a settings folder
// of the test's own. CI runs it on each system's runner (go test -tags
// forreal), where sudo asks no password and the runner is an
// administrator.
func TestSleepSettingForReal(t *testing.T) {
	ctx := context.Background()
	run := func(name string, args ...string) {
		t.Helper()
		if out, err := exec.Command(name, args...).CombinedOutput(); err != nil {
			t.Fatalf("%s %s: %v\n%s", name, strings.Join(args, " "), err, out)
		}
	}
	read := func(want int) {
		t.Helper()
		got, ok := systemSleep(ctx)
		if !ok || got != want {
			t.Fatalf("the sleep setting reads %d (%v), want %d", got, ok, want)
		}
	}
	switch runtime.GOOS {
	case "darwin":
		before, ok := systemSleep(ctx)
		if !ok {
			t.Fatal("pmset -g custom has no sleep setting on power")
		}
		set := func(n int) { run("sudo", "-n", "pmset", "-c", "sleep", strconv.Itoa(n)) }
		t.Cleanup(func() { set(before) })
		set(37)
		read(37)
		set(0)
		read(0)
	case "windows":
		before, ok := systemSleep(ctx)
		if !ok {
			t.Fatal("powercfg has no sleep setting on power")
		}
		set := func(n int) { run("powercfg", "/change", "standby-timeout-ac", strconv.Itoa(n)) }
		t.Cleanup(func() { set(before) })
		set(37)
		read(37)
		set(0)
		read(0)
	case "linux":
		dir := t.TempDir()
		// GNOME's two keys, as its settings daemon's schema has them.
		schema := `<schemalist><schema id="org.gnome.settings-daemon.plugins.power" path="/org/gnome/settings-daemon/plugins/power/">
<key name="sleep-inactive-ac-type" type="s"><default>'suspend'</default></key>
<key name="sleep-inactive-ac-timeout" type="i"><default>1200</default></key>
</schema></schemalist>`
		if err := os.WriteFile(filepath.Join(dir, "org.gnome.settings-daemon.plugins.power.gschema.xml"), []byte(schema), 0o644); err != nil {
			t.Fatal(err)
		}
		run("glib-compile-schemas", dir)
		t.Setenv("GSETTINGS_SCHEMA_DIR", dir)
		t.Setenv("GSETTINGS_BACKEND", "keyfile")
		t.Setenv("XDG_CONFIG_HOME", dir)
		t.Setenv("XDG_CURRENT_DESKTOP", "ubuntu:GNOME")
		const power = "org.gnome.settings-daemon.plugins.power"
		run("gsettings", "set", power, "sleep-inactive-ac-timeout", "2220")
		read(37)
		run("gsettings", "set", power, "sleep-inactive-ac-type", "nothing")
		read(0)

		// Plasma (SteamOS's desktop) from its own file.
		t.Setenv("XDG_CURRENT_DESKTOP", "KDE")
		if err := os.WriteFile(filepath.Join(dir, "powerdevilrc"), []byte("[AC][SuspendAndShutdown]\nAutoSuspendAction=1\nAutoSuspendIdleTimeoutSec=1500\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		read(25)
	default:
		t.Fatalf("no sleep setting to read on %s", runtime.GOOS)
	}
}
