package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// Stall rescue (arr item 2c): a download nobody shares, stuck for longer
// than STALL_RESCUE_HOURS, is removed from qBittorrent through the app that
// asked for it, its release blocklisted so it isn't picked again, and the
// app searches for another. A download that moves, one stuck only a short
// while, and one no app asked for (added by hand) are left alone.
func TestRescueStalled(t *testing.T) {
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	ago := func(h int) int64 { return now.Add(-time.Duration(h) * time.Hour).Unix() }
	torrents := []map[string]any{
		{"hash": "aaa", "name": "Show S01E01", "state": "stalledDL", "progress": 0.1, "last_activity": ago(10), "added_on": ago(12)},
		{"hash": "bbb", "name": "Show S01E02", "state": "downloading", "progress": 0.5, "last_activity": ago(0), "added_on": ago(12)},
		{"hash": "ccc", "name": "Show S01E03", "state": "stalledDL", "progress": 0.2, "last_activity": ago(1), "added_on": ago(12)},
		{"hash": "ddd", "name": "By hand", "state": "stalledDL", "progress": 0, "last_activity": ago(30), "added_on": ago(30)},
		{"hash": "eee", "name": "A Film", "state": "metaDL", "progress": 0, "last_activity": 0, "added_on": ago(8)},
	}
	queues := map[string][]map[string]any{
		"sonarr": {{"id": 1, "downloadId": "AAA", "title": "Show S01E01"}, {"id": 2, "downloadId": "BBB", "title": "Show S01E02"}, {"id": 3, "downloadId": "CCC", "title": "Show S01E03"}},
		"radarr": {{"id": 7, "downloadId": "EEE", "title": "A Film (2024)"}},
	}
	var mu sync.Mutex
	var deleted []string
	serve := func(app string) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			defer mu.Unlock()
			switch {
			case r.URL.Path == "/api/v2/auth/login":
				http.SetCookie(w, &http.Cookie{Name: "SID", Value: "s1"})
				w.Write([]byte("Ok."))
			case r.URL.Path == "/api/v2/torrents/info":
				json.NewEncoder(w).Encode(torrents)
			case r.URL.Path == "/api/v3/queue" && r.Method == http.MethodGet:
				if r.Header.Get("X-Api-Key") != app+"-key" {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				json.NewEncoder(w).Encode(map[string]any{"totalRecords": len(queues[app]), "records": queues[app]})
			case strings.HasPrefix(r.URL.Path, "/api/v3/queue/") && r.Method == http.MethodDelete:
				q := r.URL.Query()
				if q.Get("removeFromClient") != "true" || q.Get("blocklist") != "true" || q.Get("skipRedownload") != "false" {
					http.Error(w, "wrong params "+r.URL.RawQuery, http.StatusBadRequest)
					return
				}
				id := strings.TrimPrefix(r.URL.Path, "/api/v3/queue/")
				deleted = append(deleted, app+":"+id)
				var keep []map[string]any
				for _, rec := range queues[app] {
					if fmt.Sprint(rec["id"]) != id {
						keep = append(keep, rec)
					}
				}
				queues[app] = keep
			default:
				http.NotFound(w, r)
			}
		}))
	}
	qb, son, rad := serve("qbit"), serve("sonarr"), serve("radarr")
	defer qb.Close()
	defer son.Close()
	defer rad.Close()
	keyDir := func(key string) string {
		d := t.TempDir()
		os.WriteFile(filepath.Join(d, "config.xml"), []byte("<Config><ApiKey>"+key+"</ApiKey></Config>"), 0o644)
		return d
	}
	apps := map[string]wiring.App{
		"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", URL: qb.URL},
		"sonarr":      {ID: "sonarr", Name: "Sonarr", URL: son.URL, ConfigDir: keyDir("sonarr-key")},
		"radarr":      {ID: "radarr", Name: "Radarr", URL: rad.URL, ConfigDir: keyDir("radarr-key")},
	}
	env := map[string]string{"QBITTORRENT_PASSWORD": "pw"}

	said := rescueStalledIn(context.Background(), apps, env, now)
	if strings.Join(deleted, ",") != "sonarr:1,radarr:7" {
		t.Fatalf("removed %v", deleted)
	}
	if len(said) != 2 || !strings.Contains(said[0], "Nobody was sharing") || !strings.Contains(said[0], "Show S01E01") || !strings.Contains(said[0], "Sonarr is looking for another") || !strings.Contains(said[1], "A Film") {
		t.Fatalf("said %q", said)
	}
	// Again: nothing more (the app has dropped them from its queue).
	if again := rescueStalledIn(context.Background(), apps, env, now); len(again) != 0 || len(deleted) != 2 {
		t.Fatalf("second run: %q, removed %v", again, deleted)
	}
	// Turned off: nothing is touched.
	queues["sonarr"] = append(queues["sonarr"], map[string]any{"id": 1, "downloadId": "AAA", "title": "Show S01E01"})
	if said := rescueStalledIn(context.Background(), apps, map[string]string{"QBITTORRENT_PASSWORD": "pw", "STALL_RESCUE_HOURS": "0"}, now); len(said) != 0 || len(deleted) != 2 {
		t.Fatalf("off: %q, removed %v", said, deleted)
	}
}

func TestStallAfter(t *testing.T) {
	for v, want := range map[string]time.Duration{"": 6 * time.Hour, "12": 12 * time.Hour, "0": 0, "off": 0, "nonsense": 6 * time.Hour} {
		if got := stallAfter(map[string]string{"STALL_RESCUE_HOURS": v}); got != want {
			t.Errorf("%q: %v, want %v", v, got, want)
		}
	}
}
