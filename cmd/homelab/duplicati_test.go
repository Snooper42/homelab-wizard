package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestDuplicatiChecks(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "/api/v1/backups":
			w.Write([]byte(`[
			 {"Backup":{"ID":"1","Name":"Homelab Secrets","Metadata":{"LastBackupFinished":"20261010T050212Z"}}},
			 {"Backup":{"ID":"2","Name":"Homelab Databases","Metadata":{"LastBackupFinished":"20261009T050212Z","LastErrorDate":"20261010T050100Z","LastErrorMessage":"The folder does not exist"}}},
			 {"Backup":{"ID":"3","Name":"Homelab Calibre","Metadata":{"LastBackupFinished":"20260920T050212Z"}}},
			 {"Backup":{"ID":"4","Name":"Homelab Photos","Metadata":{}}}
			]`))
		}
	}))
	defer srv.Close()
	_, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))

	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	running := detect.Analyze(h.catalog, []docker.Container{{Name: "duplicati", Running: true, Labels: map[string]string{
		"com.docker.compose.project": "homelab_system", "com.docker.compose.service": "duplicati",
	}}})
	env := map[string]string{"DUPLICATI_PORT": port, "DUPLICATI_PASSWORD": "pw"}
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)

	results := h.duplicatiChecks(context.Background(), running, env, now)
	got := map[string]string{}
	for _, r := range results {
		msg := ""
		if r.Err != nil {
			msg = r.Err.Error()
		}
		got[r.Name] = msg
	}
	if len(results) != 3 || got["duplicati Homelab Secrets"] != "" ||
		!strings.Contains(got["duplicati Homelab Databases"], "The folder does not exist") ||
		!strings.Contains(got["duplicati Homelab Calibre"], "no successful run since") {
		t.Fatalf("results: %v", got)
	}
	if _, ok := got["duplicati Homelab Photos"]; ok {
		t.Error("a job never run yet is being set up, not failing")
	}
	if r := h.duplicatiChecks(context.Background(), running, map[string]string{"DUPLICATI_PORT": port}, now); r != nil {
		t.Errorf("no password: no checks, got %v", r)
	}
	if r := h.duplicatiChecks(context.Background(), detect.Analyze(h.catalog, nil), env, now); r != nil {
		t.Errorf("Duplicati not running: no checks, got %v", r)
	}
}

