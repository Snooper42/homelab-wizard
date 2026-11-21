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
	"sort"
	"strconv"
	"strings"
	"time"
)

// qbitPrefs are the qBittorrent settings wire owns (the owner, Nov 19, 2026:
// disk space comes first). A download stops sharing as soon as it is
// finished (a share ratio of 0, then Stop), so Tidy Up can file it once,
// moving it rather than keeping a second copy; and an unfinished one waits
// in /downloads/incomplete with .!qB names, where nothing takes it for done.
var qbitPrefs = map[string]any{
	"max_ratio_enabled":    true,
	"max_ratio":            0,
	"max_ratio_act":        0, // Stop
	"temp_path_enabled":    true,
	"temp_path":            "/downloads/incomplete",
	"incomplete_files_ext": true,
}

const qbitSignInHelp = "put qBittorrent's Web UI password in QBITTORRENT_PASSWORD in Settings (and QBITTORRENT_USER if it is not admin), then connect again; a qBittorrent the homelab installs gets one made for it, and one set up earlier keeps its own (Tools > Options > Web UI)"

var errQbitSignIn = errors.New("qBittorrent refused the sign-in: check QBITTORRENT_PASSWORD (and QBITTORRENT_USER) in .env")

// qbitSharing sets qbitPrefs in qBittorrent, changing only those that differ.
func (w *Wirer) qbitSharing(ctx context.Context) (string, string, error) {
	if w.Env["QBITTORRENT_PASSWORD"] == "" {
		return "manual", qbitSignInHelp, nil
	}
	wrong, err := w.qbitSet(ctx, qbitPrefs)
	if err != nil || len(wrong) == 0 {
		return "already", "", err
	}
	if len(wrong) == len(qbitPrefs) {
		return "done", "", nil
	}
	return "done", "corrected " + strings.Join(wrong, ", "), nil
}

// gluetunPortFile is where Gluetun writes the port ProtonVPN forwards
// (VPN_PORT_FORWARDING_STATUS_FILE, in its /gluetun folder so this computer
// can read it).
const gluetunPortFile = "forwarded_port"

// qbitVPNPort lets Gluetun put the forwarded port into qBittorrent by itself
// (arr-loop item 2): its VPN_PORT_FORWARDING_UP_COMMAND calls qBittorrent's
// Web API on the loopback they share, which qBittorrent lets in without its
// login (bypass_local_auth; only Gluetun and qBittorrent share that
// loopback). While wire is here it also sets the port Gluetun has now, so a
// homelab from before this doesn't wait for the VPN's next connect.
func (w *Wirer) qbitVPNPort(ctx context.Context) (string, string, error) {
	if w.Env["QBITTORRENT_PASSWORD"] == "" {
		return "manual", qbitSignInHelp, nil
	}
	want := map[string]any{"bypass_local_auth": true}
	port := w.forwardedPort()
	if port > 0 {
		// Connected: the port, and the tunnel as qBittorrent's only network,
		// as Gluetun's up command sets them.
		want["listen_port"] = port
		want["current_network_interface"] = vpnInterface
	}
	wrong, err := w.qbitSet(ctx, want)
	if err != nil {
		return "", "", err
	}
	var said []string
	for _, k := range wrong {
		switch k {
		case "current_network_interface":
			said = append(said, "tied to the VPN's tunnel, its only network")
		case "listen_port":
			said = append(said, fmt.Sprintf("listening port set to %d, the one the VPN forwards", port))
		}
	}
	if port == 0 {
		said = append(said, "the VPN has no forwarded port yet: Gluetun gives it to qBittorrent once it connects")
	}
	state := "already"
	if len(wrong) > 0 {
		state = "done"
	}
	return state, strings.Join(said, "; "), nil
}

