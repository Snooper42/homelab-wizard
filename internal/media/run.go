package media

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// Event is one line an engine prints with --events json.
type Event struct {
	Type  string  `json:"type"` // title, step, progress, working, ok, warn, fail, info, kv, cmd, result
	Text  string  `json:"text,omitempty"`
	Sub   string  `json:"sub,omitempty"`
	N     int     `json:"n,omitempty"`
	Total int     `json:"total,omitempty"`
	Done  int     `json:"done,omitempty"`
	Label string  `json:"label,omitempty"`
	Value string  `json:"value,omitempty"`
	Note  string  `json:"note,omitempty"`
	ETA   float64 `json:"eta,omitempty"`
	// Raw is the whole line, with the fields above and the rest.
	Raw map[string]any `json:"-"`
}

// ParseEvent reads one line; ok is false for a line that is not an event.
func ParseEvent(line string) (Event, bool) {
	line = strings.TrimSpace(line)
	if !strings.HasPrefix(line, "{") {
		return Event{}, false
	}
	var ev Event
	if json.Unmarshal([]byte(line), &ev) != nil || ev.Type == "" {
		return Event{}, false
	}
	_ = json.Unmarshal([]byte(line), &ev.Raw)
	return ev, true
}

// Line is an event as a line for a terminal ("" for one with nothing to say).
func (e Event) Line() string {
	switch e.Type {
	case "title":
		if e.Sub != "" {
			return "\n" + e.Text + "  ·  " + e.Sub
		}
		return "\n" + e.Text
	case "step":
		return fmt.Sprintf("\n[%d/%d] %s", e.N, e.Total, e.Text)
	case "ok":
		return "  ✓ " + e.Text
	case "warn":
		return "  ! " + e.Text
	case "fail":
		return "  ✗ " + e.Text
	case "kv":
		return fmt.Sprintf("  %-16s %s", e.Label, e.Value)
	case "cmd":
		return "    " + e.Text
	case "info":
		return "  " + e.Text
	}
	return ""
}

// Job is one engine run.
type Job struct {
	Root   string
	Kind   string
	Action string
	Args   []string // the engine's own flags and paths, after the action
	Env    map[string]string
	Python []string // the interpreter, e.g. ["python3"] or ["py", "-3"]
	// Yes answers the engine's question: the person agreed in the app or
	// the terminal first (homelab media never adds it by itself).
	Yes bool
	// Out gets every event, with its line as printed.
	Out func(ev Event, line string)
	// Log, when set, gets every line too (logs/media/<job>.jsonl).
	Log io.Writer
}

// Command is the engine's command line.
func (j Job) Command() ([]string, error) {
	a, err := Lookup(j.Kind, j.Action)
	if err != nil {
		return nil, err
	}
	script := filepath.Join(ToolsDir(j.Root), a.Script)
	if _, err := os.Stat(script); err != nil {
		return nil, fmt.Errorf("Tidy Up's engines are missing from %s: update the homelab folder (homelab upgrade)", ToolsDir(j.Root))
	}
	cmd := append(append([]string{}, j.Python...), script)
	action := j.Action
	if j.Kind == "scrubber" || j.Kind == "tdarr" || (j.Kind == "inbox" && j.Action != "undo") {
		action = "scan"
	}
	cmd = append(cmd, action)
	cmd = append(cmd, j.Args...)
	cmd = append(cmd, "--config", SettingsPath(j.Root), "--events", "json")
	if j.Yes && a.Confirm {
		cmd = append(cmd, "--yes")
	}
	return cmd, nil
}

// powerEvery is how often a heavy job checks it still runs on power.
var powerEvery = 30 * time.Second

// onBattery is battery.Power; tests replace it.
var onBattery = func() bool { b, known := battery.Power(); return known && b }

// ErrOnBattery stops a heavy job when the machine goes on battery.
var ErrOnBattery = errors.New("on battery: paused until this computer is plugged in")

