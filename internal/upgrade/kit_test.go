package upgrade

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/kit"
)

func writeKit(t *testing.T, files map[string]string, commit string) string {
	t.Helper()
	src := t.TempDir()
	var names []string
	for n, body := range files {
		_ = os.MkdirAll(filepath.Dir(filepath.Join(src, n)), 0o755)
		_ = os.WriteFile(filepath.Join(src, n), []byte(body), 0o644)
		names = append(names, n)
	}
	var buf bytes.Buffer
	if _, err := kit.Pack(&buf, src, names, "0.2.0", commit); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(t.TempDir(), kit.FileName)
	_ = os.WriteFile(out, buf.Bytes(), 0o644)
	return out
}

func TestInspectKit(t *testing.T) {
	v1 := writeKit(t, map[string]string{"compose.yaml": "a", ".env.example": "A=1\n", "docs/X.md": "x"}, "1111111aaa")
	root := filepath.Join(t.TempDir(), "Homelab")
	if _, err := kit.Extract(v1, root); err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(filepath.Join(root, "docs", "X.md"), []byte("mine"), 0o644)
	installed, _ := kit.Installed(root)

	c, err := inspectKit(Check{Checked: time.Now()}, root, installed, v1)
	if err != nil || !c.Kit || c.Behind != 0 || len(c.Dirty) != 1 || c.Dirty[0] != "docs/X.md" {
		t.Fatalf("same kit: %+v %v", c, err)
	}
	v2 := writeKit(t, map[string]string{"compose.yaml": "b", ".env.example": "A=1\nB=2\n"}, "2222222bbb")
	c, _ = inspectKit(Check{}, root, installed, v2)
	if c.Behind != 1 || c.KitPath != v2 || !c.SettingsChanged || c.Changes[0].Hash != "2222222" || c.NewVersion != "0.2.0" {
		t.Errorf("newer kit: %+v", c)
	}
	if c, _ := inspectKit(Check{}, root, installed, ""); c.Behind != 0 || !c.Kit {
		t.Errorf("no kit with this program: %+v", c)
	}
}
