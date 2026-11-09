package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// The *arr apps rest too (the owner, Nov 9: "All arr apps should rest
// unless there is something actually pending"), as Tdarr does: once nothing
// is pending, the agent stops them and notes each in data/stopped.json as
// Tidy Up's ("tidy"), which everything that starts apps by itself skips.
//
//   - Pending (any keeps them all up, as they call each other): anything in
//     a Sonarr, Radarr or Lidarr queue; a torrent not finished in
//     qBittorrent; a Seerr request approved and not yet available; and 15
//     minutes after any of these, or after they started.
//   - A torrent seeding keeps qBittorrent and Gluetun up (the owner: yes),
//     not the rest.
//   - What can't be read counts as pending: they stay up rather than stop
//     with something on the way. qBittorrent without its Web UI password
//     (QBITTORRENT_PASSWORD) can't be read, so it and Gluetun stay up.
//   - They wake every 12 hours (the owner: "I'm not adding files that
//     often") and ask for an RSS sync and a search of what's missing; at
//     once when Seerr has a request; and for Tidy Up's job that hands them
//     the libraries (media arr). Then they rest again once nothing is
//     pending.
//   - Someone who starts one while they rest keeps them up until the next
//     12-hour wake; a stop made by a person is never undone here.
//     TIDY_ARR_REST=false keeps them up.
//
// Seerr, Jellyfin and Navidrome stay up: the household opens them.

// arrCore rest together, in the order they stop; they start in the other.
var arrCore = []string{"sonarr", "radarr", "lidarr", "bazarr", "prowlarr", "flaresolverr"}

// arrTorrent are qBittorrent and the tunnel it runs through, stopped in
// this order (qBittorrent first) and started the other way round.
var arrTorrent = []string{"qbittorrent", "gluetun"}

var (
	arrRestAfter = 15 * time.Minute
	arrWakeEvery = 12 * time.Hour
	arrStartWait = 2 * time.Minute
)

// arrQueues are the apps with a download queue, with their API version.
var arrQueues = []struct{ id, api string }{{"sonarr", "v3"}, {"radarr", "v3"}, {"lidarr", "v1"}}

// arrSearch is what each app is asked on a wake: an RSS sync, and a search
// of what's missing.
var arrSearch = map[string][]string{
	"sonarr": {"RssSync", "MissingEpisodeSearch"},
	"radarr": {"RssSync", "MissingMoviesSearch"},
	"lidarr": {"RssSync", "MissingAlbumSearch"},
}

// arrNow is what's on the way, as the apps that are up say.
type arrNow struct {
	// Pending keeps them all up: a queue, a download, a request, or
	// something that couldn't be read. Why says which, for the log.
	Pending bool
	Why     string
	// Seeding keeps qBittorrent and Gluetun up (or they couldn't be read).
	Seeding bool
	// Requests: Seerr has a request approved and not yet available.
	Requests bool
}

var arrKeyRe = regexp.MustCompile(`<ApiKey>([^<]+)</ApiKey>`)

// arrKey is an *arr app's API key, from its config.xml; "" when it has none
// yet (not set up, so nothing is in its queue).
func arrKey(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "config.xml"))
	if err != nil {
		return ""
	}
	if m := arrKeyRe.FindSubmatch(data); m != nil {
		return string(m[1])
	}
	return ""
}

// seerrKey is Seerr's API key, from its settings.json; "" when it has none.
func seerrKey(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "settings.json"))
	if err != nil {
		return ""
	}
	var s struct {
		Main struct {
			APIKey string `json:"apiKey"`
		} `json:"main"`
	}
	if json.Unmarshal(data, &s) != nil {
		return ""
	}
	return s.Main.APIKey
}

// arrGet asks base+path with the key, and decodes the answer into out.
func arrGet(ctx context.Context, client *http.Client, base, path, key string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Api-Key", key)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("answered %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(out)
}

