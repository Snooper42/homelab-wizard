package battery

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestParsePmset(t *testing.T) {
	for out, want := range map[string][2]bool{
		"Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t59%; discharging": {true, true},
		"Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t100%; charged":         {false, true},
		"Now drawing from 'AC Power'\n":                                                  {false, false},
	} {
		on, known := ParsePmset(out)
		if on != want[0] || known != want[1] {
			t.Errorf("%q: %v %v", out, on, known)
		}
	}
}

func TestLinuxPower(t *testing.T) {
	dir := t.TempDir()
	write := func(name, kind, online string) {
		os.MkdirAll(filepath.Join(dir, name), 0o755)
		os.WriteFile(filepath.Join(dir, name, "type"), []byte(kind+"\n"), 0o644)
		os.WriteFile(filepath.Join(dir, name, "online"), []byte(online+"\n"), 0o644)
	}
	write("AC", "Mains", "0")
	write("BAT0", "Battery", "")
	if on, known := linuxPower(dir); !on || !known {
		t.Fatal("want on battery")
	}
	write("AC", "Mains", "1")
	if on, known := linuxPower(dir); on || !known {
		t.Fatal("want on mains")
	}
}

func TestState(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "battery.json")
	if err := (State{Paused: []string{"sonarr"}}).Save(path); err != nil {
		t.Fatal(err)
	}
	if s := Load(path); len(s.Paused) != 1 {
		t.Fatalf("%+v", s)
	}
	if err := (State{}).Save(path); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("an empty state should remove the file")
	}
}

func TestParseWindowsPower(t *testing.T) {
	for _, c := range []struct {
		ac, flag     byte
		ok           bool
		onBat, known bool
	}{
		{0, 1, true, true, true},       // on battery, charge high
		{1, 8, true, false, true},      // plugged in, charging
		{1, 128, true, false, false},   // a desktop: no battery
		{255, 255, true, false, false}, // unknown
		{0, 1, false, false, false},    // the call failed
	} {
		if onBat, known := parseWindowsPower(c.ac, c.flag, c.ok); onBat != c.onBat || known != c.known {
			t.Errorf("%+v: got %v, %v", c, onBat, known)
		}
	}
}

func TestPath(t *testing.T) {
	if got := Path("root"); got != filepath.Join("root", "data", "battery.json") {
		t.Fatal(got)
	}
}

// Each system's way, on every runner.
func TestPowerEachWay(t *testing.T) {
	power := Power
	oldGOOS, oldPmset, oldSupply := goos, pmset, powerSupply
	t.Cleanup(func() { goos, pmset, powerSupply = oldGOOS, oldPmset, oldSupply })

	goos = "darwin"
	pmset = func() ([]byte, error) {
		return []byte("Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t59%; discharging"), nil
	}
	if on, known := power(); !on || !known {
		t.Errorf("a MacBook on battery: %v %v", on, known)
	}
	pmset = func() ([]byte, error) { return nil, errors.New("not found") }
	if _, known := power(); known {
		t.Error("no pmset, but known")
	}

	goos = "linux"
	powerSupply = filepath.Join(t.TempDir(), "none")
	if _, known := power(); known {
		t.Error("no power supplies, but known")
	}
	powerSupply = t.TempDir()
	os.MkdirAll(filepath.Join(powerSupply, "BAT1"), 0o755)
	os.WriteFile(filepath.Join(powerSupply, "BAT1", "type"), []byte("Battery\n"), 0o644)
	if on, known := power(); !on || !known {
		t.Errorf("a Steam Deck unplugged: %v %v", on, known)
	}

	goos = "plan9"
	if on, known := power(); on || known {
		t.Error("an unknown system")
	}

	// This runner's own answer: whatever it is, on battery only when known.
	goos = runtime.GOOS
	pmset, powerSupply = oldPmset, oldSupply
	if on, known := power(); on && !known {
		t.Errorf("%s: on battery but not known", runtime.GOOS)
	}
}
