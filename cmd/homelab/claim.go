package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/ports"
)

// Some public apps can be claimed from the web: Immich's first sign-up is
// its administrator, Audiobookshelf's first visitor sets the root password,
// Komga's claims the server, Navidrome's makes the admin, and Calibre-Web
// starts with admin/admin123. On the internet before the household has done
// that, the first stranger to open the address would own the app. So each
// goes through the tunnel only once it says it has its first account; one
// that cannot be asked waits too, and the next Set up the domain looks again.
type claimCheck struct {
	path  string
	field string         // a JSON boolean, true once claimed
	page  *regexp.Regexp // matches the page while it is not
	basic [2]string      // a login a fresh install takes, refused once claimed
}

var claimChecks = map[string]claimCheck{
	"immich-server":  {path: "/api/server/config", field: "isInitialized"},
	"audiobookshelf": {path: "/status", field: "isInit"},
	"komga":          {path: "/api/v1/claim", field: "isClaimed"},
	"navidrome":      {path: "/app/", page: regexp.MustCompile(`firstTime\\?"\s*:\s*true`)},
	"calibre-web":    {path: "/opds", basic: [2]string{"admin", "admin123"}},
}

// claimedAt says whether app, answering at base, has its first account,
// and if not, why it waits. An app no one can claim from the web has.
func claimedAt(ctx context.Context, app, base string) (bool, string) {
	c, ok := claimChecks[app]
	if !ok {
		return true, ""
	}
	if base == "" {
		return false, "it cannot be asked whether it has its first account"
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+c.path, nil)
	if err != nil {
		return false, err.Error()
	}
	if c.basic[0] != "" {
		req.SetBasicAuth(c.basic[0], c.basic[1])
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, "it did not answer whether it has its first account"
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	switch {
	case c.basic[0] != "":
		// The default login refused: it has been changed.
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			return true, ""
		}
		return false, "its default login (" + c.basic[0] + "/" + c.basic[1] + ") still works"
	case resp.StatusCode != http.StatusOK:
		return false, "it did not answer whether it has its first account"
	case c.page != nil:
		if c.page.Match(body) {
			return false, "no one has made its first account yet"
		}
		return true, ""
	}
	var v map[string]any
	if json.Unmarshal(body, &v) != nil {
		return false, "it did not answer whether it has its first account"
	}
	if done, _ := v[c.field].(bool); done {
		return true, ""
	}
	return false, "no one has made its first account yet"
}

// mayPublish says whether a running public app goes through the tunnel
// now, and if not, why.
func (h *homelab) mayPublish(ctx context.Context, a *catalog.App, env map[string]string) (bool, string) {
	if !publishable(a.ID, a.Public(), env) {
		return false, ""
	}
	lookup := compose.MapLookup(env)
	ok, why := claimedAt(ctx, a.ID, ports.WebURL(a, ports.AppBindings(a, lookup), lookup))
	if !ok {
		return false, a.Name() + " stays off the internet until it has its first account: " + why + ". Open it at home (or on the tailnet) and make it, then Set up the domain again"
	}
	return true, ""
}
