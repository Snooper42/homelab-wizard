package schedule

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScript(t *testing.T) {
	j := Job{Label: "com.homelab.startup", Args: []string{"up", "--apply", "--wait-media", "15m"}, RunAtLoad: true}
	got := string(j.Script(`C:\Program Files\homelab.exe`, `C:\Users\me\Home Lab`, `C:\logs`))
	for _, want := range []string{"@echo off\r\n", `cd /d "C:\Users\me\Home Lab"`, `"C:\Program Files\homelab.exe" --root "C:\Users\me\Home Lab" --no-color up --apply --wait-media 15m >> `, "startup.log", " 2>&1\r\n"} {
		if !strings.Contains(got, want) {
			t.Errorf("script is missing %q:\n%s", want, got)
		}
	}
	if cmdQuote("50%") != "50%%" {
		t.Errorf("percent signs are not escaped: %s", cmdQuote("50%"))
	}
}

func TestTaskScheduler(t *testing.T) {
	var calls []string
	created := map[string]bool{}
	ts := TaskScheduler{Dir: t.TempDir(), Startup: t.TempDir(), Run: func(args ...string) ([]byte, error) {
		calls = append(calls, strings.Join(args, " "))
		switch args[0] {
		case "/Create":
			created[args[3]] = true
		case "/Query":
			if !created[args[2]] {
				return nil, os.ErrNotExist
			}
			return []byte("TaskName:      \\Homelab\\watchdog\r\nStatus:        Ready\r\nLast Result:   0\r\n"), nil
		}
		return nil, nil
	}}
	watchdog := Job{Label: "com.homelab.watchdog", Args: []string{"watchdog"}, Interval: 900}
	startup := Job{Label: "com.homelab.startup", Args: []string{"up"}, RunAtLoad: true}
	for _, j := range []Job{watchdog, startup} {
		if err := ts.InstallJob(j, "homelab.exe", `C:\hl`, `C:\hl\logs`, ""); err != nil {
			t.Fatal(err)
		}
	}
	if st := ts.Status(watchdog.Label); !st.Installed || !st.Loaded || st.State != "Ready" || st.LastExit != "0" {
		t.Fatalf("watchdog: %+v", st)
	}
	if st := ts.Status(startup.Label); !st.Loaded {
		t.Fatalf("startup: %+v", st)
	}
	if got := strings.Join(calls, "; "); !strings.Contains(got, `/Create /F /TN Homelab\watchdog /TR "`) || !strings.Contains(got, "/SC MINUTE /MO 15") || strings.Contains(got, "startup") {
		t.Fatalf("calls: %s", got)
	}
	for _, j := range []Job{watchdog, startup} {
		if err := ts.Remove(j.Label); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := os.Stat(filepath.Join(ts.Startup, "homelab-startup.cmd")); !os.IsNotExist(err) {
		t.Fatalf("startup script was not removed: %v", err)
	}
	if !strings.Contains(strings.Join(calls, "; "), `/Delete /F /TN Homelab\watchdog`) {
		t.Fatalf("watchdog task was not deleted: %v", calls)
	}
}

func TestTaskSchedulerUsesTheRunner(t *testing.T) {
	var tr string
	ts := TaskScheduler{Dir: t.TempDir(), Startup: t.TempDir(), Run: func(args ...string) ([]byte, error) {
		for i, a := range args {
			if a == "/TR" {
				tr = args[i+1]
			}
		}
		return nil, nil
	}}
	bin := filepath.Join(t.TempDir(), "homelab.exe")
	watchdog := Job{Label: "com.homelab.watchdog", Args: []string{"watchdog"}, Interval: 900}
	if err := ts.InstallJob(watchdog, bin, `C:\hl`, `C:\hl\logs`, ""); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(tr, JobRunner) {
		t.Fatalf("no runner beside the CLI, but the task uses one: %s", tr)
	}
	runner := filepath.Join(filepath.Dir(bin), JobRunner)
	if err := os.WriteFile(runner, nil, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := ts.InstallJob(watchdog, bin, `C:\hl`, `C:\hl\logs`, ""); err != nil {
		t.Fatal(err)
	}
	if want := `"` + runner + `" "` + ts.script(watchdog.Label) + `"`; tr != want {
		t.Fatalf("task runs %s, want %s", tr, want)
	}
}

func TestSignInJobFromTheRunKey(t *testing.T) {
	values := map[string]string{}
	ts := TaskScheduler{Dir: t.TempDir(), Startup: t.TempDir(),
		Run: func(args ...string) ([]byte, error) { return nil, nil },
		Reg: func(args ...string) ([]byte, error) {
			if args[1] != runKey {
				t.Fatalf("reg %v outside the Run key", args)
			}
			switch args[0] {
			case "add":
				values[args[3]] = args[7]
			case "query":
				if _, ok := values[args[3]]; !ok {
					return nil, os.ErrNotExist
				}
			case "delete":
				delete(values, args[3])
			}
			return nil, nil
		}}
	bin := filepath.Join(t.TempDir(), "homelab.exe")
	runner := filepath.Join(filepath.Dir(bin), JobRunner)
	if err := os.WriteFile(runner, nil, 0o755); err != nil {
		t.Fatal(err)
	}
	startup := Job{Label: "com.homelab.startup", Args: []string{"up"}, RunAtLoad: true}
	// An earlier install left a script in the Startup folder.
	old := filepath.Join(ts.Startup, "homelab-startup.cmd")
	if err := os.WriteFile(old, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := ts.InstallJob(startup, bin, `C:\hl`, `C:\hl\logs`, ""); err != nil {
		t.Fatal(err)
	}
	if want := `"` + runner + `" "` + ts.script(startup.Label) + `"`; values["homelab-startup"] != want {
		t.Fatalf("Run value = %q, want %q", values["homelab-startup"], want)
	}
	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Error("the old Startup-folder script is still there, so the job would run twice")
	}
	if st := ts.Status(startup.Label); !st.Loaded || st.State != "runs at sign-in" {
		t.Fatalf("status %+v", st)
	}
	if err := ts.Remove(startup.Label); err != nil {
		t.Fatal(err)
	}
	if _, ok := values["homelab-startup"]; ok || ts.Status(startup.Label).Installed {
		t.Error("Remove left the Run value or the script")
	}
}
