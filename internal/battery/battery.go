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
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// Heavy are the apps paused on battery: background work that can wait
// for power (downloads, indexing, machine learning, scheduled scans).
var Heavy = []string{
	"immich-machine-learning",
	"qbittorrent", "gluetun",
	"prowlarr", "sonarr", "radarr", "lidarr", "bazarr", "flaresolverr", "lazylibrarian", "tdarr",
	"speedtest-tracker", "changedetection", "open-webui", "paperless-ai",
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

// Save writes the state whole (a reader never meets half of it), only
// this account's to read, or removes it when nothing is paused.
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
	return lockedfile.Write(path, append(data, '\n'), 0o600)
}

// Update reads the state, lets change change it, and saves it when change
// says it did, under the lock beside it: the watchdog and the awake job
// both run the saver, and neither saves over what the other did.
func Update(path string, change func(*State) bool) error {
	return lockedfile.Update(path, 0o600, func(old []byte) ([]byte, bool) {
		var s State
		_ = json.Unmarshal(old, &s)
		if !change(&s) {
			return nil, false
		}
		if len(s.Paused) == 0 {
			return nil, true
		}
		data, err := json.MarshalIndent(s, "", "  ")
		return append(data, '\n'), err == nil
	})
}

// Pause adds the apps the saver just stopped, from now if none was paused.
func Pause(path string, ids []string, now time.Time) error {
	return Update(path, func(s *State) bool {
		if len(s.Paused) == 0 {
			s.Since = now
		}
		for _, id := range ids {
			if !slices.Contains(s.Paused, id) {
				s.Paused = append(s.Paused, id)
			}
		}
		slices.Sort(s.Paused)
		return true
	})
}

// Resume takes the apps the saver just started off the list.
func Resume(path string, ids []string) error {
	return Update(path, func(s *State) bool {
		s.Paused = slices.DeleteFunc(s.Paused, func(id string) bool { return slices.Contains(ids, id) })
		return true
	})
}

// Power reports whether this machine runs on battery now; known is false
// on a machine without one (a Mac mini, a desktop) or where it cannot tell.
// Tests replace it.
var Power = func() (onBattery, known bool) {
	switch goos {
	case "darwin":
		out, err := pmset()
		if err != nil {
			return false, false
		}
		return ParsePmset(string(out))
	case "linux":
		return linuxPower(powerSupply)
	case "windows":
		return parseWindowsPower(windowsPowerStatus())
	}
	return false, false
}

// Where Power reads, which tests replace: the system, the Mac's pmset,
// and Linux's power supplies.
var (
	goos        = runtime.GOOS
	pmset       = func() ([]byte, error) { return exec.Command("pmset", "-g", "batt").Output() }
	powerSupply = "/sys/class/power_supply"
)

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
