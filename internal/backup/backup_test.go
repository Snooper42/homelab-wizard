package backup

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

type fakeExec struct {
	out  string
	err  error
	args []string
}

func (f *fakeExec) ExecTo(_ context.Context, w io.Writer, container string, args ...string) error {
	f.args = append([]string{container}, args...)
	_, _ = io.WriteString(w, f.out)
	return f.err
}

func TestPostgresDump(t *testing.T) {
	dir := t.TempDir()
	ex := &fakeExec{out: "CREATE ROLE x;\n--\n-- PostgreSQL database cluster dump complete\n--\n"}
	now := time.Date(2026, 10, 9, 4, 30, 0, 0, time.UTC)
	path, err := PostgresDump(context.Background(), ex, "homelab_paperless-paperless-db-1", dir, "paperless-db", now)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(path) != "paperless-db-20261009-043000.sql.gz" {
		t.Fatalf("path %s", path)
	}
	if !strings.Contains(strings.Join(ex.args, " "), `pg_dumpall --clean --if-exists -U "$POSTGRES_USER"`) {
		t.Fatalf("command %v", ex.args)
	}
	f, _ := os.Open(path)
	defer f.Close()
	zr, err := gzip.NewReader(f)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(zr)
	if string(data) != ex.out {
		t.Fatalf("dump content %q", data)
	}
	if info, _ := os.Stat(path); runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 { // no permission bits on Windows
		t.Fatalf("dump mode %v", info.Mode())
	}
}

func TestIncompleteDumpIsRejected(t *testing.T) {
	dir := t.TempDir()
	for _, ex := range []*fakeExec{{out: "CREATE ROLE x;\n"}, {out: "partial", err: fmt.Errorf("connection lost")}} {
		if _, err := PostgresDump(context.Background(), ex, "db", dir, "db", time.Now()); err == nil {
			t.Fatalf("%+v should fail", ex)
		}
	}
	if left, _ := filepath.Glob(filepath.Join(dir, "*")); len(left) != 0 {
		t.Fatalf("failed dumps must not leave files: %v", left)
	}
}

func TestRotate(t *testing.T) {
	dir := t.TempDir()
	for i := 1; i <= 9; i++ {
		_ = os.WriteFile(filepath.Join(dir, fmt.Sprintf("db-2026100%d-043000.sql.gz", i)), nil, 0o600)
	}
	_ = os.WriteFile(filepath.Join(dir, "other-20261001-043000.sql.gz"), nil, 0o600)
	removed, err := Rotate(dir, "db", 7)
	if err != nil || len(removed) != 2 || !strings.Contains(removed[0], "20261001") {
		t.Fatalf("removed %v %v", removed, err)
	}
	if left, _ := filepath.Glob(filepath.Join(dir, "*.sql.gz")); len(left) != 8 {
		t.Fatalf("left %d files (other prefixes must be kept)", len(left))
	}
}

func TestCopyVerifiedAndRestoreCheck(t *testing.T) {
	orig, restored := t.TempDir(), t.TempDir()
	for i := 0; i < 10; i++ {
		name := filepath.Join("sub", fmt.Sprintf("f%d.txt", i))
		_ = os.MkdirAll(filepath.Join(orig, "sub"), 0o755)
		_ = os.WriteFile(filepath.Join(orig, name), []byte(fmt.Sprint(i)), 0o644)
		if _, err := CopyVerified(filepath.Join(orig, name), filepath.Join(restored, name)); err != nil {
			t.Fatal(err)
		}
	}
	_ = os.WriteFile(filepath.Join(restored, "sub", "f3.txt"), []byte("changed"), 0o644)
	_ = os.WriteFile(filepath.Join(restored, "extra.txt"), []byte("x"), 0o644)
	r, err := VerifyRestore(restored, orig, 0)
	if err != nil {
		t.Fatal(err)
	}
	if r.Checked != 11 || r.Matched != 9 || len(r.Different) != 1 || len(r.Missing) != 1 {
		t.Fatalf("report %+v", r)
	}
	if r, _ := VerifyRestore(restored, orig, 4); r.Checked != 4 {
		t.Fatalf("sampling: %+v", r)
	}
}

