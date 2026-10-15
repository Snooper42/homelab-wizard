package storage

import (
	"context"
	"errors"
	"io"
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
