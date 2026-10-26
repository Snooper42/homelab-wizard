//go:build forreal

package notify

import (
	"context"
	"os/exec"
	"strings"
	"testing"
	"time"
)

// An alert on Windows' screen, through the code path the watchdog uses
// (Desktop: the name registered, then a toast through PowerShell), seen in
// Windows' own record of the toasts it showed for that name (the Action
// Center's history). CI runs it on the Windows runner (go test -tags
// forreal).
func TestToastArrivesForReal(t *testing.T) {
	title := "Homelab test " + time.Now().Format("150405.000")
	t.Cleanup(func() { _ = UnregisterToastApp() })
	if err := Desktop(context.Background(), title, "Sent by TestToastArrivesForReal."); err != nil {
		t.Fatal(err)
	}
	const history = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
[Windows.UI.Notifications.ToastNotificationManager]::History.GetHistory('` + ToastAppID + `') | ForEach-Object { $_.Content.GetXml() }`
	var shown string
	for end := time.Now().Add(15 * time.Second); ; time.Sleep(time.Second) {
		out, err := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", history).CombinedOutput()
		if err != nil {
			t.Fatalf("reading the toast history: %v\n%s", err, out)
		}
		if shown = string(out); strings.Contains(shown, title) {
			break
		}
		if time.Now().After(end) {
			t.Fatalf("no toast %q in Windows' history for %s after 15 seconds:\n%s", title, ToastAppID, shown)
		}
	}
	t.Cleanup(func() {
		_ = exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command",
			`[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; [Windows.UI.Notifications.ToastNotificationManager]::History.Clear('`+ToastAppID+`')`).Run()
	})
}
