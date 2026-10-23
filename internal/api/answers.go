package api

import (
	"context"
	"net/http"
	"strings"
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
				why = plainProblem(r.Problem())
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

// plainProblem says a failed check in a few words: "HTTP 502", "nothing
// answers on its port", "no answer in time".
func plainProblem(p string) string {
	switch {
	case strings.Contains(p, "refused"):
		return "nothing answers on its port"
	case strings.Contains(p, "deadline") || strings.Contains(p, "timeout"):
		return "no answer in time"
	case strings.Contains(p, "reset"):
		return "the connection was reset"
	}
	return p
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

// probe sets NotAnswering on the running container apps whose web address
// on this machine does not answer, past their first answerGrace.
func probe(ctx context.Context, apps []AppStatus, now time.Time) {
	var urls []string
	for _, s := range apps {
		if askable(s, now) {
			urls = append(urls, s.URL)
		}
	}
	if len(urls) == 0 {
		return
	}
	why := Answers(ctx, urls)
	for i := range apps {
		if askable(apps[i], now) {
			apps[i].NotAnswering = why[apps[i].URL]
		}
	}
}

func askable(s AppStatus, now time.Time) bool {
	if s.State != "running" || s.URL == "" || s.Health == "native" || s.Health == "starting" || s.Health == "restarting" {
		return false
	}
	started, err := time.Parse(time.RFC3339, s.Since)
	return err != nil || now.Sub(started) >= answerGrace
}
