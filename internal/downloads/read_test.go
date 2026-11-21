package downloads

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// fakeApp serves paths with the API key "k", and writes its config file.
func fakeApp(t *testing.T, id, name, file, config string, paths map[string]string) wiring.App {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, file), []byte(config), 0o600); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Api-Key") != "k" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		body, ok := paths[r.URL.RequestURI()]
		if !ok {
			t.Errorf("%s asked %s", name, r.URL.RequestURI())
			w.WriteHeader(http.StatusNotFound)
			return
		}
		fmt.Fprint(w, body)
	}))
	t.Cleanup(srv.Close)
	return wiring.App{ID: id, Name: name, URL: srv.URL, ConfigDir: dir}
}

// The card is read from Radarr's and Sonarr's queues and Seerr's requests:
// a film coming, a show nothing was found for after hours, a request whose
// film is queued (listed once, as its download), one not out yet; a
// resting app isn't asked, and its request waits.
func TestReadsTheCardFromTheApps(t *testing.T) {
	const arrXML = "<Config><ApiKey>k</ApiKey></Config>"
	radarr := fakeApp(t, "radarr", "Radarr", "config.xml", arrXML, map[string]string{
		"/api/v3/queue?pageSize=200&includeMovie=true": `{"records":[{"movieId":7,"status":"downloading","trackedDownloadState":"downloading","trackedDownloadStatus":"ok","size":1000,"sizeleft":250,"timeleft":"00:05:00","downloadId":"ABC","movie":{"title":"Dune: Part Two","year":2024}}]}`,
		"/api/v3/movie/9": `{"title":"Superman","year":2027,"isAvailable":false}`,
	})
	sonarr := fakeApp(t, "sonarr", "Sonarr", "config.xml", arrXML, map[string]string{
		"/api/v3/queue?pageSize=200&includeSeries=true&includeEpisode=true": `{"records":[]}`,
		"/api/v3/series/3": `{"title":"Pluribus","status":"continuing"}`,
	})
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	old, young := now.Add(-5*time.Hour).Format(time.RFC3339), now.Add(-10*time.Minute).Format(time.RFC3339)
	seerr := fakeApp(t, "seerr", "Seerr", "settings.json", `{"main":{"apiKey":"k"}}`, map[string]string{
		"/api/v1/request?take=100&filter=processing": `{"results":[
			{"type":"movie","createdAt":"` + old + `","media":{"status":3,"externalServiceId":7}},
			{"type":"tv","createdAt":"` + old + `","media":{"status":3,"externalServiceId":3}},
			{"type":"tv","createdAt":"` + old + `","media":{"status":4,"externalServiceId":4}},
			{"type":"movie","createdAt":"` + old + `","media":{"status":3,"externalServiceId":9}},
			{"type":"movie","createdAt":"` + young + `","media":{"status":2,"externalServiceId":null}}
		]}`,
	})
	apps := map[string]wiring.App{"radarr": radarr, "sonarr": sonarr, "seerr": seerr}
	c := Read(context.Background(), apps, nil, true, drive(60), now)
	if want := "Getting 1 · 1 stuck: no search site has it · 2 waiting · Drive 60% full"; c.Line != want {
		t.Errorf("line = %q, want %q\n%+v", c.Line, want, c.Items)
	}
	want := []Item{
		{Name: "Pluribus", App: "Sonarr", State: Stuck, Words: "No search site has it yet", Request: true},
		{Name: "Dune: Part Two (2024)", App: "Radarr", State: Getting, Words: "75% · about 5 minutes left", Percent: 75},
		{Name: "Superman (2027)", App: "Radarr", State: Waiting, Words: "Not out yet: Radarr gets it once it is", Request: true},
		{Name: "A film someone asked for", App: "Radarr", State: Waiting, Words: "Looking for it", Request: true},
	}
	if len(c.Items) != len(want) {
		t.Fatalf("items = %+v", c.Items)
	}
	for i := range want {
		if c.Items[i] != want[i] {
			t.Errorf("item %d = %+v, want %+v", i, c.Items[i], want[i])
		}
	}

	// Sonarr resting: not asked, and its request waits rather than sticks.
	delete(apps, "sonarr")
	c = Read(context.Background(), apps, nil, true, nil, now)
	for _, it := range c.Items {
		if it.Name == "A show someone asked for" && it.State != Waiting {
			t.Errorf("a resting Sonarr's request: %+v", it)
		}
	}

	// Radarr not answering is said.
	radarr.URL = "http://127.0.0.1:1"
	c = Read(context.Background(), map[string]wiring.App{"radarr": radarr}, nil, true, nil, now)
	if c.Line != "Nothing on the way · Radarr didn't answer" {
		t.Errorf("unanswered: %q", c.Line)
	}
}
