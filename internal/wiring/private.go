package wiring

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// gluetunIPFile is where Gluetun writes the address it reached the internet
// from, asked through the tunnel, each time the VPN connects, and empties
// when it stops (PUBLICIP_FILE, in its /gluetun folder so this computer can
// read it).
const gluetunIPFile = "ip"

// vpnInterface is the tunnel Gluetun brings up (its VPN_INTERFACE default),
// the one network qBittorrent is tied to.
const vpnInterface = "tun0"

// Privacy is whether qBittorrent's downloads leave only through the VPN,
// in words for Setup and qBittorrent's page.
type Privacy struct {
	Private bool   `json:"private"`
	Said    string `json:"said"`
	// Fix is "wire" when Connect apps puts it right.
	Fix string `json:"fix,omitempty"`
}

// Privacy checks that the downloads are private (arr-loop item 2), from
// what Gluetun and qBittorrent say, asking no outside service: qBittorrent
// lives in Gluetun's network (whose firewall lets nothing out but the
// tunnel), the VPN is connected, and qBittorrent is tied to the tunnel, so
// it uses no other network even if the firewall were open. It changes
// nothing, and tries qBittorrent once rather than waiting for it.
func (w *Wirer) Privacy(ctx context.Context) Privacy {
	q, ok := w.Apps["qbittorrent"]
	switch {
	case !ok:
		return Privacy{Said: "qBittorrent isn't running, so nothing is downloading."}
	case !strings.Contains(q.Internal, "//gluetun:"):
		return Privacy{Said: "qBittorrent has a network of its own, not the VPN's: its downloads could leave through your home connection. Its compose file should say network_mode: service:gluetun."}
	}
	if _, ok := w.Apps["gluetun"]; !ok {
		return Privacy{Said: "The VPN isn't running, so qBittorrent has no network: nothing downloads, and nothing leaves through your home connection. Start Gluetun on Status."}
	}
	if !w.vpnConnected() {
		return Privacy{Said: "The VPN hasn't connected yet: nothing downloads until it does, and nothing leaves through your home connection meanwhile."}
	}
	if w.Env["QBITTORRENT_PASSWORD"] == "" {
		return Privacy{Said: "Can't ask qBittorrent which network it uses: " + qbitSignInHelp + "."}
	}
	once := *w
	once.Wait = 0
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	sid, err := once.qbitSignIn(ctx)
	var prefs map[string]any
	if err == nil {
		err = once.qbitCall(ctx, sid, "app/preferences", nil, &prefs)
	}
	switch {
	case errors.Is(err, errQbitSignIn):
		return Privacy{Said: "Can't ask qBittorrent which network it uses: it refused the sign-in. Check QBITTORRENT_PASSWORD (and QBITTORRENT_USER) in Settings."}
	case err != nil:
		return Privacy{Said: "Can't ask qBittorrent which network it uses: it didn't answer."}
	}
	if iface, _ := prefs["current_network_interface"].(string); iface != vpnInterface {
		return Privacy{Said: "The VPN is connected, but qBittorrent isn't tied to the VPN's tunnel yet. Connect apps ties it.", Fix: "wire"}
	}
	return Privacy{Private: true, Said: "qBittorrent's downloads leave only through ProtonVPN, never your home connection."}
}

// vpnConnected reports whether Gluetun has an address from the tunnel now.
func (w *Wirer) vpnConnected() bool {
	dir := w.Apps["gluetun"].ConfigDir
	if dir == "" {
		return false
	}
	data, err := os.ReadFile(filepath.Join(dir, gluetunIPFile))
	return err == nil && strings.TrimSpace(string(data)) != ""
}
