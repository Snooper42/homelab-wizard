//go:build forreal

package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"
)

// The scheduled jobs installed on the machine this runs on, through the
// CLI as a person runs it: launchd on macOS, a systemd user unit on Linux,
// the Run key and homelab-run.exe on Windows. The agent then runs (on
// Windows, the Run key's own command, as at sign-in); quit stops it and
// keeps it installed, resume starts it again; and schedule remove must
// leave nothing: no file, no registration, no process. CI runs it on
// each system's runner (go test -tags forreal); on your own machine it
// replaces your jobs while it runs, so run it where none are installed.
func TestJobsInstalledForReal(t *testing.T) {
	if left := leftovers(t, ""); len(left) > 0 {
		t.Fatalf("jobs are installed before the test: %q", left)
	}
	binDir := t.TempDir()
	bin := filepath.Join(binDir, "homelab")
	if runtime.GOOS == "windows" {
		bin += ".exe"
		build(t, filepath.Join(binDir, "homelab-run.exe"), "../homelab-run")
	}
	build(t, bin, ".")

	// The media folder is not there, so the agent's startup waits for it
	// and starts no apps on the runner.
	root, _ := repoCopy(t)
	media := filepath.Join(t.TempDir(), "not-mounted")
	env, _ := os.ReadFile(filepath.Join(root, ".env"))
	env = regexp.MustCompile(`(?m)^MEDIA_ROOT=.*$`).ReplaceAll(env, []byte("MEDIA_ROOT="+filepath.ToSlash(media)))
	if err := os.WriteFile(filepath.Join(root, ".env"), env, 0o600); err != nil {
		t.Fatal(err)
	}
	homelab := func(args ...string) string {
		t.Helper()
		out, err := exec.Command(bin, append([]string{"--root", root, "--no-color"}, args...)...).CombinedOutput()
		if err != nil {
			t.Fatalf("homelab %s: %v\n%s", strings.Join(args, " "), err, out)
		}
		return string(out)
	}

	homelab("schedule", "install", "--apply")
	t.Cleanup(func() {
		_, _ = exec.Command(bin, "--root", root, "schedule", "remove", "--apply").CombinedOutput()
		stopAll(binDir)
	})
	if out := homelab("schedule", "status"); !strings.Contains(out, "com.homelab.agent") || strings.Contains(out, "not installed") || strings.Contains(out, "not loaded") || strings.Contains(out, "failed") {
		t.Fatalf("schedule status after install:\n%s", out)
	}
	if left := leftovers(t, binDir); len(left) == 0 {
		t.Fatal("installed, but nothing of it found on the system")
	}

	if runtime.GOOS == "windows" {
		// What Windows runs at sign-in: the Run key's value, as it is.
		out, err := exec.Command("reg", "query", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", "homelab-agent").CombinedOutput()
		if err != nil {
			t.Fatalf("the Run value: %v\n%s", err, out)
		}
		parts := regexp.MustCompile(`"([^"]+)"`).FindAllStringSubmatch(string(out), -1)
		if len(parts) != 2 || !strings.HasSuffix(parts[0][1], "homelab-run.exe") {
			t.Fatalf("the Run value is not homelab-run.exe and a script:\n%s", out)
		}
		if err := exec.Command(parts[0][1], parts[1][1]).Start(); err != nil {
			t.Fatal(err)
		}
	}
	state := filepath.Join(root, "scripts", "logs", "agent.json")
	for end := time.Now().Add(time.Minute); ; time.Sleep(time.Second) {
		if _, err := os.Stat(state); err == nil {
			break
		}
		if time.Now().After(end) {
			logs, _ := filepath.Glob(filepath.Join(root, "scripts", "logs", "*"))
			t.Fatalf("the agent did not start within a minute (no %s); logs: %q", state, logs)
		}
	}

	// Quit stops the agent and keeps it installed, so the next login
	// starts it; resume starts it now.
	homelab("quit", "--apply")
	var procs []string
	for end := time.Now().Add(30 * time.Second); ; time.Sleep(time.Second) {
		if procs = running(binDir); len(procs) == 0 || time.Now().After(end) {
			break
		}
	}
	if len(procs) > 0 {
		t.Fatalf("quit left the agent running: %q", procs)
	}
	if left := leftovers(t, ""); len(left) == 0 {
		t.Fatal("quit removed the agent, so the next login would not start it")
	}
	if out := homelab("schedule", "status"); !strings.Contains(out, "stopped by homelab quit") {
		t.Fatalf("schedule status after quit:\n%s", out)
	}
	homelab("resume")
	for end := time.Now().Add(time.Minute); len(running(binDir)) == 0; time.Sleep(time.Second) {
		if time.Now().After(end) {
			t.Fatal("resume did not start the agent within a minute")
		}
	}
	if out := homelab("schedule", "status"); strings.Contains(out, "stopped by homelab quit") || strings.Contains(out, "not loaded") {
		t.Fatalf("schedule status after resume:\n%s", out)
	}

	homelab("schedule", "remove", "--apply")
	var left []string
	for end := time.Now().Add(30 * time.Second); ; time.Sleep(time.Second) {
		if left = leftovers(t, binDir); len(left) == 0 || time.Now().After(end) {
			break
		}
	}
	if len(left) > 0 {
		t.Fatalf("schedule remove left: %q", left)
	}
	if out := homelab("schedule", "status"); !strings.Contains(out, "not installed") {
		t.Fatalf("schedule status after remove:\n%s", out)
	}
}

func build(t *testing.T, out, pkg string) {
	t.Helper()
	if b, err := exec.Command("go", "build", "-o", out, pkg).CombinedOutput(); err != nil {
		t.Fatalf("go build %s: %v\n%s", pkg, err, b)
	}
}

// leftovers is what of homelab's jobs is on this machine: their files,
// what the system has registered, and, with binDir, the processes running
// a program from there.
func leftovers(t *testing.T, binDir string) []string {
	t.Helper()
	home, _ := os.UserHomeDir()
	var left []string
	glob := func(pattern string) {
		found, _ := filepath.Glob(pattern)
		left = append(left, found...)
	}
	ok := func(name string, args ...string) bool { return exec.Command(name, args...).Run() == nil }
	switch runtime.GOOS {
	case "darwin":
		glob(filepath.Join(home, "Library", "LaunchAgents", "com.homelab.*.plist"))
		if ok("launchctl", "print", "gui/"+strconv.Itoa(os.Getuid())+"/com.homelab.agent") {
			left = append(left, "launchd knows com.homelab.agent")
		}
	case "linux":
		glob(filepath.Join(home, ".config", "systemd", "user", "homelab-*"))
		out, _ := exec.Command("systemctl", "--user", "is-active", "homelab-agent.service").Output()
		if s := strings.TrimSpace(string(out)); s == "active" || s == "activating" {
			left = append(left, "homelab-agent.service is "+s)
		}
	case "windows":
		glob(filepath.Join(os.Getenv("LOCALAPPDATA"), "Homelab", "jobs", "*.cmd"))
		glob(filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "homelab-*.cmd"))
		if ok("reg", "query", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", "homelab-agent") {
			left = append(left, "the Run value homelab-agent")
		}
		if ok("schtasks", "/Query", "/TN", `Homelab\agent`) {
			left = append(left, `the task Homelab\agent`)
		}
	default:
		t.Fatalf("no scheduler on %s", runtime.GOOS)
	}
	if binDir != "" {
		left = append(left, running(binDir)...)
	}
	return left
}

// running lists the processes whose program is in dir.
func running(dir string) []string {
	var out []byte
	if runtime.GOOS == "windows" {
		out, _ = exec.Command("powershell.exe", "-NoProfile", "-Command",
			"Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith('"+strings.ReplaceAll(dir, "'", "''")+"') } | ForEach-Object { \"$($_.ProcessId) $($_.CommandLine)\" }").Output()
	} else {
		out, _ = exec.Command("pgrep", "-fl", dir).Output()
	}
	var procs []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			procs = append(procs, "running: "+line)
		}
	}
	return procs
}

// stopAll ends what a failed test left running from dir.
func stopAll(dir string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if runtime.GOOS == "windows" {
		_ = exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-Command",
			"Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith('"+strings.ReplaceAll(dir, "'", "''")+"') } | ForEach-Object { taskkill.exe /F /T /PID $_.ProcessId }").Run()
		return
	}
	_ = exec.CommandContext(ctx, "pkill", "-f", dir).Run()
}
