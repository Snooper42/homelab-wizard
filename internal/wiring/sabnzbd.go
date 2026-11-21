package wiring

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
)

// SABnzbd (arr-loop item 2d, the owner, Nov 20): Usenet, tried before
// torrents, so a release nobody shares doesn't hold a request up. It runs
// inside Gluetun's network like qBittorrent ("just to be extra secure"),
// and the apps reach it at gluetun:8080. Everything here goes through its
// API (sabnzbd/api.py: get_config and set_config), with the key it keeps in
// sabnzbd.ini. Its API masks passwords, so whether one is already set is
// read from sabnzbd.ini, which this computer can read.

const sabKeyFile = "sabnzbd.ini"

// sabFolders: unfinished jobs inside the downloads folder (the image's own
// /incomplete-downloads is mounted nowhere, so a restart would lose them),
// under incomplete/, which Tidy Up's inbox skips; each app's finished jobs
// in its own folder, as qBittorrent's are (categoryField's names).
var sabFolders = map[string]string{
	"download_dir": "/downloads/incomplete/usenet",
	"complete_dir": "/downloads",
}

var sabCategories = []string{"tv", "movies", "music"}

const sabServerHelp = "put your Usenet server's details in Settings (USENET_HOST, USENET_USER, USENET_PASSWORD, and USENET_PORT and USENET_CONNECTIONS if your plan says other than 563 and 8), from the welcome email or account page of the Usenet service you pay for, then connect again"

