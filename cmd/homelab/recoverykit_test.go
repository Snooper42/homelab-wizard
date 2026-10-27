package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

func TestRecoveryKit(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t)
	env := filepath.Join(root, ".env")
	data, _ := os.ReadFile(env)
	data = append(data, "\nBACKUP_DESTINATION=/Volumes/Backups/homelab\nDUPLICATI_SECRETS_PASSPHRASE=do-not-print-me\n"...)
	if err := os.WriteFile(env, data, 0o600); err != nil {
		t.Fatal(err)
	}
	if out, code := homelabCmd(t, root, "", "recovery-kit"); code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	page, err := os.ReadFile(filepath.Join(root, kitFile))
	if err != nil {
		t.Fatal(err)
	}
	s := string(page)
	for _, want := range []string{"/Volumes/Backups/homelab", "Homelab Secrets", "DUPLICATI_SECRETS_PASSPHRASE", "Restore"} {
		if !strings.Contains(s, want) {
			t.Errorf("the kit is missing %q", want)
		}
	}
	if strings.Contains(s, "do-not-print-me") {
		t.Error("the kit holds a passphrase")
	}
}

// The kit is safe to print and enough to start a restore: with every secret
// .env.example has (each generated value, each passphrase) given a value of
// its own, none of them is on the kit, and the kit names what a restore
// reads (the backup folder, every backup job, and the line for the Secrets
// passphrase written by hand).
func TestRecoveryKitHoldsNoSecretAndNamesWhatARestoreNeeds(t *testing.T) {
	fakeDocker(t, nil)
	example, err := envfile.Load(filepath.Join(repoDir(), ".env.example"))
	if err != nil {
		t.Fatal(err)
	}
	var lines, secrets []string
	for _, k := range example.Keys() {
		if v, _ := example.Get(k); envfile.Placeholder.MatchString(v) {
			s := "kit-test-secret-" + strings.ToLower(k)
			lines, secrets = append(lines, k+"="+s), append(secrets, s)
		}
	}
	if len(secrets) < 10 {
		t.Fatalf("only %d secrets in .env.example: %q", len(secrets), secrets)
	}
	root, _ := repoCopy(t, append(lines, "BACKUP_DESTINATION=/Volumes/Backups/homelab")...)
	if out, code := homelabCmd(t, root, "", "recovery-kit"); code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	page, err := os.ReadFile(filepath.Join(root, kitFile))
	if err != nil {
		t.Fatal(err)
	}
	s := string(page)
	for _, secret := range secrets {
		if strings.Contains(s, secret) {
			t.Errorf("the kit holds a secret: %s", secret)
		}
	}
	want := []string{"/Volumes/Backups/homelab", "DUPLICATI_SECRETS_PASSPHRASE"}
	for _, j := range duplicati.HomelabJobs {
		want = append(want, j.Name)
	}
	for _, w := range want {
		if !strings.Contains(s, w) {
			t.Errorf("the kit does not name %q", w)
		}
	}
}