// forwardedPort is the port Gluetun last wrote, or 0 when there's none.
func (w *Wirer) forwardedPort() int {
	dir := w.Apps["gluetun"].ConfigDir
	if dir == "" {
		return 0
	}
	data, err := os.ReadFile(filepath.Join(dir, gluetunPortFile))
	if err != nil {
		return 0
	}
	first, _, _ := strings.Cut(strings.TrimSpace(string(data)), "\n")
	first, _, _ = strings.Cut(first, ",")
	p, err := strconv.Atoi(strings.TrimSpace(first))
	if err != nil || p < 1 || p > 65535 {
		return 0
	}
	return p
}

// qbitSet signs in and sets want in qBittorrent's preferences, changing
// only those that differ, and returns their names, sorted.
func (w *Wirer) qbitSet(ctx context.Context, want map[string]any) ([]string, error) {
	sid, err := w.qbitSignIn(ctx)
	if err != nil {
		return nil, err
	}
	var cur map[string]any
	if err := w.qbitCall(ctx, sid, "app/preferences", nil, &cur); err != nil {
		return nil, err
	}
	change := map[string]any{}
	var wrong []string
	for k, v := range want {
		if fmt.Sprint(cur[k]) != fmt.Sprint(v) {
			change[k] = v
			wrong = append(wrong, k)
		}
	}
	if len(wrong) == 0 {
		return nil, nil
	}
	data, _ := json.Marshal(change)
	if err := w.qbitCall(ctx, sid, "app/setPreferences", url.Values{"json": {string(data)}}, nil); err != nil {
		return nil, err
	}
	sort.Strings(wrong)
	return wrong, nil
}

func (w *Wirer) qbitClient() *http.Client {
	if w.HTTP != nil {
		return w.HTTP
	}
	return &http.Client{Timeout: 30 * time.Second}
}

// QbitSession is whether c is qBittorrent's session cookie: SID up to
// 5.1, QBT_SID_<its Web UI port> from 5.2 (webapplication.cpp).
func QbitSession(c *http.Cookie) bool {
	return c.Name == "SID" || strings.HasPrefix(c.Name, "QBT_SID_")
}

// qbitSignIn signs in to qBittorrent's Web API and returns the session
// cookie. qBittorrent starts only once Gluetun's tunnel is up, so a refused
// connection is tried again until w.Wait runs out.
func (w *Wirer) qbitSignIn(ctx context.Context) (*http.Cookie, error) {
	base := strings.TrimRight(w.Apps["qbittorrent"].URL, "/")
	user := w.Env["QBITTORRENT_USER"]
	if user == "" {
		user = "admin"
	}
	form := url.Values{"username": {user}, "password": {w.Env["QBITTORRENT_PASSWORD"]}}.Encode()
	deadline := time.Now().Add(w.Wait)
	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/v2/auth/login", strings.NewReader(form))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("Referer", base)
		resp, err := w.qbitClient().Do(req)
		if err == nil {
			io.Copy(io.Discard, io.LimitReader(resp.Body, 512))
			resp.Body.Close()
			for _, c := range resp.Cookies() {
				if QbitSession(c) && resp.StatusCode == http.StatusOK {
					return c, nil
				}
			}
			return nil, errQbitSignIn
		}
		left := time.Until(deadline)
		if left <= 0 {
			return nil, fmt.Errorf("qBittorrent did not answer within %s (%v)", w.Wait, err)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(min(left, 2*time.Second)):
		}
	}
}

// qbitCall reads (form nil) or posts form to one Web API path, decoding the
// reply into out when it is given.
func (w *Wirer) qbitCall(ctx context.Context, sid *http.Cookie, path string, form url.Values, out any) error {
	base := strings.TrimRight(w.Apps["qbittorrent"].URL, "/")
	method, body := http.MethodGet, io.Reader(nil)
	if form != nil {
		method, body = http.MethodPost, strings.NewReader(form.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, method, base+"/api/v2/"+path, body)
	if err != nil {
		return err
	}
	if form != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	req.Header.Set("Referer", base)
	req.AddCookie(sid)
	resp, err := w.qbitClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("qBittorrent %s: %s", path, resp.Status)
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}
