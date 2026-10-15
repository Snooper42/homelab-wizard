package health

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHeartbeat(t *testing.T) {
	var path, body string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, _ := io.ReadAll(r.Body)
		path, body = r.URL.Path, string(data)
	}))
	defer srv.Close()
	if err := Heartbeat(context.Background(), srv.Client(), srv.URL+"/abc/", nil); err != nil || path != "/abc" {
		t.Fatalf("ok ping: %v %s", err, path)
	}
	if err := Heartbeat(context.Background(), srv.Client(), srv.URL+"/abc", []string{"docker engine: OrbStack is not running"}); err != nil || path != "/abc/fail" || body != "docker engine: OrbStack is not running" {
		t.Fatalf("fail ping: %v %s %q", err, path, body)
	}
}
