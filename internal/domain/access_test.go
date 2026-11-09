package domain

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

// fakeAccess is Cloudflare's Access API for one account, as far as the
// homelab uses it.
type fakeAccess struct {
	authDomain string
	tokens     []map[string]any
	apps       []map[string]any
	policies   map[string][]map[string]any // by app ID
	deleted    []string
	refuse     bool
}

func (f *fakeAccess) serve(t *testing.T) *Cloudflare {
	t.Helper()
	f.policies = map[string][]map[string]any{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok := func(v any) { _ = json.NewEncoder(w).Encode(map[string]any{"success": true, "result": v}) }
		if f.refuse {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "errors": []map[string]any{{"message": "Authentication error"}}})
			return
		}
		body, _ := io.ReadAll(r.Body)
		var in map[string]any
		_ = json.Unmarshal(body, &in)
		base := "/accounts/acct/access"
		p := r.URL.Path
		switch {
		case p == base+"/organizations":
			ok(map[string]string{"auth_domain": f.authDomain})
		case p == base+"/service_tokens" && r.Method == http.MethodGet:
			var out []map[string]any
			for _, tk := range f.tokens {
				out = append(out, map[string]any{"id": tk["id"], "name": tk["name"], "client_id": tk["client_id"]}) // never the secret
			}
			ok(out)
		case p == base+"/service_tokens" && r.Method == http.MethodPost:
			n := strconv.Itoa(len(f.tokens) + 1)
			tk := map[string]any{"id": "tok-" + n, "name": in["name"], "client_id": "client-" + n + ".access", "client_secret": "secret-" + n}
			f.tokens = append(f.tokens, tk)
			ok(tk)
		case p == base+"/apps" && r.Method == http.MethodGet:
			ok(f.apps)
		case p == base+"/apps" && r.Method == http.MethodPost:
			n := strconv.Itoa(len(f.apps) + 1)
			app := map[string]any{"id": "app-" + n, "aud": "aud-" + n, "domain": in["domain"], "name": in["name"], "type": in["type"]}
			f.apps = append(f.apps, app)
			ok(app)
		case strings.HasPrefix(p, base+"/apps/") && strings.HasSuffix(p, "/policies"):
			app := strings.TrimSuffix(strings.TrimPrefix(p, base+"/apps/"), "/policies")
			if r.Method == http.MethodPost {
				in["id"] = "pol-" + strconv.Itoa(len(f.policies[app])+1) + "-" + app
				f.policies[app] = append(f.policies[app], in)
			}
			ok(f.policies[app])
		case strings.HasPrefix(p, base+"/apps/") && strings.Contains(p, "/policies/") && r.Method == http.MethodDelete:
			parts := strings.Split(p, "/")
			app, id := parts[5], parts[7]
			var keep []map[string]any
			for _, pol := range f.policies[app] {
				if pol["id"] != id {
					keep = append(keep, pol)
				}
			}
			f.policies[app] = keep
			f.deleted = append(f.deleted, id)
			ok(map[string]string{"id": id})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	cf := NewCloudflare("tok")
	cf.BaseURL = srv.URL
	return cf
}

// Lock 1 of away from home: Access in front of the companion's hostname,
// letting in only the household's service token; run again, nothing that
// is right changes, and anything else let in is taken out.
func TestSetUpAway(t *testing.T) {
	f := &fakeAccess{authDomain: "household.cloudflareaccess.com"}
	cf := f.serve(t)
	ctx := context.Background()
	host := "homelab-away.example.com"

	away, err := SetUpAway(ctx, cf, "acct", host, Away{})
	if err != nil {
		t.Fatal(err)
	}
	if away.Team != "household" || away.AUD != "aud-1" || away.ClientID != "client-1.access" || away.Secret != "secret-1" || len(away.Made) != 3 {
		t.Fatalf("first run: %+v", away)
	}
	if pol := f.policies["app-1"]; len(pol) != 1 || pol[0]["decision"] != "non_identity" || !strings.Contains(mustJSON(pol[0]["include"]), `"token_id":"tok-1"`) {
		t.Fatalf("the policy: %+v", pol)
	}
	if f.apps[0]["type"] != "self_hosted" || f.apps[0]["domain"] != host {
		t.Fatalf("the application: %+v", f.apps[0])
	}

	// Again, with what .env keeps: nothing made.
	again, err := SetUpAway(ctx, cf, "acct", host, Away{ClientID: away.ClientID, Secret: away.Secret})
	if err != nil || len(again.Made) != 0 || again.Secret != "secret-1" || len(f.tokens) != 1 || len(f.apps) != 1 {
		t.Fatalf("second run: %+v %v (tokens %d, apps %d)", again, err, len(f.tokens), len(f.apps))
	}

	// Someone added a policy letting everyone in: it goes, and the
	// household's token's stays.
	f.policies["app-1"] = append(f.policies["app-1"], map[string]any{"id": "pol-everyone", "decision": "allow", "include": []map[string]any{{"everyone": map[string]any{}}}})
	if _, err := SetUpAway(ctx, cf, "acct", host, Away{ClientID: away.ClientID, Secret: away.Secret}); err != nil {
		t.Fatal(err)
	}
	if len(f.deleted) != 1 || f.deleted[0] != "pol-everyone" || len(f.policies["app-1"]) != 1 {
		t.Fatalf("a policy letting others in: deleted %v, left %+v", f.deleted, f.policies["app-1"])
	}

	// The secret lost from .env: Cloudflare never shows it again, so a new
	// token is made, and only it is let in.
	lost, err := SetUpAway(ctx, cf, "acct", host, Away{ClientID: away.ClientID})
	if err != nil || lost.ClientID != "client-2.access" || lost.Secret != "secret-2" {
		t.Fatalf("with the secret lost: %+v %v", lost, err)
	}
	if pol := f.policies["app-1"]; len(pol) != 1 || !strings.Contains(mustJSON(pol[0]["include"]), `"token_id":"tok-2"`) {
		t.Fatalf("after a new token, the policy: %+v", pol)
	}
}

func TestSetUpAwayRefusals(t *testing.T) {
	ctx := context.Background()
	// Zero Trust not set up: no team yet.
	f := &fakeAccess{authDomain: ""}
	if _, err := SetUpAway(ctx, f.serve(t), "acct", "h.example.com", Away{}); err == nil || !strings.Contains(err.Error(), "Zero Trust") {
		t.Fatalf("no team: %v", err)
	}
	// The token without Access's permissions: said which to add.
	f = &fakeAccess{authDomain: "household.cloudflareaccess.com", refuse: true}
	_, err := SetUpAway(ctx, f.serve(t), "acct", "h.example.com", Away{})
	if err = AccessRefused(err); err == nil || !strings.Contains(err.Error(), "Access: Service Tokens") {
		t.Fatalf("refused: %v", err)
	}
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
