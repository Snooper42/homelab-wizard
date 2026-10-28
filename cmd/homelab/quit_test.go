package main

import (
	"bufio"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// Quit stops the homelab's own containers (not others on the machine),
// asks the menu bar item to quit, and remembers what it stopped; resume
// starts those again and forgets them.
func TestQuitAndResume(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_system-duplicati-1", Image: "lscr.io/linuxserver/duplicati", Running: true, Project: "homelab_system", Service: "duplicati"},
		{Name: "homelab_media_automation-sonarr-1", Image: "lscr.io/linuxserver/sonarr", Running: true, Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-radarr-1", Image: "lscr.io/linuxserver/radarr", Running: false, Project: "homelab_media_automation", Service: "radarr"},
		{Name: "someone-elses-1", Image: "nginx", Running: true, Project: "theirs", Service: "web"},
	})
	fakeSystemctl(t)
	root, _ := repoCopy(t)
	stopped := filepath.Join(root, "scripts", "logs", "stopped.json")
	// Windows' scheduler (the Run key) has no stand-in here.
	jobs := runtime.GOOS != "windows"
	if jobs {
		if out, code := homelabCmd(t, root, "", "schedule", "install", "--apply"); code != 0 {
			t.Fatalf("schedule install (exit %d):\n%s", code, out)
		}
	}

	if out, code := homelabCmd(t, root, "", "quit"); code != 0 || !strings.Contains(out, "Preview only") || strings.Contains(readCalls(t, calls), "stop") {
		t.Fatalf("quit without --apply must only preview (exit %d):\n%s", code, out)
	}

	// A menu bar item listening where the real one does.
	asked := make(chan string, 1)
	if l, err := net.Listen("tcp", core.TrayAddr); err == nil {
		defer l.Close()
		go func() {
			if c, err := l.Accept(); err == nil {
				line, _ := bufio.NewReader(c).ReadString('\n')
				asked <- strings.TrimSpace(line)
				c.Close()
			}
		}()
	} else {
		asked <- "quit" // a real one runs here; leave it be
		t.Log("a menu bar item runs on this machine; not asking it to quit")
	}

	out, code := homelabCmd(t, root, "", "quit", "--apply")
	if code != 0 {
		t.Fatalf("quit --apply (exit %d):\n%s", code, out)
	}
	if line := <-asked; line != "quit" {
		t.Errorf("the menu bar item was sent %q", line)
	}
	log := readCalls(t, calls)
	if !strings.Contains(log, "stop homelab_system-duplicati-1 homelab_media_automation-sonarr-1\n") {
		t.Fatalf("quit stopped the wrong containers:\n%s", log)
	}
	data, err := os.ReadFile(stopped)
	if err != nil || !strings.Contains(string(data), "homelab_media_automation-sonarr-1") || strings.Contains(string(data), "someone-elses") || strings.Contains(string(data), "radarr") {
		t.Fatalf("stopped.json (%v):\n%s", err, data)
	}
	if out, _ := homelabCmd(t, root, "", "schedule", "status"); jobs && !strings.Contains(out, "stopped by homelab quit") {
		t.Errorf("schedule status after quit:\n%s", out)
	}

	out, code = homelabCmd(t, root, "", "resume")
	if code != 0 || !strings.Contains(out, "started 2 containers") {
		t.Fatalf("resume (exit %d):\n%s", code, out)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "start homelab_system-duplicati-1 homelab_media_automation-sonarr-1\n") {
		t.Fatalf("resume started:\n%s", log)
	}
	if _, err := os.Stat(stopped); !os.IsNotExist(err) {
		t.Fatal("resume kept stopped.json, so the homelab still counts as quit")
	}
	// Nothing quit: resume (the app runs it at each start) starts nothing.
	before := readCalls(t, calls)
	if out, code := homelabCmd(t, root, "", "resume"); code != 0 || readCalls(t, calls) != before {
		t.Fatalf("resume with nothing quit (exit %d):\n%s\ncalls:\n%s", code, out, strings.TrimPrefix(readCalls(t, calls), before))
	}
}

// With the runtime not running, quit still stops the agent and the menu
// bar item, and resume keeps the list for when it runs.
func TestQuitWithoutTheRuntime(t *testing.T) {
	calls := fakeDocker(t, nil)
	fakeSystemctl(t)
	if err := os.WriteFile(filepath.Join(filepath.Dir(calls), "down"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "quit", "--apply")
	if code != 0 || !strings.Contains(out, "no apps to stop") {
		t.Fatalf("quit without the runtime (exit %d):\n%s", code, out)
	}
	stopped := filepath.Join(root, "scripts", "logs", "stopped.json")
	if err := os.WriteFile(stopped, []byte(`{"containers":["homelab_system-duplicati-1"]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, code := homelabCmd(t, root, "", "resume"); code == 0 {
		t.Error("resume said nothing was wrong with the runtime not running")
	}
	if _, err := os.Stat(stopped); err != nil {
		t.Fatal("resume forgot what to start while the runtime was not running")
	}
}
