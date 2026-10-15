package main

import (
	"fmt"
	"os"
	"strings"
)

// autostartID names what this app registers to start at login.
const autostartID = "io.github.snooper42.HomelabWizard.tray"

// TrayAtLogin reports whether the menu bar item (the tray on Windows and
// Linux) starts when the user logs in.
func (a *App) TrayAtLogin() bool { return trayAtLogin() }

// SetTrayAtLogin turns starting the menu bar item at login on or off.
func (a *App) SetTrayAtLogin(on bool) error {
	if on {
		exe, args, err := trayCommand()
		if err != nil {
			return err
		}
		return enableTrayAtLogin(exe, args)
	}
	return disableTrayAtLogin()
}

// launchAgent is the launchd job that starts the menu bar helper at login.
func launchAgent(exe string, args []string) []byte {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>` + autostartID + `</string>
	<key>ProgramArguments</key>
	<array>
`)
	for _, a := range append([]string{exe}, args...) {
		b.WriteString("\t\t<string>" + xmlEscape(a) + "</string>\n")
	}
	b.WriteString(`	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>ProcessType</key>
	<string>Interactive</string>
</dict>
</plist>
`)
	return []byte(b.String())
}

// autostartEntry is the XDG autostart file that starts the tray at login.
func autostartEntry(exe string, args []string) []byte {
	quoted := []string{desktopQuote(exe)}
	for _, a := range args {
		quoted = append(quoted, desktopQuote(a))
	}
	return []byte(fmt.Sprintf(`[Desktop Entry]
Type=Application
Name=Homelab Wizard (tray)
Comment=How the homelab is doing, in the tray
Exec=%s
Icon=homelab-wizard
NoDisplay=true
X-GNOME-Autostart-enabled=true
`, strings.Join(quoted, " ")))
}

// runValue is the Windows Run-key command that starts the tray at login.
func runValue(exe string, args []string) string {
	parts := []string{`"` + exe + `"`}
	parts = append(parts, args...)
	return strings.Join(parts, " ")
}

func xmlEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}

// desktopQuote quotes one Exec argument as the Desktop Entry spec asks.
func desktopQuote(s string) string {
	if !strings.ContainsAny(s, " \t\"'`$\\<>~|&;*?#()") {
		return s
	}
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "`", "\\`", `$`, `\$`)
	return `"` + r.Replace(s) + `"`
}

// fileExists reports whether a regular file is at p.
func fileExists(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && !fi.IsDir()
}
