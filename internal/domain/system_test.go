package domain

import (
	"encoding/base64"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"unicode/utf16"
)

// system stands in for one system: what goos, euid, and terminal answer,
// and the commands run. Shell scripts that sudo or pkexec would run as
// root are run for real (without them) where there is a shell, so their
// quoting is proven; systemctl is a stub that does nothing.
type system struct {
	t    *testing.T
	cmds [][]string
	// do answers a command instead of running it; nil runs it as above.
	do func(c *exec.Cmd) error
}

func fakeSystem(t *testing.T, os_ string, root, term bool) *system {
	t.Helper()
	s := &system{t: t}
	oldGOOS, oldEuid, oldTerm, oldRoot, oldRun := goos, euid, terminal, sysRoot, run
	t.Cleanup(func() { goos, euid, terminal, sysRoot, run = oldGOOS, oldEuid, oldTerm, oldRoot, oldRun })
	goos, terminal = os_, func() bool { return term }
	euid = func() int {
		if root {
			return 0
		}
		return 1000
	}
	sysRoot = t.TempDir()
	run = s.run
	return s
}

// canShell is whether this runner has a shell to run the scripts in.
var canShell = runtime.GOOS != "windows"

func (s *system) run(c *exec.Cmd) error {
	s.cmds = append(s.cmds, c.Args)
	if s.do != nil {
		return s.do(c)
	}
	args := c.Args
	if args[0] == "sudo" || args[0] == "pkexec" {
		args = args[1:]
	}
	switch {
	case args[0] == "-n":
		return nil // sudo -n …: flushing the Mac's DNS cache
	case args[0] == "sh" && canShell:
		stub := s.t.TempDir()
		os.WriteFile(filepath.Join(stub, "systemctl"), []byte("#!/bin/sh\nexit 0\n"), 0o755)
		real := exec.Command("/bin/sh", args[1:]...)
		real.Env = append(os.Environ(), "PATH="+stub+":"+basePath)
		real.Stdin, real.Stdout, real.Stderr = c.Stdin, c.Stdout, c.Stderr
		return real.Run()
	case args[0] == "mkdir":
		return os.MkdirAll(args[len(args)-1], 0o755)
	case args[0] == "tee":
		data, _ := io.ReadAll(c.Stdin)
		return os.WriteFile(args[1], data, 0o644)
	}
	return nil
}

func (s *system) ran(name string) []string {
	for _, c := range s.cmds {
		if c[0] == name {
			return c
		}
	}
	return nil
}

// onPath puts an empty program called name first on PATH, for LookPath.
func onPath(t *testing.T, name string) {
	t.Helper()
	dir := t.TempDir()
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	os.WriteFile(filepath.Join(dir, name), nil, 0o755)
	t.Setenv("PATH", dir+string(os.PathListSeparator)+basePath)
}

// basePath is the PATH the tests started with.
var basePath = os.Getenv("PATH")

func noPath(t *testing.T) { t.Setenv("PATH", t.TempDir()) }

func content(path string) string {
	b, _ := os.ReadFile(path)
	return string(b)
}

// decodePS undoes encodePS.
func decodePS(t *testing.T, enc string) string {
	t.Helper()
	b, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		t.Fatal(err)
	}
	u := make([]uint16, len(b)/2)
	for i := range u {
		u[i] = uint16(b[2*i]) | uint16(b[2*i+1])<<8
	}
	return string(utf16.Decode(u))
}

// elevated is the script an elevating PowerShell command runs.
func elevated(t *testing.T, args []string) string {
	t.Helper()
	cmd := args[len(args)-1]
	i := strings.Index(cmd, "'-EncodedCommand','")
	if args[0] != "powershell.exe" || !strings.Contains(cmd, "-Verb RunAs") || i < 0 {
		t.Fatalf("not an elevated PowerShell: %q", args)
	}
	return decodePS(t, strings.TrimSuffix(cmd[i+len("'-EncodedCommand','"):], "'"))
}

const hosts = "127.0.0.1 localhost\n10.0.0.5 photos.example.com\n"

// A path with a space and a quote in it, as a home folder can have.
func odd(t *testing.T) string { return filepath.Join(t.TempDir(), "it's here", "etc", "hosts") }

