package notify

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
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

// Each system's command, checked on every runner: the texts go as
// arguments or environment variables, never inside the script.
func TestDesktop(t *testing.T) {
	oldGOOS, oldRun := goos, run
	t.Cleanup(func() { goos, run = oldGOOS, oldRun })
	var got []*exec.Cmd
	run = func(c *exec.Cmd) error { got = append(got, c); return nil }
	ctx := context.Background()
	title, body := `Backup "failed"`, "$(rm -rf ~); it's fine"

	goos = "darwin"
	if err := Desktop(ctx, title, body); err != nil {
		t.Fatal(err)
	}
	if c := got[0]; c.Args[0] != "osascript" || !slices.Equal(c.Args[len(c.Args)-2:], []string{title, body}) {
		t.Errorf("macOS: %q", c.Args)
	}

	goos, got = "linux", nil
	dir := t.TempDir()
	t.Setenv("PATH", dir)
	if err := Desktop(ctx, title, body); err == nil || !strings.Contains(err.Error(), "notify-send") {
		t.Fatalf("no notify-send: %v", err)
	}
	stub := filepath.Join(dir, "notify-send")
	if runtime.GOOS == "windows" {
		stub += ".exe"
	}
	os.WriteFile(stub, nil, 0o755)
	if err := Desktop(ctx, title, body); err != nil {
		t.Fatal(err)
	}
	if c := got[0]; !slices.Equal(c.Args[1:], []string{"--app-name=Homelab", title, body}) {
		t.Errorf("Linux: %q", c.Args)
	}

	goos, got = "windows", nil
	if err := Desktop(ctx, title, body); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Args[0] != "reg" || got[0].Args[1] != "add" || got[0].Args[2] != toastKey {
		t.Fatalf("the name is not registered before the toast: %v", got)
	}
	toast := got[1]
	if toast.Args[0] != "powershell" || toast.Args[len(toast.Args)-1] != toastScript {
		t.Errorf("Windows: %q", toast.Args)
	}
	for _, v := range []string{"HOMELAB_TITLE=" + title, "HOMELAB_BODY=" + body, "HOMELAB_APP=" + ToastAppID} {
		if !slices.Contains(toast.Env, v) {
			t.Errorf("the toast has no %s", v)
		}
	}

	goos, got = "plan9", nil
	if err := Desktop(ctx, title, body); err == nil || len(got) != 0 {
		t.Errorf("an unknown system: %v %v", err, got)
	}

	goos, got = "windows", nil
	if err := UnregisterToastApp(); err != nil || !slices.Equal(got[0].Args, []string{"reg", "delete", toastKey, "/f"}) {
		t.Errorf("uninstall: %v %v", err, got)
	}
}

// On the Windows runner, uninstall's removal leaves no name behind.
func TestUnregisterToastApp(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows' registry")
	}
	if err := RegisterToastApp(); err != nil {
		t.Fatal(err)
	}
	if err := UnregisterToastApp(); err != nil {
		t.Fatal(err)
	}
	if out, err := exec.Command("reg", "query", toastKey).CombinedOutput(); err == nil {
		t.Fatalf("the name is still registered: %s", out)
	}
	if err := RegisterToastApp(); err != nil {
		t.Fatal(err)
	}
}
