package media

import (
	"os"
	"path/filepath"
)

// calibreFlatpak is Calibre's Flatpak, as SteamOS's Discover and Flathub
// install it.
const calibreFlatpak = "com.calibre_ebook.calibre"

// calibreTools are the Calibre programs the books engine runs.
var calibreTools = []string{"calibredb", "fetch-ebook-metadata", "ebook-meta"}

// CalibreDir is the folder Calibre's tools are in, for the books engine
// (its calibre_bin_dir), and whether they are anywhere: CALIBRE_BIN_DIR;
// "" when they are on PATH; Calibre's own places (the Mac app, Program
// Files, /opt/calibre, or a home folder, where its installer puts it on a
// system whose / is read-only, as SteamOS's is). A Flatpak's tools can't be
// run as files, so for one, small scripts that run each through flatpak are
// made in ~/.homelab-media/calibre-flatpak and that folder is the answer.
func CalibreDir(p Probe, env map[string]string, home string) (string, bool) {
	exe := func(dir string) string {
		if p.GOOS == "windows" {
			return filepath.Join(dir, "calibredb.exe")
		}
		return filepath.Join(dir, "calibredb")
	}
	if v := env["CALIBRE_BIN_DIR"]; v != "" {
		dir := expand(v, home)
		_, err := p.Stat(exe(dir))
		return dir, err == nil
	}
	if _, err := p.LookPath("calibredb"); err == nil {
		return "", true
	}
	places := map[string][]string{
		"darwin":  {"/Applications/calibre.app/Contents/MacOS", filepath.Join(home, "Applications", "calibre.app", "Contents", "MacOS")},
		"windows": {`C:\Program Files\Calibre2`, `C:\Program Files (x86)\Calibre2`},
	}[p.GOOS]
	if p.GOOS == "linux" {
		places = []string{"/opt/calibre", filepath.Join(home, "calibre-bin", "calibre"), filepath.Join(home, "calibre-bin"), filepath.Join(home, "calibre"), filepath.Join(home, ".local", "calibre")}
	}
	for _, dir := range places {
		if _, err := p.Stat(exe(dir)); err == nil {
			return dir, true
		}
	}
	if p.GOOS != "linux" {
		return "", false
	}
	if _, err := p.LookPath("flatpak"); err != nil {
		return "", false
	}
	for _, at := range []string{filepath.Join(home, ".local", "share", "flatpak", "app", calibreFlatpak), filepath.Join("/var", "lib", "flatpak", "app", calibreFlatpak)} {
		if _, err := p.Stat(at); err != nil {
			continue
		}
		dir := filepath.Join(home, ".homelab-media", "calibre-flatpak")
		if err := flatpakTools(dir); err != nil {
			return "", false
		}
		return dir, true
	}
	return "", false
}

// flatpakTools writes one script for each Calibre tool, running it in the
// Flatpak with what it was given.
func flatpakTools(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	for _, t := range calibreTools {
		body := "#!/bin/sh\n# Made by Homelab Wizard: Calibre's " + t + ", from its Flatpak.\nexec flatpak run --command=" + t + " " + calibreFlatpak + " \"$@\"\n"
		path := filepath.Join(dir, t)
		if old, err := os.ReadFile(path); err == nil && string(old) == body {
			continue
		}
		if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
			return err
		}
	}
	return nil
}