// arrPending is what's on the way, asked of each app that is up (apps is
// wiring's view of the running ones). Seerr is asked even while the rest
// rest: its request is what wakes them.
func arrPending(ctx context.Context, apps map[string]wiring.App, env map[string]string) arrNow {
	client := &http.Client{Timeout: 10 * time.Second}
	var now arrNow
	pending := func(why string) {
		if !now.Pending {
			now.Pending, now.Why = true, why
		}
	}
	for _, q := range arrQueues {
		a, ok := apps[q.id]
		if !ok {
			continue
		}
		key := arrKey(a.ConfigDir)
		if key == "" || a.URL == "" {
			continue // not set up yet: nothing in its queue
		}
		var page struct {
			TotalRecords int `json:"totalRecords"`
		}
		if err := arrGet(ctx, client, a.URL, "/api/"+q.api+"/queue?pageSize=1", key, &page); err != nil {
			pending(fmt.Sprintf("%s's queue couldn't be read (%v)", a.Name, err))
		} else if page.TotalRecords > 0 {
			pending(fmt.Sprintf("%s has %d in its queue", a.Name, page.TotalRecords))
		}
	}
	if a, ok := apps["qbittorrent"]; ok {
		downloading, seeding, err := qbitTorrents(ctx, client, qbitURL(a, env), env)
		switch {
		case err != nil:
			// Unread, qBittorrent and its tunnel stay up; a download for
			// Sonarr, Radarr or Lidarr is in their queue, read above.
			now.Seeding = true
		case downloading > 0:
			pending(fmt.Sprintf("qBittorrent has %d downloading", downloading))
		case seeding > 0:
			now.Seeding = true
		}
	}
	if a, ok := apps["seerr"]; ok {
		if key := seerrKey(a.ConfigDir); key != "" && a.URL != "" {
			var page struct {
				PageInfo struct {
					Results int `json:"results"`
				} `json:"pageInfo"`
			}
			if err := arrGet(ctx, client, a.URL, "/api/v1/request?take=1&filter=processing", key, &page); err != nil {
				pending(fmt.Sprintf("Seerr's requests couldn't be read (%v)", err))
			} else if page.PageInfo.Results > 0 {
				now.Requests = true
				pending(fmt.Sprintf("Seerr has %d request(s) on the way", page.PageInfo.Results))
			}
		}
	}
	return now
}

// qbitURL is qBittorrent's Web UI from this machine.
func qbitURL(a wiring.App, env map[string]string) string {
	if a.URL != "" {
		return a.URL
	}
	port := env["QBITTORRENT_PORT"]
	if port == "" {
		port = "8082"
	}
	return "http://localhost:" + port
}

