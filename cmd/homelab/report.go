package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/crash"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/ui"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// report writes a diagnostics file to share when something goes wrong:
// versions, doctor, status, the setup checklist, the jobs, Duplicati's
// jobs, the weekly summary, the watchdog's last run, updates waiting, which settings are set, the
// jobs' logs, and the logs of apps that are not well. Every
// secret from .env, and anything shaped like a token, is replaced first.
func (h *homelab) report(ctx context.Context, args []string) error {
	fs := newFlags("report")
	stdout := fs.Bool("stdout", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	var b bytes.Buffer
	section := func(title string) { fmt.Fprintf(&b, "\n===== %s =====\n", title) }
	run := func(title string, fn func(context.Context, []string) error, args ...string) {
		section(title)
		saved := h.ui
		h.ui = &ui.UI{Out: &b, In: bufio.NewReader(strings.NewReader(""))}
		if err := fn(ctx, args); err != nil {
			fmt.Fprintf(&b, "error: %v\n", err)
		}
		h.ui = saved
	}

	fmt.Fprintf(&b, "Homelab report, %s\n", time.Now().Format("2006-01-02 15:04 MST"))
	fmt.Fprintf(&b, "homelab %s (repository %s), %s/%s\n", version, h.repoVersion(), runtime.GOOS, runtime.GOARCH)
	for _, c := range [][]string{
		{"git", "-C", h.root, "log", "-1", "--format=commit %h %cd %s", "--date=short"},
		{"git", "-C", h.root, "status", "--short", "--branch"},
		osVersion(),
		{"docker", "version", "--format", "engine {{.Server.Version}} ({{.Server.Os}}/{{.Server.Arch}}), client {{.Client.Version}}"},
		{"docker", "compose", "version"},
	} {
		if len(c) == 0 {
			continue
		}
		if out, err := procattr.Hide(exec.CommandContext(ctx, c[0], c[1:]...)).CombinedOutput(); err == nil {
			b.Write(bytes.TrimSpace(out))
			b.WriteByte('\n')
		}
	}

	run("doctor", h.doctor)
	run("status", h.status, "--all")
	run("setup checklist", h.setupChecklist)
	run("scheduled jobs", h.schedule, "status")
	run("duplicati jobs", h.duplicatiCmd, "jobs")
	run("weekly summary", h.digestCmd)
	section("watchdog (last run)")
	if w := health.LoadState(health.StatePath(h.root)).Summary(); w.LastRun.IsZero() {
		b.WriteString("not run yet\n")
	} else {
		fmt.Fprintf(&b, "%s: %d checks, %d failing, %d checked again next run\n", w.LastRun.Format("2006-01-02 15:04"), w.Checks, len(w.Failing), w.Pending)
		for _, f := range w.Failing {
			fmt.Fprintf(&b, "  since %s: %s: %s\n", f.Since.Format("01-02 15:04"), f.Name, f.Problem)
		}
	}
	section("restore tests (newest first)")
	if l := backup.LoadRestoreLog(h.restoreLogPath()); len(l.History) == 0 {
		b.WriteString("none on record\n")
	} else {
		for i := len(l.History) - 1; i >= 0 && i >= len(l.History)-6; i-- {
			r := l.History[i]
			result := "failed"
			if r.Passed {
				result = "passed"
			}
			if r.Seconds > 0 {
				result += fmt.Sprintf(" in %ds", r.Seconds)
			}
			if r.Job != "" {
				result += " from " + r.Job
			}
			fmt.Fprintf(&b, "%s: %s: %s\n", r.When.Format("2006-01-02 15:04"), result, r.Summary)
		}
	}
	section("updates (homelab folder against GitHub, last fetch)")
	if c, err := upgrade.Inspect(ctx, h.root, false); err != nil {
		fmt.Fprintf(&b, "error: %v\n", err)
	} else {
		fmt.Fprintf(&b, "%s following %s: %d behind, %d ahead; edited here: %s\n", c.Branch, c.Upstream, c.Behind, c.Ahead, strings.Join(c.Dirty, ", "))
		for _, ch := range c.Changes {
			fmt.Fprintf(&b, "  waiting: %s %s\n", ch.Hash, ch.Subject)
		}
	}

	section("settings (.env; secrets only say whether they are set)")
	if list, err := settings.List(h.root); err != nil {
		fmt.Fprintf(&b, "error: %v\n", err)
	} else {
		for _, s := range list {
			switch {
			case s.Secret && s.Set:
				fmt.Fprintf(&b, "%s: set\n", s.Key)
			case !s.Set:
				fmt.Fprintf(&b, "%s: (empty)\n", s.Key)
			default:
				fmt.Fprintf(&b, "%s=%s\n", s.Key, s.Value)
			}
		}
	}

	section("how long Status takes here")
	b.WriteString(strings.Join(h.statusTiming(ctx), "\n") + "\n")

	// The newest crash of the app, the menu bar item, or the agent, with
	// the stack Go wrote (internal/crash).
	if c, ok := crash.Newest(h.logsDir()); ok {
		section(fmt.Sprintf("crash: %s stopped unexpectedly %s (%s, last 80 lines)", c.Who, c.When.Format("2006-01-02 15:04"), c.File))
		b.WriteString(tailFile(filepath.Join(h.root, filepath.FromSlash(c.File)), 80))
	}

	// Each job's log with the older half the agent moved to <job>.1.log,
	// read as one, so the last lines are there however the split fell.
	logs, _ := filepath.Glob(filepath.Join(h.logsDir(), "*.log"))
	sort.Strings(logs)
	for _, path := range logs {
		if strings.HasPrefix(filepath.Base(path), "crash-") {
			continue // the newest is above
		}
		older := strings.TrimSuffix(path, ".log") + ".1.log"
		if strings.HasSuffix(path, ".1.log") {
			if _, err := os.Stat(strings.TrimSuffix(path, ".1.log") + ".log"); err == nil {
				continue // read with its job's log
			}
			older = ""
		}
		if _, err := os.Stat(older); older != "" && err == nil {
			section("log: " + h.rel(path) + " and " + filepath.Base(older) + " (last 40 lines)")
			b.WriteString(tailFile(path, 40, older))
			continue
		}
		section("log: " + h.rel(path) + " (last 40 lines)")
		b.WriteString(tailFile(path, 40))
	}

	if client, err := h.docker(ctx); err == nil {
		if containers, err := client.Containers(ctx); err == nil {
			found := detect.Analyze(h.catalog, containers)
			for _, s := range api.StatusOf(ctx, h.catalog, containers, h.envMap(), true).Apps {
				// Not running, unwell, or restarted by Docker over and over
				// (a crash loop reads as running between its restarts).
				unwell := s.Health == "unhealthy" || s.Health == "starting" || s.Health == "restarting" || s.Restarts >= 3
				_, m := found.State(s.ID)
				if m == nil || m.Container.Name == "" || s.State == "running" && !unwell {
					continue
				}
				name := m.Container.Name
				section(fmt.Sprintf("container log: %s (%s %s, last 40 lines)", name, s.State, s.Health))
				out, _ := procattr.Hide(exec.CommandContext(ctx, client.Bin, "logs", "--tail", "40", name)).CombinedOutput()
				b.Write(out)
			}
		}
	}

	text := personal(redact(b.String(), h.secretValues()))
	if *stdout {
		h.ui.Printf("%s", text)
		return nil
	}
	path := filepath.Join(h.logsDir(), "report-"+time.Now().Format("2006-01-02-1504")+".txt")
	if err := os.MkdirAll(h.logsDir(), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(path, []byte(text), 0o600); err != nil {
		return err
	}
	h.ui.OK("report written to %s", h.rel(path))
	h.ui.Info("secrets, token-like strings, your account name, and email addresses are replaced; read it through before sharing it")
	return nil
}

// secretValues are the values in .env that must never leave this machine.
func (h *homelab) secretValues() map[string]string {
	return settings.SecretValues(h.root, h.envMap())
}

var tokenPatterns = []*regexp.Regexp{
	regexp.MustCompile(`tk_[A-Za-z0-9]{8,}`),                         // ntfy access tokens
	regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)*`), // JWTs and tunnel tokens
	regexp.MustCompile(`(?i)((?:bearer|basic)\s+)[A-Za-z0-9._~+/=-]{12,}`),
	regexp.MustCompile(`(?i)(hc-ping\.com/)[A-Za-z0-9-]{8,}`), // healthchecks.io ping URLs
	regexp.MustCompile(`(://)[^/\s:@]+:[^/\s@]+@`),            // passwords in URLs
	regexp.MustCompile(`(?i)(auth=)[A-Za-z0-9_-]{12,}`),       // ntfy's auth query parameter
}

// redact replaces each secret value, and anything shaped like a token,
// with a marker naming what was there.
func redact(text string, secrets map[string]string) string {
	text = settings.Hide(text, secrets)
	for _, re := range tokenPatterns {
		text = re.ReplaceAllStringFunc(text, func(m string) string {
			sub := re.FindStringSubmatch(m)
			if len(sub) > 1 && sub[1] != "" && strings.HasPrefix(m, sub[1]) {
				return sub[1] + "[redacted]"
			}
			return "[redacted]"
		})
	}
	return text
}

// A cloud drive's folder is named after its account (ProtonDrive-you@…);
// the drive's name stays, the address goes.
var emailPattern = regexp.MustCompile(`((?:ProtonDrive|GoogleDrive|OneDrive|Dropbox|Box)-)?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)

// personal takes out what says who you are, for a report that may be
// posted publicly: the home folder becomes ~, the account name [user],
// and email addresses (in a Proton Drive folder's name, say) [email].
func personal(text string) string {
	if home, err := os.UserHomeDir(); err == nil && len(home) > 1 {
		text = strings.ReplaceAll(text, home, "~")
	}
	text = emailPattern.ReplaceAllString(text, "${1}[email]")
	if u := os.Getenv("USER"); len(u) >= 3 {
		text = regexp.MustCompile(`\b`+regexp.QuoteMeta(u)+`\b`).ReplaceAllString(text, "[user]")
	}
	return text
}

// tailFile returns the last n lines of a file, read after the older
// files given (a job's .1.log), as if they were one.
func tailFile(path string, n int, older ...string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return "error: " + err.Error() + "\n"
	}
	for _, o := range older {
		if before, err := os.ReadFile(o); err == nil {
			data = append(before, data...)
		}
	}
	lines := strings.SplitAfter(string(data), "\n")
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1] // the end of the last line, not a line
	}
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "")
}

// osVersion is the command that names the system and its version.
func osVersion() []string {
	switch runtime.GOOS {
	case "darwin":
		return []string{"sw_vers"}
	case "linux":
		return []string{"sh", "-c", `. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-Linux}, kernel $(uname -r)"`}
	case "windows":
		return []string{"cmd", "/c", "ver"}
	}
	return nil
}
