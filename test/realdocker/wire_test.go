//go:build realdocker

package realdocker

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

// TestTheMediaAppsConnect is `homelab wire` against the real Prowlarr,
// Sonarr, Radarr, Lidarr, and FlareSolverr (ISSUE-0015), on a homelab of
// its own: Prowlarr gets each of the three as an application and
// FlareSolverr as its indexer proxy, which Prowlarr's own API then lists,
// and a second run finds every link already made. qBittorrent waits for
// Gluetun's VPN key, and Seerr and Bazarr are linked by hand, so they are
// not in it. REALDOCKER_WIRE=1 runs it (the nightly workflow's wire job).
func TestTheMediaAppsConnect(t *testing.T) {
	if os.Getenv("REALDOCKER_WIRE") == "" {
		t.Skip("REALDOCKER_WIRE is not set")
	}
	l := newLab(t)
	t.Cleanup(func() {
		if t.Failed() {
			l.keepReport()
		}
		_, _ = l.try("uninstall", "--data", "--apply")
	})
	ids := []string{"prowlarr", "sonarr", "radarr", "lidarr", "flaresolverr"}
	l.run(append([]string{"install"}, append(ids, "--apply")...)...)
	for _, key := range []string{"MEDIA_ROOT", "DOWNLOADS_ROOT"} {
		if dir := l.env(key); dir != "" {
			_ = os.MkdirAll(dir, 0o755)
		}
	}
	var as []realApp
	for _, id := range ids {
		as = append(as, realApp{id: id, page: "/"})
	}
	l.up(as)

	links := wireLinks(t, l.run("--json", "wire", "--apply"))
	want := []string{"Prowlarr sends indexers to Sonarr", "Prowlarr sends indexers to Radarr", "Prowlarr sends indexers to Lidarr", "FlareSolverr is set up in Prowlarr"}
	for _, w := range want {
		if s := links[w]; s != "done" {
			t.Errorf("%s: %q, want done (%v)", w, s, links)
		}
	}

	// What Prowlarr itself now holds.
	cfg, err := os.ReadFile(filepath.Join(l.root, "data", "appdata", "prowlarr", "config.xml"))
	if err != nil {
		t.Fatal(err)
	}
	m := regexp.MustCompile(`<ApiKey>([^<]+)</ApiKey>`).FindSubmatch(cfg)
	if m == nil {
		t.Fatal("no API key in Prowlarr's config.xml")
	}
	api := func(path string, out any) {
		t.Helper()
		if err := request(http.MethodGet, l.url("prowlarr")+"/api/v1/"+path, nil, out, "X-Api-Key", string(m[1])); err != nil {
			t.Fatal(err)
		}
	}
	var apps []prowlarrThing
	api("applications", &apps)
	for _, impl := range []string{"Sonarr", "Radarr", "Lidarr"} {
		i := slices.IndexFunc(apps, func(a prowlarrThing) bool { return a.Implementation == impl })
		if i < 0 {
			t.Errorf("Prowlarr has no %s application: %+v", impl, apps)
			continue
		}
		if base := apps[i].field("baseUrl"); !strings.HasPrefix(base, "http://"+strings.ToLower(impl)+":") {
			t.Errorf("Prowlarr reaches %s at %q, want http://%s:…", impl, base, strings.ToLower(impl))
		}
	}
	var proxies []prowlarrThing
	api("indexerproxy", &proxies)
	if !slices.ContainsFunc(proxies, func(p prowlarrThing) bool {
		return p.Implementation == "FlareSolverr" && strings.Contains(p.field("host"), "flaresolverr:8191")
	}) {
		t.Errorf("Prowlarr has no FlareSolverr proxy at flaresolverr:8191: %+v", proxies)
	}

	// Run again: nothing new to make.
	again := wireLinks(t, l.run("--json", "wire", "--apply"))
	for _, w := range want {
		if s := again[w]; s != "already" {
			t.Errorf("the second run: %s %q, want already", w, s)
		}
	}
	t.Logf("wire made %d links in Prowlarr, which lists them; the second run found each already made", len(want))
}

// prowlarrThing is an application or indexer proxy as Prowlarr's API
// lists it: its kind and its settings.
type prowlarrThing struct {
	Implementation string `json:"implementation"`
	Fields         []struct {
		Name  string `json:"name"`
		Value any    `json:"value"`
	} `json:"fields"`
}

// field is one of its settings, as text.
func (p prowlarrThing) field(name string) string {
	for _, f := range p.Fields {
		if f.Name == name {
			return fmt.Sprint(f.Value)
		}
	}
	return ""
}

// wireLinks are the links `homelab --json wire` reported, by their text.
func wireLinks(t *testing.T, out string) map[string]string {
	t.Helper()
	links := map[string]string{}
	for _, line := range strings.Split(out, "\n") {
		var ev struct {
			Type string `json:"type"`
			Data struct {
				Text  string `json:"text"`
				State string `json:"state"`
			} `json:"data"`
		}
		if json.Unmarshal([]byte(line), &ev) == nil && ev.Type == "link" {
			links[ev.Data.Text] = ev.Data.State
		}
	}
	return links
}
