package awake

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestRule(t *testing.T) {
	r := Rule("deck")
	for _, want := range []string{`"org.freedesktop.login1.inhibit-block-sleep"`, `subject.user == "deck"`, "polkit.Result.YES", "homelab awake allow --undo"} {
		if !strings.Contains(r, want) {
			t.Errorf("the rule lacks %s:\n%s", want, r)
		}
	}
	l := LegacyRule("deck")
	for _, want := range []string{"Identity=unix-user:deck", "Action=org.freedesktop.login1.inhibit-block-sleep", "ResultAny=yes"} {
		if !strings.Contains(l, want) {
			t.Errorf("the legacy rule lacks %s:\n%s", want, l)
		}
	}
}

func TestScript(t *testing.T) {
	s, err := Script("deck")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(s, "cat > '"+RulePath+"' <<'HOMELAB_EOF'\n"+Rule("deck")+"HOMELAB_EOF\n") || !strings.Contains(s, "chmod 644 '"+RulePath+"'") {
		t.Errorf("the script does not write the rule:\n%s", s)
	}
	for _, bad := range []string{"", "a b", "x'; rm -rf /", "$(id)", "-root"} {
		if _, err := Script(bad); err == nil {
			t.Errorf("Script(%q) took it", bad)
		}
	}
	if u := UndoScript(); !strings.Contains(u, RulePath) || !strings.Contains(u, LegacyPath) {
		t.Errorf("the undo leaves a rule: %s", u)
	}
}

func TestListed(t *testing.T) {
	list := `WHO            UID  USER PID  COMM            WHAT         WHY                                  MODE
ModemManager   0    root 812  ModemManager    sleep        ModemManager needs to reset devices  delay
homelab        1000 deck 4242 systemd-inhibit sleep   Keeps the homelab's apps reachable   block

2 inhibitors listed.
`
	if !Listed(list) {
		t.Error("homelab's block is not seen")
	}
	if Listed(strings.Replace(list, "homelab ", "someone", 1)) {
		t.Error("another program's block is taken for homelab's")
	}
	if Listed("homelab 1000 deck 1 systemd-inhibit sleep why delay\n") {
		t.Error("a delay is taken for a block")
	}
}

func TestMark(t *testing.T) {
	old := marker
	t.Cleanup(func() { marker = old })
	p := filepath.Join(t.TempDir(), "settings", "awake-allowed")
	marker = func() string { return p }
	if Allowed() {
		t.Fatal("allowed before the mark")
	}
	if err := Mark(true); err != nil || !Allowed() {
		t.Fatalf("marked: %v %v", err, Allowed())
	}
	if err := Mark(false); err != nil || Allowed() {
		t.Fatalf("unmarked: %v %v", err, Allowed())
	}
	if err := Mark(false); err != nil {
		t.Errorf("unmarking twice: %v", err)
	}
}

func TestScriptForOlderPolkit(t *testing.T) {
	old := legacyDir
	t.Cleanup(func() { legacyDir = old })
	legacyDir = t.TempDir()
	s, err := Script("deck")
	if err != nil || !strings.Contains(s, "cat > '"+LegacyPath+"' <<'HOMELAB_EOF'\n"+LegacyRule("deck")) {
		t.Fatalf("with older polkit's folder, the script writes no .pkla: %v\n%s", err, s)
	}
}

func TestHeldAndRefused(t *testing.T) {
	oldList, oldPower := inhibitors, power
	t.Cleanup(func() { inhibitors, power = oldList, oldPower })
	ctx := context.Background()
	list, listErr := "", error(nil)
	inhibitors = func(context.Context) (string, error) { return list, listErr }
	onBattery := false
	power = func() (bool, bool) { return onBattery, true }

	list = "homelab 1000 deck 1 systemd-inhibit sleep why block\n"
	if held, known := Held(ctx); !held || !known {
		t.Errorf("held: %v %v", held, known)
	}
	if Refused(ctx) {
		t.Error("refused while held")
	}
	list = "1 inhibitors listed.\n"
	if held, known := Held(ctx); held || !known {
		t.Errorf("not held: %v %v", held, known)
	}
	if want := runtime.GOOS == "linux"; Refused(ctx) != want {
		t.Errorf("not held, on power: refused %v, want %v", !want, want)
	}
	onBattery = true
	if Refused(ctx) {
		t.Error("refused on battery, where the job holds nothing by design")
	}
	onBattery, listErr = false, errors.New("no logind")
	if _, known := Held(ctx); known || Refused(ctx) {
		t.Error("without logind's list it is not known, so not refused")
	}
}

func TestUser(t *testing.T) {
	t.Setenv("USER", "deck")
	if User() != "deck" {
		t.Errorf("User() = %q", User())
	}
	os.Unsetenv("USER")
	if User() == "" {
		t.Error("no account without $USER")
	}
}
