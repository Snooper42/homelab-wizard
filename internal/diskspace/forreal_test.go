//go:build forreal

package diskspace

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
	"time"
)

// An external drive made for real on the machine this runs on, the way
// each system has one: a disk image on macOS (/Volumes/<name>), a loop
// device mounted under /mnt on Linux, a virtual disk with its own drive
// letter on Windows. It is found as a drive, its free space read, then
// taken away and seen missing, as an unplugged drive is. CI runs it on
// each system's runner (go test -tags forreal), where sudo asks no
// password and the runner is an administrator.
func TestExternalDriveForReal(t *testing.T) {
	drive, detach := attach(t)
	media := filepath.Join(drive, "media")
	if err := os.MkdirAll(media, 0o755); err != nil {
		t.Fatal(err)
	}
	if got := ExternalDrive(media); got != drive {
		t.Fatalf("ExternalDrive(%s) = %q, want %q", media, got, drive)
	}
	if !Mounted(drive) || MissingDrive([]string{media}) != "" {
		t.Fatalf("%s is attached but not mounted", drive)
	}
	home, _ := os.UserHomeDir()
	vols := Check([]Location{{Name: "homelab folder", Path: home}, {Name: "media", Path: media}})
	if len(vols) != 2 || vols[1].Path != media {
		t.Fatalf("not two disks: %+v", vols)
	}
	if v := vols[1]; v.Total < 16<<20 || v.Total > 128<<20 || v.Free == 0 || v.Free > v.Total {
		t.Fatalf("the drive's space: %d MB free of %d MB", v.Free>>20, v.Total>>20)
	}
	t.Logf("%s: %d MB free of %d MB", drive, vols[1].Free>>20, vols[1].Total>>20)

	detach()
	for end := time.Now().Add(15 * time.Second); Mounted(drive); time.Sleep(500 * time.Millisecond) {
		if time.Now().After(end) {
			t.Fatalf("%s is still mounted after it was taken away", drive)
		}
	}
	if got := MissingDrive([]string{media}); got != drive {
		t.Fatalf("MissingDrive = %q, want %q", got, drive)
	}
	if vols := Check([]Location{{Name: "homelab folder", Path: home}, {Name: "media", Path: media}}); len(vols) != 1 {
		t.Fatalf("the missing drive is still read: %+v", vols)
	}
}

// attach makes a 32 MB drive and returns where it is mounted, and how to
// take it away again (also done when the test ends).
func attach(t *testing.T) (drive string, detach func()) {
	t.Helper()
	dir := t.TempDir()
	run := func(name string, args ...string) string {
		t.Helper()
		out, err := exec.Command(name, args...).CombinedOutput()
		if err != nil {
			t.Fatalf("%s %s: %v\n%s", name, strings.Join(args, " "), err, out)
		}
		return string(out)
	}
	asRoot := func(args ...string) string {
		t.Helper()
		if os.Geteuid() == 0 {
			return run(args[0], args[1:]...)
		}
		return run("sudo", append([]string{"-n"}, args...)...)
	}
	var once bool
	done := func(f func()) func() {
		return func() {
			if !once {
				once = true
				f()
			}
		}
	}
	switch runtime.GOOS {
	case "darwin":
		img := filepath.Join(dir, "HomelabCI.dmg")
		run("hdiutil", "create", "-size", "32m", "-fs", "HFS+", "-volname", "HomelabCI", img)
		out := run("hdiutil", "attach", "-nobrowse", img)
		m := regexp.MustCompile(`(/Volumes/HomelabCI[^\n]*?)\s*$`).FindStringSubmatch(strings.TrimSpace(out))
		if m == nil {
			t.Fatalf("hdiutil attach mounted it nowhere:\n%s", out)
		}
		drive = strings.TrimSpace(m[1])
		detach = done(func() { run("hdiutil", "detach", drive) })
	case "linux":
		img := filepath.Join(dir, "homelab-ci.img")
		run("truncate", "-s", "32M", img)
		run("mkfs.ext4", "-q", "-F", img)
		drive = "/mnt/homelab-ci"
		asRoot("mkdir", "-p", drive)
		asRoot("mount", "-o", "loop", img, drive)
		asRoot("chown", fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid()), drive)
		detach = done(func() { asRoot("umount", drive) })
		t.Cleanup(func() { _ = exec.Command("sudo", "-n", "rmdir", drive).Run(); _ = os.Remove(drive) })
	case "windows":
		letter := ""
		for c := 'Z'; c >= 'G'; c-- {
			if _, err := os.Stat(string(c) + `:\`); err != nil {
				letter = string(c)
				break
			}
		}
		if letter == "" {
			t.Fatal("no drive letter free")
		}
		vhd := filepath.Join(dir, "homelab-ci.vhdx")
		diskpart := func(lines ...string) {
			t.Helper()
			script := filepath.Join(dir, "diskpart.txt")
			if err := os.WriteFile(script, []byte(strings.Join(lines, "\r\n")+"\r\n"), 0o644); err != nil {
				t.Fatal(err)
			}
			run("diskpart", "/s", script)
		}
		diskpart(`create vdisk file="`+vhd+`" maximum=32 type=expandable`, `select vdisk file="`+vhd+`"`, "attach vdisk",
			"create partition primary", "format fs=ntfs quick label=HomelabCI", "assign letter="+letter)
		drive = letter + `:\`
		for end := time.Now().Add(30 * time.Second); ; time.Sleep(500 * time.Millisecond) {
			if _, err := os.Stat(drive); err == nil {
				break
			}
			if time.Now().After(end) {
				t.Fatalf("%s did not appear", drive)
			}
		}
		detach = done(func() { diskpart(`select vdisk file="`+vhd+`"`, "detach vdisk") })
	default:
		t.Fatalf("no external drive to make on %s", runtime.GOOS)
	}
	t.Cleanup(detach)
	return drive, detach
}
