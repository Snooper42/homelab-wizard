package wiring

import (
	"context"
	"encoding/json"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeSeerrSetup is a Seerr before its first sign-in: /auth/jellyfin takes
// a Jellyfin administrator once (alex, pw), library sync finds a film, a
// show and a music library, and /settings/initialize marks it set up in
// settings.json, as Seerr does. Its Sonarr and Radarr settings come after.
type fakeSeerrState struct {
	mu        sync.Mutex
	signIns   []map[string]any
	enabled   map[string]bool
	initCalls int
	saved     map[string][]resource
}

func fakeSeerrSetup(t *testing.T, key, dir string, admin bool) (string, *fakeSeerrState) {
	t.Helper()
	st := &fakeSeerrState{enabled: map[string]bool{}, saved: map[string][]resource{"sonarr": {}, "radarr": {}}}
	libs := []map[string]any{{"id": "m1", "name": "Films", "type": "movie"}, {"id": "s1", "name": "Shows", "type": "show"}, {"id": "u1", "name": "Music", "type": "music"}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		st.mu.Lock()
		defer st.mu.Unlock()
		p := r.URL.Path
		if p == "/api/v1/auth/jellyfin" && r.Method == http.MethodPost {
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			st.signIns = append(st.signIns, body)
			switch {
			case body["username"] != "alex" || body["password"] != "pw":
				http.Error(w, `{"message":"INVALID_CREDENTIALS"}`, http.StatusUnauthorized)
			case !admin:
				http.Error(w, `{"message":"NOT_ADMIN"}`, http.StatusForbidden)
			default:
				w.Write([]byte(`{"id":1}`))
			}
			return
		}
		if r.Header.Get("X-Api-Key") != key {
			http.Error(w, `{"message":"You do not have permission"}`, http.StatusForbidden)
			return
		}
		switch {
		case p == "/api/v1/settings/jellyfin/library/sync":
			out := []map[string]any{}
			for _, l := range libs {
				l := map[string]any{"id": l["id"], "name": l["name"], "type": l["type"], "enabled": st.enabled[l["id"].(string)]}
				out = append(out, l)
			}
			json.NewEncoder(w).Encode(out)
		case strings.HasPrefix(p, "/api/v1/settings/jellyfin/library/") && r.Method == http.MethodPut:
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			st.enabled[strings.TrimPrefix(p, "/api/v1/settings/jellyfin/library/")] = body["enabled"] == true
			w.Write([]byte(`{}`))
		case p == "/api/v1/settings/initialize" && r.Method == http.MethodPost:
			st.initCalls++
			data, _ := json.Marshal(map[string]any{"main": map[string]any{"apiKey": key}, "public": map[string]any{"initialized": true}})
			os.WriteFile(filepath.Join(dir, "settings.json"), data, 0o644)
			w.Write([]byte(`{"initialized":true}`))
		case p == "/api/v1/settings/sonarr" || p == "/api/v1/settings/radarr":
			kind := strings.TrimPrefix(p, "/api/v1/settings/")
			if r.Method == http.MethodPost {
				var body resource
				json.NewDecoder(r.Body).Decode(&body)
				st.saved[kind] = append(st.saved[kind], body)
				return
			}
			json.NewEncoder(w).Encode(st.saved[kind])
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL, st
}

func TestSeerrSignsInToJellyfin(t *testing.T) {
	sonarrURL, sonarr := fakeArr(t, "skey", nil)
	sonarr["qualityprofile"] = []resource{{"id": float64(4), "name": "HD-1080p"}}
	dir := seerrDir(t, "jkey", false)
	seerrURL, st := fakeSeerrSetup(t, "jkey", dir, true)
	apps := map[string]App{
		"sonarr": {ID: "sonarr", Name: "Sonarr", URL: sonarrURL, Internal: "http://sonarr:8989", ConfigDir: configDir(t, "skey")},
		"seerr":  {ID: "seerr", Name: "Seerr", URL: seerrURL, ConfigDir: dir},
	}
	w := &Wirer{Apps: apps, Env: map[string]string{"JELLYFIN_PORT": "8097"}, Wait: time.Second, JellyfinAdmin: &JellyfinAdmin{User: "alex", Password: "pw"}}
	links := w.Apply(context.Background(), nil)
	// The sign-in comes before Seerr's links, so they're made in the same run.
	order := map[string]int{}
	for i, l := range links {
		order[l.Text] = i
		if strings.Contains(l.Detail, "pw") || strings.Contains(l.Text, "pw") {
			t.Fatalf("a link shows the password: %+v", l)
		}
	}
	got := linkStates(links)
	l := got["Seerr signs in to Jellyfin"]
	if l.State != "done" || l.Detail != "as alex; Seerr sees Films and Shows" {
		t.Fatalf("sign-in: %+v", l)
	}
	if order["Seerr signs in to Jellyfin"] > order["Seerr sends requests to Sonarr"] {
		t.Fatalf("the sign-in comes after Seerr's links: %v", order)
	}
	if s := got["Seerr sends requests to Sonarr"]; s.State != "done" {
		t.Fatalf("Seerr's link to Sonarr in the same run: %+v", s)
	}
	b := st.signIns[0]
	if b["hostname"] != "host.docker.internal" || b["port"] != float64(8097) || b["serverType"] != float64(2) || b["useSsl"] != false || b["urlBase"] != "" {
		t.Fatalf("sign-in body: %+v", b)
	}
	if !st.enabled["m1"] || !st.enabled["s1"] || st.enabled["u1"] || st.initCalls != 1 {
		t.Fatalf("libraries %v, initialize called %d times", st.enabled, st.initCalls)
	}
	if w.JellyfinAdmin != nil {
		t.Fatal("the password is kept after the sign-in")
	}

	// A second run, even with the password again, changes nothing.
	w.JellyfinAdmin = &JellyfinAdmin{User: "alex", Password: "pw"}
	got = linkStates(w.Apply(context.Background(), nil))
	if l := got["Seerr signs in to Jellyfin"]; l.State != "already" || len(st.signIns) != 1 || st.initCalls != 1 {
		t.Fatalf("second run: %+v, %d sign-ins", l, len(st.signIns))
	}
}

func TestSeerrSignInFallsBackToAPerson(t *testing.T) {
	for _, c := range []struct {
		name  string
		admin *JellyfinAdmin
		isAdm bool
		want  string
	}{
		{"no password given", nil, true, "a Jellyfin administrator"},
		{"wrong password", &JellyfinAdmin{User: "alex", Password: "nope"}, true, "Jellyfin didn't accept that name and password"},
		{"not an administrator", &JellyfinAdmin{User: "alex", Password: "pw"}, false, "alex isn't a Jellyfin administrator"},
	} {
		t.Run(c.name, func(t *testing.T) {
			dir := seerrDir(t, "jkey", false)
			seerrURL, st := fakeSeerrSetup(t, "jkey", dir, c.isAdm)
			w := &Wirer{Apps: map[string]App{"seerr": {ID: "seerr", Name: "Seerr", URL: seerrURL, ConfigDir: dir}}, Wait: time.Second, JellyfinAdmin: c.admin}
			l := linkStates(w.Apply(context.Background(), nil))["Seerr signs in to Jellyfin"]
			if l.State != "manual" || !strings.Contains(l.Detail, c.want) || !strings.Contains(l.Detail, "open Seerr and sign in with Jellyfin") {
				t.Fatalf("%+v", l)
			}
			if strings.Contains(l.Detail, "nope") || st.initCalls != 0 {
				t.Fatalf("detail %q, initialize %d", l.Detail, st.initCalls)
			}
			// The screen and the terminal can ask for the name and password
			// (again) from here; the detail names no command-line flag.
			if l.Fix != FixSeerrSignIn || strings.Contains(l.Detail, "--jellyfin-user") {
				t.Fatalf("fix %q, detail %q", l.Fix, l.Detail)
			}
		})
	}
}

// Searching through the VPN: Prowlarr lives in Gluetun's network, so the
// other apps reach it at gluetun:9696 (Prowlarr's own address in its links
// to Sonarr, Radarr and Lidarr follows, corrected by ensure on the next run).
func TestProwlarrThroughTheVPN(t *testing.T) {
	c, err := catalog.Load(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	running := func(id string) bool { return id == "prowlarr" || id == "gluetun" }
	for key, want := range map[string]string{"": "http://prowlarr:9696", "k": "http://gluetun:9696"} {
		apps := AppsFrom(c, running, map[string]string{"PROTONVPN_WIREGUARD_PRIVATE_KEY": key}, t.TempDir())
		if got := apps["prowlarr"].Internal; got != want {
			t.Errorf("key %q: prowlarr at %s, want %s", key, got, want)
		}
	}
}

// qBittorrent (and Prowlarr, searching through the VPN) live in Gluetun's
// network, so their page is published on Gluetun's ports: wire reaches
// qBittorrent's Web API there, not at no address.
func TestAppInGluetunsNetworkHasItsAddress(t *testing.T) {
	c, err := catalog.Load(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	running := func(id string) bool { return id == "qbittorrent" || id == "gluetun" }
	env := map[string]string{"PROTONVPN_WIREGUARD_PRIVATE_KEY": "k", "QBITTORRENT_PORT": "8182"}
	if got := AppsFrom(c, running, env, t.TempDir())["qbittorrent"].URL; got != "http://localhost:8182" {
		t.Errorf("qBittorrent at %q, want http://localhost:8182", got)
	}
}
