package selfupdate

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

// serve serves files at /dl/<name> and returns a release that lists
// them with their checksums; sums replaces a file's checksum.
func serve(t *testing.T, files map[string][]byte, sums map[string]string) Release {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, ok := files[strings.TrimPrefix(r.URL.Path, "/dl/")]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Write(body)
	}))
	t.Cleanup(srv.Close)
	var rel Release
	for name, body := range files {
		sum := sha256.Sum256(body)
		a := Asset{Name: name, URL: srv.URL + "/dl/" + name, SHA256: hex.EncodeToString(sum[:])}
		if s, ok := sums[name]; ok {
			a.SHA256 = s
		}
		rel.Assets = append(rel.Assets, a)
	}
	return rel
}

func installedAs(t *testing.T, in Installed) {
	t.Helper()
	old := Current
	Current = func() Installed { return in }
	t.Cleanup(func() { Current = old })
}

// catch replaces start, so a test sees the helper's command without running it.
func catch(t *testing.T) *[]*exec.Cmd {
	t.Helper()
	var got []*exec.Cmd
	old := StartHelper
	StartHelper = func(c *exec.Cmd) error { got = append(got, c); return nil }
	t.Cleanup(func() { StartHelper = old })
	return &got
}

// gone is the process ID of a program that has already quit, for a helper
// that waits for the app to quit.
func gone(t *testing.T) string {
	t.Helper()
	c := exec.Command(os.Args[0], "-test.run=^$")
	if err := c.Run(); err != nil {
		t.Fatal(err)
	}
	return strconv.Itoa(c.ProcessState.Pid())
}

func waitFor(t *testing.T, what string, ok func() bool) {
	t.Helper()
	for end := time.Now().Add(60 * time.Second); time.Now().Before(end); time.Sleep(100 * time.Millisecond) {
		if ok() {
			return
		}
	}
	t.Fatalf("timed out waiting for %s", what)
}

func read(path string) string {
	b, _ := os.ReadFile(path)
	return string(b)
}

// The portable Windows build has a download for both kinds of processor,
// so these tests mean the same on every runner.
func portable() string {
	if runtime.GOARCH == "arm64" {
		return "Homelab-Wizard-Windows-ARM64-portable.zip"
	}
	return "Homelab-Wizard-Windows-portable.zip"
}

func TestStage(t *testing.T) {
	ctx := context.Background()
	rel := serve(t, map[string][]byte{portable(): []byte("the new build")}, nil)
	dir := filepath.Join(t.TempDir(), "update")

	installedAs(t, Installed{})
	if CanInstall(rel) {
		t.Error("a copy that cannot replace itself was offered the install")
	}
	if _, err := Stage(ctx, rel, dir); err == nil || !strings.Contains(err.Error(), "cannot replace itself") {
		t.Fatalf("a local build: %v", err)
	}

	installedAs(t, Installed{Kind: KindWindowsPortable, Path: `D:\Apps\Homelab`})
	if !CanInstall(rel) {
		t.Fatal("the portable build was not offered")
	}
	if _, err := Stage(ctx, Release{}, dir); err == nil || !strings.Contains(err.Error(), "no download for this system") {
		t.Fatalf("a release without this system's build: %v", err)
	}
	os.MkdirAll(dir, 0o755)
	os.WriteFile(filepath.Join(dir, "left over"), []byte("x"), 0o644)
	file, err := Stage(ctx, rel, dir)
	if err != nil {
		t.Fatal(err)
	}
	if file != filepath.Join(dir, portable()) || read(file) != "the new build" {
		t.Fatalf("staged %s: %q", file, read(file))
	}
	if _, err := os.Stat(filepath.Join(dir, "left over")); err == nil {
		t.Error("the folder was not emptied first")
	}

	bad := serve(t, map[string][]byte{portable(): []byte("tampered")}, map[string]string{portable(): strings.Repeat("0", 64)})
	if _, err := Stage(ctx, bad, dir); err == nil || !strings.Contains(err.Error(), "checksum") {
		t.Fatalf("a download that does not match: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, portable())); err == nil {
		t.Error("a download that does not match was kept")
	}

	missing := rel
	missing.Assets = []Asset{{Name: portable(), URL: rel.Assets[0].URL + "-gone", SHA256: "00"}}
	if _, err := Stage(ctx, missing, dir); err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("a download that is gone: %v", err)
	}
}

