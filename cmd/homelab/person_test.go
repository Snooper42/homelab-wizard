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
	u, _ := url.Parse(fakePocketID(t, users).URL)
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

// fakePocketID answers Pocket ID's admin API for one user, u-1.
func fakePocketID(t *testing.T, users map[string]map[string]any) *httptest.Server {
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
	t.Cleanup(srv.Close)
	return srv
}

func TestPersonAppAccounts(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "pocket-id", Image: "ghcr.io/pocket-id/pocket-id:v2", Running: true, Project: "homelab_security", Service: "pocket-id"},
		{Name: "navidrome", Image: "deluan/navidrome:latest", Running: true, Project: "homelab_media", Service: "navidrome"},
	})
	pocket, _ := url.Parse(fakePocketID(t, map[string]map[string]any{}).URL)
	// Jellyfin and Navidrome, each keeping passwords by username.
	jf := map[string]string{"Snooper42": "owner-pw"}
	jfOff := map[string]bool{}
	jfSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != `MediaBrowser Token="jf-key"` {
			w.WriteHeader(401)
			return
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		switch {
		case r.URL.Path == "/Users":
			var list []map[string]string
			for name := range jf {
				list = append(list, map[string]string{"Id": name, "Name": name})
			}
			_ = json.NewEncoder(w).Encode(list)
		case r.URL.Path == "/Users/New":
			jf[body["Name"].(string)] = body["Password"].(string)
		case r.URL.Path == "/Users/Password":
			jf[r.URL.Query().Get("userId")] = body["NewPw"].(string)
		case strings.HasSuffix(r.URL.Path, "/Policy"):
			jfOff[strings.Split(r.URL.Path, "/")[2]] = body["IsDisabled"] == true
		case strings.HasPrefix(r.URL.Path, "/Users/"):
			_, _ = w.Write([]byte(`{"Policy":{"IsDisabled":false}}`))
		}
	}))
	defer jfSrv.Close()
	jellyfinAPI = jfSrv.URL
	defer func() { jellyfinAPI = "http://127.0.0.1:8096" }()
	nd := map[string]string{"homelab": "nd-admin"}
	ndSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		switch {
		case r.URL.Path == "/auth/login":
			if body["username"] != "homelab" || body["password"] != "nd-admin" {
				w.WriteHeader(401)
				return
			}
			_, _ = w.Write([]byte(`{"id":"homelab","token":"t","isAdmin":true}`))
		case r.Header.Get("X-ND-Authorization") != "Bearer t":
			w.WriteHeader(401)
		case r.Method == "GET" && r.URL.Path == "/api/user":
			var list []map[string]string
			for name := range nd {
				list = append(list, map[string]string{"id": name, "userName": name})
			}
			_ = json.NewEncoder(w).Encode(list)
		case r.Method == "POST":
			nd[body["userName"].(string)] = body["password"].(string)
		case r.Method == "GET":
			_ = json.NewEncoder(w).Encode(map[string]string{"userName": strings.TrimPrefix(r.URL.Path, "/api/user/")})
		case r.Method == "PUT":
			nd[body["userName"].(string)] = body["password"].(string)
		}
	}))
	defer ndSrv.Close()
	ndURL, _ := url.Parse(ndSrv.URL)
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=example.com", "POCKET_ID_PORT="+pocket.Port(), "POCKET_ID_API_KEY=the-api-key-0123456789",
		"JELLYFIN_API_KEY=jf-key", "NAVIDROME_ADMIN_USER=homelab", "NAVIDROME_ADMIN_PASSWORD=nd-admin", "NAVIDROME_PORT="+ndURL.Port())
	page := func() string { b, _ := os.ReadFile(people.WelcomePath(root, "anna")); return string(b) }

	out, code := homelabCmd(t, root, "", "person", "add", "Anna Smith", "--apply")
	if code != 0 || !strings.Contains(out, `Jellyfin: made the account "anna"`) || !strings.Contains(out, `Navidrome: made the account "anna"`) {
		t.Fatalf("add (exit %d):\n%s", code, out)
	}
	pw := jf["anna"]
	if pw == "" || nd["anna"] != pw || strings.Contains(out, pw) {
		t.Fatalf("one password for both, never printed: jellyfin %q, navidrome %q\n%s", pw, nd["anna"], out)
	}
	for _, want := range []string{"Apps with a password of their own", "<code>" + pw + "</code>", "https://jellyfin.example.com", "address jellyfin.example.com, port 443, HTTPS on", "https://navidrome.example.com", "music.example.com", "except the few with a password of their own"} {
		if !strings.Contains(page(), want) {
			t.Errorf("the welcome page lacks %q", want)
		}
	}

	// A new sign-in link: the logins are listed, the password is not.
	if out, code := homelabCmd(t, root, "", "person", "welcome", "anna"); code != 0 || strings.Contains(page(), pw) || !strings.Contains(page(), "the one you were given") {
		t.Fatalf("welcome (exit %d):\n%s", code, out)
	}

	// Reset password: one new password in both, on a fresh page.
	if out, code := homelabCmd(t, root, "", "person", "password", "anna", "--apply"); code != 0 || !strings.Contains(out, "Navidrome: anna has the new password") {
		t.Fatalf("password (exit %d):\n%s", code, out)
	}
	if jf["anna"] == pw || nd["anna"] != jf["anna"] || !strings.Contains(page(), "<code>"+jf["anna"]+"</code>") {
		t.Fatalf("new password: jellyfin %q, navidrome %q", jf["anna"], nd["anna"])
	}

	// Remove: Jellyfin's account is turned off, Navidrome's gets a password no one knows.
	before := nd["anna"]
	if out, code := homelabCmd(t, root, "", "person", "remove", "anna", "--apply"); code != 0 {
		t.Fatalf("remove (exit %d):\n%s", code, out)
	}
	if !jfOff["anna"] || nd["anna"] == before {
		t.Errorf("after remove: jellyfin off %v, navidrome changed %v", jfOff["anna"], nd["anna"] != before)
	}
	if jf["Snooper42"] != "owner-pw" || jfOff["Snooper42"] {
		t.Error("other accounts must be left alone")
	}
}

func TestUsername(t *testing.T) {
	for in, want := range map[string]string{"Anna Smith": "anna", "  Zoë ": "zoe", "Søren Ås": "soren", "O'Brien": "obrien", "": ""} {
		if got := people.Username(in); got != want {
			t.Errorf("%q: %q, want %q", in, got, want)
		}
	}
}
