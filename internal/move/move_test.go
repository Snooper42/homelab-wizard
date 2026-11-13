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

// A bundle leaves out what stands for a job running on this machine: a
// job's place in the queue, a record's lock, a save half made. On the new
// machine they would stand for a job that is not there, and hold its jobs up.
func TestPackLeavesThisMachinesJobsBehind(t *testing.T) {
	src := t.TempDir()
	now := time.Now()
	write(t, src, ".env", "TZ=UTC\n", now)
	write(t, src, "data/stopped.json", "{}\n", now)
	write(t, src, "data/turns/00000000000000000001-4242.json", `{"pid":4242}`, now)
	write(t, src, "data/stopped.json.lock", "", now)
	write(t, src, "data/homelab.media.lock", `{"pid":4242}`, now)
	write(t, src, "data/started.json.tmp123", "{", now)
	var b bytes.Buffer
	if _, err := Pack(src, Manifest{Made: now}, &b); err != nil {
		t.Fatal(err)
	}
	var names []string
	tr := tar.NewReader(&b)
	for {
		h, err := tr.Next()
		if err != nil {
			break
		}
		names = append(names, filepath.ToSlash(h.Name))
	}
	all := strings.Join(names, " ")
	if !strings.Contains(all, "data/stopped.json") {
		t.Fatalf("the record itself was left out: %v", names)
	}
	for _, gone := range []string{"data/turns", ".lock", ".tmp"} {
		if strings.Contains(all, gone) {
			t.Errorf("%s went in the bundle: %v", gone, names)
		}
	}
}

// A move file someone else made can hold what Pack leaves out: a ticket
// for PID 1 (always running) dated in the future would stand first in the
// queue for good, and every change (the nightly backup, updates, a phone's
// Restart) would wait behind it; a lock would hold its record or Tidy Up.
// Unpack leaves them out as Pack does.
func TestUnpackLeavesOutAnotherMachinesJobs(t *testing.T) {
	var b bytes.Buffer
	tw := tar.NewWriter(&b)
	add := func(name, body string) {
		_ = tw.WriteHeader(&tar.Header{Name: name, Mode: 0o600, Size: int64(len(body)), Typeflag: tar.TypeReg})
		_, _ = tw.Write([]byte(body))
	}
	add(ManifestName, `{"made":"2026-10-01T00:00:00Z","from":"x"}`)
	add("data/stopped.json", "{}\n")
	_ = tw.WriteHeader(&tar.Header{Name: "data/turns/", Mode: 0o700, Typeflag: tar.TypeDir})
	add("data/turns/00000000000000000000-1.json", `{"pid":1,"what":"a job","at":"2099-01-01T00:00:00Z"}`)
	add("data/homelab.media.lock", `{"pid":1}`)
	add("data/stopped.json.lock", "")
	add("data/started.json.tmp123", "{")
	_ = tw.Close()
	bundle := filepath.Join(t.TempDir(), "crafted.tar")
	_ = os.WriteFile(bundle, b.Bytes(), 0o600)
	root := filepath.Join(t.TempDir(), "root")
	if _, _, err := Unpack(bundle, root); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "data", "stopped.json")); err != nil {
		t.Fatalf("the record itself was left out: %v", err)
	}
	for _, gone := range []string{"data/turns", "data/homelab.media.lock", "data/stopped.json.lock", "data/started.json.tmp123"} {
		if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(gone))); !os.IsNotExist(err) {
			t.Errorf("%s was unpacked: %v", gone, err)
		}
	}
}

// Tidy Up's records name paths on the computer they were made on: what its
// Trash holds, what it filed today and from where, and the downloads in its
// own Downloads waiting to be named. On another computer they mean nothing,
// and one someone else made could have Undo or Needs a look act on any file
// here (N58, N59, N62). Neither end of a move carries them.
func TestTidyUpsRecordsStayOnTheirComputer(t *testing.T) {
	records := []string{"data/media-trash.jsonl", "data/media-filed.jsonl", "data/media-needs.json"}
	src := t.TempDir()
	now := time.Now()
	write(t, src, "data/stopped.json", "{}\n", now)
	for _, r := range records {
		write(t, src, r, "{}\n", now)
	}
	var b bytes.Buffer
	if _, err := Pack(src, Manifest{Made: now}, &b); err != nil {
		t.Fatal(err)
	}
	tr := tar.NewReader(bytes.NewReader(b.Bytes()))
	for {
		h, err := tr.Next()
		if err != nil {
			break
		}
		for _, r := range records {
			if filepath.ToSlash(h.Name) == r {
				t.Errorf("%s went in the bundle", r)
			}
		}
	}

	var c bytes.Buffer
	tw := tar.NewWriter(&c)
	add := func(name, body string) {
		_ = tw.WriteHeader(&tar.Header{Name: name, Mode: 0o600, Size: int64(len(body)), Typeflag: tar.TypeReg})
		_, _ = tw.Write([]byte(body))
	}
	add(ManifestName, `{"made":"2026-10-01T00:00:00Z","from":"x"}`)
	add("data/stopped.json", "{}\n")
	for _, r := range records {
		add(r, `{"run":"x","from":"/home/someone/.config/autostart/evil.desktop","to":"/tmp/x"}`+"\n")
	}
	_ = tw.Close()
	bundle := filepath.Join(t.TempDir(), "crafted.tar")
	_ = os.WriteFile(bundle, c.Bytes(), 0o600)
	root := filepath.Join(t.TempDir(), "root")
	if _, _, err := Unpack(bundle, root); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "data", "stopped.json")); err != nil {
		t.Fatalf("the rest of data/ was left out: %v", err)
	}
	for _, r := range records {
		if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(r))); !os.IsNotExist(err) {
			t.Errorf("%s was unpacked: %v", r, err)
		}
	}
}
