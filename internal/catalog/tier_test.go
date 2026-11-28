package catalog

import (
	"path/filepath"
	"runtime"
	"testing"
)

// Every Gold Tier app is an app of the real catalog, by its exact ID: a
// rename would otherwise drop it from the tier without a word.
func TestGoldTierNamesRealApps(t *testing.T) {
	_, here, _, _ := runtime.Caller(0)
	c, err := Load(filepath.Join(filepath.Dir(here), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	if n := len(GoldTier); n < 8 || n > 13 {
		t.Errorf("%d Gold Tier apps: the core is 8 to 12 household apps (one of them twice, as a program and a container)", n)
	}
	seen := map[string]bool{}
	for _, id := range GoldTier {
		a, ok := c.Get(id)
		if !ok {
			t.Errorf("%s is in GoldTier but not in the catalog", id)
			continue
		}
		if seen[id] {
			t.Errorf("%s twice", id)
		}
		seen[id] = true
		if a.Tier() != TierGold {
			t.Errorf("%s: %s", id, a.Tier())
		}
	}
	if a, ok := c.Get("frigate"); !ok || a.Tier() != TierExperimental {
		t.Errorf("an app outside the list is Experimental")
	}
}
