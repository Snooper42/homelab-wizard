package docs

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

func repoCatalog(t *testing.T) (string, *catalog.Catalog) {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	return root, c
}

// Kopia's note gives its page what it's for, its setup steps, what it
// works with (by app), and where to read more.
func TestReadGuideKopia(t *testing.T) {
	root, c := repoCatalog(t)
	g, err := ReadGuide(root, c, "kopia")
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Purpose) == 0 || !strings.HasPrefix(g.Purpose[0], "A second backup of the homelab") || strings.Contains(g.Purpose[0], "](") {
		t.Errorf("purpose: %q", g.Purpose)
	}
	if len(g.Setup) != 4 || !strings.HasPrefix(g.Setup[0], "`./homelab install kopia`") {
		t.Errorf("setup: %q", g.Setup)
	}
	if len(g.Everyday) == 0 || !strings.HasPrefix(g.Everyday[0], "**Snapshots:**") {
		t.Errorf("everyday: %q", g.Everyday)
	}
	if len(g.Connects) != 2 || g.Connects[0].ID != "duplicati" || !strings.HasPrefix(g.Connects[0].Text, "the main backup") {
		t.Errorf("connects: %+v", g.Connects)
	}
	if len(g.Learn) != 2 || g.Learn[0] != (GuideLink{Label: "kopia.io", URL: "https://kopia.io"}) {
		t.Errorf("learn: %+v", g.Learn)
	}
	if g.Memory != 300 || !strings.HasPrefix(g.Updates, "By hand.") {
		t.Errorf("memory %d, updates %q", g.Memory, g.Updates)
	}
}

// "Docs: https://…" lines read as a labelled link; an unknown app, or one
// with no note, has an empty guide.
func TestReadGuideBareLinks(t *testing.T) {
	root, c := repoCatalog(t)
	g, err := ReadGuide(root, c, "immich")
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Learn) == 0 || g.Learn[0] != (GuideLink{Label: "Docs", URL: "https://docs.immich.app/"}) {
		t.Errorf("learn: %+v", g.Learn)
	}
	if g, err := ReadGuide(root, c, "nope"); err != nil || len(g.Purpose) != 0 {
		t.Errorf("unknown: %+v %v", g, err)
	}
	empty := t.TempDir()
	if g, err := ReadGuide(empty, c, "kopia"); err != nil || len(g.Purpose) != 0 || g.Memory != 300 {
		t.Errorf("no note: %+v %v", g, err)
	}
	_ = os.Remove(empty)
}

// Every app with a note has something to say on its page.
func TestEveryGuideSaysWhatItsFor(t *testing.T) {
	root, c := repoCatalog(t)
	for _, a := range c.Apps {
		if _, err := os.Stat(filepath.Join(root, c.DocPath(a))); err != nil {
			continue
		}
		g, err := ReadGuide(root, c, a.ID)
		if err != nil {
			t.Fatal(err)
		}
		if len(g.Purpose) == 0 {
			t.Errorf("%s: no purpose read from %s", a.ID, c.DocPath(a))
		}
	}
}
