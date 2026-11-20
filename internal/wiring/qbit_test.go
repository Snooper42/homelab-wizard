package wiring

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeQbit serves qBittorrent's sign-in and preferences, starting from its
// defaults, and counts the saves.
func fakeQbit(t *testing.T, password string) (url string, prefs map[string]any, saves *int) {
	t.Helper()
	prefs = map[string]any{
		"max_ratio_enabled": false, "max_ratio": -1.0, "max_ratio_act": 0.0,
		"temp_path_enabled": false, "temp_path": "/downloads/temp", "incomplete_files_ext": false,
		"listen_port": 6881.0, "bypass_local_auth": false,
	}
	saves = new(int)
	var mu sync.Mutex
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.URL.Path {
		case "/api/v2/auth/login":
			r.ParseForm()
			if r.Form.Get("username") != "admin" || r.Form.Get("password") != password {
				w.Write([]byte("Fails."))
				return
			}
			http.SetCookie(w, &http.Cookie{Name: "SID", Value: "s"})
			w.Write([]byte("Ok."))
			return
		}
		if c, err := r.Cookie("SID"); err != nil || c.Value != "s" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		switch r.URL.Path {
		case "/api/v2/app/preferences":
			json.NewEncoder(w).Encode(prefs)
		case "/api/v2/app/setPreferences":
			r.ParseForm()
			var got map[string]any
			if err := json.Unmarshal([]byte(r.Form.Get("json")), &got); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			for k, v := range got {
				prefs[k] = v
			}
			*saves++
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL, prefs, saves
}

func TestQbittorrentStopsSeedingWhenADownloadFinishes(t *testing.T) {
	url, prefs, saves := fakeQbit(t, "pw")
	w := &Wirer{
		Apps: map[string]App{"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", URL: url}},
		Env:  map[string]string{},
		Wait: time.Second,
	}
	const text = "qBittorrent stops sharing once a download is finished"
	links := w.Apply(context.Background(), nil)
	if len(links) != 2 || links[0].Text != text || links[0].State != "manual" || !strings.Contains(links[0].Detail, "QBITTORRENT_PASSWORD") {
		t.Fatalf("without the password: %+v", links)
	}

	w.Env["QBITTORRENT_PASSWORD"] = "pw"
	if l := w.Apply(context.Background(), nil)[0]; l.State != "done" {
		t.Fatalf("first run: %+v", l)
	}
	for k, want := range map[string]any{
		"max_ratio_enabled": true, "max_ratio": 0.0, "max_ratio_act": 0.0,
		"temp_path_enabled": true, "temp_path": "/downloads/incomplete", "incomplete_files_ext": true,
	} {
		if prefs[k] != want {
			t.Fatalf("%s is %v, want %v (%v)", k, prefs[k], want, prefs)
		}
	}
	if prefs["listen_port"] != 6881.0 {
		t.Fatalf("a preference wire doesn't own changed: %v", prefs)
	}

	// The second run finds it set and saves nothing.
	if l := w.Apply(context.Background(), nil)[0]; l.State != "already" || *saves != 2 { // one per step on the first run
		t.Fatalf("second run: %+v, %d saves", l, *saves)
	}

	// Someone turned the limit off by hand; the next run puts it back, and says so.
	prefs["max_ratio_enabled"], prefs["max_ratio"] = false, -1.0
	l := w.Apply(context.Background(), nil)[0]
	if l.State != "done" || l.Detail != "corrected max_ratio, max_ratio_enabled" || prefs["max_ratio"] != 0.0 {
		t.Fatalf("not corrected: %+v %v", l, prefs)
	}
}

func TestQbittorrentWrongPassword(t *testing.T) {
	url, _, _ := fakeQbit(t, "pw")
	w := &Wirer{
		Apps: map[string]App{"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", URL: url}},
		Env:  map[string]string{"QBITTORRENT_PASSWORD": "old"},
		Wait: time.Second,
	}
	l := w.Apply(context.Background(), nil)[0]
	if l.State != "failed" || !strings.Contains(l.Detail, "QBITTORRENT_PASSWORD") || strings.Contains(l.Detail, "old") {
		t.Fatalf("a wrong password should fail plainly, without the password: %+v", l)
	}
}

// Gluetun puts the VPN's forwarded port into qBittorrent itself, from the
// loopback the two share, which qBittorrent lets in without its login;
// wire turns that on and sets the port Gluetun has now (arr-loop item 2).
func TestQbittorrentTakesTheVPNsPort(t *testing.T) {
	url, prefs, saves := fakeQbit(t, "pw")
	gluetun := t.TempDir()
	w := &Wirer{
		Apps: map[string]App{
			"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", URL: url},
			"gluetun":     {ID: "gluetun", Name: "Gluetun", ConfigDir: gluetun},
		},
		Env:  map[string]string{"QBITTORRENT_PASSWORD": "pw"},
		Wait: time.Second,
	}
	const text = "qBittorrent takes the VPN's forwarded port by itself"
	port := func() Link {
		t.Helper()
		for _, l := range w.Apply(context.Background(), nil) {
			if l.Text == text {
				return l
			}
		}
		t.Fatal("no step for the VPN's port")
		return Link{}
	}

	// The VPN hasn't connected yet: the bypass is on, the port waits.
	if l := port(); l.State != "done" || prefs["bypass_local_auth"] != true || prefs["listen_port"] != 6881.0 || !strings.Contains(l.Detail, "no forwarded port yet") {
		t.Fatalf("before the VPN connects: %+v %v", l, prefs)
	}

	// It connected: the port Gluetun wrote is set.
	os.WriteFile(filepath.Join(gluetun, "forwarded_port"), []byte("51234\n"), 0o644)
	if l := port(); l.State != "done" || prefs["listen_port"] != 51234.0 || !strings.Contains(l.Detail, "51234") {
		t.Fatalf("after it connects: %+v %v", l, prefs)
	}

	// The second run finds it set and saves nothing.
	before := *saves
	if l := port(); l.State != "already" || l.Detail != "" || *saves != before {
		t.Fatalf("second run: %+v, %d saves", l, *saves-before)
	}

	// A reconnect brought a new port; the next run follows it.
	os.WriteFile(filepath.Join(gluetun, "forwarded_port"), []byte("40000\n"), 0o644)
	if l := port(); l.State != "done" || prefs["listen_port"] != 40000.0 {
		t.Fatalf("new port: %+v %v", l, prefs)
	}

	// Anything else in the file is no port.
	for _, junk := range []string{"", "port", "0", "70000"} {
		os.WriteFile(filepath.Join(gluetun, "forwarded_port"), []byte(junk), 0o644)
		if got := w.forwardedPort(); got != 0 {
			t.Errorf("%q read as port %d", junk, got)
		}
	}
	os.WriteFile(filepath.Join(gluetun, "forwarded_port"), []byte("1234,5678\n"), 0o644)
	if got := w.forwardedPort(); got != 1234 {
		t.Errorf("two ports read as %d, want the first", got)
	}
}
