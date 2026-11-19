package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// TestInboxTorrentHolds: before the inbox files anything from qBittorrent's
// folder, qBittorrent is asked which torrents it still has in hand. One
// finished and stopped is free to file; one still sharing and one still
// downloading are held, at their path on this machine; and a qBittorrent
// that can't be read holds its whole folder, saying why.
func TestInboxTorrentHolds(t *testing.T) {
	password := "pw"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v2/auth/login":
			if r.FormValue("password") != password {
				w.Write([]byte("Fails."))
				return
			}
			http.SetCookie(w, &http.Cookie{Name: "SID", Value: "s1"})
			w.Write([]byte("Ok."))
		case "/api/v2/torrents/info":
			if c, err := r.Cookie("SID"); err != nil || c.Value != "s1" {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.Write([]byte(`[
				{"state":"stoppedUP","progress":1,"content_path":"/downloads/movies/Heat.1995"},
				{"state":"pausedUP","progress":1,"content_path":"/downloads/movies/Ronin.1998.mkv"},
				{"state":"uploading","progress":1,"content_path":"/downloads/tv/Show.S01"},
				{"state":"downloading","progress":0.4,"content_path":"/downloads/incomplete/Alien.1979"},
				{"state":"stoppedDL","progress":0.7,"content_path":"/downloads/Big.1988.mkv"},
				{"state":"uploading","progress":1,"content_path":"/elsewhere/Other"}]`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	root := t.TempDir()
	a := wiring.App{ID: "qbittorrent", Name: "qBittorrent", URL: srv.URL}
	env := map[string]string{"QBITTORRENT_PASSWORD": "pw", "DOWNLOADS_ROOT": "/Volumes/Big/downloads"}
	ctx := context.Background()

	got := inboxTorrentHolds(ctx, a, env, root, "/home/me")
	if got.Unread != nil {
		t.Fatalf("read fine, nothing unread: %+v", got.Unread)
	}
	want := map[string]string{
		filepath.FromSlash("/Volumes/Big/downloads/tv/Show.S01"):           "qBittorrent is still sharing it",
		filepath.FromSlash("/Volumes/Big/downloads/incomplete/Alien.1979"): "still downloading in qBittorrent",
		filepath.FromSlash("/Volumes/Big/downloads/Big.1988.mkv"):          "still downloading in qBittorrent",
	}
	if len(got.Held) != len(want) {
		t.Fatalf("held %+v, want %v (finished and stopped ones are free; one outside /downloads can't be placed)", got.Held, want)
	}
	for _, h := range got.Held {
		if want[h.Path] != h.Why {
			t.Errorf("held %q: %q, want %q", h.Path, h.Why, want[h.Path])
		}
	}

	// ~/ in DOWNLOADS_ROOT is from home, as the compose files read it.
	env["DOWNLOADS_ROOT"] = "~/dl"
	got = inboxTorrentHolds(ctx, a, env, root, "/home/me")
	if len(got.Held) == 0 || !strings.HasPrefix(got.Held[0].Path, filepath.FromSlash("/home/me/dl/")) {
		t.Fatalf("held %+v, want under /home/me/dl", got.Held)
	}

	// Refused: the whole folder waits, and the card says why. The
	// password itself is never in what's written.
	password = "changed"
	got = inboxTorrentHolds(ctx, a, env, root, "/home/me")
	if got.Unread == nil || got.Unread.Root != filepath.FromSlash("/home/me/dl") || !strings.Contains(got.Unread.Why, "couldn't be read") {
		t.Fatalf("unread: %+v", got.Unread)
	}
	delete(env, "QBITTORRENT_PASSWORD")
	got = inboxTorrentHolds(ctx, a, env, root, "/home/me")
	if got.Unread == nil || !strings.Contains(got.Unread.Why, "QBITTORRENT_PASSWORD") {
		t.Fatalf("no password: %+v", got.Unread)
	}

	// Written where the inbox reads it, and removed when qBittorrent isn't
	// running (nothing is being written then).
	env["QBITTORRENT_PASSWORD"] = "pw"
	password = "pw"
	path := filepath.Join(root, "data", "media-torrents.json")
	if err := writeTorrentHolds(ctx, root, env, "/home/me", &a); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var back struct {
		Held []struct{ Path, Why string }
	}
	if err := json.Unmarshal(data, &back); err != nil || len(back.Held) != 3 || strings.Contains(string(data), "pw") {
		t.Fatalf("written: %s (%v)", data, err)
	}
	if err := writeTorrentHolds(ctx, root, env, "/home/me", nil); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("qBittorrent not running: the file goes, got %v", err)
	}
}
