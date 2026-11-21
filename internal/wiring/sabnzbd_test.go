package wiring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeSab serves the parts of SABnzbd's API that wiring uses (api.py's
// get_config and set_config), masking passwords as it does, and keeps its
// sabnzbd.ini in dir as SABnzbd does after each save: passwords are only
// readable there. sets counts the set_config calls.
type fakeSab struct {
	mu         sync.Mutex
	key, dir   string
	misc       map[string]any
	servers    map[string]map[string]any
	categories map[string]map[string]any
	sets       int
}

func newFakeSab(t *testing.T, key string) (*fakeSab, string) {
	t.Helper()
	s := &fakeSab{
		key: key, dir: t.TempDir(),
		// The linuxserver image's first start: its hostname whitelisted,
		// unfinished jobs in a folder nothing mounts.
		misc:       map[string]any{"username": "", "password": "", "host_whitelist": []any{"0f1e2d3c"}, "download_dir": "/incomplete-downloads", "complete_dir": "/downloads"},
		servers:    map[string]map[string]any{},
		categories: map[string]map[string]any{"*": {"name": "*", "dir": "", "pp": "3"}},
	}
	s.save()
	srv := httptest.NewServer(http.HandlerFunc(s.serve))
	t.Cleanup(srv.Close)
	return s, srv.URL
}

func (s *fakeSab) serve(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	q := r.URL.Query()
	if r.URL.Path != "/api" || q.Get("output") != "json" {
		http.NotFound(w, r)
		return
	}
	if q.Get("apikey") != s.key {
		w.Write([]byte(`{"status":false,"error":"API Key Incorrect"}`))
		return
	}
	section, keyword := q.Get("section"), q.Get("keyword")
	switch q.Get("mode") {
	case "get_config":
	case "set_config":
		s.sets++
		switch section {
		case "misc":
			if _, ok := s.misc[keyword]; !ok {
				w.Write([]byte(`{"status":false,"error":"not implemented"}`))
				return
			}
			v := any(q.Get("value"))
			if keyword == "host_whitelist" {
				var list []any
				for _, h := range strings.Split(q.Get("value"), ",") {
					list = append(list, strings.TrimSpace(h))
				}
				v = list
			}
			s.misc[keyword] = v
		case "servers", "categories":
			m := s.servers
			if section == "categories" {
				m = s.categories
			}
			cur := m[keyword]
			if cur == nil {
				cur = map[string]any{"name": keyword}
				m[keyword] = cur
			}
			for k := range q {
				if k != "mode" && k != "section" && k != "keyword" && k != "apikey" && k != "output" {
					cur[k] = q.Get(k)
				}
			}
		}
		s.save()
	default:
		w.Write([]byte(`{"status":false,"error":"not implemented"}`))
		return
	}
	mask := func(m map[string]any) map[string]any {
		out := map[string]any{}
		for k, v := range m {
			if k == "password" && v != "" {
				v = "**********"
			}
			out[k] = v
		}
		return out
	}
	list := func(m map[string]map[string]any) []any {
		names := make([]string, 0, len(m))
		for n := range m {
			names = append(names, n)
		}
		sort.Strings(names)
		var out []any
		for _, n := range names {
			out = append(out, mask(m[n]))
		}
		return out
	}
	var data any
	switch section {
	case "misc":
		data = map[string]any{"misc": mask(s.misc)}
	case "servers":
		data = map[string]any{"servers": list(s.servers)}
	case "categories":
		data = map[string]any{"categories": list(s.categories)}
	}
	json.NewEncoder(w).Encode(map[string]any{"config": data})
}

// save writes sabnzbd.ini as ConfigObj does, a password with a space
// encoded as SABnzbd's encode_password does.
func (s *fakeSab) save() {
	enc := func(pw any) string {
		p := fmt.Sprint(pw)
		if !strings.ContainsAny(p, " #") {
			return p
		}
		out := "!!!encoded!!!"
		for _, c := range p {
			out += fmt.Sprintf("%2x", c)
		}
		return out
	}
	var b strings.Builder
	fmt.Fprintf(&b, "__version__ = 19\n[misc]\napi_key = %s\nusername = %s\npassword = %s\n[servers]\n", s.key, s.misc["username"], enc(s.misc["password"]))
	for name, srv := range s.servers {
		fmt.Fprintf(&b, "[[%s]]\nname = %s\npassword = %s\n", name, name, enc(srv["password"]))
	}
	b.WriteString("[categories]\n[[*]]\nname = *\n")
	_ = os.WriteFile(filepath.Join(s.dir, "sabnzbd.ini"), []byte(b.String()), 0o600)
}

func sabLinks(links []Link) map[string]Link {
	out := map[string]Link{}
	for _, l := range links {
		if strings.Contains(l.Text, "SABnzbd") {
			out[l.Text] = l
		}
	}
	return out
}

