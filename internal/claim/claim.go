// Package claim asks a public app, on this machine, whether it has its
// first account yet (Immich, Audiobookshelf, Komga, Navidrome, Calibre-Web).
package claim

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"time"
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

// Claimed says whether app, answering at base, has its first account,
// and if not, why it waits. An app no one can claim from the web has.
func Claimed(ctx context.Context, app, base string) (bool, string) {
	c, ok := claimChecks[app]
	if !ok {
		return true, ""
	}
	if base == "" {
		return false, "it cannot be asked whether it has its first account"
	}
	// Asked only on this machine: the question carries Calibre-Web's
	// default login, which must not go anywhere else.
	target, ok := onThisMachine(base, c.path)
	if !ok {
		return false, "it cannot be asked on this machine (127.0.0.1) whether it has its first account"
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
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

// onThisMachine is the address on this machine's loopback, at base's
// port, with path: the question is asked there and nowhere else. ok is
// false when base is not plain http to this machine (an app bound only to
// another address cannot be asked, and stays off the internet).
func onThisMachine(base, path string) (string, bool) {
	u, err := url.Parse(base)
	if err != nil || u.Scheme != "http" || u.User != nil {
		return "", false
	}
	if h := u.Hostname(); h != "localhost" && !(net.ParseIP(h) != nil && net.ParseIP(h).IsLoopback()) {
		return "", false
	}
	port, err := strconv.Atoi(u.Port())
	if err != nil || port < 1 || port > 65535 {
		return "", false
	}
	return "http://127.0.0.1:" + strconv.Itoa(port) + path, true
}
