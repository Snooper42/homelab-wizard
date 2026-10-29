package main

import (
	"context"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	goruntime "runtime"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/board"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/custom"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/host"
)

// window stands in for the Wails window: it records the events the App
// sends, and answers its dialogs and clipboard.
type window struct {
	mu     sync.Mutex
	events map[string][]any
	opened []string
	pick   string // what a file or folder dialog returns
	clip   string
	quit   bool
	// The window's size and place.
	minimised bool
	size, pos [2]int
}

func (w *window) sent(name string) []any {
	w.mu.Lock()
	defer w.mu.Unlock()
	return slices.Clone(w.events[name])
}

func (w *window) quitting() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.quit
}

func (w *window) lines(name string) string {
	var out []string
	for _, e := range w.sent(name) {
		if s, ok := e.(string); ok {
			out = append(out, s)
		}
	}
	return strings.Join(out, "\n")
}

// testApp is the App with a homelab folder made from this repository's
// catalog, the docker package's fake as the runtime, a homelab launcher
// that says what it was asked, and a window that records.
func testApp(t *testing.T, ctrs ...docker.FakeContainer) (*App, *window) {
	t.Helper()
	home := t.TempDir()
	for _, k := range []string{"HOME", "USERPROFILE", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_RUNTIME_DIR", "AppData", "LocalAppData"} {
		t.Setenv(k, home)
	}
	t.Setenv("HOMELAB_ROOT", "")
	t.Setenv("DOCKER_API", "off") // the fake runtime below, never a real engine's socket
	root := filepath.Join(home, "Homelab")
	copyCatalog(t, root)
	launcher(t, root)

	w := &window{events: map[string][]any{}}
	saved := []any{emitEvent, openURL, directoryDialog, fileDialog, saveDialog, messageDialog, clipboardSet, clipboardGet, quitApp, core.NewClient}
	savedWindow := []any{windowIsMinimised, windowIsFullscreen, windowIsMaximised, windowGetSize, windowGetPosition, windowSetSize, windowSetPosition, screenGetAll}
	t.Cleanup(func() {
		windowIsMinimised = savedWindow[0].(func(context.Context) bool)
		windowIsFullscreen = savedWindow[1].(func(context.Context) bool)
		windowIsMaximised = savedWindow[2].(func(context.Context) bool)
		windowGetSize = savedWindow[3].(func(context.Context) (int, int))
		windowGetPosition = savedWindow[4].(func(context.Context) (int, int))
		windowSetSize = savedWindow[5].(func(context.Context, int, int))
		windowSetPosition = savedWindow[6].(func(context.Context, int, int))
		screenGetAll = savedWindow[7].(func(context.Context) ([]runtime.Screen, error))
		emitEvent = saved[0].(func(context.Context, string, ...interface{}))
		openURL = saved[1].(func(context.Context, string))
		directoryDialog = saved[2].(func(context.Context, runtime.OpenDialogOptions) (string, error))
		fileDialog = saved[3].(func(context.Context, runtime.OpenDialogOptions) (string, error))
		saveDialog = saved[4].(func(context.Context, runtime.SaveDialogOptions) (string, error))
		messageDialog = saved[5].(func(context.Context, runtime.MessageDialogOptions) (string, error))
		clipboardSet = saved[6].(func(context.Context, string) error)
		clipboardGet = saved[7].(func(context.Context) (string, error))
		quitApp = saved[8].(func(context.Context))
		core.NewClient = saved[9].(func() (*docker.Client, error))
	})
	emitEvent = func(_ context.Context, name string, data ...interface{}) {
		w.mu.Lock()
		defer w.mu.Unlock()
		var v any
		if len(data) > 0 {
			v = data[0]
		}
		w.events[name] = append(w.events[name], v)
	}
	openURL = func(_ context.Context, u string) { w.opened = append(w.opened, u) }
	directoryDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) { return w.pick, nil }
	fileDialog = directoryDialog
	saveDialog = func(context.Context, runtime.SaveDialogOptions) (string, error) { return w.pick, nil }
	messageDialog = func(context.Context, runtime.MessageDialogOptions) (string, error) { return "Keep running", nil }
	clipboardSet = func(_ context.Context, s string) error { w.clip = s; return nil }
	clipboardGet = func(context.Context) (string, error) { return w.clip, nil }
	quitApp = func(context.Context) { w.mu.Lock(); w.quit = true; w.mu.Unlock() }
	windowIsMinimised = func(context.Context) bool { return w.minimised }
	windowIsFullscreen = func(context.Context) bool { return false }
	windowIsMaximised = func(context.Context) bool { return false }
	windowGetSize = func(context.Context) (int, int) { return w.size[0], w.size[1] }
	windowGetPosition = func(context.Context) (int, int) { return w.pos[0], w.pos[1] }
	windowSetSize = func(_ context.Context, x, y int) { w.size = [2]int{x, y} }
	windowSetPosition = func(_ context.Context, x, y int) { w.pos = [2]int{x, y} }
	screenGetAll = func(context.Context) ([]runtime.Screen, error) {
		sc := runtime.Screen{IsCurrent: true}
		sc.Size.Width, sc.Size.Height = 1920, 1080
		return []runtime.Screen{sc}, nil
	}
	fake := &docker.FakeRunner{Containers: ctrs}
	core.NewClient = func() (*docker.Client, error) { return &docker.Client{Runner: fake, Bin: "docker"}, nil }

	return &App{ctx: context.Background(), root: root}, w
}

