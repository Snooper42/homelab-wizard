package media

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// Check is one preflight check, in plain words, with its fix.
type Check struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	OK    bool   `json:"ok"`
	Note  string `json:"note,omitempty"`
	Fix   string `json:"fix,omitempty"`
	Needs string `json:"needs,omitempty"` // which kinds can't run without it: "all", "video", "books"...
}

// Probe is how preflight looks at this machine; tests replace its parts.
type Probe struct {
	GOOS     string
	LookPath func(string) (string, error)
	Output   func(ctx context.Context, name string, args ...string) (string, error)
	Stat     func(string) (os.FileInfo, error)
	// Runtime reports whether the container runtime answers.
	Runtime func(ctx context.Context) error
	// Power reports whether this machine runs on battery now.
	Power func() (onBattery, known bool)
}

// DefaultProbe looks at this machine.
func DefaultProbe() Probe {
	return Probe{GOOS: runtime.GOOS, LookPath: exec.LookPath, Stat: os.Stat,
		Output: func(ctx context.Context, name string, args ...string) (string, error) {
			ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
			defer cancel()
			out, err := procattr.Hide(exec.CommandContext(ctx, name, args...)).CombinedOutput()
			return string(out), err
		},
		Power: func() (bool, bool) { b, k := onBatteryKnown(); return b, k }}
}

var onBatteryKnown = func() (bool, bool) { return onBattery(), true }

// Python finds Python 3.8 or newer: on Windows the py launcher or python;
// on a Mac Homebrew's first, and Apple's only when its developer tools are
// installed (running /usr/bin/python3 without them opens an install prompt).
func (p Probe) Python(ctx context.Context) ([]string, string) {
	var cands [][]string
	switch p.GOOS {
	case "windows":
		cands = [][]string{{"py", "-3"}, {"python"}, {"python3"}}
	case "darwin":
		for _, b := range []string{"/opt/homebrew/bin/python3", "/usr/local/bin/python3"} {
			if _, err := p.Stat(b); err == nil {
				cands = append(cands, []string{b})
			}
		}
		if _, err := p.Stat("/Library/Developer/CommandLineTools/usr/bin/python3"); err == nil {
			cands = append(cands, []string{"/usr/bin/python3"})
		} else if out, err := p.Output(ctx, "xcode-select", "-p"); err == nil && strings.TrimSpace(out) != "" {
			cands = append(cands, []string{"/usr/bin/python3"})
		}
	default:
		cands = [][]string{{"python3"}, {"python"}}
	}
	for _, c := range cands {
		// A full path was found by Stat already; /opt/... is one on a Mac
		// even when this runs elsewhere (Windows calls it relative).
		if !filepath.IsAbs(c[0]) && !strings.HasPrefix(c[0], "/") {
			if _, err := p.LookPath(c[0]); err != nil {
				continue
			}
		}
		out, err := p.Output(ctx, c[0], append(c[1:], "-c", "import sys; print('%d.%d' % sys.version_info[:2])")...)
		v := strings.TrimSpace(out)
		if err == nil && versionAtLeast(v, 3, 8) {
			return c, v
		}
	}
	return nil, ""
}

func versionAtLeast(v string, major, minor int) bool {
	a, b, ok := strings.Cut(v, ".")
	if !ok {
		return false
	}
	ma, mi := atoi(a), atoi(b)
	return ma > major || ma == major && mi >= minor
}

func atoi(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			break
		}
		n = n*10 + int(c-'0')
	}
	return n
}

// LocalEngine reports whether Python can make the venv beets installs into.
func (p Probe) LocalEngine(ctx context.Context, py []string) bool {
	if py == nil {
		return false
	}
	_, err := p.Output(ctx, py[0], append(py[1:], "-c", "import venv, ensurepip")...)
	return err == nil
}

// GPU reports a graphics card Tdarr's node can use: NVIDIA (nvidia-smi),
// or Intel/AMD through /dev/dri on Linux. A Mac's GPU isn't reachable from
// a container, so Tdarr transcodes there on the processor.
func (p Probe) GPU(ctx context.Context) (bool, string) {
	if _, err := p.LookPath("nvidia-smi"); err == nil {
		if out, err := p.Output(ctx, "nvidia-smi", "--query-gpu=name", "--format=csv,noheader"); err == nil && strings.TrimSpace(out) != "" {
			return true, strings.TrimSpace(strings.Split(out, "\n")[0])
		}
	}
	if p.GOOS == "linux" {
		if _, err := p.Stat("/dev/dri/renderD128"); err == nil {
			return true, "Intel or AMD graphics (/dev/dri)"
		}
	}
	return false, ""
}

