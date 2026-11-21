package main

import (
	"context"
	"encoding/json"
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

// The media apps' own health checks, in plain words (arr item 4): a problem
// that lasts half an hour is said once; one that clears and comes back is
// said again; Hand over's own warning (the apps no longer import) and what
// a person needn't act on are never said; an app that is resting keeps
// what was said of it.
func TestMediaHealth(t *testing.T) {
	var mu sync.Mutex
	health := map[string][]map[string]any{
		"sonarr": {
			{"source": "ImportMechanismCheck", "type": "warning", "message": "Enable Completed Download Handling if possible"},
			{"source": "DownloadClientCheck", "type": "error", "message": "Unable to communicate with qBittorrent. Connection refused"},
			{"source": "UpdateCheck", "type": "warning", "message": "Cannot install update"},
		},
		"radarr": {
			{"source": "IndexerSearchCheck", "type": "warning", "message": "No indexers available with Automatic Search enabled"},
			{"source": "RootFolderCheck", "type": "error", "message": "Missing root folder: /movies"},
		},
		"prowlarr": {
			{"source": "IndexerStatusCheck", "type": "warning", "message": "Indexers unavailable due to failures: SomeSite"},
			{"source": "SomethingNew", "type": "error", "message": "Database is locked"},
		},
	}
	down := map[string]bool{}
	serve := func(app, api string) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			defer mu.Unlock()
			if down[app] {
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
			if r.URL.Path != "/api/"+api+"/health" || r.Header.Get("X-Api-Key") != app+"-key" {
				http.NotFound(w, r)
				return
			}
			json.NewEncoder(w).Encode(health[app])
		}))
	}
	son, rad, prow := serve("sonarr", "v3"), serve("radarr", "v3"), serve("prowlarr", "v1")
	defer son.Close()
	defer rad.Close()
	defer prow.Close()
	keyDir := func(key string) string {
		d := t.TempDir()
		os.WriteFile(filepath.Join(d, "config.xml"), []byte("<Config><ApiKey>"+key+"</ApiKey></Config>"), 0o644)
		return d
	}
	apps := map[string]wiring.App{
		"sonarr":   {ID: "sonarr", Name: "Sonarr", URL: son.URL, ConfigDir: keyDir("sonarr-key")},
		"radarr":   {ID: "radarr", Name: "Radarr", URL: rad.URL, ConfigDir: keyDir("radarr-key")},
		"prowlarr": {ID: "prowlarr", Name: "Prowlarr", URL: prow.URL, ConfigDir: keyDir("prowlarr-key")},
	}
	start := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	st := &mediaHealthState{}
	ctx := context.Background()

	// Just seen: nothing yet (an app starting up, the VPN reconnecting).
	if said := mediaHealthIn(ctx, apps, st, nil, start); len(said) != 0 {
		t.Fatalf("at once: %q", said)
	}
	said := mediaHealthIn(ctx, apps, st, nil, start.Add(31*time.Minute))
	all := strings.Join(said, "\n")
	for _, want := range []string{
		"Sonarr can't reach the app that downloads for it",
		"Radarr has no search sites to look in",
		"Radarr can't find its library folder",
		"Some search sites aren't answering Prowlarr",
		"Prowlarr says: Database is locked",
	} {
		if !strings.Contains(all, want) {
			t.Errorf("missing %q in %q", want, said)
		}
	}
	if len(said) != 5 {
		t.Errorf("said %d lines, want 5: %q", len(said), said)
	}
	for _, never := range []string{"Completed Download Handling", "update", "SomeSite"} {
		if strings.Contains(all, never) {
			t.Errorf("said %q: %q", never, said)
		}
	}
	// Said once: not again an hour later.
	if again := mediaHealthIn(ctx, apps, st, nil, start.Add(90*time.Minute)); len(again) != 0 {
		t.Fatalf("again: %q", again)
	}
	// Sonarr rests (doesn't answer): what was said of it stays said.
	mu.Lock()
	down["sonarr"] = true
	mu.Unlock()
	if again := mediaHealthIn(ctx, apps, st, nil, start.Add(100*time.Minute)); len(again) != 0 {
		t.Fatalf("resting: %q", again)
	}
	mu.Lock()
	down["sonarr"] = false
	// The download app answers again, then fails again: said again, half an hour on.
	health["sonarr"] = health["sonarr"][:1]
	mu.Unlock()
	mediaHealthIn(ctx, apps, st, nil, start.Add(110*time.Minute))
	mu.Lock()
	health["sonarr"] = append(health["sonarr"], map[string]any{"source": "DownloadClientCheck", "type": "error", "message": "Unable to communicate"})
	mu.Unlock()
	mediaHealthIn(ctx, apps, st, nil, start.Add(120*time.Minute))
	back := mediaHealthIn(ctx, apps, st, nil, start.Add(151*time.Minute))
	if len(back) != 1 || !strings.Contains(back[0], "Sonarr can't reach") {
		t.Fatalf("came back: %q", back)
	}
	// An app whose alerts are off (Settings › Notifications) says nothing.
	st2 := &mediaHealthState{}
	mediaHealthIn(ctx, apps, st2, []string{"radarr"}, start)
	quiet := strings.Join(mediaHealthIn(ctx, apps, st2, []string{"radarr"}, start.Add(31*time.Minute)), "\n")
	if strings.Contains(quiet, "Radarr") || !strings.Contains(quiet, "Sonarr") {
		t.Fatalf("Radarr's alerts off: %q", quiet)
	}
}

func TestMediaHealthStateKept(t *testing.T) {
	root := t.TempDir()
	st := loadMediaHealth(root)
	st.First = map[string]time.Time{"sonarr:DownloadClientCheck": time.Unix(100, 0).UTC()}
	st.Told = map[string]bool{"sonarr:DownloadClientCheck": true}
	if err := st.save(root); err != nil {
		t.Fatal(err)
	}
	back := loadMediaHealth(root)
	if !back.Told["sonarr:DownloadClientCheck"] || !back.First["sonarr:DownloadClientCheck"].Equal(time.Unix(100, 0)) {
		t.Fatalf("kept %+v", back)
	}
}
