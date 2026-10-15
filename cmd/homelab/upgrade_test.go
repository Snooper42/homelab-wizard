package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/ui"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

func TestUpgradePreview(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	git := func(dir string, args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false"}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	root, _ := repoCopy(t)
	origin, dev := filepath.Join(t.TempDir(), "origin.git"), filepath.Join(t.TempDir(), "dev")
	git(root, "init", "--bare", "-b", "main", origin)
	git(root, "init", "-q", "-b", "main")
	git(root, "add", "compose.yaml", "VERSION")
	git(root, "commit", "-q", "-m", "First")
	git(root, "remote", "add", "origin", origin)
	git(root, "push", "-q", "-u", "origin", "main")
	git(root, "clone", "-q", origin, dev)
	_ = os.MkdirAll(filepath.Join(dev, "docs"), 0o755)
	if err := os.WriteFile(filepath.Join(dev, "docs", "New.md"), []byte("# New\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	git(dev, "add", ".")
	git(dev, "commit", "-q", "-m", "Docs: a new page")
	git(dev, "push", "-q", "origin", "main")

	out := &bytes.Buffer{}
	h, err := newHomelab(&ui.UI{Out: out}, root)
	if err != nil {
		t.Fatal(err)
	}
	if err := h.upgradeCmd(context.Background(), nil); !errors.Is(err, errPreview) {
		t.Fatalf("without --apply and a terminal it is a preview: %v", err)
	}
	if !strings.Contains(out.String(), "1 change(s) on origin/main") || !strings.Contains(out.String(), "Docs: a new page") {
		t.Fatalf("preview:\n%s", out)
	}

	out.Reset()
	h.ui.JSON = true
	if err := h.upgradeCmd(context.Background(), nil); err != nil {
		t.Fatal(err)
	}
	var line struct {
		Type string        `json:"type"`
		Data upgrade.Check `json:"data"`
	}
	if err := json.Unmarshal(out.Bytes(), &line); err != nil || line.Type != "upgrade" || line.Data.Behind != 1 || line.Data.AppChanged {
		t.Fatalf("json %v: %s", err, out)
	}
}
