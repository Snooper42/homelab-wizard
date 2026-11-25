package duplicati

import (
	"os"
	"path/filepath"
	"testing"
)

// Not in any backup (quality-loop D1): a job's folder with files and no job is a gap Add can fill; one with a job, or
// still empty, is none; the media library and the downloads are listed as left out on purpose, with no Add.
func TestGaps(t *testing.T) {
	dir := t.TempDir()
	full := func(name string) string {
		p := filepath.Join(dir, name)
		if err := os.MkdirAll(p, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(p, "a.txt"), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
		return p
	}
	env := map[string]string{
		"SYNC_ROOT":              full("sync"),
		"IMMICH_UPLOAD_LOCATION": full("photos"),
		"MEDIA_ROOT":             full("media"),
		"DOWNLOADS_ROOT":         filepath.Join(dir, "downloads"), // missing
		"JELLYFIN_DATA_DIR":      filepath.Join(dir, "jellyfin"),  // missing
	}
	gaps := Gaps(env, dir, []Job{{Name: "Homelab Photos"}})
	byName := map[string]Gap{}
	for _, g := range gaps {
		byName[g.Name] = g
	}
	if g, ok := byName["The synced Files (Syncthing)"]; !ok || g.Job != "Homelab Files" || g.Path != env["SYNC_ROOT"] {
		t.Errorf("the synced Files, with files and no job, is no gap Add can fill: %+v", gaps)
	}
	if _, ok := byName["Photos (Immich)"]; ok {
		t.Errorf("photos have their job, yet are a gap: %+v", gaps)
	}
	if _, ok := byName["Jellyfin's library and watch history"]; ok {
		t.Errorf("a missing folder is a gap: %+v", gaps)
	}
	if g, ok := byName["Films, shows and music"]; !ok || g.Job != "" {
		t.Errorf("the media library isn't said to be left out, or offers Add: %+v", gaps)
	}
	if _, ok := byName["Downloads"]; ok {
		t.Errorf("an empty downloads folder is a gap: %+v", gaps)
	}
}
