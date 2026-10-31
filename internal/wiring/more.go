package wiring

// The links after the indexers and the download client: where each *arr app
// keeps its library, Bazarr's subtitles for Sonarr and Radarr, and Seerr's
// requests going to Sonarr and Radarr. Each is read first and only added (or
// corrected) when it is missing, like the others.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// libraries is the folder each app keeps its library in: the media drive's
// folder, mounted at the same path in each container (compose/media-automation.yaml).
var libraries = []struct{ id, path, name string }{
	{"sonarr", "/tv", "TV"}, {"radarr", "/movies", "Movies"}, {"lidarr", "/music", "Music"},
}

// rootFolder makes path the app's root folder, once.
func (w *Wirer) rootFolder(ctx context.Context, id, path, name string) (string, string, error) {
	key, err := w.ready(ctx, id)
	if err != nil {
		return "", "", err
	}
	var have []resource
	if err := w.call(ctx, id, key, http.MethodGet, "rootfolder", nil, &have); err != nil {
		return "", "", err
	}
	for _, r := range have {
		if strings.TrimRight(fmt.Sprint(r["path"]), "/") == path {
			return "already", "", nil
		}
	}
	body := resource{"path": path}
	if id == "lidarr" {
		// Lidarr's root folder carries the defaults for the artists added to it.
		quality, err := w.firstID(ctx, id, key, "qualityprofile")
		if err != nil {
			return "", "", err
		}
		metadata, err := w.firstID(ctx, id, key, "metadataprofile")
		if err != nil {
			return "", "", err
		}
		body = resource{"name": name, "path": path, "defaultQualityProfileId": quality, "defaultMetadataProfileId": metadata,
			"defaultMonitorOption": "all", "defaultNewItemMonitorOption": "all", "defaultTags": []int{}}
	}
	if err := w.call(ctx, id, key, http.MethodPost, "rootfolder", body, nil); err != nil {
		// A folder the app cannot use is the media drive's, not the link's:
		// a next step for the person, not a failure.
		var se *statusError
		if errors.As(err, &se) && se.code == http.StatusBadRequest {
			return "manual", fmt.Sprintf("connect the media drive (MEDIA_ROOT) so its %s folder is there for %s to write to, then connect again (%s)", strings.TrimPrefix(path, "/"), w.name(id), err), nil
		}
		return "", "", err
	}
	return "done", "", nil
}

// firstID is the ID of the app's first resource of kind (a quality profile).
func (w *Wirer) firstID(ctx context.Context, id, key, kind string) (int, error) {
	var list []resource
	if err := w.call(ctx, id, key, http.MethodGet, kind, nil, &list); err != nil {
		return 0, err
	}
	if len(list) == 0 {
		return 0, fmt.Errorf("%s has no %s yet", w.name(id), kind)
	}
	n, _ := list[0]["id"].(float64)
	return int(n), nil
}

// hostPort splits an app's address from other containers ("http://sonarr:8989").
func hostPort(internal string) (string, int) {
	u, err := url.Parse(internal)
	if err != nil {
		return "", 0
	}
	port, _ := strconv.Atoi(u.Port())
	return u.Hostname(), port
}

