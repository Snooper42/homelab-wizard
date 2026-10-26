package domain

import (
	"encoding/base64"
	"fmt"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"unicode/utf16"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
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
	switch goos {
	case "linux":
		return ResolvedPath(domain) + " (systemd-resolved)"
	case "windows":
		return "a Name Resolution Policy Table rule for ." + domain
	}
	return ResolverPath(domain)
}

// checkResolver refuses a domain or an address that is not one before it
// goes into an administrator's prompt: into a PowerShell script on Windows
// and a file path under /etc/resolver on the Mac.
func checkResolver(domain, ip string) error {
	if !validDomain.MatchString(domain) {
		return fmt.Errorf("%q is not a valid domain name (HOMELAB_DOMAIN)", domain)
	}
	if _, err := netip.ParseAddr(ip); err != nil {
		return fmt.Errorf("%q is not an IP address", ip)
	}
	return nil
}

// FindsByName reports whether this machine sends lookups under domain to
// ip already.
func FindsByName(domain, ip string) bool {
	if checkResolver(domain, ip) != nil {
		return false
	}
	switch goos {
	case "linux":
		data, err := os.ReadFile(sysRoot + ResolvedPath(domain))
		return err == nil && strings.Contains(string(data), "DNS="+ip+"\n")
	case "windows":
		return strings.Contains(nrptServers(domain, ""), ip)
	}
	return ResolverSet(domain, ip)
}

// SetResolver sends every lookup under domain to ip, asking for the
// administrator's password (or approval) once.
func SetResolver(domain, ip string) error {
	if err := checkResolver(domain, ip); err != nil {
		return err
	}
	why := "look up your " + domain + " apps in AdGuard Home"
	switch goos {
	case "linux":
		if _, err := os.Stat(sysRoot + "/run/systemd/resolve"); err != nil {
			return fmt.Errorf("this system does not use systemd-resolved; set its DNS server to %s instead", ip)
		}
		return writeResolved(domain, ip)
	case "windows":
		ns := "." + domain
		script := "Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '" + ns + "' } | Remove-DnsClientNrptRule -Force; " +
			"Add-DnsClientNrptRule -Namespace '" + ns + "' -NameServers '" + ip + "' -Comment 'homelab'; Clear-DnsClientCache"
		if err := elevatePS(script); err != nil {
			return fmt.Errorf("adding the rule for %s: %v", ns, err)
		}
		if !FindsByName(domain, ip) {
			return fmt.Errorf("the rule for %s was not added (was the approval declined?)", ns)
		}
		return nil
	}
	return WriteSystemFile(sysRoot+ResolverPath(domain), Resolver(domain, ip), why)
}

// encodePS is script as -EncodedCommand takes it: base64 of UTF-16LE.
func encodePS(script string) string {
	var b []byte
	for _, r := range utf16.Encode([]rune(script)) {
		b = append(b, byte(r), byte(r>>8)) // #nosec G115 -- the low and high bytes of a UTF-16 unit, truncation intended
	}
	return base64.StdEncoding.EncodeToString(b)
}

// nrptServers is what the Name Resolution Policy Table rules for domain
// send its lookups to, "" when there is none: every rule, or only those
// with comment.
func nrptServers(domain, comment string) string {
	where := "$_.Namespace -eq '." + domain + "'"
	if comment != "" {
		where += " -and $_.Comment -eq '" + comment + "'"
	}
	var out strings.Builder
	c := procattr.Hide(exec.Command("powershell.exe", "-NoProfile", "-Command",
		"(Get-DnsClientNrptRule | Where-Object { "+where+" }).NameServers"))
	c.Stdout = &out
	if run(c) != nil {
		return ""
	}
	return strings.TrimSpace(out.String())
}

// elevatePS runs script in an elevated PowerShell, so Windows asks for
// approval once. Start-Process joins its arguments with spaces, so the
// script goes encoded.
func elevatePS(script string) error {
	elevate := "Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','" + encodePS(script) + "'"
	if out, err := combined(procattr.Hide(exec.Command("powershell.exe", "-NoProfile", "-Command", elevate))); err != nil {
		return fmt.Errorf("%v %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

// writeResolved writes the drop-in and restarts systemd-resolved.
func writeResolved(domain, ip string) error {
	tmp, err := staged(Resolved(domain, ip))
	if err != nil {
		return err
	}
	defer os.Remove(tmp)
	path := sysRoot + ResolvedPath(domain)
	return asRoot("mkdir -p "+shQuote(filepath.Dir(path))+" && cp "+shQuote(tmp)+" "+shQuote(path)+" && chmod 644 "+shQuote(path)+" && systemctl restart systemd-resolved",
		"writing "+path, "look up your "+domain+" apps in AdGuard Home")
}

// shQuote quotes s for sh.
func shQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'" }

// asRoot runs the shell script sh as root: as it is when this runs as
// root, with sudo in a terminal, and from the app (no terminal) through
// the Mac's password window (why finishes "Homelab needs to …") or
// pkexec, which asks in a window. what names the change for its errors.
func asRoot(sh, what, why string) error {
	var c *exec.Cmd
	switch {
	case euid() == 0:
		c = exec.Command("sh", "-c", sh)
	case terminal():
		c = exec.Command("sudo", "sh", "-c", sh)
		c.Stdin = os.Stdin
	case goos == "darwin":
		return withPasswordWindow(sh, what, why)
	default:
		if _, err := exec.LookPath("pkexec"); err != nil {
			return fmt.Errorf("%s needs the administrator's password: run the same homelab command in a terminal", what)
		}
		c = exec.Command("pkexec", "sh", "-c", sh)
	}
	if out, err := combined(c); err != nil {
		return fmt.Errorf("%s: %v %s", what, err, strings.TrimSpace(string(out)))
	}
	return nil
}
