package wiring

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestHandOver(t *testing.T) {
	var mu sync.Mutex
	saved := map[string]map[string]any{}
	configs := map[string]map[string]any{
		"/api/v3/config/naming":         {"id": 1.0, "renameEpisodes": true, "standardEpisodeFormat": "x"},
		"/api/v3/config/downloadclient": {"id": 1.0, "enableCompletedDownloadHandling": false},
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("X-Api-Key") != "k" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch {
		case r.URL.Path == "/api/v3/system/status":
			_, _ = w.Write([]byte(`{}`))
		case r.Method == http.MethodGet:
			_ = json.NewEncoder(w).Encode(configs[r.URL.Path])
		case r.Method == http.MethodPut:
			var body map[string]any
			data, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(data, &body)
			saved[r.URL.Path] = body
			_, _ = w.Write(data)
		}
	}))
	defer srv.Close()
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "config.xml"), []byte("<Config><ApiKey>k</ApiKey></Config>"), 0o644)
	w := &Wirer{Apps: map[string]App{
		"sonarr":        {ID: "sonarr", Name: "Sonarr", URL: srv.URL, ConfigDir: dir},
		"lazylibrarian": {ID: "lazylibrarian", Name: "LazyLibrarian"},
	}}
	plan := w.HandOverPlan()
	if len(plan) != 3 || plan[0].Text != "Sonarr stops renaming files" {
		t.Fatalf("plan: %+v", plan)
	}
	links := w.HandOver(context.Background(), nil)
	states := []string{}
	for _, l := range links {
		states = append(states, l.State)
	}
	if strings.Join(states, ",") != "done,already,manual" {
		t.Errorf("states: %v (%+v)", states, links)
	}
	got := saved["/api/v3/config/naming/1"]
	if got["renameEpisodes"] != false || got["standardEpisodeFormat"] != "x" {
		t.Errorf("only renaming changes, the rest is kept: %v", got)
	}
	if _, ok := saved["/api/v3/config/downloadclient/1"]; ok {
		t.Error("already off: left as it is")
	}
}

