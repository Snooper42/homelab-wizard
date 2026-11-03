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
