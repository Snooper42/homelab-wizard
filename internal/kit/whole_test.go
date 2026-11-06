package kit

import (
	"os"
	"path/filepath"
	"testing"
)

// The kit's manifest is replaced whole after an update, never rewritten in
// place: an update cut off there would leave none, and the folder would no
// longer read as a kit (Installed), to the next upgrade and to rollback.
func TestTheManifestIsReplacedWhole(t *testing.T) {
	v1 := pack(t, map[string]string{"compose.yaml": "name: homelab_core\n", ".env.example": "A=1\n"}, "aaaaaaaaaa1")
	dest := filepath.Join(t.TempDir(), "Homelab")
	if _, err := Extract(v1, dest); err != nil {
		t.Fatal(err)
	}
	was, err := os.Stat(filepath.Join(dest, ManifestName))
	if err != nil {
		t.Fatal(err)
	}
	v2 := pack(t, map[string]string{"compose.yaml": "name: homelab_core\n# v2\n", ".env.example": "A=1\n"}, "bbbbbbbbbb2")
	if _, _, err := Update(v2, dest); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(filepath.Join(dest, ManifestName))
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("the manifest was rewritten in place")
	}
	if m, ok := Installed(dest); !ok || m.Commit != "bbbbbbbbbb2" {
		t.Errorf("manifest after the update: %+v %v", m, ok)
	}
}
