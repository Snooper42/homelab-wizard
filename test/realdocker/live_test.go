//go:build realdocker

package realdocker

import (
	"os"
	"os/exec"
	"strings"
	"testing"
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
		"PASS    Duplicati: a blind restore",
		"SKIP    The scheduled agent (launchd)",
		"0 failed",
	} {
		if !strings.Contains(out, row) {
			t.Errorf("no %q in the live check's table", row)
		}
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
