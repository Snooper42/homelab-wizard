package wiring

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func linkStates(links []Link) map[string]Link {
	out := map[string]Link{}
	for _, l := range links {
		out[l.Text] = l
	}
	return out
}

func TestLidarrRootFolderCarriesItsProfiles(t *testing.T) {
	lidarrURL, lidarr := fakeArr(t, "lkey", nil)
	lidarr["qualityprofile"] = []resource{{"id": float64(3), "name": "Lossless"}}
	lidarr["metadataprofile"] = []resource{{"id": float64(5), "name": "Standard"}}
	w := &Wirer{Apps: map[string]App{"lidarr": {ID: "lidarr", Name: "Lidarr", URL: lidarrURL, ConfigDir: configDir(t, "lkey")}}, Wait: time.Second}
	l := w.Apply(context.Background(), nil)[0]
	if l.Text != "Lidarr keeps its library in /music" || l.State != "done" {
		t.Fatalf("%+v", l)
	}
	rf := lidarr["rootfolder"][0]
	if rf["path"] != "/music" || rf["defaultQualityProfileId"] != float64(3) || rf["defaultMetadataProfileId"] != float64(5) {
		t.Fatalf("root folder: %+v", rf)
	}
	if l := w.Apply(context.Background(), nil)[0]; l.State != "already" || len(lidarr["rootfolder"]) != 1 {
		t.Fatalf("second run: %+v", l)
	}
}

// fakeBazarr serves Bazarr's settings: GET as JSON, POST as a form, as
// Bazarr's own settings page sends it.
func fakeBazarr(t *testing.T, key string) (string, *url.Values, map[string]map[string]any) {
	t.Helper()
	settings := map[string]map[string]any{
		"general": {"use_sonarr": false, "use_radarr": false},
		"sonarr":  {"ip": "127.0.0.1", "port": 8989, "apikey": ""},
		"radarr":  {"ip": "127.0.0.1", "port": 7878, "apikey": ""},
	}
	var posted url.Values
	var mu sync.Mutex
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("X-API-KEY") != key || r.URL.Path != "/api/system/settings" {
			http.Error(w, "no", http.StatusUnauthorized)
			return
		}
		if r.Method == http.MethodPost {
			r.ParseForm()
			posted = r.PostForm
			for k, v := range r.PostForm {
				p := strings.SplitN(k, "-", 3) // settings-sonarr-ip
				val := any(v[0])
				if v[0] == "true" {
					val = true
				}
				settings[p[1]][p[2]] = val
			}
			return
		}
		json.NewEncoder(w).Encode(settings)
	}))
	t.Cleanup(srv.Close)
	return srv.URL, &posted, settings
}

func TestBazarrFetchesSubtitlesForSonarrAndRadarr(t *testing.T) {
	sonarrURL, _ := fakeArr(t, "skey", nil)
	radarrURL, _ := fakeArr(t, "rkey", nil)
	bazarrURL, posted, settings := fakeBazarr(t, "bkey")
	bdir := t.TempDir()
	os.MkdirAll(filepath.Join(bdir, "config"), 0o755)
	os.WriteFile(filepath.Join(bdir, "config", "config.yaml"), []byte("general:\n  use_sonarr: false\nauth:\n  apikey: bkey\n  type: form\n"), 0o644)
	w := &Wirer{Apps: map[string]App{
		"sonarr": {ID: "sonarr", Name: "Sonarr", URL: sonarrURL, Internal: "http://sonarr:8989", ConfigDir: configDir(t, "skey")},
		"radarr": {ID: "radarr", Name: "Radarr", URL: radarrURL, Internal: "http://radarr:7878", ConfigDir: configDir(t, "rkey")},
		"bazarr": {ID: "bazarr", Name: "Bazarr", URL: bazarrURL, ConfigDir: bdir},
	}, Wait: time.Second}
	got := linkStates(w.Apply(context.Background(), nil))
	for _, arr := range []string{"Sonarr", "Radarr"} {
		if l := got["Bazarr fetches subtitles for "+arr]; l.State != "done" || l.Detail != "" {
			t.Fatalf("%s: %+v", arr, l)
		}
	}
	if settings["general"]["use_radarr"] != true || settings["radarr"]["ip"] != "radarr" || settings["radarr"]["port"] != "7878" || settings["radarr"]["apikey"] != "rkey" {
		t.Fatalf("radarr in bazarr: %+v %+v (posted %v)", settings["general"], settings["radarr"], *posted)
	}
	got = linkStates(w.Apply(context.Background(), nil))
	if l := got["Bazarr fetches subtitles for Sonarr"]; l.State != "already" {
		t.Fatalf("second run: %+v", l)
	}
	// Sonarr's key was made again: the next run corrects it.
	settings["sonarr"]["apikey"] = "old"
	got = linkStates(w.Apply(context.Background(), nil))
	if l := got["Bazarr fetches subtitles for Sonarr"]; l.State != "done" || l.Detail != "corrected apikey" || settings["sonarr"]["apikey"] != "skey" {
		t.Fatalf("key not corrected: %+v %+v", l, settings["sonarr"])
	}
}