func TestInstall(t *testing.T) {
	cache := t.TempDir()
	t.Setenv("XDG_CACHE_HOME", cache)
	t.Setenv("HOME", cache)
	t.Setenv("LocalAppData", cache)
	if !strings.HasPrefix(StageDir(), cache) || filepath.Base(StageDir()) != "update" {
		t.Fatalf("stage folder %s, outside the cache %s", StageDir(), cache)
	}
	rel := serve(t, map[string][]byte{portable(): []byte("zip")}, nil)
	installedAs(t, Installed{Kind: KindWindowsPortable, Path: `D:\Apps\Homelab`})
	got := catch(t)
	if err := Install(context.Background(), rel); err != nil {
		t.Fatal(err)
	}
	if len(*got) != 1 {
		t.Fatalf("started %d helpers", len(*got))
	}
	args := (*got)[0].Args
	staged := filepath.Join(StageDir(), portable())
	for _, want := range []string{"powershell.exe", "-AppPid", "-Staged", staged, "windows-portable", "-Reopen"} {
		if !slices.Contains(args, want) {
			t.Errorf("helper %q has no %q", args, want)
		}
	}
	if read(staged) != "zip" || !strings.Contains(read(filepath.Join(StageDir(), "swap.ps1")), "Expand-Archive") {
		t.Error("the download or the helper's script is not beside it")
	}
}

func TestSwap(t *testing.T) {
	got := catch(t)
	dir := t.TempDir()
	staged := filepath.Join(dir, "new")

	installedAs(t, Installed{})
	if err := Swap(staged, true); err == nil {
		t.Error("a copy that cannot replace itself started a helper")
	}

	installedAs(t, Installed{Kind: KindMac, Path: "/Applications/Homelab Wizard.app"})
	if err := Swap(staged, true); err != nil {
		t.Fatal(err)
	}
	installedAs(t, Installed{Kind: KindAppImage, Path: "/home/deck/Applications/Homelab-Wizard-x86_64.AppImage"})
	if err := Swap(staged, false); err != nil {
		t.Fatal(err)
	}
	if len(*got) != 2 {
		t.Fatalf("started %d helpers", len(*got))
	}
	mac, linux := (*got)[0].Args, (*got)[1].Args
	if mac[2] != swapScript || !slices.Equal(mac[5:], []string{"/Applications/Homelab Wizard.app", staged, "1"}) {
		t.Errorf("the Mac helper: %q", mac[3:])
	}
	if linux[2] != swapLinuxScript || !slices.Equal(linux[5:], []string{"/home/deck/Applications/Homelab-Wizard-x86_64.AppImage", staged, "0", ""}) {
		t.Errorf("the AppImage helper: %q", linux[3:])
	}

	// A package goes in through pkexec, which asks for the password; without
	// it, the app says what to do instead.
	t.Setenv("PATH", dir)
	installedAs(t, Installed{Kind: KindDeb, Path: packageProgram})
	if err := Swap(staged, true); err == nil || !strings.Contains(err.Error(), "pkexec") {
		t.Fatalf("no pkexec: %v", err)
	}
	pkexec := filepath.Join(dir, "pkexec")
	if runtime.GOOS == "windows" {
		pkexec += ".exe"
	}
	os.WriteFile(pkexec, nil, 0o755)
	for kind, want := range map[string]string{KindDeb: "apt-get install", KindRPM: "rpm -U", KindArch: "pacman -U"} {
		*got = nil
		installedAs(t, Installed{Kind: kind, Path: packageProgram})
		if err := Swap(staged, true); err != nil {
			t.Fatal(err)
		}
		if args := (*got)[0].Args; !strings.HasPrefix(args[len(args)-1], want) {
			t.Errorf("%s installs with %q", kind, args[len(args)-1])
		}
	}
}

