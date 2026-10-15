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
		// A toast through PowerShell's WinRT bridge; the texts come in as
		// environment variables, not as script.
		script := `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$x = $t.GetElementsByTagName('text')
$x.Item(0).AppendChild($t.CreateTextNode($env:HOMELAB_TITLE)) > $null
$x.Item(1).AppendChild($t.CreateTextNode($env:HOMELAB_BODY)) > $null
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Homelab').Show([Windows.UI.Notifications.ToastNotification]::new($t))`
		c = exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", script)
		c.Env = append(c.Environ(), "HOMELAB_TITLE="+title, "HOMELAB_BODY="+body)
	default:
		return errors.New("no desktop notifications here")
	}
	return procattr.Hide(c).Run()
}
