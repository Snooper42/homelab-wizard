package api

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAnswers(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login":
			http.Redirect(w, r, "/sso", http.StatusFound)
		case "/broken":
			w.WriteHeader(http.StatusBadGateway)
		}
	}))
	defer srv.Close()
	l, _ := net.Listen("tcp", "127.0.0.1:0") // a port nothing answers on
	closed := "http://" + l.Addr().String() + "/"
	l.Close()

	got := Answers(context.Background(), []string{srv.URL + "/", srv.URL + "/login", srv.URL + "/broken", closed})
	if len(got) != 2 || got[srv.URL+"/broken"] != "HTTP 502" || got[closed] != "nothing answers on its port" {
		t.Errorf("answers: %q", got)
	}
}

func TestProbeLeavesOutWhatCannotAnswerYet(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	asked := map[string]bool{}
	old := Answers
	Answers = func(_ context.Context, urls []string) map[string]string {
		for _, u := range urls {
			asked[u] = true
		}
		return map[string]string{"http://localhost:1/": "HTTP 502"}
	}
	defer func() { Answers = old }()
	long := now.Add(-time.Hour).Format(time.RFC3339)
	apps := []AppStatus{
		{ID: "down", State: "running", URL: "http://localhost:1/", Since: long},
		{ID: "fine", State: "running", URL: "http://localhost:2/", Since: long},
		{ID: "new", State: "running", URL: "http://localhost:3/", Since: now.Add(-time.Minute).Format(time.RFC3339)},
		{ID: "booting", State: "running", Health: "starting", URL: "http://localhost:4/", Since: long},
		{ID: "native", State: "running", Health: "native", URL: "http://localhost:5/"},
		{ID: "stopped", State: "stopped", URL: "http://localhost:6/"},
		{ID: "helper", State: "running", Since: long},
	}
	probe(context.Background(), apps, now)
	if apps[0].NotAnswering != "HTTP 502" || apps[1].NotAnswering != "" {
		t.Errorf("results: %+v", apps[:2])
	}
	if len(asked) != 2 || !asked["http://localhost:1/"] || !asked["http://localhost:2/"] {
		t.Errorf("asked %v: only running apps with an address, past their first 90 seconds", asked)
	}
}