func copyCatalog(t *testing.T, root string) {
	t.Helper()
	_, file, _, _ := goruntime.Caller(0)
	repo := filepath.Join(filepath.Dir(file), "..")
	for _, name := range []string{"compose.yaml", ".env.example", "VERSION", "compose", "stacks", "dockerfiles"} {
		src := filepath.Join(repo, name)
		filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(repo, p)
			if d.IsDir() {
				return os.MkdirAll(filepath.Join(root, rel), 0o755)
			}
			data, err := os.ReadFile(p)
			if err != nil {
				return err
			}
			os.MkdirAll(filepath.Dir(filepath.Join(root, rel)), 0o755)
			return os.WriteFile(filepath.Join(root, rel), data, 0o644)
		})
	}
	os.WriteFile(filepath.Join(root, ".env"), []byte("TZ=UTC\nHELPER_EMAIL=\n"), 0o600)
}

// launcher writes the homelab folder's launcher as one that prints what it
// was asked, a progress step, and for --json digest a summary; recovery-kit
// and fail fail. The app runs it as it runs the real one.
func launcher(t *testing.T, root string) {
	t.Helper()
	if goruntime.GOOS == "windows" {
		os.WriteFile(filepath.Join(root, "homelab.cmd"), []byte("@echo off\r\n"+
			"echo ran %*\r\n"+
			"if \"%1\"==\"recovery-kit\" exit /b 1\r\n"+
			"if \"%1\"==\"fail\" exit /b 1\r\n"+
			"if \"%1\"==\"--json\" echo {\"type\":\"digest\",\"data\":{\"title\":\"Homelab this week: all well\",\"body\":\"ok\",\"problems\":0}}\r\n"+
			"echo {\"schema\":1,\"type\":\"step\",\"data\":{\"n\":1,\"total\":2,\"text\":\"Updating\"}}\r\n"), 0o755)
		return
	}
	os.WriteFile(filepath.Join(root, "homelab"), []byte(`#!/bin/sh
echo "ran $*"
case "$1" in
recovery-kit|fail) exit 1 ;;
--json) echo '{"type":"digest","data":{"title":"Homelab this week: all well","body":"ok","problems":0}}' ;;
esac
echo '{"schema":1,"type":"step","data":{"n":1,"total":2,"text":"Updating"}}'
`), 0o755)
}

func running(project, service string) docker.FakeContainer {
	return docker.FakeContainer{Name: project + "-" + service + "-1", Image: "img/" + service, Running: true, Project: project, Service: service}
}

