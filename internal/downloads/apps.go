// Package downloads reads what the media apps have on the way (the *arr
// apps' queues, qBittorrent's torrents, Seerr's requests) and says it in
// plain words: Status's Downloads card (arr item 6). Tidy Up's resting of
// the *arr apps (cmd/homelab/media_arr_rest.go), stall rescue and the
// inbox read the same apps through the readers here, so each is read one
// way.
package downloads

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// Queue is an app with a download queue, and its API version.
type Queue struct{ ID, API string }

// Queues are the apps with a download queue, in the order they're read.
var Queues = []Queue{{"sonarr", "v3"}, {"radarr", "v3"}, {"lidarr", "v1"}}

var keyRe = regexp.MustCompile(`<ApiKey>([^<]+)</ApiKey>`)

// Key is an *arr app's API key, from its config.xml; "" when it has none
// yet (not set up, so nothing is in its queue).
func Key(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "config.xml"))
	if err != nil {
		return ""
	}
	if m := keyRe.FindSubmatch(data); m != nil {
		return string(m[1])
	}
	return ""
}

// SeerrKey is Seerr's API key, from its settings.json; "" when it has none.
func SeerrKey(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "settings.json"))
	if err != nil {
		return ""
	}
	var s struct {
		Main struct {
			APIKey string `json:"apiKey"`
		} `json:"main"`
	}
	if json.Unmarshal(data, &s) != nil {
		return ""
	}
	return s.Main.APIKey
}

// Get asks base+path with the key, and decodes the answer into out.
func Get(ctx context.Context, client *http.Client, base, path, key string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Api-Key", key)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("answered %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(out)
}

// QbitURL is qBittorrent's Web UI from this machine.
func QbitURL(a wiring.App, env map[string]string) string {
	if a.URL != "" {
		return a.URL
	}
	port := env["QBITTORRENT_PORT"]
	if port == "" {
		port = "8082"
	}
	return "http://localhost:" + port
}

// Torrent is one torrent as qBittorrent's Web API lists it.
type Torrent struct {
	State       string  `json:"state"`
	Progress    float64 `json:"progress"`
	ContentPath string  `json:"content_path"` // inside its container, under /downloads
	// For stall rescue: the torrent's hash (the *arr apps' downloadId), its
	// name, and when it last moved or was added.
	Hash         string `json:"hash"`
	Name         string `json:"name"`
	LastActivity int64  `json:"last_activity"`
	AddedOn      int64  `json:"added_on"`
}

// Stopped is whether qBittorrent is doing nothing with it: paused or
// stopped (qBittorrent 4 says paused, 5 stopped), or broken.
func (t Torrent) Stopped() bool {
	return strings.HasPrefix(t.State, "paused") || strings.HasPrefix(t.State, "stopped") || t.State == "error" || t.State == "missingFiles"
}

// Unshared is whether qBittorrent can't get anywhere with it: no one to
// download from (stalledDL), or it never got started (metaDL).
func (t Torrent) Unshared() bool {
	return t.Progress < 1 && (t.State == "stalledDL" || t.State == "metaDL")
}

// Stuck is whether t is Unshared and hasn't moved for after.
func (t Torrent) Stuck(now time.Time, after time.Duration) bool {
	if !t.Unshared() {
		return false
	}
	last := max(t.LastActivity, t.AddedOn)
	return last > 0 && now.Sub(time.Unix(last, 0)) >= after
}

// ErrNoQbitPassword: qBittorrent can't be read without its Web UI password.
var ErrNoQbitPassword = fmt.Errorf("no QBITTORRENT_PASSWORD")

// QbitList signs in to qBittorrent's Web API and lists its torrents.
func QbitList(ctx context.Context, client *http.Client, base string, env map[string]string) ([]Torrent, error) {
	password := env["QBITTORRENT_PASSWORD"]
	if password == "" {
		return nil, ErrNoQbitPassword
	}
	user := env["QBITTORRENT_USER"]
	if user == "" {
		user = "admin"
	}
	base = strings.TrimRight(base, "/")
	form := url.Values{"username": {user}, "password": {password}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/v2/auth/login", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Referer", base)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	resp.Body.Close()
	sid := wiring.QbitSignedIn(resp)
	if sid == nil {
		return nil, fmt.Errorf("qBittorrent's sign-in answered %d %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	req, err = http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/v2/torrents/info", nil)
	if err != nil {
		return nil, err
	}
	req.AddCookie(sid)
	req.Header.Set("Referer", base)
	resp, err = client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("qBittorrent's torrents answered %d", resp.StatusCode)
	}
	var torrents []Torrent
	if err := json.NewDecoder(io.LimitReader(resp.Body, 16<<20)).Decode(&torrents); err != nil {
		return nil, err
	}
	return torrents, nil
}
