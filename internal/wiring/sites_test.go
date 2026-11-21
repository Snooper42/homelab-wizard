package wiring

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// fakeProwlarr answers /api/v1/indexer and /api/v1/indexerstatus (the
// sites Prowlarr has, and the ones it has blocked after failing its own
// checks), and counts every request that isn't a GET.
func fakeProwlarr(t *testing.T, indexers, blocked *[]map[string]any) (url, dir string, writes *int) {
	t.Helper()
	writes = new(int)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Api-Key") != "key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodGet {
			*writes++
		}
		switch r.URL.Path {
		case "/api/v1/indexer":
			json.NewEncoder(w).Encode(*indexers)
		case "/api/v1/indexerstatus":
			json.NewEncoder(w).Encode(*blocked)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	dir = t.TempDir()
	os.WriteFile(filepath.Join(dir, "config.xml"), []byte("<Config><ApiKey>key</ApiKey></Config>"), 0o600)
	return srv.URL, dir, writes
}

// No search sites yet (arr-loop item 5): Setup says none are set up, opens
// Prowlarr's page for adding one, and ticks once one works. It never names
// a site (rule 2), and it only reads.
func TestSearchSites(t *testing.T) {
	indexers := []map[string]any{}
	blocked := []map[string]any{}
	url, dir, writes := fakeProwlarr(t, &indexers, &blocked)
	w := &Wirer{Apps: map[string]App{"prowlarr": {ID: "prowlarr", Name: "Prowlarr", URL: url, ConfigDir: dir}}, Wait: time.Second}
	check := func(working int, said string) SearchSites {
		t.Helper()
		s := w.SearchSites(context.Background())
		if s.Working != working || !strings.Contains(s.Said, said) {
			t.Fatalf("got %+v, want %d working, said %q", s, working, said)
		}
		return s
	}

	// None yet: say so, and open Prowlarr's own page, where Add Indexer is.
	if s := check(0, "No search sites yet"); s.Open != url+"/" {
		t.Fatalf("open %q, want Prowlarr's indexers page", s.Open)
	}

	// One turned off in Prowlarr doesn't count.
	indexers = []map[string]any{{"id": 1, "name": "Site A", "enable": false, "protocol": "torrent"}}
	check(0, "turned off")

	// One on, and Prowlarr hasn't blocked it: it works.
	indexers[0]["enable"] = true
	if s := check(1, "1 search site works"); strings.Contains(s.Said, "Site A") {
		t.Fatalf("the words name a site: %q", s.Said)
	}

	// Prowlarr blocked it after failing to reach it: none works, and it says so.
	blocked = []map[string]any{{"indexerId": 1, "disabledTill": time.Now().Add(time.Hour).UTC().Format(time.RFC3339)}}
	check(0, "Prowlarr couldn't reach")

	// A second one, on and working; a Usenet one counts the same.
	indexers = append(indexers, map[string]any{"id": 2, "name": "Site B", "enable": true, "protocol": "usenet"})
	check(1, "1 search site works")
	blocked = nil
	check(2, "2 search sites work")

	if *writes != 0 {
		t.Fatalf("the check changed Prowlarr (%d writes)", *writes)
	}

	// Prowlarr not answering: can't tell, and says so.
	w.Apps["prowlarr"] = App{ID: "prowlarr", Name: "Prowlarr", URL: "http://127.0.0.1:1", ConfigDir: dir}
	check(0, "didn't answer")

	// Prowlarr not running: nothing to say.
	delete(w.Apps, "prowlarr")
	if s := w.SearchSites(context.Background()); s.Said != "" || s.Open != "" {
		t.Fatalf("no Prowlarr: %+v", s)
	}
}