// send is one request to an app that is not an *arr (Bazarr, Seerr), its
// path after the app's address, decoding the reply into out.
func (w *Wirer) send(ctx context.Context, id, method, path string, header map[string]string, body []byte, out any) error {
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(w.Apps[id].URL, "/")+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	for k, v := range header {
		req.Header.Set(k, v)
	}
	client := w.HTTP
	if client == nil {
		client = &http.Client{Timeout: time.Minute}
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
		return &statusError{fmt.Sprintf("%s %s: %s %s", w.name(id), path, resp.Status, msg), resp.StatusCode}
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}

type statusError struct {
	msg  string
	code int
}

func (e *statusError) Error() string { return e.msg }

// --- Bazarr ---

// bazarrKey reads Bazarr's API key from its config.yaml (in /config/config).
func (w *Wirer) bazarrKey() string {
	data, err := os.ReadFile(filepath.Join(w.Apps["bazarr"].ConfigDir, "config", "config.yaml"))
	if err != nil {
		return ""
	}
	var c struct {
		Auth struct {
			APIKey string `yaml:"apikey"`
		} `yaml:"auth"`
	}
	if yaml.Unmarshal(data, &c) != nil {
		return ""
	}
	return c.Auth.APIKey
}

// bazarrSettings waits for Bazarr's key and reads its settings.
func (w *Wirer) bazarrSettings(ctx context.Context) (string, map[string]map[string]any, error) {
	deadline := time.Now().Add(w.Wait)
	last := fmt.Errorf("no API key in %s yet", filepath.Join(w.Apps["bazarr"].ConfigDir, "config", "config.yaml"))
	for {
		if key := w.bazarrKey(); key != "" {
			var s map[string]map[string]any
			err := w.send(ctx, "bazarr", http.MethodGet, "/api/system/settings", map[string]string{"X-API-KEY": key}, nil, &s)
			if err == nil {
				return key, s, nil
			}
			last = err
		}
		left := time.Until(deadline)
		if left <= 0 {
			return "", nil, fmt.Errorf("Bazarr did not answer within %s (%v)", w.Wait, last)
		}
		select {
		case <-ctx.Done():
			return "", nil, ctx.Err()
		case <-time.After(min(left, 2*time.Second)):
		}
	}
}

// bazarr turns on Sonarr and Radarr in Bazarr, at their service names, with
// their keys. The paths are the same in all three apps, so no path mapping.
func (w *Wirer) bazarr(ctx context.Context, arr string) (string, string, error) {
	akey, err := w.ready(ctx, arr)
	if err != nil {
		return "", "", err
	}
	bkey, s, err := w.bazarrSettings(ctx)
	if err != nil {
		return "", "", err
	}
	host, port := hostPort(w.Apps[arr].Internal)
	want := map[string]any{"ip": host, "port": port, "apikey": akey}
	var wrong []string
	if s["general"]["use_"+arr] != true {
		wrong = append(wrong, "use_"+arr)
	}
	for _, k := range []string{"apikey", "ip", "port"} {
		if fmt.Sprint(s[arr][k]) != fmt.Sprint(want[k]) {
			wrong = append(wrong, k)
		}
	}
	if len(wrong) == 0 {
		return "already", "", nil
	}
	form := url.Values{}
	form.Set("settings-general-use_"+arr, "true")
	for k, v := range want {
		form.Set("settings-"+arr+"-"+k, fmt.Sprint(v))
	}
	header := map[string]string{"X-API-KEY": bkey, "Content-Type": "application/x-www-form-urlencoded"}
	if err := w.send(ctx, "bazarr", http.MethodPost, "/api/system/settings", header, []byte(form.Encode()), nil); err != nil {
		return "", "", err
	}
	if fmt.Sprint(s[arr]["apikey"]) == "" || s[arr]["apikey"] == nil {
		return "done", "", nil // the first time
	}
	sort.Strings(wrong)
	return "done", "corrected " + strings.Join(wrong, ", "), nil
}

// --- Seerr ---

// errSeerrNotSetUp: Seerr has no administrator until someone signs in to it
// with Jellyfin, so its key cannot act yet.
var errSeerrNotSetUp = errors.New("Seerr is not set up yet")

const seerrSignIn = "open Seerr and sign in with Jellyfin (server host.docker.internal, port 8096, a Jellyfin administrator), then connect again"

// seerrKey reads Seerr's API key from settings.json, and whether its
// first-run setup (the Jellyfin sign-in) is done.
func (w *Wirer) seerrKey() (string, bool) {
	data, err := os.ReadFile(filepath.Join(w.Apps["seerr"].ConfigDir, "settings.json"))
	if err != nil {
		return "", false
	}
	var s struct {
		Main struct {
			APIKey string `json:"apiKey"`
		} `json:"main"`
		Public struct {
			Initialized bool `json:"initialized"`
		} `json:"public"`
	}
	if json.Unmarshal(data, &s) != nil {
		return "", false
	}
	return s.Main.APIKey, s.Public.Initialized
}

// profile is the quality profile Seerr asks for: HD-1080p when the app
// has it (Sonarr and Radarr make it on first start), else the first.
func (w *Wirer) profile(ctx context.Context, id, key string) (int, string, error) {
	var list []resource
	if err := w.call(ctx, id, key, http.MethodGet, "qualityprofile", nil, &list); err != nil {
		return 0, "", err
	}
	if len(list) == 0 {
		return 0, "", fmt.Errorf("%s has no quality profile yet", w.name(id))
	}
	pick := list[0]
	for _, p := range list {
		if p["name"] == "HD-1080p" {
			pick = p
		}
	}
	n, _ := pick["id"].(float64)
	return int(n), fmt.Sprint(pick["name"]), nil
}

// seerr sends Seerr's requests to Sonarr or Radarr: the app's address, key,
// a quality profile, and its library folder, as the default server.
func (w *Wirer) seerr(ctx context.Context, arr, folder string) (string, string, error) {
	skey, initialized := w.seerrKey()
	if !initialized || skey == "" {
		return "manual", seerrSignIn, nil
	}
	akey, err := w.ready(ctx, arr)
	if err != nil {
		return "", "", err
	}
	header := map[string]string{"X-Api-Key": skey, "Content-Type": "application/json"}
	path := "/api/v1/settings/" + arr
	var have []resource
	if err := w.send(ctx, "seerr", http.MethodGet, path, header, nil, &have); err != nil {
		var se *statusError
		if errors.As(err, &se) && (se.code == http.StatusForbidden || se.code == http.StatusUnauthorized) {
			return "manual", seerrSignIn, nil
		}
		return "", "", err
	}
	host, port := hostPort(w.Apps[arr].Internal)
	for _, cur := range have {
		if cur["is4k"] == true {
			continue
		}
		var wrong []string
		for k, v := range map[string]any{"hostname": host, "port": port, "apiKey": akey} {
			if fmt.Sprint(cur[k]) != fmt.Sprint(v) {
				wrong = append(wrong, k)
				cur[k] = v
			}
		}
		if len(wrong) == 0 {
			return "already", "", nil
		}
		body, _ := json.Marshal(cur)
		if err := w.send(ctx, "seerr", http.MethodPut, fmt.Sprintf("%s/%v", path, cur["id"]), header, body, nil); err != nil {
			return "", "", err
		}
		sort.Strings(wrong)
		return "done", "corrected " + strings.Join(wrong, ", "), nil
	}
	pid, pname, err := w.profile(ctx, arr, akey)
	if err != nil {
		return "", "", err
	}
	server := resource{
		"name": w.name(arr), "hostname": host, "port": port, "apiKey": akey, "useSsl": false, "baseUrl": "",
		"activeProfileId": pid, "activeProfileName": pname, "activeDirectory": folder,
		"tags": []int{}, "is4k": false, "isDefault": true, "syncEnabled": true, "preventSearch": false,
		"tagRequests": false, "overrideRule": []int{},
	}
	if arr == "sonarr" {
		server["seriesType"], server["animeSeriesType"] = "standard", "anime"
		server["activeAnimeProfileId"], server["activeAnimeProfileName"], server["activeAnimeDirectory"] = pid, pname, folder
		server["animeTags"], server["enableSeasonFolders"], server["monitorNewItems"] = []int{}, true, "all"
	} else {
		server["minimumAvailability"] = "released"
	}
	body, _ := json.Marshal(server)
	if err := w.send(ctx, "seerr", http.MethodPost, path, header, body, nil); err != nil {
		return "", "", err
	}
	return "done", "requests use " + pname + ", into " + folder, nil
}
