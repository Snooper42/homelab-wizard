// Package wiring connects apps to each other once they run, through their
// own APIs: Prowlarr syncs indexers to Sonarr, Radarr, and Lidarr and uses
// FlareSolverr, and those apps use qBittorrent as their download client.
// Links that need a person to sign in (Seerr with Jellyfin, Bazarr) come
// back as next steps. Running it again only adds what is missing.
package wiring

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ports"
)

// Link is one connection between apps.
type Link struct {
	Text   string `json:"text"`
	State  string `json:"state"` // planned, done, already, manual, or failed
	Detail string `json:"detail,omitempty"`
}

// App is a running app as wiring sees it.
type App struct {
	ID, Name  string
	URL       string // from this machine, e.g. http://localhost:8989
	Internal  string // from other containers, e.g. http://sonarr:8989
	ConfigDir string // the folder mounted at /config
}

// Wirer connects the running apps.
type Wirer struct {
	Apps map[string]App
	Env  map[string]string
	HTTP *http.Client
	Wait time.Duration // how long to wait for an app's API to answer

	// One Apply waits for each app once: its key, or why it never answered.
	keys    map[string]string
	notUp   map[string]error
	retryIn time.Duration // pause between attempts to save; 5s unless a test sets it
}

// Wireable are the apps wiring connects (or explains how to connect).
var Wireable = []string{"prowlarr", "sonarr", "radarr", "lidarr", "bazarr", "seerr", "qbittorrent", "flaresolverr"}

// New is a Wirer for the catalog apps running among containers.
func New(c *catalog.Catalog, containers []docker.Container, env map[string]string, home string) *Wirer {
	report := detect.Analyze(c, containers)
	running := func(id string) bool { st, _ := report.State(id); return st == detect.Running }
	return &Wirer{Apps: AppsFrom(c, running, env, home), Env: env, Wait: 3 * time.Minute}
}

// apiVersion is the API path of each *arr app.
var apiVersion = map[string]string{"sonarr": "v3", "radarr": "v3", "lidarr": "v1", "prowlarr": "v1"}

// clients are the apps Prowlarr and qBittorrent serve, with the Prowlarr
// application type for each.
var clients = []struct{ id, impl string }{{"sonarr", "Sonarr"}, {"radarr", "Radarr"}, {"lidarr", "Lidarr"}}

// AppsFrom describes the catalog apps for which running reports true.
func AppsFrom(c *catalog.Catalog, running func(id string) bool, env map[string]string, home string) map[string]App {
	lookup := compose.MapLookup(env)
	out := map[string]App{}
	for _, a := range c.Apps {
		if !running(a.ID) {
			continue
		}
		app := App{ID: a.ID, Name: a.Name(), URL: ports.WebURL(a, ports.AppBindings(a, lookup), lookup)}
		host := a.ID
		if strings.HasPrefix(a.NetworkMode, "service:") {
			host = strings.TrimPrefix(a.NetworkMode, "service:")
		}
		if p := a.WebContainerPort(lookup); p > 0 {
			app.Internal = "http://" + host + ":" + strconv.Itoa(p)
		}
		for _, v := range a.Volumes {
			if r, err := v.Resolve(lookup, a.File.Dir, home); err == nil && r.Bind && v.Target == "/config" {
				app.ConfigDir = r.Source
			}
		}
		out[a.ID] = app
	}
	return out
}

func (w *Wirer) has(ids ...string) bool {
	for _, id := range ids {
		if _, ok := w.Apps[id]; !ok {
			return false
		}
	}
	return true
}

func (w *Wirer) name(id string) string { return w.Apps[id].Name }

// step is one link and the work that makes it.
type step struct {
	text string
	do   func(context.Context) (state, detail string, err error)
}

