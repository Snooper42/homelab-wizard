package tailnet

import (
	"testing"
	"time"
)

// TestParseDevices: every device of the household's tailnet from
// `tailscale status --json` (the shape Tailscale 1.8x prints), this
// machine first, then online, then by last seen; a device shared in from
// another tailnet left out; each with its admin page for Remove.
func TestParseDevices(t *testing.T) {
	status := []byte(`{
	 "BackendState": "Running",
	 "Self": {"HostName": "homelab", "DNSName": "homelab.tail1234.ts.net.", "OS": "linux", "TailscaleIPs": ["100.64.0.1", "fd7a:115c:a1e0::1"], "Online": true, "LastSeen": "0001-01-01T00:00:00Z"},
	 "Peer": {
	  "nodekey:a": {"HostName": "Annas-iPhone", "DNSName": "annas-iphone.tail1234.ts.net.", "OS": "iOS", "TailscaleIPs": ["100.64.0.2"], "Online": false, "LastSeen": "2026-08-01T10:00:00Z"},
	  "nodekey:b": {"HostName": "Bens-MacBook-Air", "DNSName": "bens-macbook-air.tail1234.ts.net.", "OS": "macOS", "TailscaleIPs": ["100.64.0.3"], "Online": true, "LastSeen": "2026-11-06T09:00:00Z"},
	  "nodekey:c": {"HostName": "old-pixel", "DNSName": "", "OS": "android", "TailscaleIPs": ["100.64.0.4"], "Online": false, "LastSeen": "2026-11-01T08:00:00Z"},
	  "nodekey:d": {"HostName": "friends-server", "DNSName": "friends-server.other.ts.net.", "OS": "linux", "TailscaleIPs": ["100.80.0.9"], "Online": true, "ShareeNode": true}
	 }
	}`)
	got, err := ParseDevices(status)
	if err != nil {
		t.Fatal(err)
	}
	want := []Device{
		{Name: "homelab", OS: "linux", IP: "100.64.0.1", Online: true, Self: true, Admin: MachinesAdmin + "/100.64.0.1"},
		{Name: "bens-macbook-air", OS: "macOS", IP: "100.64.0.3", Online: true, Admin: MachinesAdmin + "/100.64.0.3"},
		{Name: "old-pixel", OS: "android", IP: "100.64.0.4", LastSeen: time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC), Admin: MachinesAdmin + "/100.64.0.4"},
		{Name: "annas-iphone", OS: "iOS", IP: "100.64.0.2", LastSeen: time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC), Admin: MachinesAdmin + "/100.64.0.2"},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d devices: %+v", len(got), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("device %d:\n got %+v\nwant %+v", i, got[i], want[i])
		}
	}
	if _, err := ParseDevices([]byte("not json")); err == nil {
		t.Error("no error for a status that does not read")
	}
}
