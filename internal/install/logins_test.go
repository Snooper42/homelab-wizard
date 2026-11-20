package install

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/kept"
	"github.com/Snooper42/homelab-wizard/internal/qbitconf"
	"github.com/Snooper42/homelab-wizard/internal/selector"
)

// arr-loop item 1d: qBittorrent starts with the homelab's login, so it
// never prints a temporary password and wire can sign in at once.
func TestQbittorrentStartsWithItsLogin(t *testing.T) {
	media := t.TempDir()
	in, client, _ := fixture(t, nil,
		"PROTONVPN_WIREGUARD_PRIVATE_KEY=k",
		"MEDIA_ROOT="+media,
		"DOWNLOADS_ROOT="+filepath.Join(media, "downloads"),
		"QBITTORRENT_USER=admin",
		"QBITTORRENT_PASSWORD=",
	)
	root := in.Catalog.Root
	// A tick from before is for a password that's about to change.
	if err := kept.Mark(root, "QBITTORRENT_PASSWORD", true); err != nil {
		t.Fatal(err)
	}
	sel, err := selector.Resolve(in.Catalog, []string{"qbittorrent"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Problems) > 0 {
		t.Fatalf("problems: %v", plan.Problems)
	}
	if len(plan.Logins) != 1 || plan.Logins[0].App != "qbittorrent" {
		t.Fatalf("logins %+v", plan.Logins)
	}
	generated := false
	for _, c := range plan.EnvChanges {
		generated = generated || c.Key == "QBITTORRENT_PASSWORD" && c.Secret
	}
	if !generated {
		t.Fatalf("no password generated: %+v", plan.EnvChanges)
	}
	if err := Apply(context.Background(), plan, client, in.Catalog, in.EnvFile); err != nil {
		t.Fatal(err)
	}
	env, _ := envfile.Load(in.EnvFile)
	pw, _ := env.Get("QBITTORRENT_PASSWORD")
	conf := filepath.Join(root, "data", "appdata", "qbittorrent", qbitconf.Path)
	data, err := os.ReadFile(conf)
	if err != nil {
		t.Fatal(err)
	}
	if pw == "" || !qbitconf.Verify(data, pw) {
		t.Fatalf("qBittorrent's file doesn't take .env's password %q:\n%s", pw, data)
	}
	if kept.Load(root)["QBITTORRENT_PASSWORD"] {
		t.Fatal("the old Saved tick stayed on a new password")
	}

	// Again: the file is there, so nothing is planned or changed.
	in.Containers = nil
	plan, err = Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Logins) != 0 {
		t.Fatalf("second plan: %+v", plan.Logins)
	}
	if err := Apply(context.Background(), plan, client, in.Catalog, in.EnvFile); err != nil {
		t.Fatal(err)
	}
	again, _ := os.ReadFile(conf)
	env, _ = envfile.Load(in.EnvFile)
	if pw2, _ := env.Get("QBITTORRENT_PASSWORD"); string(again) != string(data) || pw2 != pw {
		t.Fatal("a second install changed qBittorrent's login")
	}
}

// A qBittorrent that has its own settings keeps them, password and all.
func TestQbittorrentsOwnSettingsStay(t *testing.T) {
	media := t.TempDir()
	in, _, _ := fixture(t, nil,
		"PROTONVPN_WIREGUARD_PRIVATE_KEY=k",
		"MEDIA_ROOT="+media,
		"DOWNLOADS_ROOT="+filepath.Join(media, "downloads"),
		"QBITTORRENT_PASSWORD=",
	)
	conf := filepath.Join(in.Catalog.Root, "data", "appdata", "qbittorrent", qbitconf.Path)
	os.MkdirAll(filepath.Dir(conf), 0o755)
	os.WriteFile(conf, []byte("[Preferences]\n"), 0o644)
	sel, _ := selector.Resolve(in.Catalog, []string{"qbittorrent"}, nil)
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Logins) != 0 {
		t.Fatalf("logins %+v", plan.Logins)
	}
	for _, c := range plan.EnvChanges {
		if c.Key == "QBITTORRENT_PASSWORD" {
			t.Fatalf("a password was made for a qBittorrent that has its own: %+v", c)
		}
	}
}
