package domain

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"unicode/utf16"
)

// Each system's way of sending every lookup under the domain to AdGuard
// Home on this machine, whatever DNS the network or a VPN sets: a file in
// /etc/resolver on macOS, a systemd-resolved drop-in on Linux, and a Name
// Resolution Policy Table rule on Windows.

// ResolvedPath is the systemd-resolved drop-in for domain.
func ResolvedPath(domain string) string {
	return "/etc/systemd/resolved.conf.d/homelab-" + domain + ".conf"
}

// Resolved is that drop-in's content: lookups under domain (and only
// those, the ~ says) go to ip.
func Resolved(domain, ip string) string {
	return "# Written by homelab: every " + domain + " name is looked up in AdGuard Home on this machine.\n[Resolve]\nDNS=" + ip + "\nDomains=~" + domain + "\n"
}

// ResolverWhere says, for people, what SetResolver changes.
func ResolverWhere(domain string) string {
	switch runtime.GOOS {
	case "linux":
		return ResolvedPath(domain) + " (systemd-resolved)"
	case "windows":
		return "a Name Resolution Policy Table rule for ." + domain
	}
	return ResolverPath(domain)
}

// FindsByName reports whether this machine sends lookups under domain to
// ip already.
func FindsByName(domain, ip string) bool {
	switch runtime.GOOS {
	case "linux":
		data, err := os.ReadFile(ResolvedPath(domain))
		return err == nil && strings.Contains(string(data), "DNS="+ip+"\n")
	case "windows":
		out, err := exec.Command("powershell.exe", "-NoProfile", "-Command",
			"(Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '."+domain+"' }).NameServers").Output()
		return err == nil && strings.Contains(string(out), ip)
	}
	return ResolverSet(domain, ip)
}

// SetResolver sends every lookup under domain to ip, asking for the
// administrator's password (or approval) once.
func SetResolver(domain, ip string) error {
	why := "look up your " + domain + " apps in AdGuard Home"
	switch runtime.GOOS {
	case "linux":
		if _, err := os.Stat("/run/systemd/resolve"); err != nil {
			return fmt.Errorf("this system does not use systemd-resolved; set its DNS server to %s instead", ip)
		}
		return writeResolved(domain, ip)
	case "windows":
		ns := "." + domain
		script := "Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '" + ns + "' } | Remove-DnsClientNrptRule -Force; " +
			"Add-DnsClientNrptRule -Namespace '" + ns + "' -NameServers '" + ip + "' -Comment 'homelab'; Clear-DnsClientCache"
		// Elevated, so Windows asks for approval once. Start-Process joins
		// its arguments with spaces, so the script goes encoded.
		elevate := "Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','" + encodePS(script) + "'"
		if out, err := exec.Command("powershell.exe", "-NoProfile", "-Command", elevate).CombinedOutput(); err != nil {
			return fmt.Errorf("adding the rule for %s: %v %s", ns, err, strings.TrimSpace(string(out)))
		}
		if !FindsByName(domain, ip) {
			return fmt.Errorf("the rule for %s was not added (was the approval declined?)", ns)
		}
		return nil
	}
	return WriteSystemFile(ResolverPath(domain), Resolver(domain, ip), why)
}

// encodePS is script as -EncodedCommand takes it: base64 of UTF-16LE.
func encodePS(script string) string {
	var b []byte
	for _, r := range utf16.Encode([]rune(script)) {
		b = append(b, byte(r), byte(r>>8))
	}
	return base64.StdEncoding.EncodeToString(b)
}

// writeResolved writes the drop-in and restarts systemd-resolved: with
// sudo in a terminal, else through pkexec, which asks in a window.
func writeResolved(domain, ip string) error {
	tmp, err := os.CreateTemp("", "homelab-resolved-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.WriteString(Resolved(domain, ip)); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	path := ResolvedPath(domain)
	q := func(s string) string { return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'" }
	sh := "mkdir -p " + q(filepath.Dir(path)) + " && cp " + q(tmp.Name()) + " " + q(path) + " && chmod 644 " + q(path) + " && systemctl restart systemd-resolved"
	var c *exec.Cmd
	switch {
	case os.Geteuid() == 0:
		c = exec.Command("sh", "-c", sh)
	case isTerminal(os.Stdin):
		c = exec.Command("sudo", "sh", "-c", sh)
		c.Stdin = os.Stdin
	default:
		if _, err := exec.LookPath("pkexec"); err != nil {
			return fmt.Errorf("writing %s needs the administrator's password: run homelab domain resolver --apply in a terminal", path)
		}
		c = exec.Command("pkexec", "sh", "-c", sh)
	}
	if out, err := c.CombinedOutput(); err != nil {
		return fmt.Errorf("writing %s: %v %s", path, err, strings.TrimSpace(string(out)))
	}
	return nil
}
