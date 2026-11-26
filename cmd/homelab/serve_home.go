package main

import (
	"context"
	"net/netip"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
)

// homeStatusFor is how long Tailscale's status is kept before it's read
// again for the next device.
const homeStatusFor = 15 * time.Second

// atHome is the web page's AtHome (the owner, Nov 26: it answers only at
// home, so a stolen device away from home gets nothing): whether a tailnet
// device is on the home network now, by Tailscale's status, read at most
// every homeStatusFor. A status that can't be read says no.
func (h *homelab) atHome(ctx context.Context) func(netip.Addr) bool {
	var mu sync.Mutex
	var status []byte
	var read time.Time
	return func(ip netip.Addr) bool {
		mu.Lock()
		defer mu.Unlock()
		if time.Since(read) > homeStatusFor {
			c, cancel := context.WithTimeout(ctx, 10*time.Second)
			out, err := core.TailnetStatus(c, h.root)
			cancel()
			status, read = out, time.Now()
			if err != nil {
				status = nil
			}
		}
		return tailnet.AtHome(status, ip.String())
	}
}