// TestConnectHandsOver: Connect apps hands the downloads to Tidy Up by
// itself (the owner, Nov 19: Tidy Up files every download), so the *arr
// apps never import a second copy; a second run changes nothing. When Tidy
// Up's inbox won't file what qBittorrent downloads (turned off, manual
// only, or not watching DOWNLOADS_ROOT), the apps keep filing, and wire
// says why instead of stranding the downloads.
func TestConnectHandsOver(t *testing.T) {
	var mu sync.Mutex
	puts := 0
	configs := map[string]map[string]any{
		"/api/v3/config/naming":         {"id": 1.0, "renameEpisodes": true},
		"/api/v3/config/downloadclient": {"id": 1.0, "enableCompletedDownloadHandling": true},
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch {
		case r.URL.Path == "/api/v3/system/status":
			_, _ = w.Write([]byte(`{}`))
		case r.Method == http.MethodGet:
			_ = json.NewEncoder(w).Encode(configs[r.URL.Path])
		case r.Method == http.MethodPut:
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			configs[strings.TrimSuffix(r.URL.Path, "/1")] = body
			puts++
			_, _ = w.Write([]byte(`{}`))
		}
	}))
	defer srv.Close()
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "config.xml"), []byte("<Config><ApiKey>k</ApiKey></Config>"), 0o644)
	newWirer := func(env map[string]string) *Wirer {
		return &Wirer{Apps: map[string]App{"sonarr": {ID: "sonarr", Name: "Sonarr", URL: srv.URL, ConfigDir: dir}}, Env: env}
	}
	texts := func(links []Link) string {
		var s []string
		for _, l := range links {
			s = append(s, l.Text+"="+l.State)
		}
		return strings.Join(s, "; ")
	}
	env := map[string]string{"DOWNLOADS_ROOT": "/Volumes/Media/downloads", "TIDY_UP": "true", "TIDY_INBOX": "true"}
	plan := texts(newWirer(env).Plan())
	if !strings.Contains(plan, "Sonarr stops renaming files=planned") || !strings.Contains(plan, "Sonarr leaves finished downloads for Library=planned") {
		t.Fatalf("Connect apps hands over: %s", plan)
	}
	run := func(w *Wirer) string {
		var got []Link
		for _, l := range w.Apply(context.Background(), nil) {
			if strings.Contains(l.Text, "renaming") || strings.Contains(l.Text, "Library") {
				got = append(got, l)
			}
		}
		return texts(got)
	}
	if got := run(newWirer(env)); got != "Sonarr stops renaming files=done; Sonarr leaves finished downloads for Library=done" {
		t.Fatalf("first run: %s", got)
	}
	before := puts
	if got := run(newWirer(env)); got != "Sonarr stops renaming files=already; Sonarr leaves finished downloads for Library=already" || puts != before {
		t.Fatalf("second run changes nothing: %s (%d saves)", got, puts-before)
	}

	for name, env := range map[string]map[string]string{
		"Tidy Up off":        {"DOWNLOADS_ROOT": "/d", "TIDY_UP": "false"},
		"inbox off":          {"DOWNLOADS_ROOT": "/d", "TIDY_INBOX": "no"},
		"inbox by hand only": {"DOWNLOADS_ROOT": "/d", "TIDY_INBOX_WHEN": "manual"},
		"other folders":      {"DOWNLOADS_ROOT": "/d", "TIDY_INBOX_FOLDERS": "~/Downloads;/elsewhere"},
		"no downloads root":  {},
	} {
		plan := newWirer(env).Plan()
		got := texts(plan)
		if strings.Contains(got, "renaming") || !strings.Contains(got, "Sonarr files its own downloads=planned") {
			t.Errorf("%s: %s", name, got)
		}
		for _, l := range newWirer(env).Apply(context.Background(), nil) {
			if l.Text != "Sonarr files its own downloads" {
				continue
			}
			// Said in words, without a setting's code name.
			if l.State != "manual" || l.Detail == "" || strings.Contains(l.Detail, "TIDY_") || strings.Contains(l.Detail, "DOWNLOADS_ROOT") {
				t.Errorf("%s: says why: %+v", name, l)
			}
			// Only the inbox that waits for Tidy up now has a one-click fix.
			if want := map[bool]string{true: FixInboxArrive}[name == "inbox by hand only"]; l.Fix != want {
				t.Errorf("%s: fix %q, want %q", name, l.Fix, want)
			}
		}
	}
	// Watching it among other folders is enough.
	env = map[string]string{"DOWNLOADS_ROOT": "/d/", "TIDY_INBOX_FOLDERS": "~/Downloads; /d"}
	if got := texts(newWirer(env).Plan()); !strings.Contains(got, "Sonarr stops renaming files") {
		t.Errorf("watched among others: %s", got)
	}
}

// Three apps that keep filing are one line, not three of the same.
func TestKeepsFilingIsOneLine(t *testing.T) {
	apps := map[string]App{}
	for _, id := range []string{"sonarr", "radarr", "lidarr"} {
		apps[id] = App{ID: id, Name: strings.ToUpper(id[:1]) + id[1:], URL: "http://127.0.0.1:1", ConfigDir: t.TempDir()}
	}
	w := &Wirer{Apps: apps, Env: map[string]string{"DOWNLOADS_ROOT": "/d", "TIDY_INBOX_WHEN": "manual"}, Wait: time.Millisecond}
	var lines []Link
	for _, l := range w.Apply(context.Background(), nil) {
		if strings.Contains(l.Text, "own downloads") || strings.Contains(l.Text, "keeps filing") {
			lines = append(lines, l)
		}
	}
	if len(lines) != 1 {
		t.Fatalf("%d lines: %+v", len(lines), lines)
	}
	l := lines[0]
	if l.Text != "Sonarr, Radarr and Lidarr file their own downloads" || l.Fix != FixInboxArrive || !strings.Contains(l.Detail, "Tidy up now") {
		t.Fatalf("%+v", l)
	}
}
