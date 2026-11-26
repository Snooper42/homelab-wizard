package core

import (
	"os"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/host"
)

// MachineFacts is how the computer is, for the phone's This Mac card on
// Status (redesign-loop P1, as the computer's own card): the room on the
// disk that holds the homelab folder, its power, its memory and since when
// it's been up. Sizes, a word and a time, no names or paths.
type MachineFacts struct {
	Free  uint64 `json:"free"`
	Total uint64 `json:"total"`
	// Low is under the threshold the disk-space check warns at.
	Low bool `json:"low"`
	// Power is "plugged" or "battery", or empty where it can't be told.
	Power string `json:"power,omitempty"`
	// KeptAwake is KEEP_AWAKE, on unless it says false.
	KeptAwake bool `json:"keptAwake"`
	// Memory is the machine's memory in bytes, 0 where it can't be told
	// (lane D, D5: the machine card's "Memory · 11 of 32 GB").
	Memory uint64 `json:"memory,omitempty"`
	// Booted is when the machine last started, absent where it can't be
	// told ("Up 23 days").
	Booted time.Time `json:"booted,omitzero"`
}

// Machine reads the facts for the homelab at root.
func Machine(root string) MachineFacts {
	env := Env(root)
	m := MachineFacts{KeptAwake: !strings.EqualFold(strings.TrimSpace(env["KEEP_AWAKE"]), "false"), Memory: host.Memory(), Booted: host.Booted()}
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
