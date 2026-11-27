package main

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// ISSUE-0007, in doctor: a Mac with FileVault on says it waits at the unlock
// screen after a restart, what to do for a planned one, and how the owner
// hears of it (the heartbeat).
func TestAfterRestartSaysWhatHappens(t *testing.T) {
	root, _ := repoCopy(t, "HEARTBEAT_URL=https://hc-ping.com/abc")
	var out strings.Builder
	h, err := newHomelab(&ui.UI{Out: &out}, root)
	if err != nil {
		t.Fatal(err)
	}
	run := func(_ context.Context, name string, _ ...string) ([]byte, error) {
		switch name {
		case "fdesetup":
			return []byte("FileVault is On.\n"), nil
		case "pmset":
			return []byte(" autorestart          0\n"), nil
		}
		return []byte("The domain/default pair of (x, autoLoginUser) does not exist"), errors.New("exit status 1")
	}
	h.afterRestart(context.Background(), run)
	for _, want := range []string{"After a restart", "FileVault's unlock screen", "fdesetup authrestart", "presses the power button", "the heartbeat stops"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("no %q in:\n%s", want, out.String())
		}
	}

	// Logs in by itself and starts after a power cut: nothing to do, no heartbeat line.
	out.Reset()
	h.afterRestart(context.Background(), func(_ context.Context, name string, _ ...string) ([]byte, error) {
		return map[string][]byte{"fdesetup": []byte("FileVault is Off.\n"), "defaults": []byte("homelab\n"), "pmset": []byte(" autorestart 1\n")}[name], nil
	})
	if s := out.String(); !strings.Contains(s, "logs in as homelab by itself") || strings.Contains(s, "heartbeat") {
		t.Errorf("unattended:\n%s", s)
	}
}
