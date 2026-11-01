package main

import (
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/ui"
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
		{Name: "homelab_security-crowdsec-1", Image: "crowdsecurity/crowdsec:latest", Running: true, Status: "restarting", Project: "homelab_security", Service: "crowdsec"},
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
	for _, want := range []string{"===== doctor =====", "===== duplicati jobs =====", "===== weekly summary =====", "===== watchdog (last run) =====\nnot run yet", "===== restore tests (newest first) =====\nnone on record", "===== updates", "keeps images 24.1GB (12.3GB unused)", "DUPLICATI_PASSPHRASE: set", "container log: homelab_security-crowdsec-1"} {
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

func TestReportHasTheNewestCrash(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t)
	logs := filepath.Join(root, "scripts", "logs")
	_ = os.MkdirAll(logs, 0o755)
	crashLog := "== the background agent 0.9.7-beta, started 2026-10-25T03:00:00Z, process 41\nstopped unexpectedly 2026-10-25T03:30:12Z\nwhile in main.(*homelab).watchdog\n\npanic: assignment to entry in nil map\n\ngoroutine 7 [running]:\n"
	if err := os.WriteFile(filepath.Join(logs, "crash-2026-10-25.log"), []byte(crashLog), 0o644); err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(filepath.Join(logs, "watchdog.log"), []byte("== run\nall well\n"), 0o644)
	out, code := homelabCmd(t, root, "", "report", "--stdout")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	for _, want := range []string{"===== crash: the background agent stopped unexpectedly 2026-10-25 03:30 (scripts/logs/crash-2026-10-25.log", "panic: assignment to entry in nil map", "log: scripts/logs/watchdog.log"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q", want)
		}
	}
	if strings.Contains(out, "log: scripts/logs/crash-") {
		t.Error("the crash log is listed again among the jobs' logs")
	}
}

// Every secret .env.example names, by its key or by its placeholder
// (HOMEBOX_API_KEY_PEPPER=__REPLACE_ME__), is taken out of a report and
// of a log sent to a phone, whatever shape its value has: a generated
// value is plain text that no token pattern would catch.
func TestEverySecretIsRedacted(t *testing.T) {
	example, err := os.ReadFile(filepath.Join(repoDir(), ".env.example"))
	if err != nil {
		t.Fatal(err)
	}
	keyRe := regexp.MustCompile(`^([A-Za-z_][A-Za-z0-9_]*)=(.*)$`)
	secrets := map[string]string{}
	var env []string
	for _, line := range strings.Split(string(example), "\n") {
		m := keyRe.FindStringSubmatch(strings.TrimSpace(line))
		if m == nil || !settings.IsSecret(m[1], m[2]) {
			continue
		}
		v := "leakcheck" + strings.ToLower(strings.ReplaceAll(m[1], "_", "")) + "qz"
		secrets[m[1]] = v
		env = append(env, m[1]+"="+v)
	}
	if len(secrets) < 20 {
		t.Fatalf("read only %d secrets from .env.example", len(secrets))
	}
	root, _ := repoCopy(t, env...)
	h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: catalogOf(t)}
	var all []string
	for _, v := range secrets {
		all = append(all, "value: "+v)
	}
	text := strings.Join(all, "\n")
	for name, out := range map[string]string{"a report": redact(text, h.secretValues()), "a phone's log": h.phoneLog(text)} {
		for k, v := range secrets {
			if strings.Contains(out, v) {
				t.Errorf("%s leaked into %s", k, name)
			}
		}
	}
}
