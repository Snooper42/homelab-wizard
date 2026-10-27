//go:build forreal

package dock

import (
	"io"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// The "needs a look" count on the Dock, for real: an app of the test's own
// (badgecheck) runs in the Dock and sets its badge with SetBadge, as the
// app does, and the Dock's own record of it (lsappinfo's StatusLabel,
// which the Dock draws) has the count; then it is cleared and is gone.
// CI runs it on the macOS runner (go test -tags forreal).
func TestDockBadgeForReal(t *testing.T) {
	bin := filepath.Join(t.TempDir(), "badgecheck")
	if out, err := exec.Command("go", "build", "-o", bin, "./badgecheck").CombinedOutput(); err != nil {
		t.Fatalf("go build: %v\n%s", err, out)
	}
	app := exec.Command(bin)
	in, err := app.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := app.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = app.Process.Kill(); _ = app.Wait() })
	for _, label := range []string{"3", ""} {
		if _, err := io.WriteString(in, label+"\n"); err != nil {
			t.Fatal(err)
		}
		got, err := statusLabel(app.Process.Pid, label)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("SetBadge(%q): the Dock's StatusLabel is %q", label, got)
	}
}

// statusLabel waits up to 15 seconds for the Dock's record of pid's badge
// to say want, and returns what it says.
func statusLabel(pid int, want string) (string, error) {
	var last string
	for end := time.Now().Add(15 * time.Second); ; time.Sleep(500 * time.Millisecond) {
		asn, _ := exec.Command("lsappinfo", "find", "pid="+strconv.Itoa(pid)).Output()
		if a := strings.TrimSpace(string(asn)); a != "" {
			out, _ := exec.Command("lsappinfo", "info", "-only", "StatusLabel", a).Output()
			last = strings.TrimSpace(string(out))
			// `"StatusLabel"={ "label"="3" }`, or nothing once cleared.
			if want != "" && strings.Contains(last, `"label"="`+want+`"`) || want == "" && !strings.Contains(last, `"label"="`) {
				return last, nil
			}
		}
		if time.Now().After(end) {
			return last, &labelError{pid, want, last}
		}
	}
}

type labelError struct {
	pid        int
	want, last string
}

func (e *labelError) Error() string {
	return "the Dock's StatusLabel for pid " + strconv.Itoa(e.pid) + " did not say " + strconv.Quote(e.want) + " in 15 seconds: " + strconv.Quote(e.last)
}
