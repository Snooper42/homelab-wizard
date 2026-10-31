package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

func TestNewPassword(t *testing.T) {
	shape := regexp.MustCompile(`^[a-km-z2-9]{4}-[a-km-z2-9]{4}-[a-km-z2-9]{4}-[a-km-z2-9]{4}$`)
	seen := map[string]bool{}
	for i := 0; i < 50; i++ {
		p := NewPassword()
		if !shape.MatchString(p) || strings.ContainsAny(p, "lo01") {
			t.Fatalf("password %q", p)
		}
		if seen[p] {
			t.Fatalf("%q came twice", p)
		}
		seen[p] = true
	}
}

// fakeJellyfin keeps users by id; legacy answers only the old password
// path, as Jellyfin 10.9 does.
type fakeJellyfin struct {
	users     map[string]map[string]any // id -> {Name, Password, Policy}
	legacy    bool
	passwords []string // the paths passwords were set through
}

func (f *fakeJellyfin) serve(t *testing.T) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != `MediaBrowser Token="key"` {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		switch {
		case r.Method == "GET" && r.URL.Path == "/Users":
			var list []map[string]any
			for id, u := range f.users {
				list = append(list, map[string]any{"Id": id, "Name": u["Name"]})
			}
			_ = json.NewEncoder(w).Encode(list)
		case r.Method == "POST" && r.URL.Path == "/Users/New":
			id := "id-" + body["Name"].(string)
			f.users[id] = map[string]any{"Name": body["Name"], "Password": body["Password"], "Policy": map[string]any{"IsDisabled": false, "EnableAllFolders": true}}
			_ = json.NewEncoder(w).Encode(map[string]any{"Id": id})
		case r.Method == "POST" && r.URL.Path == "/Users/Password" && !f.legacy:
			f.users[r.URL.Query().Get("userId")]["Password"] = body["NewPw"]
			f.passwords = append(f.passwords, r.URL.Path)
		case r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/Password") && r.URL.Path != "/Users/Password":
			id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/Users/"), "/Password")
			f.users[id]["Password"] = body["NewPw"]
			f.passwords = append(f.passwords, r.URL.Path)
		case r.Method == "GET" && strings.HasPrefix(r.URL.Path, "/Users/"):
			_ = json.NewEncoder(w).Encode(f.users[strings.TrimPrefix(r.URL.Path, "/Users/")])
		case r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/Policy"):
			id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/Users/"), "/Policy")
			f.users[id]["Policy"] = body
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestJellyfin(t *testing.T) {
	ctx := context.Background()
	for _, legacy := range []bool{false, true} {
		f := &fakeJellyfin{users: map[string]map[string]any{"id-owner": {"Name": "Snooper42"}}, legacy: legacy}
		srv := f.serve(t)
		if err := NewJellyfin(srv.URL, "wrong").Check(ctx); !errors.Is(err, ErrNoAccess) {
			t.Fatalf("a wrong key: %v", err)
		}
		j := NewJellyfin(srv.URL, "key")
		if err := j.Check(ctx); err != nil {
			t.Fatal(err)
		}
		if id, found, err := j.Find(ctx, "snooper42"); err != nil || !found || id != "id-owner" {
			t.Fatalf("find, case aside: %s %v %v", id, found, err)
		}
		if _, found, _ := j.Find(ctx, "anna"); found {
			t.Fatal("anna is not there yet")
		}
		if err := j.Create(ctx, "anna", "pw-1"); err != nil {
			t.Fatal(err)
		}
		id, found, _ := j.Find(ctx, "Anna")
		if !found || f.users[id]["Password"] != "pw-1" {
			t.Fatalf("created: %v", f.users)
		}
		if err := j.SetPassword(ctx, id, "pw-2"); err != nil || f.users[id]["Password"] != "pw-2" {
			t.Fatalf("legacy %v: set password: %v %v", legacy, err, f.users[id])
		}
		if want := map[bool]string{false: "/Users/Password", true: "/Users/id-anna/Password"}[legacy]; f.passwords[len(f.passwords)-1] != want {
			t.Errorf("legacy %v: password set through %v, want %s", legacy, f.passwords, want)
		}
		if err := j.Disable(ctx, id); err != nil {
			t.Fatal(err)
		}
		if p := f.users[id]["Policy"].(map[string]any); p["IsDisabled"] != true || p["EnableAllFolders"] != true {
			t.Fatalf("disabled, keeping the rest of the policy: %v", p)
		}
	}
}

// fakeNavidrome keeps users by id; "admin-id" is the homelab's login.
func fakeNavidrome(t *testing.T, users map[string]map[string]any) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if r.URL.Path == "/auth/login" {
			for id, u := range users {
				if u["userName"] == body["username"] && u["password"] == body["password"] {
					_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "token": "tok-" + id, "isAdmin": u["isAdmin"]})
					return
				}
			}
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.Header.Get("X-ND-Authorization") != "Bearer tok-admin-id" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/api/user/")
		switch {
		case r.Method == "GET" && r.URL.Path == "/api/user":
			var list []map[string]any
			for id, u := range users {
				list = append(list, map[string]any{"id": id, "userName": u["userName"]})
			}
			_ = json.NewEncoder(w).Encode(list)
		case r.Method == "POST" && r.URL.Path == "/api/user":
			users["id-"+body["userName"].(string)] = body
			_ = json.NewEncoder(w).Encode(body)
		case r.Method == "GET":
			u := map[string]any{}
			for k, v := range users[id] {
				if k != "password" { // Navidrome never sends it
					u[k] = v
				}
			}
			_ = json.NewEncoder(w).Encode(u)
		case r.Method == "PUT":
			users[id] = body
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestNavidrome(t *testing.T) {
	ctx := context.Background()
	users := map[string]map[string]any{
		"admin-id": {"userName": "homelab", "password": "admin-pw", "isAdmin": true},
		"plain-id": {"userName": "kid", "password": "kid-pw", "isAdmin": false},
	}
	srv := fakeNavidrome(t, users)
	if err := NewNavidrome(srv.URL, "homelab", "wrong").Check(ctx); !errors.Is(err, ErrNoAccess) {
		t.Fatalf("a wrong password: %v", err)
	}
	if err := NewNavidrome(srv.URL, "kid", "kid-pw").Check(ctx); err == nil || !strings.Contains(err.Error(), "not an administrator") {
		t.Fatalf("not an admin: %v", err)
	}
	n := NewNavidrome(srv.URL, "homelab", "admin-pw")
	if err := n.Create(ctx, "anna", "pw-1"); err != nil {
		t.Fatal(err)
	}
	id, found, err := n.Find(ctx, "Anna")
	if err != nil || !found || users[id]["password"] != "pw-1" || users[id]["isAdmin"] != false {
		t.Fatalf("created: %v %v %v", found, err, users)
	}
	users[id]["libraryIds"] = []any{1.0}
	if err := n.SetPassword(ctx, id, "pw-2"); err != nil {
		t.Fatal(err)
	}
	if u := users[id]; u["password"] != "pw-2" || u["userName"] != "anna" || u["libraryIds"] == nil {
		t.Fatalf("a new password, the rest kept: %v", u)
	}
	if err := n.SetPassword(ctx, "admin-id", "x"); err == nil || !strings.Contains(err.Error(), "NAVIDROME_ADMIN_USER") {
		t.Fatalf("the homelab's own login stays: %v", err)
	}
	if err := n.Disable(ctx, id); err != nil || users[id]["password"] == "pw-2" || len(users[id]["password"].(string)) < 30 {
		t.Fatalf("disabled with an unknown password: %v %v", err, users[id])
	}
}
