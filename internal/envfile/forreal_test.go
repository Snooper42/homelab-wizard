//go:build forreal

package envfile

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// The time zone a new .env gets, changed and read back on the machine this
// runs on through each system's own tool: systemsetup on macOS, tzutil on
// Windows, timedatectl on Linux, each put back as it was. CI runs it on
// each system's runner (go test -tags forreal), where sudo asks no
// password and the runner is an administrator.
func TestTimeZoneForReal(t *testing.T) {
	run := func(name string, args ...string) {
		t.Helper()
		if out, err := exec.Command(name, args...).CombinedOutput(); err != nil {
			t.Fatalf("%s %s: %v\n%s", name, strings.Join(args, " "), err, out)
		}
	}
	// set changes this machine's zone; windows is its name there.
	var set func(iana, windows string)
	switch runtime.GOOS {
	case "darwin":
		before, err := os.Readlink("/etc/localtime")
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("before: /etc/localtime is %s, read as %q", before, HostIdentity().TimeZone)
		t.Cleanup(func() { run("sudo", "-n", "ln", "-sf", before, "/etc/localtime") })
		set = func(iana, _ string) { run("sudo", "-n", "systemsetup", "-settimezone", iana) }
	case "windows":
		before := WindowsZone()
		if before == "" {
			t.Fatal("tzutil /g gave no time zone")
		}
		t.Cleanup(func() { run("tzutil", "/s", before) })
		set = func(_, windows string) { run("tzutil", "/s", windows) }
	case "linux":
		before := HostIdentity().TimeZone
		if before == "" {
			t.Fatal("/etc/localtime names no time zone")
		}
		t.Cleanup(func() { run("sudo", "-n", "timedatectl", "set-timezone", before) })
		set = func(iana, _ string) { run("sudo", "-n", "timedatectl", "set-timezone", iana) }
	default:
		t.Fatalf("no time zone to set on %s", runtime.GOOS)
	}
	for _, z := range []struct{ iana, windows string }{
		{"Europe/Berlin", "W. Europe Standard Time"},
		{"America/Los_Angeles", "Pacific Standard Time"},
	} {
		set(z.iana, z.windows)
		// The system may finish the change a moment after its tool returns.
		var id Identity
		for end := time.Now().Add(10 * time.Second); ; time.Sleep(250 * time.Millisecond) {
			if id = HostIdentity(); id.TimeZone == z.iana || time.Now().After(end) {
				break
			}
		}
		if id.TimeZone != z.iana {
			link, err := os.Readlink("/etc/localtime")
			t.Fatalf("after setting %s, this machine's zone reads %q (/etc/localtime: %q, %v)", z.iana, id.TimeZone, link, err)
		}
		// A new .env takes it.
		dir := t.TempDir()
		example := filepath.Join(dir, ".env.example")
		if err := os.WriteFile(example, []byte("TZ=America/New_York\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		env, _, err := Prepare(filepath.Join(dir, ".env"), example, id)
		if err != nil {
			t.Fatal(err)
		}
		if got, _ := env.Get("TZ"); got != z.iana {
			t.Fatalf("a new .env has TZ=%s, want %s", got, z.iana)
		}
		t.Logf("%s read back, and a new .env has it", z.iana)
	}
}
