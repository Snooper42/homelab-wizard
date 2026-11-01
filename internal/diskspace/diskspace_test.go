package diskspace

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

const gb = 1 << 30

func TestThreshold(t *testing.T) {
	for _, c := range []struct{ total, want uint64 }{
		{100 * gb, 10 * gb},  // small disk: the 10 GB floor
		{500 * gb, 25 * gb},  // 5%
		{8000 * gb, 50 * gb}, // a large media drive: the 50 GB cap
	} {
		if got := Threshold(c.total); got != c.want {
			t.Errorf("Threshold(%d GB) = %d GB, want %d GB", c.total/gb, got/gb, c.want/gb)
		}
	}
	if !(Volume{Free: 9 * gb, Total: 100 * gb}).Low() || (Volume{Free: 30 * gb, Total: 500 * gb}).Low() {
		t.Error("Low disagrees with the threshold")
	}
}

func TestDescribe(t *testing.T) {
	v := Volume{Free: 412 * gb, Total: 994 * gb}
	if got := v.Describe(); got != "412 GB free of 994 GB (41%)" {
		t.Errorf("got %q", got)
	}
	if got := Size(8*gb + gb/2); got != "8.5 GB" {
		t.Errorf("small size: %q", got)
	}
	if got := Size(3 << 40); got != "3.0 TB" {
		t.Errorf("large size: %q", got)
	}
}

func TestCheck(t *testing.T) {
	dir := t.TempDir()
	vols := Check([]Location{
		{"homelab folder", dir},
		{"Syncthing", filepath.Join(dir, ".")}, // the same disk
		{"media", filepath.Join(dir, "not-plugged-in")},
		{"backups", ""},
	})
	if len(vols) != 1 {
		t.Fatalf("want one disk, got %+v", vols)
	}
	v := vols[0]
	if v.Label() != "homelab folder, Syncthing" || v.Total == 0 || v.Free > v.Total {
		t.Errorf("disk: %+v", v)
	}
	low := Lowest([]Volume{{Names: []string{"a"}, Free: 5}, {Names: []string{"b"}, Free: 1}})
	if low[0].Names[0] != "b" {
		t.Errorf("lowest first: %+v", low)
	}
}

func TestLocations(t *testing.T) {
	// Absolute paths on the system running the test (a drive on Windows).
	abs := func(p string) string {
		if runtime.GOOS == "windows" {
			return `C:` + filepath.FromSlash(p)
		}
		return p
	}
	locs := Locations(abs("/Users/you/Homelab"), abs("/Users/you"), map[string]string{
		"MEDIA_ROOT": abs("/Volumes/Media"), "BACKUP_DESTINATION": "./backups", "JELLYFIN_DATA_DIR": "~/.local/share/jellyfin", "DOWNLOADS_ROOT": "",
	})
	want := []Location{{"homelab folder", abs("/Users/you/Homelab")}, {"media", abs("/Volumes/Media")}, {"backups", abs("/Users/you/Homelab/backups")}, {"Jellyfin data", abs("/Users/you/.local/share/jellyfin")}}
	if len(locs) != len(want) {
		t.Fatalf("got %+v", locs)
	}
	for i := range want {
		if locs[i] != want[i] {
			t.Errorf("%d: got %+v, want %+v", i, locs[i], want[i])
		}
	}
}

func TestMissingDrive(t *testing.T) {
	if d := MissingDrive([]string{"/Users/you/homelab/data", "/Volumes/NoSuchDriveHere/Media:/media"}); d != "/Volumes/NoSuchDriveHere" {
		t.Errorf("got %q", d)
	}
	if d := MissingDrive([]string{"/Users/you/homelab/data"}); d != "" {
		t.Errorf("internal disk: got %q", d)
	}
}

func TestExternalDriveEverywhere(t *testing.T) {
	for _, c := range []struct{ path, want string }{
		{"/Volumes/Hobbies/photos", "/Volumes/Hobbies"},
		{"/Users/you/Homelab", ""},
		{"/media/you/Hobbies/photos", "/media/you/Hobbies"},
		{"/media/Hobbies/photos", "/media/Hobbies"},
		{"/run/media/deck/Hobbies/media", "/run/media/deck/Hobbies"},
		{"/mnt/hobbies/media", "/mnt/hobbies"},
		{"/mnt/c/Users", ""},
		{"/home/you/Homelab", ""},
		{`E:\Media`, `E:\`},
		{"e:/Media", `E:\`},
		{`C:\Users\you\Homelab`, ""},
	} {
		if got := externalDrive(c.path, "you", "C:"); got != c.want {
			t.Errorf("%s: got %q, want %q", c.path, got, c.want)
		}
	}
}

func TestMountedNeedsADriveOnLinux(t *testing.T) {
	dir := t.TempDir() // a plain folder: on Linux the same device as its parent
	if runtime.GOOS == "linux" && Mounted(dir) {
		t.Errorf("%s is a folder, not a mounted drive", dir)
	}
	if Mounted(filepath.Join(dir, "missing")) {
		t.Error("a missing drive reads as mounted")
	}
}

// DriveRoot is the top of a drive (the system's root, a drive letter, or a
// mount point), never a folder on one.
func TestDriveRoot(t *testing.T) {
	top := string(filepath.Separator)
	if v := filepath.VolumeName(t.TempDir()); v != "" {
		top = v + string(filepath.Separator)
	}
	if !DriveRoot(top) {
		t.Errorf("%s is the top of a drive", top)
	}
	dir := filepath.Join(t.TempDir(), "backups")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if DriveRoot(dir) {
		t.Errorf("%s is a folder on a drive", dir)
	}
}
