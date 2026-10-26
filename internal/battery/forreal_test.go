//go:build forreal

package battery

import (
	"os"
	"runtime"
	"testing"
)

// The power state read on the machine this runs on, through each system's
// own source: pmset on macOS, GetSystemPowerStatus on Windows, the
// kernel's power supplies on Linux. A runner is a machine on mains power,
// often without a battery: each source must answer, and never say it is
// on battery. CI runs it on each system's runner (go test -tags forreal).
func TestPowerStateForReal(t *testing.T) {
	switch runtime.GOOS {
	case "darwin":
		if out, err := pmset(); err != nil {
			t.Fatalf("pmset -g batt: %v\n%s", err, out)
		}
	case "windows":
		if _, _, ok := windowsPowerStatus(); !ok {
			t.Fatal("GetSystemPowerStatus did not answer")
		}
	case "linux":
		if _, err := os.ReadDir(powerSupply); err != nil {
			t.Fatalf("the power supplies: %v", err)
		}
	default:
		t.Fatalf("no power state to read on %s", runtime.GOOS)
	}
	onBattery, known := Power()
	t.Logf("on battery: %v (known: %v)", onBattery, known)
	if onBattery {
		t.Fatal("a machine on mains power reads as on battery")
	}
}