// sabReady waits until SABnzbd has written its key and its API answers;
// the answer is kept for the run, as ready does for the *arr apps.
func (w *Wirer) sabReady(ctx context.Context) (string, error) {
	const id = "sabnzbd"
	if key, ok := w.keys[id]; ok {
		return key, nil
	}
	if err, ok := w.notUp[id]; ok {
		return "", err
	}
	deadline := time.Now().Add(w.Wait)
	var last error
	for {
		key, err := KeptKey(w.Apps[id].ConfigDir, sabKeyFile)
		if err == nil {
			if _, err = w.sabConfig(ctx, key, "misc"); err == nil {
				if w.keys != nil {
					w.keys[id] = key
				}
				return key, nil
			}
		}
		last = err
		left := time.Until(deadline)
		if left <= 0 {
			err := fmt.Errorf("SABnzbd did not answer within %s (%v)", w.Wait, last)
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

// sabAPI calls SABnzbd's API with params and returns its "config" reply.
func (w *Wirer) sabAPI(ctx context.Context, key string, params url.Values) (map[string]json.RawMessage, error) {
	params.Set("apikey", key)
	params.Set("output", "json")
	u := strings.TrimRight(w.Apps["sabnzbd"].URL, "/") + "/api?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	client := w.HTTP
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		// The URL carries the key: say only what failed.
		var ue *url.Error
		if errors.As(err, &ue) {
			err = ue.Err
		}
		return nil, fmt.Errorf("SABnzbd: %v", err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var reply struct {
		Status *bool                      `json:"status"`
		Error  string                     `json:"error"`
		Config map[string]json.RawMessage `json:"config"`
	}
	if resp.StatusCode/100 != 2 || json.Unmarshal(data, &reply) != nil {
		return nil, fmt.Errorf("SABnzbd %s: %s", params.Get("mode"), resp.Status)
	}
	if reply.Status != nil && !*reply.Status {
		return nil, fmt.Errorf("SABnzbd %s: %s", params.Get("mode"), reply.Error)
	}
	return reply.Config, nil
}

// sabConfig reads one section: misc as one map, servers and categories as
// a map by name.
func (w *Wirer) sabConfig(ctx context.Context, key, section string) (map[string]any, error) {
	cfg, err := w.sabAPI(ctx, key, url.Values{"mode": {"get_config"}, "section": {section}})
	if err != nil {
		return nil, err
	}
	out := map[string]any{}
	raw := cfg[section]
	if section == "misc" {
		err = json.Unmarshal(raw, &out)
		return out, err
	}
	var list []map[string]any
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &list); err != nil {
			return nil, err
		}
	}
	for _, item := range list {
		out[fmt.Sprint(item["name"])] = item
	}
	return out, nil
}

func (w *Wirer) sabSet(ctx context.Context, key string, params url.Values) error {
	params.Set("mode", "set_config")
	_, err := w.sabAPI(ctx, key, params)
	return err
}

// sabKept is a password as sabnzbd.ini keeps it (decoded as SABnzbd's
// decode_password does), in section ("misc", or "servers/<name>").
func (w *Wirer) sabKept(section string) string {
	data, err := os.ReadFile(filepath.Join(w.Apps["sabnzbd"].ConfigDir, sabKeyFile))
	if err != nil {
		return ""
	}
	pw := iniValue(data, section, "password")
	hex, ok := strings.CutPrefix(pw, "!!!encoded!!!")
	if !ok {
		return pw
	}
	var b strings.Builder
	for i := 0; i+1 < len(hex); i += 2 {
		n, err := strconv.ParseUint(strings.TrimSpace(hex[i:i+2]), 16, 8)
		if err != nil {
			return ""
		}
		b.WriteByte(byte(n))
	}
	return b.String()
}

// sabSame compares a value SABnzbd gives back with one wiring sends: its
// numbers and switches come back as numbers, true or false.
func sabSame(got any, want string) bool {
	switch v := got.(type) {
	case bool:
		return (want == "1") == v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64) == want
	}
	return fmt.Sprint(got) == want
}

// sabLogin makes SABnzbd ask for the homelab's login (ARR_USER,
// ARR_PASSWORD), as wire does for the *arr apps. Once it has one, SABnzbd
// lets in any address the page is opened at (interface.py check_hostname).
func (w *Wirer) sabLogin(ctx context.Context) (string, string, error) {
	key, err := w.sabReady(ctx)
	if err != nil {
		return "", "", err
	}
	misc, err := w.sabConfig(ctx, key, "misc")
	if err != nil {
		return "", "", err
	}
	user, password := w.arrUser(), w.Env["ARR_PASSWORD"]
	had := fmt.Sprint(misc["username"])
	if had == user && w.sabKept("misc") == password {
		return "already", "", nil
	}
	for _, kv := range [][2]string{{"username", user}, {"password", password}} {
		if err := w.sabSet(ctx, key, url.Values{"section": {"misc"}, "keyword": {kv[0]}, "value": {kv[1]}}); err != nil {
			return "", "", err
		}
	}
	if had != "" && had != user {
		return "done", "replaced the login made in SABnzbd (" + had + ") with the one in Sign-in details", nil
	}
	return "done", "", nil
}

// sabSetUp sets SABnzbd's folders, lets the apps in at gluetun's name, and
// makes a category for each app, changing only what differs.
func (w *Wirer) sabSetUp(ctx context.Context) (string, string, error) {
	key, err := w.sabReady(ctx)
	if err != nil {
		return "", "", err
	}
	misc, err := w.sabConfig(ctx, key, "misc")
	if err != nil {
		return "", "", err
	}
	var changed []string
	for _, k := range []string{"download_dir", "complete_dir"} {
		if fmt.Sprint(misc[k]) == sabFolders[k] {
			continue
		}
		if err := w.sabSet(ctx, key, url.Values{"section": {"misc"}, "keyword": {k}, "value": {sabFolders[k]}}); err != nil {
			return "", "", err
		}
		changed = append(changed, k)
	}
	// Without a login (ARR_PASSWORD cleared by hand), SABnzbd answers only
	// localhost, addresses and the names in host_whitelist: the apps call
	// it gluetun.
	var hosts []string
	switch v := misc["host_whitelist"].(type) {
	case []any:
		for _, h := range v {
			if s := strings.TrimSpace(fmt.Sprint(h)); s != "" {
				hosts = append(hosts, s)
			}
		}
	case string:
		for _, h := range strings.Split(v, ",") {
			if s := strings.TrimSpace(h); s != "" {
				hosts = append(hosts, s)
			}
		}
	}
	if !slices.Contains(hosts, "gluetun") {
		hosts = append(hosts, "gluetun")
		if err := w.sabSet(ctx, key, url.Values{"section": {"misc"}, "keyword": {"host_whitelist"}, "value": {strings.Join(hosts, ", ")}}); err != nil {
			return "", "", err
		}
		changed = append(changed, "host_whitelist")
	}
	cats, err := w.sabConfig(ctx, key, "categories")
	if err != nil {
		return "", "", err
	}
	for _, name := range sabCategories {
		if c, ok := cats[name].(map[string]any); ok && fmt.Sprint(c["dir"]) == name {
			continue
		}
		if err := w.sabSet(ctx, key, url.Values{"section": {"categories"}, "keyword": {name}, "dir": {name}}); err != nil {
			return "", "", err
		}
		changed = append(changed, "category "+name)
	}
	switch {
	case len(changed) == 0:
		return "already", "", nil
	case len(changed) == len(sabFolders)+1+len(sabCategories):
		return "done", "", nil
	}
	return "done", "corrected " + strings.Join(changed, ", "), nil
}

// sabServer adds the Usenet server in .env (USENET_*), always over SSL,
// named after its host as SABnzbd's own page names one; a server added by
// hand under that name is corrected, not doubled.
func (w *Wirer) sabServer(ctx context.Context) (string, string, error) {
	host := strings.ToLower(strings.TrimSpace(w.Env["USENET_HOST"]))
	if host == "" {
		return "manual", sabServerHelp, nil
	}
	key, err := w.sabReady(ctx)
	if err != nil {
		return "", "", err
	}
	or := func(k, def string) string {
		if v := strings.TrimSpace(w.Env[k]); v != "" {
			return v
		}
		return def
	}
	want := [][2]string{
		{"host", host}, {"port", or("USENET_PORT", "563")}, {"ssl", "1"},
		{"username", strings.TrimSpace(w.Env["USENET_USER"])}, {"connections", or("USENET_CONNECTIONS", "8")}, {"enable", "1"},
	}
	servers, err := w.sabConfig(ctx, key, "servers")
	if err != nil {
		return "", "", err
	}
	cur, had := servers[host].(map[string]any)
	var wrong []string
	for _, kv := range want {
		if !had || !sabSame(cur[kv[0]], kv[1]) {
			wrong = append(wrong, kv[0])
		}
	}
	if w.sabKept("servers/"+host) != w.Env["USENET_PASSWORD"] {
		wrong = append(wrong, "password")
	}
	if len(wrong) == 0 {
		return "already", "", nil
	}
	params := url.Values{"section": {"servers"}, "keyword": {host}, "password": {w.Env["USENET_PASSWORD"]}}
	for _, kv := range want {
		params.Set(kv[0], kv[1])
	}
	if err := w.sabSet(ctx, key, params); err != nil {
		return "", "", err
	}
	if had {
		return "done", "corrected " + strings.Join(wrong, ", "), nil
	}
	return "done", "", nil
}

// sabClient makes SABnzbd an app's Usenet download client, at the address
// the apps reach it (gluetun:8080), with its key and the app's category.
func (w *Wirer) sabClient(ctx context.Context, client string) (string, string, error) {
	key, err := w.ready(ctx, client)
	if err != nil {
		return "", "", err
	}
	skey, err := w.sabReady(ctx)
	if err != nil {
		return "", "", err
	}
	host, port := "gluetun", 8080
	if u := w.Apps["sabnzbd"].Internal; u != "" {
		hp := strings.TrimPrefix(u, "http://")
		if i := strings.LastIndex(hp, ":"); i > 0 {
			host = hp[:i]
			port, _ = strconv.Atoi(hp[i+1:])
		}
	}
	want := map[string]any{"host": host, "port": port, "apiKey": skey}
	return w.ensure(ctx, client, key, "downloadclient", "Sabnzbd", want, func() (resource, error) {
		r, err := w.fromSchema(ctx, client, key, "downloadclient", "Sabnzbd", want)
		if err == nil {
			r["name"], r["enable"] = "SABnzbd", true
			if f, ok := categoryField[client]; ok {
				setField(r, f.name, f.value)
			}
		}
		return r, err
	})
}
