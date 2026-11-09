package media

// Look a typed title up (Needs a look's It's a film… and It's an episode…):
// what's typed is asked of the apps here that already know TMDB and TVDB,
// with their own keys: Radarr for films, Sonarr for shows, then Jellyfin
// (its remote search). The person picks "The Big Lebowski (1998)" rather
// than typing the year. Only the typed words go, and only to these apps
// on this computer; they ask TMDB or TVDB themselves.

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
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// Title is one film or show a lookup found.
type Title struct {
	Name string `json:"name"`
	Year int    `json:"year,omitempty"`
	// From is the app that found it (Radarr, Sonarr, Jellyfin), said under the list.
	From string `json:"from"`
}

// TitleSource is an app that can look titles up: "radarr", "sonarr", or
// "jellyfin", where it answers, and its key.
type TitleSource struct {
	App, URL, Key string
}

// ErrNoLookup is FindTitles' answer when no app here can look titles up.
var ErrNoLookup = errors.New("nothing here can look titles up: Radarr (films), Sonarr (shows), or Jellyfin with its API key in Settings can. Type the name instead")

// maxTitles is how many a sheet shows.
const maxTitles = 8

// FindTitles asks each source that knows this kind ("movie" or "show"),
// Radarr's or Sonarr's first, and returns the first one's answers, each
// name and year once. A source that doesn't answer is passed over; when
// none does, the last reason is the error.
func FindTitles(ctx context.Context, client *http.Client, kind, term string, sources []TitleSource) ([]Title, error) {
	term = strings.TrimSpace(term)
	if kind != "movie" && kind != "show" {
		return nil, fmt.Errorf("no lookup for %q", kind)
	}
	if term == "" {
		return nil, errors.New("type the name first")
	}
	if utf8.RuneCountInString(term) > 200 {
		return nil, errors.New("that name is too long")
	}
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	arr := map[string]string{"movie": "radarr", "show": "sonarr"}[kind]
	var tried []TitleSource
	for _, s := range sources {
		if s.App == arr && s.URL != "" && s.Key != "" {
			tried = append(tried, s)
		}
	}
	for _, s := range sources {
		if s.App == "jellyfin" && s.URL != "" && s.Key != "" {
			tried = append(tried, s)
		}
	}
	if len(tried) == 0 {
		return nil, ErrNoLookup
	}
	var last error
	for _, s := range tried {
		found, err := askTitles(ctx, client, s, kind, term)
		if err != nil {
			last = err
			continue
		}
		return found, nil
	}
	return nil, last
}

func askTitles(ctx context.Context, client *http.Client, s TitleSource, kind, term string) ([]Title, error) {
	base := strings.TrimRight(s.URL, "/")
	var req *http.Request
	var err error
	name := map[string]string{"radarr": "Radarr", "sonarr": "Sonarr", "jellyfin": "Jellyfin"}[s.App]
	switch s.App {
	case "radarr", "sonarr":
		path := map[string]string{"radarr": "/api/v3/movie/lookup", "sonarr": "/api/v3/series/lookup"}[s.App]
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, base+path+"?"+url.Values{"term": {term}}.Encode(), nil)
		if err == nil {
			req.Header.Set("X-Api-Key", s.Key)
		}
	case "jellyfin":
		body, _ := json.Marshal(map[string]any{"SearchInfo": map[string]string{"Name": term}, "IncludeDisabledProviders": false})
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, base+"/Items/RemoteSearch/"+map[string]string{"movie": "Movie", "show": "Series"}[kind], bytes.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", `MediaBrowser Token="`+s.Key+`"`)
		}
	default:
		return nil, fmt.Errorf("no lookup in %q", s.App)
	}
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("couldn't reach %s: is it running?", name)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, fmt.Errorf("couldn't read what %s said", name)
	}
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return nil, fmt.Errorf("%s refused its key: check it in Settings", name)
	case resp.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("%s didn't answer (%d)", name, resp.StatusCode)
	}
	var raw []struct {
		Title          string `json:"title"`
		Year           int    `json:"year"`
		Name           string `json:"Name"`
		ProductionYear int    `json:"ProductionYear"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("couldn't read what %s said", name)
	}
	out := []Title{}
	seen := map[string]bool{}
	for _, r := range raw {
		t := Title{Name: strings.TrimSpace(r.Title), Year: r.Year, From: name}
		if s.App == "jellyfin" {
			t.Name, t.Year = strings.TrimSpace(r.Name), r.ProductionYear
		}
		key := strings.ToLower(t.Name) + "\x00" + fmt.Sprint(t.Year)
		if t.Name == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, t)
		if len(out) == maxTitles {
			break
		}
	}
	return out, nil
}

var arrKeyRe = regexp.MustCompile(`<ApiKey>([^<]+)</ApiKey>`)

// ArrKey is an *arr app's API key, from the config.xml in its config folder
// (what it mounts at /config); "" when it hasn't written one.
func ArrKey(configDir string) string {
	if configDir == "" {
		return ""
	}
	data, err := os.ReadFile(filepath.Join(configDir, "config.xml"))
	if err != nil {
		return ""
	}
	if m := arrKeyRe.FindSubmatch(data); m != nil {
		return strings.TrimSpace(string(m[1]))
	}
	return ""
}
