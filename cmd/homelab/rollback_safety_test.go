package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// docs/SRE-Audit-2026-11.md, H1: psql carries on past an error and exits 0.
// Only the errors every pg_dumpall --clean load prints are let through.
func TestDumpErrors(t *testing.T) {
	expected := "psql:<stdin>:14: ERROR:  current user cannot be dropped\npsql:<stdin>:22: ERROR:  role \"immich\" already exists\nSET\nWARNING:  SET LOCAL can only be used in transaction blocks\n"
	if bad := dumpErrors([]byte(expected)); len(bad) != 0 {
		t.Errorf("the expected errors failed it: %q", bad)
	}
	for _, line := range []string{
		`psql:<stdin>:40: ERROR:  database "immich" is being accessed by other users`,
		`psql:<stdin>:90: ERROR:  relation "assets" already exists`,
		`psql:<stdin>:91: ERROR:  duplicate key value violates unique constraint "assets_pkey"`,
		`psql: FATAL:  the database system is shutting down`,
	} {
		bad := dumpErrors([]byte(expected + line + "\n"))
		if len(bad) != 1 || bad[0] != line {
			t.Errorf("%s: %q", line, bad)
		}
	}
}

// Immich's own restore instructions relax the dump's empty search_path; every
// other byte goes through as it was, a long COPY line and a last line without
// its newline included.
func TestSearchPathRelaxed(t *testing.T) {
	long := strings.Repeat("x", 200<<10)
	in := "-- dump\n" + string(searchPathEmpty) + "\n" + long + "\nSELECT 1;\r\n" + string(searchPathEmpty) + "\r\nlast"
	want := "-- dump\n" + string(searchPathDefault) + "\n" + long + "\nSELECT 1;\r\n" + string(searchPathDefault) + "\r\nlast"
	got, err := io.ReadAll(searchPathRelaxed(strings.NewReader(in)))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != want {
		t.Errorf("got %d bytes, want %d (the lines differ)", len(got), len(want))
	}
	// A reader that fails part way fails the load, not a short dump read as whole.
	_, err = io.ReadAll(searchPathRelaxed(io.MultiReader(strings.NewReader("SELECT 1;\n"), errReader{})))
	if err == nil {
		t.Error("a broken dump read as whole")
	}
}

type errReader struct{}

func (errReader) Read([]byte) (int, error) { return 0, io.ErrUnexpectedEOF }

func gzipped(t *testing.T, path, text string) {
	t.Helper()
	var b bytes.Buffer
	zw := gzip.NewWriter(&b)
	_, _ = zw.Write([]byte(text))
	_ = zw.Close()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, b.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
}

