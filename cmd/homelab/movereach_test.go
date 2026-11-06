package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	moving "github.com/Snooper42/homelab-wizard/internal/move"
)

// A move file brings its maker's paired phones, Cloudflare tunnel, and own
// apps, which keep their reach here once it is moved in. From your own old
// machine that is what you want; from a file someone else made it would
// let them in. Move in names each before it asks.
func TestMoveInNamesWhatReachesIn(t *testing.T) {
	fakeDocker(t, nil)
	fakeSystemctl(t)
	src := t.TempDir()
	files := map[string]string{
		".env":                       "TUNNEL_TOKEN=eyJhIjoiYiJ9abcdefghijkl\nHOMELAB_DOMAIN=their.example\n",
		"data/phones.json":           `{"devices":[{"id":"a","name":"Mallory's iPhone","canChange":true},{"id":"b","name":"Kitchen TV"}]}`,
		"stacks/custom/compose.yaml": "name: homelab_custom\nservices:\n  miner:\n    image: \"evil/miner:latest\"\n",
	}
	for name, body := range files {
		p := filepath.Join(src, filepath.FromSlash(name))
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	var b bytes.Buffer
	if _, err := moving.Pack(src, moving.Manifest{Made: time.Now(), From: "someone's mac"}, &b); err != nil {
		t.Fatal(err)
	}
	bundle := filepath.Join(t.TempDir(), "move.tar")
	if err := os.WriteFile(bundle, b.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
	fresh, _ := repoCopy(t)
	out, _ := homelabCmd(t, fresh, "", "move", "in", bundle)
	for _, want := range []string{"Mallory's iPhone (may make changes)", "Kitchen TV", "Cloudflare tunnel", "their.example", "miner (evil/miner:latest)", "a file you made"} {
		if !strings.Contains(out, want) {
			t.Errorf("the plan does not say %q:\n%s", want, out)
		}
	}
	if _, err := os.Stat(filepath.Join(fresh, "data", "phones.json")); !os.IsNotExist(err) {
		t.Errorf("the preview unpacked the phones: %v", err)
	}
}
