package main

import (
	"strings"
	"testing"
)

// Each choice in Settings › This machine is its homelab uninstall flag, and
// none of them adds anything.
func TestUninstallArgs(t *testing.T) {
	for _, tc := range []struct {
		o    UninstallOptions
		want string
	}{
		{UninstallOptions{}, "uninstall"},
		{UninstallOptions{Data: true}, "uninstall --data"},
		{UninstallOptions{Data: true, Folder: true, Backups: true, App: true, EverythingElse: true}, "uninstall --data --folder --backups --app --everything-else"},
	} {
		if got := strings.Join(tc.o.args(), " "); got != tc.want {
			t.Errorf("%+v: %q, want %q", tc.o, got, tc.want)
		}
	}
}
