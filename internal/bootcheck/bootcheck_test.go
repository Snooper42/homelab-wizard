package bootcheck

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// fake answers as macOS's own commands do.
func fake(answers map[string]struct {
	out string
	err bool
}) Runner {
	return func(_ context.Context, name string, args ...string) ([]byte, error) {
		a, ok := answers[name]
		if !ok {
			return nil, errors.New("not found")
		}
		if a.err {
			return []byte(a.out), errors.New("exit status 1")
		}
		return []byte(a.out), nil
	}
}

type ans = struct {
	out string
	err bool
}

func TestRead(t *testing.T) {
	pmset := "System-wide power settings:\nCurrently in use:\n standby              1\n autorestart          1\n sleep                0\n"
	r := Read(context.Background(), fake(map[string]ans{
		"fdesetup": {out: "FileVault is On.\n"},
		"defaults": {out: "2026-11-27 21:00:00.000 defaults[123:456] \nThe domain/default pair of (/Library/Preferences/com.apple.loginwindow, autoLoginUser) does not exist\n", err: true},
		"pmset":    {out: pmset},
	}))
	if r != (Readings{FileVault: "on", AutoLogin: "-", AutoRestart: "on"}) {
		t.Errorf("%+v", r)
	}
	r = Read(context.Background(), fake(map[string]ans{
		"fdesetup": {out: "FileVault is Off.\n"},
		"defaults": {out: "homelab\n"},
		"pmset":    {out: strings.Replace(pmset, "autorestart          1", "autorestart          0", 1)},
	}))
	if r != (Readings{FileVault: "off", AutoLogin: "homelab", AutoRestart: "off"}) {
		t.Errorf("%+v", r)
	}
	// Nothing answers (not a Mac, or the commands refused): nothing is assumed.
	if r := Read(context.Background(), fake(nil)); r != (Readings{}) {
		t.Errorf("%+v", r)
	}
}

func TestAssess(t *testing.T) {
	for _, c := range []struct {
		r          Readings
		unattended bool
		want       []string
	}{
		{Readings{"on", "-", "on"}, false, []string{"FileVault's unlock screen", "fdesetup authrestart", "turns on again by itself"}},
		{Readings{"off", "homelab", "on"}, true, []string{"logs in as homelab by itself"}},
		{Readings{"off", "homelab", "off"}, false, []string{"stays off until someone presses the power button", "pmset autorestart 1"}},
		{Readings{"off", "-", "on"}, false, []string{"waits at the login window"}},
		{Readings{}, false, []string{"Could not read whether this Mac logs in", "Could not read whether it turns on again"}},
	} {
		rep := Assess(c.r)
		var all []string
		for _, l := range rep.Lines {
			all = append(all, l.Text)
		}
		text := strings.Join(all, "\n")
		if rep.Unattended != c.unattended {
			t.Errorf("%+v: unattended %v", c.r, rep.Unattended)
		}
		for _, w := range c.want {
			if !strings.Contains(text, w) {
				t.Errorf("%+v: no %q in\n%s", c.r, w, text)
			}
		}
	}
}
