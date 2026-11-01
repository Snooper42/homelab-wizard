package settings

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestListAndSave(t *testing.T) {
	root := t.TempDir()
	example := "# header\n\n# --- This Mac ---\nTZ=America/New_York\n\n# --- Domain ---\nHOMELAB_DOMAIN=example.com\n# For the certificate.\n# Second line.\nCLOUDFLARE_API_TOKEN=\nNPM_API_PASSWORD=__REPLACE_ME__\n"
	os.WriteFile(filepath.Join(root, ".env.example"), []byte(example), 0o644)
	os.WriteFile(filepath.Join(root, ".env"), []byte("TZ=Europe/Paris\nHOMELAB_DOMAIN=example.com\nCLOUDFLARE_API_TOKEN=cf-secret\nNPM_API_PASSWORD=generated\n"), 0o600)

	list, err := List(root)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]Setting{}
	for _, s := range list {
		got[s.Key] = s
	}
	if len(list) != 4 || got["TZ"].Section != "This Mac" || got["TZ"].Value != "Europe/Paris" || got["TZ"].Secret {
		t.Fatalf("list %+v", list)
	}
	cf := got["CLOUDFLARE_API_TOKEN"]
	if !cf.Secret || !cf.Set || cf.Value != "" || cf.Help != "For the certificate. Second line." || cf.Section != "Domain" {
		t.Fatalf("token %+v", cf)
	}
	if !got["NPM_API_PASSWORD"].Secret {
		t.Fatal("generated placeholder not secret")
	}

	if err := Save(root, map[string]string{"CLOUDFLARE_API_TOKEN": "new-token", "TZ": "America/Chicago"}); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(filepath.Join(root, ".env"))
	if !strings.Contains(string(data), "CLOUDFLARE_API_TOKEN=new-token") || !strings.Contains(string(data), "TZ=America/Chicago") {
		t.Fatalf(".env:\n%s", data)
	}
	// A blank secret field keeps the stored value.
	if err := Save(root, map[string]string{"CLOUDFLARE_API_TOKEN": "  "}); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(filepath.Join(root, ".env")); !strings.Contains(string(data), "CLOUDFLARE_API_TOKEN=new-token") {
		t.Fatalf("a blank secret field cleared the token:\n%s", data)
	}
	if err := Save(root, map[string]string{"EVIL": "x"}); err == nil || strings.Contains(err.Error(), "x\"") {
		t.Fatalf("unknown key: %v", err)
	}
	if err := Save(root, map[string]string{"TZ": "a\nB=1"}); err == nil {
		t.Fatal("multi-line value accepted")
	}
}

// SecretKeys marks a key secret as List does: by its name, or by the
// placeholder .env.example gives it, as a generated pepper or salt has.
func TestSecretKeys(t *testing.T) {
	keys := SecretKeys(filepath.Join("..", ".."))
	for _, k := range []string{"HOMEBOX_API_KEY_PEPPER", "GHOSTFOLIO_ACCESS_TOKEN_SALT", "JELLYFIN_API_KEY", "NAVIDROME_ADMIN_PASSWORD", "CLOUDFLARE_API_TOKEN"} {
		if !keys[k] {
			t.Errorf("%s is not marked secret", k)
		}
	}
	for _, k := range []string{"HOMELAB_DOMAIN", "NAVIDROME_ADMIN_USER", "VAULTWARDEN_URL"} {
		if keys[k] {
			t.Errorf("%s is marked secret", k)
		}
	}
	if got := SecretKeys(t.TempDir()); len(got) != 0 {
		t.Errorf("with no .env.example: %v", got)
	}
}

// SecretValues are .env's values for the secret keys (by name or by
// .env.example), long enough to be one; Hide takes each out of a text,
// the longest first, naming its key.
func TestSecretValuesAndHide(t *testing.T) {
	env := map[string]string{
		"HOMEBOX_API_KEY_PEPPER": "pepperValue123",
		"ADGUARD_PASSWORD":       "adguardPw99",
		"HOMELAB_DOMAIN":         "example.com",
		"SHORT_TOKEN":            "abc",
	}
	got := SecretValues(filepath.Join("..", ".."), env)
	for _, k := range []string{"HOMEBOX_API_KEY_PEPPER", "ADGUARD_PASSWORD"} {
		if got[k] != env[k] {
			t.Errorf("%s missing: %v", k, got)
		}
	}
	if _, ok := got["HOMELAB_DOMAIN"]; ok {
		t.Error("a domain is not a secret")
	}
	if _, ok := got["SHORT_TOKEN"]; ok {
		t.Error("three letters would take out too much")
	}
	text := Hide("pepper=pepperValue123 pw=adguardPw99", got)
	if strings.Contains(text, "pepperValue123") || strings.Contains(text, "adguardPw99") || !strings.Contains(text, "[redacted HOMEBOX_API_KEY_PEPPER]") {
		t.Errorf("hidden: %s", text)
	}
}
