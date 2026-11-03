package media

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A Probe whose files are the given paths, and whose PATH has the given programs.
func calibreProbe(goos string, files []string, path ...string) Probe {
	has := map[string]bool{}
	for _, f := range files {
		has[f] = true
	}
	return Probe{GOOS: goos,
		LookPath: func(s string) (string, error) {
			for _, p := range path {
				if p == s {
					return "/usr/bin/" + s, nil
				}
			}
			return "", errors.New("not found")
		},
		Stat: func(s string) (os.FileInfo, error) {
			if has[s] {
				return nil, nil
			}
			return nil, os.ErrNotExist
		}}
}

func TestCalibreDir(t *testing.T) {
	home := t.TempDir()
	for _, c := range []struct {
		name  string
		p     Probe
		env   map[string]string
		dir   string
		found bool
	}{
		{"on PATH", calibreProbe("linux", nil, "calibredb"), nil, "", true},
		{"the setting", calibreProbe("linux", []string{filepath.Join("/srv/cal", "calibredb")}), map[string]string{"CALIBRE_BIN_DIR": "/srv/cal"}, "/srv/cal", true},
		{"the setting, wrong", calibreProbe("linux", nil, "calibredb"), map[string]string{"CALIBRE_BIN_DIR": "/srv/cal"}, "/srv/cal", false},
		{"Calibre's installer, in home on SteamOS", calibreProbe("linux", []string{filepath.Join(home, "calibre-bin", "calibre", "calibredb")}), nil, filepath.Join(home, "calibre-bin", "calibre"), true},
		{"the Mac app", calibreProbe("darwin", []string{filepath.Join("/Applications/calibre.app/Contents/MacOS", "calibredb")}), nil, "/Applications/calibre.app/Contents/MacOS", true},
		{"Windows", calibreProbe("windows", []string{filepath.Join(`C:\Program Files\Calibre2`, "calibredb.exe")}), nil, `C:\Program Files\Calibre2`, true},
		{"nowhere", calibreProbe("linux", nil, "flatpak"), nil, "", false},
		{"a Flatpak without flatpak", calibreProbe("linux", []string{filepath.Join("/var", "lib", "flatpak", "app", "com.calibre_ebook.calibre")}), nil, "", false},
	} {
		dir, found := CalibreDir(c.p, c.env, home)
		if dir != c.dir || found != c.found {
			t.Errorf("%s: got %q, %v; want %q, %v", c.name, dir, found, c.dir, c.found)
		}
	}
}

// Calibre from Flathub (SteamOS's Discover): a script for each tool, run through flatpak.
func TestCalibreDirFlatpak(t *testing.T) {
	home := t.TempDir()
	p := calibreProbe("linux", []string{filepath.Join("/var", "lib", "flatpak", "app", "com.calibre_ebook.calibre")}, "flatpak")
	dir, found := CalibreDir(p, nil, home)
	if !found || dir != filepath.Join(home, ".homelab-media", "calibre-flatpak") {
		t.Fatalf("got %q, %v", dir, found)
	}
	for _, tool := range calibreTools {
		b, err := os.ReadFile(filepath.Join(dir, tool))
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(b), "exec flatpak run --command="+tool+" com.calibre_ebook.calibre \"$@\"") {
			t.Errorf("%s: %s", tool, b)
		}
		if st, _ := os.Stat(filepath.Join(dir, tool)); st.Mode()&0o100 == 0 && os.PathSeparator == '/' {
			t.Errorf("%s can't be run: %v", tool, st.Mode())
		}
	}
	// Asked again, the same answer.
	if again, _ := CalibreDir(p, nil, home); again != dir {
		t.Errorf("again: %q", again)
	}
}
