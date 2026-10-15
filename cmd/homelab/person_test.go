package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/people"
)

func TestPersonAddAndRemove(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "pocket-id", Image: "ghcr.io/pocket-id/pocket-id:v2", Running: true, Project: "homelab_security", Service: "pocket-id"},
		{Name: "immich-server", Image: "ghcr.io/immich-app/immich-server:v3", Running: true, Project: "homelab_immich", Service: "immich-server"},
		{Name: "vaultwarden", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
	})
	users := map[string]map[string]any{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-Key") != "the-api-key-0123456789" {
			w.WriteHeader(401)
			return
		}
		switch {
		case r.Method == "POST" && r.URL.Path == "/api/users":
			var u map[string]any
			_ = json.NewDecoder(r.Body).Decode(&u)
			u["id"] = "u-1"
			users["u-1"] = u
			w.WriteHeader(201)
			_ = json.NewEncoder(w).Encode(u)
		case r.Method == "POST" && r.URL.Path == "/api/users/u-1/one-time-access-token":
			w.WriteHeader(201)
			_, _ = w.Write([]byte(`{"token":"abcdef123456"}`))
		case r.Method == "GET" && r.URL.Path == "/api/users/u-1":
			_ = json.NewEncoder(w).Encode(users["u-1"])
		case r.Method == "PUT" && r.URL.Path == "/api/users/u-1":
			var u map[string]any
			_ = json.NewDecoder(r.Body).Decode(&u)
			users["u-1"] = u
			_ = json.NewEncoder(w).Encode(u)
		default:
			w.WriteHeader(404)
		}
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=example.com", "POCKET_ID_PORT="+u.Port(), "POCKET_ID_API_KEY=the-api-key-0123456789")

	out, code := homelabCmd(t, root, "", "person", "add", "Anna Smith", "--email", "anna@example.com", "--apply")
	if code != 0 {
		t.Fatalf("add (exit %d):\n%s", code, out)
	}
	if got := users["u-1"]; got["username"] != "anna" || got["firstName"] != "Anna" || got["lastName"] != "Smith" || got["email"] != "anna@example.com" {
		t.Errorf("Pocket ID got %v", got)
	}
	page, err := os.ReadFile(people.WelcomePath(root, "anna"))
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Welcome, Anna<", "https://id.example.com/lc/abcdef123456", "https://photos.example.com", "Phone app: Immich", "Bitwarden"} {
		if !strings.Contains(string(page), want) {
			t.Errorf("the welcome page lacks %q", want)
		}
	}
	if out, code := homelabCmd(t, root, "", "person", "add", "Anna Jones", "--apply"); code == 0 || !strings.Contains(out, "already") {
		t.Errorf("the same username twice (exit %d):\n%s", code, out)
	}
	if out, _ := homelabCmd(t, root, "", "person"); !strings.Contains(out, "anna@example.com") {
		t.Errorf("list:\n%s", out)
	}

	if out, code := homelabCmd(t, root, "", "person", "remove", "anna", "--apply"); code != 0 {
		t.Fatalf("remove (exit %d):\n%s", code, out)
	}
	if users["u-1"]["disabled"] != true || users["u-1"]["username"] != "anna" {
		t.Errorf("after remove Pocket ID has %v", users["u-1"])
	}
	list, _ := people.Load(people.Path(root))
	if len(list) != 1 || list[0].Active() {
		t.Errorf("household: %+v", list)
	}
	if _, err := os.Stat(filepath.Join(root, "data", "people", "anna.html")); err == nil {
		t.Error("the welcome page of someone removed is still there")
	}
}

func TestUsername(t *testing.T) {
	for in, want := range map[string]string{"Anna Smith": "anna", "  Zoë ": "zoe", "Søren Ås": "soren", "O'Brien": "obrien", "": ""} {
		if got := people.Username(in); got != want {
			t.Errorf("%q: %q, want %q", in, got, want)
		}
	}
}
