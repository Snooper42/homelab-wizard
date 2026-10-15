package adopt

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

func repo(t *testing.T) *catalog.Catalog {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func app(t *testing.T, c *catalog.Catalog, id string) *catalog.App {
	a, ok := c.Get(id)
	if !ok {
		t.Fatalf("no %s", id)
	}
	return a
}

var example = map[string]string{"MONEYMATTER_DB_PASSWORD": "__REPLACE_ME__", "PUID": "1000"}

func TestPlan(t *testing.T) {
	c := repo(t)
	env := map[string]string{"MEDIA_ROOT": "/Volumes/Media", "MONEYMATTER_DB_PASSWORD": "generated"}

	// MoneyMatter's database: a volume into a volume, and its password.
	db, err := Plan(c, app(t, c, "moneymatter-db"), Old{
		Name: "moneymatter-db", Image: "postgres:16",
		Mounts: []Mount{{Type: "volume", Name: "media-server_moneymatter-db", Destination: "/var/lib/postgresql/data"}},
		Env:    map[string]string{"POSTGRES_PASSWORD": "old-secret", "PUID": "501"},
	}, env, example, "/Users/me")
	if err != nil {
		t.Fatal(err)
	}
	if len(db.Copies) != 1 || db.Copies[0] != (Copy{From: "media-server_moneymatter-db", FromVolume: true, To: "homelab_budget_tracker_moneymatter-db", ToVolume: true, Target: "/var/lib/postgresql/data"}) {
		t.Errorf("db copies %+v", db.Copies)
	}
	if len(db.Settings) != 1 || db.Settings["MONEYMATTER_DB_PASSWORD"] != "old-secret" {
		t.Errorf("db settings %v", db.Settings)
	}

	// Vaultwarden: a folder into the homelab's folder.
	vw, err := Plan(c, app(t, c, "vaultwarden"), Old{
		Name: "vaultwarden", Image: "vaultwarden/server:latest",
		Mounts: []Mount{{Type: "bind", Source: "/Users/me/media-server/config/vaultwarden", Destination: "/data"}},
	}, env, example, "/Users/me")
	if err != nil {
		t.Fatal(err)
	}
	if len(vw.Copies) != 1 || vw.Copies[0].To != filepath.Join(c.Root, "data", "appdata", "vaultwarden") || vw.Copies[0].FromVolume || vw.Copies[0].ToVolume {
		t.Errorf("vaultwarden copies %+v", vw.Copies)
	}

	// Navidrome: the music folder is shared, so only its data folder moves.
	nd, err := Plan(c, app(t, c, "navidrome"), Old{
		Name: "navidrome", Image: "deluan/navidrome:latest",
		Mounts: []Mount{
			{Type: "bind", Source: "/Volumes/Media/music", Destination: "/Volumes/Media/music"},
			{Type: "bind", Source: "/Users/me/media-server/config/navidrome", Destination: "/data"},
		},
	}, env, example, "/Users/me")
	if err != nil {
		t.Fatal(err)
	}
	if len(nd.Copies) != 1 || nd.Copies[0].Target != "/data" {
		t.Errorf("navidrome copies %+v", nd.Copies)
	}

	if _, err := Plan(c, app(t, c, "moneymatter-db"), Old{Image: "postgres:15"}, env, example, "/Users/me"); err == nil {
		t.Error("PostgreSQL 15 data copied into 16")
	}
}
