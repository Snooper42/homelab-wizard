// Package health checks URLs and remembers what was failing, so alerts are
// sent when something breaks or recovers rather than on every check.
package health

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	neturl "net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Result is one check.
type Result struct {
	Name   string
	URL    string
	Status int
	Err    error
}

// OK means the app answered. Redirects and login prompts count: the app is
// up. 5xx (including Cloudflare's 52x tunnel errors) and no answer do not.
func (r Result) OK() bool { return r.Err == nil && r.Status > 0 && r.Status < 500 }

// Problem describes a failed check.
func (r Result) Problem() string {
	if r.Err != nil {
		return r.Err.Error()
	}
	return fmt.Sprintf("HTTP %d", r.Status)
}

// Check requests url without following redirects.
func Check(ctx context.Context, client *http.Client, name, url string) Result {
	r := Result{Name: name, URL: url}
	c := *client
	c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		r.Err = err
		return r
	}
	resp, err := c.Do(req)
	if err != nil {
		r.Err = errors.Unwrap(err)
		if r.Err == nil {
			r.Err = err
		}
		r.Err = plain(r.Err)
		return r
	}
	resp.Body.Close()
	r.Status = resp.StatusCode
	return r
}

// plain says the usual ways a request fails in a few words: "nothing
// answers on its port", "no answer in time", "the connection was reset".
func plain(err error) error {
	p := err.Error()
	switch {
	case strings.Contains(p, "refused"):
		return errors.New("nothing answers on its port")
	case strings.Contains(p, "deadline") || strings.Contains(p, "timeout"):
		return errors.New("no answer in time")
	case strings.Contains(p, "reset"):
		return errors.New("the connection was reset")
	}
	return err
}

// State is what was failing at the last check, keyed by check name:
// confirmed failures, and checks that failed once and are waiting for a
// second run.
type State struct {
	Failing map[string]time.Time `json:"failing"`
	Pending map[string]int       `json:"pending,omitempty"`
	// The last run, for the desktop app: when, how many checks, and what
	// each failing check said.
	LastRun  time.Time         `json:"lastRun"`
	Checks   int               `json:"checks,omitempty"`
	Problems map[string]string `json:"problems,omitempty"`
	// Days counts each check's passing and total runs per day (local date),
	// for the last WeekDays days: how each app did this week.
	Days map[string]map[string][2]int `json:"days,omitempty"`
}

// WeekDays is how many days of runs Days keeps.
const WeekDays = 7

// Week is each check's share of passing runs over the kept days, 0 to 1.
func (s State) Week() map[string]float64 {
	out := map[string]float64{}
	for name, days := range s.Days {
		ok, all := 0, 0
		for _, c := range days {
			ok, all = ok+c[0], all+c[1]
		}
		if all > 0 {
			out[name] = float64(ok) / float64(all)
		}
	}
	return out
}

// StatePath is where the watchdog keeps its state in the homelab folder.
func StatePath(root string) string {
	return filepath.Join(root, "scripts", "logs", "watchdog-state.json")
}

// LoadState reads path; a missing file is an empty state.
func LoadState(path string) State {
	var s State
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &s)
	}
	if s.Failing == nil {
		s.Failing = map[string]time.Time{}
	}
	if s.Pending == nil {
		s.Pending = map[string]int{}
	}
	return s
}

// Forget drops a check from the state, as if it had never run: for an app
// taken out of the homelab, which is then neither missing nor failing.
func (s *State) Forget(name string) {
	delete(s.Failing, name)
	delete(s.Pending, name)
	delete(s.Problems, name)
	delete(s.Days, name)
}

