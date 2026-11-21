package wiring

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/qbitconf"
)

// "qBittorrent refused the sign-in" (the owner, Nov 21) says which it is:
// a qBittorrent whose own password, set before the homelab made one, isn't
// the one in Settings (read in its settings file) gets the one-click fix;
// a computer it has locked out (403) is told to wait or restart it; and a
// file that agrees leaves the old words.
func TestSaysWhyQbittorrentRefusedTheSignIn(t *testing.T) {
	refuse := func(status int) string {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
			w.Write([]byte("Fails."))
		}))
		t.Cleanup(srv.Close)
		return srv.URL
	}
	conf := func(password string) string {
		dir := t.TempDir()
		data, err := qbitconf.First("admin", password)
		if err != nil {
			t.Fatal(err)
		}
		os.MkdirAll(filepath.Join(dir, "qBittorrent"), 0o755)
		os.WriteFile(filepath.Join(dir, qbitconf.Path), data, 0o600)
		return dir
	}
	link := func(url, dir string) Link {
		w := &Wirer{Apps: map[string]App{"qbittorrent": {ID: "qbittorrent", Name: "qBittorrent", URL: url, ConfigDir: dir}},
			Env: map[string]string{"QBITTORRENT_PASSWORD": "from-settings"}, Wait: time.Second}
		return w.Apply(context.Background(), nil)[0]
	}
	// Its own password differs: the fix, refused or locked out alike.
	for _, status := range []int{http.StatusOK, http.StatusForbidden} {
		l := link(refuse(status), conf("its-own"))
		if l.State != "failed" || l.Fix != FixQbitPassword || !strings.Contains(l.Detail, "keeps its own password") {
			t.Errorf("%d, own password: %+v", status, l)
		}
	}
	// The same password, locked out: wait or restart, no fix.
	if l := link(refuse(http.StatusForbidden), conf("from-settings")); l.Fix != "" || !strings.Contains(l.Detail, "locked this computer out") {
		t.Errorf("locked out: %+v", l)
	}
	// No settings file to read: the old words.
	if l := link(refuse(http.StatusOK), t.TempDir()); l.Fix != "" || !strings.Contains(l.Detail, "refused the sign-in") {
		t.Errorf("unread: %+v", l)
	}
}
