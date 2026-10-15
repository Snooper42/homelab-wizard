package main

import (
	"regexp"
	"strings"
	"testing"
)

func TestPhoneCommands(t *testing.T) {
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=example.com")
	out, code := homelabCmd(t, root, "", "phone", "pair", "--name", "Kitchen iPad")
	m := regexp.MustCompile(`https://homelab\.example\.com/#pair=([A-Z0-9]{8})`).FindStringSubmatch(out)
	if code != 0 || m == nil || !strings.Contains(out, "█") {
		t.Fatalf("pair (exit %d):\n%s", code, out)
	}
	if out, _ := homelabCmd(t, root, "", "phone", "list"); !strings.Contains(out, "no phones paired yet") {
		t.Errorf("a code alone is not a phone:\n%s", out)
	}
	if out, code := homelabCmd(t, root, "", "phone", "remove", "nobody"); code == 0 || !strings.Contains(out, "no paired phone") {
		t.Errorf("remove an unknown phone (exit %d):\n%s", code, out)
	}
}