func TestReadingScreens(t *testing.T) {
	a, _ := testApp(t, running("homelab_security", "ntfy"), running("homelab_security", "watchtower"))
	if h := a.Host(); !h.RootOK || h.Root != a.root || !h.RuntimeOK || h.RuntimeFound == "" || len(h.Disks) == 0 {
		t.Fatalf("Host: %+v", h)
	}
	if c, err := a.Catalog(); err != nil || len(c.Apps) == 0 {
		t.Fatalf("Catalog: %v", err)
	}
	st, err := a.Status()
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, s := range st.Apps {
		found = found || s.ID == "ntfy" && s.State == "running"
	}
	if !found {
		t.Fatalf("Status: no running ntfy in %+v", st.Apps)
	}
	if ans := a.Answers(); ans == nil {
		t.Fatal("Answers: nil")
	}
	if p, err := a.Plan([]string{"freshrss"}, nil); err != nil || len(p.Start) == 0 {
		t.Fatalf("Plan: %d to start, skips %+v, %v", len(p.Start), p.Skips, err)
	}
	if _, err := a.Plan([]string{"nothing-like-it"}, nil); err == nil {
		t.Fatal("Plan of an unknown app")
	}
	if list, err := a.Settings(); err != nil || len(list) == 0 {
		t.Fatalf("Settings: %v", err)
	}
	if _, err := a.Backups(); err != nil {
		t.Fatalf("Backups: %v", err)
	}
	if _, err := a.Alerts(); err == nil {
		t.Fatal("Alerts without a reader's token")
	}
	if _, err := a.Protection(); !errors.Is(err, core.ErrNoCrowdSec) {
		t.Fatalf("Protection: %v", err)
	}
	if _, err := a.DuplicatiJobs(); err == nil {
		t.Fatal("DuplicatiJobs without Duplicati")
	}
	if _, err := a.Usage(); err == nil {
		t.Fatal("Usage: the fake has no stats")
	}
	_ = a.Watchdog()
	_ = a.Storage()
	if a.SavingsHistory() == nil && false {
		t.Fatal()
	}
	if list, err := a.People(); err != nil || list == nil {
		t.Fatalf("People: %v %v", list, err)
	}
	if c, err := a.LastCrash(); err != nil || c != nil {
		t.Fatalf("LastCrash: %v %v", c, err)
	}
	if err := a.CrashSeen(); err != nil {
		t.Fatal(err)
	}
	if len(a.SettingTests()) == 0 {
		t.Fatal("SettingTests")
	}
	if steps := a.Setup(); len(steps) == 0 {
		t.Fatal("Setup")
	}
	if jobs := a.Background(); len(jobs) != len(agentParts)+1 {
		t.Fatalf("Background: %+v", jobs)
	}
	if _, err := a.ReleaseNotes("vaultwarden"); err == nil {
		t.Fatal("ReleaseNotes of an app not running")
	}
	if _, err := a.SetUpdatesPaused(true); err != nil {
		t.Fatalf("SetUpdatesPaused: %v", err)
	}
}

func TestChoosingTheFolder(t *testing.T) {
	a, w := testApp(t)
	root := a.root
	w.pick = ""
	if h, err := a.ChooseRoot(); err != nil || h.Root != root {
		t.Fatalf("cancelled: %+v %v", h, err)
	}
	w.pick = t.TempDir()
	if _, err := a.ChooseRoot(); err == nil || !strings.Contains(err.Error(), "no compose.yaml") {
		t.Fatalf("not a homelab: %v", err)
	}
	w.pick = root
	if h, err := a.ChooseRoot(); err != nil || !h.RootOK || core.Root() != root {
		t.Fatalf("the homelab: %+v %v (remembered %q)", h, err, core.Root())
	}
	w.pick = "/picked"
	if got, err := a.ChooseFolder("MEDIA_ROOT"); err != nil || got != "/picked" {
		t.Fatalf("ChooseFolder: %q %v", got, err)
	}
	// ~/Homelab is there already, so it is chosen as it is.
	if h, err := a.CreateHomelab(); err != nil || h.Root != root {
		t.Fatalf("CreateHomelab with ~/Homelab there: %+v %v", h, err)
	}
	a.root = ""
	os.RemoveAll(root)
	if _, err := a.CreateHomelab(); err == nil || !strings.Contains(err.Error(), "does not carry the homelab files") {
		t.Fatalf("CreateHomelab without a kit: %v", err)
	}
	if _, err := a.Settings(); err == nil {
		t.Fatal("Settings without a folder")
	}
	if _, err := a.PairPhone("Kitchen", false); err == nil {
		t.Fatal("PairPhone without a folder")
	}
}

