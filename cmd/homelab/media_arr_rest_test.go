package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/ui"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// TestArrPendingReadsEachApp: what's on the way is asked of each app that
// is up, and what can't be read keeps them up.
func TestArrPendingReadsEachApp(t *testing.T) {
	queue := 0
	torrents := `[]`
	requests := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v3/queue":
			if r.Header.Get("X-Api-Key") != "sonarr-key" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			json.NewEncoder(w).Encode(map[string]int{"totalRecords": queue})
		case "/api/v2/auth/login":
			if r.FormValue("password") != "pw" {
				w.Write([]byte("Fails."))
				return
			}
			http.SetCookie(w, &http.Cookie{Name: "SID", Value: "s1"})
			w.Write([]byte("Ok."))
		case "/api/v2/torrents/info":
			if c, err := r.Cookie("SID"); err != nil || c.Value != "s1" {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.Write([]byte(torrents))
		case "/api/v1/request":
			if r.URL.Query().Get("filter") != "processing" || r.Header.Get("X-Api-Key") != "seerr-key" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"pageInfo": map[string]int{"results": requests}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	dir := func(file, text string) string {
		d := t.TempDir()
		if err := os.WriteFile(filepath.Join(d, file), []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
		return d
	}
	apps := map[string]wiring.App{
		"sonarr":      {ID: "sonarr", Name: "Sonarr", URL: srv.URL, ConfigDir: dir("config.xml", "<Config><ApiKey>sonarr-key</ApiKey></Config>")},
		"radarr":      {ID: "radarr", Name: "Radarr", URL: srv.URL, ConfigDir: t.TempDir()}, // not set up yet: no key
		"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", URL: srv.URL},
		"seerr":       {ID: "seerr", Name: "Seerr", URL: srv.URL, ConfigDir: dir("settings.json", `{"main":{"apiKey":"seerr-key"}}`)},
	}
	env := map[string]string{"QBITTORRENT_PASSWORD": "pw"}
	ctx := context.Background()

	if now := arrPending(ctx, apps, env); now.Pending || now.Seeding || now.Requests {
		t.Fatalf("nothing on the way: %+v", now)
	}
	queue = 2
	if now := arrPending(ctx, apps, env); !now.Pending || !strings.Contains(now.Why, "Sonarr has 2") {
		t.Fatalf("a queue: %+v", now)
	}
	queue = 0
	torrents = `[{"state":"downloading","progress":0.4},{"state":"uploading","progress":1}]`
	if now := arrPending(ctx, apps, env); !now.Pending || !strings.Contains(now.Why, "qBittorrent has 1 downloading") {
		t.Fatalf("a download: %+v", now)
	}
	torrents = `[{"state":"pausedDL","progress":0.4},{"state":"stalledUP","progress":1}]`
	if now := arrPending(ctx, apps, env); now.Pending || !now.Seeding {
		t.Fatalf("seeding, and a paused download: %+v", now)
	}
	torrents = `[{"state":"pausedUP","progress":1}]`
	if now := arrPending(ctx, apps, env); now.Pending || now.Seeding {
		t.Fatalf("a finished, paused torrent: %+v", now)
	}
	// qBittorrent unread (no password): it and its tunnel stay up, the rest may rest.
	if now := arrPending(ctx, apps, map[string]string{}); now.Pending || !now.Seeding {
		t.Fatalf("qBittorrent unread: %+v", now)
	}
	requests = 1
	if now := arrPending(ctx, apps, env); !now.Pending || !now.Requests {
		t.Fatalf("a request on the way: %+v", now)
	}
	requests = 0
	// Sonarr answering with an error: kept up rather than stopped with something on the way.
	broken := apps["sonarr"]
	broken.ConfigDir = dir("config.xml", "<ApiKey>wrong</ApiKey>")
	apps["sonarr"] = broken
	if now := arrPending(ctx, apps, env); !now.Pending || !strings.Contains(now.Why, "couldn't be read") {
		t.Fatalf("Sonarr unread: %+v", now)
	}
}

// TestArrRestsAndWakes: the owner, Nov 9: "All arr apps should rest unless
// there is something actually pending", waking every 12 hours; seeding
// keeps qBittorrent up; a person's start or stop is theirs.
func TestArrRestsAndWakes(t *testing.T) {
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	var on arrNow
	was := arrPendingNow
	arrPendingNow = func(context.Context, map[string]wiring.App, map[string]string) arrNow { return on }
	t.Cleanup(func() { arrPendingNow = was })

	now := time.Now()
	ctr := func(service string, running bool) docker.FakeContainer {
		return docker.FakeContainer{Name: "homelab_media_automation-" + service + "-1", Image: "x", Running: running, Health: "healthy", Project: "homelab_media_automation", Service: service}
	}
	all := func(running bool) []docker.FakeContainer {
		return []docker.FakeContainer{ctr("sonarr", running), ctr("radarr", running), ctr("qbittorrent", running), ctr("gluetun", running), ctr("seerr", true)}
	}
	tick := func(ctrs []docker.FakeContainer, env map[string]string, at time.Time) string {
		t.Helper()
		calls := fakeDocker(t, ctrs)
		if env == nil {
			env = h.envMap()
		}
		h.restArr(context.Background(), env, at)
		return readCalls(t, calls)
	}
	path := stopped.Path(root)

	// Something pending, or TIDY_ARR_REST=false: up.
	on = arrNow{Pending: true, Why: "Sonarr has 1 in its queue"}
	if log := tick(all(true), nil, now); strings.Contains(log, "stop") {
		t.Fatalf("rested with something pending:\n%s", log)
	}
	on = arrNow{}
	// 15 minutes after the last pending: still up.
	if log := tick(all(true), nil, now.Add(5*time.Minute)); strings.Contains(log, "stop") {
		t.Fatalf("rested 5 minutes after something pending:\n%s", log)
	}
	later := now.Add(time.Hour)
	offEnv := h.envMap()
	offEnv["TIDY_ARR_REST"] = "false"
	if log := tick(all(true), offEnv, later); strings.Contains(log, "stop") {
		t.Fatalf("rested with TIDY_ARR_REST=false:\n%s", log)
	}

	// Seeding: Sonarr and Radarr rest, qBittorrent and Gluetun stay up; Seerr always.
	on = arrNow{Seeding: true}
	log := tick(all(true), nil, later)
	if !strings.Contains(log, "stop sonarr") || !strings.Contains(log, "stop radarr") || strings.Contains(log, "stop qbittorrent") || strings.Contains(log, "stop gluetun") || strings.Contains(log, "stop seerr") {
		t.Fatalf("seeding:\n%s", log)
	}
	for _, id := range []string{"sonarr", "radarr"} {
		if s, ok := stopped.Load(path)[id]; !ok || s.Why != whyTidy {
			t.Fatalf("stopped.json: %+v", stopped.Load(path))
		}
	}
	if rec := media.LoadRecord(root); !rec.ArrResting || len(rec.ArrStopped) != 2 {
		t.Fatalf("record: %+v", rec)
	}

	// Twelve hours on: they wake, Gluetun's order kept, and leave stopped.json.
	log = tick([]docker.FakeContainer{ctr("sonarr", false), ctr("radarr", false), ctr("qbittorrent", true), ctr("gluetun", true), ctr("seerr", true)}, nil, later.Add(13*time.Hour))
	if !strings.Contains(log, "start radarr") || !strings.Contains(log, "start sonarr") {
		t.Fatalf("the 12-hour wake:\n%s", log)
	}
	if st := stopped.Load(path); st.Has("sonarr") || st.Has("radarr") {
		t.Fatalf("still in stopped.json after waking: %+v", st)
	}
	rec := media.LoadRecord(root)
	if rec.ArrResting || rec.ArrWoke.IsZero() {
		t.Fatalf("after waking: %+v", rec)
	}

	// Nothing seeding: all four rest, qBittorrent before Gluetun.
	on = arrNow{}
	rec.ArrWoke = later.Add(-time.Hour)
	_ = rec.Save(root)
	log = tick(all(true), nil, later)
	q, g := strings.Index(log, "stop qbittorrent"), strings.Index(log, "stop gluetun")
	if q < 0 || g < 0 || g < q {
		t.Fatalf("qBittorrent should stop before Gluetun:\n%s", log)
	}
	// Woken for a request: Gluetun starts before qBittorrent.
	on = arrNow{Requests: true}
	log = tick(append(all(false)[:4], ctr("seerr", true)), nil, later.Add(time.Minute))
	gs, qs := strings.Index(log, "start gluetun"), strings.Index(log, "start qbittorrent")
	if gs < 0 || qs < 0 || qs < gs {
		t.Fatalf("a request should wake them, Gluetun first:\n%s", log)
	}

	// Someone starts one while they rest: up until the next 12-hour wake.
	on = arrNow{}
	rec = media.LoadRecord(root)
	rec.ArrWoke = later.Add(-time.Hour)
	_ = rec.Save(root)
	tick(all(true), nil, later.Add(2*time.Hour)) // rest all four
	_ = stopped.Update(path, func(r stopped.Record) bool { delete(r, "sonarr"); return true })
	tick([]docker.FakeContainer{ctr("sonarr", true), ctr("radarr", false), ctr("qbittorrent", false), ctr("gluetun", false), ctr("seerr", true)}, nil, later.Add(2*time.Hour+time.Minute))
	if rec := media.LoadRecord(root); rec.ArrResting || !rec.ArrLeftUp {
		t.Fatalf("someone's start not kept: %+v", rec)
	}
	if log := tick(all(true), nil, later.Add(5*time.Hour)); strings.Contains(log, "stop") {
		t.Fatalf("stopped what someone started, before the next wake:\n%s", log)
	}

	// A person's stop is never undone: theirs stays stopped through a wake.
	_ = stopped.Update(path, func(r stopped.Record) bool {
		r["radarr"] = stopped.Stop{Since: now.UTC()}
		return true
	})
	rec = media.LoadRecord(root)
	rec.ArrLeftUp, rec.ArrWoke, rec.ArrBusy = false, later.Add(-time.Hour), time.Time{}
	_ = rec.Save(root)
	log = tick([]docker.FakeContainer{ctr("sonarr", true), ctr("radarr", false), ctr("qbittorrent", true), ctr("gluetun", true), ctr("seerr", true)}, nil, later.Add(20*time.Hour))
	if strings.Contains(log, "radarr") {
		t.Fatalf("touched the Radarr a person stopped:\n%s", log)
	}
	if s := stopped.Load(path)["radarr"]; s.Why != "" {
		t.Fatalf("a person's stop changed: %+v", s)
	}
}
