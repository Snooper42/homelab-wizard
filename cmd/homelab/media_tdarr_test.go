package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// A Tdarr with no account yet gets one for Tidy Up, kept in .env; one with
// an account, or a homelab with a login for it already, is left alone.
func TestTdarrAccount(t *testing.T) {
	var asked []map[string]string
	open := true
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v2/public/auth/register" {
			t.Errorf("asked %s", r.URL.Path)
		}
		var b map[string]string
		json.NewDecoder(r.Body).Decode(&b)
		asked = append(asked, b)
		if !open {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"token": "tok"})
	}))
	defer srv.Close()
	port := srv.URL[strings.LastIndex(srv.URL, ":")+1:]
	saved := tdarrClient
	t.Cleanup(func() { tdarrClient = saved })
	tdarrClient = srv.Client()

	fakeDocker(t, nil) // a closed sign-up makes Tdarr again
	waited := tdarrStartWait
	t.Cleanup(func() { tdarrStartWait = waited })
	tdarrStartWait = 0
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: io.Discard}, root)
	if err != nil {
		t.Fatal(err)
	}
	get := func(k string) string { f, _ := envfile.Load(h.envFile); v, _ := f.Get(k); return v }
	env := map[string]string{"TDARR_PORT": port}
	h.tdarrAccount(context.Background(), env)
	if len(asked) != 1 || asked[0]["username"] != "homelab" || len(asked[0]["password"]) < 24 {
		t.Fatalf("the sign-up: %v", asked)
	}
	if get("TDARR_USER") != "homelab" || get("TDARR_PASSWORD") != asked[0]["password"] || env["TDARR_PASSWORD"] != asked[0]["password"] {
		t.Errorf(".env: %q; the engine's: %v", get("TDARR_USER"), env)
	}
	// A login already: nothing asked.
	h.tdarrAccount(context.Background(), env)
	if len(asked) != 1 {
		t.Error("asked again with a login in .env")
	}
	// Sign-up closed (an account made in Tdarr first): nothing kept.
	open = false
	env2 := map[string]string{"TDARR_PORT": port}
	h.setEnv("TDARR_USER", "")
	h.setEnv("TDARR_PASSWORD", "")
	h.tdarrAccount(context.Background(), env2)
	if len(asked) != 2 || get("TDARR_USER") != "" || env2["TDARR_USER"] != "" {
		t.Errorf("a closed sign-up kept something: %q %v", get("TDARR_USER"), env2)
	}
	if !tdarrJob("tdarr", "setup") || !tdarrJob("movies", "run") || !tdarrJob("tv", "collect") || tdarrJob("movies", "scan") || tdarrJob("music", "run") {
		t.Error("tdarrJob")
	}
}

// Tdarr 3 takes no sign-up (403, tried against 3.06). With no key or login
// for it, Tidy Up gives it one: TDARR_API_KEY, in Tdarr's own key shape
// (tapi_…), kept in .env, and Tdarr made again so it reads it (its
// seededApiKey); then Tidy Up signs in with it.
func TestTdarrGetsAKeyWhenItTakesNoSignUp(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()
	port := srv.URL[strings.LastIndex(srv.URL, ":")+1:]
	saved := tdarrClient
	t.Cleanup(func() { tdarrClient = saved })
	tdarrClient = srv.Client()
	calls := fakeDocker(t, nil)
	waited := tdarrStartWait
	t.Cleanup(func() { tdarrStartWait = waited })
	tdarrStartWait = 0
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: io.Discard}, root)
	if err != nil {
		t.Fatal(err)
	}
	env := map[string]string{"TDARR_PORT": port}
	h.tdarrAccount(context.Background(), env)
	f, _ := envfile.Load(h.envFile)
	key, _ := f.Get("TDARR_API_KEY")
	if !strings.HasPrefix(key, "tapi_") || len(key) < 30 || env["TDARR_API_KEY"] != key {
		t.Fatalf("key %q, the engine's %q", key, env["TDARR_API_KEY"])
	}
	if !strings.Contains(readCalls(t, calls), "--force-recreate tdarr") {
		t.Errorf("Tdarr wasn't made again to read its key:\n%s", readCalls(t, calls))
	}
	// A key already: nothing changes.
	h.tdarrAccount(context.Background(), env)
	if f, _ := envfile.Load(h.envFile); func() string { v, _ := f.Get("TDARR_API_KEY"); return v }() != key {
		t.Error("the key changed")
	}
}
