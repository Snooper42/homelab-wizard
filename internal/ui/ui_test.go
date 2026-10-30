package ui

import (
	"bufio"
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
)

func TestStatusLines(t *testing.T) {
	var out bytes.Buffer
	u := &UI{Out: &out}
	u.Title("Backups")
	u.OK("%d apps backed up", 3)
	u.Warn("Duplicati has not run since %s", "Monday")
	u.Fail("%s did not start", "paperless")
	u.Info("next run at %s", "02:00")
	u.Println("done")
	want := "\nBackups\n  ✓ 3 apps backed up\n  ! Duplicati has not run since Monday\n  ✗ paperless did not start\n  • next run at 02:00\ndone\n"
	if out.String() != want {
		t.Fatalf("got\n%q\nwant\n%q", out.String(), want)
	}

	out.Reset()
	u.Color = true
	u.OK("fine")
	if got := out.String(); got != "  \x1b[32m✓\x1b[0m fine\n" {
		t.Fatalf("colored: %q", got)
	}
	for _, c := range []struct{ got, code string }{{u.Bold("x"), "1"}, {u.Dim("x"), "2"}, {u.Yellow("x"), "33"}, {u.Red("x"), "31"}, {u.Cyan("x"), "36"}} {
		if c.got != "\x1b["+c.code+"mx\x1b[0m" {
			t.Errorf("%q, want code %s", c.got, c.code)
		}
	}
}

func TestAskAndConfirm(t *testing.T) {
	var out bytes.Buffer
	ask := func(in string) *UI { return &UI{Out: &out, In: bufio.NewReader(strings.NewReader(in))} }
	if got, err := ask("  vikunja \n").Ask("Which app?"); err != nil || got != "vikunja" || out.String() != "Which app? " {
		t.Fatalf("%q %v, printed %q", got, err, out.String())
	}
	if got, err := ask("no newline").Ask("?"); err != nil || got != "no newline" {
		t.Fatalf("the last line without a newline: %q %v", got, err)
	}
	if _, err := ask("").Ask("?"); err == nil {
		t.Fatal("no input is an error")
	}
	for in, want := range map[string][2]bool{
		"\n":     {true, false}, // the default
		"y\n":    {true, true},
		"YES\n":  {true, true},
		"n\n":    {false, false},
		"what\n": {false, false},
		"":       {false, false}, // stdin closed: never a yes
	} {
		if got := ask(in).Confirm("Go?", true); got != want[0] {
			t.Errorf("%q with yes by default: %v", in, got)
		}
		if got := ask(in).Confirm("Go?", false); got != want[1] {
			t.Errorf("%q with no by default: %v", in, got)
		}
	}
	out.Reset()
	ask("\n").Confirm("Go?", false)
	if out.String() != "Go? [y/N] " {
		t.Errorf("the prompt: %q", out.String())
	}
}

func TestStep(t *testing.T) {
	var out bytes.Buffer
	u := &UI{Out: &out}
	u.Step(2, 5, "Updating %s", "vikunja")
	if out.String() != "  [2/5] Updating vikunja\n" {
		t.Fatalf("in a terminal: %q", out.String())
	}
	for _, u := range []*UI{{Out: &out, JSON: true}, {Out: &out, Progress: true}} {
		out.Reset()
		u.Step(2, 5, "Updating %s", "vikunja")
		if want := `{"schema":1,"type":"step","data":{"n":2,"total":5,"text":"Updating vikunja"}}` + "\n"; out.String() != want {
			t.Errorf("for the app: %q", out.String())
		}
	}
}

func TestShowPicker(t *testing.T) {
	app := func(id, desc string) *catalog.App {
		return &catalog.App{Service: &compose.Service{ID: id, Meta: compose.Meta{Description: desc}}}
	}
	groups := []catalog.Group{
		{Label: "Media", Apps: []*catalog.App{app("jellyfin", "Films and series"), app("navidrome", "Music")}},
		{Label: "Passwords", Apps: []*catalog.App{app("vaultwarden", "Passwords")}},
	}
	var out bytes.Buffer
	u := &UI{Out: &out}
	items := u.ShowPicker(groups, func(a *catalog.App) string {
		if a.ID == "jellyfin" {
			return "running"
		}
		return ""
	})
	if len(items) != 3 || items[2].App.ID != "vaultwarden" || items[0].Status != "running" {
		t.Fatalf("%+v", items)
	}
	for _, want := range []string{"\n  Media\n", "    1  jellyfin", "Films and series  [running]", "    3  vaultwarden", "\n  Passwords\n"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("no %q in\n%s", want, out.String())
		}
	}
	if strings.Contains(out.String(), "Music  [") {
		t.Error("an app with no status shows brackets")
	}
}

// A job started by launchd, the Run key, or systemd gets /dev/null as
// stdin: not a terminal, so nothing waits for an answer.
func TestNotATerminal(t *testing.T) {
	null, err := os.Open(os.DevNull)
	if err != nil {
		t.Fatal(err)
	}
	defer null.Close()
	file, _ := os.Create(filepath.Join(t.TempDir(), "out"))
	defer file.Close()
	if IsTTY(null) || IsTTY(file) {
		t.Fatal("the null device or a file taken for a terminal")
	}
	t.Setenv("HOMELAB_PROGRESS", "json")
	u := New()
	if u.Out != os.Stdout || !u.Progress {
		t.Fatalf("%+v", u)
	}
	if !IsTTY(os.Stdout) && u.Color {
		t.Error("colors on output that is not a terminal")
	}
}

// A step that says how far it is: a percent for the app, one line drawn
// again in a terminal, nothing in a log.
func TestStepPercent(t *testing.T) {
	var out bytes.Buffer
	(&UI{Out: &out, Progress: true}).StepPercent(1, 3, 0, "Downloading %s", "Docker")
	if want := `{"schema":1,"type":"step","data":{"n":1,"total":3,"text":"Downloading Docker","percent":1}}` + "\n"; out.String() != want {
		t.Errorf("for the app: %q", out.String())
	}
	out.Reset()
	live := &UI{Out: &out, Live: true}
	live.StepPercent(1, 3, 45, "Downloading Docker")
	live.StepPercent(1, 3, 130, "Downloading Docker")
	if want := "\r\x1b[K  [1/3] Downloading Docker · 45%\r\x1b[K  [1/3] Downloading Docker · 100%\n"; out.String() != want {
		t.Errorf("in a terminal: %q", out.String())
	}
	out.Reset()
	(&UI{Out: &out}).StepPercent(1, 3, 45, "Downloading Docker")
	if out.Len() != 0 {
		t.Errorf("in a log: %q", out.String())
	}
}
