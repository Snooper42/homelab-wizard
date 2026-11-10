package applist

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// Every list moved out of .env has its own record and its own old key.
func TestMovedListsAreApart(t *testing.T) {
	files, keys := map[string]bool{}, map[string]bool{}
	for _, l := range Moved {
		if files[l.File] || keys[l.Key] || l.File == "" || l.Key == "" {
			t.Errorf("%+v shares its file or key, or has none", l)
		}
		files[l.File], keys[l.Key] = true, true
	}
	if !slices.Contains(Moved, AlertsOff) || !slices.Contains(Moved, Pinned) {
		t.Errorf("Moved leaves a list out: %+v", Moved)
	}
}

// A record edited by hand (an app twice, a broken file) reads as the
// apps it names, once each, and the next change writes it clean.
func TestARecordEditedByHand(t *testing.T) {
	root := t.TempDir()
	l := List{File: "x.json", Key: "X"}
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(l.Path(root), []byte(`{"apps":["a","b","a"]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(l.Load(root, nil), ","); got != "a,b" {
		t.Errorf("read: %q", got)
	}
	if err := l.Set(root, "c", true); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(l.Path(root)); strings.Count(string(data), `"a"`) != 1 {
		t.Errorf("written: %s", data)
	}
	if err := os.WriteFile(l.Path(root), []byte("not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := l.Load(root, nil); len(got) != 0 {
		t.Errorf("a broken record: %v", got)
	}
}

// An empty key in .env (as .env.example wrote it) is taken out, and the
// record is left as it was.
func TestCarryAnEmptyKey(t *testing.T) {
	root := t.TempDir()
	p := filepath.Join(root, ".env")
	if err := os.WriteFile(p, []byte("APPS_PINNED=\nTZ=UTC\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	f, _ := envfile.Load(p)
	if moved, err := Pinned.Carry(root, f); !moved || err != nil {
		t.Fatalf("Carry: %v %v", moved, err)
	}
	if _, ok := f.Get("APPS_PINNED"); ok {
		t.Error("the empty key stayed")
	}
	if _, err := os.Stat(Pinned.Path(root)); !os.IsNotExist(err) {
		t.Errorf("a record was made for nothing: %v", err)
	}
}

// A record that is there but can't be read is never taken as an empty
// list by Read, nor replaced by Set.
func TestAnUnreadableRecordIsKept(t *testing.T) {
	root := t.TempDir()
	if apps, err := HomeOnly.Read(root); err != nil || apps != nil {
		t.Fatalf("no record: %v %v", apps, err)
	}
	if err := HomeOnly.Set(root, "paperless", true); err != nil {
		t.Fatal(err)
	}
	if apps, err := HomeOnly.Read(root); err != nil || len(apps) != 1 || apps[0] != "paperless" {
		t.Fatalf("read: %v %v", apps, err)
	}
	broken := []byte(`{"apps": ["paper`)
	if err := os.WriteFile(HomeOnly.Path(root), broken, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := HomeOnly.Read(root); err == nil {
		t.Error("a broken record read as a list")
	}
	if err := HomeOnly.Set(root, "immich-server", true); err == nil {
		t.Error("a broken record was written over")
	}
	if data, _ := os.ReadFile(HomeOnly.Path(root)); string(data) != string(broken) {
		t.Errorf("record now: %s", data)
	}
}
