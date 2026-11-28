//go:build realdocker

package realdocker

import (
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
)

// TestTheLiveCheckPasses runs the live check the owner runs on their Mac
// (`homelab doctor --live`, scripts/verify-mac-live.sh) against real Docker
// on Linux, so every row that does not need a Mac is proven before the
// owner's run: a container's whole life, a folder shared with a container,
// a volume and a PostgreSQL database backed up and restored, and a
// Duplicati backup restored from its files alone. The launchd row says it is
// not a Mac, and the connected apps' row has none to read on a homelab with
// none. Nothing it made is left behind. REALDOCKER_LIVE=1 runs it (the
// nightly workflow's live job).
func TestTheLiveCheckPasses(t *testing.T) {
	if os.Getenv("REALDOCKER_LIVE") == "" {
		t.Skip("REALDOCKER_LIVE is not set")
	}
	l := newLab(t)
	// The household's machine has Duplicati's image; this one gets it, so
	// the blind restore's row runs rather than says it can't.
	const duplicati = "lscr.io/linuxserver/duplicati:latest"
	if exec.Command("docker", "image", "inspect", duplicati).Run() != nil {
		if out, err := exec.Command("docker", "pull", "--quiet", duplicati).CombinedOutput(); err != nil {
			t.Fatalf("pulling Duplicati's image: %v\n%s", err, out)
		}
	}
	// Immich's own database image, for its round: fetched where it can be.
	// CI always can, and must run it; a machine that can't reach its
	// registry runs the rest.
	immich := ""
	if c, err := catalog.Load(l.root); err == nil {
		if a, ok := c.Get("immich-database"); ok {
			immich, _ = compose.Interpolate(a.Image, compose.MapLookup(map[string]string{}))
		}
	}
	if immich == "" {
		t.Fatal("no Immich database image in the catalog")
	}
	if out, err := exec.Command("docker", "pull", "--quiet", immich).CombinedOutput(); err != nil {
		if os.Getenv("GITHUB_ACTIONS") == "true" {
			t.Fatalf("pulling %s: %v\n%s", immich, err, out)
		}
		t.Logf("Immich's database image can't be fetched here, so its round is skipped: %s", strings.TrimSpace(string(out)))
	}
	out, err := l.try("doctor", "--live")
	if err != nil {
		t.Fatalf("the live check failed: %v", err)
	}
	for _, row := range []string{
		"PASS    Docker engine",
		"PASS    Container start, stop, remove",
		"PASS    A folder shared with a container",
		"PASS    A volume backed up and restored",
		"PASS    A database dumped and restored",
		"PASS    A database put back after a schema change",
		"PASS    Duplicati: a blind restore",
		"SKIP    The scheduled agent (launchd)",
		"0 failed",
	} {
		if !strings.Contains(out, row) {
			t.Errorf("no %q in the live check's table", row)
		}
	}
	if os.Getenv("GITHUB_ACTIONS") == "true" && !strings.Contains(out, "PASS    Immich's database dumped and restored") {
		t.Error("Immich's database round did not pass")
	}
	// Only its own, and none of it left.
	for _, args := range [][]string{
		{"ps", "--all", "--filter", "name=homelab-verify-", "--format", "{{.Names}}"},
		{"volume", "ls", "--filter", "name=homelab-verify-", "--format", "{{.Name}}"},
	} {
		left, err := exec.Command("docker", args...).Output()
		if err != nil {
			t.Fatalf("docker %s: %v", strings.Join(args, " "), err)
		}
		if s := strings.TrimSpace(string(left)); s != "" {
			t.Errorf("left behind (docker %s): %s", args[0], s)
		}
	}
}
