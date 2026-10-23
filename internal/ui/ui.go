// Package ui renders terminal output: colors, tables, prompts, and the app picker.
package ui

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"unicode/utf8"
)

// UI writes to a terminal (or any writer) and reads answers.
type UI struct {
	Out   io.Writer
	In    *bufio.Reader
	Color bool
	// Interactive is true when stdin is a terminal.
	Interactive bool
	// JSON switches commands that support it to one JSON object per line.
	JSON bool
	// Progress writes each Step as a JSON line the desktop app reads
	// (HOMELAB_PROGRESS=json), instead of as text.
	Progress bool
}

// New returns a UI on stdin/stdout.
func New() *UI {
	color := isTTY(os.Stdout) && os.Getenv("NO_COLOR") == "" && os.Getenv("TERM") != "dumb"
	return &UI{Out: os.Stdout, In: bufio.NewReader(os.Stdin), Color: color, Interactive: isTTY(os.Stdin), Progress: os.Getenv("HOMELAB_PROGRESS") == "json"}
}

// isTTY reports whether f is a terminal. /dev/null is a character device
// too (launchd jobs get it as stdin), so it is ruled out explicitly.
func isTTY(f *os.File) bool {
	st, err := f.Stat()
	if err != nil || st.Mode()&os.ModeCharDevice == 0 {
		return false
	}
	if null, err := os.Stat(os.DevNull); err == nil && os.SameFile(st, null) {
		return false
	}
	return true
}

func (u *UI) paint(code, s string) string {
	if !u.Color {
		return s
	}
	return "\033[" + code + "m" + s + "\033[0m"
}

// Bold, Dim, Green, Yellow, Red, Cyan style text.
func (u *UI) Bold(s string) string   { return u.paint("1", s) }
func (u *UI) Dim(s string) string    { return u.paint("2", s) }
func (u *UI) Green(s string) string  { return u.paint("32", s) }
func (u *UI) Yellow(s string) string { return u.paint("33", s) }
func (u *UI) Red(s string) string    { return u.paint("31", s) }
func (u *UI) Cyan(s string) string   { return u.paint("36", s) }

// Printf writes formatted output.
func (u *UI) Printf(format string, args ...any) { fmt.Fprintf(u.Out, format, args...) }

// Println writes a line.
func (u *UI) Println(args ...any) { fmt.Fprintln(u.Out, args...) }

// Title prints a section heading.
func (u *UI) Title(s string) { u.Printf("\n%s\n", u.Bold(s)) }

// OK, Warn, Fail, Info print status lines.
func (u *UI) OK(format string, args ...any) {
	u.Printf("  %s %s\n", u.Green("✓"), fmt.Sprintf(format, args...))
}
func (u *UI) Warn(format string, args ...any) {
	u.Printf("  %s %s\n", u.Yellow("!"), fmt.Sprintf(format, args...))
}
func (u *UI) Fail(format string, args ...any) {
	u.Printf("  %s %s\n", u.Red("✗"), fmt.Sprintf(format, args...))
}
func (u *UI) Info(format string, args ...any) {
	u.Printf("  %s %s\n", u.Dim("•"), fmt.Sprintf(format, args...))
}

var ansi = regexp.MustCompile("\x1b\\[[0-9;]*m")

// visible is a cell's width on screen, without its color codes.
func visible(s string) int { return utf8.RuneCountInString(ansi.ReplaceAllString(s, "")) }

// Table prints aligned rows. Widths ignore color codes, so colored and
// plain cells line up.
func (u *UI) Table(header []string, rows [][]string) {
	all := rows
	if len(header) > 0 {
		h := make([]string, len(header))
		for i, c := range header {
			h[i] = u.Dim(c)
		}
		all = append([][]string{h}, rows...)
	}
	var widths []int
	for _, r := range all {
		for i, c := range r {
			if i == len(widths) {
				widths = append(widths, 0)
			}
			widths[i] = max(widths[i], visible(c))
		}
	}
	for _, r := range all {
		var b strings.Builder
		b.WriteString("  ")
		for i, c := range r {
			b.WriteString(c)
			if i < len(r)-1 {
				b.WriteString(strings.Repeat(" ", widths[i]-visible(c)+2))
			}
		}
		fmt.Fprintln(u.Out, strings.TrimRight(b.String(), " "))
	}
}

// Ask prints a prompt and returns the trimmed answer.
func (u *UI) Ask(prompt string) (string, error) {
	u.Printf("%s ", prompt)
	line, err := u.In.ReadString('\n')
	if err != nil && line == "" {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

// Confirm asks a yes/no question; def is the answer on empty input.
func (u *UI) Confirm(prompt string, def bool) bool {
	hint := "[y/N]"
	if def {
		hint = "[Y/n]"
	}
	ans, err := u.Ask(fmt.Sprintf("%s %s", prompt, u.Dim(hint)))
	if err != nil {
		return false
	}
	switch strings.ToLower(ans) {
	case "":
		return def
	case "y", "yes":
		return true
	}
	return false
}

// StepEvent is one Step as JSON: {"schema": 1, "type": "step", "data": ...}.
type StepEvent struct {
	N     int    `json:"n"`
	Total int    `json:"total"`
	Text  string `json:"text"`
}

// Step says a longer job is at step n of total ("Updating vikunja"). In a
// terminal it is a line ("[2/5] Updating vikunja"); with --json or for the
// desktop app (Progress) it is a JSON line the app shows as a progress bar.
func (u *UI) Step(n, total int, format string, args ...any) {
	text := fmt.Sprintf(format, args...)
	if u.JSON || u.Progress {
		line, _ := json.Marshal(struct {
			Schema int       `json:"schema"`
			Type   string    `json:"type"`
			Data   StepEvent `json:"data"`
		}{1, "step", StepEvent{n, total, text}})
		u.Printf("%s\n", line)
		return
	}
	u.Printf("  %s %s\n", u.Dim(fmt.Sprintf("[%d/%d]", n, total)), text)
}
