package notify

import (
	"context"
	"errors"
	"os/exec"
	"runtime"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// Desktop shows a notification on this machine's screen: Notification
// Center on macOS, the desktop's notifications on Linux (notify-send), and
// a toast on Windows. Title and body travel as arguments, never inside a
// script, so nothing in them is run.
func Desktop(ctx context.Context, title, body string) error {
	var c *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		c = exec.CommandContext(ctx, "osascript",
			"-e", "on run argv",
			"-e", "display notification (item 2 of argv) with title \"Homelab\" subtitle (item 1 of argv)",
			"-e", "end run", title, body)
	case "linux":
		if _, err := exec.LookPath("notify-send"); err != nil {
			return errors.New("notify-send is not installed")
		}
		c = exec.CommandContext(ctx, "notify-send", "--app-name=Homelab", title, body)
	case "windows":
		// Windows shows a toast only for an app it knows: the name is
		// registered for this account first (no administrator needed).
		_ = RegisterToastApp()
		c = exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", toastScript)
		c.Env = append(c.Environ(), "HOMELAB_TITLE="+title, "HOMELAB_BODY="+body, "HOMELAB_APP="+ToastAppID)
	default:
		return errors.New("no desktop notifications here")
	}
	return procattr.Hide(c).Run()
}

// ToastAppID is the name Windows files the homelab's notifications under,
// in Settings › System › Notifications.
const ToastAppID = "Homelab.Wizard"

// toastKey is where an app without an installer package tells Windows its
// notifications' name, for this account.
const toastKey = `HKCU\Software\Classes\AppUserModelId\` + ToastAppID

// RegisterToastApp tells Windows the name the homelab's toasts carry
// ("Homelab Wizard"), so it shows them; one unknown to it is dropped
// without a word.
func RegisterToastApp() error {
	return procattr.Hide(exec.Command("reg", "add", toastKey, "/v", "DisplayName", "/t", "REG_SZ", "/d", "Homelab Wizard", "/f")).Run()
}

// UnregisterToastApp removes that name again (homelab uninstall).
func UnregisterToastApp() error {
	return procattr.Hide(exec.Command("reg", "delete", toastKey, "/f")).Run()
}

// toastScript shows a toast through PowerShell's WinRT bridge; the texts
// and the app's name come in as environment variables, never as script.
const toastScript = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$x = $t.GetElementsByTagName('text')
$x.Item(0).AppendChild($t.CreateTextNode($env:HOMELAB_TITLE)) > $null
$x.Item(1).AppendChild($t.CreateTextNode($env:HOMELAB_BODY)) > $null
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:HOMELAB_APP).Show([Windows.UI.Notifications.ToastNotification]::new($t))`