// qbitTorrents counts qBittorrent's torrents still downloading (or waiting
// to: anything not finished and not paused) and those seeding.
func qbitTorrents(ctx context.Context, client *http.Client, base string, env map[string]string) (downloading, seeding int, err error) {
	password := env["QBITTORRENT_PASSWORD"]
	if password == "" {
		return 0, 0, fmt.Errorf("no QBITTORRENT_PASSWORD")
	}
	user := env["QBITTORRENT_USER"]
	if user == "" {
		user = "admin"
	}
	base = strings.TrimRight(base, "/")
	form := url.Values{"username": {user}, "password": {password}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/v2/auth/login", strings.NewReader(form.Encode()))
	if err != nil {
		return 0, 0, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Referer", base)
	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, err
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	resp.Body.Close()
	var sid *http.Cookie
	for _, c := range resp.Cookies() {
		if c.Name == "SID" {
			sid = c
		}
	}
	if resp.StatusCode != http.StatusOK || sid == nil {
		return 0, 0, fmt.Errorf("qBittorrent's sign-in answered %d %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	req, err = http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/v2/torrents/info", nil)
	if err != nil {
		return 0, 0, err
	}
	req.AddCookie(sid)
	req.Header.Set("Referer", base)
	resp, err = client.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, 0, fmt.Errorf("qBittorrent's torrents answered %d", resp.StatusCode)
	}
	var torrents []struct {
		State    string  `json:"state"`
		Progress float64 `json:"progress"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 16<<20)).Decode(&torrents); err != nil {
		return 0, 0, err
	}
	for _, t := range torrents {
		paused := strings.HasPrefix(t.State, "paused") || strings.HasPrefix(t.State, "stopped") || t.State == "error" || t.State == "missingFiles"
		switch {
		case t.Progress < 1 && !paused:
			downloading++
		case t.Progress >= 1 && !paused:
			seeding++
		}
	}
	return downloading, seeding, nil
}

// arrRunning is wiring's view of the catalog apps running now, and the
// containers' start times by app.
func (h *homelab) arrRunning(ctx context.Context) (map[string]wiring.App, map[string]time.Time, error) {
	client, err := h.docker(ctx)
	if err != nil {
		return nil, nil, err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return nil, nil, err
	}
	report := detect.Analyze(h.catalog, containers)
	running := func(id string) bool { st, _ := report.State(id); return st == detect.Running }
	started := map[string]time.Time{}
	for _, c := range containers {
		if !c.StartedAt.IsZero() {
			started[c.Service()] = c.StartedAt
		}
	}
	return wiring.AppsFrom(h.catalog, running, h.envMap(), homeDir()), started, nil
}

// arrPendingNow is arrPending; tests replace it.
var arrPendingNow = arrPending

// restArr, from the agent's minute, rests the *arr apps when nothing is
// pending, and wakes them every 12 hours or for a Seerr request.
func (h *homelab) restArr(ctx context.Context, env map[string]string, now time.Time) {
	if off(env["TIDY_ARR_REST"]) || h.jobRunning() {
		return
	}
	apps, started, err := h.arrRunning(ctx)
	if err != nil {
		return
	}
	path := stopped.Path(h.root)
	rec := media.LoadRecord(h.root)
	if rec.ArrResting {
		rest := stopped.Load(path)
		for _, id := range rec.ArrStopped {
			if s, ok := rest[id]; !ok || s.Why != whyTidy {
				// Someone started one, or said it's no longer stopped: up
				// is theirs until the next 12-hour wake.
				h.wakeArr(ctx, func(string) {}, false)
				rec = media.LoadRecord(h.root)
				rec.ArrLeftUp = true
				_ = rec.Save(h.root)
				return
			}
		}
		switch {
		case now.Sub(rec.ArrRested) >= arrWakeEvery:
			h.wakeArr(ctx, func(string) {}, true)
		case arrPendingNow(ctx, onlySeerr(apps), env).Requests:
			h.wakeArr(ctx, func(string) {}, true)
		}
		return
	}
	if rec.ArrLeftUp {
		if now.Sub(rec.ArrWoke) < arrWakeEvery {
			return
		}
		rec.ArrLeftUp = false
	}
	held := stopped.Load(path)
	var up []string // ours to rest: running, and not stopped by anyone
	for _, id := range slices.Concat(arrCore, arrTorrent) {
		if _, ok := apps[id]; ok && !held.Has(id) {
			up = append(up, id)
		}
	}
	if len(up) == 0 {
		return
	}
	// Up a while after they started (a wake, an install, an update), and
	// after a job used them or something was last pending.
	for _, id := range up {
		if t, ok := started[id]; ok && now.Sub(t) < arrRestAfter {
			return
		}
	}
	if now.Sub(rec.ArrWoke) < arrRestAfter || now.Sub(rec.ArrBusy) < arrRestAfter {
		return
	}
	state := arrPendingNow(ctx, apps, env)
	if state.Pending {
		rec.ArrBusy = now.UTC()
		_ = rec.Save(h.root)
		return
	}
	var rest []string
	for _, id := range up {
		if slices.Contains(arrTorrent, id) {
			if state.Seeding {
				continue
			}
			// The battery saver's, until it is plugged in.
			if bs := battery.Load(battery.Path(h.root)); slices.Contains(bs.Paused, id) || slices.Contains(bs.Finishing, id) {
				continue
			}
		}
		rest = append(rest, id)
	}
	if len(rest) == 0 {
		return
	}
	resting := h.stopForTidy(ctx, rest, now)
	if len(resting) == 0 {
		return
	}
	rec = media.LoadRecord(h.root)
	rec.ArrResting, rec.ArrStopped, rec.ArrRested, rec.ArrBusy = true, resting, now.UTC(), time.Time{}
	_ = rec.Save(h.root)
	h.ui.Info("Resting: %s. Tidy Up starts them again every 12 hours, for a request, or for a job", strings.Join(resting, ", "))
}

// onlySeerr is apps with only Seerr in it: what's asked while the rest rest.
func onlySeerr(apps map[string]wiring.App) map[string]wiring.App {
	if a, ok := apps["seerr"]; ok {
		return map[string]wiring.App{"seerr": a}
	}
	return nil
}

// stopForTidy stops ids in order, each noted in data/stopped.json as Tidy
// Up's first (so nothing that starts apps starts it meanwhile), and returns
// the ones it stopped. One that won't stop is taken out of the record again.
func (h *homelab) stopForTidy(ctx context.Context, ids []string, now time.Time) []string {
	client, err := h.docker(ctx)
	if err != nil {
		return nil
	}
	path := stopped.Path(h.root)
	mine := stopped.Stop{Since: now.UTC().Truncate(time.Second), Why: whyTidy}
	var done []string
	for _, id := range ids {
		a, ok := h.catalog.Get(id)
		if !ok {
			continue
		}
		added := false
		if err := stopped.Update(path, func(r stopped.Record) bool {
			if r.Has(id) {
				return false
			}
			r[id], added = mine, true
			return true
		}); err != nil || !added {
			continue
		}
		if err := client.Compose(ctx, h.project(a.File), a.Profiles, "stop", a.ID); err != nil {
			h.ui.Warn("%s: couldn't stop it to rest: %v", a.Name(), err)
			_ = stopped.Update(path, func(r stopped.Record) bool {
				if s, ok := r[id]; ok && s.Why == whyTidy && s.Since.Equal(mine.Since) {
					delete(r, id)
					return true
				}
				return false
			})
			continue
		}
		done = append(done, id)
	}
	return done
}

// wakeArr starts the *arr apps Tidy Up rested, in the order they depend on
// each other (Gluetun before qBittorrent), and with search asks Sonarr,
// Radarr and Lidarr for an RSS sync and a search of what's missing. On
// battery with the battery saver on, qBittorrent and Gluetun stay resting
// until power, as the saver would pause them again.
func (h *homelab) wakeArr(ctx context.Context, say func(string), search bool) {
	rec := media.LoadRecord(h.root)
	if !rec.ArrResting {
		return
	}
	path := stopped.Path(h.root)
	onBattery, known := battery.Power()
	saver := known && onBattery && !strings.EqualFold(h.envMap()["BATTERY_SAVER"], "false")
	client, err := h.docker(ctx)
	if err != nil {
		return
	}
	order := slices.Concat(arrCore, arrTorrent)
	slices.Reverse(order)
	var still []string
	var woke []string
	for _, id := range order {
		if !slices.Contains(rec.ArrStopped, id) {
			continue
		}
		s, ok := stopped.Load(path)[id]
		if !ok || s.Why != whyTidy {
			continue // started by someone, or stopped by a person since
		}
		if saver && slices.Contains(arrTorrent, id) {
			still = append(still, id)
			continue
		}
		a, ok := h.catalog.Get(id)
		if !ok {
			continue
		}
		say("Starting " + a.Name() + ", which was resting")
		if err := client.Compose(ctx, h.project(a.File), a.Profiles, "start", a.ID); err != nil {
			say(fmt.Sprintf("%s didn't start: %v", a.Name(), err))
			still = append(still, id)
			continue
		}
		_ = stopped.Update(path, func(r stopped.Record) bool {
			if s, ok := r[id]; ok && s.Why == whyTidy {
				delete(r, id)
				return true
			}
			return false
		})
		woke = append(woke, id)
	}
	rec = media.LoadRecord(h.root)
	rec.ArrStopped, rec.ArrResting, rec.ArrWoke = still, len(still) > 0, time.Now().UTC()
	if len(still) > 0 {
		rec.ArrRested = time.Now().UTC() // the rest of it waits for power, or the next wake
	}
	_ = rec.Save(h.root)
	if search && len(woke) > 0 {
		h.arrSearch(ctx, woke)
	}
}

// useArr is called before Tidy Up's job that hands the *arr apps the
// libraries: resting ones are started first, and they rest only a while
// after.
func (h *homelab) useArr(ctx context.Context, say func(string)) {
	h.wakeArr(ctx, say, false)
	rec := media.LoadRecord(h.root)
	rec.ArrBusy, rec.ArrLeftUp = time.Now().UTC(), false
	_ = rec.Save(h.root)
}

// arrSearch asks each woken app with a queue for an RSS sync and a search
// of what's missing, once its API answers (up to arrStartWait).
func (h *homelab) arrSearch(ctx context.Context, woke []string) {
	apps, _, err := h.arrRunning(ctx)
	if err != nil {
		return
	}
	client := &http.Client{Timeout: 10 * time.Second}
	for _, q := range arrQueues {
		a, ok := apps[q.id]
		if !ok || !slices.Contains(woke, q.id) {
			continue
		}
		key := arrKey(a.ConfigDir)
		if key == "" || a.URL == "" {
			continue
		}
		for deadline := time.Now().Add(arrStartWait); ctx.Err() == nil && time.Now().Before(deadline); time.Sleep(2 * time.Second) {
			var status map[string]any
			if arrGet(ctx, client, a.URL, "/api/"+q.api+"/system/status", key, &status) == nil {
				break
			}
		}
		for _, name := range arrSearch[q.id] {
			body := strings.NewReader(`{"name":"` + name + `"}`)
			req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(a.URL, "/")+"/api/"+q.api+"/command", body)
			if err != nil {
				continue
			}
			req.Header.Set("X-Api-Key", key)
			req.Header.Set("Content-Type", "application/json")
			if resp, err := client.Do(req); err == nil {
				resp.Body.Close()
			}
		}
	}
}
