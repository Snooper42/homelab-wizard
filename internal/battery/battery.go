// Package battery is the battery saver: on a laptop running on battery,
// the watchdog pauses the apps that work hardest, and starts them again
// once it is plugged in.
package battery

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Heavy are the apps paused on battery: background work that can wait
// for power (downloads, indexing, machine learning, scheduled scans).
var Heavy = []string{
	"immich-machine-learning",
	"qbittorrent", "gluetun",
	"prowlarr", "sonarr", "radarr", "lidarr", "bazarr", "flaresolverr", "lazylibrarian",
	"speedtest-tracker", "changedetection", "open-webui",
}

// State is what the saver paused, and when.
type State struct {
	Paused []string  `json:"paused"`
	Since  time.Time `json:"since"`
}

// Path is where the state is kept.
func Path(root string) string { return filepath.Join(root, "data", "battery.json") }

// Load reads the state; none is an empty one.
func Load(path string) State {
	var s State
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &s)
	}
	return s
}

// Save writes the state, or removes it when nothing is paused.
func (s State) Save(path string) error {
	if len(s.Paused) == 0 {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(s, "", "  ")
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

// Power reports whether this machine runs on battery now; known is false
// on a machine without one (a Mac mini, a desktop) or where it cannot tell.
// Tests replace it.
var Power = func() (onBattery, known bool) {
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("pmset", "-g", "batt").Output()
		if err != nil {
			return false, false
		}
		return ParsePmset(string(out))
	case "linux":
		return linuxPower("/sys/class/power_supply")
	case "windows":
		return parseWindowsPower(windowsPowerStatus())
	}
	return false, false
}

// parseWindowsPower reads GetSystemPowerStatus: the AC line status (0 off,
// 1 on, 255 unknown) and the battery flags (128 for no battery, 255 for
// unknown).
func parseWindowsPower(acLine, batteryFlag byte, ok bool) (onBattery, known bool) {
	if !ok || acLine == 255 || batteryFlag == 128 || batteryFlag == 255 {
		return false, false
	}
	return acLine == 0, true
}

// ParsePmset reads `pmset -g batt`: "Now drawing from 'Battery Power'" or
// 'AC Power'; a Mac without a battery lists no "InternalBattery".
func ParsePmset(out string) (onBattery, known bool) {
	if !strings.Contains(out, "InternalBattery") {
		return false, false
	}
	switch {
	case strings.Contains(out, "'Battery Power'"):
		return true, true
	case strings.Contains(out, "'AC Power'"):
		return false, true
	}
	return false, false
}

// linuxPower reads the kernel's power supplies: a battery present, and
// whether any mains supply is online.
func linuxPower(dir string) (onBattery, known bool) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false, false
	}
	hasBattery, mains := false, false
	for _, e := range entries {
		kind, _ := os.ReadFile(filepath.Join(dir, e.Name(), "type"))
		switch strings.TrimSpace(string(kind)) {
		case "Battery":
			hasBattery = true
		case "Mains":
			if online, _ := os.ReadFile(filepath.Join(dir, e.Name(), "online")); strings.TrimSpace(string(online)) == "1" {
				mains = true
			}
		}
	}
	if !hasBattery {
		return false, false
	}
	return !mains, true
}
