package host

import (
	"fmt"
	"os/exec"
	"runtime"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// StartRuntime starts the container runtime: it opens OrbStack or Docker
// Desktop's app; on Linux it starts a user service when there is one
// (Docker Desktop's, or Docker run as you), else the system's Docker
// service, now and at every boot, through pkexec, which asks for the
// password.
func StartRuntime(p Profile) error {
	if p.OS != runtime.GOOS {
		return fmt.Errorf("it cannot be started from here")
	}
	if asked, err := AskRuntime(p); asked || err != nil {
		return err
	}
	if p.OS == "linux" {
		if _, err := exec.LookPath("pkexec"); err == nil {
			if out, err := exec.Command("pkexec", "systemctl", "enable", "--now", "docker").CombinedOutput(); err != nil {
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
	if p.OS != runtime.GOOS {
		return false, nil
	}
	switch p.OS {
	case "darwin":
		return true, exec.Command("open", "-g", "-a", p.RuntimeApp).Run()
	case "windows":
		if p.RuntimeApp == "" {
			return false, nil
		}
		return true, procattr.Hide(exec.Command(p.RuntimeApp)).Start()
	case "linux":
		for _, unit := range []string{"docker-desktop", "docker"} {
			if exec.Command("systemctl", "--user", "cat", unit).Run() == nil {
				return true, exec.Command("systemctl", "--user", "start", unit).Run()
			}
		}
	}
	return false, nil
}
