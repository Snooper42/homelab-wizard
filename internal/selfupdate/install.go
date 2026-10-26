package selfupdate

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// The ways the app can be installed, each replaced by its own build.
const (
	KindMac             = "mac"              // an .app; Path is the bundle
	KindWindows         = "windows"          // the installer's folder; Path is the folder
	KindWindowsPortable = "windows-portable" // the portable zip's folder; Path is the folder
	KindAppImage        = "appimage"         // Path is the AppImage file
	KindDeb             = "deb"              // Path is the program, /usr/bin/homelab-wizard
	KindRPM             = "rpm"
	KindArch            = "arch"
)

// Installed is how this copy of the app was installed; Kind is "" for one
// that cannot replace itself (a local build, or a copy run from elsewhere).
type Installed struct {
	Kind string
	Path string
}

// AsksPermission reports whether putting a new build in place asks for an
// administrator's password (the Windows installer, a Linux package), so it
// is not done unasked when the app quits.
func (in Installed) AsksPermission() bool {
	switch in.Kind {
	case KindWindows, KindDeb, KindRPM, KindArch:
		return true
	}
	return false
}

// packageProgram is where the Linux packages put the app.
const packageProgram = "/usr/bin/homelab-wizard"

// Current is how this copy was installed. Tests replace it.
var Current = func() Installed {
	exe, err := os.Executable()
	if err != nil {
		return Installed{}
	}
	if p, err := filepath.EvalSymlinks(exe); err == nil {
		exe = p
	}
	return detect(runtime.GOOS, exe, os.Getenv, func(p string) bool {
		_, err := os.Stat(p)
		return err == nil
	})
}

// detect tells the kind of install from the program's path, the
// environment, and which files exist.
func detect(goos, exe string, getenv func(string) string, exists func(string) bool) Installed {
	switch goos {
	case "darwin":
		if i := strings.Index(exe, ".app/Contents/"); i >= 0 {
			return Installed{KindMac, exe[:i+len(".app")]}
		}
	case "windows":
		// Split by hand, so tests on other systems read Windows paths too.
		i := strings.LastIndexAny(exe, `\/`)
		if i < 0 {
			break
		}
		dir := exe[:i]
		switch {
		case exists(dir + `\uninstall.exe`):
			return Installed{KindWindows, dir}
		case exists(dir + `\homelab.exe`):
			return Installed{KindWindowsPortable, dir}
		}
	case "linux":
		if p := getenv("APPIMAGE"); p != "" {
			return Installed{KindAppImage, p}
		}
		if exe != packageProgram {
			return Installed{}
		}
		switch {
		case exists("/var/lib/dpkg/info/homelab-wizard.list"):
			return Installed{KindDeb, exe}
		case exists("/usr/bin/pacman"):
			return Installed{KindArch, exe}
		case exists("/usr/bin/rpm"):
			return Installed{KindRPM, exe}
		}
	}
	return Installed{}
}

// asset is the release file that replaces this kind of install.
func (in Installed) asset(r Release) (Asset, bool) {
	return in.assetFor(r, runtime.GOARCH)
}

func (in Installed) assetFor(r Release, goarch string) (Asset, bool) {
	match := func(prefix, suffix string) (Asset, bool) {
		for _, a := range r.Assets {
			if strings.HasPrefix(a.Name, prefix) && strings.HasSuffix(a.Name, suffix) {
				return a, true
			}
		}
		return Asset{}, false
	}
	switch in.Kind {
	case KindMac:
		return match(MacAsset, MacAsset)
	case KindWindows:
		return match("Homelab-Wizard-Windows-Setup.exe", "")
	case KindWindowsPortable:
		if goarch == "arm64" {
			return match("Homelab-Wizard-Windows-ARM64-portable.zip", "")
		}
		return match("Homelab-Wizard-Windows-portable.zip", "")
	}
	if goarch != "amd64" {
		return Asset{}, false // the Linux builds are for x86-64 only
	}
	switch in.Kind {
	case KindAppImage:
		return match("Homelab-Wizard-x86_64.AppImage", "")
	case KindDeb:
		return match("homelab-wizard_", "_amd64.deb")
	case KindRPM:
		return match("homelab-wizard-", ".x86_64.rpm")
	case KindArch:
		return match("homelab-wizard-", "-x86_64.pkg.tar.zst")
	}
	return Asset{}, false
}

