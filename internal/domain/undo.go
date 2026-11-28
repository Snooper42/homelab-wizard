package domain

import (
	"fmt"
	"net/netip"
	"os"
	"os/exec"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// Taking back what SetResolver did: the Mac's resolver file, the
// systemd-resolved drop-in, or the Name Resolution Policy Table rule
// removed, asking for the administrator once. Only what homelab wrote is
// removed: a file without its first line stays, and so does a rule with
// someone's own comment or sending the names to a public server. An older
// homelab wrote its Windows rule without a comment: a rule for the domain
// with none that sends it only to home-network addresses counts as
// homelab's (the owner's PC, Nov 28: .snooper42.com → 10.0.0.242, left once
// the PC stopped being the homelab's host, broke every name under it).

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
		for _, r := range nrptRules(domain) {
			if r.homelabs() {
				return true
			}
		}
		return false
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
		named := "$_.Comment -eq 'homelab'"
		for _, r := range nrptRules(domain) {
			if r.homelabs() && r.comment == "" {
				// An older homelab's: no comment, named by its servers
				// (home-network addresses, checked, so nothing else).
				named += " -or ([string]::IsNullOrEmpty($_.Comment) -and (($_.NameServers -join ',') -eq '" + strings.Join(r.servers, ",") + "'))"
			}
		}
		if err := elevatePS("Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '" + ns + "' -and (" + named + ") } | Remove-DnsClientNrptRule -Force; Clear-DnsClientCache"); err != nil {
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

// nrptRule is one of the Name Resolution Policy Table's rules for a domain.
type nrptRule struct {
	comment string
	servers []string
}

// nrptRules are the Name Resolution Policy Table's rules for domain.
func nrptRules(domain string) []nrptRule {
	var out strings.Builder
	c := procattr.Hide(exec.Command("powershell.exe", "-NoProfile", "-Command",
		"Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '."+domain+"' } | ForEach-Object { [string]$_.Comment + '|' + ($_.NameServers -join ',') }"))
	c.Stdout = &out
	if run(c) != nil {
		return nil
	}
	var rules []nrptRule
	for _, line := range strings.Split(out.String(), "\n") {
		comment, servers, ok := strings.Cut(strings.TrimSpace(line), "|")
		if !ok {
			continue
		}
		r := nrptRule{comment: comment}
		for _, s := range strings.Split(servers, ",") {
			if s = strings.TrimSpace(s); s != "" {
				r.servers = append(r.servers, s)
			}
		}
		rules = append(rules, r)
	}
	return rules
}

// homelabs is whether r is homelab's: its comment, or, from an older homelab
// that wrote none, no comment and only home-network addresses.
func (r nrptRule) homelabs() bool {
	if r.comment == "homelab" {
		return true
	}
	if r.comment != "" || len(r.servers) == 0 {
		return false
	}
	for _, s := range r.servers {
		a, err := netip.ParseAddr(s)
		if err != nil || a.Zone() != "" || !(a.IsPrivate() || a.IsLoopback() || a.IsLinkLocalUnicast()) {
			return false
		}
	}
	return true
}