// stubs puts programs first on PATH that stand in for the ones a helper
// must not run for real in a test: stopping a running tray item, opening
// an app.
func stubs(t *testing.T, names ...string) {
	t.Helper()
	dir := t.TempDir()
	for _, n := range names {
		if err := os.WriteFile(filepath.Join(dir, n), []byte("#!/bin/sh\nexit 1\n"), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
}

// The helpers themselves, run for real where they run: the AppImage one
// and the Mac one under sh, the portable Windows one under PowerShell.
func TestSwapLinuxScriptPutsTheAppImageInPlace(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the Linux helper is a shell script; TestSwapWindowsScriptUnpacksThePortableBuild runs Windows's")
	}
	stubs(t, "pgrep", "pkill")
	dir := t.TempDir()
	app, staged := filepath.Join(dir, "Homelab-Wizard-x86_64.AppImage"), filepath.Join(dir, "update", "new.AppImage")
	os.WriteFile(app, []byte("old"), 0o755)
	os.MkdirAll(filepath.Dir(staged), 0o755)
	os.WriteFile(staged, []byte("new"), 0o644)
	if err := swapLinux(Installed{Kind: KindAppImage, Path: app}, gone(t), staged, "0"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "the new AppImage", func() bool {
		_, err := os.Stat(staged)
		return read(app) == "new" && os.IsNotExist(err)
	})
	if fi, _ := os.Stat(app); fi.Mode()&0o100 == 0 {
		t.Errorf("the new AppImage cannot be run: %v", fi.Mode())
	}
	if _, err := os.Stat(app + ".new"); err == nil {
		t.Error("left the copy behind")
	}
}

func TestSwapScriptPutsTheMacAppInPlace(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the Mac helper is a shell script")
	}
	stubs(t, "pgrep", "pkill", "xattr", "open")
	dir := t.TempDir()
	app, staged := filepath.Join(dir, "Homelab Wizard.app"), filepath.Join(dir, "update", "Homelab Wizard.app")
	for path, body := range map[string]string{app: "old", staged: "new"} {
		os.MkdirAll(filepath.Join(path, "Contents", "MacOS"), 0o755)
		os.WriteFile(filepath.Join(path, "Contents", "MacOS", "homelab-wizard"), []byte(body), 0o755)
	}
	c := exec.Command("/bin/sh", "-c", swapScript, "sh", gone(t), app, staged, "0")
	if out, err := c.CombinedOutput(); err != nil {
		t.Fatalf("%v: %s", err, out)
	}
	if got := read(filepath.Join(app, "Contents", "MacOS", "homelab-wizard")); got != "new" {
		t.Fatalf("the app holds %q", got)
	}
	for _, p := range []string{app + ".old", staged} {
		if _, err := os.Stat(p); err == nil {
			t.Errorf("left %s behind", p)
		}
	}
}

func TestSwapWindowsScriptUnpacksThePortableBuild(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("the Windows helper runs in PowerShell; the Windows runner runs this")
	}
	dir := t.TempDir()
	app := filepath.Join(dir, "Homelab")
	os.MkdirAll(app, 0o755)
	os.WriteFile(filepath.Join(app, "homelab-wizard.exe"), []byte("old"), 0o644)
	staged := filepath.Join(dir, "update", portable())
	os.MkdirAll(filepath.Dir(staged), 0o755)
	f, _ := os.Create(staged)
	z := zip.NewWriter(f)
	for name, body := range map[string]string{"homelab-wizard.exe": "new", "homelab.exe": "new cli"} {
		w, _ := z.Create(name)
		w.Write([]byte(body))
	}
	z.Close()
	f.Close()
	if err := swapWindows(Installed{Kind: KindWindowsPortable, Path: app}, gone(t), staged, "0"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "the unpacked build", func() bool {
		_, err := os.Stat(staged)
		return read(filepath.Join(app, "homelab-wizard.exe")) == "new" && read(filepath.Join(app, "homelab.exe")) == "new cli" && os.IsNotExist(err)
	})
}

