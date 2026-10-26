package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// fakeKopia is Kopia's server over data/appdata: one snapshot whose
// objects are the folders' paths, and restores that copy the live file
// into recovery-staging (the container's /staging), damaged when corrupt.
func fakeKopia(t *testing.T, appdata, staging string, corrupt *bool) (*httptest.Server, *[]string) {
	var restored []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, pw, _ := r.BasicAuth(); pw != "pw" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch {
		case r.URL.Path == "/api/v1/snapshots":
			if q := r.URL.Query(); q.Get("userName") != "homelab" || q.Get("host") != "homelab" || q.Get("path") != "/source/appdata" {
				t.Errorf("snapshots of %v", q)
			}
			w.Write([]byte(`{"snapshots":[{"id":"a","rootID":"k-old","startTime":"2026-10-01T03:45:00Z"},{"id":"b","rootID":"k-.","startTime":"2026-10-10T03:45:00Z"}]}`))
		case strings.HasPrefix(r.URL.Path, "/api/v1/objects/k-"):
			rel := strings.TrimPrefix(r.URL.Path, "/api/v1/objects/k-")
			entries, _ := os.ReadDir(filepath.Join(appdata, filepath.FromSlash(rel)))
			var list []map[string]string
			for _, e := range entries {
				list = append(list, map[string]string{"name": e.Name(), "obj": "k-" + filepath.ToSlash(filepath.Join(rel, e.Name()))})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"entries": list})
		case r.URL.Path == "/api/v1/restore":
			var req struct {
				Root     string `json:"root"`
				FSOutput struct {
					TargetPath string `json:"targetPath"`
					SkipOwners bool   `json:"skipOwners"`
				} `json:"fsOutput"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			if !req.FSOutput.SkipOwners {
				t.Error("a restore as you must skip the owners")
			}
			rel := strings.TrimPrefix(req.Root, "k-")
			data, _ := os.ReadFile(filepath.Join(appdata, filepath.FromSlash(rel)))
			if *corrupt && len(restored) == 0 {
				data = append(data, '!')
			}
			dst := filepath.Join(staging, filepath.FromSlash(strings.TrimPrefix(req.FSOutput.TargetPath, "/staging/restore-test/")))
			if err := os.WriteFile(dst, data, 0o644); err != nil {
				t.Errorf("Kopia writes the file into a folder made for it: %v", err)
			}
			restored = append(restored, rel)
			w.Write([]byte(`{"id":"t1"}`))
		case r.URL.Path == "/api/v1/tasks/t1":
			w.Write([]byte(`{"status":"SUCCESS"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, &restored
}

func TestKopiaRestoreTest(t *testing.T) {
	root, _ := repoCopy(t)
	appdata := filepath.Join(root, "data", "appdata")
	old := time.Now().Add(-72 * time.Hour)
	for _, f := range []string{"vikunja/db/vikunja.db", "mealie/data/settings.json", "karakeep/data/db.db", "duplicati/Duplicati-server.sqlite", "kopia/config/repository.config"} {
		p := filepath.Join(appdata, f)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte("contents of "+f), 0o644); err != nil {
			t.Fatal(err)
		}
		_ = os.Chtimes(p, old, old)
	}
	staging := filepath.Join(root, "recovery-staging", "restore-test")
	corrupt := false
	srv, restored := fakeKopia(t, appdata, staging, &corrupt)
	_, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	f, _ := os.OpenFile(filepath.Join(root, ".env"), os.O_APPEND|os.O_WRONLY, 0o600)
	f.WriteString("KOPIA_PORT=" + port + "\nKOPIA_SERVER_PASSWORD=pw\n")
	f.Close()

	out := &bytes.Buffer{}
	h, err := newHomelab(&ui.UI{Out: out}, root)
	if err != nil {
		t.Fatal(err)
	}
	if err := h.restoreTest(context.Background(), []string{"--auto", "--engine", "kopia"}); err != nil {
		t.Fatalf("%v\n%s", err, out)
	}
	if len(*restored) != 3 {
		t.Fatalf("restored %v: want the three apps' files, not Duplicati's or Kopia's own", *restored)
	}
	if _, err := os.Stat(staging); !os.IsNotExist(err) {
		t.Error("a passing restore should be removed")
	}
	l := backup.LoadRestoreLog(h.restoreLogPath())
	if l.LastKopiaTest.IsZero() || !l.LastTest.IsZero() || len(l.History) != 1 || l.History[0].Engine != "kopia" || !strings.Contains(l.History[0].Summary, "3 of 3") {
		t.Errorf("recorded as Kopia's, not Duplicati's: %+v\n%s", l, out)
	}

	corrupt, *restored = true, nil
	if err := h.restoreTest(context.Background(), []string{"--auto", "--engine", "kopia"}); err == nil || !strings.Contains(err.Error(), "1 different") {
		t.Fatalf("a damaged file should fail the test: %v", err)
	}
	if _, err := os.Stat(staging); err != nil {
		t.Error("a failed restore should stay for a look")
	}

	// A wrong password is recorded as a failed drill, in Kopia's words.
	env, _ := os.ReadFile(filepath.Join(root, ".env"))
	_ = os.WriteFile(filepath.Join(root, ".env"), bytes.ReplaceAll(env, []byte("KOPIA_SERVER_PASSWORD=pw"), []byte("KOPIA_SERVER_PASSWORD=nope")), 0o600)
	if err := h.restoreTest(context.Background(), []string{"--auto", "--engine", "kopia"}); err == nil || !strings.Contains(err.Error(), "refused KOPIA_SERVER_PASSWORD") {
		t.Fatalf("a wrong password: %v", err)
	}
	if f, failed := backup.LoadRestoreLog(h.restoreLogPath()).LastFailed(); !failed || !strings.Contains(f.Summary, "Kopia's restore failed") {
		t.Errorf("failure on record: %+v", f)
	}
	if err := h.restoreTest(context.Background(), []string{"--auto", "--engine", "restic"}); err == nil || !strings.Contains(err.Error(), "duplicati or kopia") {
		t.Fatalf("an unknown engine: %v", err)
	}
}

func TestRemindKopiaRestoreTest(t *testing.T) {
	root, _ := repoCopy(t)
	out := &bytes.Buffer{}
	h, err := newHomelab(&ui.UI{Out: out}, root)
	if err != nil {
		t.Fatal(err)
	}
	h.remindKopiaRestoreTest(context.Background())
	if strings.Contains(out.String(), "Kopia") {
		t.Fatalf("Kopia is not set up, yet: %s", out)
	}
	config := filepath.Join(root, "data", "appdata", "kopia", "config", "repository.config")
	_ = os.MkdirAll(filepath.Dir(config), 0o755)
	_ = os.WriteFile(config, []byte("{}"), 0o600)
	h.remindKopiaRestoreTest(context.Background())
	if !strings.Contains(out.String(), "Kopia's monthly restore test is due (last: never)") {
		t.Fatalf("Kopia never tested: %s", out)
	}
	if l := backup.LoadRestoreLog(h.restoreLogPath()); l.LastKopiaReminder.IsZero() || !l.LastReminder.IsZero() {
		t.Errorf("the reminder is Kopia's own: %+v", l)
	}
}

func TestClearRestoreEmptiesReadOnlyFolders(t *testing.T) {
	// As Kopia leaves a folder it restored by itself: read-only.
	dir := filepath.Join(t.TempDir(), "restore-test")
	inner := filepath.Join(dir, "kopia-nightly")
	if err := os.MkdirAll(inner, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(inner, "note.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(inner, 0o555); err != nil {
		t.Fatal(err)
	}
	if err := clearRestore(dir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("still there: %v", err)
	}
}
