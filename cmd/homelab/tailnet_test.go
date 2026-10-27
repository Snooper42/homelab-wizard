package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
)

func TestTailnetSetupServesTheRunningApps(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "tailscale", Image: "tailscale/tailscale:latest", Running: true, Project: "homelab_network", Service: "tailscale"},
		{Name: "vaultwarden", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=")

	out, code := homelabCmd(t, root, "", "tailnet", "setup")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if !strings.Contains(out, "https://homelab.tail1.ts.net:8087") {
		t.Errorf("vaultwarden's address is missing:\n%s", out)
	}
	cfg, err := os.ReadFile(filepath.Join(root, tailnet.ConfigFile))
	if err != nil || !strings.Contains(string(cfg), "8087") || strings.Contains(string(cfg), "41641") {
		t.Errorf("serve config (%v):\n%s", err, cfg)
	}
	env, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := env.Get("TAILSCALE_HOST"); v != "homelab.tail1.ts.net" {
		t.Errorf("TAILSCALE_HOST = %q", v)
	}
	if v, _ := env.Get("VAULTWARDEN_URL"); v != "https://homelab.tail1.ts.net:8087" {
		t.Errorf("VAULTWARDEN_URL = %q", v)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "up --detach --no-deps vaultwarden") {
		t.Errorf("vaultwarden was not recreated with its address:\n%s", log)
	}

	// After an install, an unchanged config says nothing.
	if out, code = homelabCmd(t, root, "", "tailnet", "setup", "--auto"); code != 0 || strings.Contains(out, "On your tailnet") {
		t.Errorf("auto with nothing new (exit %d):\n%s", code, out)
	}
}

func TestTailnetSetupCanKeepAdminAppsOff(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "tailscale", Image: "tailscale/tailscale:latest", Running: true, Project: "homelab_network", Service: "tailscale"},
		{Name: "vaultwarden", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
		{Name: "duplicati", Image: "lscr.io/linuxserver/duplicati:latest", Running: true, Project: "homelab_system", Service: "duplicati"},
	})
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=", "TAILNET_ADMIN_APPS=false")
	if out, code := homelabCmd(t, root, "", "tailnet", "setup"); code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	cfg, _ := os.ReadFile(filepath.Join(root, tailnet.ConfigFile))
	if !strings.Contains(string(cfg), "8087") || strings.Contains(string(cfg), "duplicati") {
		t.Errorf("want Vaultwarden served and Duplicati kept off:\n%s", cfg)
	}
}

func TestTailnetSetupWithoutTailscale(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=")
	if out, code := homelabCmd(t, root, "", "tailnet", "setup"); code == 0 || !strings.Contains(out, "homelab install tailscale") {
		t.Errorf("exit %d:\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "tailnet", "setup", "--auto"); code != 0 {
		t.Errorf("auto must stay quiet (exit %d):\n%s", code, out)
	}
}

func TestTailnetLoginWithoutAKey(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{{Name: "homelab_network-tailscale-1", Image: "tailscale/tailscale:latest", Running: true, Project: "homelab_network", Service: "tailscale"}})
	t.Setenv("HOMELAB_NO_BROWSER", "1")
	status := filepath.Join(t.TempDir(), "status.json")
	t.Setenv("FAKE_TS_STATUS", status)
	if err := os.WriteFile(status, []byte(`{"BackendState":"NeedsLogin","AuthURL":"https://login.tailscale.com/a/abc123"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	poll := loginPoll
	loginPoll = 20 * time.Millisecond
	defer func() { loginPoll = poll }()
	// Signed in once the login has read the first status, however long
	// the command takes to get there.
	go func() {
		for end := time.Now().Add(30 * time.Second); time.Now().Before(end); time.Sleep(10 * time.Millisecond) {
			if _, err := os.Stat(status + ".read"); err == nil {
				break
			}
		}
		_ = os.WriteFile(status, []byte(`{"BackendState":"Running","Self":{"DNSName":"homelab.tail1.ts.net."}}`), 0o644)
	}()
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=")
	out, code := homelabCmd(t, root, "", "tailnet", "login")
	if code != 0 || !strings.Contains(out, "https://login.tailscale.com/a/abc123") || !strings.Contains(out, "signed in as homelab.tail1.ts.net") {
		t.Errorf("exit %d:\n%s", code, out)
	}
}

// Setup installs Tailscale and sets the addresses up in one go: with an
// auth key, Tailscale still waits for its login a moment after it starts,
// with no link, then signs itself in.
func TestTailnetSetupWaitsForTheAuthKeysSignIn(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{{Name: "homelab_network-tailscale-1", Image: "tailscale/tailscale:latest", Running: true, Project: "homelab_network", Service: "tailscale"}})
	t.Setenv("HOMELAB_NO_BROWSER", "1")
	status := filepath.Join(t.TempDir(), "status.json")
	t.Setenv("FAKE_TS_STATUS", status)
	if err := os.WriteFile(status, []byte(`{"BackendState":"NeedsLogin"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	poll := loginPoll
	loginPoll = 20 * time.Millisecond
	defer func() { loginPoll = poll }()
	go func() {
		for end := time.Now().Add(30 * time.Second); time.Now().Before(end); time.Sleep(10 * time.Millisecond) {
			if _, err := os.Stat(status + ".read"); err == nil {
				break
			}
		}
		_ = os.WriteFile(status, []byte(`{"BackendState":"Running","Self":{"DNSName":"homelab.tail1.ts.net."}}`), 0o644)
	}()
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=", "TAILSCALE_AUTHKEY=tskey-auth-abc")
	out, code := homelabCmd(t, root, "", "tailnet", "setup")
	if code != 0 || !strings.Contains(out, "signed in as homelab.tail1.ts.net") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	env, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := env.Get("TAILSCALE_HOST"); v != "homelab.tail1.ts.net" {
		t.Errorf("TAILSCALE_HOST = %q", v)
	}
}

func TestTailnetLoginGivesUpWithoutALink(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{{Name: "homelab_network-tailscale-1", Image: "tailscale/tailscale:latest", Running: true, Project: "homelab_network", Service: "tailscale"}})
	t.Setenv("HOMELAB_NO_BROWSER", "1")
	status := filepath.Join(t.TempDir(), "status.json")
	t.Setenv("FAKE_TS_STATUS", status)
	if err := os.WriteFile(status, []byte(`{"BackendState":"NeedsLogin"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	poll, wait := loginPoll, linkWait
	loginPoll, linkWait = 10*time.Millisecond, 100*time.Millisecond
	defer func() { loginPoll, linkWait = poll, wait }()
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=")
	if out, code := homelabCmd(t, root, "", "tailnet", "login"); code == 0 || !strings.Contains(out, "no sign-in link yet") {
		t.Errorf("exit %d:\n%s", code, out)
	}
}
