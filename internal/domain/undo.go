package domain

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Taking back what SetResolver did: the Mac's resolver file, the
// systemd-resolved drop-in, or the Name Resolution Policy Table rule
// removed, asking for the administrator once. Only what homelab wrote is
// removed: a file without its first line, or a rule without its comment,
// stays.

// writtenBy starts every file SetResolver writes.
const writtenBy = "# Written by homelab:"

// ResolverPresent reports whether homelab's resolver for domain is on this
// machine, whatever address it points at.
func ResolverPresent(domain string) bool {
	if !validDomain.MatchString(domain) {
		return false
	}
	switch goos {
	case "windows":
		return nrptServers(domain, "homelab") != ""
	case "linux":
		return ours(sysRoot + ResolvedPath(domain))
	}
	return ours(sysRoot + ResolverPath(domain))
}

func ours(path string) bool {
	data, err := os.ReadFile(path)
	return err == nil && strings.HasPrefix(string(data), writtenBy)
}

// RemoveResolver takes homelab's resolver for domain off this machine, so
// the network's DNS answers those names again. Nothing there is not an
// error.
func RemoveResolver(domain string) error {
	if !validDomain.MatchString(domain) {
		return fmt.Errorf("%q is not a valid domain name (HOMELAB_DOMAIN)", domain)
	}
	if !ResolverPresent(domain) {
		return nil
	}
	why := "stop looking up your " + domain + " apps in AdGuard Home"
	switch goos {
	case "linux":
		path := sysRoot + ResolvedPath(domain)
		return asRoot("rm -f "+shQuote(path)+" && systemctl restart systemd-resolved", "removing "+path, why)
	case "windows":
		ns := "." + domain
		if err := elevatePS("Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '" + ns + "' -and $_.Comment -eq 'homelab' } | Remove-DnsClientNrptRule -Force; Clear-DnsClientCache"); err != nil {
			return fmt.Errorf("removing the rule for %s: %v", ns, err)
		}
		if ResolverPresent(domain) {
			return fmt.Errorf("the rule for %s was not removed (was the approval declined?)", ns)
		}
		return nil
	}
	path := sysRoot + ResolverPath(domain)
	sh := "/bin/rm -f " + shQuote(path)
	if euid() != 0 && !terminal() {
		// The password window runs the whole script as root, the cache
		// flush too.
		sh += "; " + flushMac
	}
	if err := asRoot(sh, "removing "+path, why); err != nil {
		return err
	}
	if euid() == 0 || terminal() {
		_ = run(exec.Command("sudo", "-n", "dscacheutil", "-flushcache"))
		_ = run(exec.Command("sudo", "-n", "killall", "-HUP", "mDNSResponder"))
	}
	return nil
}
