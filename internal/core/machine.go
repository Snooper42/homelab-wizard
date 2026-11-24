package core

import (
	"os"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
)

// MachineFacts is how the computer is, for the phone's This Mac card on
// Status (redesign-loop P1, as the computer's own card): the room on the
// disk that holds the homelab folder, and its power. Sizes and a word, no
// names or paths.
type MachineFacts struct {
	Free  uint64 `json:"free"`
	Total uint64 `json:"total"`
	// Low is under the threshold the disk-space check warns at.
	Low bool `json:"low"`
	// Power is "plugged" or "battery", or empty where it can't be told.
	Power string `json:"power,omitempty"`
	// KeptAwake is KEEP_AWAKE, on unless it says false.
	KeptAwake bool `json:"keptAwake"`
}

// Machine reads the facts for the homelab at root.
func Machine(root string) MachineFacts {
	env := Env(root)
	m := MachineFacts{KeptAwake: !strings.EqualFold(strings.TrimSpace(env["KEEP_AWAKE"]), "false")}
	home, _ := os.UserHomeDir()
	if vols := diskspace.Check(diskspace.Locations(root, home, env)); len(vols) > 0 {
		m.Free, m.Total, m.Low = vols[0].Free, vols[0].Total, vols[0].Low()
	}
	if onBattery, known := battery.Power(); known {
		m.Power = "plugged"
		if onBattery {
			m.Power = "battery"
		}
	}
	return m
}