// TestAutoRestoreTest runs restore-test --auto against a fake Duplicati
// that restores like the real one: the requested files, under the restore
// folder, below the paths' common prefix.
func TestAutoRestoreTest(t *testing.T) {
	root, _ := repoCopy(t)
	appdata := filepath.Join(root, "data", "appdata")
	old := time.Now().Add(-72 * time.Hour)
	for _, f := range []string{"vikunja/db/vikunja.db", "mealie/data/settings.json", "karakeep/data/db.db", "duplicati/Duplicati-server.sqlite"} {
		p := filepath.Join(appdata, f)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte("contents of "+f), 0o644); err != nil {
			t.Fatal(err)
		}
		_ = os.Chtimes(p, old, old)
	}
	staging := filepath.Join(root, "recovery-staging", "restore-test")
	corrupt := false
	var requested []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "/api/v1/backups":
			w.Write([]byte(`[{"Backup":{"ID":"3","Name":"Homelab AppData","Metadata":{"LastBackupFinished":"20261010T053012Z"}}}]`))
		case "/api/v1/backup/3/restore":
			var req struct {
				Paths       []string `json:"paths"`
				RestorePath string   `json:"restore_path"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			requested = req.Paths
			if req.RestorePath != "/staging/restore-test" {
				t.Errorf("restore path %q", req.RestorePath)
			}
			prefix := "/source/appdata/" // the common prefix of files from several apps
			for i, p := range req.Paths {
				rel := strings.TrimPrefix(p, prefix)
				data, _ := os.ReadFile(filepath.Join(appdata, filepath.FromSlash(rel)))
				if corrupt && i == 0 {
					data = append(data, '!')
				}
				dst := filepath.Join(staging, filepath.FromSlash(rel))
				_ = os.MkdirAll(filepath.Dir(dst), 0o755)
				_ = os.WriteFile(dst, data, 0o644)
				_ = os.Chtimes(dst, old, old)
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

	out := &bytes.Buffer{}
	h, err := newHomelab(&ui.UI{Out: out}, root)
	if err != nil {
		t.Fatal(err)
	}
	if err := h.restoreTest(context.Background(), []string{"--auto"}); err != nil {
		t.Fatalf("%v\n%s", err, out)
	}
	if len(requested) != 3 {
		t.Fatalf("requested %v: want the three apps' files, not Duplicati's own", requested)
	}
	if _, err := os.Stat(staging); !os.IsNotExist(err) {
		t.Error("a passing restore should be removed")
	}
	if l := backup.LoadRestoreLog(h.restoreLogPath()); l.LastTest.IsZero() || !strings.Contains(l.LastSummary, "3 of 3") {
		t.Errorf("not recorded: %+v\n%s", l, out)
	}

	corrupt = true
	if err := h.restoreTest(context.Background(), []string{"--auto"}); err == nil || !strings.Contains(err.Error(), "1 different") {
		t.Fatalf("a damaged file should fail the test: %v", err)
	}
	if _, err := os.Stat(staging); err != nil {
		t.Error("a failed restore should stay for a look")
	}
	// Both drills are on record, timed and from the job; the failure does
	// not count as the last test.
	l := backup.LoadRestoreLog(h.restoreLogPath())
	if len(l.History) != 2 || !l.History[0].Passed || l.History[0].Seconds < 1 || l.History[0].Job != "Homelab AppData" {
		t.Errorf("history: %+v", l.History)
	}
	if f, failed := l.LastFailed(); !failed || !strings.Contains(f.Summary, "1 different") || !strings.Contains(l.LastSummary, "3 of 3") {
		t.Errorf("failure: %+v, last summary %q", f, l.LastSummary)
	}
}

func TestDuplicatiSetup(t *testing.T) {
	t.Setenv("HOME", t.TempDir()) // no Jellyfin library here
	dest := t.TempDir()
	calls := fakeDocker(t, []docker.FakeContainer{{Name: "homelab_system-duplicati-1", Image: "lscr.io/linuxserver/duplicati:latest", Running: true, Project: "homelab_system", Service: "duplicati"}})
	recreated := func() bool {
		data, _ := os.ReadFile(calls)
		return strings.Contains(string(data), "--force-recreate duplicati")
	}
	var created []map[string]any
	var ran, repaired []string
	// The AppData folder already holds a backup, as on a rebuilt machine.
	_ = os.MkdirAll(filepath.Join(dest, "appdata"), 0o755)
	_ = os.WriteFile(filepath.Join(dest, "appdata", "duplicati-20261001T053012Z.dlist.zip.aes"), []byte("x"), 0o644)
	var options map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method + " " + r.URL.Path {
		case "POST /api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "GET /api/v1/backups":
			w.Write([]byte(`[{"Backup":{"ID":"1","Name":"Homelab Secrets","Metadata":{}}}]`))
		case "POST /api/v1/filesystem":
			// What Duplicati sees at /destination: the host folder, when mounted.
			var nodes []map[string]string
			if entries, _ := os.ReadDir(dest); recreated() {
				for _, e := range entries {
					nodes = append(nodes, map[string]string{"text": e.Name()})
				}
			}
			_ = json.NewEncoder(w).Encode(nodes)
		case "POST /api/v1/backups":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			created = append(created, body)
			fmt.Fprintf(w, `{"ID":"%d"}`, len(created)+1)
		case "PATCH /api/v1/serversettings":
			_ = json.NewDecoder(r.Body).Decode(&options)
		default:
			if strings.HasSuffix(r.URL.Path, "/run") {
				ran = append(ran, r.URL.Path)
				w.Write([]byte(`{"Status":"OK","ID":3}`))
				return
			}
			if strings.HasSuffix(r.URL.Path, "/repair") {
				repaired = append(repaired, r.URL.Path)
				w.Write([]byte(`{"Status":"OK","ID":4}`))
				return
			}
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	_, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	root, _ := repoCopy(t, "BACKUP_DESTINATION="+dest, "DUPLICATI_PORT="+port, "DUPLICATI_PASSWORD=pw", "NTFY_PUBLISH_AUTH=QmVhcmVyIHRrX2FiYw")
	out := &bytes.Buffer{}
	h, err := newHomelab(&ui.UI{Out: out}, root)
	if err != nil {
		t.Fatal(err)
	}

	// The mount is stale until Duplicati is recreated: the setup recreates
	// it, and then Duplicati sees the folders.
	if err := h.duplicatiSetup(context.Background(), []string{"--apply"}); err != nil {
		t.Fatalf("%v\n%s", err, out)
	}
	var names []string
	for _, c := range created {
		b := c["Backup"].(map[string]any)
		names = append(names, b["Name"].(string))
		if !strings.HasPrefix(b["TargetURL"].(string), "file:///destination/") {
			t.Errorf("target %v", b["TargetURL"])
		}
	}
	if strings.Join(names, ",") != "Homelab Databases,Homelab AppData,Homelab Stack Data,Homelab Infrastructure" {
		t.Fatalf("created %v: Secrets exists, photos, Jellyfin and books are empty\n%s", names, out)
	}
	if len(ran) != 3 || len(repaired) != 1 || repaired[0] != "/api/v1/backup/3/repair" {
		t.Errorf("first runs %v, repairs %v: the AppData job (ID 3) should be repaired, not run", ran, repaired)
	}
	if !strings.Contains(readCalls(t, calls), "up --detach --force-recreate duplicati") || !strings.Contains(out.String(), "Duplicati sees the backup folder") {
		t.Errorf("Duplicati was not recreated for the new folder:\n%s\n%s", readCalls(t, calls), out)
	}
	if options["--send-http-url"] != "http://ntfy:80/duplicati-alerts?auth=QmVhcmVyIHRrX2FiYw" || options["--send-http-level"] != "Warning,Error,Fatal" {
		t.Errorf("alerts: %v", options)
	}
	env := h.envMap()
	for _, k := range []string{"DUPLICATI_SECRETS_PASSPHRASE", "DUPLICATI_PASSPHRASE"} {
		if v := env[k]; len(v) < 32 || v == "__REPLACE_ME__" {
			t.Errorf("%s not generated: %q", k, v)
		}
	}
	if _, err := os.Stat(filepath.Join(dest, "appdata")); err != nil {
		t.Error("the job folders should be made in BACKUP_DESTINATION")
	}
	if _, err := os.Stat(filepath.Join(root, "recovery-staging", "volumes")); err != nil {
		t.Error("the staging folders should exist for the first run")
	}
	if strings.Contains(out.String(), env["DUPLICATI_PASSPHRASE"]) {
		t.Error("a passphrase was printed")
	}
}

func TestDuplicatiDestination(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	root, _ := repoCopy(t)
	if out, code := homelabCmd(t, root, "", "duplicati", "destination", "--apply"); code == 0 || !strings.Contains(out, "no Proton Drive folder") {
		t.Fatalf("without Proton Drive: exit %d\n%s", code, out)
	}
	drive := filepath.Join(home, "Library", "CloudStorage", "ProtonDrive-you@proton.me-folder")
	_ = os.MkdirAll(drive, 0o755)
	if out, code := homelabCmd(t, root, "", "duplicati", "destination", "--apply"); code != 0 {
		t.Fatalf("exit %d\n%s", code, out)
	}
	want := filepath.Join(drive, "Homelab Backups")
	if st, err := os.Stat(want); err != nil || !st.IsDir() {
		t.Fatal("the folder was not made")
	}
	env, _ := os.ReadFile(filepath.Join(root, ".env"))
	if !strings.Contains(string(env), "Homelab Backups") {
		t.Fatalf("BACKUP_DESTINATION not saved:\n%s", env)
	}
	other := t.TempDir()
	if out, code := homelabCmd(t, root, "", "duplicati", "destination", other, "--apply"); code != 0 {
		t.Fatalf("named folder: exit %d\n%s", code, out)
	}
	if env, _ := os.ReadFile(filepath.Join(root, ".env")); !strings.Contains(string(env), "BACKUP_DESTINATION="+other) {
		t.Fatalf("named folder not saved:\n%s", env)
	}
}
