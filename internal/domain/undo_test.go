package domain

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestRemoveResolverLinux(t *testing.T) {
	s := fakeSystem(t, "linux", true, false)
	if err := RemoveResolver("not a domain"); err == nil {
		t.Fatal("an invalid domain was taken")
	}
	if err := RemoveResolver("example.com"); err != nil || len(s.cmds) != 0 {
		t.Fatalf("nothing to remove: %v, ran %q", err, s.cmds)
	}
	path := sysRoot + ResolvedPath("example.com")
	os.MkdirAll(filepath.Dir(path), 0o755)

	// Someone's own file under homelab's name stays.
	os.WriteFile(path, []byte("[Resolve]\nDNS=10.0.0.5\n"), 0o644)
	if ResolverPresent("example.com") {
		t.Fatal("a file homelab did not write counts as homelab's")
	}
	if err := RemoveResolver("example.com"); err != nil || content(path) == "" {
		t.Fatalf("someone's own file: %v %q", err, content(path))
	}

	os.WriteFile(path, []byte(Resolved("example.com", "10.0.0.5")), 0o644)
	if !ResolverPresent("example.com") {
		t.Fatal("homelab's drop-in not found")
	}
	if err := RemoveResolver("example.com"); err != nil {
		t.Fatal(err)
	}
	if c := s.cmds[0]; c[0] != "sh" || !strings.HasSuffix(c[2], "systemctl restart systemd-resolved") {
		t.Errorf("as root: %q", c)
	}
	if canShell {
		if _, err := os.Stat(path); !os.IsNotExist(err) || ResolverPresent("example.com") {
			t.Fatalf("the drop-in is still there: %v", err)
		}
	}

	os.WriteFile(path, []byte(Resolved("example.com", "10.0.0.5")), 0o644)
	euid = func() int { return 1000 }
	noPath(t)
	if err := RemoveResolver("example.com"); err == nil || !strings.Contains(err.Error(), "in a terminal") {
		t.Fatalf("no pkexec: %v", err)
	}
	onPath(t, "pkexec")
	s.cmds = nil
	if err := RemoveResolver("example.com"); err != nil || s.cmds[0][0] != "pkexec" {
		t.Fatalf("from the app: %v %q", err, s.cmds)
	}
	os.WriteFile(path, []byte(Resolved("example.com", "10.0.0.5")), 0o644)
	s.do = func(c *exec.Cmd) error {
		c.Stderr.Write([]byte("Request dismissed"))
		return errors.New("exit status 126")
	}
	if err := RemoveResolver("example.com"); err == nil || !strings.Contains(err.Error(), "removing "+path) || !strings.Contains(err.Error(), "Request dismissed") {
		t.Fatalf("dismissed: %v", err)
	}
}