func (w *Wirer) steps() []step {
	var out []step
	for _, c := range clients {
		c := c
		if w.has("prowlarr", c.id) {
			out = append(out, step{"Prowlarr sends indexers to " + w.name(c.id), func(ctx context.Context) (string, string, error) {
				return w.prowlarrApp(ctx, c.id, c.impl)
			}})
		}
	}
	if w.has("prowlarr", "flaresolverr") {
		out = append(out, step{"FlareSolverr is set up in Prowlarr", w.flareSolverr})
	}
	for _, c := range clients {
		c := c
		if w.has("qbittorrent", c.id) {
			out = append(out, step{"qBittorrent is the download client for " + w.name(c.id), func(ctx context.Context) (string, string, error) {
				return w.downloadClient(ctx, c.id)
			}})
		}
	}
	if w.has("seerr") {
		out = append(out, step{"Seerr is linked to Jellyfin, Sonarr, and Radarr", func(context.Context) (string, string, error) {
			return "manual", "open Seerr, sign in with your Jellyfin account, then add Sonarr and Radarr under Settings > Services", nil
		}})
	}
	if w.has("bazarr") {
		out = append(out, step{"Bazarr fetches subtitles for Sonarr and Radarr", func(context.Context) (string, string, error) {
			return "manual", "in Bazarr, turn on Sonarr and Radarr under Settings with hosts sonarr and radarr and their API keys", nil
		}})
	}
	return out
}

// Plan lists the links for the running apps without changing anything.
func (w *Wirer) Plan() []Link {
	links := []Link{}
	for _, s := range w.steps() {
		links = append(links, Link{Text: s.text, State: "planned"})
	}
	return links
}

// Apply makes each link, reporting each one as it finishes.
func (w *Wirer) Apply(ctx context.Context, progress func(Link)) []Link {
	w.keys, w.notUp = map[string]string{}, map[string]error{}
	links := []Link{}
	for _, s := range w.steps() {
		state, detail, err := s.do(ctx)
		if err != nil {
			state, detail = "failed", err.Error()
		}
		l := Link{Text: s.text, State: state, Detail: detail}
		if progress != nil {
			progress(l)
		}
		links = append(links, l)
	}
	return links
}

var apiKeyRe = regexp.MustCompile(`<ApiKey>([^<]+)</ApiKey>`)

// apiKey reads an *arr app's key from its config.xml.
func (w *Wirer) apiKey(id string) string {
	data, err := os.ReadFile(filepath.Join(w.Apps[id].ConfigDir, "config.xml"))
	if err != nil {
		return ""
	}
	if m := apiKeyRe.FindSubmatch(data); m != nil {
		return string(m[1])
	}
	return ""
}

// ready waits until an *arr app has written its key and its API answers.
// The answer is kept for the rest of the run, so an app that is down costs
// one wait, not one per link.
func (w *Wirer) ready(ctx context.Context, id string) (string, error) {
	if key, ok := w.keys[id]; ok {
		return key, nil
	}
	if err, ok := w.notUp[id]; ok {
		return "", err
	}
	deadline := time.Now().Add(w.Wait)
	last := fmt.Errorf("no API key in %s yet", filepath.Join(w.Apps[id].ConfigDir, "config.xml"))
	for {
		if key := w.apiKey(id); key != "" {
			err := w.call(ctx, id, key, http.MethodGet, "system/status", nil, nil)
			if err == nil {
				if w.keys != nil {
					w.keys[id] = key
				}
				return key, nil
			}
			last = err
		}
		left := time.Until(deadline)
		if left <= 0 {
			err := fmt.Errorf("%s did not answer within %s (%v)", w.name(id), w.Wait, last)
			if w.notUp != nil {
				w.notUp[id] = err
			}
			return "", err
		}
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(min(left, 2*time.Second)):
		}
	}
}

