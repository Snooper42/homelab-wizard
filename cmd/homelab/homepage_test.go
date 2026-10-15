package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

func TestHomepageListsRunningApps(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_system-homepage-1", Image: "ghcr.io/gethomepage/homepage:latest", Running: true, Project: "homelab_system", Service: "homepage"},
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
		{Name: "homelab_household-mealie-1", Image: "ghcr.io/mealie-recipes/mealie:latest", Running: false, Project: "homelab_household", Service: "mealie"},
	})
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=example.com")
	out, code := homelabCmd(t, root, "", "homepage")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	data, err := os.ReadFile(filepath.Join(root, "data", "appdata", "homepage", "services.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	page := string(data)
	for _, want := range []string{`- "Security":`, `- "Vaultwarden":`, `icon: "vaultwarden.png"`, `href: "https://passwords.example.com"`, `- "Homepage":`} {
		if !strings.Contains(page, want) {
			t.Errorf("missing %s in:\n%s", want, page)
		}
	}
	if strings.Contains(page, "Mealie") {
		t.Error("a stopped app is listed")
	}

	// A file someone edited is left alone.
	hand := "- Mine:\n    - Router:\n        href: http://192.168.1.1\n"
	_ = os.WriteFile(filepath.Join(root, "data", "appdata", "homepage", "services.yaml"), []byte(hand), 0o644)
	if out, code := homelabCmd(t, root, "", "homepage"); code != 0 || !strings.Contains(out, "edited by hand") {
		t.Fatalf("hand-made file: exit %d\n%s", code, out)
	}
	if data, _ := os.ReadFile(filepath.Join(root, "data", "appdata", "homepage", "services.yaml")); string(data) != hand {
		t.Error("the hand-made file was changed")
	}
}

func TestHomepageNotInstalled(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t)
	if out, code := homelabCmd(t, root, "", "homepage"); code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if _, err := os.Stat(filepath.Join(root, "data", "appdata", "homepage", "services.yaml")); err == nil {
		t.Error("written without Homepage installed")
	}
}

func TestDigestPreview(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "unhealthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "digest")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	for _, want := range []string{"Homelab this week:", "need a look", "Vaultwarden (unhealthy)", "No restore test yet", "--send sends it now"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
}

func TestReportSectionsAndRedaction(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
	})
	secrets := map[string]string{
		"DUPLICATI_PASSPHRASE":         "Zq7passphraseNotToLeak1234",
		"DUPLICATI_SECRETS_PASSPHRASE": "Kx9anotherPassphraseSecret",
		"NTFY_PHONE_PASSWORD":          "PhonePassw0rdThatStaysHome",
		"CLOUDFLARE_API_TOKEN":         "cfTokenValueThatMustNotShow",
	}
	var env []string
	for k, v := range secrets {
		env = append(env, k+"="+v)
	}
	root, _ := repoCopy(t, env...)
	out, code := homelabCmd(t, root, "", "report", "--stdout")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	for _, want := range []string{"===== doctor =====", "===== duplicati jobs =====", "===== weekly summary =====", "===== watchdog (last run) =====\nnot run yet", "===== restore tests (newest first) =====\nnone on record", "===== updates", "keeps images 24.1GB (12.3GB unused)", "DUPLICATI_PASSPHRASE: set"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q", want)
		}
	}
	for k, v := range secrets {
		if strings.Contains(out, v) {
			t.Errorf("%s leaked into the report", k)
		}
	}
}

func TestHomepageTabsPerPerson(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_system-homepage-1", Image: "ghcr.io/gethomepage/homepage:latest", Running: true, Project: "homelab_system", Service: "homepage"},
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
		{Name: "homelab_household-mealie-1", Image: "ghcr.io/mealie-recipes/mealie:latest", Running: true, Project: "homelab_household", Service: "mealie"},
	})
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=example.com")
	list := `[{"username":"anna","name":"Anna Smith","pocketId":"u-1","added":"2026-10-01T00:00:00Z","removed":"0001-01-01T00:00:00Z"},
{"username":"ben","name":"Ben Smith","pocketId":"u-2","added":"2026-10-01T00:00:00Z","removed":"0001-01-01T00:00:00Z"}]`
	_ = os.MkdirAll(filepath.Join(root, "data"), 0o700)
	if err := os.WriteFile(filepath.Join(root, "data", "people.json"), []byte(list), 0o600); err != nil {
		t.Fatal(err)
	}
	if out, code := homelabCmd(t, root, "", "person", "apps", "ben", "mealie"); code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "person", "apps", "ben", "homepage"); code == 0 || !strings.Contains(out, "machinery") {
		t.Errorf("Homepage itself as one of Ben's apps (exit %d):\n%s", code, out)
	}
	services, _ := os.ReadFile(filepath.Join(root, "data", "appdata", "homepage", "services.yaml"))
	settings, _ := os.ReadFile(filepath.Join(root, "data", "appdata", "homepage", "settings.yaml"))
	ben := string(services[strings.Index(string(services), `- "Ben's apps":`):])
	if !strings.Contains(string(services), `- "Anna's apps":`) || !strings.Contains(ben, "Mealie") || strings.Contains(ben, "Vaultwarden") {
		t.Errorf("services.yaml:\n%s", services)
	}
	for _, want := range []string{`"Anna's apps":` + "\n    tab: \"Anna\"", `"Ben's apps":` + "\n    tab: \"Ben\"", `"Household":` + "\n    tab: \"Everything\""} {
		if !strings.Contains(string(settings), want) {
			t.Errorf("settings.yaml lacks %q:\n%s", want, settings)
		}
	}
	if out, _ := homelabCmd(t, root, "", "person", "apps", "ben"); !strings.Contains(out, "Ben Smith uses Mealie") {
		t.Errorf("listing Ben's apps:\n%s", out)
	}
}
