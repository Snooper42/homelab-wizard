package releases

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// The releases cache is replaced whole, never rewritten in place: the app
// and homelab serve read it from processes of their own, and one read
// half-written would ask GitHub again for every app at once. What another
// project had is kept.
func TestTheReleasesCacheIsReplacedWhole(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]any{{"tag_name": "v2.0.0"}})
	}))
	defer srv.Close()
	API = srv.URL
	defer func() { API = "https://api.github.com" }()
	path := filepath.Join(t.TempDir(), "data", "releases.json")
	if _, err := List(context.Background(), path, "o/one"); err != nil {
		t.Fatal(err)
	}
	was, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := List(context.Background(), path, "o/two"); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("the cache was rewritten in place")
	}
	var c cache
	data, _ := os.ReadFile(path)
	if err := json.Unmarshal(data, &c); err != nil || len(c) != 2 || time.Since(c["o/one"].At) > time.Minute {
		t.Errorf("cache %s (%v)", data, err)
	}
}