// fakeSeerr serves Seerr's Sonarr and Radarr settings for its API key.
func fakeSeerr(t *testing.T, key string) (string, map[string][]resource) {
	t.Helper()
	saved := map[string][]resource{"sonarr": {}, "radarr": {}}
	var mu sync.Mutex
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("X-Api-Key") != key {
			http.Error(w, `{"message":"You do not have permission"}`, http.StatusForbidden)
			return
		}
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/settings/"), "/")
		kind := parts[0]
		switch r.Method {
		case http.MethodGet:
			json.NewEncoder(w).Encode(saved[kind])
		case http.MethodPost:
			var body resource
			json.NewDecoder(r.Body).Decode(&body)
			body["id"] = float64(len(saved[kind]))
			saved[kind] = append(saved[kind], body)
			w.WriteHeader(http.StatusCreated)
		case http.MethodPut:
			var body resource
			json.NewDecoder(r.Body).Decode(&body)
			for i, cur := range saved[kind] {
				if len(parts) > 1 && jsonString(cur["id"]) == parts[1] {
					saved[kind][i] = body
				}
			}
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL, saved
}

func jsonString(v any) string { b, _ := json.Marshal(v); return string(b) }

func seerrDir(t *testing.T, key string, initialized bool) string {
	dir := t.TempDir()
	data, _ := json.Marshal(map[string]any{"main": map[string]any{"apiKey": key}, "public": map[string]any{"initialized": initialized}})
	os.WriteFile(filepath.Join(dir, "settings.json"), data, 0o644)
	return dir
}

func TestSeerrSendsRequestsToSonarrAndRadarr(t *testing.T) {
	sonarrURL, sonarr := fakeArr(t, "skey", nil)
	sonarr["qualityprofile"] = []resource{{"id": float64(1), "name": "Any"}, {"id": float64(4), "name": "HD-1080p"}}
	radarrURL, radarr := fakeArr(t, "rkey", nil)
	radarr["qualityprofile"] = []resource{{"id": float64(2), "name": "Any"}}
	seerrURL, seerr := fakeSeerr(t, "jkey")
	apps := map[string]App{
		"sonarr": {ID: "sonarr", Name: "Sonarr", URL: sonarrURL, Internal: "http://sonarr:8989", ConfigDir: configDir(t, "skey")},
		"radarr": {ID: "radarr", Name: "Radarr", URL: radarrURL, Internal: "http://radarr:7878", ConfigDir: configDir(t, "rkey")},
		"seerr":  {ID: "seerr", Name: "Seerr", URL: seerrURL, ConfigDir: seerrDir(t, "jkey", false)},
	}
	w := &Wirer{Apps: apps, Wait: time.Second}

	// Before anyone signs in with Jellyfin, Seerr waits for a person.
	got := linkStates(w.Apply(context.Background(), nil))
	if l := got["Seerr sends requests to Sonarr"]; l.State != "manual" || !strings.Contains(l.Detail, "sign in with Jellyfin") {
		t.Fatalf("before setup: %+v", l)
	}
	if len(seerr["sonarr"]) != 0 {
		t.Fatalf("saved before setup: %+v", seerr)
	}

	apps["seerr"] = App{ID: "seerr", Name: "Seerr", URL: seerrURL, ConfigDir: seerrDir(t, "jkey", true)}
	got = linkStates(w.Apply(context.Background(), nil))
	if l := got["Seerr sends requests to Sonarr"]; l.State != "done" || l.Detail != "requests use HD-1080p, into /tv" {
		t.Fatalf("sonarr: %+v", l)
	}
	s := seerr["sonarr"][0]
	if s["hostname"] != "sonarr" || s["port"] != float64(8989) || s["apiKey"] != "skey" || s["activeProfileId"] != float64(4) || s["activeDirectory"] != "/tv" || s["isDefault"] != true || s["seriesType"] != "standard" {
		t.Fatalf("sonarr in seerr: %+v", s)
	}
	r := seerr["radarr"][0]
	if r["hostname"] != "radarr" || r["activeProfileName"] != "Any" || r["activeDirectory"] != "/movies" || r["minimumAvailability"] != "released" {
		t.Fatalf("radarr in seerr: %+v", r)
	}

	got = linkStates(w.Apply(context.Background(), nil))
	if l := got["Seerr sends requests to Radarr"]; l.State != "already" || len(seerr["radarr"]) != 1 {
		t.Fatalf("second run: %+v %+v", l, seerr["radarr"])
	}
	// Typed by hand as localhost: corrected, not added again.
	seerr["radarr"][0]["hostname"] = "localhost"
	got = linkStates(w.Apply(context.Background(), nil))
	if l := got["Seerr sends requests to Radarr"]; l.State != "done" || l.Detail != "corrected hostname" || seerr["radarr"][0]["hostname"] != "radarr" || len(seerr["radarr"]) != 1 {
		t.Fatalf("hostname not corrected: %+v %+v", l, seerr["radarr"])
	}
}

func TestARootFolderTheAppCannotUseIsANextStep(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost:
			http.Error(w, `[{"errorMessage":"Folder '/tv/' does not exist"}]`, http.StatusBadRequest)
		case strings.HasSuffix(r.URL.Path, "/system/status"):
			w.Write([]byte(`{}`))
		default:
			w.Write([]byte(`[]`))
		}
	}))
	t.Cleanup(srv.Close)
	w := &Wirer{Apps: map[string]App{"sonarr": {ID: "sonarr", Name: "Sonarr", URL: srv.URL, ConfigDir: configDir(t, "skey")}}, Wait: time.Second}
	l := w.Apply(context.Background(), nil)[0]
	if l.State != "manual" || !strings.Contains(l.Detail, "connect the media drive") || !strings.Contains(l.Detail, "does not exist") {
		t.Fatalf("%+v", l)
	}
}

func TestHostPort(t *testing.T) {
	if h, p := hostPort("http://gluetun:8082"); h != "gluetun" || p != 8082 {
		t.Fatalf("%s %d", h, p)
	}
}
