package crowdsec

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"time"
)

// AlertsCommand prints the last week's local alerts as JSON (the community
// blocklist's are left out).
var AlertsCommand = []string{"cscli", "alerts", "list", "-o", "json", "--since", "168h", "--limit", "0"}

// Attack is one CrowdSec alert: an address that tripped a scenario.
type Attack struct {
	Scenario string    `json:"scenario"` // e.g. http-probing, without the crowdsecurity/ prefix
	IP       string    `json:"ip"`
	Country  string    `json:"country,omitempty"` // two letters
	Network  string    `json:"network,omitempty"` // the address's AS name
	When     time.Time `json:"when"`
	Banned   bool      `json:"banned"` // a ban on it is still in force
}

// Protection is what the app shows about CrowdSec: whether bans reach the
// proxy, and what it caught this week.
type Protection struct {
	Enforced  bool     `json:"enforced"`
	Bouncer   string   `json:"bouncer"`   // Verdict's message
	Week      int      `json:"week"`      // alerts in the last 7 days
	BannedNow int      `json:"bannedNow"` // addresses with a ban in force
	Recent    []Attack `json:"recent"`    // newest first, at most MaxRecent
}

// MaxRecent is how many attacks Protection lists.
const MaxRecent = 5

type alert struct {
	Scenario  string `json:"scenario"`
	CreatedAt string `json:"created_at"`
	Source    struct {
		IP     string `json:"ip"`
		Value  string `json:"value"`
		Cn     string `json:"cn"`
		AsName string `json:"as_name"`
	} `json:"source"`
	Decisions []struct {
		Type     string `json:"type"`
		Duration string `json:"duration"` // time left; negative once expired
		Value    string `json:"value"`
	} `json:"decisions"`
}

// ParseAlerts reads `cscli alerts list -o json`, newest first.
func ParseAlerts(out []byte) ([]Attack, error) {
	var list []alert
	if err := json.Unmarshal(out, &list); err != nil {
		return nil, err
	}
	attacks := make([]Attack, 0, len(list))
	for _, a := range list {
		at := Attack{
			Scenario: strings.TrimPrefix(a.Scenario, "crowdsecurity/"),
			IP:       a.Source.IP,
			Country:  a.Source.Cn,
			Network:  a.Source.AsName,
		}
		if at.IP == "" {
			at.IP = a.Source.Value // a range, or a manual decision's value
		}
		at.When, _ = time.Parse(time.RFC3339, a.CreatedAt)
		for _, d := range a.Decisions {
			if left, err := time.ParseDuration(d.Duration); err == nil && left > 0 && d.Type == "ban" {
				at.Banned = true
			}
		}
		attacks = append(attacks, at)
	}
	sort.SliceStable(attacks, func(i, j int) bool { return attacks[i].When.After(attacks[j].When) })
	return attacks, nil
}

// Read asks CrowdSec for the bouncer and the week's alerts. exec runs a
// command inside the CrowdSec container.
func Read(ctx context.Context, exec func(ctx context.Context, args ...string) ([]byte, error), now time.Time) (Protection, error) {
	p := Protection{Recent: []Attack{}}
	out, err := exec(ctx, ListCommand...)
	if err != nil && len(out) == 0 {
		return p, err
	}
	p.Enforced, p.Bouncer = Verdict(out, now)
	out, err = exec(ctx, AlertsCommand...)
	if err != nil && len(out) == 0 {
		return p, err
	}
	attacks, err := ParseAlerts(out)
	if err != nil {
		return p, err
	}
	banned := map[string]bool{}
	for _, a := range attacks {
		if a.Banned {
			banned[a.IP] = true
		}
	}
	p.Week, p.BannedNow = len(attacks), len(banned)
	p.Recent = attacks[:min(len(attacks), MaxRecent)]
	return p, nil
}
