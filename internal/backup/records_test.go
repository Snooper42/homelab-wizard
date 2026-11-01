package backup

import (
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"testing"
)

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func listed(t *testing.T, root string) []string {
	t.Helper()
	var out []string
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			rel, _ := filepath.Rel(root, path)
			out = append(out, filepath.ToSlash(rel))
		}
		return nil
	})
	slices.Sort(out)
	return out
}

func TestCopyRecordsTakesTheRecordsAndLeavesTheRest(t *testing.T) {
	data := filepath.Join(t.TempDir(), "data")
	write(t, filepath.Join(data, "phones.json"), `{"phones":[]}`)
	write(t, filepath.Join(data, "people.json"), `[]`)
	write(t, filepath.Join(data, "people", "anna.html"), "<p>Anna</p>")
	write(t, filepath.Join(data, "sso", "karakeep.env"), "OAUTH_CLIENT_SECRET=s")
	write(t, filepath.Join(data, "finance-ledger.json"), `{"transactions":[]}`)
	write(t, filepath.Join(data, "finance-receipts", "0123456789abcdef0123456789abcdef.jpg"), "a receipt")
	write(t, filepath.Join(data, "appdata", "ntfy", "user.db"), "app data")
	write(t, filepath.Join(data, "icons", "ntfy"), "icon")
	write(t, filepath.Join(data, "sync", "notes.txt"), "a synced file")
	write(t, filepath.Join(data, "notes.txt"), "not a record")

	dst := filepath.Join(t.TempDir(), "secrets", RecordsFolder)
	n, err := CopyRecords(data, dst)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"finance-ledger.json", "finance-receipts/0123456789abcdef0123456789abcdef.jpg", "people.json", "people/anna.html", "phones.json", "sso/karakeep.env"}
	if got := listed(t, dst); !slices.Equal(got, want) || n != len(want) {
		t.Fatalf("copied %d: %v, want %v", n, got, want)
	}
	if runtime.GOOS != "windows" {
		fi, _ := os.Stat(filepath.Join(dst, "sso", "karakeep.env"))
		if fi.Mode().Perm() != 0o600 {
			t.Errorf("a copied record is %v, want 0600", fi.Mode().Perm())
		}
	}

	// The next night: a phone removed and a person gone are gone from the
	// copy too, and nothing is left beside it.
	if err := os.Remove(filepath.Join(data, "phones.json")); err != nil {
		t.Fatal(err)
	}
	if err := os.RemoveAll(filepath.Join(data, "people")); err != nil {
		t.Fatal(err)
	}
	if _, err := CopyRecords(data, dst); err != nil {
		t.Fatal(err)
	}
	if got := listed(t, dst); !slices.Equal(got, []string{"finance-ledger.json", "finance-receipts/0123456789abcdef0123456789abcdef.jpg", "people.json", "sso/karakeep.env"}) {
		t.Errorf("second night: %v", got)
	}
	if _, err := os.Stat(dst + ".new"); !os.IsNotExist(err) {
		t.Errorf("the working copy was left behind: %v", err)
	}
}

func TestCopyRecordsWithNothingToCopy(t *testing.T) {
	root := t.TempDir()
	dst := filepath.Join(root, "secrets", RecordsFolder)
	if n, err := CopyRecords(filepath.Join(root, "missing"), dst); err != nil || n != 0 {
		t.Fatalf("no data folder: %d, %v", n, err)
	}
	write(t, filepath.Join(dst, "old.json"), "{}")
	empty := filepath.Join(root, "data")
	if err := os.MkdirAll(filepath.Join(empty, "appdata"), 0o755); err != nil {
		t.Fatal(err)
	}
	if n, err := CopyRecords(empty, dst); err != nil || n != 0 {
		t.Fatalf("no records: %d, %v", n, err)
	}
	if _, err := os.Stat(dst); !os.IsNotExist(err) {
		t.Errorf("an old copy stayed with no records left: %v", err)
	}
}
