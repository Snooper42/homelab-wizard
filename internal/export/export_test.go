package export

import (
	"archive/tar"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// fakeExec answers by the SQL (the last argument).
type fakeExec map[string]string

func (f fakeExec) ExecTo(_ context.Context, w io.Writer, _ string, args ...string) error {
	sql := args[len(args)-1]
	for k, v := range f {
		if strings.Contains(sql, k) {
			if v == "ERR" {
				return errors.New("docker exec … " + sql + ": ERROR:  relation does not exist")
			}
			_, err := io.WriteString(w, v)
			return err
		}
	}
	return nil
}

func TestPostgresTables(t *testing.T) {
	ex := fakeExec{
		"from pg_database": "app\nmy db\n",
		"from pg_tables":   "public|items|public.items\nbudget|tx|budget.tx\n",
		"public.items":     "id\n1\n",
		"budget.tx":        "id,note\n1,coffee\n",
	}
	dir := t.TempDir()
	n, err := PostgresTables(context.Background(), ex, "c", dir)
	if err != nil || n != 4 {
		t.Fatalf("n=%d err=%v", n, err)
	}
	for _, f := range []string{"app/items.csv", "app/budget.tx.csv", "my-db/items.csv"} {
		if _, err := os.Stat(filepath.Join(dir, f)); err != nil {
			t.Error(err)
		}
	}
}

func TestImmichAlbumsFallsBack(t *testing.T) {
	ex := fakeExec{"join album_asset": "ERR", "albums_assets_assets": "\"Summer, 2026\",a@b.c,IMG.HEIC,/usr/src/app/upload/library/a/IMG.HEIC\n"}
	albums, err := ImmichAlbums(context.Background(), ex, "c")
	if err != nil || len(albums) != 1 || albums[0].Album != "Summer, 2026" {
		t.Fatalf("%+v %v", albums, err)
	}
	if _, err := ImmichAlbums(context.Background(), fakeExec{"album": "ERR"}, "c"); err == nil || !strings.Contains(err.Error(), "relation does not exist") {
		t.Errorf("both schemas failing: %v", err)
	}
	path := filepath.Join(t.TempDir(), "albums.csv")
	if err := WriteAlbums(path, albums, func(p string) string { return "photos/" + filepath.Base(p) }); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	if string(data) != "album,owner,file,original\n\"Summer, 2026\",a@b.c,IMG.HEIC,photos/IMG.HEIC\n" {
		t.Errorf("%q", data)
	}
}

func TestUntar(t *testing.T) {
	var b bytes.Buffer
	tw := tar.NewWriter(&b)
	_ = tw.WriteHeader(&tar.Header{Name: "./", Typeflag: tar.TypeDir, Mode: 0o755})
	for name, body := range map[string]string{"./notes.csv": "a\n1\n", "./../evil.csv": "x", "./skip.txt": "no"} {
		_ = tw.WriteHeader(&tar.Header{Name: name, Typeflag: tar.TypeReg, Mode: 0o644, Size: int64(len(body))})
		_, _ = tw.Write([]byte(body))
	}
	_ = tw.Close()
	dir := t.TempDir()
	n, err := untar(&b, filepath.Join(dir, "out"), ".csv")
	if err != nil || n != 2 {
		t.Fatalf("n=%d err=%v", n, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "evil.csv")); err == nil {
		t.Error("a name in the tar wrote outside the folder")
	}
	if _, err := os.Stat(filepath.Join(dir, "out", "skip.txt")); err == nil {
		t.Error("kept a file without the suffix")
	}
}

func TestCopyTree(t *testing.T) {
	src, dst := t.TempDir(), t.TempDir()
	when := time.Date(2024, 7, 1, 12, 0, 0, 0, time.UTC)
	for _, f := range []string{"anna/2024/IMG_1.HEIC", "anna/.thumbs/x.jpg", ".DS_Store"} {
		p := filepath.Join(src, f)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		_ = os.WriteFile(p, []byte("photo"), 0o644)
		_ = os.Chtimes(p, when, when)
	}
	n, size, err := CopyTree(src, dst)
	if err != nil || n != 1 || size != 5 {
		t.Fatalf("n=%d size=%d err=%v", n, size, err)
	}
	info, err := os.Stat(filepath.Join(dst, "anna/2024/IMG_1.HEIC"))
	if err != nil || !info.ModTime().Equal(when) {
		t.Errorf("the copy lost its date: %v %v", info, err)
	}
}

func TestReadme(t *testing.T) {
	var b bytes.Buffer
	err := Readme(&b, Summary{Made: time.Now(), Machine: "Mac mini", Parts: []Part{{Folder: "tables/", Title: "Tables", What: "<CSV>"}}, Failed: []string{"Paperless-ngx: not running"}})
	if err != nil || !strings.Contains(b.String(), "&lt;CSV&gt;") || !strings.Contains(b.String(), "Not exported") {
		t.Errorf("%v\n%s", err, b.String())
	}
}
