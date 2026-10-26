// Package diskhealth reads each drive's own health report (SMART) through
// smartctl, so a failing disk is noticed before it takes the photos or the
// databases with it. Containers cannot read a Mac's disks, so this runs on
// the host; smartctl comes from smartmontools (Install says how).
package diskhealth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// ErrNoSmartctl means smartctl is not installed.
var ErrNoSmartctl = errors.New("smartctl is not installed")

// Install is how to get smartctl on each system; SteamOS's read-only
// system has no package to add.
func Install(goos string, steamOS bool) string {
	switch {
	case goos == "darwin":
		return "brew install smartmontools"
	case goos == "windows":
		return "install smartmontools from smartmontools.org, then run doctor as an administrator (reading a drive needs one)"
	case steamOS:
		return "SteamOS has no smartctl of its own, and its system cannot take packages; the watchdog's disk space checks still run"
	}
	return "sudo apt install smartmontools (dnf or pacman elsewhere)"
}

// Runner runs smartctl with args and returns its standard output. smartctl
// exits non-zero for warnings as well as errors, so output is used whenever
// there is some.
type Runner func(ctx context.Context, args ...string) ([]byte, error)

// Disk is one drive's report.
type Disk struct {
	Device string
	Model  string
	// Readable is false when the drive gives no report (often a USB
	// enclosure that does not pass SMART through, or no permission).
	Readable bool
	Why      string // why it is not readable
	Passed   bool   // the drive's own overall assessment
	// Warnings are early signs worth replacing the drive over, even while
	// it passes: reallocated or pending sectors, media errors, wear.
	Warnings []string
	TempC    int
	Hours    int
}

// Failing is a drive that says it is failing.
func (d Disk) Failing() bool { return d.Readable && !d.Passed }

// Label is the model, or the device when the model is unknown.
func (d Disk) Label() string {
	if d.Model != "" {
		return d.Model
	}
	return d.Device
}

// Describe is one line for people: "passed, 38°C, 1,204 hours".
func (d Disk) Describe() string {
	if !d.Readable {
		return "no health report: " + d.Why
	}
	parts := []string{"passed"}
	if !d.Passed {
		parts[0] = "FAILING (the drive's own assessment): copy what matters off it now"
	}
	parts = append(parts, d.Warnings...)
	if d.TempC > 0 {
		parts = append(parts, fmt.Sprintf("%d°C", d.TempC))
	}
	if d.Hours > 0 {
		parts = append(parts, fmt.Sprintf("%d hours on", d.Hours))
	}
	return strings.Join(parts, ", ")
}

// Smartctl finds smartctl on PATH or where Homebrew and Linux put it (jobs
// started by launchd have a short PATH).
func Smartctl() (string, error) {
	if p, err := exec.LookPath("smartctl"); err == nil {
		return p, nil
	}
	places := []string{"/opt/homebrew/sbin/smartctl", "/opt/homebrew/bin/smartctl", "/usr/local/sbin/smartctl", "/usr/local/bin/smartctl", "/usr/sbin/smartctl"}
	if runtime.GOOS == "windows" {
		// Its installer leaves it out of PATH unless asked.
		places = []string{filepath.Join(os.Getenv("ProgramFiles"), "smartmontools", "bin", "smartctl.exe")}
	}
	for _, p := range places {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p, nil
		}
	}
	return "", ErrNoSmartctl
}

// Exec runs the installed smartctl.
func Exec() (Runner, error) {
	path, err := Smartctl()
	if err != nil {
		return nil, err
	}
	return func(ctx context.Context, args ...string) ([]byte, error) {
		return exec.CommandContext(ctx, path, args...).Output()
	}, nil
}

type scan struct {
	Devices []struct {
		Name string `json:"name"`
		Type string `json:"type"`
	} `json:"devices"`
}

type report struct {
	Smartctl struct {
		Messages []struct {
			String   string `json:"string"`
			Severity string `json:"severity"`
		} `json:"messages"`
	} `json:"smartctl"`
	Model       string `json:"model_name"`
	SmartStatus *struct {
		Passed bool `json:"passed"`
	} `json:"smart_status"`
	Temperature struct {
		Current int `json:"current"`
	} `json:"temperature"`
	PowerOn struct {
		Hours int `json:"hours"`
	} `json:"power_on_time"`
	ATA struct {
		Table []struct {
			ID  int `json:"id"`
			Raw struct {
				Value int64 `json:"value"`
			} `json:"raw"`
		} `json:"table"`
	} `json:"ata_smart_attributes"`
	NVMe *struct {
		CriticalWarning int `json:"critical_warning"`
		PercentageUsed  int `json:"percentage_used"`
		MediaErrors     int `json:"media_errors"`
	} `json:"nvme_smart_health_information_log"`
}

// Check scans for drives and reads each one's report.
func Check(ctx context.Context, run Runner) ([]Disk, error) {
	out, err := run(ctx, "--scan", "-j")
	if len(out) == 0 {
		if err == nil {
			err = errors.New("no output")
		}
		return nil, fmt.Errorf("smartctl --scan: %w", err)
	}
	var s scan
	if err := json.Unmarshal(out, &s); err != nil {
		return nil, fmt.Errorf("smartctl --scan: %w", err)
	}
	var disks []Disk
	seen := map[string]bool{}
	for _, d := range s.Devices {
		if seen[d.Name] {
			continue
		}
		seen[d.Name] = true
		args := []string{"-H", "-i", "-A", "-j"}
		if d.Type != "" {
			args = append(args, "-d", d.Type)
		}
		out, _ := run(ctx, append(args, d.Name)...)
		disks = append(disks, parse(d.Name, out))
	}
	return disks, nil
}

func parse(device string, out []byte) Disk {
	d := Disk{Device: device}
	var r report
	if err := json.Unmarshal(out, &r); err != nil {
		d.Why = "smartctl gave no readable report"
		return d
	}
	d.Model = strings.TrimSpace(r.Model)
	if r.SmartStatus == nil {
		d.Why = "the drive does not report its health (USB enclosures often hide it)"
		for _, m := range r.Smartctl.Messages {
			if m.Severity == "error" && m.String != "" {
				d.Why = m.String
				break
			}
		}
		return d
	}
	d.Readable, d.Passed = true, r.SmartStatus.Passed
	d.TempC, d.Hours = r.Temperature.Current, r.PowerOn.Hours
	for _, a := range r.ATA.Table {
		switch {
		case a.ID == 5 && a.Raw.Value > 0:
			d.Warnings = append(d.Warnings, fmt.Sprintf("%d reallocated sectors", a.Raw.Value))
		case a.ID == 197 && a.Raw.Value > 0:
			d.Warnings = append(d.Warnings, fmt.Sprintf("%d sectors waiting to be reallocated", a.Raw.Value))
		}
	}
	if n := r.NVMe; n != nil {
		if n.CriticalWarning != 0 {
			d.Passed = false
		}
		if n.MediaErrors > 0 {
			d.Warnings = append(d.Warnings, fmt.Sprintf("%d media errors", n.MediaErrors))
		}
		if n.PercentageUsed >= 90 {
			d.Warnings = append(d.Warnings, fmt.Sprintf("%d%% of its rated wear used", n.PercentageUsed))
		}
	}
	return d
}
