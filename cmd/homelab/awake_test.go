package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestParseSleep(t *testing.T) {
	laptop := "Battery Power:\n lowpowermode         0\n sleep                1\n displaysleep         2\nAC Power:\n sleep                10 (sleep prevented by caffeinate)\n displaysleep         10\n"
	if n, ok := parseSleep(laptop); !ok || n != 10 {
		t.Errorf("laptop on power: %d %v", n, ok)
	}
	mini := "AC Power:\n Sleep On Power Button 1\n sleep                0\n"
	if n, ok := parseSleep(mini); !ok || n != 0 {
		t.Errorf("never sleeps: %d %v", n, ok)
	}
	if _, ok := parseSleep("nothing here"); ok {
		t.Error("no sleep line")
	}
}

func TestParseGnomeSleep(t *testing.T) {
	if n, ok := parseGnomeSleep("'suspend'\n", "900\n"); !ok || n != 15 {
		t.Errorf("suspend after 900s: %d %v", n, ok)
	}
	if n, ok := parseGnomeSleep("'nothing'\n", "1200\n"); !ok || n != 0 {
		t.Errorf("never: %d %v", n, ok)
	}
	if n, ok := parseGnomeSleep("'suspend'", "uint32 0"); !ok || n != 0 {
		t.Errorf("no timeout: %d %v", n, ok)
	}
	if _, ok := parseGnomeSleep("", "900"); ok {
		t.Error("no setting")
	}
}

func TestParsePowercfg(t *testing.T) {
	out := `Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)
  Subgroup GUID: 238c9fa8-0aad-41ed-83f4-97be242c8f20  (Sleep)
    GUID Alias: SUB_SLEEP
    Power Setting GUID: 29f6c1db-86da-48c5-9fdb-f2b67b1f44da  (Sleep after)
      GUID Alias: STANDBYIDLE
      Minimum Possible Setting: 0x00000000
      Maximum Possible Setting: 0xffffffff
      Possible Settings increment: 0x00000001
      Possible Settings units: Seconds
    Current AC Power Setting Index: 0x00000708
    Current DC Power Setting Index: 0x00000384
`
	if n, ok := parsePowercfg(out); !ok || n != 30 {
		t.Errorf("30 minutes on power: %d %v", n, ok)
	}
	never := strings.Replace(out, "0x00000708", "0x00000000", 1)
	if n, ok := parsePowercfg(never); !ok || n != 0 {
		t.Errorf("never on power: %d %v", n, ok)
	}
	if _, ok := parsePowercfg("Invalid Parameters -- try \"/?\" for help"); ok {
		t.Error("no setting")
	}
}

func TestOnPowerHoldsOnlyOnPower(t *testing.T) {
	saved := powerEvery
	powerEvery = time.Millisecond
	t.Cleanup(func() { powerEvery = saved })
	// On power, then battery, then power again, then a desktop that
	// cannot tell.
	readings := []bool{false, false, true, true, false, false}
	var mu sync.Mutex
	var log []string
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	i := 0
	power := func() (bool, bool) {
		mu.Lock()
		defer mu.Unlock()
		if i >= len(readings) {
			cancel()
			return false, false
		}
		i++
		return readings[i-1], true
	}
	hold := func() (func(), <-chan error, error) {
		mu.Lock()
		log = append(log, "hold")
		mu.Unlock()
		return func() { mu.Lock(); log = append(log, "release"); mu.Unlock() }, nil, nil
	}
	if err := onPower(ctx, power, hold); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(log, " "); got != "hold release hold release" {
		t.Errorf("got %q, want a hold on power, let go on battery, held again, let go at the end", got)
	}
}

func TestOnPowerEndsWhenTheHoldStops(t *testing.T) {
	ended := make(chan error, 1)
	ended <- errors.New("systemd-inhibit: exit status 1")
	err := onPower(context.Background(), func() (bool, bool) { return false, false }, func() (func(), <-chan error, error) {
		return func() { t.Error("released a hold that had ended") }, ended, nil
	})
	if err == nil || !strings.Contains(err.Error(), "exit status 1") {
		t.Errorf("got %v", err)
	}
}

func TestPlasmaSleep(t *testing.T) {
	six := "[AC][Display]\nTurnOffDisplayIdleTimeoutSec=600\n\n[AC][SuspendAndShutdown]\nAutoSuspendAction=1\nAutoSuspendIdleTimeoutSec=900\n"
	if n, ok := parsePlasma6Sleep(six); !ok || n != 15 {
		t.Errorf("Plasma 6, sleep after 900s: %d %v", n, ok)
	}
	if n, ok := parsePlasma6Sleep("[AC][SuspendAndShutdown]\nAutoSuspendAction=0\n"); !ok || n != 0 {
		t.Errorf("Plasma 6, do nothing: %d %v", n, ok)
	}
	if _, ok := parsePlasma6Sleep("[Battery][SuspendAndShutdown]\nAutoSuspendAction=1\n"); ok {
		t.Error("Plasma 6 with the AC setting left at its default is not known")
	}
	five := "[AC]\nicon=battery-charging\n\n[AC][DPMSControl]\nidleTime=600\n\n[AC][SuspendSession]\nidleTime=1200000\nsuspendType=1\n\n[Battery][SuspendSession]\nidleTime=300000\n"
	if n, ok := parsePlasma5Sleep(five); !ok || n != 20 {
		t.Errorf("Plasma 5, suspend after 20 minutes: %d %v", n, ok)
	}
	if n, ok := parsePlasma5Sleep("[AC]\nicon=battery-charging\n\n[AC][DPMSControl]\nidleTime=600\n"); !ok || n != 0 {
		t.Errorf("Plasma 5 without a suspend on AC never sleeps: %d %v", n, ok)
	}

	dir := t.TempDir()
	if _, ok := plasmaSleep(dir); ok {
		t.Error("no files: not known")
	}
	if err := os.WriteFile(filepath.Join(dir, "powermanagementprofilesrc"), []byte(five), 0o644); err != nil {
		t.Fatal(err)
	}
	if n, ok := plasmaSleep(dir); !ok || n != 20 {
		t.Errorf("Plasma 5's file: %d %v", n, ok)
	}
	if err := os.WriteFile(filepath.Join(dir, "powerdevilrc"), []byte(six), 0o644); err != nil {
		t.Fatal(err)
	}
	if n, ok := plasmaSleep(dir); !ok || n != 15 {
		t.Errorf("Plasma 6's file comes first: %d %v", n, ok)
	}
}
