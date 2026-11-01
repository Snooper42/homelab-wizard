package main

import (
	"bufio"
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestUninstall(t *testing.T) {
	calls := fakeDocker(t, nil)
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home) // os.UserHomeDir on Windows
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(os.Getenv("HOME"), ".config"))
	root, _ := repoCopy(t)
	appdata := filepath.Join(root, "data", "appdata", "ntfy")
	if err := os.MkdirAll(appdata, 0o755); err != nil {
		t.Fatal(err)
	}
	if out, code := homelabCmd(t, root, "", "uninstall"); code == 0 && !strings.Contains(out, "Preview") {
		t.Fatalf("without --apply it only shows the plan (exit %d):\n%s", code, out)
	}
	out, code := homelabCmd(t, root, "", "uninstall", "--apply")
	log := readCalls(t, calls)
	if !strings.Contains(log, "down --remove-orphans --rmi all") || strings.Contains(log, "--volumes") || !strings.Contains(log, "network rm homelab") {
		t.Fatalf("exit %d:\n%s\n%s", code, out, log)
	}
	if _, err := os.Stat(appdata); err != nil {
		t.Error("the data went without --data")
	}
	if _, code = homelabCmd(t, root, "", "uninstall", "--data", "--apply"); !strings.Contains(readCalls(t, calls), "--volumes") {
		t.Errorf("--data keeps the volumes (exit %d)", code)
	}
	if _, err := os.Stat(appdata); !os.IsNotExist(err) {
		t.Error("--data left the data")
	}
	if _, err := os.Stat(filepath.Join(root, ".env")); err != nil {
		t.Error(".env went too")
	}
}

// What compose down cannot reach goes too (found on a PC taken off after
// the homelab moved to a Mac): the copies an update kept for its undo, the
// backup's helper, and a homelab project no compose file lists any more.
// Whatever is not the homelab's stays, and uninstall names it.
func TestUninstallLeftovers(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		// The fake's IDs follow the order: id0, id1, id2.
		{Name: "homelab_old-gone-1", Image: "example/gone:latest", Project: "homelab_old", Service: "gone"},
		{Name: "budget-tracker-prod-db-1", Image: "postgres:16", Running: true, Project: "budget-tracker-prod", Service: "db"},
		{Name: "beets", Image: "lscr.io/linuxserver/beets:latest"},
	})
	dir := filepath.Dir(calls)
	images := "homelab-rollback/grocy:previous\nhomelab/sqlite:1\npostgres:16\nlscr.io/linuxserver/beets:latest\nhomelab/nginx-proxy-manager-crowdsec:2.16.0\n"
	volumes := "homelab_old_db homelab_old\nbudget_db budget-tracker-prod\nloose \n"
	for name, data := range map[string]string{"images.txt": images, "volumes.txt": volumes} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(strings.ReplaceAll(data, `\n`, "\n")), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	root, _ := repoCopy(t)

	out, code := homelabCmd(t, root, "", "uninstall", "--apply")
	log := readCalls(t, calls)
	for _, want := range []string{"image rm homelab-rollback/grocy:previous", "image rm homelab/sqlite:1", "rm --force id0\n"} {
		if !strings.Contains(log, want) {
			t.Errorf("no %q (exit %d):\n%s\n%s", want, code, out, log)
		}
	}
	for _, never := range []string{"image rm postgres", "image rm lscr.io", "rm --force id1", "rm --force id2", "volume rm"} {
		if strings.Contains(log, never) {
			t.Errorf("%q, which is not the homelab's, or data without --data:\n%s", never, log)
		}
	}
	if !strings.Contains(out, "not the homelab's, so left as they are: beets, budget-tracker-prod") {
		t.Errorf("does not name what it left:\n%s", out)
	}

	homelabCmd(t, root, "", "uninstall", "--data", "--apply")
	log = readCalls(t, calls)
	if !strings.Contains(log, "volume rm homelab_old_db") || strings.Contains(log, "volume rm budget_db") || strings.Contains(log, "volume rm loose") {
		t.Errorf("--data removes only the homelab's volumes:\n%s", log)
	}
}

