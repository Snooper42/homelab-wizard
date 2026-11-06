package main

import (
	"bytes"
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// TestBackupCheck: homelab backup-check checks each job that has run
// with Duplicati's own Verify and keeps what it found; a damaged file
// makes the watchdog count the job as failing, with the check's words
// rather than "the last run failed" (Duplicati keeps the check's failure
// as the job's last error, as 2.4.1 did here), and a later check that
// passes makes it well again.
func TestBackupCheck(t *testing.T) {
	var mu sync.Mutex
	damaged, lastError := true, ""
	verified := map[string]int{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.URL.Path {
		case "/api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "/api/v1/backups":
			meta := `"LastBackupFinished":"` + time.Now().UTC().Add(-2*time.Hour).Format("20060102T150405Z") + `"`
			if lastError != "" {
				meta += `,"LastErrorDate":"` + lastError + `","LastErrorMessage":"Hash mismatch on file \"duplicati-b9.dblock.zip.aes\", recorded hash: x=, actual hash y="`
			}
			w.Write([]byte(`[{"Backup":{"ID":"1","Name":"Homelab Apps","Metadata":{` + meta + `}}},{"Backup":{"ID":"2","Name":"Homelab Photos","Metadata":{}}}]`))
		case "/api/v1/backup/1/verify", "/api/v1/backup/2/verify":
			verified[r.URL.Path]++
			w.Write([]byte(`{"ID":9,"Status":"OK"}`))
		case "/api/v1/task/9":
			if damaged {
				lastError = time.Now().UTC().Format("20060102T150405Z")
				w.Write([]byte(`{"ErrorMessage":"Hash mismatch on file \"duplicati-b9.dblock.zip.aes\", recorded hash: x=, actual hash y=","ID":9,"Status":"Failed"}`))
				return
			}
			w.Write([]byte(`{"ErrorMessage":null,"ID":9,"Status":"Completed"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	_, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	fakeDocker(t, []docker.FakeContainer{{Name: "homelab_system-duplicati-1", Image: "lscr.io/linuxserver/duplicati:latest", Running: true, Project: "homelab_system", Service: "duplicati"}})
	root, _ := repoCopy(t, "DUPLICATI_PASSWORD=pw", "DUPLICATI_PORT="+port)
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	report := detect.Analyze(h.catalog, []docker.Container{{Name: "duplicati", Running: true, Labels: map[string]string{
		"com.docker.compose.project": "homelab_system", "com.docker.compose.service": "duplicati",
	}}})
	watch := func() string {
		for _, r := range h.duplicatiChecks(context.Background(), report, map[string]string{"DUPLICATI_PASSWORD": "pw", "DUPLICATI_PORT": port}, time.Now()) {
			if r.Name == "duplicati Homelab Apps" && !r.OK() {
				return r.Problem()
			}
		}
		return ""
	}

	out, code := homelabCmd(t, root, "", "backup-check")
	if code == 0 || !strings.Contains(out, `Homelab Apps: Hash mismatch on file "duplicati-b9.dblock.zip.aes"`) || strings.Contains(out, "recorded hash") {
		t.Fatalf("a damaged file (exit %d):\n%s", code, out)
	}
	if verified["/api/v1/backup/2/verify"] != 0 {
		t.Error("checked a job that never ran")
	}
	if k := duplicati.LoadChecks(duplicati.CheckPath(root)).Jobs["Homelab Apps"]; k.Problem == "" || k.When.IsZero() {
		t.Fatalf("kept %+v", k)
	}
	if p := watch(); !strings.Contains(p, "the check of its backup on") || !strings.Contains(p, "a version may not restore") || strings.Contains(p, "last run failed") {
		t.Fatalf("the watchdog says: %q", p)
	}

	mu.Lock()
	damaged = false
	mu.Unlock()
	if out, code := homelabCmd(t, root, "", "backup-check"); code != 0 || !strings.Contains(out, "a sample of its files matches") {
		t.Fatalf("after a repair (exit %d):\n%s", code, out)
	}
	if p := watch(); p != "" {
		t.Fatalf("still failing once a check passed: %q", p)
	}
}

// TestVerifyDue: the check is due once a week, from Sunday at verifyHour,
// at the first chance after if the machine was off then.
func TestVerifyDue(t *testing.T) {
	at := func(day, hour int) time.Time { return time.Date(2026, 11, day, hour, 0, 0, 0, time.Local) } // 8 Nov 2026 is a Sunday
	for _, c := range []struct {
		now, last time.Time
		due       bool
	}{
		{at(8, 6), at(1, 7), false},     // Sunday before 7: last Sunday's stands
		{at(8, 7), at(1, 7), true},      // Sunday 7:00
		{at(8, 9), at(8, 7), false},     // done this morning
		{at(11, 12), at(1, 8), true},    // off on Sunday: Wednesday then
		{at(14, 23), at(11, 12), false}, // done Wednesday: not again until Sunday
		{at(8, 8), time.Time{}, true},   // never checked
		{at(15, 7), at(8, 7), true},     // the next Sunday
		{at(7, 23), at(1, 7), false},    // Saturday night
	} {
		if got := verifyDue(c.now, c.last); got != c.due {
			t.Errorf("verifyDue(%s, %s) = %v, want %v", c.now.Format("Mon 2 15:04"), c.last.Format("Mon 2 15:04"), got, c.due)
		}
	}
}
