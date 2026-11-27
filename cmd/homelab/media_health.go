package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/downloads"
	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// The media apps' own health checks, said in plain words (arr item 4).
// Sonarr, Radarr, Lidarr and Prowlarr each keep a list of what's wrong
// (GET /api/v3/health, /api/v1 for Lidarr and Prowlarr: source, type,
// message; Sonarr's HealthResource), shown only on their own System pages,
// which nobody in the house opens. Tidy Up's pass reads it, and a problem
// that lasts half an hour (not an app starting, or the VPN reconnecting) is
// said once, as an alert and in Tidy Up's Recent activity; one that clears
// and comes back is said again. Hand over's own warning (the apps no longer
// import, by design) and what nobody needs to act on are left out. An app
// that doesn't answer (resting, or down: the watchdog's to say) keeps what
// was said of it.

// healthApps are the apps read, with their API path.
var healthApps = []struct{ id, api string }{{"sonarr", "v3"}, {"radarr", "v3"}, {"lidarr", "v1"}, {"prowlarr", "v1"}}

// healthAfter is how long a problem lasts before it is said.
const healthAfter = 30 * time.Minute

// plainHealth is one of an app's health checks in words, or "" when it
// isn't worth saying (its source, from the apps' HealthCheck/Checks).
func plainHealth(app, name, source, kind, message string) string {
	switch source {
	case "ImportMechanismCheck", "RemotePathMappingCheck", "DownloadClientRootFolderCheck":
		return "" // Library files downloads (Hand over), so the apps don't import them
	case "DownloadClientCheck", "DownloadClientStatusCheck":
		if app == "prowlarr" {
			return "" // Prowlarr's own download clients aren't used
		}
		return name + " can't reach the app that downloads for it (qBittorrent or SABnzbd), so nothing new downloads. When the VPN is down they wait for it; Connect apps sets them up again."
	case "IndexerRssCheck", "IndexerSearchCheck":
		return name + " has no search sites to look in, so what you ask for waits. Add one in Prowlarr (Indexers › Add Indexer), then Connect apps."
	case "IndexerStatusCheck", "IndexerLongTermStatusCheck":
		return "Some search sites aren't answering " + name + ", so fewer places are searched. It tries them again by itself; if it lasts, check them in Prowlarr."
	case "RootFolderCheck":
		return name + " can't find its library folder: is the media drive plugged in?"
	case "ApplicationStatusCheck", "ApplicationLongTermStatusCheck":
		return "Prowlarr can't reach Sonarr, Radarr or Lidarr, so new search sites don't reach them. Connect apps sets them up again."
	}
	if kind == "error" && strings.TrimSpace(message) != "" {
		return name + " says: " + strings.TrimSpace(message)
	}
	return ""
}

// mediaHealthState is what was seen and said, by "app:source".
type mediaHealthState struct {
	First map[string]time.Time `json:"first,omitempty"`
	Told  map[string]bool      `json:"told,omitempty"`
	// Drive is the media drive's warning last sent: 0, 85 or 95 (% full).
	Drive int `json:"drive,omitempty"`
}

func mediaHealthPath(root string) string { return filepath.Join(root, "data", "media-health.json") }

func loadMediaHealth(root string) *mediaHealthState {
	st := &mediaHealthState{}
	if data, err := os.ReadFile(mediaHealthPath(root)); err == nil {
		_ = json.Unmarshal(data, st)
	}
	return st
}

func (st *mediaHealthState) save(root string) error {
	path := mediaHealthPath(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	return lockedfile.Write(path, append(data, '\n'), 0o644)
}

// mediaHealthIn reads each running app's health and returns what is to be
// said now, updating st. quiet are the apps whose alerts are off.
func mediaHealthIn(ctx context.Context, apps map[string]wiring.App, st *mediaHealthState, quiet []string, now time.Time) []string {
	if st.First == nil {
		st.First = map[string]time.Time{}
	}
	if st.Told == nil {
		st.Told = map[string]bool{}
	}
	client := &http.Client{Timeout: 20 * time.Second}
	var said []string
	for _, ha := range healthApps {
		a, ok := apps[ha.id]
		if !ok || slices.Contains(quiet, ha.id) {
			continue
		}
		key := arrKey(a.ConfigDir)
		if key == "" || a.URL == "" {
			continue
		}
		var checks []struct {
			Source  string `json:"source"`
			Type    string `json:"type"`
			Message string `json:"message"`
		}
		if err := arrGet(ctx, client, a.URL, "/api/"+ha.api+"/health", key, &checks); err != nil {
			continue // resting or down: what was said stays said
		}
		found := map[string]string{}
		for _, c := range checks {
			if line := plainHealth(ha.id, a.Name, c.Source, strings.ToLower(c.Type), c.Message); line != "" {
				found[ha.id+":"+c.Source] = line
			}
		}
		for k := range st.First {
			if strings.HasPrefix(k, ha.id+":") && found[k] == "" {
				delete(st.First, k) // cleared: said again if it comes back
				delete(st.Told, k)
			}
		}
		keys := make([]string, 0, len(found))
		for k := range found {
			keys = append(keys, k)
		}
		slices.Sort(keys)
		for _, k := range keys {
			first, seen := st.First[k]
			if !seen {
				st.First[k] = now
				continue
			}
			if !st.Told[k] && now.Sub(first) >= healthAfter {
				st.Told[k] = true
				if !slices.Contains(said, found[k]) {
					said = append(said, found[k])
				}
			}
		}
	}
	return said
}

// mediaHealth is the check in Tidy Up's pass.
func (h *homelab) mediaHealth(ctx context.Context, env map[string]string, now time.Time) {
	apps, _, err := h.arrRunning(ctx)
	if err != nil {
		return
	}
	st := loadMediaHealth(h.root)
	said := mediaHealthIn(ctx, apps, st, notify.LoadQuiet(h.root, env), now)
	_ = st.save(h.root)
	if len(said) == 0 {
		return
	}
	rec := media.LoadRecord(h.root)
	for _, s := range said {
		rec.Did("downloads", s, "", now)
	}
	_ = rec.Save(h.root)
	title := "Media: something needs a look"
	if len(said) > 1 {
		title = fmt.Sprintf("Media: %d things need a look", len(said))
	}
	h.alert(ctx, "tunnel-watchdog", notify.Message{Title: title, Body: strings.Join(said, "\n"), Tags: []string{"clapper"}})
}

// mediaDriveIn is the media drive's warning to send now ("" for none), at
// 85% and 95% full, once each (downloads.DriveAlert), updating st.
func mediaDriveIn(vols []diskspace.Volume, st *mediaHealthState) string {
	said, told := downloads.DriveAlert(vols, st.Drive)
	st.Drive = told
	return said
}

// mediaDrive is the drive check in Tidy Up's pass: the Downloads card's
// warning, said on the phone once, not every hour (arr item 6).
func (h *homelab) mediaDrive(ctx context.Context, env map[string]string, now time.Time) {
	drives := core.MediaDrives(h.root, homeDir(), env)
	if len(drives) == 0 {
		return
	}
	st := loadMediaHealth(h.root)
	said := mediaDriveIn(checkDisks(drives), st)
	_ = st.save(h.root)
	if said == "" {
		return
	}
	rec := media.LoadRecord(h.root)
	rec.Did("downloads", said, "", now)
	_ = rec.Save(h.root)
	title := "Media: the drive is filling up"
	if strings.Contains(said, "almost full") {
		title = "Media: the drive is almost full"
	}
	h.alert(ctx, "tunnel-watchdog", notify.Message{Title: title, Body: said, Tags: []string{"floppy_disk"}})
}
