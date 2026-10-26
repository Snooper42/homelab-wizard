package sso

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// fakePocketID answers the admin API as Pocket ID does, keeping what it was
// sent; oldSecret is a version with one secret per client.
func fakePocketID(t *testing.T, oldSecret bool) (*PocketID, *[]string) {
	t.Helper()
	var calls []string
	users := map[string]User{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		calls = append(calls, r.Method+" "+r.URL.Path+" "+string(body))
		if r.Header.Get("X-API-Key") != "key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch {
		case r.Method == "GET" && r.URL.Path == "/api/oidc/clients/paperless":
			_, _ = io.WriteString(w, `{"id":"paperless"}`)
		case r.Method == "GET" && strings.HasPrefix(r.URL.Path, "/api/oidc/clients/"):
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "POST" && r.URL.Path == "/api/oidc/clients":
			_, _ = io.WriteString(w, `{"id":"immich-server","createdSecret":{"secret":"s3cret-made"}}`)
		case r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/secrets"):
			if oldSecret {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			_, _ = io.WriteString(w, `{"secret":"new-secret"}`)
		case r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/secret"):
			_, _ = io.WriteString(w, `{"secret":"old-api-secret"}`)
		case r.Method == "POST" && r.URL.Path == "/api/users":
			var u User
			_ = json.Unmarshal(body, &u)
			u.ID = "u-1"
			users[u.ID] = u
			_ = json.NewEncoder(w).Encode(u)
		case r.Method == "GET" && r.URL.Path == "/api/users/u-1":
			_ = json.NewEncoder(w).Encode(users["u-1"])
		case r.Method == "PUT" && r.URL.Path == "/api/users/u-1":
			var u User
			_ = json.Unmarshal(body, &u)
			users["u-1"] = u
		case r.Method == "POST" && r.URL.Path == "/api/users/u-1/one-time-access-token":
			_, _ = io.WriteString(w, `{"token":"tok123"}`)
		case r.URL.Path == "/api/broken":
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = io.WriteString(w, "database is locked\n")
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return NewPocketID(srv.URL+"/", "key"), &calls
}

func TestPocketIDClients(t *testing.T) {
	p, calls := fakePocketID(t, false)
	ctx := context.Background()
	if ok, err := p.HasClient(ctx, "paperless"); !ok || err != nil {
		t.Errorf("paperless: %v %v", ok, err)
	}
	if ok, err := p.HasClient(ctx, "mealie"); ok || err != nil {
		t.Errorf("a client Pocket ID does not have: %v %v", ok, err)
	}
	a, _ := Get("immich-server")
	secret, err := p.CreateClient(ctx, a.ID, "Immich", a.CallbackURLs("https://photos.example.com/"))
	if err != nil || secret != "s3cret-made" {
		t.Fatalf("CreateClient: %q %v", secret, err)
	}
	made := (*calls)[len(*calls)-1]
	for _, want := range []string{`"isPublic":false`, `"https://photos.example.com/auth/login"`, `"app.immich:///oauth-callback"`} {
		if !strings.Contains(made, want) {
			t.Errorf("the client was made without %s: %s", want, made)
		}
	}
	if s, err := p.NewSecret(ctx, "immich-server"); s != "new-secret" || err != nil {
		t.Errorf("NewSecret: %q %v", s, err)
	}
	old, _ := fakePocketID(t, true)
	if s, err := old.NewSecret(ctx, "immich-server"); s != "old-api-secret" || err != nil {
		t.Errorf("NewSecret on a Pocket ID with one secret per client: %q %v", s, err)
	}
}

func TestPocketIDUsers(t *testing.T) {
	p, _ := fakePocketID(t, false)
	ctx := context.Background()
	email := "anna@example.com"
	u, err := p.CreateUser(ctx, User{Username: "anna", Email: &email, FirstName: "Anna", DisplayName: "Anna Smith"})
	if err != nil || u.ID != "u-1" || u.Username != "anna" {
		t.Fatalf("CreateUser: %+v %v", u, err)
	}
	if err := p.SetDisabled(ctx, "u-1", true); err != nil {
		t.Fatal(err)
	}
	var back User
	if err := p.call(ctx, "GET", "/users/u-1", nil, &back); err != nil || !back.Disabled || back.Email == nil || *back.Email != email {
		t.Errorf("disabled, and the rest kept: %+v %v", back, err)
	}
	link, err := p.SignInLink(ctx, "https://sso.example.com/", "u-1", 24*time.Hour)
	if err != nil || link != "https://sso.example.com/lc/tok123" {
		t.Errorf("SignInLink: %q %v", link, err)
	}
}

func TestPocketIDErrors(t *testing.T) {
	p, _ := fakePocketID(t, false)
	ctx := context.Background()
	if err := p.call(ctx, "GET", "/broken", nil, nil); err == nil || !strings.Contains(err.Error(), "500 database is locked") {
		t.Errorf("a server error says what Pocket ID said: %v", err)
	}
	if err := p.call(ctx, "GET", "/nothing", nil, nil); !errors.Is(err, ErrNotFound) {
		t.Errorf("404: %v", err)
	}
	p.Key = "wrong"
	if _, err := p.HasClient(ctx, "paperless"); err == nil || !strings.Contains(err.Error(), "POCKET_ID_API_KEY") {
		t.Errorf("a refused key names the setting: %v", err)
	}
	if _, err := p.SignInLink(ctx, "https://sso.example.com", "u-1", time.Hour); err == nil {
		t.Error("no link without the key")
	}
	if err := p.SetDisabled(ctx, "u-1", true); err == nil {
		t.Error("SetDisabled without the key")
	}
	down := NewPocketID("http://127.0.0.1:1", "key")
	if _, err := down.CreateUser(ctx, User{Username: "x"}); err == nil {
		t.Error("Pocket ID not running")
	}
}

func TestEnvFiles(t *testing.T) {
	root := t.TempDir()
	path := EnvPath(root, "paperless")
	if path != filepath.Join(root, "data", "sso", "paperless.env") {
		t.Errorf("EnvPath %s", path)
	}
	kv := map[string]string{"PAPERLESS_APPS": "allauth.socialaccount.providers.openid_connect", "PAPERLESS_SOCIALACCOUNT_PROVIDERS": `{"openid_connect":{"APPS":[{"secret":"s"}]}}`}
	if err := WriteEnv(path, kv); err != nil {
		t.Fatal(err)
	}
	if fi, _ := os.Stat(path); runtime.GOOS != "windows" && fi.Mode().Perm() != 0o600 {
		t.Errorf("the file holds a client secret, so only this account reads it: %v", fi.Mode().Perm())
	}
	back, err := ReadEnv(path)
	if err != nil || len(back) != 2 || back["PAPERLESS_SOCIALACCOUNT_PROVIDERS"] != kv["PAPERLESS_SOCIALACCOUNT_PROVIDERS"] {
		t.Errorf("read back: %v %v", back, err)
	}
	if err := WriteEnv(path, map[string]string{"X": "a\nB=1"}); err == nil {
		t.Error("a value over two lines would add a setting")
	}
	if _, err := ReadEnv(filepath.Join(root, "none.env")); err == nil {
		t.Error("a missing file")
	}
	if _, ok := Get("no-such-app"); ok {
		t.Error("Get of an app with no sign-in")
	}
	c := Client{Issuer: "https://sso.example.com"}
	if c.WellKnown() != "https://sso.example.com/.well-known/openid-configuration" {
		t.Error(c.WellKnown())
	}
}
