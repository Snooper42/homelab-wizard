//go:build forreal

package main

import (
	"os/exec"
	"strings"
	"testing"
)

// The accent picked in System Settings › Appearance, set for real with
// defaults (as the setting does) and read back, then put back as it was.
func TestAccentReadForReal(t *testing.T) {
	run := func(args ...string) {
		t.Helper()
		if out, err := exec.Command("defaults", args...).CombinedOutput(); err != nil {
			t.Fatalf("defaults %s: %v\n%s", strings.Join(args, " "), err, out)
		}
	}
	before, err := exec.Command("defaults", "read", "-g", "AppleAccentColor").Output()
	t.Cleanup(func() {
		if err != nil {
			_ = exec.Command("defaults", "delete", "-g", "AppleAccentColor").Run()
		} else {
			run("write", "-g", "AppleAccentColor", "-int", strings.TrimSpace(string(before)))
		}
	})
	for _, v := range []string{"3", "-1"} {
		run("write", "-g", "AppleAccentColor", "-int", v)
		got, want := systemAccent(), macAccent(v)
		if got == nil || *got != *want {
			t.Fatalf("accent %s reads %+v, want %+v", v, got, want)
		}
	}
	_ = exec.Command("defaults", "delete", "-g", "AppleAccentColor").Run()
	if got := systemAccent(); got != nil {
		t.Errorf("with no accent set (Multicolor) it reads %+v, want none", got)
	}
}
