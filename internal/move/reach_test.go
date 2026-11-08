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

// N30: an own app a bundle brings is named with what it takes beyond an
// ordinary app (privileged, Docker's socket, this computer's network or
// processes, its whole disk, added powers), so the plan does not list a
// service that controls the computer as it lists any other.
func TestBringsNamesWhatAnOwnAppTakes(t *testing.T) {
	src := t.TempDir()
	compose := `services:
  plain:
    image: one
    volumes: ["./data/appdata/plain:/data"]
  root:
    image: two
    privileged: true
    network_mode: host
    pid: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /:/host:ro
  long:
    image: three
    cap_add: [SYS_ADMIN]
    volumes:
      - type: bind
        source: /var/run/docker.sock
        target: /sock
`
	p := filepath.Join(src, "stacks", "custom", "compose.yaml")
	_ = os.MkdirAll(filepath.Dir(p), 0o755)
	if err := os.WriteFile(p, []byte(compose), 0o600); err != nil {
		t.Fatal(err)
	}
	var b bytes.Buffer
	if _, err := Pack(src, Manifest{Made: time.Now()}, &b); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "move.tar")
	_ = os.WriteFile(path, b.Bytes(), 0o600)
	r, err := Brings(path)
	if err != nil || len(r.Custom) != 3 {
		t.Fatalf("%+v %v", r, err)
	}
	if r.Custom[1] != "plain (one)" {
		t.Errorf("an ordinary own app: %q", r.Custom[1])
	}
	for i, want := range map[int][]string{
		0: {"long (three", "Docker's socket", "SYS_ADMIN"},
		2: {"root (two", "privileged", "Docker's socket", "this computer's network", "this computer's processes", "its whole disk"},
	} {
		for _, w := range want {
			if !strings.Contains(r.Custom[i], w) {
				t.Errorf("%q does not say %q", r.Custom[i], w)
			}
		}
	}
}
