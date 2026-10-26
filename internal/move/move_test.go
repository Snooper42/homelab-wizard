package move

import (
	"archive/tar"
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func write(t *testing.T, root, rel, body string, when time.Time) {
	t.Helper()
	p := filepath.Join(root, rel)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	_ = os.Chtimes(p, when, when)
}

func TestPackUnpack(t *testing.T) {
	old, now := time.Now().Add(-48*time.Hour), time.Now().Add(-time.Hour)
	src := t.TempDir()
	write(t, src, ".env", "HOMELAB_DOMAIN=example.com\n", now)
	write(t, src, "data/appdata/mealie/mealie.db", "db", now)
	write(t, src, "data/people.json", "[]", now)
	write(t, src, "stacks/custom/compose.yaml", "services: {}\n", now)
	write(t, src, "recovery-staging/databases/paperless-db/paperless-db-old.sql.gz", "old", old)
	write(t, src, "recovery-staging/databases/paperless-db/paperless-db-new.sql.gz", "new", now)
	write(t, src, "recovery-staging/restore-test/x", "not moved", now)
	write(t, src, "scripts/logs/backup.log", "not moved", now)
	write(t, src, "export-2026-10-01/README.html", "not moved", now)
	_ = os.Symlink("mealie.db", filepath.Join(src, "data/appdata/mealie/link.db"))

	var b bytes.Buffer
	m := Manifest{Made: now, From: "Mac mini", Version: "0.1.0-alpha", Apps: []string{"mealie"}}
	r, err := Pack(src, m, &b)
	if err != nil || len(r.Skipped) != 0 {
		t.Fatalf("%+v %v", r, err)
	}
	bundle := filepath.Join(t.TempDir(), "move.tar")
	_ = os.WriteFile(bundle, b.Bytes(), 0o600)
	if got, err := ReadManifest(bundle); err != nil || got.From != "Mac mini" {
		t.Fatalf("%+v %v", got, err)
	}

	dst := t.TempDir()
	got, n, err := Unpack(bundle, dst)
	if err != nil || n != 5 || got.Apps[0] != "mealie" {
		t.Fatalf("n=%d %+v %v", n, got, err)
	}
	for rel, want := range map[string]string{".env": "HOMELAB_DOMAIN=example.com\n", "data/appdata/mealie/link.db": "db", "recovery-staging/databases/paperless-db/paperless-db-new.sql.gz": "new", "data/homelab-move.json": `"from": "Mac mini"`} {
		data, err := os.ReadFile(filepath.Join(dst, rel))
		if err != nil || !strings.Contains(string(data), want) {
			t.Errorf("%s: %q %v", rel, data, err)
		}
	}
	for _, rel := range []string{"recovery-staging/databases/paperless-db/paperless-db-old.sql.gz", "recovery-staging/restore-test/x", "scripts/logs/backup.log", "export-2026-10-01"} {
		if _, err := os.Stat(filepath.Join(dst, rel)); err == nil {
			t.Errorf("%s was moved", rel)
		}
	}
	if info, _ := os.Stat(filepath.Join(dst, ".env")); runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 { // no permission bits on Windows
		t.Errorf(".env is %v", info.Mode())
	}
}

func TestUnpackRefusesEscapes(t *testing.T) {
	var b bytes.Buffer
	tw := tar.NewWriter(&b)
	data := []byte(`{"made":"2026-10-01T00:00:00Z","from":"x"}`)
	_ = tw.WriteHeader(&tar.Header{Name: ManifestName, Mode: 0o600, Size: int64(len(data)), Typeflag: tar.TypeReg})
	_, _ = tw.Write(data)
	_ = tw.WriteHeader(&tar.Header{Name: "../evil", Mode: 0o600, Size: 1, Typeflag: tar.TypeReg})
	_, _ = tw.Write([]byte("x"))
	_ = tw.Close()
	bundle := filepath.Join(t.TempDir(), "bad.tar")
	_ = os.WriteFile(bundle, b.Bytes(), 0o600)
	if _, _, err := Unpack(bundle, filepath.Join(t.TempDir(), "root")); err == nil || !strings.Contains(err.Error(), "outside") {
		t.Errorf("%v", err)
	}
	notOurs := filepath.Join(t.TempDir(), "other.tar")
	_ = os.WriteFile(notOurs, []byte("not a tar"), 0o600)
	if _, err := ReadManifest(notOurs); err == nil {
		t.Error("read a manifest from a file that is not a move file")
	}
}

// A move file holding a link to another folder, then a file inside the
// link, must not write into that folder.
func TestUnpackRefusesWritingThroughLinks(t *testing.T) {
	outside := t.TempDir()
	var b bytes.Buffer
	tw := tar.NewWriter(&b)
	data := []byte(`{"made":"2026-10-01T00:00:00Z","from":"x"}`)
	_ = tw.WriteHeader(&tar.Header{Name: ManifestName, Mode: 0o600, Size: int64(len(data)), Typeflag: tar.TypeReg})
	_, _ = tw.Write(data)
	_ = tw.WriteHeader(&tar.Header{Name: "data/elsewhere", Linkname: outside, Typeflag: tar.TypeSymlink})
	_ = tw.WriteHeader(&tar.Header{Name: "data/elsewhere/evil", Mode: 0o600, Size: 1, Typeflag: tar.TypeReg})
	_, _ = tw.Write([]byte("x"))
	_ = tw.Close()
	bundle := filepath.Join(t.TempDir(), "bad.tar")
	_ = os.WriteFile(bundle, b.Bytes(), 0o600)
	if _, _, err := Unpack(bundle, filepath.Join(t.TempDir(), "root")); err == nil {
		t.Error("unpacked a file through a link to outside the homelab folder")
	}
	if _, err := os.Stat(filepath.Join(outside, "evil")); err == nil {
		t.Error("wrote a file outside the homelab folder")
	}
}
