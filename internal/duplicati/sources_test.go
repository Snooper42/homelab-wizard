package duplicati

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
	"time"
)

// The homelab's own records in data/ (finance.json, the ledger, receipts,
// people's welcome pages, sso, the paired phones) go off-site only inside
// the encrypted Secrets job, copied there by the nightly backup. No folder
// Duplicati reads for another job may hold them: only data/appdata (the
// apps' data) of data/ may be mounted as a source.
func TestNoOtherJobReadsTheRecords(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "compose", "system.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	mount := regexp.MustCompile(`^\s*-\s*(\S+?):/source/[^:\s]*`)
	n := 0
	for i, line := range strings.Split(string(data), "\n") {
		m := mount.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		n++
		src := strings.TrimSuffix(filepath.ToSlash(filepath.Clean(m[1])), "/")
		if src == "." || src == "data" || (strings.HasPrefix(src, "data/") && src != "data/appdata" && !strings.HasPrefix(src, "data/appdata/")) {
			t.Errorf("compose/system.yaml:%d mounts %s as a source: the records in data/ would go off-site outside the Secrets job", i+1, m[1])
		}
	}
	if n < 2 {
		t.Fatalf("read only %d source mounts from compose/system.yaml", n)
	}
}

// The household's synced Files (Syncthing's SYNC_ROOT, default ./data/sync)
// are backed up: Duplicati mounts the folder read-only, a homelab job reads
// it, and that job is made once the folder has something in it. Syncthing
// passes a deletion on to every device, so without it a file deleted by
// mistake had no copy anywhere (N76).
func TestTheSyncedFilesAreBackedUp(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "compose", "system.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "- ${SYNC_ROOT:-./data/sync}:/source/sync:ro") {
		t.Error("compose/system.yaml doesn't mount SYNC_ROOT into Duplicati, read-only, at /source/sync")
	}
	var job *HomelabJob
	for i, j := range HomelabJobs {
		if slices.Contains(j.Sources, "/source/sync/") {
			job = &HomelabJobs[i]
		}
	}
	if job == nil {
		t.Fatal("no homelab job reads /source/sync/")
	}
	if job.Secrets || job.Host == nil {
		t.Errorf("%s: with the other jobs' passphrase, and made only once its folder has files", job.Name)
	}
	synced := t.TempDir()
	env := map[string]string{"SYNC_ROOT": synced}
	action := func() string {
		for _, p := range Plan(env, t.TempDir(), nil, time.Now()) {
			if p.Job.Name == job.Name {
				return p.Action
			}
		}
		return ""
	}
	if got := action(); got != "skip" {
		t.Errorf("an empty synced folder: %s, want skip", got)
	}
	if err := os.WriteFile(filepath.Join(synced, "notes.txt"), []byte("a synced file"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := action(); got != "create" {
		t.Errorf("a synced folder with a file: %s, want create", got)
	}
	doc, err := os.ReadFile(filepath.Join("..", "..", "docs", "Backups.md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(doc), "`SYNC_ROOT`") {
		t.Error("docs/Backups.md's What is covered doesn't say where the synced Files go")
	}
}
