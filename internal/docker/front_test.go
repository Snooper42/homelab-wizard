package docker

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

// The starter configuration.yaml every Home Assistant install got before
// N45, word for word.
const oldStarter = `# Written by the homelab when Home Assistant was first installed; edit freely.
# It is Home Assistant's own starter configuration plus the http block that
# trusts the proxy, so https://home.<your domain> works from the start.

# Loads the default set of integrations. Do not remove.
default_config:

automation: !include automations.yaml
script: !include scripts.yaml
scene: !include scenes.yaml

# Requests arrive through Nginx Proxy Manager on a Docker network, whose
# addresses depend on the runtime; Home Assistant's port only listens on
# this Mac, so trusting the private ranges is safe.
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 172.16.0.0/12
    - 192.168.0.0/16
    - 10.0.0.0/8
`

// N45 (backlog item 89, Home Assistant's half): an install that still has
// the old starter file ends up with exactly the new one before Home
// Assistant starts on the front network, where the proxy's request would
// otherwise be refused; and the starter shipped now trusts only the proxy
// and Tailscale Serve.
func TestHomeAssistantTrustsOnlyTheProxyAfterAnUpdate(t *testing.T) {
	now, err := os.ReadFile(filepath.Join("..", "..", "config", "home-assistant", "configuration.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	got, changed := trustFrontText(oldStarter)
	if !changed || got != string(now) {
		t.Fatalf("the old starter became:\n%s\nwant the starter shipped now:\n%s", got, now)
	}
	if again, changed := trustFrontText(string(now)); changed || again != string(now) {
		t.Errorf("the new starter was changed again:\n%s", again)
	}

	// Through Compose: the file in the homelab folder is rewritten before
	// any project starts, and keeps its permissions.
	root := t.TempDir()
	path := HomeAssistantConfig(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(oldStarter), 0o640); err != nil {
		t.Fatal(err)
	}
	f := &FakeRunner{}
	c := &Client{Runner: f, Bin: "docker"}
	if err := c.Compose(context.Background(), Project{Name: "homelab_household", Dir: root}, nil, "up", "--detach", "home-assistant"); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(path)
	if string(raw) != string(now) {
		t.Errorf("starting Home Assistant left its configuration:\n%s", raw)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o640 {
		t.Errorf("the rewrite changed its permissions to %v", info.Mode().Perm())
	}
	// Starting with no Home Assistant at all writes nothing.
	empty := t.TempDir()
	if err := c.Compose(context.Background(), Project{Name: "homelab_network", Dir: empty}, nil, "up", "--detach"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(HomeAssistantConfig(empty)); !os.IsNotExist(err) {
		t.Errorf("a configuration was made where there was none: %v", err)
	}
}

// What the household wrote stays: their own entries are kept and the two
// front addresses added, so the proxy is still trusted on the front network.
func TestHomeAssistantKeepsWhatTheHouseholdWrote(t *testing.T) {
	for name, c := range map[string]struct{ in, want string }{
		"a range of their own": {
			in:   "http:\n  use_x_forwarded_for: true\n  trusted_proxies:\n    - 192.168.0.0/16  # the old router\n  ip_ban_enabled: true\n",
			want: "http:\n  use_x_forwarded_for: true\n  trusted_proxies:\n    - 198.18.89.18\n    - 198.18.89.19\n    - 192.168.0.0/16  # the old router\n  ip_ban_enabled: true\n",
		},
		"the starter with one more, at the end of the file": {
			in:   "http:\n  trusted_proxies:\n  - 172.16.0.0/12\n  - 192.168.0.0/16\n  - 10.0.0.0/8\n  - 100.64.0.0/10",
			want: "http:\n  trusted_proxies:\n  - 198.18.89.18\n  - 198.18.89.19\n  - 100.64.0.0/10\n",
		},
		"one front address already": {
			in:   "http:\n  trusted_proxies:\n    - 198.18.89.18\n",
			want: "http:\n  trusted_proxies:\n    - 198.18.89.19\n    - 198.18.89.18\n",
		},
	} {
		got, changed := trustFrontText(c.in)
		if !changed || got != c.want {
			t.Errorf("%s: got\n%s\nwant\n%s", name, got, c.want)
		}
	}
	for name, in := range map[string]string{
		"no http block":     "default_config:\n",
		"a list on a line":  "http:\n  trusted_proxies: [172.16.0.0/12]\n",
		"already the front": "http:\n  trusted_proxies:\n    - 198.18.89.18\n    - 198.18.89.19\n    - 10.0.0.0/8\n",
	} {
		if got, changed := trustFrontText(in); changed || got != in {
			t.Errorf("%s was changed:\n%s", name, got)
		}
	}
}
