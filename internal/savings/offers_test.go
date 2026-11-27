package savings

import (
	"math"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// Lane D, D1: each row of docs/Savings.md as Status › Subscriptions shows it, every column read, each paid service
// counted once so the counted rows add up to the app's yearly figure.
func TestOffersReadEveryColumn(t *testing.T) {
	c, err := catalog.Load(repoRoot())
	if err != nil {
		t.Fatal(err)
	}
	offers, err := Offers(c)
	if err != nil {
		t.Fatal(err)
	}
	if len(offers) != 43 {
		t.Fatalf("%d offers, want the 43 rows", len(offers))
	}
	find := func(replaces string, app string) []Offer {
		var out []Offer
		for _, o := range offers {
			if o.Replaces == replaces && (app == "" || slices.Contains(o.Apps, app)) {
				out = append(out, o)
			}
		}
		return out
	}
	vw := find("1Password Families", "vaultwarden")
	if len(vw) != 1 {
		t.Fatalf("1Password Families: %+v", vw)
	}
	if o := vw[0]; o.Kind != "Direct" || o.Monthly != 7.99 || o.Annual != 71.88 || !o.Counted ||
		o.Condition != "Everyone's passwords live in Vaultwarden (Bitwarden Families would be $47.88)" {
		t.Errorf("Vaultwarden: %+v", o)
	}
	// Links in a condition are plain text; a dagger after a monthly price is dropped.
	if o := find("UptimeRobot Solo", "")[0]; o.Condition != "Monitors set up as in Monitoring" || o.Kind != "Equivalent" {
		t.Errorf("Uptime Kuma: %+v", o)
	}
	if o := find("Ghostfolio Premium", "")[0]; o.Monthly != 3.33 || o.Annual != 40 {
		t.Errorf("Ghostfolio: %+v", o)
	}
	// Several apps together: every one's ID.
	if o := find("Trakt VIP", "")[0]; !slices.Equal(o.Apps, []string{"sonarr", "radarr", "seerr"}) {
		t.Errorf("Trakt VIP: %v", o.Apps)
	}
	if o := find("Spotify Premium Family", "")[0]; o.Kind != "Own media" || len(o.Apps) != 2 {
		t.Errorf("Spotify: %+v", o)
	}
	// A service two apps replace is counted once, on the row whose note says "counted once, here".
	for _, two := range []struct{ service, counted, other string }{
		{"Dropbox Plus", "nextcloud", "filebrowser"},
		{"YNAB", "actual-budget", "moneymatter-frontend"},
		{"Raindrop.io Pro", "linkwarden", "karakeep"},
		{"Plan to Eat", "tandoor", "mealie"},
	} {
		if !find(two.service, two.counted)[0].Counted || find(two.service, two.other)[0].Counted {
			t.Errorf("%s: counted on %s, not %s: %+v", two.service, two.counted, two.other, find(two.service, ""))
		}
	}
	total := 0.0
	for _, o := range offers {
		if o.Counted {
			total += o.Annual
		}
	}
	if math.Abs(total-Annual(c, func(string) bool { return true })) > 0.005 || math.Abs(total-4487.08) > 0.005 {
		t.Errorf("the counted rows add up to %.2f, want the Everything total", total)
	}
}

// A table without the Kind, Monthly or Condition columns still loads: they are empty, 0 and empty.
func TestOffersWithoutTheNewColumns(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "docs"), 0o755); err != nil {
		t.Fatal(err)
	}
	doc := "| App | Runs | Replaces | Annual plan |\n|---|---|---|---:|\n| [Vaultwarden](<../services/security/Vaultwarden.md>) | Baseline | 1Password | $71.88 |\n"
	if err := os.WriteFile(filepath.Join(root, "docs", "Savings.md"), []byte(doc), 0o644); err != nil {
		t.Fatal(err)
	}
	rows, err := Load(root)
	if err != nil || len(rows) != 1 {
		t.Fatalf("%v %+v", err, rows)
	}
	if r := rows[0]; r.Kind != "" || r.Monthly != 0 || r.Condition != "" || !r.Counted || r.Annual != 71.88 {
		t.Errorf("%+v", r)
	}
}
