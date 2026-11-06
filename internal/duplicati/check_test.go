package duplicati

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

// TestVerify: Verify starts Duplicati's check and waits for its task; a
// damaged file comes back as the problem (as Duplicati 2.4.1 answered when
// a block file was changed at its destination), a passing check as none.
func TestVerify(t *testing.T) {
	pollEvery = time.Millisecond
	damaged := false
	polls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/auth/login":
			w.Write([]byte(`{"AccessToken":"tok"}`))
		case "/api/v1/backup/1/verify":
			if r.Method != http.MethodPost {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
			polls = 0
			w.Write([]byte(`{"ID":4,"Status":"OK"}`))
		case "/api/v1/task/4":
			polls++
			switch {
			case polls < 3:
				w.Write([]byte(`{"ErrorMessage":null,"Exception":null,"ID":4,"Status":"Running","TaskFinished":null}`))
			case damaged:
				w.Write([]byte(`{"ErrorMessage":"Hash mismatch on file \"duplicati-bae9.dblock.zip.aes\", recorded hash: ttOt=, actual hash lNhZ=","ID":4,"Status":"Failed"}`))
			default:
				w.Write([]byte(`{"ErrorMessage":null,"Exception":null,"ID":4,"Status":"Completed"}`))
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
	if p, err := c.Verify(ctx, "1", time.Minute); p != "" || err != nil {
		t.Fatalf("a good backup: %q %v", p, err)
	}
	damaged = true
	p, err := c.Verify(ctx, "1", time.Minute)
	if err != nil || ShortProblem(p) != `Hash mismatch on file "duplicati-bae9.dblock.zip.aes"` {
		t.Fatalf("a damaged one: %q %v", p, err)
	}
	if _, err := c.Verify(ctx, "2", time.Minute); err == nil {
		t.Fatal("a job Duplicati has not: no error")
	}
}

// TestWithChecks: each job gets its last check; Duplicati's own record of
// a failed check (the job's last error) is the check's, not a run's, and
// one a later check cleared is well again; a run that failed after the
// check stays failed.
func TestWithChecks(t *testing.T) {
	sun := time.Date(2026, 11, 8, 7, 1, 0, 0, time.UTC)
	bad := `Hash mismatch on file "duplicati-b.dblock.zip.aes"`
	path := filepath.Join(t.TempDir(), "data", "backup-check.json")
	c := Checks{At: sun, Jobs: map[string]Check{
		"Damaged": {When: sun, Problem: bad},
		"Cleared": {When: sun, Cleared: bad},
		"Run":     {When: sun},
	}}
	if err := c.Save(path); err != nil {
		t.Fatal(err)
	}
	c = LoadChecks(path)
	jobs := WithChecks([]Job{
		{Name: "Damaged", State: "failed", LastError: sun.Add(-time.Second), ErrorMessage: bad + ", recorded hash: x=, actual hash y="},
		{Name: "Cleared", State: "failed", LastError: sun.Add(-time.Hour), ErrorMessage: bad + ", recorded hash: x=, actual hash y="},
		{Name: "Run", State: "failed", LastError: sun.Add(time.Hour), ErrorMessage: "the destination is full"},
		{Name: "Never checked", State: "ok"},
	}, c)
	want := []struct{ state, problem string }{{"ok", bad}, {"ok", ""}, {"failed", ""}, {"ok", ""}}
	for i, w := range want {
		if jobs[i].State != w.state || jobs[i].CheckProblem != w.problem {
			t.Errorf("%s: state %q problem %q, want %q %q", jobs[i].Name, jobs[i].State, jobs[i].CheckProblem, w.state, w.problem)
		}
	}
	if !jobs[0].Checked.Equal(sun) || !jobs[3].Checked.IsZero() {
		t.Errorf("checked: %v %v", jobs[0].Checked, jobs[3].Checked)
	}
	if got := LoadChecks(filepath.Join(t.TempDir(), "none.json")); got.Jobs == nil || !got.At.IsZero() {
		t.Errorf("none kept: %+v", got)
	}
}