// TestSabnzbd (arr item 2d): SABnzbd, inside Gluetun's network, gets the
// homelab's login, its folders and the apps' categories, the Usenet server
// in .env, and becomes Sonarr's and Radarr's Usenet download client at
// gluetun:8080. A second run changes nothing.
func TestSabnzbd(t *testing.T) {
	sab, sabURL := newFakeSab(t, "sabkey")
	sonarrURL, sonarr := fakeArr(t, "skey", map[string][]resource{
		"downloadclient": {template("Sabnzbd", "host", "port", "useSsl", "urlBase", "apiKey", "username", "password", "tvCategory")},
	})
	radarrURL, radarr := fakeArr(t, "rkey", map[string][]resource{
		"downloadclient": {template("Sabnzbd", "host", "port", "useSsl", "urlBase", "apiKey", "username", "password", "movieCategory")},
	})
	w := &Wirer{
		Apps: map[string]App{
			"sabnzbd": {ID: "sabnzbd", Name: "SABnzbd", URL: sabURL, Internal: "http://gluetun:8080", ConfigDir: sab.dir},
			"sonarr":  {ID: "sonarr", Name: "Sonarr", URL: sonarrURL, Internal: "http://sonarr:8989", ConfigDir: configDir(t, "skey")},
			"radarr":  {ID: "radarr", Name: "Radarr", URL: radarrURL, Internal: "http://radarr:7878", ConfigDir: configDir(t, "rkey")},
		},
		Env:  map[string]string{"ARR_PASSWORD": "two words", "USENET_HOST": "News.Example.NET", "USENET_USER": "me", "USENET_PASSWORD": "secret pw"},
		Wait: time.Second,
	}
	w.Env["ARR_PASSWORD"] = "" // the login's step is checked below, on its own
	links := sabLinks(w.Apply(context.Background(), nil))
	for _, text := range []string{
		"SABnzbd keeps downloads in /downloads, by app",
		"SABnzbd downloads from your Usenet server",
		"SABnzbd is the download client for Sonarr",
		"SABnzbd is the download client for Radarr",
	} {
		if links[text].State != "done" {
			t.Errorf("first run, %s: %+v", text, links[text])
		}
	}
	if _, ok := links["SABnzbd signs in with the login in Sign-in details"]; ok {
		t.Error("no ARR_PASSWORD: SABnzbd keeps the login made in it")
	}

	// Its folders: unfinished jobs inside the downloads folder, where the
	// inbox skips them, and each app's finished ones in its own, as
	// qBittorrent's are.
	if sab.misc["download_dir"] != "/downloads/incomplete/usenet" || sab.misc["complete_dir"] != "/downloads" {
		t.Errorf("folders: %v", sab.misc)
	}
	if got := fmt.Sprint(sab.misc["host_whitelist"]); got != "[0f1e2d3c gluetun]" {
		t.Errorf("host_whitelist %s, want its own name kept and gluetun added", got)
	}
	for name, dir := range map[string]string{"tv": "tv", "movies": "movies", "music": "music"} {
		if c := sab.categories[name]; c == nil || c["dir"] != dir {
			t.Errorf("category %s: %v", name, c)
		}
	}
	// The server, named after its host as SABnzbd's own page names it, with
	// SSL on and the provider's usual SSL port.
	srv := sab.servers["news.example.net"]
	if srv == nil || srv["host"] != "news.example.net" || srv["port"] != "563" || srv["ssl"] != "1" || srv["username"] != "me" || srv["password"] != "secret pw" || srv["connections"] != "8" || srv["enable"] != "1" {
		t.Errorf("server: %v (all: %v)", srv, sab.servers)
	}
	dc := sonarr["downloadclient"]
	if len(dc) != 1 || dc[0]["name"] != "SABnzbd" || field(dc[0], "host") != "gluetun" || field(dc[0], "port") != float64(8080) || field(dc[0], "apiKey") != "sabkey" || field(dc[0], "tvCategory") != "tv" {
		t.Errorf("Sonarr's download client: %+v", dc)
	}
	if dc := radarr["downloadclient"]; len(dc) != 1 || field(dc[0], "movieCategory") != "movies" {
		t.Errorf("Radarr's download client: %+v", dc)
	}

	// The login: set once, then found in sabnzbd.ini (its API masks it).
	w.Env["ARR_PASSWORD"] = "two words"
	login := "SABnzbd signs in with the login in Sign-in details"
	if l := sabLinks(w.Apply(context.Background(), nil))[login]; l.State != "done" {
		t.Errorf("login: %+v", l)
	}
	if sab.misc["username"] != "admin" || sab.misc["password"] != "two words" {
		t.Errorf("login in SABnzbd: %v", sab.misc)
	}

	sets := sab.sets
	for text, l := range sabLinks(w.Apply(context.Background(), nil)) {
		if l.State != "already" {
			t.Errorf("second run, %s: %+v", text, l)
		}
	}
	if sab.sets != sets {
		t.Errorf("a second run changed SABnzbd %d time(s)", sab.sets-sets)
	}

	// A password changed in .env is set again.
	w.Env["USENET_PASSWORD"] = "new one"
	w.Env["ARR_PASSWORD"] = "other"
	got := sabLinks(w.Apply(context.Background(), nil))
	if got["SABnzbd downloads from your Usenet server"].State != "done" || sab.servers["news.example.net"]["password"] != "new one" {
		t.Errorf("new Usenet password: %+v %v", got, sab.servers)
	}
	if got[login].State != "done" || sab.misc["password"] != "other" {
		t.Errorf("new login: %+v %v", got[login], sab.misc)
	}
}

// With no Usenet server in Settings, SABnzbd is still set up, and says
// what to fill in.
func TestSabnzbdWithNoServer(t *testing.T) {
	sab, sabURL := newFakeSab(t, "sabkey")
	w := &Wirer{
		Apps: map[string]App{"sabnzbd": {ID: "sabnzbd", Name: "SABnzbd", URL: sabURL, Internal: "http://gluetun:8080", ConfigDir: sab.dir}},
		Env:  map[string]string{},
		Wait: time.Second,
	}
	links := sabLinks(w.Apply(context.Background(), nil))
	l := links["SABnzbd downloads from your Usenet server"]
	if l.State != "manual" || !strings.Contains(l.Detail, "USENET_HOST") {
		t.Errorf("no server: %+v", l)
	}
	if links["SABnzbd keeps downloads in /downloads, by app"].State != "done" || len(sab.servers) != 0 {
		t.Errorf("%+v %v", links, sab.servers)
	}
}
