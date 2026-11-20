package kept

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestTicks: a tick is kept by the setting's name, never its value, and a
// new value clears it.
func TestTicks(t *testing.T) {
	root := t.TempDir()
	if len(Load(root)) != 0 {
		t.Fatal("nothing ticked yet")
	}
	if err := Mark(root, "DUPLICATI_PASSPHRASE", true); err != nil {
		t.Fatal(err)
	}
	if err := Mark(root, "app:sonarr", true); err != nil {
		t.Fatal(err)
	}
	if got := Load(root); !got["DUPLICATI_PASSPHRASE"] || !got["app:sonarr"] {
		t.Fatalf("ticks: %v", got)
	}
	data, _ := os.ReadFile(filepath.Join(root, "data", "kept.json"))
	if !strings.Contains(string(data), "DUPLICATI_PASSPHRASE") {
		t.Fatalf("kept by name: %s", data)
	}
	if err := Mark(root, "app:sonarr", false); err != nil {
		t.Fatal(err)
	}
	if err := Forget(root, []string{"DUPLICATI_PASSPHRASE", "NOT_TICKED"}); err != nil {
		t.Fatal(err)
	}
	if got := Load(root); len(got) != 0 {
		t.Fatalf("untick and a new value clear: %v", got)
	}
	if err := Mark(root, "../x", true); err == nil {
		t.Fatal("only setting names and app:<id>")
	}
}

// TestUnsaved: what isn't ticked yet, the ones that open the backups first.
func TestUnsaved(t *testing.T) {
	secrets := []Secret{
		{App: "sonarr", Key: "app:sonarr", Label: "Sonarr's API key"},
		{App: "duplicati", Key: "DUPLICATI_PASSWORD", Label: "Duplicati's password"},
		{App: "duplicati", Key: "DUPLICATI_PASSPHRASE", Label: "Duplicati's backup passphrase", Recovery: true},
		{App: "kopia", Key: "KOPIA_PASSWORD", Label: "Kopia's repository password", Recovery: true},
	}
	got := Unsaved(secrets, map[string]bool{"KOPIA_PASSWORD": true})
	var keys []string
	for _, s := range got {
		keys = append(keys, s.Key)
	}
	if strings.Join(keys, ",") != "DUPLICATI_PASSPHRASE,app:sonarr,DUPLICATI_PASSWORD" {
		t.Fatalf("unsaved, Keep safe first: %v", keys)
	}
	if by := ByApp(got); by["duplicati"] != 2 || by["sonarr"] != 1 || by["kopia"] != 0 {
		t.Fatalf("by app: %v", by)
	}
}
