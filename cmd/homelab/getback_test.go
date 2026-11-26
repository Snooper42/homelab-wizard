package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// Get something back (quality-loop Q4 (c)): against a fake Duplicati holding two nights of Vikunja's folder (as the
// real one restores: below the restore folder, under the path it was asked for), the nights are listed newest
// first; a file from the older night is saved as a copy; one is put back with what was there set aside; and the whole
// folder is put back with the app stopped while it's swapped.
func TestGetBack(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{{Name: "homelab_household-vikunja-1", Image: "vikunja/vikunja", Running: true, Project: "homelab_household", Service: "vikunja"}})
	root, _ := repoCopy(t)
	live := filepath.Join(root, "data", "appdata", "vikunja")
	os.MkdirAll(filepath.Join(live, "files"), 0o755)
	os.WriteFile(filepath.Join(live, "files", "list.txt"), []byte("today's list"), 0o644)
	os.WriteFile(filepath.Join(live, "config.yml"), []byte("today"), 0o644)
	night := map[string]map[string]string{
		"2026-11-25T03:30:12-05:00": {"files/list.txt": "Tuesday's list", "config.yml": "Tuesday"},
		"2026-11-24T03:30:12-05:00": {"files/list.txt": "Monday's list", "config.yml": "Monday"},
	}
	staging := filepath.Join(root, "recovery-staging", "get-back", "vikunja")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "/api/v1/backups":
			w.Write([]byte(`[{"Backup":{"ID":"3","Name":"Homelab AppData","Metadata":{}}}]`))
		case "/api/v1/backup/3/filesets":
			w.Write([]byte(`[{"Version":1,"Time":"2026-11-24T03:30:12-05:00","FileCount":2},{"Version":0,"Time":"2026-11-25T03:30:12-05:00","FileCount":2}]`))
		case "/api/v1/backup/3/restore":
			var req struct {
				Paths       []string `json:"paths"`
				Time        string   `json:"time"`
				RestorePath string   `json:"restore_path"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			if req.RestorePath != "/staging/get-back/vikunja" || len(req.Paths) != 1 || req.Paths[0] != "/source/appdata/vikunja/" {
				t.Errorf("restore %+v", req)
			}
			for rel, body := range night[req.Time] {
				dst := filepath.Join(staging, "vikunja", filepath.FromSlash(rel))
				os.MkdirAll(filepath.Dir(dst), 0o755)
				os.WriteFile(dst, []byte(body), 0o644)
			}
			w.Write([]byte(`{"Status":"OK","ID":9}`))
		case "/api/v1/task/9":
			w.Write([]byte(`{"Status":"Completed","ID":9}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	_, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	f, _ := os.OpenFile(filepath.Join(root, ".env"), os.O_APPEND|os.O_WRONLY, 0o600)
	f.WriteString("DUPLICATI_PORT=" + port + "\nDUPLICATI_PASSWORD=pw\n")
	f.Close()

	out, code := homelabCmd(t, root, "", "get-back", "vikunja", "--nights")
	if code != 0 || strings.Index(out, "Nov 25") > strings.Index(out, "Nov 24") || !strings.HasPrefix(strings.TrimSpace(out), "0") {
		t.Fatalf("nights (exit %d):\n%s", code, out)
	}
	saved := t.TempDir()
	if out, code := homelabCmd(t, root, "", "get-back", "vikunja", "--night", "1", "--file", "files/list.txt", "--to", saved, "--apply"); code != 0 {
		t.Fatalf("save (exit %d):\n%s", code, out)
	}
	if got, _ := os.ReadFile(filepath.Join(saved, "list.txt")); string(got) != "Monday's list" {
		t.Errorf("saved %q", got)
	}
	if got, _ := os.ReadFile(filepath.Join(live, "files", "list.txt")); string(got) != "today's list" {
		t.Error("a copy changed the app's own file")
	}
	// One file put back: what was there is set aside.
	if out, code := homelabCmd(t, root, "", "get-back", "vikunja", "--file", "files/list.txt", "--put-back", "--apply"); code != 0 {
		t.Fatalf("put back (exit %d):\n%s", code, out)
	}
	if got, _ := os.ReadFile(filepath.Join(live, "files", "list.txt")); string(got) != "Tuesday's list" {
		t.Errorf("put back %q", got)
	}
	aside, _ := filepath.Glob(filepath.Join(root, "recovery-staging", "put-back", "vikunja-*", "files", "list.txt"))
	if len(aside) != 1 {
		t.Fatalf("set aside: %v", aside)
	}
	if got, _ := os.ReadFile(aside[0]); string(got) != "today's list" {
		t.Errorf("set aside %q", got)
	}
	// A path that climbs out is refused.
	if out, code := homelabCmd(t, root, "", "get-back", "vikunja", "--file", "../../../.env", "--put-back", "--apply"); code == 0 {
		t.Errorf("climbed out:\n%s", out)
	}
	// The whole folder from Monday: the app stops while it's swapped, and starts again.
	os.Remove(calls)
	if out, code := homelabCmd(t, root, "", "get-back", "vikunja", "--night", "1", "--put-back", "--apply"); code != 0 {
		t.Fatalf("the folder (exit %d):\n%s", code, out)
	}
	if got, _ := os.ReadFile(filepath.Join(live, "config.yml")); string(got) != "Monday" {
		t.Errorf("the folder's config %q", got)
	}
	log, _ := os.ReadFile(calls)
	if !strings.Contains(string(log), "stop homelab_household-vikunja-1") || !strings.Contains(string(log), "start homelab_household-vikunja-1") {
		t.Errorf("the app wasn't stopped and started:\n%s", log)
	}
	if dirs, _ := filepath.Glob(filepath.Join(root, "recovery-staging", "put-back", "vikunja-*", "config.yml")); len(dirs) == 0 {
		t.Error("the folder there before wasn't set aside")
	}
	// An app with no folder of its own says so.
	if out, code := homelabCmd(t, root, "", "get-back", "no-such-app", "--nights"); code == 0 || !strings.Contains(out, "no folder of its own") {
		t.Errorf("no folder (exit %d):\n%s", code, out)
	}
}
