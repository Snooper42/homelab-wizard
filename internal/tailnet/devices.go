package tailnet

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

// Device is one machine on the household's tailnet, as Tailscale's
// status lists it: a phone, a laptop, this machine.
type Device struct {
	Name   string `json:"name"` // as the admin console names it
	OS     string `json:"os,omitempty"`
	IP     string `json:"ip,omitempty"` // its IPv4 address on the tailnet
	Online bool   `json:"online"`
	// LastSeen is when it was last connected (zero while it is, or when
	// Tailscale does not know).
	LastSeen time.Time `json:"lastSeen,omitzero"`
	Self     bool      `json:"self,omitempty"` // this machine
	// Admin is its page in Tailscale's admin console, where Remove is: a
	// device cannot be removed from another device's command line.
	Admin string `json:"admin,omitempty"`
}

// MachinesAdmin is the admin console's list of machines.
const MachinesAdmin = "https://login.tailscale.com/admin/machines"

// ParseDevices reads every device from `tailscale status --json`: this
// machine first, then those online, then the others by when they were
// last seen, most recent first. Devices another tailnet shares in are
// left out: they are not the household's to remove.
func ParseDevices(data []byte) ([]Device, error) {
	type node struct {
		HostName     string
		DNSName      string
		OS           string
		TailscaleIPs []string
		Online       bool
		LastSeen     time.Time
		ShareeNode   bool
	}
	var st struct {
		Self node
		Peer map[string]node
	}
	if err := json.Unmarshal(data, &st); err != nil {
		return nil, fmt.Errorf("Tailscale's status could not be read: %w", err)
	}
	device := func(n node, self bool) Device {
		d := Device{Name: n.HostName, OS: n.OS, Online: n.Online || self, Self: self}
		if label, _, _ := strings.Cut(n.DNSName, "."); label != "" {
			d.Name = label
		}
		if !d.Online && n.LastSeen.Year() > 2000 {
			d.LastSeen = n.LastSeen
		}
		for _, ip := range n.TailscaleIPs {
			if !strings.Contains(ip, ":") {
				d.IP = ip
				d.Admin = MachinesAdmin + "/" + ip
				break
			}
		}
		if d.Admin == "" {
			d.Admin = MachinesAdmin
		}
		return d
	}
	var out []Device
	if st.Self.DNSName != "" || st.Self.HostName != "" {
		out = append(out, device(st.Self, true))
	}
	for _, n := range st.Peer {
		if !n.ShareeNode {
			out = append(out, device(n, false))
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		switch {
		case a.Self != b.Self:
			return a.Self
		case a.Online != b.Online:
			return a.Online
		case !a.LastSeen.Equal(b.LastSeen):
			return a.LastSeen.After(b.LastSeen)
		}
		return strings.ToLower(a.Name) < strings.ToLower(b.Name)
	})
	return out, nil
}
