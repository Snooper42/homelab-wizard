package kopia

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func server(t *testing.T, h http.HandlerFunc) *Client {
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return New(srv.URL+"/", "pw")
}

func TestLatest(t *testing.T) {
	c := server(t, func(w http.ResponseWriter, r *http.Request) {
		if u, pw, _ := r.BasicAuth(); u != "admin" || pw != "pw" {
			t.Errorf("signed in as %q/%q", u, pw)
		}
		if r.URL.Query().Get("path") == "/source/empty" {
			w.Write([]byte(`{"snapshots":[]}`))
			return
		}
		w.Write([]byte(`{"snapshots":[{"id":"b","rootID":"k2","startTime":"2026-10-10T03:45:00Z"},{"id":"a","rootID":"k1","startTime":"2026-10-01T03:45:00Z"}]}`))
	})
	s, err := c.Latest(context.Background(), "/source/appdata")
	if err != nil || s.RootID != "k2" {
		t.Fatalf("the newest is k2: %+v %v", s, err)
	}
	if _, err := c.Latest(context.Background(), "/source/empty"); err == nil || !strings.Contains(err.Error(), "no snapshot of /source/empty yet") {
		t.Fatalf("no snapshots: %v", err)
	}
}

func TestErrors(t *testing.T) {
	c := server(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/snapshots":
			w.WriteHeader(http.StatusUnauthorized)
		case "/api/v1/objects/k1":
			w.Write([]byte(`{"entries":[{"name":"vikunja","obj":"k3"}]}`))
		default:
			http.Error(w, "not connected", http.StatusInternalServerError)
		}
	})
	ctx := context.Background()
	if _, err := c.Latest(ctx, "/source/appdata"); err == nil || !strings.Contains(err.Error(), "refused KOPIA_SERVER_PASSWORD") {
		t.Errorf("a wrong password: %v", err)
	}
	if _, err := c.Find(ctx, "k1", "mealie/data"); err == nil || !strings.Contains(err.Error(), "mealie/data is not in the snapshot") {
		t.Errorf("missing: %v", err)
	}
	if _, err := c.Find(ctx, "k1", "vikunja/db"); err == nil || !strings.Contains(err.Error(), "500 Internal Server Error not connected") {
		t.Errorf("the server's own words: %v", err)
	}
	if err := c.Restore(ctx, "k3", "/staging/restore-test/x", time.Minute); err == nil || !strings.Contains(err.Error(), "not connected") {
		t.Errorf("a refused restore: %v", err)
	}
	c.Base = "http://127.0.0.1:1"
	if _, err := c.Latest(ctx, "/source/appdata"); err == nil || !strings.Contains(err.Error(), "Kopia does not answer") {
		t.Errorf("no server: %v", err)
	}
}

func TestFindAndRestore(t *testing.T) {
	status := "RUNNING"
	polls := 0
	c := server(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/objects/k1":
			w.Write([]byte(`{"entries":[{"name":"mealie","obj":"k2"},{"name":"vikunja","obj":"k3"}]}`))
		case "/api/v1/objects/k3":
			w.Write([]byte(`{"entries":[{"name":"vikunja.db","obj":"k4"}]}`))
		case "/api/v1/restore":
			w.Write([]byte(`{"id":"t1"}`))
		case "/api/v1/tasks/t1":
			if polls++; polls > 1 {
				w.Write([]byte(`{"status":"` + status + `","errorMessage":"disk full"}`))
				return
			}
			w.Write([]byte(`{"status":"RUNNING"}`))
		}
	})
	ctx := context.Background()
	obj, err := c.Find(ctx, "k1", "vikunja/vikunja.db")
	if err != nil || obj != "k4" {
		t.Fatalf("vikunja/vikunja.db is k4: %q %v", obj, err)
	}
	status = "SUCCESS"
	if err := c.Restore(ctx, obj, "/staging/restore-test/vikunja/vikunja.db", time.Minute); err != nil {
		t.Fatalf("restored after a second: %v", err)
	}
	status, polls = "FAILED", 2
	if err := c.Restore(ctx, obj, "/staging/x", time.Minute); err == nil || !strings.Contains(err.Error(), "ended failed: disk full") {
		t.Fatalf("a failed restore: %v", err)
	}
	status, polls = "RUNNING", 2
	if err := c.Restore(ctx, obj, "/staging/x", 0); err == nil || !strings.Contains(err.Error(), "did not finish within") {
		t.Fatalf("a restore that never ends: %v", err)
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if err := c.Restore(cancelled, obj, "/staging/x", time.Minute); err == nil {
		t.Fatal("a cancelled restore should stop")
	}
}
