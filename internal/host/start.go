package host

import (
	"fmt"
	"os/exec"
	"runtime"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// system is the machine the runtime is started on and how its tools are
// run; tests replace it.
var system = struct {
	goos string
	// run waits for a command; start does not (an app that keeps running);
	// output waits and returns what it printed.
	run, start func(name string, args ...string) error
	output     func(name string, args ...string) ([]byte, error)
	lookPath   func(string) (string, error)
}{
	goos:     runtime.GOOS,
	run:      func(name string, args ...string) error { return exec.Command(name, args...).Run() },
	start:    func(name string, args ...string) error { return procattr.Hide(exec.Command(name, args...)).Start() },
	output:   func(name string, args ...string) ([]byte, error) { return exec.Command(name, args...).CombinedOutput() },
	lookPath: exec.LookPath,
}

// StartRuntime starts the container runtime: it opens OrbStack or Docker
// Desktop's app; on Linux it starts a user service when there is one
// (Docker Desktop's, or Docker run as you), else the system's Docker
// service, now and at every boot, through pkexec, which asks for the
// password.
func StartRuntime(p Profile) error {
	if p.OS != system.goos {
		return fmt.Errorf("it cannot be started from here")
	}
	if asked, err := AskRuntime(p); asked || err != nil {
		return err
	}
	if p.OS == "linux" {
		if _, err := system.lookPath("pkexec"); err == nil {
			if out, err := system.output("pkexec", "systemctl", "enable", "--now", "docker"); err != nil {
				return fmt.Errorf("starting Docker: %v %s", err, out)
			}
			return nil
		}
	}
	return fmt.Errorf("it cannot be started from here")
}

// AskRuntime starts the container runtime where that needs no one's
// password: OrbStack's or Docker Desktop's app, or on Linux a user service
// (Docker Desktop's, or Docker run as you). asked is false where only an
// administrator can start it (the system's Docker service, which starts at
// boot by itself). The startup job asks once, so the apps come back after
// a sign-in on every system.
func AskRuntime(p Profile) (asked bool, err error) {
	if p.OS != system.goos {
		return false, nil
	}
	switch p.OS {
	case "darwin":
		return true, system.run("open", "-g", "-a", p.RuntimeApp)
	case "windows":
		if p.RuntimeApp == "" {
			return false, nil
		}
		return true, system.start(p.RuntimeApp)
	case "linux":
		for _, unit := range []string{"docker-desktop", "docker"} {
			if system.run("systemctl", "--user", "cat", unit) == nil {
				return true, system.run("systemctl", "--user", "start", unit)
			}
		}
	}
	return false, nil
}
