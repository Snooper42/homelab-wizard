package duplicati

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// docs/SRE-Audit-2026-11.md, H5 and H6: what would make a night's backups
// wrong while Duplicati reports them done.
func TestPreflight(t *testing.T) {
	home, dest, photos := t.TempDir(), t.TempDir(), t.TempDir()
	env := map[string]string{"IMMICH_UPLOAD_LOCATION": photos, "MEDIA_ROOT": filepath.Join(t.TempDir(), "Media"), "JELLYFIN_DATA_DIR": filepath.Join(home, "jellyfin"), "SYNC_ROOT": filepath.Join(home, "sync")}

	if got := Preflight(env, home, ""); got != nil {
		t.Errorf("no backup folder set: %q", got)
	}
	// The backup folder itself gone (its drive unplugged).
	got := Preflight(env, home, filepath.Join(dest, "unplugged"))
	if len(got) != 1 || !strings.Contains(got[0], "is not there") {
		t.Fatalf("a missing backup folder: %q", got)
	}

	// Nothing backed up yet: an empty folder is a new homelab, not a lost drive.
	if got := Preflight(env, home, dest); len(got) != 0 {
		t.Errorf("before the first backup: %q", got)
	}

	// Photos backed up before, and the folder still full: fine.
	if err := os.MkdirAll(filepath.Join(dest, "photos"), 0o755); err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(filepath.Join(dest, "photos", "duplicati-20261126T010000Z.dlist.zip.aes"), []byte("x"), 0o644)
	_ = os.WriteFile(filepath.Join(photos, "IMG_1.HEIC"), []byte("x"), 0o644)
	if got := Preflight(env, home, dest); len(got) != 0 {
		t.Errorf("photos there: %q", got)
	}

	// The media drive unplugged: Docker's empty folder in its place (only a
	// hidden file, as Finder leaves), or no folder at all.
	_ = os.Remove(filepath.Join(photos, "IMG_1.HEIC"))
	_ = os.WriteFile(filepath.Join(photos, ".DS_Store"), []byte("x"), 0o644)
	got = Preflight(env, home, dest)
	if len(got) != 1 || !strings.HasPrefix(got[0], "Homelab Photos: "+photos) || !strings.Contains(got[0], "everything deleted") {
		t.Fatalf("photos gone: %q", got)
	}
	env["IMMICH_UPLOAD_LOCATION"] = filepath.Join(photos, "gone")
	if got := Preflight(env, home, dest); len(got) != 1 {
		t.Fatalf("photos' folder missing: %q", got)
	}
}
