package schedule

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Pause stops the agent until the next login and keeps it installed;
// Resume starts it again. Neither touches a job that is not installed.
func TestLaunchdPauseAndResume(t *testing.T) {
	retryDelay = 0
	var calls []string
	loaded := false
	l := Launchd{Dir: t.TempDir(), Domain: "gui/501", Run: func(args ...string) ([]byte, error) {
		calls = append(calls, strings.Join(args, " "))
		switch args[0] {
		case "bootstrap":
			loaded = true
		case "bootout":
			loaded = false
		case "print":
			if !loaded {
				return nil, fmt.Errorf("not found")
			}
		}
		return nil, nil
	}}
	const label = "com.homelab.agent"
	if err := l.Pause(label); err != nil || l.Resume(label) != nil || len(calls) != 1 {
		t.Fatalf("not installed: %v, calls %q", err, calls)
	}
	if err := l.Install(label, []byte("<plist/>")); err != nil {
		t.Fatal(err)
	}
	calls = nil
	if err := l.Pause(label); err != nil || loaded {
		t.Fatalf("Pause = %v, still loaded %v (calls %q)", err, loaded, calls)
	}
	if _, err := os.Stat(l.PlistPath(label)); err != nil {
		t.Fatal("Pause removed the plist, so the next login would not start the agent")
	}
	if err := l.Resume(label); err != nil || !loaded {
		t.Fatalf("Resume = %v, loaded %v (calls %q)", err, loaded, calls)
	}
	calls = nil
	if err := l.Resume(label); err != nil || strings.Contains(strings.Join(calls, "|"), "bootstrap") {
		t.Fatalf("Resume while loaded: %v, calls %q", err, calls)
	}
}

func TestSystemdPauseAndResume(t *testing.T) {
	var calls []string
	s := Systemd{Dir: t.TempDir(), Run: func(args ...string) ([]byte, error) {
		calls = append(calls, strings.Join(args, " "))
		return nil, nil
	}}
	agent := Jobs()[0]
	if s.Pause(agent.Label) != nil || s.Resume(agent.Label) != nil || len(calls) != 0 {
		t.Fatalf("not installed: calls %q", calls)
	}
	if err := s.InstallJob(agent, "/b", "/r", "/l", "/p"); err != nil {
		t.Fatal(err)
	}
	calls = nil
	if err := s.Pause(agent.Label); err != nil {
		t.Fatal(err)
	}
	if err := s.Resume(agent.Label); err != nil {
		t.Fatal(err)
	}
	// Stopped and started; never disabled, so the next login starts it.
	if got := strings.Join(calls, "|"); got != "stop homelab-agent.service|start homelab-agent.service" {
		t.Fatalf("calls %q", got)
	}
	// A job with a timer: the timer stops too, and starting it is enough.
	watchdog := Job{Label: "com.homelab.watchdog", Args: []string{"watchdog"}, Interval: 900}
	if err := s.InstallJob(watchdog, "/b", "/r", "/l", "/p"); err != nil {
		t.Fatal(err)
	}
	calls = nil
	_ = s.Pause(watchdog.Label)
	_ = s.Resume(watchdog.Label)
	if got := strings.Join(calls, "|"); got != "stop homelab-watchdog.timer homelab-watchdog.service|start homelab-watchdog.timer" {
		t.Fatalf("calls %q", got)
	}
}

func TestTaskSchedulerPauseAndResume(t *testing.T) {
	values := map[string]string{}
	var ps []string
	ts := TaskScheduler{Dir: t.TempDir(), Startup: t.TempDir(),
		PS:  func(args ...string) ([]byte, error) { ps = append(ps, args...); return nil, nil },
		Run: func(args ...string) ([]byte, error) { return nil, nil },
		Reg: func(args ...string) ([]byte, error) {
			switch args[0] {
			case "add":
				values[args[3]] = args[7]
			case "query":
				v, ok := values[args[3]]
				if !ok {
					return nil, os.ErrNotExist
				}
				return []byte("\r\nHKEY_CURRENT_USER\\...\\Run\r\n    " + args[3] + "    REG_SZ    " + v + "\r\n"), nil
			}
			return nil, nil
		}}
	agent := Jobs()[0]
	if ts.Pause(agent.Label) != nil || ts.Resume(agent.Label) != nil || len(ps) != 0 {
		t.Fatalf("not installed: %q", ps)
	}
	bin := filepath.Join(t.TempDir(), "homelab.exe")
	runner := filepath.Join(filepath.Dir(bin), JobRunner)
	if err := os.WriteFile(runner, nil, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := ts.InstallJob(agent, bin, `C:\hl`, `C:\hl\logs`, ""); err != nil {
		t.Fatal(err)
	}
	script := ts.script(agent.Label)
	if err := ts.Pause(agent.Label); err != nil || len(ps) != 1 || !strings.Contains(ps[0], "Contains('"+script+"')") || !strings.Contains(ps[0], "taskkill.exe") || !strings.Contains(ps[0], "$_.ProcessId -ne $PID") {
		t.Fatalf("Pause = %v: %q", err, ps)
	}
	if _, ok := values["homelab-agent"]; !ok {
		t.Fatal("Pause removed the Run value, so the next sign-in would not start the agent")
	}
	ps = nil
	if err := ts.Resume(agent.Label); err != nil || len(ps) != 1 {
		t.Fatalf("Resume = %v: %q", err, ps)
	}
	// The Run key's own command, hidden, unless the script runs already.
	for _, want := range []string{"if (-not (", "Contains('" + script + "')", "Start-Process -FilePath '" + runner + "' -ArgumentList '\"" + script + "\"' -WindowStyle Hidden"} {
		if !strings.Contains(ps[0], want) {
			t.Errorf("Resume ran %q, missing %q", ps[0], want)
		}
	}
	// Without the runner the job is the Startup folder's script.
	values = map[string]string{}
	ts.Reg = func(args ...string) ([]byte, error) { return nil, os.ErrNotExist }
	if err := os.Remove(runner); err != nil {
		t.Fatal(err)
	}
	if err := ts.InstallJob(agent, bin, `C:\hl`, `C:\hl\logs`, ""); err != nil {
		t.Fatal(err)
	}
	ps = nil
	if err := ts.Resume(agent.Label); err != nil || len(ps) != 1 || !strings.Contains(ps[0], "Start-Process -FilePath '"+ts.startupScript(agent.Label)+"' -WindowStyle Hidden") {
		t.Fatalf("Resume from the Startup folder = %v: %q", err, ps)
	}
}
