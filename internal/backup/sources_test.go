package backup

import (
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// Every copy names the app it is of, a volume's archive too: Backups says
// why a stale one is stale from that app's state (stopped, gone).
func TestEachCopyNamesItsApp(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	sources := SourcesFor(c, func(*catalog.App) bool { return true }, nil)
	volumes := 0
	for _, s := range sources {
		if _, ok := c.Get(s.App); !ok {
			t.Errorf("%s (%s) names no app: %q", s.ID, s.Name, s.App)
		}
		if s.Volume {
			volumes++
			if s.App == s.ID {
				t.Errorf("volume %s names itself as its app", s.ID)
			}
		} else if s.App != s.ID {
			t.Errorf("%s's database names %s", s.ID, s.App)
		}
	}
	if volumes == 0 {
		t.Fatal("no volume archive in the catalog to try")
	}
	root := t.TempDir()
	if o := Read(root, sources[:1], map[string]string{}, time.Now()); o.Copies[0].App != sources[0].App {
		t.Errorf("the overview's copy has app %q, want %q", o.Copies[0].App, sources[0].App)
	}
}