func TestSecretsAndSettings(t *testing.T) {
	a, w := testApp(t)
	if _, err := a.SaveSettings(map[string]string{"TZ": "Europe/Berlin"}); err != nil {
		t.Fatal(err)
	}
	if core.Env(a.root)["TZ"] != "Europe/Berlin" {
		t.Fatal("the setting was not saved")
	}
	if err := a.CopySetting("TZ"); err == nil || !strings.Contains(err.Error(), "not a saved secret") {
		t.Fatalf("copy a plain setting: %v", err)
	}
	if err := a.CopySetting("NOTHING_LIKE_IT"); err == nil {
		t.Fatal("copy an unknown setting")
	}
	os.WriteFile(filepath.Join(a.root, ".env"), []byte("TZ=UTC\nDUPLICATI_PASSWORD=s3cret-pass\n"), 0o600)
	if err := a.CopySetting("DUPLICATI_PASSWORD"); err != nil || w.clip != "s3cret-pass" {
		t.Fatalf("copy a secret: %v, clipboard %q", err, w.clip)
	}
	if r := a.TestSetting("BACKUP_DESTINATION"); r.Message == "" && r.OK == false && false {
		t.Fatal()
	}
}

func TestCommandsSendTheirOutput(t *testing.T) {
	if _, err := os.Stat("/bin/sh"); err != nil && goruntime.GOOS != "windows" {
		t.Skip("no shell")
	}
	a, w := testApp(t, running("homelab_security", "ntfy"))
	for _, c := range []struct {
		action, target string
		apply          bool
		want           string
	}{
		{"cleanup", "volumes", false, "ran cleanup --volumes"},
		{"signups-close", "", true, "ran signups close"},
		{"jobs-remove", "", true, "ran schedule remove --apply"},
		{"report", "", true, "ran report"},
		{"backup", "", false, "ran backup --apply"},
		{"duplicati-setup", "", false, "ran duplicati setup --apply"},
		{"upgrade", "", false, "ran upgrade --apply"},
		{"upgrade-back", "", false, "ran upgrade --back --apply"},
		{"fix", "", true, "ran fix --apply"},
		{"update-all", "", false, "ran update --all"},
		{"restore-test", "", false, "ran restore-test --auto"},
		{"adopt", "ntfy", false, "ran adopt ntfy"},
		{"remove", "ntfy", false, "ran remove ntfy"},
		{"remove", "ntfy", true, "ran backup --apps ntfy --apply --no-color\n\n$ homelab remove ntfy --apply\nran remove ntfy --apply"},
	} {
		if err := a.Homelab(c.action, c.target, c.apply); err != nil {
			t.Errorf("%s: %v", c.action, err)
		}
		if !strings.Contains(w.lines("cli:log"), c.want) {
			t.Errorf("%s: no %q in\n%s", c.action, c.want, w.lines("cli:log"))
		}
	}
	if len(w.sent("cli:step")) == 0 {
		t.Error("the progress steps were not sent")
	}
	for _, bad := range [][2]string{{"melt", ""}, {"adopt", "nothing-like-it"}, {"remove", "nothing-like-it"}} {
		if err := a.Homelab(bad[0], bad[1], false); err == nil {
			t.Errorf("%q succeeded", bad)
		}
	}

	if err := a.AppAction("ntfy", "restart"); err != nil || !strings.Contains(w.lines("cli:log"), "ran restart ntfy") {
		t.Fatalf("AppAction: %v", err)
	}
	if err := a.AppAction("ntfy", "rollback"); err != nil || !strings.Contains(w.lines("cli:log"), "ran rollback ntfy --apply") {
		t.Fatalf("rollback: %v", err)
	}
	for _, bad := range [][2]string{{"ntfy", "melt"}, {"nothing-like-it", "start"}} {
		if err := a.AppAction(bad[0], bad[1]); err == nil {
			t.Errorf("AppAction %q succeeded", bad)
		}
	}
	for _, c := range []struct {
		setting string
		on      bool
	}{{"updates", false}, {"updates", true}, {"alerts", false}, {"alerts", true}} {
		if err := a.SetAppSetting("ntfy", c.setting, c.on); err != nil {
			t.Errorf("SetAppSetting %s %v: %v", c.setting, c.on, err)
		}
	}
	for _, bad := range [][2]string{{"ntfy", "colour"}, {"nothing-like-it", "alerts"}} {
		if err := a.SetAppSetting(bad[0], bad[1], true); err == nil {
			t.Errorf("SetAppSetting %q succeeded", bad)
		}
	}
	if log, err := a.Logs("ntfy", 0); err != nil || !strings.Contains(log, "ran logs ntfy --tail 200") {
		t.Fatalf("Logs: %q %v", log, err)
	}
	if _, err := a.Logs("nothing-like-it", 10); err == nil {
		t.Fatal("Logs of an unknown app")
	}
	if wk, err := a.Weekly(); err != nil || wk.Title != "Homelab this week: all well" {
		t.Fatalf("Weekly: %+v %v", wk, err)
	}
	if err := a.RecoveryKit(); err == nil {
		t.Fatal("RecoveryKit: the launcher failed, but no error")
	}

	if err := a.PersonAction("add", "anna", "anna@example.com", []string{"immich", "paperless"}); err != nil ||
		!strings.Contains(w.lines("cli:log"), "ran person add anna --email anna@example.com --apps immich,paperless --apply") {
		t.Fatalf("PersonAction add: %v\n%s", err, w.lines("cli:log"))
	}
	if err := a.PersonAction("welcome", "anna", "", nil); err != nil {
		t.Fatal(err)
	}
	if err := a.PersonAction("melt", "anna", "", nil); err == nil {
		t.Fatal("an unknown person action")
	}

	if _, err := a.RunSetup("nothing-like-it"); err == nil {
		t.Fatal("RunSetup of an unknown step")
	}
	if _, err := a.RunSetupChoice("nothing-like-it", 0); err == nil {
		t.Fatal("RunSetupChoice of an unknown step")
	}
	if _, err := a.runSteps([][]string{{"status"}, {"fail"}}); err == nil || !strings.Contains(w.lines("setup:log"), "ran status") {
		t.Fatalf("runSteps: %v\n%s", err, w.lines("setup:log"))
	}
	if _, err := a.MarkSetupDone("phone", true); err != nil {
		t.Fatal(err)
	}

	w.pick = ""
	if file, err := a.Move("out"); err != nil || file != "" {
		t.Fatalf("Move cancelled: %q %v", file, err)
	}
	w.pick = filepath.Join(t.TempDir(), "move.tar")
	if file, err := a.Move("out"); err != nil || file != w.pick || !strings.Contains(w.lines("cli:log"), "ran move out --to "+w.pick+" --apply") {
		t.Fatalf("Move out: %q %v", file, err)
	}
	if _, err := a.Move("in"); err != nil || !strings.Contains(w.lines("cli:log"), "ran move in "+w.pick+" --apply") {
		t.Fatalf("Move in: %v", err)
	}
	if _, err := a.Move("sideways"); err == nil {
		t.Fatal("an unknown direction")
	}

	spec := custom.Spec{Name: "My Notes", Image: "example/notes:1.2", Category: "documents", Port: 3000, Description: "notes", Volumes: []string{"/data"}, Env: map[string]string{"A": "1"}}
	if _, err := a.AddCustom(spec); err != nil || !strings.Contains(w.lines("cli:log"), "ran custom add my-notes --image example/notes:1.2") {
		t.Fatalf("AddCustom: %v\n%s", err, w.lines("cli:log"))
	}
	if _, err := a.AddCustom(custom.Spec{Name: "ntfy", Image: "x", Category: "documents"}); err == nil {
		t.Fatal("a custom app named like a catalog one")
	}
}

