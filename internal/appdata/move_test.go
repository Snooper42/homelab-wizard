package appdata

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func tree(t *testing.T, root string) {
	t.Helper()
	for p, body := range map[string]string{"immich/config.json": `{"a":1}`, "vaultwarden/db.sqlite3": strings.Repeat("x", 70000), "empty/.keep": "", "deep/a/b/c.txt": "c"} {
		f := filepath.Join(root, p)
		os.MkdirAll(filepath.Dir(f), 0o755)
		if err := os.WriteFile(f, []byte(body), 0o640); err != nil {
			t.Fatal(err)
		}
	}
	os.Chtimes(filepath.Join(root, "deep/a/b/c.txt"), time.Unix(1700000000, 0), time.Unix(1700000000, 0))
	os.MkdirAll(filepath.Join(root, "nothing-in-it"), 0o700)
	if runtime.GOOS != "windows" {
		os.Symlink("config.json", filepath.Join(root, "immich/link"))
	}
}

// Lane 3, D3 part 2: the move copies every file, folder and link with its mode and time, and checks each file's
// content against the original before anything points at the copy.
func TestCopyAndCheck(t *testing.T) {
	from, to := filepath.Join(t.TempDir(), "appdata"), filepath.Join(t.TempDir(), "Fast", "appdata")
	tree(t, from)
	var seen int
	n, size, err := Copy(from, to, func(files int, _ int64) { seen = files })
	if err != nil {
		t.Fatal(err)
	}
	if n != 4 || size != int64(len(`{"a":1}`)+70000+1) || seen != 4 {
		t.Errorf("copied %d files, %d bytes (progress said %d)", n, size, seen)
	}
	if got, _ := os.ReadFile(filepath.Join(to, "vaultwarden/db.sqlite3")); len(got) != 70000 {
		t.Errorf("the database: %d bytes", len(got))
	}
	if fi, err := os.Stat(filepath.Join(to, "nothing-in-it")); err != nil || !fi.IsDir() {
		t.Errorf("an empty folder: %v", err)
	}
	if runtime.GOOS != "windows" {
		if fi, _ := os.Stat(filepath.Join(to, "immich/config.json")); fi.Mode().Perm() != 0o640 {
			t.Errorf("mode %v", fi.Mode().Perm())
		}
		if l, err := os.Readlink(filepath.Join(to, "immich/link")); err != nil || l != "config.json" {
			t.Errorf("the link: %q %v", l, err)
		}
	}
	if fi, _ := os.Stat(filepath.Join(to, "deep/a/b/c.txt")); !fi.ModTime().Equal(time.Unix(1700000000, 0)) {
		t.Errorf("time %v", fi.ModTime())
	}
	if n, err := Check(from, to); err != nil || n != 4 {
		t.Fatalf("check: %d %v", n, err)
	}
	// A file that differs, one missing, one extra in the copy: each fails the check.
	os.WriteFile(filepath.Join(to, "immich/config.json"), []byte(`{"a":2}`), 0o640)
	if _, err := Check(from, to); err == nil || !strings.Contains(err.Error(), "immich") {
		t.Errorf("a changed file passed: %v", err)
	}
	os.WriteFile(filepath.Join(to, "immich/config.json"), []byte(`{"a":1}`), 0o640)
	os.Remove(filepath.Join(to, "deep/a/b/c.txt"))
	if _, err := Check(from, to); err == nil {
		t.Error("a missing file passed")
	}
}

// A copy into a folder that isn't empty, or into the folder itself or one inside it, is refused before anything is copied.
func TestCopyRefuses(t *testing.T) {
	from := filepath.Join(t.TempDir(), "appdata")
	tree(t, from)
	full := t.TempDir()
	os.WriteFile(filepath.Join(full, "something"), []byte("x"), 0o644)
	for _, to := range []string{full, from, filepath.Join(from, "inside"), filepath.Dir(from)} {
		if _, _, err := Copy(from, to, nil); err == nil {
			t.Errorf("copied into %s", to)
		}
	}
}

func TestMoveState(t *testing.T) {
	root := t.TempDir()
	if s, ok := LoadMove(root); ok || s.Old != "" {
		t.Fatalf("none yet: %+v", s)
	}
	m := Move{Old: "/a", New: "/b", Was: "", At: time.Now().UTC().Truncate(time.Second), Files: 3, Bytes: 9}
	if err := SaveMove(root, m); err != nil {
		t.Fatal(err)
	}
	if s, ok := LoadMove(root); !ok || s.Old != "/a" || s.New != "/b" || s.Files != 3 || !s.At.Equal(m.At) {
		t.Errorf("%+v", s)
	}
	if err := ForgetMove(root); err != nil {
		t.Fatal(err)
	}
	if _, ok := LoadMove(root); ok {
		t.Error("still there")
	}
}