// Execute runs the engine to its end and returns its outcome: its result
// event and exit code. A heavy job stops when the machine goes on battery;
// the engine resumes where it stopped the next time it runs.
func Execute(ctx context.Context, j Job) (Run, error) {
	a, err := Lookup(j.Kind, j.Action)
	if err != nil {
		return Run{}, err
	}
	argv, err := j.Command()
	if err != nil {
		return Run{}, err
	}
	run := Run{Action: j.Action, At: time.Now().UTC()}
	run.ID = fmt.Sprintf("%s-%s-%d", j.Kind, j.Action, run.At.UnixNano())
	if a.Power && onBattery() {
		return run, ErrOnBattery
	}
	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	c := procattr.Hide(exec.CommandContext(ctx, argv[0], argv[1:]...))
	c.Dir = ToolsDir(j.Root)
	// The engines note what they put in the Trash under this run, for Undo.
	c.Env = append(Environ(j.Env), "HOMELAB_MEDIA_RUN="+run.ID, "HOMELAB_MEDIA_TRASH_LOG="+TrashLogPath(j.Root), "HOMELAB_MEDIA_FILED_LOG="+FiledLogPath(j.Root))
	c.Stderr = os.Stderr
	// Stopped (Ctrl-C, the app's Stop, the battery): an interrupt, so the
	// engine says where it stopped and saves its progress; then a kill.
	c.Cancel = func() error {
		if runtime.GOOS == "windows" {
			return c.Process.Kill()
		}
		return c.Process.Signal(os.Interrupt)
	}
	c.WaitDelay = 20 * time.Second
	out, err := c.StdoutPipe()
	if err != nil {
		return run, err
	}
	if err := c.Start(); err != nil {
		return run, fmt.Errorf("can't start Python (%s): %w", argv[0], err)
	}
	if a.Power {
		go func() {
			t := time.NewTicker(powerEvery)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					if onBattery() {
						cancel(ErrOnBattery)
						return
					}
				}
			}
		}()
	}
	sc := bufio.NewScanner(out)
	sc.Buffer(make([]byte, 64<<10), 8<<20)
	for sc.Scan() {
		line := sc.Text()
		if j.Log != nil {
			fmt.Fprintln(j.Log, line)
		}
		ev, ok := ParseEvent(line)
		if !ok {
			// status --json prints one object of its own: keep it as the result.
			if strings.HasPrefix(strings.TrimSpace(line), "{") {
				var m map[string]any
				if json.Unmarshal([]byte(line), &m) == nil {
					run.Result = m
				}
			}
			if j.Out != nil {
				j.Out(Event{Type: "info", Text: line}, line)
			}
			continue
		}
		if ev.Type == "fail" && ev.Text != "" {
			run.Why = ev.Text
		}
		if ev.Type == "result" {
			run.Result = ev.Raw
			if b, ok := ev.Raw["ok"].(bool); ok {
				run.OK = b
			}
		}
		if j.Out != nil {
			j.Out(ev, line)
		}
	}
	err = c.Wait()
	_, run.Back = Thrown(j.Root, run.ID)
	if cause := context.Cause(ctx); errors.Is(cause, ErrOnBattery) {
		run.Exit = 130
		return run, ErrOnBattery
	}
	var exit *exec.ExitError
	switch {
	case err == nil:
		if _, said := run.Result["ok"]; !said {
			run.OK = true
		}
	case errors.As(err, &exit):
		run.Exit = exit.ExitCode()
		run.OK = false
		switch run.Exit {
		case 2:
			err = errors.New("some songs are missing: the log lists them (nothing was deleted)")
		case 130:
			err = errors.New("stopped: run it again to carry on where it left off")
		default:
			err = fmt.Errorf("%s %s stopped with an error: the log says why", j.Kind, j.Action)
		}
	}
	return run, err
}

// LogKeep is how long a job's event log stays in logs/media.
const LogKeep = 30 * 24 * time.Hour

// LogFile opens a new event log for a job: logs/media/<kind>-<action>-<time>.jsonl.
// Every command makes one (status and previews too, which the screen asks
// for often), so those older than LogKeep go as it does.
func LogFile(root, kind, action string) (*os.File, error) {
	dir := LogDir(root)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	if old, err := filepath.Glob(filepath.Join(dir, "*.jsonl")); err == nil {
		for _, p := range old {
			if fi, err := os.Stat(p); err == nil && time.Since(fi.ModTime()) > LogKeep {
				_ = os.Remove(p)
			}
		}
	}
	name := fmt.Sprintf("%s-%s-%s.jsonl", kind, action, time.Now().Format("20060102-150405"))
	return os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
}