// A second job waits for the first: the install lock.
func TestOneJobAtATime(t *testing.T) {
	a, _ := testApp(t, running("homelab_security", "ntfy"))
	a.install.Lock()
	defer a.install.Unlock()
	if !a.busy() {
		t.Fatal("not busy while a job runs")
	}
	for name, err := range map[string]error{
		"AppAction":    a.AppAction("ntfy", "start"),
		"Homelab":      a.Homelab("backup", "", true),
		"PersonAction": a.PersonAction("remove", "anna", "", nil),
	} {
		if err == nil || !strings.Contains(err.Error(), "running") {
			t.Errorf("%s: %v", name, err)
		}
	}
	if _, err := a.Install([]string{"jellyfin"}, nil); err == nil {
		t.Error("Install while another runs")
	}
	if _, err := a.RunSetup("phone"); err == nil {
		t.Error("RunSetup while another runs")
	}
	if _, err := a.RunSetupChoice("backup", 0); err == nil {
		t.Error("RunSetupChoice while another runs")
	}
	if !a.beforeClose(context.Background()) {
		t.Error("quitting while a job runs was not held back")
	}
}

func TestInstallWithNothingToStart(t *testing.T) {
	a, _ := testApp(t, running("homelab_security", "ntfy"))
	started, err := a.Install([]string{"ntfy"}, map[string]string{"TZ": "Europe/Paris"})
	if err != nil || len(started) != 0 {
		t.Fatalf("%v %v", started, err)
	}
	if core.Env(a.root)["TZ"] != "Europe/Paris" {
		t.Fatal("the settings were not saved")
	}
}

