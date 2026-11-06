package move

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Brings names what a bundle brings that reaches in, and nothing for one
// that brings none of it.
func TestBrings(t *testing.T) {
	pack := func(files map[string]string) string {
		src := t.TempDir()
		for name, body := range files {
			p := filepath.Join(src, filepath.FromSlash(name))
			_ = os.MkdirAll(filepath.Dir(p), 0o755)
			if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
				t.Fatal(err)
			}
		}
		var b bytes.Buffer
		if _, err := Pack(src, Manifest{Made: time.Now()}, &b); err != nil {
			t.Fatal(err)
		}
		path := filepath.Join(t.TempDir(), "move.tar")
		_ = os.WriteFile(path, b.Bytes(), 0o600)
		return path
	}
	r, err := Brings(pack(map[string]string{
		".env":                       "# a note\nTUNNEL_TOKEN=\"eyJabc\"\nHOMELAB_DOMAIN=home.example\nTZ=UTC\n",
		"data/phones.json":           `{"devices":[{"name":"Anna's phone","canChange":true},{"name":"Hall screen"}]}`,
		"stacks/custom/compose.yaml": "services:\n  b:\n    image: two\n  a:\n    image: one\n",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !r.Any() || !r.Tunnel || r.Domain != "home.example" ||
		strings.Join(r.Phones, "|") != "Anna's phone (may make changes)|Hall screen" ||
		strings.Join(r.Custom, "|") != "a (one)|b (two)" {
		t.Errorf("brings %+v", r)
	}
	r, err = Brings(pack(map[string]string{".env": "TUNNEL_TOKEN=\nTZ=UTC\n", "data/phones.json": "not json"}))
	if err != nil || r.Any() {
		t.Errorf("a bundle that brings nothing that reaches in: %+v, %v", r, err)
	}
	if _, err := Brings(filepath.Join(t.TempDir(), "none.tar")); err == nil {
		t.Error("no bundle, no error")
	}
}
