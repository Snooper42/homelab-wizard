package domain

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

// fakeZone answers Cloudflare's DNS records API for zone z1 of
// example.com, keeping the records by name.
func fakeZone(t *testing.T, records map[string]map[string]any) *Cloudflare {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok := func(v any) { _ = json.NewEncoder(w).Encode(map[string]any{"success": true, "result": v}) }
		body, _ := io.ReadAll(r.Body)
		switch {
		case r.URL.Path == "/zones":
			ok([]map[string]string{{"id": "z1"}})
		case r.URL.Path == "/zones/z1/dns_records" && r.Method == http.MethodGet:
			if rec, found := records[r.URL.Query().Get("name")]; found {
				ok([]map[string]any{rec})
				return
			}
			ok([]any{})
		case r.Method == http.MethodPost || r.Method == http.MethodPut:
			var rec map[string]any
			_ = json.Unmarshal(body, &rec)
			rec["id"] = rec["name"]
			records[rec["name"].(string)] = rec
			ok(rec)
		default:
			w.WriteHeader(404)
		}
	}))
	t.Cleanup(srv.Close)
	cf := NewCloudflare("tok")
	cf.BaseURL = srv.URL
	return cf
}

func TestHomeRecord(t *testing.T) {
	ctx := context.Background()
	records := map[string]map[string]any{}
	cf := fakeZone(t, records)
	if action, err := HomeRecord(ctx, cf, "example.com", "192.168.1.10"); err != nil || action != "created" {
		t.Fatalf("first: %s %v", action, err)
	}
	rec := records["*.example.com"]
	if rec["type"] != "A" || rec["content"] != "192.168.1.10" || rec["proxied"] != false || rec["comment"] != HomeComment {
		t.Fatalf("record: %+v", rec)
	}
	if action, err := HomeRecord(ctx, cf, "example.com", "192.168.1.10"); err != nil || action != "unchanged" {
		t.Fatalf("again: %s %v", action, err)
	}
	if action, err := HomeRecord(ctx, cf, "example.com", "192.168.1.23"); err != nil || action != "updated" || records["*.example.com"]["content"] != "192.168.1.23" {
		t.Fatalf("moved: %s %v %+v", action, err, records["*.example.com"])
	}

	// One made by hand for the home address becomes homelab's.
	records["*.example.com"] = map[string]any{"id": "r1", "type": "A", "content": "192.168.1.23", "proxied": false}
	if action, err := HomeRecord(ctx, cf, "example.com", "192.168.1.23"); err != nil || action != "updated" || records["*.example.com"]["comment"] != HomeComment {
		t.Fatalf("by hand: %s %v", action, err)
	}

	// Someone else's: a public address, or another kind of record.
	for _, other := range []map[string]any{
		{"id": "r2", "type": "A", "content": "203.0.113.7", "proxied": true},
		{"id": "r3", "type": "CNAME", "content": "elsewhere.example.net"},
	} {
		records["*.example.com"] = other
		if _, err := HomeRecord(ctx, cf, "example.com", "192.168.1.10"); err == nil || !strings.Contains(err.Error(), "left as it is") {
			t.Errorf("%v should be left alone: %v", other, err)
		}
		if records["*.example.com"]["content"] != other["content"] {
			t.Errorf("%v was changed", other)
		}
	}
}

func TestHomeFollows(t *testing.T) {
	h := Home{Address: "192.168.1.10", Network: "192.168.1.0/24"}
	for ip, want := range map[string]bool{
		"192.168.1.23": true,  // a new address from the same router
		"192.168.1.10": false, // the same
		"10.0.0.5":     false, // away from home, or a new router
		"":             false,
	} {
		if got := h.Follows(ip); got != want {
			t.Errorf("Follows(%q) = %v, want %v", ip, got, want)
		}
	}
	if (Home{}).Follows("192.168.1.23") {
		t.Error("nothing written yet: nothing to follow")
	}
}

func TestHomeSaveLoad(t *testing.T) {
	path := HomePath(t.TempDir())
	if h := LoadHome(path); h.Address != "" {
		t.Fatalf("nothing yet: %+v", h)
	}
	want := Home{Address: "192.168.1.10", Network: NetworkOf("192.168.1.10"), AdGuard: true, Cloudflare: true}
	if err := want.Save(path); err != nil {
		t.Fatal(err)
	}
	if got := LoadHome(path); got != want || filepath.Base(path) != "home-address.json" {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	if want.Network != "192.168.1.0/24" {
		t.Errorf("an address on no interface is taken as a /24: %s", want.Network)
	}
}