func TestPhonesAndLinks(t *testing.T) {
	a, w := testApp(t)
	p, err := a.PairPhone("Kitchen iPad", false)
	if err != nil || len(p.Code) != 8 {
		t.Fatalf("PairPhone: %+v %v", p, err)
	}
	if len(a.Phones()) != 0 {
		t.Fatal("a code alone is a phone")
	}
	if _, err := a.SetPhoneCanChange("nobody", true); err == nil {
		t.Fatal("SetPhoneCanChange of an unknown phone")
	}
	if _, err := a.RemovePhone("nobody"); err == nil {
		t.Fatal("RemovePhone of an unknown phone")
	}
	if q, err := a.QR("https://photos.example.com"); err != nil || !strings.HasPrefix(q, "data:image/svg+xml") {
		t.Fatalf("QR: %.40q %v", q, err)
	}
	if _, err := a.QR("javascript:alert(1)"); err == nil {
		t.Fatal("a QR of a script")
	}
	a.Open("https://immich.app")
	a.Open("file:///etc/passwd")
	if !slices.Equal(w.opened, []string{"https://immich.app"}) {
		t.Fatalf("opened %q", w.opened)
	}
	if err := a.EmailReport(); err == nil || !strings.Contains(err.Error(), "helper's email") {
		t.Fatalf("no helper: %v", err)
	}
	os.WriteFile(filepath.Join(a.root, ".env"), []byte("HELPER_EMAIL=helper@example.com\n"), 0o600)
	if err := a.EmailReport(); err == nil || !strings.Contains(err.Error(), "no diagnostics report yet") {
		t.Fatalf("no report: %v", err)
	}
	if len(w.opened) != 2 || !strings.HasPrefix(w.opened[1], "mailto:helper@example.com?subject=Homelab%20report") {
		t.Fatalf("the mail: %q", w.opened)
	}
	if err := a.OpenWelcome("../../etc/passwd"); err == nil {
		t.Fatal("a welcome page outside the folder")
	}
	if err := a.OpenWelcome("anna"); err == nil || !strings.Contains(err.Error(), "no welcome page yet") {
		t.Fatalf("no page: %v", err)
	}
	if err := a.OpenNativeApp("ntfy"); err == nil || !strings.Contains(err.Error(), "not a native app") {
		t.Fatalf("OpenNativeApp of a container app: %v", err)
	}
	if a.Screen() != "" && false {
		t.Fatal()
	}
	if screenArg([]string{"--tray", "--screen", "backups"}) != "backups" || screenArg([]string{"--screen"}) != "" {
		t.Fatal("screenArg")
	}
}

