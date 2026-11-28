package duplicati

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Each large job has a guard, the others none, and WriteGuards writes one
// runnable file per large job.
func TestWriteGuards(t *testing.T) {
	staging := t.TempDir()
	if err := WriteGuards(staging); err != nil {
		t.Fatal(err)
	}
	for _, j := range HomelabJobs {
		path := filepath.Join(staging, GuardsFolder, j.Folder+".sh")
		_, err := os.Stat(path)
		switch {
		case j.Large && err != nil:
			t.Errorf("%s: no guard: %v", j.Name, err)
		case !j.Large && err == nil:
			t.Errorf("%s has a guard, though it is not a large job", j.Name)
		case j.Large && GuardPath(j) != "/staging/guards/"+j.Folder+".sh":
			t.Errorf("%s: %s", j.Name, GuardPath(j))
		}
	}
	// Written again over an older one, whole.
	if err := WriteGuards(staging); err != nil {
		t.Fatal(err)
	}
	if left, _ := filepath.Glob(filepath.Join(staging, GuardsFolder, "*.new")); len(left) != 0 {
		t.Errorf("left behind: %v", left)
	}
}

// jobAnswer is a job as Duplicati 2.1's GET /api/v1/backup/{id} gives it
// (from the real image, Nov 28, 2026): its passphrase masked.
const jobAnswer = `{"Schedule":{"ID":1,"Tags":["ID=1"],"Time":"2026-11-29T01:00:00Z","Repeat":"1D","Rule":""},
"Backup":{"ID":"1","Name":"Homelab Photos","Description":"","Tags":["homelab"],"TargetURL":"file:///destination/photos","DBPath":"/config/X.sqlite","Sources":["/source/immich/"],
"Settings":[{"Filter":"","Name":"encryption-module","Value":"aes","Argument":null},{"Filter":"","Name":"passphrase","Value":"***************","Argument":null},{"Filter":"","Name":"retention-policy","Value":"1W:1D,4W:1W,12M:1M","Argument":null}],
"Filters":[],"Metadata":{"LastBackupFinished":"20261128T041248Z"},"IsTemporary":false},"DisplayNames":{"/source/immich/":"immich"}}`

// EnsureGuard adds the guard to a job made before it had one, sending the job
// back whole, as Duplicati's own editor does: its masked passphrase and its
// schedule as they came. A job that has it is left alone; one with another
// path gets this one.
func TestEnsureGuard(t *testing.T) {
	var puts []map[string]json.RawMessage
	answer := jobAnswer
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/v1/auth/login":
			_, _ = w.Write([]byte(`{"AccessToken":"t"}`))
		case r.URL.Path == "/api/v1/backup/1" && r.Method == http.MethodGet:
			_, _ = w.Write([]byte(answer))
		case r.URL.Path == "/api/v1/backup/1" && r.Method == http.MethodPut:
			data, _ := io.ReadAll(r.Body)
			var body map[string]json.RawMessage
			if err := json.Unmarshal(data, &body); err != nil {
				t.Errorf("PUT body: %v", err)
			}
			puts = append(puts, body)
			_, _ = w.Write([]byte(`{"Status":"OK"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	c, err := Login(context.Background(), srv.URL, "pw")
	if err != nil {
		t.Fatal(err)
	}
	changed, err := c.EnsureGuard(context.Background(), "1", "/staging/guards/photos.sh")
	if err != nil || !changed || len(puts) != 1 {
		t.Fatalf("added: %v %v, %d PUTs", changed, err, len(puts))
	}
	var backup struct {
		ID, Name  string
		Sources   []string
		Settings  []struct{ Name, Value string }
		TargetURL string
	}
	if err := json.Unmarshal(puts[0]["Backup"], &backup); err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, s := range backup.Settings {
		got[s.Name] = s.Value
	}
	if got[GuardOption] != "/staging/guards/photos.sh" || got["passphrase"] != "***************" || got["retention-policy"] != "1W:1D,4W:1W,12M:1M" || len(got) != 4 {
		t.Errorf("options sent back: %v", got)
	}
	if backup.ID != "1" || backup.Name != "Homelab Photos" || backup.TargetURL != "file:///destination/photos" || len(backup.Sources) != 1 {
		t.Errorf("the job sent back: %+v", backup)
	}
	if !strings.Contains(string(puts[0]["Schedule"]), `"Repeat":"1D"`) {
		t.Errorf("its schedule: %s", puts[0]["Schedule"])
	}

	// Already guarded: nothing sent.
	answer = strings.Replace(jobAnswer, `{"Filter":"","Name":"retention-policy"`, `{"Filter":"","Name":"--run-script-before-required","Value":"/staging/guards/photos.sh","Argument":null},{"Filter":"","Name":"retention-policy"`, 1)
	if changed, err := c.EnsureGuard(context.Background(), "1", "/staging/guards/photos.sh"); err != nil || changed || len(puts) != 1 {
		t.Errorf("already there: %v %v, %d PUTs", changed, err, len(puts))
	}
	// Another path: replaced, not added twice.
	if changed, err := c.EnsureGuard(context.Background(), "1", "/staging/guards/new.sh"); err != nil || !changed || len(puts) != 2 {
		t.Fatalf("replaced: %v %v, %d PUTs", changed, err, len(puts))
	}
	if n := strings.Count(string(puts[1]["Backup"]), "run-script-before-required"); n != 1 || !strings.Contains(string(puts[1]["Backup"]), "/staging/guards/new.sh") {
		t.Errorf("replaced as: %s", puts[1]["Backup"])
	}
	// A job Duplicati doesn't have: an error, nothing sent.
	if _, err := c.EnsureGuard(context.Background(), "9", "/staging/guards/photos.sh"); err == nil || len(puts) != 2 {
		t.Errorf("no such job: %v", err)
	}
}
