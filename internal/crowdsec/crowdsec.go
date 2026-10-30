// Package crowdsec reads CrowdSec's view of the proxy's bouncer, so a
// proxy that stopped pulling ban decisions (rebuilt from the upstream
// image, or holding a key CrowdSec no longer accepts) is noticed instead
// of quietly letting banned addresses through.
package crowdsec

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// App is CrowdSec's app ID and container service.
const App = "crowdsec"

// Proxy is the app whose bouncer enforces CrowdSec's bans.
const Proxy = "nginx-proxy-manager"

// ProxyBouncer is the name compose.yaml registers the proxy's bouncer
// under (BOUNCER_KEY_nginx_proxy_manager).
const ProxyBouncer = "nginx_proxy_manager"

// MaxPullAge is how long the bouncer may go without pulling decisions. It
// pulls every 10 seconds (dockerfiles/npm-crowdsec/homelab-init.sh), and
// CrowdSec records a pull at most once a minute.
const MaxPullAge = 5 * time.Minute

// ListCommand prints the registered bouncers as JSON inside the container.
var ListCommand = []string{"cscli", "bouncers", "list", "-o", "json"}

// Bouncer is one entry of `cscli bouncers list -o json`.
type Bouncer struct {
	Name     string     `json:"name"`
	Revoked  bool       `json:"revoked"`
	LastPull *time.Time `json:"last_pull"`
	Version  string     `json:"version"`
}

// fix is the repair for a bouncer CrowdSec does not accept: CrowdSec
// registers it again from CROWDSEC_BOUNCER_KEY when it starts.
const fix = "homelab compose crowdsec exec crowdsec cscli bouncers delete " + ProxyBouncer + ", then homelab restart crowdsec"

// Entries are the proxy's bouncer as CrowdSec lists it. CrowdSec (1.6.4
// on) records a key used from a new address, as the proxy's is once its
// container is recreated, under a bouncer of its own named
// nginx_proxy_manager@<address>, and the pulls go there: the entry
// registered first stops moving.
func Entries(list []Bouncer) []Bouncer {
	var mine []Bouncer
	for _, b := range list {
		if b.Name == ProxyBouncer || strings.HasPrefix(b.Name, ProxyBouncer+"@") {
			mine = append(mine, b)
		}
	}
	return mine
}

// Names reads `cscli bouncers list -o json` and returns the names of the
// proxy's bouncer's entries, for deleting them all; just ProxyBouncer when
// the list cannot be read.
func Names(out []byte) []string {
	var list []Bouncer
	if err := json.Unmarshal(out, &list); err != nil {
		return []string{ProxyBouncer}
	}
	var names []string
	for _, b := range Entries(list) {
		names = append(names, b.Name)
	}
	if len(names) == 0 {
		return []string{ProxyBouncer}
	}
	return names
}

// Verdict reads `cscli bouncers list -o json` and says whether the proxy's
// bouncer is registered, valid, and pulled decisions recently: the newest
// pull of any of its entries counts.
func Verdict(out []byte, now time.Time) (ok bool, msg string) {
	var list []Bouncer
	if err := json.Unmarshal(out, &list); err != nil {
		return false, "CrowdSec's bouncer list could not be read: " + firstLine(string(out))
	}
	mine := Entries(list)
	if len(mine) == 0 {
		return false, "the proxy's bouncer is not registered with CrowdSec, so bans are not enforced: homelab up (it fills in CROWDSEC_BOUNCER_KEY and recreates both), then homelab restart crowdsec"
	}
	var last *time.Time
	revoked := true
	for _, b := range mine {
		if b.Revoked {
			continue
		}
		revoked = false
		// A bouncer that never pulled reads null, or year 1 in some versions.
		if b.LastPull != nil && !b.LastPull.IsZero() && (last == nil || b.LastPull.After(*last)) {
			last = b.LastPull
		}
	}
	switch {
	case revoked:
		return false, "CrowdSec revoked the proxy's bouncer, so bans are not enforced: " + fix
	case last == nil:
		return false, "the proxy's bouncer has never pulled CrowdSec's decisions, so bans are not enforced: rebuild the proxy (homelab update nginx-proxy-manager), and if that does not help, " + fix
	case now.Sub(*last) > MaxPullAge:
		return false, fmt.Sprintf("the proxy's bouncer last pulled CrowdSec's decisions %s ago, so new bans are not enforced: check homelab logs nginx-proxy-manager for CrowdSec errors; for a rejected key, %s", age(now.Sub(*last)), fix)
	}
	return true, fmt.Sprintf("CrowdSec: the proxy's bouncer pulled decisions %s ago", age(now.Sub(*last)))
}

func age(d time.Duration) string {
	switch {
	case d < 0:
		return "0 seconds"
	case d < 2*time.Minute:
		return fmt.Sprintf("%d seconds", int(d.Seconds()))
	case d < 2*time.Hour:
		return fmt.Sprintf("%d minutes", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%d hours", int(d.Hours()))
	}
	return fmt.Sprintf("%d days", int(d.Hours()/24))
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	if len(s) > 120 {
		s = s[:120] + "…"
	}
	return s
}
