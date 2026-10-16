package diskspace

import (
	"path/filepath"
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
	locs := Locations("/Users/you/Homelab", "/Users/you", map[string]string{
		"MEDIA_ROOT": "/Volumes/Media", "BACKUP_DESTINATION": "./backups", "JELLYFIN_DATA_DIR": "~/.local/share/jellyfin", "DOWNLOADS_ROOT": "",
	})
	want := []Location{{"homelab folder", "/Users/you/Homelab"}, {"media", "/Volumes/Media"}, {"backups", "/Users/you/Homelab/backups"}, {"Jellyfin data", "/Users/you/.local/share/jellyfin"}}
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
