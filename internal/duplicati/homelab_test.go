package duplicati

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

func TestNext(t *testing.T) {
	loc := time.FixedZone("CEST", 2*3600)
	now := time.Date(2026, 10, 14, 5, 15, 0, 0, loc) // a Wednesday
	daily := HomelabJob{Every: "1D", Hour: 5, Minute: 30}
	if got := daily.Next(now); !got.Equal(time.Date(2026, 10, 14, 5, 30, 0, 0, loc)) {
		t.Errorf("later today: %v", got)
	}
	if got := daily.Next(now.Add(time.Hour)); !got.Equal(time.Date(2026, 10, 15, 5, 30, 0, 0, loc)) {
		t.Errorf("tomorrow: %v", got)
	}
	weekly := HomelabJob{Every: "1W", Weekday: time.Sunday, Hour: 2}
	if got := weekly.Next(now); !got.Equal(time.Date(2026, 10, 18, 2, 0, 0, 0, loc)) {
		t.Errorf("next Sunday: %v", got)
	}
	if got := weekly.Next(time.Date(2026, 10, 18, 3, 0, 0, 0, loc)); !got.Equal(time.Date(2026, 10, 25, 2, 0, 0, 0, loc)) {
		t.Errorf("Sunday after the run: %v", got)
	}
	if daily.When() != "daily at 05:30" || weekly.When() != "Sundays at 02:00" {
		t.Errorf("when: %q %q", daily.When(), weekly.When())
	}
}

func TestPlan(t *testing.T) {
	media, home := t.TempDir(), t.TempDir()
	photos := filepath.Join(media, "photos")
	_ = os.MkdirAll(filepath.Join(photos, "library"), 0o755)
	_ = os.MkdirAll(filepath.Join(media, "Books"), 0o755) // empty: no Calibre job
	env := map[string]string{"IMMICH_UPLOAD_LOCATION": photos, "MEDIA_ROOT": media}
	plan := Plan(env, home, []Job{{Name: "homelab secrets"}}, time.Now())
	got := map[string]string{}
	for _, p := range plan {
		got[p.Job.Name] = p.Action
	}
	want := map[string]string{
		"Homelab Photos": "create", "Homelab Databases": "create", "Homelab Secrets": "exists", "Homelab AppData": "create",
		"Homelab Stack Data": "create", "Homelab Infrastructure": "create", "Homelab Jellyfin": "skip", "Homelab Calibre": "skip",
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s: %s, want %s", k, got[k], v)
		}
	}
}

func TestCreateRunOptions(t *testing.T) {
	var created, options map[string]any
	var ran, listed string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method + " " + r.URL.Path {
		case "POST /api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "POST /api/v1/backups":
			_ = json.NewDecoder(r.Body).Decode(&created)
			w.Write([]byte(`{"ID":"5","Temporary":false}`))
		case "POST /api/v1/backup/5/run":
			ran = "5"
			w.Write([]byte(`{"Status":"OK","ID":12}`))
		case "PATCH /api/v1/serversettings":
			_ = json.NewDecoder(r.Body).Decode(&options)
		case "POST /api/v1/filesystem":
			var in map[string]string
			_ = json.NewDecoder(r.Body).Decode(&in)
			listed = in["path"]
			w.Write([]byte(`[{"text":"secrets","id":"/destination/secrets/","leaf":false},{"text":".homelab","id":"/destination/.homelab","leaf":true}]`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	ctx := context.Background()
	c, err := Login(ctx, srv.URL, "pw")
	if err != nil {
		t.Fatal(err)
	}
	first := time.Date(2026, 10, 15, 5, 0, 0, 0, time.FixedZone("CEST", 2*3600))
	id, err := c.Create(ctx, NewJob{Name: "Homelab Secrets", Sources: []string{"/staging/secrets/"}, Exclude: []string{"/staging/secrets/tmp/"},
		Target: "file:///destination/secrets", Passphrase: "pp", Every: "1D", First: first})
	if err != nil || id != "5" {
		t.Fatalf("create: %q %v", id, err)
	}
	b := created["Backup"].(map[string]any)
	sched := created["Schedule"].(map[string]any)
	settings := map[string]string{}
	for _, s := range b["Settings"].([]any) {
		m := s.(map[string]any)
		settings[m["Name"].(string)] = m["Value"].(string)
	}
	filters := b["Filters"].([]any)
	if b["TargetURL"] != "file:///destination/secrets" || settings["passphrase"] != "pp" || settings["encryption-module"] != "aes" ||
		settings["retention-policy"] != SmartRetention || sched["Repeat"] != "1D" || sched["Time"] != "2026-10-15T03:00:00Z" ||
		len(filters) != 1 || filters[0].(map[string]any)["Include"] != false {
		t.Fatalf("request: %v", created)
	}
	if _, err := c.Create(ctx, NewJob{Name: "x"}); err == nil {
		t.Error("a job without a passphrase should be refused")
	}
	if err := c.Run(ctx, "5"); err != nil || ran != "5" {
		t.Fatalf("run: %v", err)
	}
	if err := c.SetOptions(ctx, map[string]string{"send-http-url": "http://ntfy:80/t", "--send-http-level": "Warning,Error,Fatal"}); err != nil ||
		options["--send-http-url"] != "http://ntfy:80/t" || options["--send-http-level"] != "Warning,Error,Fatal" {
		t.Fatalf("options %v: %v", options, err)
	}
	names, err := c.List(ctx, "/destination")
	if err != nil || listed != "/destination/" || len(names) != 2 || names[0] != "secrets" {
		t.Fatalf("list %q: %v %v", listed, names, err)
	}
}
