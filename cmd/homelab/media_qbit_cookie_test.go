package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Tidy Up signs in to qBittorrent 5.2, whose session cookie is
// QBT_SID_<port>, not SID (webapplication.cpp), as well as to older ones.
func TestQbitListSessionCookie(t *testing.T) {
	for _, name := range []string{"SID", "QBT_SID_8082"} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/api/v2/auth/login":
				http.SetCookie(w, &http.Cookie{Name: name, Value: "s1"})
				w.Write([]byte("Ok."))
			case "/api/v2/torrents/info":
				if c, err := r.Cookie(name); err != nil || c.Value != "s1" {
					w.WriteHeader(http.StatusForbidden)
					return
				}
				w.Write([]byte(`[{"state":"downloading","progress":0.5}]`))
			}
		}))
		got, err := qbitList(context.Background(), srv.Client(), srv.URL, map[string]string{"QBITTORRENT_PASSWORD": "pw"})
		srv.Close()
		if err != nil || len(got) != 1 {
			t.Errorf("cookie %s: %v %v", name, got, err)
		}
	}
}
