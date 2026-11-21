package core

import (
	"context"
	"os"
	"slices"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/downloads"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// downloadApps are the media apps the Downloads card reads: with none of
// them installed, there is no card.
var downloadApps = []string{"sonarr", "radarr", "lidarr", "seerr", "qbittorrent", "sabnzbd"}

// Downloads is Status's Downloads card (arr item 6): what the media apps
// have on the way, in plain words, and how full the media drive is.
func Downloads(ctx context.Context, root string) (downloads.Card, error) {
	c, err := Catalog(root)
	if err != nil {
		return downloads.Card{}, err
	}
	_, containers, err := Containers(ctx)
	if err != nil {
		return downloads.Card{}, err
	}
	report := detect.Analyze(c, containers)
	installed := slices.ContainsFunc(downloadApps, func(id string) bool { st, _ := report.State(id); return st != detect.NotInstalled })
	if !installed {
		return downloads.Card{}, nil
	}
	env := Env(root)
	home, _ := os.UserHomeDir()
	running := func(id string) bool { st, _ := report.State(id); return st == detect.Running }
	apps := wiring.AppsFrom(c, running, env, home)
	return downloads.Read(ctx, apps, env, true, diskspace.Check(MediaDrives(root, home, env)), time.Now()), nil
}

// MediaDrives are the drives the Downloads card watches: the media and
// downloads folders' (the same drive is read once by diskspace.Check).
func MediaDrives(root, home string, env map[string]string) []diskspace.Location {
	var drives []diskspace.Location
	for _, l := range diskspace.Locations(root, home, env) {
		if l.Name == "media" || l.Name == "downloads" {
			drives = append(drives, l)
		}
	}
	return drives
}
