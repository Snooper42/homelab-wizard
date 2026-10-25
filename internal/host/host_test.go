package host

import (
	"errors"
	"strings"
	"testing"
)

func TestEveryProfileHasItsHints(t *testing.T) {
	for _, goos := range []string{"darwin", "linux", "windows", "plan9"} {
		p := For(goos)
		for name, v := range map[string]string{"Runtime": p.Runtime, "InstallRuntime": p.InstallRuntime, "StartRuntime": p.StartRuntime, "UpdateRuntime": p.UpdateRuntime, "MoreMemory": p.MoreMemory, "InstallOllama": p.InstallOllama} {
			if v == "" {
				t.Errorf("%s: %s is empty", goos, name)
			}
		}
		if supported := goos != "plan9"; p.Supported != supported || (supported && p.Scheduler == "") {
			t.Errorf("%s: supported %v, scheduler %q", goos, p.Supported, p.Scheduler)
		}
	}
}

func TestUnreachable(t *testing.T) {
	refused := errors.New("docker ps: permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock")
	if got := For("linux").Unreachable(refused); !strings.Contains(got, "docker group") {
		t.Errorf("linux, refused: %s", got)
	}
	if got := For("linux").Unreachable(errors.New("docker ps: Cannot connect to the Docker daemon")); !strings.Contains(got, "is not running") {
		t.Errorf("linux, stopped: %s", got)
	}
	if got := For("darwin").Unreachable(refused); !strings.Contains(got, "is not running") {
		t.Errorf("darwin has no access step: %s", got)
	}
}

func TestSteamOS(t *testing.T) {
	if !isSteamOS("NAME=\"SteamOS\"\nID=steamos\nID_LIKE=arch\n") || isSteamOS("ID=arch\n") || isSteamOS("ID_LIKE=steamos\n") {
		t.Error("isSteamOS")
	}
	p := SteamOS(For("linux"))
	if !p.SteamOS || !p.SelfInstall || p.Name != "SteamOS" || !strings.Contains(p.InstallRuntime, "Set up Docker for me") || p.StartRuntime != "systemctl --user start docker" {
		t.Errorf("%+v", p)
	}
}
