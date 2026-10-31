package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestFollowHome(t *testing.T) {
	rewrites := map[string]string{"*.example.com": "192.168.1.10"}
	agSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/control/rewrite/list":
			var list []map[string]string
			for d, a := range rewrites {
				list = append(list, map[string]string{"domain": d, "answer": a})
			}
			_ = json.NewEncoder(w).Encode(list)
		case "/control/rewrite/update":
			var in map[string]map[string]string
			_ = json.NewDecoder(r.Body).Decode(&in)
			rewrites[in["update"]["domain"]] = in["update"]["answer"]
		}
	}))
	defer agSrv.Close()
	record := map[string]any{"id": "r1", "type": "A", "content": "192.168.1.10", "proxied": false, "comment": domain.HomeComment}
	cfSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok := func(v any) { _ = json.NewEncoder(w).Encode(map[string]any{"success": true, "result": v}) }
		body, _ := io.ReadAll(r.Body)
		switch {
		case r.URL.Path == "/zones":
			ok([]map[string]string{{"id": "z1"}})
		case r.Method == http.MethodGet:
			ok([]map[string]any{record})
		case r.Method == http.MethodPut:
			_ = json.Unmarshal(body, &record)
			ok(record)
		}
	}))
	defer cfSrv.Close()
	cloudflareAPI = cfSrv.URL
	defer func() { cloudflareAPI = "https://api.cloudflare.com/client/v4" }()
	ip := "192.168.1.10"
	lanAddress = func() (string, error) { return ip, nil }
	defer func() { lanAddress = domain.LANAddress }()

	agURL, _ := url.Parse(agSrv.URL)
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: io.Discard}, root)
	if err != nil {
		t.Fatal(err)
	}
	env := map[string]string{"HOMELAB_DOMAIN": "example.com", "CLOUDFLARE_API_TOKEN": "cf", "ADGUARD_PORT": agURL.Port(), "ADGUARD_USER": "admin", "ADGUARD_PASSWORD": "pw"}
	ctx := context.Background()
	path := domain.HomePath(root)

	// Before domain setup has written the names, nothing moves.
	if moved := h.followHome(ctx, env); moved != nil {
		t.Fatalf("nothing written yet: %v", moved)
	}
	if err := (domain.Home{Address: "192.168.1.10", Network: "192.168.1.0/24", AdGuard: true, Cloudflare: true}).Save(path); err != nil {
		t.Fatal(err)
	}
	if moved := h.followHome(ctx, env); moved != nil {
		t.Fatalf("the same address: %v", moved)
	}

	// The router gave this machine a new address: both names follow.
	ip = "192.168.1.23"
	moved := h.followHome(ctx, env)
	if len(moved) != 2 || !strings.Contains(strings.Join(moved, "\n"), "*.example.com → 192.168.1.23") {
		t.Fatalf("moved: %v", moved)
	}
	if rewrites["*.example.com"] != "192.168.1.23" || record["content"] != "192.168.1.23" || domain.LoadHome(path).Address != "192.168.1.23" {
		t.Fatalf("rewrites %v, record %v, saved %+v", rewrites, record, domain.LoadHome(path))
	}

	// Away from home (another network), the names stay.
	ip = "10.0.0.5"
	if moved := h.followHome(ctx, env); moved != nil || record["content"] != "192.168.1.23" {
		t.Fatalf("away from home: %v %v", moved, record)
	}
}
