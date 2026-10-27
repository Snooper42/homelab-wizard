package selfupdate

import (
	"archive/zip"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
)

// The app's own update keeps what the person set up: the previous release's
// build replaced by this one, in a scratch folder, by the helper each
// system's update runs (the Mac's bundle swap, the AppImage's, the portable
// Windows build's), with the window's place and size, the phones the
// previous release paired (testdata/upgrades' newest folder), and the
// scheduled job that runs the CLI. After it, each reads back as before, and
// the job's program is there to run. On Linux the job runs a copy of the
// CLI in the homelab folder, which the update leaves as it was;
// core.JobsCLIBehind is how the app then notices and copies it again.
func TestAnUpdateKeepsTheWindowThePhonesAndTheJobs(t *testing.T) {
	if runtime.GOOS != "windows" {
		stubs(t, "pgrep", "pkill", "xattr", "open")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("APPDATA", filepath.Join(home, "AppData", "Roaming"))
	cfg, err := os.UserConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	// The window's place and size, as the app keeps them (app/window.go).
	window := filepath.Join(cfg, "Homelab Wizard", "window.json")
	keep(t, window, `{"x":120,"y":80,"width":1280,"height":860,"maximised":false}`)

	// The homelab folder, with the phones the newest release in
	// testdata/upgrades paired.
	root := t.TempDir()
	releases, _ := filepath.Glob(filepath.Join("..", "..", "testdata", "upgrades", "v*"))
	if len(releases) == 0 {
		t.Fatal("no release folders in testdata/upgrades")
	}
	slices.SortFunc(releases, func(a, b string) int { return slices.Compare(releaseNumbers(a), releaseNumbers(b)) })
	phones, err := os.ReadFile(filepath.Join(releases[len(releases)-1], "data", "phones.json"))
	if err != nil {
		t.Fatal(err)
	}
	keep(t, companion.StorePath(root), string(phones))
	before := companion.NewStore(companion.StorePath(root)).Devices()
	if len(before) == 0 {
		t.Fatal("the release's folder has no phones")
	}

	agent := schedule.Job{Label: "com.homelab.agent", Args: []string{"agent"}, RunAtLoad: true, KeepAlive: true}
	dir := t.TempDir()
	var job, program string // the job's definition, and what it runs
	switch runtime.GOOS {
	case "darwin":
		app, staged := filepath.Join(dir, "Homelab Wizard.app"), filepath.Join(dir, "update", "Homelab Wizard.app")
		cli := filepath.Join("Contents", "Library", "LoginItems", "Homelab Wizard Agent.app", "Contents", "MacOS", "homelab")
		for path, body := range map[string]string{app: "old", staged: "new"} {
			keep(t, filepath.Join(path, "Contents", "MacOS", "homelab-wizard"), body)
			keep(t, filepath.Join(path, cli), body)
		}
		program = filepath.Join(app, cli)
		job = filepath.Join(home, "Library", "LaunchAgents", agent.Label+".plist")
		keep(t, job, string(agent.Plist(program, root, filepath.Join(root, "scripts", "logs"), "/usr/bin:/bin")))
		c := exec.Command("/bin/sh", "-c", swapScript, "sh", gone(t), app, staged, "0")
		if out, err := c.CombinedOutput(); err != nil {
			t.Fatalf("%v: %s", err, out)
		}
		waitFor(t, "the new app", func() bool { return read(program) == "new" })
	case "linux":
		app, staged := filepath.Join(dir, "Homelab-Wizard-x86_64.AppImage"), filepath.Join(dir, "update", "new.AppImage")
		keep(t, app, "old")
		keep(t, staged, "new")
		// schedule install copied the CLI out of the AppImage, which goes
		// away when it closes.
		program = filepath.Join(root, "bin", "homelab")
		keep(t, program, "old cli")
		service, _ := agent.Units(program, root, filepath.Join(root, "scripts", "logs"), "/usr/bin:/bin")
		job = filepath.Join(home, ".config", "systemd", "user", agent.Unit()+".service")
		keep(t, job, string(service))
		if err := swapLinux(Installed{Kind: KindAppImage, Path: app}, gone(t), staged, "0"); err != nil {
			t.Fatal(err)
		}
		waitFor(t, "the new AppImage", func() bool { return read(app) == "new" })
		if read(program) != "old cli" {
			t.Errorf("the jobs' copy of the CLI changed: %q", read(program))
		}
	case "windows":
		app := filepath.Join(dir, "Homelab")
		for _, name := range []string{"homelab-wizard.exe", "homelab.exe", "homelab-run.exe"} {
			keep(t, filepath.Join(app, name), "old")
		}
		staged := filepath.Join(dir, "update", portable())
		os.MkdirAll(filepath.Dir(staged), 0o755)
		f, _ := os.Create(staged)
		z := zip.NewWriter(f)
		for _, name := range []string{"homelab-wizard.exe", "homelab.exe", "homelab-run.exe"} {
			w, _ := z.Create(name)
			w.Write([]byte("new"))
		}
		z.Close()
		f.Close()
		// The Run value the jobs are installed as names homelab-run.exe.
		program = filepath.Join(app, "homelab-run.exe")
		job = filepath.Join(dir, "run-value.txt")
		keep(t, job, `"`+program+`" agent`)
		if err := swapWindows(Installed{Kind: KindWindowsPortable, Path: app}, gone(t), staged, "0"); err != nil {
			t.Fatal(err)
		}
		waitFor(t, "the unpacked build", func() bool { return read(program) == "new" })
	default:
		t.Skipf("no update helper on %s", runtime.GOOS)
	}

	if got := read(window); got != `{"x":120,"y":80,"width":1280,"height":860,"maximised":false}` {
		t.Errorf("the window's place and size: %s", got)
	}
	after := companion.NewStore(companion.StorePath(root)).Devices()
	if !slices.EqualFunc(before, after, func(a, b companion.Device) bool {
		return a.ID == b.ID && a.Name == b.Name && a.TokenHash == b.TokenHash && a.CanChange == b.CanChange
	}) {
		t.Errorf("the phones: %+v, then %+v", before, after)
	}
	if read(job) == "" {
		t.Errorf("the job's definition %s is gone", job)
	}
	if fi, err := os.Stat(program); err != nil || fi.IsDir() {
		t.Errorf("the job's program %s: %v", program, err)
	}
}

// releaseNumbers is a release folder's version, as numbers: v0.9.56-beta is
// 0, 9, 56.
func releaseNumbers(dir string) []int {
	var v [3]int
	fmt.Sscanf(filepath.Base(dir), "v%d.%d.%d", &v[0], &v[1], &v[2])
	return v[:]
}

// keep writes a file, and the folders it is in.
func keep(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
}