// Save writes the state.
func (s State) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// Update records results and returns what newly failed and what recovered.
// A check counts as failed on its second failing run in a row, so a single
// blip (waking from sleep, Watchtower recreating a container) never alerts.
func (s *State) Update(results []Result, now time.Time) (failed []Result, recovered []string) {
	s.LastRun, s.Checks, s.Problems = now, len(results), map[string]string{}
	if s.Days == nil {
		s.Days = map[string]map[string][2]int{}
	}
	if s.Failing == nil {
		s.Failing = map[string]time.Time{}
	}
	if s.Pending == nil {
		s.Pending = map[string]int{}
	}
	day, oldest := now.Format("2006-01-02"), now.AddDate(0, 0, -(WeekDays-1)).Format("2006-01-02")
	seen := map[string]bool{}
	for _, r := range results {
		seen[r.Name] = true
		if s.Days[r.Name] == nil {
			s.Days[r.Name] = map[string][2]int{}
		}
		c := s.Days[r.Name][day]
		if r.OK() {
			c[0]++
		}
		c[1]++
		s.Days[r.Name][day] = c
		if !r.OK() {
			s.Problems[r.Name] = r.Problem()
		}
		_, was := s.Failing[r.Name]
		switch {
		case r.OK():
			delete(s.Pending, r.Name)
			if was {
				delete(s.Failing, r.Name)
				recovered = append(recovered, r.Name)
			}
		case was:
		case s.Pending[r.Name] > 0:
			delete(s.Pending, r.Name)
			s.Failing[r.Name] = now
			failed = append(failed, r)
		default:
			s.Pending[r.Name]++
		}
	}
	// Days past the week, and checks that no longer exist, are dropped quietly.
	for name, days := range s.Days {
		for d := range days {
			if d < oldest {
				delete(days, d)
			}
		}
		if len(days) == 0 {
			delete(s.Days, name)
		}
	}
	for name := range s.Failing {
		if !seen[name] {
			delete(s.Failing, name)
		}
	}
	for name := range s.Pending {
		if !seen[name] {
			delete(s.Pending, name)
		}
	}
	sort.Strings(recovered)
	return failed, recovered
}

// Failure is a check that has failed long enough to count.
type Failure struct {
	Name    string    `json:"name"`
	Problem string    `json:"problem"`
	Since   time.Time `json:"since"`
}

// Summary is the last run as the desktop app shows it.
type Summary struct {
	LastRun time.Time `json:"lastRun"` // zero when the watchdog has not run
	Checks  int       `json:"checks"`
	Failing []Failure `json:"failing"` // oldest first
	Pending int       `json:"pending"` // failed once; checked again on the next run
	// Week is each check's share of passing runs this week, 0 to 1.
	Week map[string]float64 `json:"week"`
	// Days are each check's passing and total runs per day (local date,
	// 2006-01-02) this week: an app's page draws them as the week's bars.
	Days map[string]map[string][2]int `json:"days,omitempty"`
}

// Summary lists the confirmed failures with what each said last.
func (s State) Summary() Summary {
	sum := Summary{LastRun: s.LastRun, Checks: s.Checks, Failing: []Failure{}, Pending: len(s.Pending), Week: s.Week(), Days: s.Days}
	for name, since := range s.Failing {
		sum.Failing = append(sum.Failing, Failure{Name: name, Problem: s.Problems[name], Since: since})
	}
	sort.Slice(sum.Failing, func(i, j int) bool {
		a, b := sum.Failing[i], sum.Failing[j]
		return a.Since.Before(b.Since) || a.Since.Equal(b.Since) && a.Name < b.Name
	})
	return sum
}

// Confirmed reports whether a check has failed long enough to count.
func (s State) Confirmed(name string) bool {
	_, ok := s.Failing[name]
	return ok
}

// Heartbeat reports a watchdog run to an external monitor such as
// healthchecks.io: the URL when every check passed, URL/fail otherwise, with
// the failures as the body. The monitor alerts when pings stop arriving,
// which covers this machine, its runtime, or its network being down.
func Heartbeat(ctx context.Context, client *http.Client, url string, failures []string) error {
	target := strings.TrimRight(url, "/")
	if len(failures) > 0 {
		target += "/fail"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, strings.NewReader(strings.Join(failures, "\n")))
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		// The URL is a credential: report only what went wrong.
		var ue *neturl.Error
		if errors.As(err, &ue) {
			return fmt.Errorf("heartbeat: %w", ue.Err)
		}
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("heartbeat: %s", resp.Status)
	}
	return nil
}