func TestWriteSystemFileAsRoot(t *testing.T) {
	s := fakeSystem(t, "linux", true, false)
	path := odd(t)
	if err := WriteSystemFile(path, hosts, "test"); err != nil {
		t.Fatal(err)
	}
	if content(path) != hosts || len(s.cmds) != 0 {
		t.Fatalf("as root: %q, ran %q", content(path), s.cmds)
	}

	s = fakeSystem(t, "darwin", true, false)
	if err := WriteSystemFile(path, hosts, "test"); err != nil {
		t.Fatal(err)
	}
	if s.ran("sudo") == nil || !slices.Contains(s.cmds[1], "mDNSResponder") {
		t.Errorf("the Mac's DNS cache was not flushed: %q", s.cmds)
	}
}

func TestWriteSystemFileWithSudo(t *testing.T) {
	s := fakeSystem(t, "linux", false, true)
	path := odd(t)
	if err := WriteSystemFile(path, hosts, "test"); err != nil {
		t.Fatal(err)
	}
	if content(path) != hosts || !slices.Equal(s.cmds[1], []string{"sudo", "tee", path}) {
		t.Fatalf("with sudo: %q, ran %q", content(path), s.cmds)
	}
	s.do = func(c *exec.Cmd) error { return errors.New("sudo: a password is required") }
	if err := WriteSystemFile(path, hosts, "test"); err == nil || !strings.Contains(err.Error(), "with sudo") {
		t.Fatalf("sudo refused: %v", err)
	}
}

// From the app, with no terminal: pkexec asks in a window on Linux.
func TestWriteSystemFileWithPkexec(t *testing.T) {
	s := fakeSystem(t, "linux", false, false)
	path := odd(t)
	noPath(t)
	if err := WriteSystemFile(path, hosts, "test"); err == nil || !strings.Contains(err.Error(), "in a terminal") {
		t.Fatalf("no pkexec: %v", err)
	}
	onPath(t, "pkexec")
	if err := WriteSystemFile(path, hosts, "test"); err != nil {
		t.Fatal(err)
	}
	if c := s.ran("pkexec"); c == nil || c[1] != "sh" {
		t.Fatalf("ran %q", s.cmds)
	}
	if canShell {
		if fi, err := os.Stat(path); content(path) != hosts || err != nil || fi.Mode().Perm() != 0o644 {
			t.Fatalf("through pkexec: %q %v", content(path), err)
		}
	}
	s.do = func(c *exec.Cmd) error {
		c.Stderr.Write([]byte("Request dismissed"))
		return errors.New("exit status 126")
	}
	if err := WriteSystemFile(path, hosts, "test"); err == nil || !strings.Contains(err.Error(), "Request dismissed") {
		t.Fatalf("dismissed: %v", err)
	}
}

