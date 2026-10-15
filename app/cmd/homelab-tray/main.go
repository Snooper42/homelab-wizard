// Command homelab-tray is the macOS menu bar item, shipped inside the app
// bundle (Contents/Helpers). On Windows and Linux the app binary runs the
// same item itself with --tray.
package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/Snooper42/homelab-wizard/app/tray"
	"github.com/Snooper42/homelab-wizard/internal/core"
)

func main() {
	core.FixPath()
	tray.Run(openWizard)
}

// openWizard opens the app bundle this helper lives in on a screen; a
// running app gets the request through its single-instance lock.
func openWizard(screen string) {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	bundle := filepath.Clean(filepath.Join(filepath.Dir(exe), "..", ".."))
	if strings.HasSuffix(bundle, ".app") {
		_ = exec.Command("open", "-n", "-a", bundle, "--args", "--screen", screen).Start()
	}
}