// Preflight checks what Tidy Up needs before a run.
func Preflight(ctx context.Context, p Probe, env map[string]string, home string) []Check {
	var out []Check
	py, v := p.Python(ctx)
	pyFix := map[string]string{
		"darwin":  "Install Python 3: brew install python (or the installer from python.org)",
		"windows": "Install Python 3 from python.org or the Microsoft Store (winget install Python.Python.3.12)",
	}[p.GOOS]
	if pyFix == "" {
		pyFix = "Install Python 3 with your package manager (sudo apt install python3 python3-venv)"
	}
	out = append(out, Check{ID: "python", Name: "Python 3", OK: py != nil, Note: ifs(py != nil, "Python "+v, "Not found"), Fix: ifs(py == nil, pyFix, ""), Needs: "all"})

	root := expand(or(env["MEDIA_ROOT"], "/Volumes/Media"), home)
	_, err := p.Stat(root)
	drive := filepath.Base(root)
	if vol := filepath.VolumeName(root); vol != "" && len(root) <= 3 {
		drive = vol
	}
	out = append(out, Check{ID: "drive", Name: "The " + drive + " drive", OK: err == nil, Note: ifs(err == nil, root, root+" isn't there"),
		Fix: ifs(err != nil, "Plug in the media drive (or set MEDIA_ROOT in Settings)", ""), Needs: "all"})

	rtErr := error(nil)
	if p.Runtime != nil {
		rtErr = p.Runtime(ctx)
	}
	rtName := host.For(p.GOOS).Runtime
	out = append(out, Check{ID: "runtime", Name: rtName, OK: rtErr == nil, Note: ifs(rtErr == nil, "Running", "Not running"),
		Fix: ifs(rtErr != nil, "Start "+rtName+": it pauses Navidrome and Calibre-Web while files move, and runs Tdarr", "")})

	gpu, name := p.GPU(ctx)
	out = append(out, Check{ID: "gpu", Name: "Graphics for transcoding", OK: true,
		Note: ifs(gpu, name+": Tdarr transcodes on it", "None found: Tdarr transcodes on the processor (slower, same result)")})

	if p.Power != nil {
		onBat, known := p.Power()
		out = append(out, Check{ID: "power", Name: "Power", OK: !onBat, Note: ifs(!known, "Plugged in (no battery)", ifs(onBat, "On battery", "Plugged in")),
			Fix: ifs(onBat, "Plug in: big jobs wait for power, and stop on battery", ""), Needs: "heavy"})
	}

	for _, t := range []struct{ id, bin, name, fix, needs string }{
		{"ffmpeg", "ffmpeg", "ffmpeg and ffprobe", "Install ffmpeg (brew install ffmpeg, winget install Gyan.FFmpeg, or apt install ffmpeg)", "video"},
		{"ffsubsync", "ffsubsync", "ffsubsync (subtitle timing)", "pip install ffsubsync: subtitles are kept either way, aligned only with it", ""},
		{"m4b-tool", "m4b-tool", "m4b-tool", "Optional: ffmpeg merges audiobooks without it", ""},
		{"calibredb", "calibredb", "Calibre's tools", "Install the Calibre app (Calibre-Web doesn't include its tools)", "books"},
	} {
		_, err := p.LookPath(t.bin)
		if t.id == "calibredb" {
			err = nil
			if _, ok := CalibreDir(p, env, home); !ok {
				err = os.ErrNotExist
			}
		}
		out = append(out, Check{ID: t.id, Name: t.name, OK: err == nil, Note: ifs(err == nil, "Installed", "Not installed"),
			Fix: ifs(err != nil, t.fix, ""), Needs: t.needs})
	}
	return out
}

// Blocking is the first failed check that kind needs, or nil.
func Blocking(checks []Check, kind string, heavy bool) *Check {
	for i, c := range checks {
		if c.OK {
			continue
		}
		switch c.Needs {
		case "all":
		case "heavy":
			if !heavy {
				continue
			}
		case "video":
			if kind != "movies" && kind != "tv" && kind != "audiobooks" {
				continue
			}
		case "":
			continue
		default:
			if c.Needs != kind {
				continue
			}
		}
		return &checks[i]
	}
	return nil
}

func ifs(c bool, a, b string) string {
	if c {
		return a
	}
	return b
}

// TrashName is where deleted files go on goos, in its own word.
func TrashName(goos string) string {
	if goos == "windows" {
		return "the Recycle Bin"
	}
	return "the Trash"
}
