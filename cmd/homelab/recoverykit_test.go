package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
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
