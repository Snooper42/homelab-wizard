package main

import (
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// homelab pin keeps the app in .env, by its ID, in the order pinned;
// unpin takes it out; an app not in the catalog is refused and nothing changes.
func TestPinAndUnpin(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t)
	pinned := func() string {
		f, err := envfile.Load(root + "/.env")
		if err != nil {
			t.Fatal(err)
		}
		return f.Map()[api.PinnedKey]
	}
	for _, app := range []string{"immich", "vaultwarden"} {
		if out, code := homelabCmd(t, root, "", "pin", app); code != 0 || !strings.Contains(out, "pinned to the top of Status") {
			t.Fatalf("pin %s (exit %d):\n%s", app, code, out)
		}
	}
	// An app's other name (immich) is kept as its ID.
	if got := pinned(); got != "immich-server,vaultwarden" {
		t.Fatalf("after two pins: %q", got)
	}
	if out, code := homelabCmd(t, root, "", "unpin", "immich"); code != 0 || !strings.Contains(out, "back in its group") {
		t.Fatalf("unpin (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "pin", "nothing-like-it"); code == 0 || !strings.Contains(out, "unknown app") {
		t.Fatalf("an unknown app (exit %d):\n%s", code, out)
	}
	if got := pinned(); got != "vaultwarden" {
		t.Fatalf("after unpin: %q", got)
	}
}
