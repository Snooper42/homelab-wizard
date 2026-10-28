// Package updates holds the settings of the nightly image updates the
// agent runs (homelab update --all): when they run (WATCHTOWER_SCHEDULE, a
// six-field cron kept under its old name so existing homelabs keep their
// hour), whether they are paused (UPDATES_PAUSED), and which apps are held
// after a rollback (UPDATES_HELD).
package updates

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

const (
	// PausedKey is the .env setting that holds the pause.
	PausedKey = "UPDATES_PAUSED"
	// ScheduleKey is when the nightly updates run, a six-field cron
	// ("0 0 4 * * *"), named for Watchtower, which ran them before.
	ScheduleKey = "WATCHTOWER_SCHEDULE"
)

// State is whether updates run, and when.
type State struct {
	Paused   bool   `json:"paused"`
	Schedule string `json:"schedule"` // e.g. "daily at 04:00"
}

// Paused reports the pause from .env values.
func Paused(env map[string]string) bool {
	v, _ := strconv.ParseBool(env[PausedKey])
	return v
}

// Get reads the state from .env values.
func Get(env map[string]string) State {
	return State{Paused: Paused(env), Schedule: Describe(env[ScheduleKey])}
}

// Describe turns the six-field cron schedule into words.
func Describe(cron string) string {
	if cron == "" {
		cron = "0 0 4 * * *" // the compose default
	}
	f := strings.Fields(cron)
	h, errH := strconv.Atoi(f[min(2, len(f)-1)])
	m, errM := strconv.Atoi(f[min(1, len(f)-1)])
	if len(f) == 6 && errH == nil && errM == nil && f[3] == "*" && f[4] == "*" && f[5] == "*" {
		return fmt.Sprintf("daily at %02d:%02d", h, m)
	}
	return "on schedule " + cron
}

// At is the hour and minute of a daily schedule: 4:00 for the default,
// and for one At cannot read (not daily) ok is false.
func At(cron string) (hour, minute int, ok bool) {
	if cron == "" {
		return 4, 0, true
	}
	f := strings.Fields(cron)
	if len(f) != 6 || f[3] != "*" || f[4] != "*" || f[5] != "*" {
		return 0, 0, false
	}
	h, errH := strconv.Atoi(f[2])
	m, errM := strconv.Atoi(f[1])
	if errH != nil || errM != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, 0, false
	}
	return h, m, true
}

// SetPaused records the pause in .env; the agent's next nightly update
// reads it.
func SetPaused(envFile string, paused bool) (State, error) {
	env, err := envfile.Load(envFile)
	if err != nil {
		return State{}, err
	}
	env.Set(PausedKey, strconv.FormatBool(paused))
	if err := env.Save(); err != nil {
		return State{}, err
	}
	return Get(env.Map()), nil
}
