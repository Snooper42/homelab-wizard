package main

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// Stall rescue (arr item 2c; the owner, Nov 20: requests used to stall,
// most often on a release nobody shares). A torrent qBittorrent can't get
// anywhere with (stalledDL: no one to download from; metaDL: never got
// started) and that hasn't moved for STALL_RESCUE_HOURS (6 unless set; 0 or
// off turns this off) is handed back to the app that asked for it: removed
// from qBittorrent with its files, its release blocklisted so it isn't
// picked again, and the app searches for another (the queue's own Remove,
// as its page does: removeFromClient, blocklist, skipRedownload=false;
// Sonarr's QueueController). A torrent that moves, one stuck a short while,
// and one no app's queue lists (added by hand) are left alone.

// stallAfter is how long a stuck torrent waits before it is rescued; 0 off.
func stallAfter(env map[string]string) time.Duration {
	v := strings.ToLower(strings.TrimSpace(env["STALL_RESCUE_HOURS"]))
	switch v {
	case "":
		return 6 * time.Hour
	case "0", "off", "false", "no":
		return 0
	}
	h, err := strconv.ParseFloat(v, 64)
	if err != nil || h < 0 {
		return 6 * time.Hour
	}
	return time.Duration(h * float64(time.Hour))
}

// stuck is whether qBittorrent can't get anywhere with t and it hasn't
// moved for after.
func (t qbitTorrent) stuck(now time.Time, after time.Duration) bool {
	if t.Progress >= 1 || (t.State != "stalledDL" && t.State != "metaDL") {
		return false
	}
	last := max(t.LastActivity, t.AddedOn)
	return last > 0 && now.Sub(time.Unix(last, 0)) >= after
}

// rescueStalledIn hands each stuck torrent back to the app that asked for
// it, saying in words what it did; nothing when it is off or qBittorrent
// can't be read.
func rescueStalledIn(ctx context.Context, apps map[string]wiring.App, env map[string]string, now time.Time) []string {
	after := stallAfter(env)
	q, ok := apps["qbittorrent"]
	if after == 0 || !ok {
		return nil
	}
	client := &http.Client{Timeout: 20 * time.Second}
	torrents, err := qbitList(ctx, client, qbitURL(q, env), env)
	if err != nil {
		return nil
	}
	stuck := map[string]qbitTorrent{}
	for _, t := range torrents {
		if t.Hash != "" && t.stuck(now, after) {
			stuck[strings.ToLower(t.Hash)] = t
		}
	}
	if len(stuck) == 0 {
		return nil
	}
	var said []string
	for _, aq := range arrQueues {
		a, ok := apps[aq.id]
		if !ok {
			continue
		}
		key := arrKey(a.ConfigDir)
		if key == "" || a.URL == "" {
			continue
		}
		var page struct {
			Records []struct {
				ID         int    `json:"id"`
				DownloadID string `json:"downloadId"`
				Title      string `json:"title"`
			} `json:"records"`
		}
		if err := arrGet(ctx, client, a.URL, "/api/"+aq.api+"/queue?pageSize=500", key, &page); err != nil {
			continue
		}
		for _, r := range page.Records {
			t, ok := stuck[strings.ToLower(r.DownloadID)]
			if !ok {
				continue
			}
			path := fmt.Sprintf("/api/%s/queue/%d?removeFromClient=true&blocklist=true&skipRedownload=false", aq.api, r.ID)
			if err := arrDo(ctx, client, http.MethodDelete, a.URL, path, key); err != nil {
				continue
			}
			delete(stuck, strings.ToLower(r.DownloadID))
			name := r.Title
			if name == "" {
				name = t.Name
			}
			said = append(said, fmt.Sprintf("Nobody was sharing “%s” for %s, so %s is looking for another.", name, plainHours(after), a.Name))
		}
	}
	return said
}

// plainHours is a duration as people say it: "6 hours", "an hour".
func plainHours(d time.Duration) string {
	h := d.Hours()
	switch {
	case h == 1:
		return "an hour"
	case h == float64(int(h)):
		return fmt.Sprintf("%d hours", int(h))
	}
	return fmt.Sprintf("%.1f hours", h)
}

// arrDo sends one request with no body to an *arr app's API.
func arrDo(ctx context.Context, client *http.Client, method, base, path, key string) error {
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(base, "/")+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Api-Key", key)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("answered %d", resp.StatusCode)
	}
	return nil
}

// rescueStalled is stall rescue in Tidy Up's pass (beside the *arr apps'
// rest, which a stuck torrent would otherwise keep up for good): what it
// does goes into Tidy Up's Recent activity.
func (h *homelab) rescueStalled(ctx context.Context, env map[string]string, now time.Time) {
	if stallAfter(env) == 0 {
		return
	}
	apps, _, err := h.arrRunning(ctx)
	if err != nil {
		return
	}
	said := rescueStalledIn(ctx, apps, env, now)
	if len(said) == 0 {
		return
	}
	rec := media.LoadRecord(h.root)
	for _, s := range said {
		rec.Did("downloads", s, "", now)
	}
	_ = rec.Save(h.root)
}