// A dump that does not load cleanly is an error, not "loaded"; the database's
// other sessions are ended before it, and what psql gets has the relaxed
// search_path.
func TestRestoreDumpChecksThatItLoaded(t *testing.T) {
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	calls := fakeDocker(t, nil)
	client, err := h.docker(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	dump := filepath.Join(t.TempDir(), "immich-database-20261127-010000.sql.gz")
	gzipped(t, dump, string(searchPathEmpty)+"\nCREATE TABLE assets (id int);\n-- PostgreSQL database cluster dump complete\n")

	t.Setenv("FAKE_PSQL_OUT", `psql:<stdin>:3: ERROR:  current user cannot be dropped\npsql:<stdin>:5: ERROR:  role "postgres" already exists\n`)
	if out, err := restoreDump(context.Background(), client, "immich_postgres", dump); err != nil {
		t.Fatalf("a clean load failed: %v\n%s", err, out)
	}
	log := readCalls(t, calls)
	end, load := strings.Index(log, "pg_terminate_backend"), strings.Index(log, "exec -i immich_postgres")
	if end < 0 || load < end {
		t.Fatalf("the other sessions are ended before the load:\n%s", log)
	}
	sent, _ := os.ReadFile(filepath.Join(filepath.Dir(calls), "psql-stdin.sql"))
	if !bytes.Contains(sent, searchPathDefault) || bytes.Contains(sent, searchPathEmpty) || !bytes.Contains(sent, []byte("CREATE TABLE assets")) {
		t.Errorf("psql was sent:\n%s", sent)
	}

	// A newer version's migration had already made the table: the load
	// half failed, and says so.
	t.Setenv("FAKE_PSQL_OUT", `psql:<stdin>:3: ERROR:  current user cannot be dropped\npsql:<stdin>:9: ERROR:  relation "assets" already exists\n`)
	_, err = restoreDump(context.Background(), client, "immich_postgres", dump)
	if err == nil || !strings.Contains(err.Error(), `relation "assets" already exists`) {
		t.Fatalf("a half-loaded dump read as loaded: %v", err)
	}
}

// docs/SRE-Audit-2026-11.md, H2: a rollback whose data went back only in part
// leaves the app stopped, on neither image, and says where today's data is,
// rather than starting the older image on a mix of both days.
func TestARollbackThatPutsBackOnlyPartLeavesTheAppStopped(t *testing.T) {
	root, _ := repoCopy(t)
	_ = os.MkdirAll(filepath.Join(root, "data", "appdata", "ntfy"), 0o755)
	fakeDocker(t, []docker.FakeContainer{ntfyWith(root, "sha256:old")})
	t.Setenv("FAKE_IMAGE_ID", "sha256:new")
	if out, code := homelabCmd(t, root, "", "update", "ntfy"); code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	path := updates.HistoryPath(root)
	hist := updates.LoadHistory(path)
	hist.Apps["ntfy"] = &updates.Record{Ref: "binwiederhier/ntfy:latest", Current: "sha256:new", Previous: "sha256:old", Updated: time.Now().Add(-time.Hour)}
	if err := hist.Save(path); err != nil {
		t.Fatal(err)
	}
	calls := fakeDocker(t, []docker.FakeContainer{ntfyWith(root, "sha256:new")})
	t.Setenv("FAKE_LOAD_FAILS", "1")

	out, code := homelabCmd(t, root, "", "rollback", "ntfy", "--apply")
	log := readCalls(t, calls)
	if code == 0 || !strings.Contains(out, "left stopped") || !strings.Contains(out, "recovery-staging/rolled-back/ntfy") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if strings.Contains(log, "up --detach --no-deps --force-recreate ntfy") {
		t.Fatalf("started on half put-back data:\n%s", log)
	}
	if dirs, _ := filepath.Glob(filepath.Join(root, "recovery-staging", "rolled-back", "ntfy", "*", "*.tar.gz")); len(dirs) != 2 {
		t.Errorf("today's data set aside before anything was put back: %v", dirs)
	}
	// Not recorded as rolled back: it can be tried again.
	if r := updates.LoadHistory(path).Apps["ntfy"]; r == nil || !r.RolledBack.IsZero() || r.Previous != "sha256:old" {
		t.Errorf("recorded as rolled back: %+v", r)
	}

	// --data, after a rollback that kept today's data, does the same.
	hist = updates.LoadHistory(path)
	hist.Apps["ntfy"] = &updates.Record{Ref: "binwiederhier/ntfy:latest", Current: "sha256:old", RolledBack: time.Now(), Updated: time.Now().Add(-time.Hour)}
	if err := hist.Save(path); err != nil {
		t.Fatal(err)
	}
	calls = fakeDocker(t, []docker.FakeContainer{ntfyWith(root, "sha256:old")})
	out, code = homelabCmd(t, root, "", "rollback", "ntfy", "--data", "--apply")
	if code == 0 || !strings.Contains(out, "left stopped") || strings.Contains(readCalls(t, calls), "up --detach --no-deps ntfy") {
		t.Fatalf("--data: exit %d\n%s\n%s", code, out, readCalls(t, calls))
	}
}

// docs/SRE-Audit-2026-11.md, H3: the copy kept before an update holds only a
// dump made for that update. An older one, left from a night when the
// database ran, would take the database back to that night on a rollback.
func TestAStaleDumpIsNotKeptAsTheOneBeforeAnUpdate(t *testing.T) {
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	fakeDocker(t, nil)
	client, err := h.docker(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	a, ok := h.catalog.Get("paperless")
	if !ok {
		t.Fatal("no paperless in the catalog")
	}
	old := filepath.Join(root, "recovery-staging", "databases", "paperless-db", "paperless-db-20261120-010000.sql.gz")
	gzipped(t, old, "-- PostgreSQL database cluster dump complete\n")
	week := time.Now().Add(-7 * 24 * time.Hour)
	if err := os.Chtimes(old, week, week); err != nil {
		t.Fatal(err)
	}
	ctr := docker.Container{Name: "paperless", ImageID: "sha256:old"}

	// An update that made no dump of it (its database was stopped).
	h.dumpsSince = time.Now().Add(-time.Second)
	cp, err := h.copyBeforeUpdate(context.Background(), client, a, ctr)
	if err != nil {
		t.Fatal(err)
	}
	if len(cp.Dumps) != 0 {
		t.Fatalf("last week's dump kept as the one before this update: %+v", cp.Dumps)
	}
	if said := h.copySaid(cp); !strings.Contains(said, "paperless-db's dump") || !strings.Contains(said, "leaves its database as it is") {
		t.Errorf("not said: %s", said)
	}

	// A command that made no dump at all keeps none either.
	h.dumpsSince = time.Time{}
	if cp, err = h.copyBeforeUpdate(context.Background(), client, a, ctr); err != nil || len(cp.Dumps) != 0 {
		t.Fatalf("no dump made, one kept: %+v %v", cp.Dumps, err)
	}

	// The dump made for this update is kept.
	h.dumpsSince = time.Now().Add(-time.Second)
	fresh := filepath.Join(root, "recovery-staging", "databases", "paperless-db", "paperless-db-"+time.Now().Format("20060102-150405")+".sql.gz")
	gzipped(t, fresh, "-- PostgreSQL database cluster dump complete\n")
	if cp, err = h.copyBeforeUpdate(context.Background(), client, a, ctr); err != nil || len(cp.Dumps) != 1 || cp.Dumps[0].App != "paperless-db" {
		t.Fatalf("today's dump not kept: %+v %v", cp.Dumps, err)
	}
}

// docs/SRE-Audit-2026-11.md, H5 and H6: the nightly backup fails, and so
// alerts, when Duplicati would back up into a folder that isn't there, or back
// up an unplugged drive's empty folder as every photo deleted.
func TestBackupFailsWhenDuplicatiWouldBackUpNothing(t *testing.T) {
	dest, photos := t.TempDir(), t.TempDir()
	root, _ := repoCopy(t, "BACKUP_DESTINATION="+filepath.Join(dest, "unplugged"), "IMMICH_UPLOAD_LOCATION="+photos)
	fakeDocker(t, []docker.FakeContainer{
		{Name: "duplicati", Image: "lscr.io/linuxserver/duplicati:latest", Running: true, Project: "homelab_system", Service: "duplicati"},
	})
	out, code := homelabCmd(t, root, "", "backup", "--apply")
	if code == 0 || !strings.Contains(out, "unplugged is not there") {
		t.Fatalf("a missing backup folder: exit %d\n%s", code, out)
	}

	// The folder there, the photos backed up before, and their drive gone.
	env := filepath.Join(root, ".env")
	data, _ := os.ReadFile(env)
	_ = os.WriteFile(env, []byte(strings.Replace(string(data), filepath.Join(dest, "unplugged"), dest, 1)), 0o600)
	_ = os.MkdirAll(filepath.Join(dest, "photos"), 0o755)
	_ = os.WriteFile(filepath.Join(dest, "photos", "duplicati-20261126T010000Z.dlist.zip.aes"), []byte("x"), 0o644)
	out, code = homelabCmd(t, root, "", "backup", "--apply")
	if code == 0 || !strings.Contains(out, "Homelab Photos: "+photos+" is empty or missing") {
		t.Fatalf("an empty photos folder: exit %d\n%s", code, out)
	}

	// The photos back: the night is fine.
	_ = os.WriteFile(filepath.Join(photos, "IMG_1.HEIC"), []byte("x"), 0o644)
	if out, code := homelabCmd(t, root, "", "backup", "--apply"); code != 0 {
		t.Fatalf("all there: exit %d\n%s", code, out)
	}
}
