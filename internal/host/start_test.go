package host

import (
	"errors"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// fakeSystem stands in for goos's tools: units are the user's systemd
// units, pkexec whether it is installed; every command is recorded.
func fakeSystem(t *testing.T, goos string, units []string, pkexec bool, fail error) *[]string {
	t.Helper()
	saved := system
	t.Cleanup(func() { system = saved })
	var calls []string
	record := func(name string, args ...string) {
		calls = append(calls, strings.TrimSpace(name+" "+strings.Join(args, " ")))
	}
	system.goos = goos
	system.run = func(name string, args ...string) error {
		record(name, args...)
		if len(args) == 3 && args[1] == "cat" {
			for _, u := range units {
				if args[2] == u {
					return nil
				}
			}
			return errors.New("no such unit")
		}
		return fail
	}
	system.start = func(name string, args ...string) error { record(name, args...); return fail }
	system.output = func(name string, args ...string) ([]byte, error) {
		record(name, args...)
		if fail != nil {
			return []byte("Not authorized"), fail
		}
		return nil, nil
	}
	system.lookPath = func(name string) (string, error) {
		if name == "pkexec" && pkexec {
			return "/usr/bin/pkexec", nil
		}
		return "", errors.New("not found")
	}
	return &calls
}

func TestStartRuntimeOnEachSystem(t *testing.T) {
	for _, c := range []struct {
		name    string
		p       Profile
		units   []string
		pkexec  bool
		want    string
		refused bool
	}{
		{name: "a Mac opens OrbStack", p: For("darwin"), want: "open -g -a OrbStack"},
		{name: "Windows opens Docker Desktop", p: For("windows"), want: `C:\Program Files\Docker\Docker\Docker Desktop.exe`},
		{name: "Docker Desktop for Linux", p: For("linux"), units: []string{"docker-desktop", "docker"}, want: "systemctl --user start docker-desktop"},
		{name: "Docker run as you", p: SteamOS(For("linux")), units: []string{"docker"}, want: "systemctl --user start docker"},
		{name: "the system's Docker, with the password", p: For("linux"), pkexec: true, want: "pkexec systemctl enable --now docker"},
		{name: "no pkexec", p: For("linux"), refused: true},
	} {
		t.Run(c.name, func(t *testing.T) {
			calls := fakeSystem(t, c.p.OS, c.units, c.pkexec, nil)
			err := StartRuntime(c.p)
			if c.refused {
				if err == nil {
					t.Fatal("started with no way to")
				}
				return
			}
			if err != nil || !strings.Contains(strings.Join(*calls, "\n"), c.want) {
				t.Fatalf("%v; ran:\n%s", err, strings.Join(*calls, "\n"))
			}
		})
	}
}

func TestAskRuntimeNeverAsksForAPassword(t *testing.T) {
	calls := fakeSystem(t, "linux", nil, true, nil)
	if asked, err := AskRuntime(For("linux")); asked || err != nil {
		t.Errorf("only the system's Docker: nothing to ask (%v %v)", asked, err)
	}
	if strings.Contains(strings.Join(*calls, "\n"), "pkexec") {
		t.Error("the startup job asked for a password")
	}
	fakeSystem(t, "windows", nil, false, nil)
	if asked, _ := AskRuntime(Profile{OS: "windows"}); asked {
		t.Error("a Windows profile without its app")
	}
	fakeSystem(t, "linux", nil, false, nil)
	if asked, _ := AskRuntime(For("darwin")); asked {
		t.Error("another system's profile is not started here")
	}
	if err := StartRuntime(For("darwin")); err == nil {
		t.Error("StartRuntime of another system's profile")
	}
}

func TestStartRuntimeSaysWhyItFailed(t *testing.T) {
	fakeSystem(t, "linux", nil, true, errors.New("exit status 127"))
	if err := StartRuntime(For("linux")); err == nil || !strings.Contains(err.Error(), "Not authorized") {
		t.Errorf("pkexec refused: %v", err)
	}
	fakeSystem(t, "darwin", nil, false, errors.New("Unable to find application named 'OrbStack'"))
	if err := StartRuntime(For("darwin")); err == nil {
		t.Error("OrbStack not installed")
	}
}

func TestJobPathAndCurrent(t *testing.T) {
	home := filepath.Join("home", "anna")
	if p := For("darwin").JobPath(home); !strings.HasPrefix(p, filepath.Join(home, ".orbstack", "bin")+":/opt/homebrew/bin:") || !strings.HasSuffix(p, ":/sbin") {
		t.Errorf("darwin: %s", p)
	}
	if p := For("linux").JobPath(home); !strings.HasPrefix(p, filepath.Join(home, ".local", "bin")+":/usr/local/bin") {
		t.Errorf("linux: %s", p)
	}
	if p := For("windows").JobPath(home); p != "" {
		t.Errorf("Windows jobs keep the account's PATH: %q", p)
	}
	if c := Current(); c.OS != runtime.GOOS || !c.Supported {
		t.Errorf("Current on %s: %+v", runtime.GOOS, c)
	}
}
