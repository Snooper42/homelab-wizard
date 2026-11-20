package wiring

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Downloads are private (arr-loop item 2): qBittorrent lives in Gluetun's
// network, the VPN is connected (Gluetun wrote the address it reached the
// internet from, through the tunnel), and qBittorrent is tied to the
// tunnel. The check reads what Gluetun and qBittorrent say; it asks no
// outside service.
func TestDownloadsArePrivate(t *testing.T) {
	url, prefs, saves := fakeQbit(t, "pw")
	gluetun := t.TempDir()
	w := &Wirer{
		Apps: map[string]App{
			"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", URL: url, Internal: "http://gluetun:8082"},
			"gluetun":     {ID: "gluetun", Name: "Gluetun", ConfigDir: gluetun},
		},
		Env:  map[string]string{"QBITTORRENT_PASSWORD": "pw"},
		Wait: time.Second,
	}
	check := func(want bool, said, fix string) {
		t.Helper()
		p := w.Privacy(context.Background())
		if p.Private != want || !strings.Contains(p.Said, said) || p.Fix != fix {
			t.Fatalf("got %+v, want private=%v, said %q, fix %q", p, want, said, fix)
		}
	}

	// Gluetun hasn't connected yet: no address, so nothing leaves.
	check(false, "hasn't connected yet", "")
	os.WriteFile(filepath.Join(gluetun, gluetunIPFile), []byte("\n"), 0o644) // emptied on a disconnect
	check(false, "hasn't connected yet", "")

	// Connected, but qBittorrent isn't tied to the tunnel: Connect apps ties it.
	os.WriteFile(filepath.Join(gluetun, gluetunIPFile), []byte("203.0.113.7"), 0o644)
	prefs["current_network_interface"] = ""
	check(false, "isn't tied to the VPN", "wire")
	prefs["current_network_interface"] = "lo" // what the down command leaves
	check(false, "isn't tied to the VPN", "wire")

	// Tied to it, as Gluetun's up command and Connect apps leave it.
	prefs["current_network_interface"] = "tun0"
	check(true, "only through ProtonVPN", "")
	if *saves != 0 {
		t.Fatalf("the check changed qBittorrent's settings (%d saves)", *saves)
	}
	if p := w.Privacy(context.Background()); strings.Contains(p.Said, "203.0.113.7") {
		t.Fatalf("the VPN's address is in the words: %q", p.Said)
	}

	// A wrong password: it can't tell, and says how to fix it, without the password.
	w.Env["QBITTORRENT_PASSWORD"] = "old"
	check(false, "QBITTORRENT_PASSWORD", "")
	w.Env["QBITTORRENT_PASSWORD"] = ""
	check(false, "QBITTORRENT_PASSWORD", "")
	w.Env["QBITTORRENT_PASSWORD"] = "pw"

	// Gluetun stopped: qBittorrent has no network at all.
	delete(w.Apps, "gluetun")
	check(false, "VPN isn't running", "")

	// qBittorrent with a network of its own (a compose file changed by hand).
	w.Apps["gluetun"] = App{ID: "gluetun", ConfigDir: gluetun}
	w.Apps["qbittorrent"] = App{ID: "qbittorrent", Name: "qBittorrent", URL: url, Internal: "http://qbittorrent:8082"}
	check(false, "network of its own", "")

	// qBittorrent stopped.
	delete(w.Apps, "qbittorrent")
	check(false, "isn't running", "")
}

// Connect apps ties qBittorrent to the tunnel once the VPN is connected,
// as Gluetun's up command does, and finds it tied the next time.
func TestQbittorrentTiedToTheTunnel(t *testing.T) {
	url, prefs, saves := fakeQbit(t, "pw")
	gluetun := t.TempDir()
	w := &Wirer{
		Apps: map[string]App{
			"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", URL: url},
			"gluetun":     {ID: "gluetun", Name: "Gluetun", ConfigDir: gluetun},
		},
		Env:  map[string]string{"QBITTORRENT_PASSWORD": "pw"},
		Wait: time.Second,
	}
	// Not connected: the interface is left as Gluetun's down command set it.
	prefs["current_network_interface"] = "lo"
	if _, _, err := w.qbitVPNPort(context.Background()); err != nil || prefs["current_network_interface"] != "lo" {
		t.Fatalf("before the VPN connects: %v %v", err, prefs)
	}
	os.WriteFile(filepath.Join(gluetun, gluetunPortFile), []byte("51234\n"), 0o644)
	state, said, err := w.qbitVPNPort(context.Background())
	if err != nil || state != "done" || prefs["current_network_interface"] != "tun0" || !strings.Contains(said, "tied to the VPN") {
		t.Fatalf("after it connects: %s %q %v %v", state, said, err, prefs)
	}
	before := *saves
	if state, _, _ := w.qbitVPNPort(context.Background()); state != "already" || *saves != before {
		t.Fatalf("second run: %s, %d saves", state, *saves-before)
	}
}
