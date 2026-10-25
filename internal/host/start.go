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
	switch p.OS {
	case "darwin":
		return exec.Command("open", "-a", p.RuntimeApp).Run()
	case "windows":
		if p.RuntimeApp != "" {
			return procattr.Hide(exec.Command(p.RuntimeApp)).Start()
		}
	case "linux":
		// Docker Desktop's user service, or Docker run as you (homelab
		// runtime install), before the system's.
		for _, unit := range []string{"docker-desktop", "docker"} {
			if exec.Command("systemctl", "--user", "cat", unit).Run() == nil {
				return exec.Command("systemctl", "--user", "start", unit).Run()
			}
		}
		if _, err := exec.LookPath("pkexec"); err == nil {
			if out, err := exec.Command("pkexec", "systemctl", "enable", "--now", "docker").CombinedOutput(); err != nil {
				return fmt.Errorf("starting Docker: %v %s", err, out)
			}
			return nil
		}
	}
	return fmt.Errorf("it cannot be started from here")
}
