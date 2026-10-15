package savings

import (
	"math"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

func repoRoot() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..")
}

func TestSavingsMatchTheDocs(t *testing.T) {
	c, err := catalog.Load(repoRoot())
	if err != nil {
		t.Fatal(err)
	}
	rows, err := Load(c.Root)
	if err != nil {
		t.Fatal(err)
	}
	docs := map[string]bool{}
	for _, a := range c.Apps {
		docs[filepath.ToSlash(c.DocPath(a))] = true
	}
	for _, r := range rows {
		for _, d := range r.Docs {
			if !docs[d] {
				t.Errorf("Savings.md links %s, which is no app's note", d)
			}
		}
	}
	// The "Everything" total in docs/Savings.md.
	if got := Annual(c, func(string) bool { return true }); math.Abs(got-4287.09) > 0.005 || len(rows) != 37 {
		t.Errorf("all apps: %.2f over %d rows", got, len(rows))
	}
	if got := Annual(c, func(id string) bool { return id == "vaultwarden" }); math.Abs(got-71.88) > 0.005 {
		t.Errorf("vaultwarden alone: %.2f", got)
	}
	if Dollars(3291.58) != "$3,292" || Dollars(71.88) != "$72" {
		t.Errorf("dollars: %s %s", Dollars(3291.58), Dollars(71.88))
	}
}
