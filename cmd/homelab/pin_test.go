package main

import (
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// homelab pin keeps the app in data/pinned.json, by its ID, in the order
// pinned; unpin takes it out; an app not in the catalog is refused and
// nothing changes. A list still in .env from before is carried over into
// the record by the first pin, and the key leaves .env.
func TestPinAndUnpin(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t)
	f, err := envfile.Load(root + "/.env")
	if err != nil {
		t.Fatal(err)
	}
	f.Set(api.PinnedKey, "jellyfin")
	if err := f.Save(); err != nil {
		t.Fatal(err)
	}
	pinned := func() string {
		f, err := envfile.Load(root + "/.env")
		if err != nil {
			t.Fatal(err)
		}
		if v, ok := f.Get(api.PinnedKey); ok {
			t.Errorf("%s is still in .env: %q", api.PinnedKey, v)
		}
		return strings.Join(api.Pinned(root, nil), ",")
	}
	for _, app := range []string{"immich", "vaultwarden"} {
		if out, code := homelabCmd(t, root, "", "pin", app); code != 0 || !strings.Contains(out, "pinned to the top of Status") {
			t.Fatalf("pin %s (exit %d):\n%s", app, code, out)
		}
	}
	// An app's other name (immich) is kept as its ID.
	if got := pinned(); got != "jellyfin,immich-server,vaultwarden" {
		t.Fatalf("after two pins: %q", got)
	}
	if out, code := homelabCmd(t, root, "", "unpin", "immich"); code != 0 || !strings.Contains(out, "back in its group") {
		t.Fatalf("unpin (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "pin", "nothing-like-it"); code == 0 || !strings.Contains(out, "unknown app") {
		t.Fatalf("an unknown app (exit %d):\n%s", code, out)
	}
	if got := pinned(); got != "jellyfin,vaultwarden" {
		t.Fatalf("after unpin: %q", got)
	}
}
