package notify

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestPublish(t *testing.T) {
	var got http.Header
	var body string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/locked" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		got = r.Header
		data, _ := io.ReadAll(r.Body)
		body = string(data)
	}))
	defer srv.Close()
	c := New(srv.URL)
	err := c.Publish(context.Background(), "tunnel-watchdog", Message{Title: "Tunnel down", Body: "photos: HTTP 530", Priority: 4, Tags: []string{"warning"}})
	if err != nil || got.Get("Title") != "Tunnel down" || got.Get("Priority") != "4" || body != "photos: HTTP 530" {
		t.Fatalf("publish: %v %v %q", err, got, body)
	}
	if err := c.Publish(context.Background(), "locked", Message{Body: "x"}); err == nil || !strings.Contains(err.Error(), "notify setup") {
		t.Fatalf("a missing grant should point at notify setup, got %v", err)
	}
}

func TestPublishWithToken(t *testing.T) {
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { auth = r.Header.Get("Authorization") }))
	defer srv.Close()
	c := New(srv.URL)
	c.Token = "tk_x"
	if err := c.Publish(context.Background(), "watchtower", Message{Body: "hi"}); err != nil || auth != "Bearer tk_x" {
		t.Fatalf("%v %q", err, auth)
	}
	if AuthParam("tk_x") != "QmVhcmVyIHRrX3g" {
		t.Fatalf("auth param %s", AuthParam("tk_x"))
	}
}

func TestRecent(t *testing.T) {
	var path, auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.RequestURI(), r.Header.Get("Authorization")
		if auth == "" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.Write([]byte(`{"id":"a","time":1760000000,"event":"open","topic":"watchtower"}
{"id":"b","time":1760000100,"event":"message","topic":"watchtower","title":"Updated","message":"vikunja: new image","priority":3}
{"id":"c","time":1760000500,"event":"message","topic":"tunnel-watchdog","title":"Tunnel down","message":"photos: HTTP 530","priority":4,"tags":["warning"]}
`))
	}))
	defer srv.Close()
	c := New(srv.URL)
	if _, err := c.Recent(context.Background(), Topics, time.Hour); err == nil || !strings.Contains(err.Error(), "notify setup") {
		t.Fatalf("no token: %v", err)
	}
	c.Token = "tk_r"
	events, err := c.Recent(context.Background(), []string{"watchtower", "tunnel-watchdog"}, 24*time.Hour)
	if err != nil || len(events) != 2 || events[0].ID != "c" || events[0].Priority != 4 || events[1].Title != "Updated" {
		t.Fatalf("events: %v %+v", err, events)
	}
	if path != "/watchtower,tunnel-watchdog/json?poll=1&since=86400s" || auth != "Bearer tk_r" {
		t.Fatalf("request: %s %s", path, auth)
	}
}
