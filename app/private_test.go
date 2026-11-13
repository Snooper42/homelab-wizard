package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/people"
)

// Settings › People says only that a member keeps her Finances private,
// and when she last saved them (private-finances.md 3.3): nothing of what
// is in them, and nothing at all for anyone else.
func TestPrivateFinancesSaysOnlyWhen(t *testing.T) {
	root := t.TempDir()
	a := &App{root: root}
	if err := people.Save(people.Path(root), []people.Person{{Username: "anna", Name: "Anna"}, {Username: "sam", Name: "Sam"}}); err != nil {
		t.Fatal(err)
	}
	got, err := a.PrivateFinances()
	if err != nil || len(got) != 0 {
		t.Fatalf("none private: %v %v", got, err)
	}
	sealed := finance.SealedPath(people.MemberRoot(root, "anna"))
	if err := os.MkdirAll(filepath.Dir(sealed), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(sealed, []byte(`{"version":1}`), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err = a.PrivateFinances()
	if err != nil {
		t.Fatal(err)
	}
	when, err := time.Parse(time.RFC3339, got["anna"])
	if len(got) != 1 || err != nil || time.Since(when) > time.Minute {
		t.Errorf("private: %v (%v)", got, err)
	}
}