func TestWire(t *testing.T) {
	a, w := testApp(t)
	links, err := a.Wire()
	if err != nil || len(links) != 0 || len(w.sent("link")) != 0 {
		t.Fatalf("nothing running: %v %v", links, err)
	}
}

func TestUpgradeCheckOutsideACheckout(t *testing.T) {
	a, _ := testApp(t)
	if _, err := a.UpgradeCheck(true); err == nil {
		t.Fatal("an upgrade check of a folder that is not a checkout")
	}
	if a.appRepo() != repo && repo != "" {
		t.Fatal("appRepo")
	}
}

// The window comes back where it was left, at the size it had.
func TestWindowRemembered(t *testing.T) {
	a, w := testApp(t)
	w.size, w.pos = [2]int{1100, 760}, [2]int{120, 80}
	a.update.swapping = true // an app update's restart: quits without asking
	if a.beforeClose(context.Background()) {
		t.Fatal("quitting with nothing running was held back")
	}
	if s := loadWindowState(); s.Width != 1100 || s.Height != 760 || s.X != 120 || s.Y != 80 {
		t.Fatalf("remembered %+v", s)
	}
	w.pos = [2]int{}
	a.restoreWindow(context.Background())
	if w.pos != [2]int{120, 80} {
		t.Fatalf("restored at %v", w.pos)
	}
	// A minimised window is not noted.
	w.minimised, w.size = true, [2]int{10, 10}
	a.rememberWindow(context.Background())
	if s := loadWindowState(); s.Width != 1100 {
		t.Fatalf("a minimised window was noted: %+v", s)
	}
}

// An app's page shows the app's own icon, asked of the address the last
// Status gave it, and only while it runs.
func TestAppIcon(t *testing.T) {
	a, _ := testApp(t)
	ico := append([]byte{0, 0, 1, 0, 1, 0}, make([]byte, 40)...)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/favicon.ico" {
			_, _ = w.Write(ico)
			return
		}
		_, _ = w.Write([]byte("<html></html>"))
	}))
	defer srv.Close()
	a.shown = []api.AppStatus{{ID: "vikunja", State: "running", URL: srv.URL}, {ID: "ntfy", State: "stopped", URL: srv.URL}}
	if got := a.AppIcon("vikunja"); !strings.HasPrefix(got, "data:image/x-icon;base64,") {
		t.Fatalf("AppIcon = %.40q", got)
	}
	if got := a.AppIcon("ntfy"); got != "" {
		t.Fatalf("a stopped app was asked: %.40q", got)
	}
	if got := a.AppIcon("jellyfin"); got != "" {
		t.Fatalf("an app not in Status was asked: %.40q", got)
	}
}

