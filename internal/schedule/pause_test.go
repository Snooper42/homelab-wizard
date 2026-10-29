package schedule

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
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
	if err := l.Pause(label); err != nil || l.Resume(label) != nil || strings.Join(calls, "|") != "print gui/501/com.homelab.agent|print gui/501/com.homelab.agent" {
		t.Fatalf("not installed: %v, calls %q (only reads)", err, calls)
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
	// Loaded and running: left be. Loaded but stopped (the owner's Mac, 29
	// Oct: launchd keeps a job that exited cleanly loaded and stopped
	// until the next login): started.
	for _, c := range []struct{ state, want string }{{"running", ""}, {"not running", "kickstart gui/501/com.homelab.agent"}} {
		calls = nil
		l.Run = func(args ...string) ([]byte, error) {
			calls = append(calls, strings.Join(args, " "))
			if args[0] == "print" {
				return []byte("gui/501/com.homelab.agent = {\n\tpath = " + l.PlistPath(label) + "\n\tstate = " + c.state + "\n}\n"), nil
			}
			return nil, nil
		}
		if err := l.Resume(label); err != nil || strings.Join(calls[1:], "|") != c.want {
			t.Fatalf("Resume while loaded and %s: %v, calls %q", c.state, err, calls)
		}
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
	var ps, started []string
	runs := "0"
	ts := TaskScheduler{Dir: t.TempDir(), Startup: t.TempDir(),
		PS: func(args ...string) ([]byte, error) {
			ps = append(ps, args...)
			return []byte(runs + "\r\n"), nil
		},
		Start: func(name string, args ...string) error {
			started = append(started, strings.Join(append([]string{name}, args...), " "))
			return nil
		},
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
	if ts.Pause(agent.Label) != nil || ts.Resume(agent.Label) != nil || len(ps) != 0 || len(started) != 0 {
		t.Fatalf("not installed: %q %q", ps, started)
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
	// The Run key's own command, as sign-in starts it.
	ps = nil
	if err := ts.Resume(agent.Label); err != nil || len(ps) != 1 || !strings.Contains(ps[0], "Contains('"+script+"')") || !slices.Equal(started, []string{runner + " " + script}) {
		t.Fatalf("Resume = %v: asked %q, started %q", err, ps, started)
	}
	// A warning before the count is not a process.
	runs, started = "WARNING: something\r\n0", nil
	if err := ts.Resume(agent.Label); err != nil || len(started) != 1 {
		t.Fatalf("Resume after a warning = %v: started %q", err, started)
	}
	// Running already: left be.
	runs, started = "1", nil
	if err := ts.Resume(agent.Label); err != nil || len(started) != 0 {
		t.Fatalf("Resume while it runs = %v: started %q", err, started)
	}
	// Without the runner the job is the Startup folder's script.
	runs = "0"
	values = map[string]string{}
	ts.Reg = func(args ...string) ([]byte, error) { return nil, os.ErrNotExist }
	if err := os.Remove(runner); err != nil {
		t.Fatal(err)
	}
	if err := ts.InstallJob(agent, bin, `C:\hl`, `C:\hl\logs`, ""); err != nil {
		t.Fatal(err)
	}
	if err := ts.Resume(agent.Label); err != nil || !slices.Equal(started, []string{ts.startupScript(agent.Label)}) {
		t.Fatalf("Resume from the Startup folder = %v: started %q", err, started)
	}
}

// The agent as the app's login item (registered through SMAppService,
// its plist inside the app): schedule installs no second job beside it,
// counts it as installed, stops and starts it without unloading it (the
// next login starts it), and Remove turns it off.
func TestLaunchdLeavesTheAppsLoginItemToTheApp(t *testing.T) {
	var calls []string
	state, disabled := "running", false
	l := Launchd{Dir: t.TempDir(), Domain: "gui/501", Run: func(args ...string) ([]byte, error) {
		calls = append(calls, strings.Join(args, " "))
		switch args[0] {
		case "print":
			return []byte("gui/501/com.homelab.agent = {\n\tpath = /Applications/Homelab Wizard.app/Contents/Library/LaunchAgents/com.homelab.agent.plist\n\tstate = " + state + "\n}\n"), nil
		case "kill":
			state = "not running"
		case "kickstart":
			state = "running"
		case "disable":
			disabled = true
		}
		return nil, nil
	}}
	const label = "com.homelab.agent"
	// A plist an older install left in ~/Library/LaunchAgents goes.
	if err := os.WriteFile(l.PlistPath(label), []byte("<plist/>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := l.Install(label, []byte("<plist/>")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(l.PlistPath(label)); !os.IsNotExist(err) || strings.Contains(strings.Join(calls, "|"), "bootstrap") {
		t.Fatalf("installed a second job beside the login item: calls %q", calls)
	}
	if s := l.Status(label); !s.Installed || !s.Loaded || s.State != "running" {
		t.Fatalf("status %+v", s)
	}
	calls = nil
	if err := l.Pause(label); err != nil || state != "not running" || strings.Contains(strings.Join(calls, "|"), "bootout") {
		t.Fatalf("Pause = %v, state %s, calls %q (unloaded the login item)", err, state, calls)
	}
	if err := l.Resume(label); err != nil || state != "running" || !strings.Contains(strings.Join(calls, "|"), "kickstart gui/501/com.homelab.agent") {
		t.Fatalf("Resume = %v, state %s, calls %q", err, state, calls)
	}
	calls = nil
	if err := l.Resume(label); err != nil || len(calls) != 1 {
		t.Fatalf("Resume while it runs: %v, calls %q", err, calls)
	}
	if err := l.Remove(label); err != nil || !disabled {
		t.Fatalf("Remove = %v, left the login item on (disabled %v)", err, disabled)
	}
}
