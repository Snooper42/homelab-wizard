package main

import (
	"strings"
	"testing"
)

func TestLaunchAgent(t *testing.T) {
	got := string(launchAgent("/Applications/Homelab & Co.app/Contents/Helpers/homelab-tray", nil))
	for _, want := range []string{"<string>" + autostartID + "</string>", "<string>/Applications/Homelab &amp; Co.app/Contents/Helpers/homelab-tray</string>", "<key>RunAtLoad</key>\n\t<true/>"} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in:\n%s", want, got)
		}
	}
}

func TestAutostartEntry(t *testing.T) {
	got := string(autostartEntry("/home/deck/Apps/Homelab Wizard.AppImage", []string{"--tray"}))
	if !strings.Contains(got, "Exec=\"/home/deck/Apps/Homelab Wizard.AppImage\" --tray\n") {
		t.Errorf("Exec line:\n%s", got)
	}
	if got := desktopQuote(`/opt/a "b" $c`); got != `"/opt/a \"b\" \$c"` {
		t.Errorf("desktopQuote = %s", got)
	}
	if got := desktopQuote("/usr/bin/homelab-wizard"); got != "/usr/bin/homelab-wizard" {
		t.Errorf("a plain path was quoted: %s", got)
	}
}

func TestRunValue(t *testing.T) {
	if got := runValue(`C:\Program Files\Homelab\Homelab Wizard.exe`, []string{"--tray"}); got != `"C:\Program Files\Homelab\Homelab Wizard.exe" --tray` {
		t.Errorf("runValue = %s", got)
	}
}
