package schedule

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPlist(t *testing.T) {
	j := Job{Label: "com.homelab.backup", Args: []string{"backup", "--apply"}, Daily: true, Hour: 4, Minute: 30}
	p := string(j.Plist("/Users/a/Homelab/bin/homelab", "/Users/a/Homelab", "/Users/a/Homelab/scripts/logs", "/usr/bin:/bin"))
	for _, want := range []string{
		"<string>com.homelab.backup</string>",
		"<string>/Users/a/Homelab/bin/homelab</string>\n\t\t<string>--root</string>\n\t\t<string>/Users/a/Homelab</string>",
		"<string>backup</string>\n\t\t<string>--apply</string>",
		"<key>Hour</key>\n\t\t<integer>4</integer>",
		"<string>/Users/a/Homelab/scripts/logs/backup.log</string>",
	} {
		if !strings.Contains(p, want) {
			t.Errorf("plist is missing %q:\n%s", want, p)
		}
	}
	if j.When() != "daily at 04:30" {
		t.Errorf("When = %q", j.When())
	}
	w := Job{Label: "x", Interval: 900, RunAtLoad: true}
	if !strings.Contains(string(w.Plist("b", "r & d", "l", "p")), "<string>r &amp; d</string>") || w.When() != "at login, every 15 min" {
		t.Errorf("escaping or When: %q", w.When())
	}
}

func TestLaunchd(t *testing.T) {
	var calls []string
	loaded := map[string]bool{}
	l := Launchd{Dir: t.TempDir(), Domain: "gui/501", Run: func(args ...string) ([]byte, error) {
		calls = append(calls, strings.Join(args, " "))
		switch args[0] {
		case "bootstrap":
			loaded[filepath.Base(args[2])] = true
		case "print":
			if !loaded["com.homelab.watchdog.plist"] {
				return nil, fmt.Errorf("not found")
			}
			return []byte("\tstate = not running\n\truns = 3\n\tlast exit code = 0\n"), nil
		}
		return nil, nil
	}}
	if s := l.Status("com.homelab.watchdog"); s.Installed || s.Loaded {
		t.Fatalf("before install: %+v", s)
	}
	if err := l.Install("com.homelab.watchdog", []byte("<plist/>")); err != nil {
		t.Fatal(err)
	}
	s := l.Status("com.homelab.watchdog")
	if !s.Installed || !s.Loaded || s.Runs != "3" || s.LastExit != "0" || s.State != "not running" {
		t.Fatalf("after install: %+v", s)
	}
	if err := l.Remove("com.homelab.watchdog"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(l.PlistPath("com.homelab.watchdog")); !os.IsNotExist(err) {
		t.Fatal("plist should be deleted")
	}
	if !strings.Contains(strings.Join(calls, "|"), "bootstrap gui/501 "+l.PlistPath("com.homelab.watchdog")) {
		t.Fatalf("calls %v", calls)
	}
}

func TestLaunchdRetriesBootstrap(t *testing.T) {
	retryDelay = 0
	tries := 0
	l := Launchd{Dir: t.TempDir(), Domain: "gui/501", Run: func(args ...string) ([]byte, error) {
		if args[0] == "bootstrap" {
			if tries++; tries < 3 {
				return []byte("Bootstrap failed: 5: Input/output error"), fmt.Errorf("exit status 5")
			}
		}
		return nil, nil
	}}
	if err := l.Install("com.homelab.watchdog", []byte("<plist/>")); err != nil || tries != 3 {
		t.Fatalf("Install = %v after %d tries; want success on the third", err, tries)
	}
}

func TestKeepAliveJob(t *testing.T) {
	var awake Job
	for _, j := range Jobs() {
		if j.Label == "com.homelab.awake" {
			awake = j
		}
	}
	if !awake.KeepAlive || awake.When() != "always" {
		t.Fatalf("awake job: %+v", awake)
	}
	plist := string(awake.Plist("/bin/homelab", "/r", "/l", "/usr/bin"))
	if !strings.Contains(plist, "<key>KeepAlive</key>\n\t<dict>\n\t\t<key>SuccessfulExit</key>\n\t\t<false/>") || !strings.Contains(plist, "<key>RunAtLoad</key>") {
		t.Errorf("plist:\n%s", plist)
	}
	service, timer := awake.Units("/bin/homelab", "/r", "/l", "/usr/bin")
	if timer != nil || !strings.Contains(string(service), "Type=simple\nRestart=on-failure") || !strings.Contains(string(service), "WantedBy=default.target") {
		t.Errorf("units:\n%s", service)
	}
}
