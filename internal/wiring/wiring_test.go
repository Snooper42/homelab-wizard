package wiring

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
)

// fakeArr serves the parts of an *arr API that wiring uses.
func fakeArr(t *testing.T, key string, schemas map[string][]resource) (url string, saved map[string][]resource) {
	return fakeArrRefusing(t, key, schemas, map[string]int{})
}

// fakeArrRefusing refuses the first refuse[kind] saves of a kind with 400,
// as an *arr app does when its connection test fails.
func fakeArrRefusing(t *testing.T, key string, schemas map[string][]resource, refuse map[string]int) (url string, saved map[string][]resource) {
	t.Helper()
	saved = map[string][]resource{}
	var mu sync.Mutex
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Api-Key") != key {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		mu.Lock()
		defer mu.Unlock()
		parts := strings.Split(r.URL.Path, "/") // "", "api", "v3", kind[, "schema"]
		kind := parts[3]
		switch {
		case kind == "system":
			w.Write([]byte(`{}`))
		case len(parts) > 4 && parts[4] == "schema":
			json.NewEncoder(w).Encode(schemas[kind])
		case r.Method == http.MethodPost && refuse[kind] > 0:
			refuse[kind]--
			http.Error(w, `[{"errorMessage":"Unable to connect"}]`, http.StatusBadRequest)
		case r.Method == http.MethodPost:
			var body resource
			json.NewDecoder(r.Body).Decode(&body)
			body["id"] = float64(len(saved[kind]) + 1)
			saved[kind] = append(saved[kind], body)
			w.Write([]byte(`{"id":7}`))
		case r.Method == http.MethodPut:
			var body resource
			json.NewDecoder(r.Body).Decode(&body)
			for i, cur := range saved[kind] {
				if len(parts) > 4 && fmt.Sprint(cur["id"]) == parts[4] {
					saved[kind][i] = body
				}
			}
			w.Write([]byte(`{}`))
		default:
			json.NewEncoder(w).Encode(append([]resource{}, saved[kind]...))
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL, saved
}

func template(impl string, fields ...string) resource {
	var list []any
	for _, f := range fields {
		list = append(list, map[string]any{"name": f, "value": nil})
	}
	return resource{"implementation": impl, "fields": list}
}

func configDir(t *testing.T, key string) string {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "config.xml"), []byte("<Config><ApiKey>"+key+"</ApiKey></Config>"), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func field(r resource, name string) any {
	for _, f := range r["fields"].([]any) {
		if m := f.(map[string]any); m["name"] == name {
			return m["value"]
		}
	}
	return nil
}

func TestWiring(t *testing.T) {
	prowlarrURL, prowlarr := fakeArr(t, "pkey", map[string][]resource{
		"applications": {template("Radarr", "prowlarrUrl", "baseUrl", "apiKey"), template("Sonarr", "prowlarrUrl", "baseUrl", "apiKey")},
		"indexerProxy": {template("FlareSolverr", "host", "requestTimeout")},
	})
	sonarrURL, sonarr := fakeArr(t, "skey", map[string][]resource{
		"downloadclient": {template("QBittorrent", "host", "port", "username", "password", "tvCategory")},
	})
	w := &Wirer{
		Apps: map[string]App{
			"prowlarr":     {ID: "prowlarr", Name: "Prowlarr", URL: prowlarrURL, Internal: "http://prowlarr:9696", ConfigDir: configDir(t, "pkey")},
			"sonarr":       {ID: "sonarr", Name: "Sonarr", URL: sonarrURL, Internal: "http://sonarr:8989", ConfigDir: configDir(t, "skey")},
			"qbittorrent":  {ID: "qbittorrent", Name: "qBittorrent", Internal: "http://gluetun:8082"},
			"flaresolverr": {ID: "flaresolverr", Name: "FlareSolverr"},
		},
		Env:  map[string]string{},
		Wait: time.Second,
	}
	if got := len(w.Plan()); got != 3 {
		t.Fatalf("plan has %d links: %+v", got, w.Plan())
	}
	links := w.Apply(context.Background(), nil)
	states := map[string]string{}
	for _, l := range links {
		states[l.Text] = l.State
	}
	if states["Prowlarr sends indexers to Sonarr"] != "done" || states["FlareSolverr is set up in Prowlarr"] != "done" || states["qBittorrent is the download client for Sonarr"] != "manual" {
		t.Fatalf("first run: %+v", links)
	}
	app := prowlarr["applications"][0]
	if app["name"] != "Sonarr" || field(app, "baseUrl") != "http://sonarr:8989" || field(app, "apiKey") != "skey" || field(app, "prowlarrUrl") != "http://prowlarr:9696" {
		t.Fatalf("prowlarr application: %+v", app)
	}

	w.Env["QBITTORRENT_PASSWORD"] = "pw"
	for _, l := range w.Apply(context.Background(), nil) {
		want := "already"
		if strings.HasPrefix(l.Text, "qBittorrent") {
			want = "done"
		}
		if l.State != want {
			t.Fatalf("second run: %+v", l)
		}
	}
	dc := sonarr["downloadclient"][0]
	if field(dc, "host") != "gluetun" || field(dc, "port") != float64(8082) || field(dc, "username") != "admin" || field(dc, "tvCategory") != "tv" {
		t.Fatalf("download client: %+v", dc)
	}
}

func TestWaitsForAnAppThatIsNotUp(t *testing.T) {
	w := &Wirer{
		Apps: map[string]App{
			"prowlarr": {ID: "prowlarr", Name: "Prowlarr", URL: "http://127.0.0.1:1", ConfigDir: t.TempDir()},
			"sonarr":   {ID: "sonarr", Name: "Sonarr", URL: "http://127.0.0.1:1", ConfigDir: t.TempDir()},
		},
		Wait: 10 * time.Millisecond,
	}
	l := w.Apply(context.Background(), nil)[0]
	if l.State != "failed" || !strings.Contains(l.Detail, "did not answer") {
		t.Fatalf("%+v", l)
	}
}

func TestRetriesARefusedSaveAndCorrectsAWrongAddress(t *testing.T) {
	sonarrURL, sonarr := fakeArrRefusing(t, "skey", map[string][]resource{
		"downloadclient": {template("QBittorrent", "host", "port", "username", "password")},
	}, map[string]int{"downloadclient": 2})
	w := &Wirer{
		Apps: map[string]App{
			"sonarr":      {ID: "sonarr", Name: "Sonarr", URL: sonarrURL, Internal: "http://sonarr:8989", ConfigDir: configDir(t, "skey")},
			"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", Internal: "http://gluetun:8082"},
		},
		Env:     map[string]string{"QBITTORRENT_PASSWORD": "pw"},
		Wait:    time.Second,
		retryIn: time.Millisecond,
	}
	if l := w.Apply(context.Background(), nil)[0]; l.State != "done" || len(sonarr["downloadclient"]) != 1 {
		t.Fatalf("a save refused while qBittorrent starts should be retried: %+v %v", l, sonarr["downloadclient"])
	}
	// Someone pointed it at the wrong host; the next run corrects it.
	setField(sonarr["downloadclient"][0], "host", "localhost")
	l := w.Apply(context.Background(), nil)[0]
	if l.State != "done" || !strings.Contains(l.Detail, "corrected host") || field(sonarr["downloadclient"][0], "host") != "gluetun" {
		t.Fatalf("wrong host not corrected: %+v %v", l, sonarr["downloadclient"][0])
	}
	if l := w.Apply(context.Background(), nil)[0]; l.State != "already" {
		t.Fatalf("third run: %+v", l)
	}
}

func TestSaysWhyAnAppDidNotAnswer(t *testing.T) {
	w := &Wirer{
		Apps: map[string]App{
			"prowlarr": {ID: "prowlarr", Name: "Prowlarr", URL: "http://127.0.0.1:1", ConfigDir: t.TempDir()},
			"sonarr":   {ID: "sonarr", Name: "Sonarr", URL: "http://127.0.0.1:1", ConfigDir: t.TempDir()},
			"radarr":   {ID: "radarr", Name: "Radarr", URL: "http://127.0.0.1:1", ConfigDir: t.TempDir()},
		},
		Wait: 50 * time.Millisecond,
	}
	start := time.Now()
	links := w.Apply(context.Background(), nil)
	if !strings.Contains(links[0].Detail, "no API key in") {
		t.Fatalf("the reason is missing: %+v", links[0])
	}
	// Prowlarr is waited for once, not once per link.
	if took := time.Since(start); took > 140*time.Millisecond {
		t.Fatalf("took %s for %d links", took, len(links))
	}
}
