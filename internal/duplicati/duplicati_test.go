package duplicati

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestJobs(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/auth/login":
			var in struct{ Password string }
			_ = json.NewDecoder(r.Body).Decode(&in)
			if in.Password != "right" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Write([]byte(`{"AccessToken":"tok","RefreshNonce":null}`))
		case "/api/v1/backups":
			if r.Header.Get("Authorization") != "Bearer tok" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Write([]byte(`[
			 {"Backup":{"ID":"1","Name":"Homelab Secrets","Metadata":{"LastBackupFinished":"20261010T050212Z","TargetSizeString":"1.20 MB"}},"Schedule":null},
			 {"Backup":{"ID":"2","Name":"Homelab Databases","Metadata":{"LastBackupFinished":"20261009T050212Z","LastErrorDate":"20261010T050100Z","LastErrorMessage":"The folder does not exist"}},"Schedule":null},
			 {"Backup":{"ID":"3","Name":"Homelab Jellyfin","Metadata":{"LastBackupFinished":"20260920T050212Z"}},"Schedule":null},
			 {"Backup":{"ID":"4","Name":"Homelab Photos","Metadata":{}},"Schedule":null}
			]`))
		case "/api/v1/serverstate":
			w.Write([]byte(`{"ProgramState":"Running","ProposedSchedule":[{"Item1":"1","Item2":"2026-10-11T05:00:00Z"},{"Item1":"3","Item2":"2026-10-12T02:00:00"}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	jobs, err := Jobs(context.Background(), srv.URL, "right", now)
	if err != nil || len(jobs) != 4 {
		t.Fatalf("jobs: %v %+v", err, jobs)
	}
	want := map[string]string{"Homelab Databases": "failed", "Homelab Jellyfin": "stale", "Homelab Photos": "never", "Homelab Secrets": "ok"}
	for _, j := range jobs {
		if j.State != want[j.Name] {
			t.Errorf("%s: %s, want %s", j.Name, j.State, want[j.Name])
		}
	}
	if jobs[0].Name != "Homelab Databases" || jobs[0].ErrorMessage != "The folder does not exist" || jobs[3].Size != "1.20 MB" {
		t.Errorf("details: %+v", jobs)
	}
	// Next runs come from the proposed schedule; a job missing from it has none.
	if !jobs[3].NextRun.Equal(time.Date(2026, 10, 11, 5, 0, 0, 0, time.UTC)) || !jobs[1].NextRun.Equal(time.Date(2026, 10, 12, 2, 0, 0, 0, time.UTC)) || !jobs[2].NextRun.IsZero() {
		t.Errorf("next runs: %v %v %v", jobs[3].NextRun, jobs[1].NextRun, jobs[2].NextRun)
	}
	if !jobs[3].LastFinished.Equal(time.Date(2026, 10, 10, 5, 2, 12, 0, time.UTC)) {
		t.Errorf("date: %v", jobs[3].LastFinished)
	}
	if _, err := Jobs(context.Background(), srv.URL, "wrong", now); err == nil || err.Error() != "Duplicati refused DUPLICATI_PASSWORD" {
		t.Errorf("wrong password: %v", err)
	}
	if _, err := Jobs(context.Background(), srv.URL, "", now); err != ErrNoPassword {
		t.Errorf("no password: %v", err)
	}
}

func TestRestore(t *testing.T) {
	pollEvery = time.Millisecond
	var got map[string]any
	polls := 0
	failNext := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "/api/v1/backups":
			w.Write([]byte(`[{"Backup":{"ID":"7","Name":"Homelab AppData","Metadata":{}}}]`))
		case "/api/v1/backup/7/restore":
			_ = json.NewDecoder(r.Body).Decode(&got)
			w.Write([]byte(`{"Status":"OK","ID":42}`))
		case "/api/v1/task/42":
			polls++
			switch {
			case failNext:
				w.Write([]byte(`{"Status":"Failed","ID":42,"ErrorMessage":"no such file"}`))
			case polls < 3:
				w.Write([]byte(`{"Status":"Running","ID":42}`))
			default:
				w.Write([]byte(`{"Status":"Completed","ID":42}`))
			}
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
	paths := []string{"/source/appdata/vikunja/files/a.txt", "/source/appdata/mealie/b.txt"}
	if err := c.Restore(ctx, "homelab appdata", paths, "/staging/restore-test", time.Minute); err != nil {
		t.Fatal(err)
	}
	if got["time"] != "now" || got["restore_path"] != "/staging/restore-test" || got["overwrite"] != true || len(got["paths"].([]any)) != 2 || polls != 3 {
		t.Fatalf("request %v after %d polls", got, polls)
	}
	failNext = true
	if err := c.Restore(ctx, "Homelab AppData", paths, "/staging/restore-test", time.Minute); err == nil || err.Error() != "Duplicati's restore failed: no such file" {
		t.Fatalf("failed task: %v", err)
	}
	if err := c.Restore(ctx, "Homelab Photos", paths, "/staging/restore-test", time.Minute); err == nil {
		t.Fatal("a missing job should be an error")
	}
}
