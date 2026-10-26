package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

func TestExport(t *testing.T) {
	ctrs := append(ghostfolioDB(), docker.FakeContainer{Name: "homelab_immich-immich-database-1", Image: "postgres", Running: true, Project: "homelab_immich", Service: "immich-database"})
	calls := fakeDocker(t, ctrs)
	root, _ := repoCopy(t, "IMMICH_UPLOAD_LOCATION=/Volumes/Photos")
	vault := filepath.Join(root, "recovery-staging", "secrets", "bitwarden_encrypted_export_20261001.json")
	if err := os.MkdirAll(filepath.Dir(vault), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(vault, []byte(`{"encrypted":true}`), 0o600); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(t.TempDir(), "export")
	if o, code := homelabCmd(t, root, "", "export", "--to", out); code == 0 && !strings.Contains(o, "Preview") {
		t.Fatalf("without --apply it only shows the plan (exit %d):\n%s", code, o)
	}
	o, code := homelabCmd(t, root, "", "export", "--to", out, "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s\n%s", code, o, readCalls(t, calls))
	}
	for path, want := range map[string]string{
		"tables/ghostfolio-db/1/tx.csv":                      "1,coffee",
		"photos/albums.csv":                                  "Summer,anna@example.com,IMG_1.HEIC," + filepath.Join("/Volumes/Photos", "library", "anna", "IMG_1.HEIC"), // where the original is, in this system's terms
		"passwords/bitwarden_encrypted_export_20261001.json": "encrypted",
		"README.html":                                        "Photos (Immich)",
	} {
		data, err := os.ReadFile(filepath.Join(out, path))
		if err != nil || !strings.Contains(string(data), want) {
			t.Errorf("%s: %q, %v", path, data, err)
		}
	}
}
