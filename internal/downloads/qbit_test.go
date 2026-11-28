package downloads

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// QbitList (Tidy Up's inbox, stalled downloads, the downloads card) signs in
// to qBittorrent up to 5.1 (200 "Ok.", cookie SID) and from 5.2 (204 with no
// body, cookie QBT_SID_<port>: the owner's Mac, Nov 27); a wrong password
// (200 "Fails.", no cookie) is an error.
func TestQbitListSignsInToEachQbittorrent(t *testing.T) {
	for _, c := range []struct {
		name   string
		cookie string
		status int
		body   string
	}{
		{"5.1", "SID", http.StatusOK, "Ok."},
		{"5.2", "QBT_SID_8082", http.StatusNoContent, ""},
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/api/v2/auth/login":
				r.ParseForm()
				if r.Form.Get("password") != "pw" {
					w.Write([]byte("Fails."))
					return
				}
				http.SetCookie(w, &http.Cookie{Name: c.cookie, Value: "s1"})
				w.WriteHeader(c.status)
				w.Write([]byte(c.body))
			case "/api/v2/torrents/info":
				if ck, err := r.Cookie(c.cookie); err != nil || ck.Value != "s1" {
					w.WriteHeader(http.StatusForbidden)
					return
				}
				w.Write([]byte(`[{"state":"downloading","progress":0.5}]`))
			}
		}))
		got, err := QbitList(context.Background(), srv.Client(), srv.URL, map[string]string{"QBITTORRENT_PASSWORD": "pw"})
		if err != nil || len(got) != 1 {
			t.Errorf("qBittorrent %s: %v %v", c.name, got, err)
		}
		if _, err := QbitList(context.Background(), srv.Client(), srv.URL, map[string]string{"QBITTORRENT_PASSWORD": "wrong"}); err == nil {
			t.Errorf("qBittorrent %s: a wrong password listed its torrents", c.name)
		}
		srv.Close()
	}
}
