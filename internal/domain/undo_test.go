package domain

import (
	"errors"
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

func TestRemoveResolverWindows(t *testing.T) {
	s := fakeSystem(t, "windows", false, false)
	var rule, script string
	s.do = func(c *exec.Cmd) error {
		cmd := c.Args[len(c.Args)-1]
		if strings.HasPrefix(cmd, "(Get-DnsClientNrptRule") {
			if !strings.Contains(cmd, "$_.Comment -eq 'homelab'") {
				t.Errorf("a rule homelab did not add would count: %s", cmd)
			}
			c.Stdout.Write([]byte(rule))
			return nil
		}
		script = elevated(t, c.Args)
		return nil
	}
	if err := RemoveResolver("example.com"); err != nil || script != "" {
		t.Fatalf("no rule: %v, ran %q", err, script)
	}
	rule = "{10.0.0.5}\r\n"
	if !ResolverPresent("example.com") {
		t.Fatal("the rule was not found")
	}
	if err := RemoveResolver("example.com"); err == nil || !strings.Contains(err.Error(), "approval declined") {
		t.Fatalf("declined: %v", err)
	}
	if !strings.HasPrefix(script, "Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '.example.com' -and $_.Comment -eq 'homelab' } | Remove-DnsClientNrptRule -Force") {
		t.Errorf("the elevated script: %s", script)
	}
	s.do = func(c *exec.Cmd) error {
		if strings.HasPrefix(c.Args[len(c.Args)-1], "(Get-DnsClientNrptRule") {
			c.Stdout.Write([]byte(rule))
		} else {
			rule = ""
		}
		return nil
	}
	if err := RemoveResolver("example.com"); err != nil || ResolverPresent("example.com") {
		t.Fatalf("approved: %v", err)
	}
	rule = "{10.0.0.5}\r\n"
	s.do = func(c *exec.Cmd) error {
		if strings.HasPrefix(c.Args[len(c.Args)-1], "(Get-DnsClientNrptRule") {
			c.Stdout.Write([]byte(rule))
			return nil
		}
		return errors.New("exit status 1")
	}
	if err := RemoveResolver("example.com"); err == nil || !strings.Contains(err.Error(), "removing the rule") {
		t.Fatalf("PowerShell failed: %v", err)
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