// With Docker Engine run as root, the apps' files belong to root, and the
// folder cannot be deleted as you (found by the nightly run): a container
// empties it first.
func TestUninstallDataOwnedByRoot(t *testing.T) {
	calls := fakeDocker(t, nil)
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	root, _ := repoCopy(t)
	data := filepath.Join(root, "data")
	if err := os.MkdirAll(filepath.Join(data, "appdata", "nginx-proxy-manager"), 0o755); err != nil {
		t.Fatal(err)
	}
	emptied := false
	saved := removeAll
	removeAll = func(p string) error {
		if p == data && !strings.Contains(readCalls(t, calls), "-v "+data+":/v alpine:3 sh -c rm -rf") {
			return &os.PathError{Op: "unlinkat", Path: p, Err: os.ErrPermission}
		}
		emptied = emptied || p == data
		return os.RemoveAll(p)
	}
	t.Cleanup(func() { removeAll = saved })
	out, code := homelabCmd(t, root, "", "uninstall", "--data", "--apply")
	if code != 0 || !emptied {
		t.Fatalf("exit %d, emptied %v:\n%s\n%s", code, emptied, out, readCalls(t, calls))
	}
	if _, err := os.Stat(data); !os.IsNotExist(err) {
		t.Error("the data folder is still there")
	}
}

// Each system's own way to remove the app, never the Mac's on the others.
func TestRemoveAppOnEachSystem(t *testing.T) {
	for _, tc := range []struct {
		p    host.Profile
		want string
	}{
		{host.For("darwin"), "Trash"},
		{host.For("windows"), "Installed apps"},
		{host.For("linux"), "homelab-wizard package"},
		{host.SteamOS(host.For("linux")), "AppImage"},
	} {
		if got := removeApp(tc.p); !strings.Contains(got, tc.want) {
			t.Errorf("%s: %q, want %q in it", tc.p.Name, got, tc.want)
		}
	}
	for goos, want := range map[string]string{"darwin": "open -e", "windows": "notepad", "linux": "text editor"} {
		if got := editEnv(goos); !strings.Contains(got, want) {
			t.Errorf("%s: %q, want %q in it", goos, got, want)
		}
	}
}

// uninstallHome gives the test a home folder of its own, as each system
// finds it, and a working folder that is put back after.
func uninstallHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("XDG_CACHE_HOME", filepath.Join(home, ".cache"))
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, ".local", "share"))
	t.Setenv("APPDATA", filepath.Join(home, "AppData", "Roaming"))
	t.Setenv("LOCALAPPDATA", filepath.Join(home, "AppData", "Local"))
	t.Chdir(t.TempDir())
	return home
}

func mkdirs(t *testing.T, dirs ...string) {
	t.Helper()
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(d, "duplicati-1.dblock.zip.aes"), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

// --folder deletes the whole homelab folder and --backups the backups on
// this machine; a backup folder in a cloud drive stays, as deleting it
// would delete it on every machine signed in to the drive (the PC and the
// Mac that shared a Proton Drive folder). With the data gone, the
// homelab's Tailscale signs out, so its device leaves the tailnet.
func TestUninstallFolderAndBackups(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_network-tailscale-1", Image: "tailscale/tailscale:latest", Running: true, Project: "homelab_network", Service: "tailscale"},
	})
	home := uninstallHome(t)
	local := filepath.Join(t.TempDir(), "Homelab Backups")
	cloud := filepath.Join(home, "Dropbox", "Homelab Kopia")
	mkdirs(t, local, cloud)
	root, media := repoCopy(t, "BACKUP_DESTINATION="+local, "KOPIA_REPOSITORY="+cloud)

	out, code := homelabCmd(t, root, "", "uninstall", "--folder", "--backups")
	if !strings.Contains(out, "DELETE the backups in "+local) || !strings.Contains(out, "keep "+cloud+": it is in Dropbox") || !strings.Contains(out, "DELETE the homelab folder") {
		t.Fatalf("the plan (exit %d):\n%s", code, out)
	}
	if _, err := os.Stat(root); err != nil {
		t.Fatal("the plan deleted the folder")
	}

	out, code = homelabCmd(t, root, "", "uninstall", "--folder", "--backups", "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	for _, gone := range []string{root, local} {
		if _, err := os.Stat(gone); !os.IsNotExist(err) {
			t.Errorf("%s is still there:\n%s", gone, out)
		}
	}
	for _, kept := range []string{cloud, media} {
		if _, err := os.Stat(kept); err != nil {
			t.Errorf("%s went: %v", kept, err)
		}
	}
	if log := readCalls(t, calls); !strings.Contains(log, "exec homelab_network-tailscale-1 tailscale logout") || !strings.Contains(log, "--volumes") {
		t.Errorf("no sign-out, or the volumes stayed:\n%s", log)
	}
	if !strings.Contains(out, "the backups in the cloud drive") {
		t.Errorf("does not say the cloud drive's backups are left:\n%s", out)
	}
}