func TestRemoveResolverMac(t *testing.T) {
	s := fakeSystem(t, "darwin", false, true)
	path := sysRoot + ResolverPath("example.com")
	if err := SetResolver("example.com", "10.0.0.5"); err != nil {
		t.Fatal(err)
	}
	s.cmds = nil
	if err := RemoveResolver("example.com"); err != nil {
		t.Fatal(err)
	}
	if c := s.cmds[0]; c[0] != "sudo" || c[1] != "sh" || !strings.HasPrefix(c[3], "/bin/rm -f ") {
		t.Errorf("in a terminal: %q", s.cmds)
	}
	if !strings.Contains(strings.Join(s.cmds[len(s.cmds)-1], " "), "mDNSResponder") {
		t.Errorf("the DNS cache was not flushed: %q", s.cmds)
	}
	if canShell && (ResolverPresent("example.com") || FindsByName("example.com", "10.0.0.5")) {
		t.Fatalf("still there: %q", content(path))
	}

	// From the app: the password window, which flushes the cache itself.
	terminal = func() bool { return false }
	os.WriteFile(path, []byte(Resolver("example.com", "10.0.0.5")), 0o644)
	var script string
	s.do = func(c *exec.Cmd) error {
		script = c.Args[2]
		if canShell {
			const open, close = `do shell script "`, `" with prompt "`
			sh := strings.NewReplacer(`\\`, `\`, `\"`, `"`).Replace(script[len(open):strings.Index(script, close)])
			out, err := exec.Command("/bin/sh", "-c", sh).CombinedOutput()
			t.Logf("%v %s", err, out) // the cache flush fails as a user, as it may
		}
		return nil
	}
	s.cmds = nil
	if err := RemoveResolver("example.com"); err != nil {
		t.Fatal(err)
	}
	if len(s.cmds) != 1 || s.cmds[0][0] != "osascript" || !strings.Contains(script, "mDNSResponder") ||
		!strings.HasSuffix(script, `with prompt "Homelab needs to stop looking up your example.com apps in AdGuard Home." with administrator privileges`) {
		t.Fatalf("the password window: %q", s.cmds)
	}
	if canShell && ResolverPresent("example.com") {
		t.Fatal("the password window's script left the file")
	}
	os.WriteFile(path, []byte(Resolver("example.com", "10.0.0.5")), 0o644)
	s.do = func(c *exec.Cmd) error {
		c.Stdout.Write([]byte("User canceled. (-128)"))
		return errors.New("exit status 1")
	}
	if err := RemoveResolver("example.com"); err == nil || !strings.Contains(err.Error(), "User canceled") {
		t.Fatalf("canceled: %v", err)
	}
}

// nrptTable is Windows' Name Resolution Policy Table for the tests: the
// query lists each rule for a namespace as comment|servers, and an elevated
// script removes the rules it names (by its comment, or, for an older
// homelab's rule with none, by its servers).
type nrptTable struct {
	rules  [][3]string // namespace, comment, servers
	script string      // the last elevated script
	fail   error       // what the elevated PowerShell answers; nil runs it
}

func (n *nrptTable) do(t *testing.T) func(c *exec.Cmd) error {
	return func(c *exec.Cmd) error {
		cmd := c.Args[len(c.Args)-1]
		if strings.HasPrefix(cmd, "Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '") && strings.Contains(cmd, "ForEach-Object") {
			ns := strings.SplitN(strings.TrimPrefix(cmd, "Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '"), "'", 2)[0]
			for _, r := range n.rules {
				if r[0] == ns {
					c.Stdout.Write([]byte(r[1] + "|" + r[2] + "\r\n"))
				}
			}
			return nil
		}
		n.script = elevated(t, c.Args)
		if n.fail != nil {
			return n.fail
		}
		var kept [][3]string
		for _, r := range n.rules {
			named := strings.Contains(n.script, "$_.Namespace -eq '"+r[0]+"'") &&
				((r[1] == "homelab" && strings.Contains(n.script, "$_.Comment -eq 'homelab'")) ||
					(r[1] == "" && strings.Contains(n.script, "-join ',') -eq '"+r[2]+"'")))
			if !named {
				kept = append(kept, r)
			}
		}
		n.rules = kept
		return nil
	}
}

// homelab's Windows rule is removed, and only homelab's: its own comment, or,
// from an older homelab that wrote none, no comment and only home-network
// servers (the owner's PC, Nov 28: .snooper42.com → 10.0.0.242, an address
// no device has any more, left after the PC stopped being the homelab's host,
// so every name under the domain timed out). A rule with someone's own
// comment, or one sending the names to a public server, stays.
func TestRemoveResolverWindows(t *testing.T) {
	s := fakeSystem(t, "windows", false, false)
	n := &nrptTable{}
	s.do = n.do(t)
	if err := RemoveResolver("example.com"); err != nil || n.script != "" {
		t.Fatalf("no rule: %v, ran %q", err, n.script)
	}
	theirs := [][3]string{
		{".example.com", "my VPN", "10.8.0.1"},
		{".example.com", "", "1.1.1.1"},
		{".other.com", "", "192.168.1.5"},
	}
	n.rules = theirs
	if ResolverPresent("example.com") {
		t.Fatal("a rule homelab did not add counts as homelab's")
	}
	if err := RemoveResolver("example.com"); err != nil || n.script != "" {
		t.Fatalf("only others' rules: %v, ran %q", err, n.script)
	}
	for _, ours := range [][3]string{{".example.com", "homelab", "10.0.0.5"}, {".example.com", "", "10.0.0.242"}} {
		n.rules = append(append([][3]string{}, theirs...), ours)
		if !ResolverPresent("example.com") {
			t.Fatalf("%v was not found", ours)
		}
		n.fail = errors.New("exit status 1")
		if err := RemoveResolver("example.com"); err == nil || !strings.Contains(err.Error(), "removing the rule") {
			t.Fatalf("PowerShell failed: %v", err)
		}
		n.fail = nil
		if err := RemoveResolver("example.com"); err != nil || ResolverPresent("example.com") {
			t.Fatalf("%v: %v, rules left %v", ours, err, n.rules)
		}
		if fmt.Sprint(n.rules) != fmt.Sprint(theirs) {
			t.Errorf("%v: others' rules were touched: %v", ours, n.rules)
		}
		if !strings.HasSuffix(n.script, "Clear-DnsClientCache") {
			t.Errorf("the elevated script: %s", n.script)
		}
	}
	n.rules = [][3]string{{".example.com", "homelab", "10.0.0.5"}}
	s.do = func(c *exec.Cmd) error {
		if strings.Contains(c.Args[len(c.Args)-1], "ForEach-Object") {
			return n.do(t)(c)
		}
		return nil // the approval declined: nothing changes
	}
	if err := RemoveResolver("example.com"); err == nil || !strings.Contains(err.Error(), "approval declined") {
		t.Fatalf("declined: %v", err)
	}
}

// Taking homelab's lines out of a hosts file gives back the file it was.
func TestHostsBlockRemoved(t *testing.T) {
	for _, before := range []string{"", "127.0.0.1 localhost\n", "# Windows' own\r\n127.0.0.1 localhost\r\n"} {
		with := HostsBlock(before, "10.0.0.5", []string{"photos.example.com"})
		if !strings.Contains(with, "10.0.0.5 photos.example.com\n") {
			t.Fatalf("not added to %q: %q", before, with)
		}
		if got := HostsBlock(with, "", nil); got != before {
			t.Errorf("removed from %q: %q", before, got)
		}
	}
}