// swapLinux starts swapLinuxScript, detached, for an AppImage or a package.
func swapLinux(in Installed, pid, staged, reopen string) error {
	install := ""
	switch in.Kind {
	case KindDeb:
		install = "apt-get install -y --reinstall --allow-downgrades"
	case KindRPM:
		install = "rpm -U --replacepkgs --oldpackage"
	case KindArch:
		install = "pacman -U --noconfirm"
	}
	if install != "" {
		if _, err := exec.LookPath("pkexec"); err != nil {
			return errors.New("installing the new package needs pkexec (polkit), which is not installed; install the download from the release page instead")
		}
	}
	c := exec.Command("/bin/sh", "-c", swapLinuxScript, "sh", pid, in.Path, staged, reopen, install)
	c.SysProcAttr = detached()
	return start(c)
}

// swapLinuxScript waits for the app to quit, puts the new build in place
// (an AppImage by renaming it over the old one; a package through pkexec,
// which asks for the password), and opens the new app or restarts the tray
// item. $1 is the app's process, $2 the AppImage or program, $3 the
// download, $4 1 to open it, $5 the package install command ("" for an
// AppImage). The tray's pattern is written [h]omelab-wizard so it does not
// match this script's own command line, which holds its text.
const swapLinuxScript = `pid="$1"; app="$2"; new="$3"; reopen="$4"; install="$5"
i=0; while kill -0 "$pid" 2>/dev/null && [ $i -lt 300 ]; do sleep 0.2; i=$((i+1)); done
tray=0; pgrep -f "[h]omelab-wizard --tray" >/dev/null 2>&1 && tray=1
if [ -z "$install" ]; then
  cp "$new" "$app.new" && chmod +x "$app.new" && mv -f "$app.new" "$app"
  rm -f "$app.new"
else
  pkexec $install "$new"
fi
rm -f "$new"
pkill -f "[h]omelab-wizard --tray" 2>/dev/null
if [ "$reopen" = 1 ]; then nohup "$app" >/dev/null 2>&1 &
elif [ "$tray" = 1 ]; then nohup "$app" --tray >/dev/null 2>&1 &
fi`

// swapWindows writes swapWindowsScript beside the download and starts it
// in a hidden PowerShell.
func swapWindows(in Installed, pid, staged, reopen string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	script := filepath.Join(filepath.Dir(staged), "swap.ps1")
	if err := os.WriteFile(script, []byte(swapWindowsScript), 0o644); err != nil {
		return err
	}
	c := procattr.Hide(exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script,
		"-AppPid", pid, "-Dir", in.Path, "-Exe", filepath.Base(exe), "-Staged", staged, "-Kind", in.Kind, "-Reopen", reopen))
	return start(c)
}

// swapWindowsScript waits for the app to quit, stops everything running
// from its folder (the tray item, and the background agent with the jobs
// it started), puts the new build in place (the installer, silently, which
// asks for an administrator's approval; or the portable zip, unpacked over
// the folder), then starts the agent again from the sign-in entry and opens
// the app, or the tray item if it was running.
// #nosec G101 -- a PowerShell script, no credentials
const swapWindowsScript = `param([int]$AppPid, [string]$Dir, [string]$Exe, [string]$Staged, [string]$Kind, [int]$Reopen)
$ErrorActionPreference = 'Continue'
Wait-Process -Id $AppPid -Timeout 60 -ErrorAction SilentlyContinue
$tray = @(Get-CimInstance Win32_Process -Filter "Name = '$Exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*--tray*' }).Count -gt 0
Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($Dir + '\', [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
if ($Kind -eq 'windows') {
  Start-Process -FilePath $Staged -ArgumentList '/S', "/D=$Dir" -Verb RunAs -Wait
} else {
  Expand-Archive -LiteralPath $Staged -DestinationPath $Dir -Force
}
Remove-Item -LiteralPath $Staged -Force -ErrorAction SilentlyContinue
$run = (Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue).'homelab-agent'
if ($run) { Start-Process -FilePath 'cmd.exe' -ArgumentList "/s /c ""$run""" -WindowStyle Hidden }
$app = Join-Path $Dir $Exe
if ($Reopen -eq 1) { Start-Process -FilePath $app }
elseif ($tray) { Start-Process -FilePath $app -ArgumentList '--tray' }
`
