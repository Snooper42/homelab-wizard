//go:build realdocker

package realdocker

import (
	"errors"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// TestTheCatalogStarts installs each catalog app the life run does not
// cover, one at a time on a homelab of its own, and waits for it to run
// and answer: its page with no server error, or, without a page, its
// container still running a minute on. Each night takes a seventh of them
// (REALDOCKER_CATALOG=<n>/7, by the day of the week), so every app is
// shown to start against real Docker at least once a week (1.0's bar).
// Unset, it is skipped: the life run is the pull requests' test.
func TestTheCatalogStarts(t *testing.T) {
	spec := os.Getenv("REALDOCKER_CATALOG")
	if spec == "" {
		t.Skip("REALDOCKER_CATALOG is not set (n/of: the nth share of the catalog)")
	}
	n, of, err := share(spec)
	if err != nil {
		t.Fatal(err)
	}
	l := newLab(t)
	cat, err := catalog.Load(l.root)
	if err != nil {
		t.Fatal(err)
	}
	ids := catalogShare(cat, n, of)
	t.Logf("share %d of %d: %s", n, of, strings.Join(ids, ", "))
	for _, id := range ids {
		a, _ := cat.Get(id)
		t.Run(id, func(t *testing.T) {
			l.t = t
			defer func() { l.t = t }()
			if missing := unmetRequires(cat, a); len(missing) > 0 {
				t.Skipf("can't start without %s, which only the person's own account gives", strings.Join(missing, " and "))
			}
			t.Cleanup(func() {
				if t.Failed() {
					// Why it stopped, in the run's log as well as the report.
					_, _ = l.try("logs", id)
					l.keepReport()
				}
				// The next app gets a homelab of its own, and the
				// runner its disk back (uninstall removes the images).
				_, _ = l.try("uninstall", "--data", "--apply")
			})
			l.run("install", id, "--apply")
			for _, key := range []string{"MEDIA_ROOT", "DOWNLOADS_ROOT", "IMMICH_UPLOAD_LOCATION"} {
				if dir := l.env(key); dir != "" {
					_ = os.MkdirAll(dir, 0o755)
				}
			}
			waitFor(t, id+" running and answering", 10*time.Minute, func() error { return started(l, id) })
			if l.status()[id].URL == "" {
				// No page: still running a minute on, not restarting.
				time.Sleep(time.Minute)
				if err := started(l, id); err != nil {
					t.Fatalf("a minute later: %v", err)
				}
			}
		})
	}
}

// started says whether an app runs, is past its health check's start, and
// answers on its page when it has one.
func started(l *lab, id string) error {
	s, ok := l.status()[id]
	switch {
	case !ok:
		return errors.New("not in status")
	case s.State != "running":
		return fmt.Errorf("state %q", s.State)
	case s.Health == "starting" || s.Health == "unhealthy" || s.Health == "restarting":
		return fmt.Errorf("health %q", s.Health)
	case s.URL == "":
		return nil
	}
	return answers(s.URL)
}

// catalogShare is the nth of every of apps, by id, that a person installs
// (not a helper another app brings, not a program of its own) and the
// life run does not already take through a homelab's life.
func catalogShare(cat *catalog.Catalog, n, of int) []string {
	covered := map[string]bool{}
	for _, a := range apps {
		covered[a.id] = true
	}
	var ids []string
	for _, a := range cat.Apps {
		if a.Internal() || a.Native() != nil || covered[a.ID] {
			continue
		}
		ids = append(ids, a.ID)
	}
	slices.Sort(ids)
	var out []string
	for i, id := range ids {
		if i%of == n {
			out = append(out, id)
		}
	}
	return out
}

// share reads n/of, 0 ≤ n < of.
func share(spec string) (n, of int, err error) {
	a, b, ok := strings.Cut(spec, "/")
	n, err1 := strconv.Atoi(a)
	of, err2 := strconv.Atoi(b)
	if !ok || err1 != nil || err2 != nil || of < 1 || n < 0 || n >= of {
		return 0, 0, fmt.Errorf("REALDOCKER_CATALOG=%q: want n/of, as 3/7", spec)
	}
	return n, of, nil
}

// unmetRequires are the settings an app, or one it waits for, cannot start
// without that only the person can give (a tunnel token, a VPN key), and
// .env.example leaves empty: qBittorrent waits for Gluetun's VPN key.
func unmetRequires(cat *catalog.Catalog, a *catalog.App) []string {
	var out []string
	seen := map[string]bool{}
	var walk func(a *catalog.App)
	walk = func(a *catalog.App) {
		if seen[a.ID] {
			return
		}
		seen[a.ID] = true
		for _, r := range a.Meta.Requires {
			if !slices.Contains(out, r) {
				out = append(out, r)
			}
		}
		for _, d := range a.DependsOn {
			if dep, ok := cat.Get(d); ok {
				walk(dep)
			}
		}
	}
	walk(a)
	return out
}
