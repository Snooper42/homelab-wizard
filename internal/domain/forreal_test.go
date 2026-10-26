//go:build forreal

package domain

import (
	"context"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"testing"
	"time"
)

// These change the machine they run on: the names under a test domain
// sent to a DNS server, then taken back, and the same for homelab's lines
// in the hosts file, each through the system's own administrator step.
// CI runs them on each system's runner (go test -tags forreal), where
// sudo asks no password and Windows' approval is given by itself; on your
// own machine they ask for yours. Each leaves the machine as it found it.

const (
	realDomain = "homelab-ci.test"
	realIP     = "192.0.2.53" // TEST-NET-1: nothing answers there
)

// sudo in a terminal on macOS and Linux, as a person would run it there.
func asAPerson(t *testing.T) {
	old := terminal
	terminal = func() bool { return true }
	t.Cleanup(func() { terminal = old })
}

// systemDNS is the system's own view of where names are looked up: what
// a person would read to check, and not the file homelab wrote.
func systemDNS(t *testing.T) string {
	t.Helper()
	var c *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		c = exec.Command("scutil", "--dns")
	case "linux":
		c = exec.Command("resolvectl", "status")
	case "windows":
		c = exec.Command("powershell.exe", "-NoProfile", "-Command", "Get-DnsClientNrptPolicy | Format-List Namespace,NameServers")
	default:
		t.Fatalf("no way to read %s's DNS", runtime.GOOS)
	}
	out, err := c.CombinedOutput()
	if err != nil {
		t.Fatalf("%q: %v\n%s", c.Args, err, out)
	}
	return string(out)
}

// eventually waits up to 15 seconds for ok, as the system takes a change
// in its own time.
func eventually(t *testing.T, what string, ok func() bool) {
	t.Helper()
	for end := time.Now().Add(15 * time.Second); !ok(); time.Sleep(500 * time.Millisecond) {
		if time.Now().After(end) {
			t.Fatalf("after 15 seconds, not %s", what)
		}
	}
}

func TestResolverChangedForReal(t *testing.T) {
	asAPerson(t)
	if ResolverPresent(realDomain) || strings.Contains(systemDNS(t), realDomain) {
		t.Fatalf("%s is set before the test", realDomain)
	}
	if err := SetResolver(realDomain, realIP); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = RemoveResolver(realDomain) })
	if !FindsByName(realDomain, realIP) || !ResolverPresent(realDomain) {
		t.Fatalf("set, but not read back (%s)", ResolverWhere(realDomain))
	}
	eventually(t, "in the system's DNS", func() bool { return strings.Contains(systemDNS(t), realDomain) })

	if err := RemoveResolver(realDomain); err != nil {
		t.Fatal(err)
	}
	if ResolverPresent(realDomain) || FindsByName(realDomain, realIP) {
		t.Fatalf("removed, but still there (%s)", ResolverWhere(realDomain))
	}
	eventually(t, "gone from the system's DNS", func() bool { return !strings.Contains(systemDNS(t), realDomain) })
	if err := RemoveResolver(realDomain); err != nil {
		t.Fatalf("removing it again: %v", err)
	}
}

func TestHostsChangedForReal(t *testing.T) {
	asAPerson(t)
	path, name := HostsPath(), "photos."+realDomain
	before := content(path)
	if before == "" {
		t.Fatalf("no hosts file at %s", path)
	}
	if strings.Contains(before, hostsBegin) {
		t.Fatalf("%s has homelab's lines before the test", path)
	}
	if err := WriteHosts(path, HostsBlock(before, "127.0.0.1", []string{name})); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if content(path) != before {
			_ = WriteHosts(path, before)
		}
	})
	lookup := func() []string {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		addrs, _ := net.DefaultResolver.LookupHost(ctx, name)
		return addrs
	}
	eventually(t, name+" found at 127.0.0.1", func() bool { a := lookup(); return len(a) > 0 && a[0] == "127.0.0.1" })

	if err := WriteHosts(path, HostsBlock(content(path), "", nil)); err != nil {
		t.Fatal(err)
	}
	if got := content(path); got != before {
		t.Fatalf("the hosts file is not as it was:\n%q\nwant\n%q", got, before)
	}
	eventually(t, name+" no longer found", func() bool { return len(lookup()) == 0 })
}
