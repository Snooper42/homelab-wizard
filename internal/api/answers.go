package api

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/health"
)

// A running container is not the same as a working app: Status also asks
// each running app's web address on this machine, as the watchdog does
// (redirects and login pages count as answering; 5xx and no answer do not),
// so an app whose container runs but whose page is down shows at once.

// answerGrace is how long after starting an app may take to answer.
const answerGrace = 90 * time.Second

// answerTTL is how long a probe's result is reused: Status loads often.
const answerTTL = 15 * time.Second

// Answers asks each URL and returns, for those that did not answer, why
// ("connection refused", "HTTP 502"). Tests replace it.
var Answers = func(ctx context.Context, urls []string) map[string]string {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	out := map[string]string{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, u := range urls {
		if why, ok := answerCache.get(u); ok {
			if why != "" {
				out[u] = why
			}
			continue
		}
		wg.Add(1)
		go func(u string) {
			defer wg.Done()
			why := ""
			if r := health.Check(ctx, http.DefaultClient, u, u); !r.OK() {
				why = r.Problem()
			}
			answerCache.put(u, why)
			if why != "" {
				mu.Lock()
				out[u] = why
				mu.Unlock()
			}
		}(u)
	}
	wg.Wait()
	return out
}

// answerCache keeps each URL's last answer for answerTTL.
var answerCache = &answers{seen: map[string]answer{}}

type answer struct {
	why string
	at  time.Time
}

type answers struct {
	mu   sync.Mutex
	seen map[string]answer
}

func (a *answers) get(u string) (string, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if s, ok := a.seen[u]; ok && time.Since(s.at) < answerTTL {
		return s.why, true
	}
	return "", false
}

func (a *answers) put(u, why string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.seen[u] = answer{why, time.Now()}
}

// Probe asks the pages of apps that StatusRemembered left to be asked, and
// sets their NotAnswering (empty for one that answers).
func Probe(ctx context.Context, apps []AppStatus) { probe(ctx, apps, time.Now()) }

// remembered sets NotAnswering from the answers kept, without asking, and
// reports whether some app's page is still to be asked.
func remembered(apps []AppStatus, now time.Time) (pending bool) {
	for i := range apps {
		if !Askable(apps[i], now) {
			continue
		}
		if why, ok := answerCache.get(apps[i].URL); ok {
			apps[i].NotAnswering = why
		} else {
			pending = true
		}
	}
	return pending
}

// probe sets NotAnswering on the running container apps whose web address
// on this machine does not answer, past their first answerGrace.
func probe(ctx context.Context, apps []AppStatus, now time.Time) {
	var urls []string
	for _, s := range apps {
		if Askable(s, now) {
			urls = append(urls, s.URL)
		}
	}
	if len(urls) == 0 {
		return
	}
	why := Answers(ctx, urls)
	for i := range apps {
		if Askable(apps[i], now) {
			apps[i].NotAnswering = why[apps[i].URL]
		}
	}
}

// Askable says whether s is an app whose page Status asks: a running
// container app with an address, past its first answerGrace.
func Askable(s AppStatus, now time.Time) bool {
	if s.State != "running" || s.URL == "" || s.Health == "native" || s.Health == "starting" || s.Health == "restarting" {
		return false
	}
	started, err := time.Parse(time.RFC3339, s.Since)
	return err != nil || now.Sub(started) >= answerGrace
}
