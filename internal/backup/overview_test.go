package backup

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRead(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	file := func(rel string, age time.Duration, size int) {
		p := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, make([]byte, size), 0o644); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(p, now.Add(-age), now.Add(-age)); err != nil {
			t.Fatal(err)
		}
	}
	file("recovery-staging/databases/vaultwarden/vaultwarden-20261010-043000.sqlite.gz", 7*time.Hour, 300)
	file("recovery-staging/databases/vaultwarden/vaultwarden-20261009-043000.sqlite.gz", 31*time.Hour, 200)
	file("recovery-staging/databases/vaultwarden/.vaultwarden-x.partial", time.Hour, 1)
	file("recovery-staging/databases/paperless/paperless-20261007-043000.sql.gz", 3*24*time.Hour, 900)
	file("recovery-staging/databases/navidrome/navidrome-20260927-043000.sqlite.gz", 13*24*time.Hour, 70)
	file("recovery-staging/volumes/ntfy-cache/ntfy-cache-20261010-043000.tar.gz", 7*time.Hour, 50)
	file("recovery-staging/secrets/homelab.env", 6*time.Hour, 10)
	if err := os.MkdirAll(filepath.Join(root, "proton"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := (RestoreLog{LastTest: now.Add(-40 * 24 * time.Hour), LastSummary: "12 of 12 match"}).Save(filepath.Join(root, "scripts", "logs", "restore-test.json")); err != nil {
		t.Fatal(err)
	}

	o := Read(root, []Source{
		{ID: "vaultwarden", Name: "Vaultwarden"},
		{ID: "paperless", Name: "Paperless-ngx"},
		{ID: "mealie", Name: "Mealie"},
		{ID: "ntfy-cache", Name: "ntfy (cache)", Volume: true},
		{ID: "navidrome", Name: "Navidrome", WaitingFor: "/Volumes/Hobbies"},
		{ID: "komga", Name: "Komga", WaitingFor: "/Volumes/Hobbies"},
	}, map[string]string{"BACKUP_DESTINATION": "./proton"}, now)

	want := map[string]struct {
		state string
		count int
		size  int64
	}{"vaultwarden": {"fresh", 2, 300}, "paperless": {"stale", 1, 900}, "mealie": {"none", 0, 0}, "ntfy-cache": {"fresh", 1, 50},
		// Their apps wait for the Hobbies drive: paused, not stale.
		"navidrome": {"paused", 1, 70}, "komga": {"paused", 0, 0}}
	for _, c := range o.Copies {
		w := want[c.ID]
		if c.State != w.state || c.Count != w.count || c.Size != w.size {
			t.Errorf("%s: %+v, want %+v", c.ID, c, w)
		}
	}
	// The night before's copy, beside the newest: small, so no warning.
	for _, c := range o.Copies {
		if c.ID == "vaultwarden" && (c.Before != 200 || c.Shrank) || c.ID == "paperless" && c.Before != 0 {
			t.Errorf("%s: before %d, shrank %v", c.ID, c.Before, c.Shrank)
		}
	}
	if o.Shrank != 0 {
		t.Errorf("shrank %d", o.Shrank)
	}
	if o.Stale != 1 || o.Paused != 2 || !o.DestinationOK || !o.RestoreDue || o.RestoreTest.LastSummary == "" {
		t.Errorf("overview: %+v", o)
	}
	if !o.LastRun.Equal(now.Add(-6 * time.Hour)) {
		t.Errorf("last run %v", o.LastRun)
	}
	if Read(root, nil, map[string]string{"BACKUP_DESTINATION": "./backups"}, now).DestinationOK {
		t.Error("the local default is not an off-machine destination")
	}
}

// A copy far smaller than the night before's is flagged: the night before
// is the copy just before the newest, not the oldest kept.
func TestReadShrank(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	const mb = 1 << 20
	for _, f := range []struct {
		name string
		age  time.Duration
		size int
	}{
		{"immich-database-20261103-043000.sql.gz", 56 * time.Hour, 3 * mb},
		{"immich-database-20261104-043000.sql.gz", 32 * time.Hour, 2 * mb},
		{"immich-database-20261105-043000.sql.gz", 8 * time.Hour, mb / 3},
	} {
		p := filepath.Join(root, "recovery-staging", "databases", "immich-database", f.name)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, make([]byte, f.size), 0o644); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(p, now.Add(-f.age), now.Add(-f.age)); err != nil {
			t.Fatal(err)
		}
	}
	o := Read(root, []Source{{ID: "immich-database", Name: "Immich database"}}, nil, now)
	c := o.Copies[0]
	if c.Size != mb/3 || c.Before != 2*mb || !c.Shrank || o.Shrank != 1 {
		t.Errorf("copy %+v, shrank %d", c, o.Shrank)
	}
}

func TestShrank(t *testing.T) {
	for _, c := range []struct {
		size, before int64
		want         bool
	}{
		{0, 0, false},                // the first copy
		{400 << 10, 1 << 20, true},   // under half of a megabyte's worth
		{600 << 10, 1 << 20, false},  // more than half
		{1 << 20, 2 << 20, false},    // exactly half
		{10 << 10, 900 << 10, false}, // the one before was too small to tell
		{3 << 20, 2 << 20, false},    // it grew
	} {
		if got := Shrank(c.size, c.before); got != c.want {
			t.Errorf("Shrank(%d, %d) = %v", c.size, c.before, got)
		}
	}
}

func TestProtonDrive(t *testing.T) {
	home := t.TempDir()
	if got := ProtonDrive(home); len(got) != 0 {
		t.Fatalf("none yet: %v", got)
	}
	want := filepath.Join(home, "Library", "CloudStorage", "ProtonDrive-you@proton.me-folder")
	_ = os.MkdirAll(want, 0o755)
	_ = os.MkdirAll(filepath.Join(home, "Library", "CloudStorage", "OneDrive-Personal"), 0o755)
	if got := ProtonDrive(home); len(got) != 1 || got[0] != want {
		t.Fatalf("got %v", got)
	}
}
