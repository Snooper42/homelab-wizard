package diskhealth

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func fake(outputs map[string]string) Runner {
	return func(_ context.Context, args ...string) ([]byte, error) {
		key := args[len(args)-1]
		if args[0] == "--scan" {
			key = "scan"
		}
		out, ok := outputs[key]
		if !ok {
			return nil, errors.New("exit status 2")
		}
		// smartctl exits non-zero for warnings too; output still counts.
		return []byte(out), errors.New("exit status 4")
	}
}

func TestCheck(t *testing.T) {
	run := fake(map[string]string{
		"scan": `{"devices":[{"name":"/dev/disk0","type":"nvme"},{"name":"/dev/disk4","type":"sat"},{"name":"/dev/disk5","type":"scsi"},{"name":"/dev/disk0","type":"nvme"}]}`,
		"/dev/disk0": `{"model_name":"APPLE SSD AP1024R","smart_status":{"passed":true},"temperature":{"current":38},"power_on_time":{"hours":1204},
			"nvme_smart_health_information_log":{"critical_warning":0,"percentage_used":3,"media_errors":0}}`,
		"/dev/disk4": `{"model_name":"WDC WD40EFRX","smart_status":{"passed":true},"ata_smart_attributes":{"table":[{"id":5,"raw":{"value":8}},{"id":9,"raw":{"value":30000}},{"id":197,"raw":{"value":0}}]}}`,
		"/dev/disk5": `{"smartctl":{"messages":[{"string":"Unknown USB bridge [0x1234:0x5678]","severity":"error"}]}}`,
	})
	disks, err := Check(context.Background(), run)
	if err != nil || len(disks) != 3 {
		t.Fatalf("disks %+v, %v", disks, err)
	}
	if d := disks[0]; !d.Readable || !d.Passed || d.Failing() || d.Describe() != "passed, 38°C, 1204 hours on" || d.Label() != "APPLE SSD AP1024R" {
		t.Errorf("internal: %+v %q", d, d.Describe())
	}
	if d := disks[1]; !d.Passed || len(d.Warnings) != 1 || !strings.Contains(d.Describe(), "8 reallocated sectors") {
		t.Errorf("hard drive: %+v", d)
	}
	if d := disks[2]; d.Readable || d.Failing() || !strings.Contains(d.Describe(), "Unknown USB bridge") {
		t.Errorf("usb: %+v %q", d, d.Describe())
	}
}

func TestFailing(t *testing.T) {
	run := fake(map[string]string{
		"scan":     `{"devices":[{"name":"/dev/sda","type":"sat"},{"name":"/dev/nvme0","type":"nvme"}]}`,
		"/dev/sda": `{"model_name":"Old Disk","smart_status":{"passed":false}}`,
		"/dev/nvme0": `{"model_name":"Worn SSD","smart_status":{"passed":true},
			"nvme_smart_health_information_log":{"critical_warning":4,"percentage_used":97,"media_errors":2}}`,
	})
	disks, _ := Check(context.Background(), run)
	if !disks[0].Failing() || !strings.Contains(disks[0].Describe(), "FAILING") {
		t.Errorf("failing: %+v", disks[0])
	}
	if d := disks[1]; !d.Failing() || len(d.Warnings) != 2 {
		t.Errorf("critical warning: %+v", d)
	}
}

func TestScanFails(t *testing.T) {
	if _, err := Check(context.Background(), fake(nil)); err == nil {
		t.Error("no scan output should be an error")
	}
}

func TestInstall(t *testing.T) {
	for _, c := range []struct {
		goos    string
		steamOS bool
		want    string
	}{
		{"darwin", false, "brew install smartmontools"},
		{"windows", false, "smartmontools.org"},
		{"linux", true, "SteamOS has no smartctl"},
		{"linux", false, "sudo apt install smartmontools"},
	} {
		if got := Install(c.goos, c.steamOS); !strings.Contains(got, c.want) {
			t.Errorf("%s (SteamOS %v): %q", c.goos, c.steamOS, got)
		}
	}
}

func TestLabel(t *testing.T) {
	if (Disk{Device: "/dev/sda", Model: "Samsung SSD 870"}).Label() != "Samsung SSD 870" || (Disk{Device: "/dev/sda"}).Label() != "/dev/sda" {
		t.Error("Label")
	}
}

// smartctl found on PATH, and run.
func TestSmartctlOnPath(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PATH", dir)
	t.Setenv("ProgramFiles", t.TempDir())
	if p, err := Smartctl(); err == nil && !strings.HasPrefix(p, "/") {
		t.Fatalf("found %q with nothing on PATH", p)
	} else if err != nil && !errors.Is(err, ErrNoSmartctl) {
		t.Fatal(err)
	}
	name := "smartctl"
	if runtime.GOOS == "windows" {
		name += ".bat"
	}
	stub := filepath.Join(dir, name)
	body := "#!/bin/sh\necho '{\"devices\":[]}'\n"
	if runtime.GOOS == "windows" {
		body = "@echo {\"devices\":[]}\r\n"
	}
	os.WriteFile(stub, []byte(body), 0o755)
	p, err := Smartctl()
	if err != nil || !strings.EqualFold(p, stub) {
		t.Fatalf("%q %v, want %q", p, err, stub)
	}
	run, err := Exec()
	if err != nil {
		t.Fatal(err)
	}
	out, err := run(context.Background(), "--scan", "-j")
	if err != nil || !strings.Contains(string(out), `"devices"`) {
		t.Fatalf("%q %v", out, err)
	}
}

// Windows' installer leaves smartctl out of PATH: it is found in Program
// Files.
func TestSmartctlInProgramFiles(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Program Files is Windows'; the Windows runner runs this")
	}
	pf := t.TempDir()
	t.Setenv("PATH", t.TempDir())
	t.Setenv("ProgramFiles", pf)
	want := filepath.Join(pf, "smartmontools", "bin", "smartctl.exe")
	os.MkdirAll(filepath.Dir(want), 0o755)
	os.WriteFile(want, nil, 0o755)
	if p, err := Smartctl(); err != nil || p != want {
		t.Fatalf("%q %v", p, err)
	}
}