// Without --data nothing of the tailnet changes: Start the homelab brings
// it all back, on the same device.
func TestUninstallKeepsTheTailnetWithTheData(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_network-tailscale-1", Image: "tailscale/tailscale:latest", Running: true, Project: "homelab_network", Service: "tailscale"},
	})
	uninstallHome(t)
	root, _ := repoCopy(t)
	if out, code := homelabCmd(t, root, "", "uninstall", "--apply"); code != 0 || strings.Contains(readCalls(t, calls), "logout") {
		t.Fatalf("exit %d:\n%s\n%s", code, out, readCalls(t, calls))
	}
}

// --folder deletes only a homelab folder, and never a home folder or a
// drive, whatever --root says.
func TestHomelabFolderSafe(t *testing.T) {
	home := uninstallHome(t)
	root, _ := repoCopy(t)
	if err := homelabFolderSafe(root); err != nil {
		t.Errorf("a homelab folder: %v", err)
	}
	for _, f := range []string{"compose.yaml", ".env.example"} {
		if err := os.WriteFile(filepath.Join(home, f), nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := homelabFolderSafe(home); err == nil {
		t.Error("the home folder could go")
	}
	if err := homelabFolderSafe(t.TempDir()); err == nil {
		t.Error("a folder that is not a homelab could go")
	}
	vol := filepath.VolumeName(home) + string(filepath.Separator)
	if err := homelabFolderSafe(vol); err == nil {
		t.Error("a drive could go")
	}
}

// --everything-else empties the container runtime: the containers that are
// not the homelab's, and every volume, image, and network, and the cache.
// In a terminal it is typed out first.
func TestUninstallEverythingElse(t *testing.T) {
	ctrs := []docker.FakeContainer{
		{Name: "budget-tracker-prod-db-1", Image: "postgres:16", Running: true, Project: "budget-tracker-prod", Service: "db"},
		{Name: "beets", Image: "lscr.io/linuxserver/beets:latest"},
	}
	calls := fakeDocker(t, ctrs)
	dir := filepath.Dir(calls)
	for name, data := range map[string]string{
		"images.txt":   "postgres:16\nlscr.io/linuxserver/beets:latest\n",
		"volumes.txt":  "budget-tracker-prod_db_data budget-tracker-prod\n278fff12b30b \n",
		"networks.txt": "bridge\nhost\nnone\nhomelab\nbudget-tracker\nnpm_net\n",
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(data), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	uninstallHome(t)
	root, _ := repoCopy(t)

	// Typed wrong in a terminal: nothing happens.
	u := &ui.UI{Out: &bytes.Buffer{}, In: bufio.NewReader(strings.NewReader("y\nyes\n")), Interactive: true}
	if code := run(context.Background(), u, []string{"--root", root, "uninstall", "--everything-else"}); code == 0 {
		t.Fatalf("went ahead without delete everything typed:\n%s", u.Out)
	}
	if log := readCalls(t, calls); strings.Contains(log, "compose") || strings.Contains(log, "rm --force") {
		t.Fatalf("changed something:\n%s", log)
	}

	out, code := homelabCmd(t, root, "", "uninstall", "--everything-else", "--apply")
	log := readCalls(t, calls)
	for _, want := range []string{"rm --force id0", "rm --force id1", "volume rm --force budget-tracker-prod_db_data", "volume rm --force 278fff12b30b",
		"image rm --force postgres:16", "image rm --force lscr.io/linuxserver/beets:latest", "network rm budget-tracker", "network rm npm_net", "builder prune --all --force"} {
		if !strings.Contains(log, want) {
			t.Errorf("no %q (exit %d):\n%s\n%s", want, code, out, log)
		}
	}
	for _, never := range []string{"network rm bridge", "network rm host", "network rm none"} {
		if strings.Contains(log, never) {
			t.Errorf("%q: the runtime's own networks", never)
		}
	}
}

// --app removes Homelab Wizard in each system's way, and its own folders.
func TestUninstallApp(t *testing.T) {
	saved, savedStart := installedApp, startDetached
	t.Cleanup(func() { installedApp, startDetached = saved, savedStart })
	var started []string
	startDetached = func(name string, args ...string) error {
		started = append(started, name+" "+strings.Join(args, " "))
		return nil
	}
	fakeDocker(t, nil)
	home := uninstallHome(t)
	root, _ := repoCopy(t)
	appFiles := appFolders(host.Current().OS)
	for _, f := range appFiles {
		mkdirs(t, f)
	}

	// An AppImage: the file goes.
	img := filepath.Join(home, "Applications", "Homelab-Wizard-x86_64.AppImage")
	mkdirs(t, filepath.Dir(img))
	if err := os.WriteFile(img, []byte("ELF"), 0o755); err != nil {
		t.Fatal(err)
	}
	installedApp = func() selfupdate.Installed { return selfupdate.Installed{Kind: selfupdate.KindAppImage, Path: img} }
	out, code := homelabCmd(t, root, "", "uninstall", "--app", "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	for _, gone := range append([]string{img}, appFiles...) {
		if _, err := os.Stat(gone); !os.IsNotExist(err) {
			t.Errorf("%s is still there", gone)
		}
	}
	if strings.Contains(out, "Homelab Wizard (") {
		t.Errorf("still lists the app as left:\n%s", out)
	}

	// The Windows installer: its uninstaller, once the app has quit.
	dir := filepath.Join(home, "Program Files", "Snooper42", "Homelab Wizard")
	installedApp = func() selfupdate.Installed { return selfupdate.Installed{Kind: selfupdate.KindWindows, Path: dir} }
	if out, code := homelabCmd(t, root, "", "uninstall", "--app", "--apply"); code != 0 || len(started) != 1 ||
		!strings.Contains(started[0], "Stop-Process -Force") || !strings.Contains(started[0], "Start-Process -FilePath '"+filepath.Join(dir, "uninstall.exe")+"' -ArgumentList '/S' -Verb RunAs") {
		t.Errorf("exit %d, started %q:\n%s", code, started, out)
	}

	// A Linux package: its command, which needs a password, is left to say.
	installedApp = func() selfupdate.Installed {
		return selfupdate.Installed{Kind: selfupdate.KindDeb, Path: "/usr/bin/homelab-wizard"}
	}
	if out, code := homelabCmd(t, root, "", "uninstall", "--app", "--apply"); code != 0 || !strings.Contains(out, "sudo apt remove homelab-wizard") {
		t.Errorf("exit %d:\n%s", code, out)
	}
}

// Each system says how to remove its own container runtime.
func TestRemoveRuntimeOnEachSystem(t *testing.T) {
	for _, tc := range []struct {
		p    host.Profile
		want string
	}{
		{host.For("darwin"), "~/.orbstack"},
		{host.For("windows"), "Installed apps > Docker Desktop"},
		{host.For("linux"), "docker-ce"},
		{host.SteamOS(host.For("linux")), "systemctl --user disable --now docker"},
	} {
		if got := removeRuntime(tc.p); !strings.Contains(got, tc.want) {
			t.Errorf("%s: %q, want %q in it", tc.p.Name, got, tc.want)
		}
	}
}