// From the app on the Mac: the password window. Its shell script is run
// here as the window would run it, as a proof of the quoting.
func TestWriteSystemFileWithTheMacPasswordWindow(t *testing.T) {
	s := fakeSystem(t, "darwin", false, false)
	path := odd(t)
	s.do = func(c *exec.Cmd) error {
		script := c.Args[2]
		const open, close = `do shell script "`, `" with prompt "`
		i, j := strings.Index(script, open), strings.Index(script, close)
		if c.Args[0] != "osascript" || i != 0 || j < 0 {
			t.Fatalf("not a password window: %q", c.Args)
		}
		if want := `with prompt "Homelab needs to add your apps' addresses to the hosts file." with administrator privileges`; !strings.HasSuffix(script, want) {
			t.Errorf("the window says %q", script[j:])
		}
		sh := strings.NewReplacer(`\\`, `\`, `\"`, `"`).Replace(script[len(open):j])
		if canShell {
			out, err := exec.Command("/bin/sh", "-c", sh).CombinedOutput()
			t.Logf("%v %s", err, out) // the cache flush fails as a user, as it may
		}
		return nil
	}
	if err := WriteHosts(path, hosts); err != nil {
		t.Fatal(err)
	}
	if canShell && content(path) != hosts {
		t.Fatalf("through the password window: %q", content(path))
	}
	s.do = func(c *exec.Cmd) error {
		c.Stdout.Write([]byte("User canceled. (-128)"))
		return errors.New("exit status 1")
	}
	if err := WriteHosts(path, hosts); err == nil || !strings.Contains(err.Error(), "User canceled") {
		t.Fatalf("canceled: %v", err)
	}
}

func TestWriteSystemFileWithWindowsApproval(t *testing.T) {
	s := fakeSystem(t, "windows", false, false)
	path := odd(t)
	var script string
	s.do = func(c *exec.Cmd) error {
		script = elevated(t, c.Args)
		return nil
	}
	if err := WriteSystemFile(path, hosts, "test"); err == nil || !strings.Contains(err.Error(), "approval declined") {
		t.Fatalf("declined: %v", err)
	}
	q := strings.ReplaceAll(path, "'", "''")
	if !strings.Contains(script, "-Destination '"+q+"' -Force") || !strings.HasSuffix(script, "Clear-DnsClientCache") {
		t.Errorf("the elevated script: %s", script)
	}
	s.do = func(c *exec.Cmd) error {
		os.MkdirAll(filepath.Dir(path), 0o755)
		return os.WriteFile(path, []byte(hosts), 0o644)
	}
	if err := WriteSystemFile(path, hosts, "test"); err != nil {
		t.Fatal(err)
	}
	s.do = func(c *exec.Cmd) error { return errors.New("exit status 1") }
	if err := WriteSystemFile(path, hosts, "test"); err == nil || !strings.Contains(err.Error(), "changing") {
		t.Fatalf("PowerShell failed: %v", err)
	}
}

// On the Windows runner, the elevated copy runs for real: GitHub's runner
// approves without a prompt, as a person's click would.
func TestWriteElevatedWindowsForReal(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows' approval prompt; the Windows runner runs this")
	}
	path := odd(t)
	if err := writeElevatedWindows(path, hosts); err != nil {
		t.Fatal(err)
	}
	if got := strings.ReplaceAll(content(path), "\r\n", "\n"); got != hosts {
		t.Fatalf("wrote %q", got)
	}
}

func TestHostsPath(t *testing.T) {
	fakeSystem(t, "linux", false, false)
	if HostsPath() != "/etc/hosts" {
		t.Error(HostsPath())
	}
	goos = "windows"
	t.Setenv("SystemRoot", `D:\Windows`)
	if p := HostsPath(); !strings.HasPrefix(p, `D:\Windows`) || !strings.HasSuffix(filepath.ToSlash(p), "System32/drivers/etc/hosts") {
		t.Error(p)
	}
	t.Setenv("SystemRoot", "")
	if p := HostsPath(); !strings.HasPrefix(p, `C:\Windows`) {
		t.Error(p)
	}
}

func TestResolverWhere(t *testing.T) {
	fakeSystem(t, "linux", false, false)
	for os_, want := range map[string]string{
		"linux":   "/etc/systemd/resolved.conf.d/homelab-example.com.conf (systemd-resolved)",
		"windows": "a Name Resolution Policy Table rule for .example.com",
		"darwin":  "/etc/resolver/example.com",
	} {
		goos = os_
		if got := ResolverWhere("example.com"); got != want {
			t.Errorf("%s: %q", os_, got)
		}
	}
}

func TestSetResolverLinux(t *testing.T) {
	s := fakeSystem(t, "linux", true, false)
	if err := SetResolver("example.com", "10.0.0.5"); err == nil || !strings.Contains(err.Error(), "set its DNS server to 10.0.0.5") {
		t.Fatalf("without systemd-resolved: %v", err)
	}
	os.MkdirAll(filepath.Join(sysRoot, "run", "systemd", "resolve"), 0o755)
	if FindsByName("example.com", "10.0.0.5") {
		t.Fatal("found before it was set")
	}
	if err := SetResolver("example.com", "10.0.0.5"); err != nil {
		t.Fatal(err)
	}
	if c := s.cmds[0]; c[0] != "sh" || !strings.HasSuffix(c[2], "systemctl restart systemd-resolved") {
		t.Errorf("as root: %q", c)
	}
	if canShell && !FindsByName("example.com", "10.0.0.5") {
		t.Fatalf("not found after it was set: %q", content(sysRoot+ResolvedPath("example.com")))
	}

	terminal = func() bool { return true }
	euid = func() int { return 1000 }
	s.cmds = nil
	if err := SetResolver("example.com", "10.0.0.6"); err != nil || s.cmds[0][0] != "sudo" {
		t.Fatalf("in a terminal: %v %q", err, s.cmds)
	}
	terminal = func() bool { return false }
	noPath(t)
	if err := SetResolver("example.com", "10.0.0.6"); err == nil || !strings.Contains(err.Error(), "in a terminal") {
		t.Fatalf("no pkexec: %v", err)
	}
	onPath(t, "pkexec")
	s.cmds = nil
	if err := SetResolver("example.com", "10.0.0.7"); err != nil || s.cmds[0][0] != "pkexec" {
		t.Fatalf("from the app: %v %q", err, s.cmds)
	}
	if canShell && !FindsByName("example.com", "10.0.0.7") {
		t.Fatal("not found after pkexec")
	}
	s.do = func(c *exec.Cmd) error { return errors.New("exit status 127") }
	if err := SetResolver("example.com", "10.0.0.8"); err == nil || !strings.Contains(err.Error(), "writing") {
		t.Fatalf("failed: %v", err)
	}
}

func TestSetResolverMac(t *testing.T) {
	s := fakeSystem(t, "darwin", true, false)
	if err := SetResolver("example.com", "10.0.0.5"); err != nil {
		t.Fatal(err)
	}
	if !FindsByName("example.com", "10.0.0.5") || FindsByName("example.com", "10.0.0.6") || !ResolverSet("example.com", "10.0.0.5") {
		t.Fatalf("the resolver file: %q", content(sysRoot+ResolverPath("example.com")))
	}
	if s.ran("sudo") == nil {
		t.Error("the DNS cache was not flushed")
	}
}

func TestSetResolverWindows(t *testing.T) {
	s := fakeSystem(t, "windows", false, false)
	var rule string
	s.do = func(c *exec.Cmd) error {
		cmd := c.Args[len(c.Args)-1]
		if strings.HasPrefix(cmd, "(Get-DnsClientNrptRule") {
			c.Stdout.Write([]byte(rule))
			return nil
		}
		script := elevated(t, c.Args)
		if !strings.Contains(script, "Add-DnsClientNrptRule -Namespace '.example.com' -NameServers '10.0.0.5' -Comment 'homelab'") {
			t.Errorf("the elevated script: %s", script)
		}
		return nil
	}
	if err := SetResolver("example.com", "10.0.0.5"); err == nil || !strings.Contains(err.Error(), "approval declined") {
		t.Fatalf("declined: %v", err)
	}
	rule = "{10.0.0.5}\r\n"
	if err := SetResolver("example.com", "10.0.0.5"); err != nil {
		t.Fatal(err)
	}
	s.do = func(c *exec.Cmd) error { return errors.New("exit status 1") }
	if err := SetResolver("example.com", "10.0.0.5"); err == nil || !strings.Contains(err.Error(), "adding the rule") {
		t.Fatalf("PowerShell failed: %v", err)
	}
	if FindsByName("example.com", "10.0.0.5") {
		t.Error("found when PowerShell failed")
	}
}

// The machine's own addresses: whatever this runner has, the answers agree
// with each other.
func TestLANOfThisMachine(t *testing.T) {
	ip, err := LANAddress()
	network, nerr := LANNetwork()
	if (err == nil) != (nerr == nil) {
		t.Fatalf("address %q %v, network %q %v", ip, err, network, nerr)
	}
	id := HostIdentity()
	if err == nil {
		if !strings.Contains(network, "/") || id.Routes != network {
			t.Errorf("address %s, network %s, routes %s", ip, network, id.Routes)
		}
	} else if id.Routes != "" {
		t.Errorf("no network, but routes %s", id.Routes)
	}
	if name, ok := DefaultVPN(); ok && name == "" {
		t.Error("a VPN without a name")
	}
}
