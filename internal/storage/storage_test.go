package storage

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type fakeExec struct{ old bool }

func (f fakeExec) ExecTo(_ context.Context, w io.Writer, _ string, args ...string) error {
	sql := args[len(args)-1]
	if strings.Contains(sql, `from "user"`) && f.old {
		return errors.New("docker exec … " + sql + `: ERROR:  relation "user" does not exist`)
	}
	_, err := io.WriteString(w, "Anna,anna@example.com,1000\n,ben@example.com,5000\n")
	return err
}

func TestImmichPhotos(t *testing.T) {
	for _, old := range []bool{false, true} {
		got, err := ImmichPhotos(context.Background(), fakeExec{old}, "db")
		if err != nil || len(got) != 2 || got[0].Email != "ben@example.com" || got[1].Bytes != 1000 {
			t.Errorf("old=%v: %+v %v", old, got, err)
		}
	}
}

func TestSaveLoad(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "storage.json")
	if r := Load(path); r.Photos == nil || len(r.Photos) != 0 {
		t.Errorf("none yet: %+v", r)
	}
	r := Record{When: time.Now().UTC().Truncate(time.Second), Photos: []Person{{Name: "Anna", Bytes: 7}}}
	if err := r.Save(path); err != nil {
		t.Fatal(err)
	}
	if got := Load(path); !got.When.Equal(r.When) || got.Photos[0].Bytes != 7 {
		t.Errorf("%+v", got)
	}
}

func TestAppFolders(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "a", "deep"), 0o755)
	os.MkdirAll(filepath.Join(dir, "b"), 0o755)
	os.WriteFile(filepath.Join(dir, "a", "deep", "x"), make([]byte, 300), 0o644)
	os.WriteFile(filepath.Join(dir, "b", "y"), make([]byte, 500), 0o644)
	os.WriteFile(filepath.Join(dir, "loose"), make([]byte, 900), 0o644)
	got := AppFolders(dir, filepath.Join(dir, "missing"))
	if len(got) != 2 || got[0] != (Folder{"b", 500}) || got[1] != (Folder{"a", 300}) {
		t.Fatalf("%+v", got)
	}
}
