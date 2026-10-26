// Package crash keeps what a crash of the app, the menu bar item, or the
// background agent leaves behind: Go writes an unrecovered panic or a
// fatal error, with every goroutine's stack, to the file Watch hands it,
// and the next look (the process starting again, Status, homelab report)
// saves it as scripts/logs/crash-<date>.log.
package crash

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime/debug"
	"sort"
	"strings"
	"time"
)

// Crash is the newest crash on record.
type Crash struct {
	// Who stopped: "the app", "the menu bar item", or "the background agent".
	Who     string    `json:"who"`
	Version string    `json:"version,omitempty"`
	When    time.Time `json:"when"`
	// Doing is the call the crash happened in, in Go's words
	// ("main.(*homelab).watchdog"), when the stack names one.
	Doing string `json:"doing,omitempty"`
	// File is the crash log, relative to the homelab folder.
	File string `json:"file"`
}

// roles are the processes that keep a crash file, by their short name.
var roles = map[string]string{"app": "the app", "tray": "the menu bar item", "agent": "the background agent"}

const header = "== "

func pending(dir, who string) string { return filepath.Join(dir, "crash-"+who+".pending") }

// Watch saves a crash the last run of who left (Save), then hands Go a
// fresh file for this run's: a header (who, version, when it started) and,
// should it crash, Go's report under it. A run that ends normally leaves
// the header alone, which the next Watch or Save drops. who is "app",
// "tray", or "agent".
func Watch(dir, who, version string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	Save(dir)
	f, err := os.Create(pending(dir, who))
	if err != nil {
		return err
	}
	fmt.Fprintf(f, "%s%s %s, started %s, process %d\n", header, roles[who], version, time.Now().Format(time.RFC3339), os.Getpid())
	return debug.SetCrashOutput(f, debug.CrashOptions{})
}

// Save moves each crash a pending file holds into crash-<date>.log (the
// day it crashed, added to that day's file). A pending file with nothing
// after its header belongs to a run that is still going or ended
// normally, and is left as it is.
func Save(dir string) {
	files, _ := filepath.Glob(filepath.Join(dir, "crash-*.pending"))
	for _, p := range files {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		head, rest, _ := strings.Cut(string(data), "\n")
		if strings.TrimSpace(rest) == "" {
			continue
		}
		when := time.Now()
		if fi, err := os.Stat(p); err == nil {
			when = fi.ModTime()
		}
		out := filepath.Join(dir, "crash-"+when.Format("2006-01-02")+".log")
		f, err := os.OpenFile(out, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			continue
		}
		fmt.Fprintf(f, "%s\nstopped unexpectedly %s\n", head, when.Format(time.RFC3339))
		if doing := doingIn(rest); doing != "" {
			fmt.Fprintf(f, "while in %s\n", doing)
		}
		fmt.Fprintf(f, "\n%s\n", strings.TrimRight(rest, "\n"))
		if f.Close() == nil {
			os.Remove(p)
		}
	}
}

// Newest is the latest crash saved in dir (after saving any left pending),
// and false when there is none.
func Newest(dir string) (Crash, bool) {
	Save(dir)
	files, _ := filepath.Glob(filepath.Join(dir, "crash-????-??-??.log"))
	if len(files) == 0 {
		return Crash{}, false
	}
	sort.Strings(files)
	path := files[len(files)-1]
	f, err := os.Open(path)
	if err != nil {
		return Crash{}, false
	}
	defer f.Close()
	// The file's last crash: its header, when it stopped, what it was in.
	var c Crash
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64<<10), 4<<20)
	for sc.Scan() {
		line := sc.Text()
		switch {
		case strings.HasPrefix(line, header):
			c = Crash{}
			if m := headerRe.FindStringSubmatch(line); m != nil {
				c.Who, c.Version = m[1], m[2]
			}
		case strings.HasPrefix(line, "stopped unexpectedly "):
			c.When, _ = time.Parse(time.RFC3339, strings.TrimPrefix(line, "stopped unexpectedly "))
		case strings.HasPrefix(line, "while in "):
			c.Doing = strings.TrimPrefix(line, "while in ")
		}
	}
	if c.When.IsZero() {
		return Crash{}, false
	}
	c.File = filepath.ToSlash(filepath.Join("scripts", "logs", filepath.Base(path)))
	return c, true
}

var headerRe = regexp.MustCompile(`^== (.+?) (\S+), started `)

// doingIn is the function the panic or fatal error happened in: the first
// frame of the first goroutine Go printed that is not the runtime's own.
func doingIn(report string) string {
	lines := strings.Split(report, "\n")
	for i, l := range lines {
		if !strings.HasPrefix(l, "goroutine ") {
			continue
		}
		for _, f := range lines[i+1:] {
			if f == "" {
				return ""
			}
			if strings.HasPrefix(f, "\t") || strings.HasPrefix(f, "panic(") || strings.HasPrefix(f, "runtime.") {
				continue
			}
			name, _, _ := strings.Cut(f, "(")
			return name
		}
		return ""
	}
	return ""
}