// A Mac build comes as a disk image; its app is copied out of it. Off the
// Mac there is no hdiutil to open one, which the error says.
func TestStageMac(t *testing.T) {
	src := t.TempDir()
	exe := filepath.Join(src, "Homelab Wizard.app", "Contents", "MacOS", "homelab-wizard")
	os.MkdirAll(filepath.Dir(exe), 0o755)
	os.WriteFile(exe, []byte("new"), 0o755)
	dmg := []byte("not a disk image")
	if runtime.GOOS == "darwin" {
		out := filepath.Join(t.TempDir(), MacAsset)
		var err error
		// GitHub's Mac runners sometimes answer "Resource busy" at first.
		for range 3 {
			var b []byte
			if b, err = exec.Command("hdiutil", "create", "-quiet", "-volname", "Homelab Wizard", "-srcfolder", src, "-format", "UDZO", out).CombinedOutput(); err == nil {
				break
			}
			t.Logf("hdiutil create: %v %s", err, b)
			time.Sleep(2 * time.Second)
		}
		if err != nil {
			t.Fatal(err)
		}
		dmg, _ = os.ReadFile(out)
	}
	rel := serve(t, map[string][]byte{MacAsset: dmg}, nil)
	installedAs(t, Installed{Kind: KindMac, Path: "/Applications/Homelab Wizard.app"})
	dir := filepath.Join(t.TempDir(), "update")
	staged, err := Stage(context.Background(), rel, dir)
	if runtime.GOOS != "darwin" {
		if err == nil || !strings.Contains(err.Error(), "opening the download") {
			t.Fatalf("no hdiutil: %v", err)
		}
		return
	}
	if err != nil {
		t.Fatal(err)
	}
	if staged != filepath.Join(dir, "Homelab Wizard.app") || read(filepath.Join(staged, "Contents", "MacOS", "homelab-wizard")) != "new" {
		t.Fatalf("staged %s", staged)
	}
	if _, err := os.Stat(filepath.Join(dir, MacAsset)); err == nil {
		t.Error("the disk image was kept")
	}
}

func TestNoRelease(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/o/notes/releases":
			w.Write([]byte(`[{"tag_name":"v0.9.0","assets":[]}]`))
		case "/repos/o/down/releases", "/repos/o/down/releases/latest":
			http.Error(w, "busy", http.StatusServiceUnavailable)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	API = srv.URL
	ctx := context.Background()
	for _, c := range []struct{ repo, channel, want string }{
		{"", "stable", "no repository"},
		{"", "nightly", "no repository"},
		{"o/notes", "stable", "no release has been published"},
		{"o/notes", "nightly", "no app build has been published"},
		{"o/down", "stable", "503"},
		{"o/down", "nightly", "503"},
	} {
		if _, err := For(ctx, c.repo, c.channel); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%s on %s: %v, want %q", c.repo, c.channel, err, c.want)
		}
	}
}

// full is a file on a disk that fills after a few bytes.
type full struct{ n int }

func (f *full) Write(p []byte) (int, error) {
	if f.n+len(p) > 4 {
		return 0, errors.New("no space left on device")
	}
	f.n += len(p)
	return len(p), nil
}

func (f *full) Close() error { return nil }

// The roadmap's four cases: only a good download is staged to replace the
// app; a bad checksum, a download cut off, and a full disk leave nothing
// behind, so the app carries on as it is.
func TestTheFourCases(t *testing.T) {
	body := []byte("the new build, all of it")
	sum := sha256.Sum256(body)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/cut":
			w.Header().Set("Content-Length", strconv.Itoa(len(body)))
			w.Write(body[:5])
			if h, ok := w.(http.Hijacker); ok {
				c, _, _ := h.Hijack()
				c.Close()
			}
		case "/bad":
			w.Write([]byte("someone else's build"))
		default:
			w.Write(body)
		}
	}))
	defer srv.Close()
	installedAs(t, Installed{Kind: KindWindowsPortable, Path: `D:\Apps\Homelab`})
	rel := func(path string) Release {
		return Release{Assets: []Asset{{Name: portable(), URL: srv.URL + path, SHA256: hex.EncodeToString(sum[:])}}}
	}
	for _, c := range []struct {
		name, path, want string
		full             bool
	}{
		{"a good download", "/good", "", false},
		{"a bad checksum", "/bad", "checksum", false},
		{"a download cut off", "/cut", "unexpected EOF", false},
		{"a full disk", "/good", "no space left", true},
	} {
		t.Run(c.name, func(t *testing.T) {
			if c.full {
				old := create
				create = func(string) (io.WriteCloser, error) { return &full{}, nil }
				t.Cleanup(func() { create = old })
			}
			dir := filepath.Join(t.TempDir(), "update")
			staged, err := Stage(context.Background(), rel(c.path), dir)
			left, _ := os.ReadDir(dir)
			if c.want == "" {
				if err != nil || read(staged) != string(body) || len(left) != 1 {
					t.Fatalf("staged %q %v, folder %v", staged, err, left)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("got %v, want %q", err, c.want)
			}
			if len(left) != 0 {
				t.Fatalf("left %v behind to put in place", left)
			}
		})
	}
}
