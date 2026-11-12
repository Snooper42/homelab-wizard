package kopia

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// strictKopia answers as Kopia does with its CSRF checks on (N49): `/`
// sets a session cookie and carries the token made for it, and every API
// call needs both. restart gives it a new signing key, as Kopia started
// again does, so the sessions it gave out are no good.
type strictKopia struct {
	mu      sync.Mutex
	key     string
	signIns int
}

func (k *strictKopia) token(session string) string {
	h := hmac.New(sha256.New, []byte(k.key))
	h.Write([]byte(session))
	return hex.EncodeToString(h.Sum(nil))
}

func (k *strictKopia) restart() { k.mu.Lock(); k.key += "!"; k.mu.Unlock() }

func (k *strictKopia) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if u, pw, _ := r.BasicAuth(); u != "admin" || pw != "pw" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if r.URL.Path == "/" {
		k.signIns++
		session := fmt.Sprintf("s%d", k.signIns)
		http.SetCookie(w, &http.Cookie{Name: SessionCookie, Value: session})
		fmt.Fprintf(w, `<html><head><title>KopiaUI</title><meta name="kopia-csrf-token" content="%s" /></head></html>`, k.token(session))
		return
	}
	ck, err := r.Cookie(SessionCookie)
	if err != nil || r.Header.Get(TokenHeader) != k.token(ck.Value) {
		http.Error(w, "Invalid or missing CSRF token.", http.StatusUnauthorized)
		return
	}
	w.Write([]byte(`{"snapshots":[{"id":"a","rootID":"k1","startTime":"2026-10-01T03:45:00Z"}]}`))
}

func TestTheClientSignsInAsKopiasPageDoes(t *testing.T) {
	k := &strictKopia{key: "first"}
	srv := httptest.NewServer(k)
	t.Cleanup(srv.Close)
	c := New(srv.URL, "pw")
	ctx := context.Background()
	for i := range 3 {
		if s, err := c.Latest(ctx, "/source/appdata"); err != nil || s.RootID != "k1" {
			t.Fatalf("call %d with the session: %+v %v", i, s, err)
		}
	}
	if k.signIns != 1 {
		t.Errorf("signed in %d times for three calls: once is enough", k.signIns)
	}
	// Kopia started again: the old session is turned down, and the client
	// signs in once more and carries on.
	k.restart()
	if _, err := c.Latest(ctx, "/source/appdata"); err != nil {
		t.Fatalf("after Kopia restarted: %v", err)
	}
	if k.signIns != 2 {
		t.Errorf("signed in %d times after a restart, want 2", k.signIns)
	}
	// A wrong password is said as before.
	if _, err := New(srv.URL, "nope").Latest(ctx, "/source/appdata"); err == nil || !strings.Contains(err.Error(), "refused KOPIA_SERVER_PASSWORD") {
		t.Errorf("a wrong password: %v", err)
	}
	// Without the session (what a web page elsewhere could send with the
	// browser's kept password), Kopia refuses.
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/snapshots", strings.NewReader(`{}`))
	req.SetBasicAuth("admin", "pw")
	if resp, err := http.DefaultClient.Do(req); err != nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("a call with only the password was taken: %v %v", resp, err)
	}
}

// Call and Get go through the same session; a Kopia that turns down even a
// fresh one says so plainly, and one that doesn't answer says that.
func TestCallGetAndATurnedDownSession(t *testing.T) {
	k := &strictKopia{key: "first"}
	srv := httptest.NewServer(k)
	t.Cleanup(srv.Close)
	ctx := context.Background()
	c := New(srv.URL, "pw")
	var out struct {
		Snapshots []Snapshot `json:"snapshots"`
	}
	if err := c.Call(ctx, http.MethodGet, "snapshots", nil, &out); err != nil || len(out.Snapshots) != 1 {
		t.Fatalf("Call: %+v %v", out, err)
	}
	if b, err := c.Get(ctx, "objects/k1"); err != nil || !strings.Contains(string(b), "snapshots") {
		t.Fatalf("Get: %q %v", b, err)
	}
	if err := c.Call(ctx, http.MethodPost, "restore", map[string]any{"root": "k1"}, nil); err != nil {
		t.Fatalf("a POST with a body: %v", err)
	}

	// A page whose token is never right: the client signs in once more,
	// then says Kopia turned its session down.
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.SetCookie(w, &http.Cookie{Name: SessionCookie, Value: "s"})
			w.Write([]byte(`<head><meta name="kopia-csrf-token" content="00ff" /></head>`))
			return
		}
		http.Error(w, "Invalid or missing CSRF token.", http.StatusUnauthorized)
	}))
	t.Cleanup(bad.Close)
	if _, err := New(bad.URL, "pw").Get(ctx, "snapshots"); err == nil || !strings.Contains(err.Error(), "turned down its own session") {
		t.Errorf("a session never taken: %v", err)
	}
	stale := New(bad.URL, "pw")
	stale.session, stale.token = "old", "00"
	if _, err := stale.Get(ctx, "snapshots"); err == nil || !strings.Contains(err.Error(), "turned down its own session") {
		t.Errorf("a stale session, then a fresh one turned down: %v", err)
	}

	// Nothing answering at all.
	gone := httptest.NewServer(http.NotFoundHandler())
	url := gone.URL
	gone.Close()
	if _, err := New(url, "pw").Get(ctx, "snapshots"); err == nil || !strings.Contains(err.Error(), "does not answer") {
		t.Errorf("no Kopia: %v", err)
	}
	if err := New(url, "pw").Call(ctx, http.MethodPost, "restore", func() {}, nil); err == nil {
		t.Error("a body that can't be JSON was sent")
	}
}
