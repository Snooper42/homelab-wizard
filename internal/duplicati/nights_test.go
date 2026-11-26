package duplicati

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// Get something back (quality-loop Q4 (c)): the nights a job holds, newest first, and a restore from one of them.
func TestNightsAndRestoreAt(t *testing.T) {
	pollEvery = time.Millisecond
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "/api/v1/backups":
			w.Write([]byte(`[{"Backup":{"ID":"7","Name":"Homelab AppData","Metadata":{}}}]`))
		case "/api/v1/backup/7/filesets":
			// As Duplicati sends them: version 0 the newest, its time with an offset; one in its own compact form.
			w.Write([]byte(`[{"Version":1,"IsFullBackup":1,"Time":"20261124T083012Z","FileCount":"410","FileSizes":"9000"},{"Version":0,"IsFullBackup":1,"Time":"2026-11-25T03:30:12-05:00","FileCount":412,"FileSizes":9100},{"Version":2,"Time":"not a time"}]`))
		case "/api/v1/backup/7/restore":
			_ = json.NewDecoder(r.Body).Decode(&got)
			w.Write([]byte(`{"Status":"OK","ID":42}`))
		case "/api/v1/task/42":
			w.Write([]byte(`{"Status":"Completed","ID":42}`))
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
	nights, err := c.Nights(ctx, "homelab appdata")
	if err != nil {
		t.Fatal(err)
	}
	if len(nights) != 2 || nights[0].Version != 0 || nights[1].Version != 1 || nights[0].Files != 412 || nights[1].Files != 410 {
		t.Fatalf("%+v", nights)
	}
	if !nights[0].At.Equal(time.Date(2026, 11, 25, 8, 30, 12, 0, time.UTC)) || !nights[1].At.Equal(time.Date(2026, 11, 24, 8, 30, 12, 0, time.UTC)) {
		t.Errorf("times: %v %v", nights[0].At, nights[1].At)
	}
	if err := c.RestoreAt(ctx, "Homelab AppData", []string{"/source/appdata/vikunja/"}, nights[1], "/staging/get-back/vikunja", time.Minute); err != nil {
		t.Fatal(err)
	}
	if got["time"] != nights[1].Raw || got["restore_path"] != "/staging/get-back/vikunja" {
		t.Errorf("request %v", got)
	}
	if _, err := c.Nights(ctx, "Homelab Photos"); err == nil {
		t.Error("a missing job's nights")
	}
}