func TestRestoreCheckLinesUpAndToleratesLiveFiles(t *testing.T) {
	orig, restored := t.TempDir(), t.TempDir()
	// Duplicati dropped the common "kuma/" folder from the restore.
	_ = os.MkdirAll(filepath.Join(orig, "kuma"), 0o755)
	for _, n := range []string{"config.json", "kuma.db"} {
		_ = os.WriteFile(filepath.Join(orig, "kuma", n), []byte("backed up"), 0o644)
		_ = os.WriteFile(filepath.Join(restored, n), []byte("backed up"), 0o644)
	}
	// The live database changed after the backup.
	backedUp := time.Now().Add(-time.Hour)
	_ = os.Chtimes(filepath.Join(restored, "kuma.db"), backedUp, backedUp)
	_ = os.WriteFile(filepath.Join(orig, "kuma", "kuma.db"), []byte("newer rows"), 0o644)
	r, err := VerifyRestore(restored, orig, 0)
	if err != nil {
		t.Fatal(err)
	}
	if r.Prefix != "kuma" || r.Matched != 1 || len(r.Changed) != 1 || len(r.Different) != 0 || len(r.Missing) != 0 {
		t.Fatalf("report %+v", r)
	}
}

type fakeRun struct{ out []byte }

func (f fakeRun) RunTo(_ context.Context, w io.Writer, _ ...string) error {
	_, err := w.Write(f.out)
	return err
}

func TestVolumeArchive(t *testing.T) {
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(zw)
	for _, name := range []string{"a.pdf", "b.jpg"} {
		_ = tw.WriteHeader(&tar.Header{Name: name, Mode: 0o644, Size: 1})
		_, _ = tw.Write([]byte("x"))
	}
	_ = tw.Close()
	_ = zw.Close()
	dir := t.TempDir()
	path, n, err := VolumeArchive(context.Background(), fakeRun{buf.Bytes()}, "homelab_budget_tracker_moneymatter-attachments", dir, "moneymatter-attachments", time.Now())
	if err != nil || n != 2 || !strings.HasSuffix(path, ".tar.gz") {
		t.Fatalf("archive: %s %d %v", path, n, err)
	}
	if _, _, err := VolumeArchive(context.Background(), fakeRun{[]byte("not a tarball")}, "v", dir, "broken", time.Now()); err == nil {
		t.Fatal("an unreadable archive must fail")
	}
	if left, _ := filepath.Glob(filepath.Join(dir, "broken*")); len(left) != 0 {
		t.Fatalf("failed archives must not be kept: %v", left)
	}
}

type liteRun struct {
	out  string
	err  error
	args []string
}

func (f *liteRun) RunTo(_ context.Context, w io.Writer, args ...string) error {
	f.args = args
	_, _ = w.Write([]byte(f.out))
	return f.err
}

func TestSQLiteDump(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2026, 10, 10, 4, 30, 0, 0, time.UTC)
	ok := &liteRun{out: "SQLite format 3\x00rest of the database"}
	path, err := SQLiteDump(context.Background(), ok, "vaultwarden", "/data/db.sqlite3", dir, "vaultwarden", now)
	if err != nil || filepath.Base(path) != "vaultwarden-20261010-043000.sqlite.gz" {
		t.Fatalf("dump: %s %v", path, err)
	}
	if strings.Join(ok.args[:3], " ") != "--volumes-from vaultwarden "+SQLiteImage || ok.args[len(ok.args)-1] != "/data/db.sqlite3" {
		t.Errorf("args: %v", ok.args)
	}
	if fi, _ := os.Stat(path); runtime.GOOS != "windows" && fi.Mode().Perm() != 0o600 { // no permission bits on Windows
		t.Errorf("mode %v", fi.Mode().Perm())
	}
	if _, err := SQLiteDump(context.Background(), &liteRun{out: "<html>not a db"}, "x", "/d.db", dir, "x", now); err == nil {
		t.Error("output that is not a SQLite database must fail")
	}
	missing := &liteRun{err: fmt.Errorf("docker run --rm ... sh /d.db: no database at /d.db")}
	if _, err := SQLiteDump(context.Background(), missing, "x", "/d.db", dir, "x", now); !errors.Is(err, ErrNoDatabase) {
		t.Errorf("missing database: %v", err)
	}
	// Rotation counts SQLite copies and never removes the newest.
	for i := 1; i <= 3; i++ {
		_ = os.WriteFile(filepath.Join(dir, fmt.Sprintf("vaultwarden-2026100%d-043000.sqlite.gz", i)), nil, 0o600)
	}
	if removed, _ := Rotate(dir, "vaultwarden", 0); len(removed) != 3 {
		t.Errorf("keep 0 should still keep the newest: removed %v", removed)
	}
}
