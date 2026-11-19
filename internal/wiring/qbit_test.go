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

// fakeQbit serves qBittorrent's sign-in and preferences, starting from its
// defaults, and counts the saves.
func fakeQbit(t *testing.T, password string) (url string, prefs map[string]any, saves *int) {
	t.Helper()
	prefs = map[string]any{
		"max_ratio_enabled": false, "max_ratio": -1.0, "max_ratio_act": 0.0,
		"temp_path_enabled": false, "temp_path": "/downloads/temp", "incomplete_files_ext": false,
		"listen_port": 6881.0,
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
	if len(links) != 1 || links[0].Text != text || links[0].State != "manual" || !strings.Contains(links[0].Detail, "QBITTORRENT_PASSWORD") {
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
	if l := w.Apply(context.Background(), nil)[0]; l.State != "already" || *saves != 1 {
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
