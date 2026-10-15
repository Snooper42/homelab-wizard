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
	}, map[string]string{"BACKUP_DESTINATION": "./proton"}, now)

	want := map[string]struct {
		state string
		count int
		size  int64
	}{"vaultwarden": {"fresh", 2, 300}, "paperless": {"stale", 1, 900}, "mealie": {"none", 0, 0}, "ntfy-cache": {"fresh", 1, 50}}
	for _, c := range o.Copies {
		w := want[c.ID]
		if c.State != w.state || c.Count != w.count || c.Size != w.size {
			t.Errorf("%s: %+v, want %+v", c.ID, c, w)
		}
	}
	if o.Stale != 1 || !o.DestinationOK || !o.RestoreDue || o.RestoreTest.LastSummary == "" {
		t.Errorf("overview: %+v", o)
	}
	if !o.LastRun.Equal(now.Add(-6 * time.Hour)) {
		t.Errorf("last run %v", o.LastRun)
	}
	if Read(root, nil, map[string]string{"BACKUP_DESTINATION": "./backups"}, now).DestinationOK {
		t.Error("the local default is not an off-machine destination")
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