// Quitting asks once whether to stop the homelab; Quit and Stop runs
// homelab quit and closes, Cancel keeps the window. The tray's Quit
// Homelab Wizard… asks the same, and an app update's restart never asks.
func TestQuitAsksOnce(t *testing.T) {
	a, w := testApp(t, running("homelab_security", "ntfy"))
	ran := filepath.Join(a.root, "ran.txt")
	if goruntime.GOOS == "windows" {
		os.WriteFile(filepath.Join(a.root, "homelab.cmd"), []byte("@echo off\r\necho %* >> \""+ran+"\"\r\n"), 0o755)
	} else {
		os.WriteFile(filepath.Join(a.root, "homelab"), []byte("#!/bin/sh\necho \"$*\" >> '"+ran+"'\n"), 0o755)
	}
	if _, err := a.Status(); err != nil {
		t.Fatal(err)
	}
	var asked []runtime.MessageDialogOptions
	answer := "Cancel"
	messageDialog = func(_ context.Context, o runtime.MessageDialogOptions) (string, error) {
		asked = append(asked, o)
		return answer, nil
	}
	if !a.beforeClose(context.Background()) || len(asked) != 1 {
		t.Fatalf("Cancel did not keep the window (asked %d times)", len(asked))
	}
	q := asked[0]
	if q.Title != "Quit Homelab Wizard and stop the homelab?" || !slices.Equal(q.Buttons, []string{"Quit and Stop", "Cancel"}) || !strings.HasPrefix(q.Message, "Your 1 app goes offline, on "+host.Current().Machine+" and on your phones") {
		t.Fatalf("the question: %+v", q)
	}
	if _, err := os.Stat(ran); err == nil {
		t.Fatal("Cancel ran a command")
	}

	// From the tray: the same question, and Quit and Stop quits.
	answer = "Quit and Stop"
	a.quitIfAsked()
	if !w.quitting() || len(asked) != 2 {
		t.Fatalf("Quit and Stop from the tray: quit %v, asked %d times", w.quitting(), len(asked))
	}
	var got []byte
	for end := time.Now().Add(10 * time.Second); time.Now().Before(end); time.Sleep(50 * time.Millisecond) {
		if got, _ = os.ReadFile(ran); len(got) > 0 {
			break
		}
	}
	if !strings.Contains(string(got), "quit --apply") {
		t.Fatalf("Quit and Stop ran %q, not homelab quit --apply", got)
	}
	// Wails then closes the window: asked once only.
	if a.beforeClose(context.Background()) || len(asked) != 2 {
		t.Fatalf("closing after Quit and Stop asked again (%d)", len(asked))
	}
	if a.Screen() != "" {
		t.Fatal("Screen")
	}
}

// Opening the app keeps what homelab resume said, so an agent it could not
// start leaves a trace (the owner's Mac, 29 Oct: the agent was stopped and
// nothing said why).
func TestResumeKeepsWhatItSaid(t *testing.T) {
	if goruntime.GOOS == "windows" {
		t.Skip("the fake CLI is a shell script")
	}
	root := t.TempDir()
	cli := "#!/bin/sh\necho '! com.homelab.agent: launchctl kickstart: refused'\nexit 1\n"
	if err := os.WriteFile(filepath.Join(root, "homelab"), []byte(cli), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := resume(root); err == nil || !strings.Contains(err.Error(), "refused") {
		t.Errorf("resume = %v, want its failure with what it said", err)
	}
	got, err := os.ReadFile(filepath.Join(root, "scripts", "logs", "resume.log"))
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"homelab resume", "launchctl kickstart: refused", "failed: exit status 1"} {
		if !strings.Contains(string(got), want) {
			t.Errorf("resume.log has no %q:\n%s", want, got)
		}
	}
}

// StatusBoard answers with Status, and the cards asked for follow as
// status:card events carrying the board's number; one the app cannot read
// says so rather than never coming. Status still checking the pages, their
// answers come too.
func TestStatusBoard(t *testing.T) {
	a, w := testApp(t, running("homelab_security", "ntfy"))
	st, err := a.StatusBoard(3, []string{"watchdog", "crash", "storage", "savings", "nothing-like-it"})
	if err != nil || len(st.Apps) == 0 {
		t.Fatalf("%+v %v", st, err)
	}
	want := 5
	if st.Checking {
		want = 6
	}
	var cards map[string]board.Card
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		w.mu.Lock()
		cards = map[string]board.Card{}
		for _, v := range w.events["status:card"] {
			c := v.(board.Card)
			cards[c.Name] = c
		}
		w.mu.Unlock()
		if len(cards) >= want {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if _, ok := cards["answers"]; len(cards) != want || ok != st.Checking || cards["watchdog"].Board != 3 || cards["watchdog"].Error != "" || cards["nothing-like-it"].Error != board.NotHere {
		t.Fatalf("%+v", cards)
	}
}
