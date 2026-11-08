//go:build !windows

package proc

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// processStart is when pid started, as ps says it on a Mac and on Linux
// (to the second, in this machine's time zone); false when ps can't say.
func processStart(pid int) (time.Time, bool) {
	cmd := procattr.Hide(exec.Command("ps", "-o", "lstart=", "-p", strconv.Itoa(pid)))
	cmd.Env = append(os.Environ(), "LC_ALL=C", "LANG=C")
	out, err := cmd.Output()
	if err != nil {
		return time.Time{}, false
	}
	at, err := time.ParseInLocation("Mon Jan _2 15:04:05 2006", strings.Join(strings.Fields(string(out)), " "), time.Local)
	if err != nil {
		// ps pads the day with a space ("Nov  6"); Fields joined it as "Nov 6".
		at, err = time.ParseInLocation("Mon Jan 2 15:04:05 2006", strings.Join(strings.Fields(string(out)), " "), time.Local)
	}
	return at, err == nil
}
