package selfupdate

import "testing"

func TestDetect(t *testing.T) {
	files := map[string]bool{}
	exists := func(p string) bool { return files[p] }
	env := map[string]string{}
	getenv := func(k string) string { return env[k] }
	check := func(goos, exe string, want Installed) {
		t.Helper()
		if got := detect(goos, exe, getenv, exists); got != want {
			t.Errorf("%s %s: got %+v, want %+v", goos, exe, got, want)
		}
	}
	check("darwin", "/Applications/Homelab Wizard.app/Contents/MacOS/homelab-wizard", Installed{KindMac, "/Applications/Homelab Wizard.app"})
	check("darwin", "/tmp/homelab-wizard", Installed{})

	files[`C:\Program Files\Homelab\Homelab Wizard\uninstall.exe`] = true
	check("windows", `C:\Program Files\Homelab\Homelab Wizard\homelab-wizard.exe`, Installed{KindWindows, `C:\Program Files\Homelab\Homelab Wizard`})
	files[`D:\Apps\Homelab\homelab.exe`] = true
	check("windows", `D:\Apps\Homelab\homelab-wizard.exe`, Installed{KindWindowsPortable, `D:\Apps\Homelab`})
	check("windows", `D:\Downloads\homelab-wizard.exe`, Installed{})

	check("linux", "/home/me/dev/homelab-wizard", Installed{})
	files["/usr/bin/rpm"] = true
	check("linux", packageProgram, Installed{KindRPM, packageProgram})
	files["/usr/bin/pacman"] = true
	check("linux", packageProgram, Installed{KindArch, packageProgram})
	files["/var/lib/dpkg/info/homelab-wizard.list"] = true
	check("linux", packageProgram, Installed{KindDeb, packageProgram})
	env["APPIMAGE"] = "/home/deck/Applications/Homelab-Wizard-x86_64.AppImage"
	check("linux", "/tmp/.mount_Homela1/usr/bin/homelab-wizard", Installed{KindAppImage, env["APPIMAGE"]})
}

func TestAssetFor(t *testing.T) {
	var r Release
	for _, n := range []string{"Homelab-Wizard-macOS.dmg", "Homelab-Wizard-Windows-Setup.exe", "Homelab-Wizard-Windows-portable.zip", "Homelab-Wizard-Windows-ARM64-portable.zip",
		"Homelab-Wizard-x86_64.AppImage", "homelab-wizard_0.1.0-alpha_amd64.deb", "homelab-wizard-0.1.0-alpha-1.x86_64.rpm", "homelab-wizard-0.1.0-alpha-1-x86_64.pkg.tar.zst",
		"homelab-wizard-linux-amd64.tar.gz", "homelab-linux-amd64"} {
		r.Assets = append(r.Assets, Asset{Name: n, URL: "https://dl/" + n})
	}
	for _, c := range []struct{ kind, arch, want string }{
		{KindMac, "arm64", "Homelab-Wizard-macOS.dmg"},
		{KindWindows, "arm64", "Homelab-Wizard-Windows-Setup.exe"},
		{KindWindowsPortable, "amd64", "Homelab-Wizard-Windows-portable.zip"},
		{KindWindowsPortable, "arm64", "Homelab-Wizard-Windows-ARM64-portable.zip"},
		{KindAppImage, "amd64", "Homelab-Wizard-x86_64.AppImage"},
		{KindDeb, "amd64", "homelab-wizard_0.1.0-alpha_amd64.deb"},
		{KindRPM, "amd64", "homelab-wizard-0.1.0-alpha-1.x86_64.rpm"},
		{KindArch, "amd64", "homelab-wizard-0.1.0-alpha-1-x86_64.pkg.tar.zst"},
		{KindDeb, "arm64", ""},
		{"", "amd64", ""},
	} {
		a, ok := Installed{Kind: c.kind}.assetFor(r, c.arch)
		if a.Name != c.want || ok != (c.want != "") {
			t.Errorf("%s/%s: got %q (%v), want %q", c.kind, c.arch, a.Name, ok, c.want)
		}
	}
	if (Installed{Kind: KindAppImage}).AsksPermission() || !(Installed{Kind: KindDeb}).AsksPermission() || !(Installed{Kind: KindWindows}).AsksPermission() {
		t.Error("AsksPermission")
	}
}
