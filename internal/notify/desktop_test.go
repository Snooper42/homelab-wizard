package notify

import (
	"os/exec"
	"runtime"
	"strings"
	"testing"
)

func TestToastScriptTakesItsTextsFromTheEnvironment(t *testing.T) {
	for _, v := range []string{"$env:HOMELAB_TITLE", "$env:HOMELAB_BODY", "CreateToastNotifier($env:HOMELAB_APP)"} {
		if !strings.Contains(toastScript, v) {
			t.Errorf("the script has no %s", v)
		}
	}
	if strings.Contains(toastScript, "'Homelab'") {
		t.Error("the toast still goes out under a name Windows does not know")
	}
}

// On the Windows runner, the name is registered for this account and
// reads back.
func TestRegisterToastApp(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows' registry")
	}
	if err := RegisterToastApp(); err != nil {
		t.Fatal(err)
	}
	out, err := exec.Command("reg", "query", toastKey, "/v", "DisplayName").CombinedOutput()
	if err != nil || !strings.Contains(string(out), "Homelab Wizard") {
		t.Fatalf("%v %s", err, out)
	}
}
