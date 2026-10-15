// Package updates pauses and resumes Watchtower's nightly image updates.
// The pause is kept in .env (UPDATES_PAUSED), so `homelab up` at login
// leaves Watchtower stopped until updates are resumed.
package updates

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

const (
	// PausedKey is the .env setting that holds the pause.
	PausedKey = "UPDATES_PAUSED"
	// App is the catalog app that runs the updates.
	App = "watchtower"
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
	return State{Paused: Paused(env), Schedule: Describe(env["WATCHTOWER_SCHEDULE"])}
}

// Describe turns Watchtower's six-field cron schedule into words.
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

// SetPaused records the pause in .env, then stops or starts Watchtower.
func SetPaused(ctx context.Context, c *catalog.Catalog, client *docker.Client, envFile string, paused bool) (State, error) {
	env, err := envfile.Load(envFile)
	if err != nil {
		return State{}, err
	}
	env.Set(PausedKey, strconv.FormatBool(paused))
	if err := env.Save(); err != nil {
		return State{}, err
	}
	a, ok := c.Get(App)
	if !ok {
		return Get(env.Map()), fmt.Errorf("the catalog has no %s app", App)
	}
	project := docker.Project{Dir: a.File.Dir, ComposeFile: a.File.Path, EnvFile: envFile, Name: a.File.Name}
	args := []string{"up", "--detach", "--no-recreate", a.ID}
	if paused {
		args = []string{"stop", a.ID}
	}
	if err := client.Compose(ctx, project, a.Profiles, args...); err != nil {
		return Get(env.Map()), fmt.Errorf("%s %s: %w", args[0], a.ID, err)
	}
	return Get(env.Map()), nil
}
