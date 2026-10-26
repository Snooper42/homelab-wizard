//go:build forreal && linux

package tray

import (
	"context"
	"testing"
	"time"

	"github.com/godbus/dbus/v5"

	"github.com/Snooper42/homelab-wizard/internal/notify"
)

// An alert on Linux's screen, through the code path the watchdog uses
// (notify.Desktop, then notify-send), arriving at the desktop's
// notification server: here one in this test, on a session bus of its
// own. CI runs it on Ubuntu (go test -tags forreal).
func TestDesktopAlertArrivesForReal(t *testing.T) {
	addr, conn := sessionBus(t)
	srv := notifications{got: make(chan [3]string, 1)}
	if err := conn.Export(srv, "/org/freedesktop/Notifications", "org.freedesktop.Notifications"); err != nil {
		t.Fatal(err)
	}
	if reply, err := conn.RequestName("org.freedesktop.Notifications", dbus.NameFlagDoNotQueue); err != nil || reply != dbus.RequestNameReplyPrimaryOwner {
		t.Fatalf("the server's name: %v %v", reply, err)
	}
	t.Setenv("DBUS_SESSION_BUS_ADDRESS", addr)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := notify.Desktop(ctx, "Vaultwarden is down", "The watchdog restarted it twice; it still does not answer."); err != nil {
		t.Fatal(err)
	}
	select {
	case n := <-srv.got:
		if n != [3]string{"Homelab", "Vaultwarden is down", "The watchdog restarted it twice; it still does not answer."} {
			t.Fatalf("arrived as %q", n)
		}
	case <-ctx.Done():
		t.Fatal("no notification arrived")
	}
}

// notifications stands in for the desktop's notification server
// (org.freedesktop.Notifications).
type notifications struct{ got chan [3]string }

func (n notifications) Notify(app string, replaces uint32, icon, summary, body string, actions []string, hints map[string]dbus.Variant, timeout int32) (uint32, *dbus.Error) {
	n.got <- [3]string{app, summary, body}
	return 1, nil
}

func (n notifications) GetCapabilities() ([]string, *dbus.Error) {
	return []string{"body"}, nil
}

func (n notifications) GetServerInformation() (string, string, string, string, *dbus.Error) {
	return "test", "homelab", "1", "1.2", nil
}

func (n notifications) CloseNotification(id uint32) *dbus.Error { return nil }
