package wiring

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeHost is an *arr app's config/host and sign-in page, as Sonarr 4
// serves them: the password reads ******** once one is set, and a refused
// sign-in redirects back with loginFailed.
type fakeHost struct {
	mu       sync.Mutex
	host     resource
	password string // what the app keeps (hashed, in the app)
	puts     int
	signIns  int
}

func newFakeHost(t *testing.T, key string, host resource, password string) (*fakeHost, string) {
	t.Helper()
	f := &fakeHost{host: host, password: password}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		if r.URL.Path == "/login" && r.Method == http.MethodPost {
			f.signIns++
			r.ParseForm()
			if f.password != "" && r.Form.Get("username") == f.host["username"] && r.Form.Get("password") == f.password {
				http.Redirect(w, r, "/", http.StatusFound)
			} else {
				http.Redirect(w, r, "/login?returnUrl=/&loginFailed=true", http.StatusFound)
			}
			return
		}
		if r.Header.Get("X-Api-Key") != key {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		switch {
		case strings.HasSuffix(r.URL.Path, "/system/status"):
			w.Write([]byte(`{}`))
		case r.URL.Path == "/api/v3/config/host" && r.Method == http.MethodGet:
			out := resource{}
			for k, v := range f.host {
				out[k] = v
			}
			out["password"], out["passwordConfirmation"] = "", ""
			if f.password != "" {
				out["password"] = "********"
			}
			json.NewEncoder(w).Encode(out)
		case r.URL.Path == "/api/v3/config/host/1" && r.Method == http.MethodPut:
			var body resource
			json.NewDecoder(r.Body).Decode(&body)
			if body["password"] != body["passwordConfirmation"] {
				http.Error(w, `[{"errorMessage":"Must match Password"}]`, http.StatusBadRequest)
				return
			}
			f.puts++
			f.password = body["password"].(string)
			delete(body, "password")
			delete(body, "passwordConfirmation")
			f.host = body
			w.WriteHeader(http.StatusAccepted)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return f, srv.URL
}

func loginWirer(t *testing.T, url, password string) *Wirer {
	return &Wirer{
		Apps: map[string]App{"sonarr": {ID: "sonarr", Name: "Sonarr", URL: url, ConfigDir: configDir(t, "skey")}},
		Env:  map[string]string{"ARR_PASSWORD": password},
		Wait: time.Second,
	}
}

func applyOne(t *testing.T, w *Wirer) Link {
	t.Helper()
	links := w.Apply(context.Background(), nil)
	for _, l := range links {
		if strings.HasPrefix(l.Text, "Sonarr signs in") {
			return l
		}
	}
	t.Fatalf("no sign-in link in %+v", links)
	return Link{}
}

// A fresh Sonarr (it would show "Authentication required") gets the
// login from .env, and a second run finds it with one sign-in and
// changes nothing.
func TestArrLoginFreshThenFound(t *testing.T) {
	f, url := newFakeHost(t, "skey", resource{"id": 1, "authenticationMethod": "none", "authenticationRequired": "enabled", "username": "", "port": 8989}, "")
	w := loginWirer(t, url, "s3cret-from-env")
	if l := applyOne(t, w); l.State != "done" || l.Detail != "" {
		t.Fatalf("first run: %+v", l)
	}
	if f.host["authenticationMethod"] != "forms" || f.host["authenticationRequired"] != "enabled" || f.host["username"] != "admin" || f.password != "s3cret-from-env" {
		t.Fatalf("Sonarr was left with %+v, password %q", f.host, f.password)
	}
	if f.host["port"] != float64(8989) {
		t.Fatalf("the rest of Sonarr's host settings were lost: %+v", f.host)
	}
	if l := applyOne(t, w); l.State != "already" {
		t.Fatalf("second run: %+v", l)
	}
	if f.puts != 1 || f.signIns != 1 {
		t.Fatalf("puts %d, sign-ins %d; want 1 and 1", f.puts, f.signIns)
	}
}

// A password changed in .env is set again (rule 5: corrected, never
// duplicated), and a login someone made in the app is replaced, saying so.
func TestArrLoginCorrected(t *testing.T) {
	f, url := newFakeHost(t, "skey", resource{"id": 1, "authenticationMethod": "forms", "authenticationRequired": "enabled", "username": "admin"}, "old")
	if l := applyOne(t, loginWirer(t, url, "new")); l.State != "done" || !strings.Contains(l.Detail, "set the password again") {
		t.Fatalf("changed password: %+v", l)
	}
	if f.password != "new" {
		t.Fatalf("password %q", f.password)
	}

	f, url = newFakeHost(t, "skey", resource{"id": 1, "authenticationMethod": "forms", "authenticationRequired": "enabled", "username": "alex"}, "theirs")
	l := applyOne(t, loginWirer(t, url, "ours"))
	if l.State != "done" || !strings.Contains(l.Detail, "(alex)") {
		t.Fatalf("someone else's login: %+v", l)
	}
	if f.signIns != 0 || f.host["username"] != "admin" || f.password != "ours" {
		t.Fatalf("sign-ins %d, host %+v, password %q", f.signIns, f.host, f.password)
	}
}

// No ARR_PASSWORD (cleared by hand): no link, and the app keeps its own.
func TestArrLoginNeedsAPassword(t *testing.T) {
	_, url := newFakeHost(t, "skey", resource{"id": 1}, "")
	for _, l := range loginWirer(t, url, "").Plan() {
		if strings.Contains(l.Text, "signs in") {
			t.Fatalf("planned %q with no ARR_PASSWORD", l.Text)
		}
	}
}
