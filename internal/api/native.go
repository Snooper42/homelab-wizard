package api

import (
	"context"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/install"
)

// The plan says whether a native app is already on this machine.
func init() {
	install.NativeState = func(n *compose.Native) (bool, bool) {
		if NativeUp(context.Background(), n.Port) {
			return true, true
		}
		return NativeInstalled(n), false
	}
}

// NativeInstalled reports whether a native app is installed here, so a
// stopped one shows on Status and one never installed does not. The
// phone companion (the agent's homelab serve) always counts. Tests replace it.
var NativeInstalled = func(n *compose.Native) bool {
	if strings.Contains(n.Install, "schedule install") {
		return true
	}
	return nativeOnDisk(runtime.GOOS, n.ID, n.Name, func(p string) bool {
		_, err := os.Stat(p)
		return err == nil
	}, func(name string) bool {
		_, err := exec.LookPath(name)
		return err == nil
	})
}

// nativeOnDisk looks where each system's installer puts the app: an .app
// in Applications on macOS, a program on the PATH or a folder of its own on
// Linux, a Program Files folder on Windows.
func nativeOnDisk(goos, id, name string, exists, onPath func(string) bool) bool {
	home, _ := os.UserHomeDir()
	var places []string
	switch goos {
	case "darwin":
		// A Mac's paths, with its own separator whatever system asks.
		for _, dir := range []string{"/Applications", path.Join(filepath.ToSlash(home), "Applications")} {
			places = append(places, path.Join(dir, name+".app"), path.Join(dir, name+" Server.app"))
		}
	case "linux":
		if onPath(id) {
			return true
		}
		places = []string{"/usr/lib/" + id, "/usr/share/" + id, "/opt/" + id}
	case "windows":
		for _, env := range []string{"ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"} {
			if dir := os.Getenv(env); dir != "" {
				places = append(places, filepath.Join(dir, name))
			}
		}
	default:
		return true
	}
	for _, p := range places {
		if exists(p) {
			return true
		}
	}
	return false
}