// call sends one API request to an *arr app and decodes the reply into out.
func (w *Wirer) call(ctx context.Context, id, key, method, path string, body, out any) error {
	var r io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		r = bytes.NewReader(data)
	}
	url := strings.TrimRight(w.Apps[id].URL, "/") + "/api/" + apiVersion[id] + "/" + path
	req, err := http.NewRequestWithContext(ctx, method, url, r)
	if err != nil {
		return err
	}
	req.Header.Set("X-Api-Key", key)
	req.Header.Set("Content-Type", "application/json")
	client := w.HTTP
	if client == nil {
		// Saving a FlareSolverr proxy makes Prowlarr test it through a
		// headless browser, which takes up to a minute.
		client = &http.Client{Timeout: 2 * time.Minute}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode/100 != 2 {
		msg := strings.TrimSpace(string(data))
		if len(msg) > 200 {
			msg = msg[:200] + "…"
		}
		return fmt.Errorf("%s %s: %s %s", w.name(id), path, resp.Status, msg)
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}

type resource = map[string]any

// fromSchema returns the app's template for an implementation, with the
// given fields set.
func (w *Wirer) fromSchema(ctx context.Context, id, key, kind, impl string, fields map[string]any) (resource, error) {
	var schema []resource
	if err := w.call(ctx, id, key, http.MethodGet, kind+"/schema", nil, &schema); err != nil {
		return nil, err
	}
	for _, r := range schema {
		if r["implementation"] != impl {
			continue
		}
		list, _ := r["fields"].([]any)
		for name, v := range fields {
			found := false
			for _, f := range list {
				if m, ok := f.(map[string]any); ok && m["name"] == name {
					m["value"], found = v, true
				}
			}
			if !found {
				return nil, fmt.Errorf("%s's %s template has no %s field", w.name(id), impl, name)
			}
		}
		return r, nil
	}
	return nil, fmt.Errorf("%s has no %s %s", w.name(id), impl, kind)
}

// existing returns the app's resource of kind with the given
// implementation, if it has one.
func (w *Wirer) existing(ctx context.Context, id, key, kind, impl string) (resource, error) {
	var list []resource
	if err := w.call(ctx, id, key, http.MethodGet, kind, nil, &list); err != nil {
		return nil, err
	}
	for _, r := range list {
		if r["implementation"] == impl {
			return r, nil
		}
	}
	return nil, nil
}

// ensure makes sure the app has a resource of kind for impl whose fields
// match want: it creates one from the template (create), or, when one exists
// with other values (an address typed by hand, an earlier setup), corrects
// those fields. Saving makes the app test the connection, which fails while
// the other app is still starting, so a refused save is retried for two
// minutes, checking first that it did not go through.
func (w *Wirer) ensure(ctx context.Context, id, key, kind, impl string, want map[string]any, create func() (resource, error)) (string, string, error) {
	cur, err := w.existing(ctx, id, key, kind, impl)
	if err != nil {
		return "", "", err
	}
	var body resource
	method, path, state, detail := http.MethodPost, kind, "done", ""
	if cur != nil {
		var wrong []string
		for name, v := range want {
			if fmt.Sprint(fieldValue(cur, name)) != fmt.Sprint(v) {
				wrong = append(wrong, name)
				setField(cur, name, v)
			}
		}
		if len(wrong) == 0 {
			return "already", "", nil
		}
		sort.Strings(wrong)
		body, method, path = cur, http.MethodPut, fmt.Sprintf("%s/%v", kind, cur["id"])
		detail = "corrected " + strings.Join(wrong, ", ")
	} else if body, err = create(); err != nil {
		return "", "", err
	}
	retry := w.retryIn
	if retry == 0 {
		retry = 5 * time.Second
	}
	deadline := time.Now().Add(2 * time.Minute)
	for {
		err = w.call(ctx, id, key, method, path, body, nil)
		if err == nil {
			return state, detail, nil
		}
		if method == http.MethodPost {
			if r, _ := w.existing(ctx, id, key, kind, impl); r != nil {
				return state, detail, nil // saved after all (the reply timed out)
			}
		}
		if time.Now().After(deadline) {
			return "", "", err
		}
		select {
		case <-ctx.Done():
			return "", "", ctx.Err()
		case <-time.After(retry):
		}
	}
}

func fieldValue(r resource, name string) any {
	list, _ := r["fields"].([]any)
	for _, f := range list {
		if m, ok := f.(map[string]any); ok && m["name"] == name {
			return m["value"]
		}
	}
	return nil
}

func setField(r resource, name string, v any) {
	list, _ := r["fields"].([]any)
	for _, f := range list {
		if m, ok := f.(map[string]any); ok && m["name"] == name {
			m["value"] = v
		}
	}
}

func (w *Wirer) prowlarrApp(ctx context.Context, client, impl string) (string, string, error) {
	pkey, err := w.ready(ctx, "prowlarr")
	if err != nil {
		return "", "", err
	}
	ckey, err := w.ready(ctx, client)
	if err != nil {
		return "", "", err
	}
	addresses := map[string]any{"prowlarrUrl": w.Apps["prowlarr"].Internal, "baseUrl": w.Apps[client].Internal}
	return w.ensure(ctx, "prowlarr", pkey, "applications", impl, addresses, func() (resource, error) {
		r, err := w.fromSchema(ctx, "prowlarr", pkey, "applications", impl, map[string]any{
			"prowlarrUrl": addresses["prowlarrUrl"], "baseUrl": addresses["baseUrl"], "apiKey": ckey,
		})
		if err == nil {
			r["name"], r["syncLevel"] = w.name(client), "fullSync"
		}
		return r, err
	})
}

func (w *Wirer) flareSolverr(ctx context.Context) (string, string, error) {
	key, err := w.ready(ctx, "prowlarr")
	if err != nil {
		return "", "", err
	}
	const tip = "add the flaresolverr tag to indexers behind Cloudflare"
	host := map[string]any{"host": "http://flaresolverr:8191/"}
	state, detail, err := w.ensure(ctx, "prowlarr", key, "indexerProxy", "FlareSolverr", host, func() (resource, error) {
		var tag struct {
			ID int `json:"id"`
		}
		if err := w.call(ctx, "prowlarr", key, http.MethodPost, "tag", map[string]any{"label": "flaresolverr"}, &tag); err != nil {
			return nil, err
		}
		r, err := w.fromSchema(ctx, "prowlarr", key, "indexerProxy", "FlareSolverr", host)
		if err == nil {
			r["name"], r["tags"] = "FlareSolverr", []int{tag.ID}
		}
		return r, err
	})
	if detail == "" {
		detail = tip
	}
	return state, detail, err
}

func (w *Wirer) downloadClient(ctx context.Context, client string) (string, string, error) {
	key, err := w.ready(ctx, client)
	if err != nil {
		return "", "", err
	}
	host, port := "qbittorrent", 8082
	if u := w.Apps["qbittorrent"].Internal; u != "" {
		hp := strings.TrimPrefix(u, "http://")
		if i := strings.LastIndex(hp, ":"); i > 0 {
			host = hp[:i]
			port, _ = strconv.Atoi(hp[i+1:])
		}
	}
	address := map[string]any{"host": host, "port": port}
	if cur, err := w.existing(ctx, client, key, "downloadclient", "QBittorrent"); err != nil || cur != nil {
		if err != nil {
			return "", "", err
		}
		return w.ensure(ctx, client, key, "downloadclient", "QBittorrent", address, nil)
	}
	password := w.Env["QBITTORRENT_PASSWORD"]
	if password == "" {
		return "manual", "in qBittorrent set a permanent Web UI password (Tools > Options > Web UI; the temporary one in its log changes on every restart), put it in QBITTORRENT_PASSWORD (and QBITTORRENT_USER if it is not admin), then connect again", nil
	}
	user := w.Env["QBITTORRENT_USER"]
	if user == "" {
		user = "admin"
	}
	return w.ensure(ctx, client, key, "downloadclient", "QBittorrent", address, func() (resource, error) {
		r, err := w.fromSchema(ctx, client, key, "downloadclient", "QBittorrent", map[string]any{
			"host": host, "port": port, "username": user, "password": password,
		})
		if err == nil {
			r["name"], r["enable"] = "qBittorrent", true
			// Each app's downloads in their own folder, /downloads/<category>.
			if f, ok := categoryField[client]; ok {
				setField(r, f.name, f.value)
			}
		}
		return r, err
	})
}

// categoryField is the qBittorrent category each app files its downloads
// under, by the name of the field in its download-client template.
var categoryField = map[string]struct{ name, value string }{
	"sonarr": {"tvCategory", "tv"},
	"radarr": {"movieCategory", "movies"},
	"lidarr": {"musicCategory", "music"},
}
