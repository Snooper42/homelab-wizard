// Package ports plans host ports for an install: it finds conflicts with
// running containers, other host listeners, and the rest of the plan, and
// moves conflicting apps to free ports through their .env variables.
package ports

import (
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"syscall"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// Prober reports whether a host port is free.
type Prober interface {
	Free(ip string, port int, proto string) bool
}

// HostProber probes by binding, plus macOS netstat to catch wildcard
// listeners (such as AirPlay Receiver on 5000/7000) that a bind to
// 127.0.0.1 can miss under BSD socket rules.
type HostProber struct {
	listeners map[int]bool
}

// NewHostProber snapshots TCP listeners once.
func NewHostProber() *HostProber {
	p := &HostProber{listeners: map[int]bool{}}
	out, err := procattr.Hide(exec.Command("netstat", "-an", "-p", "tcp")).Output()
	if err == nil {
		re := regexp.MustCompile(`(?m)^\s*tcp\S*\s+\d+\s+\d+\s+\S+\.(\d+)\s+\S+\s+LISTEN`)
		for _, m := range re.FindAllStringSubmatch(string(out), -1) {
			if n, err := strconv.Atoi(m[1]); err == nil {
				p.listeners[n] = true
			}
		}
	}
	return p
}

// Free implements Prober.
func (p *HostProber) Free(ip string, port int, proto string) bool {
	if ip == "" {
		ip = "0.0.0.0"
	}
	addr := net.JoinHostPort(ip, strconv.Itoa(port))
	if proto == "udp" {
		c, err := net.ListenPacket("udp", addr)
		if err != nil {
			return privileged(err) && !procHolds(ip, port, proto)
		}
		c.Close()
		return true
	}
	if p.listeners[port] {
		return false
	}
	l, err := net.Listen("tcp", addr)
	if err != nil {
		return privileged(err) && !procHolds(ip, port, proto)
	}
	l.Close()
	return true
}

// privileged reports whether a bind failed only because the port is below
// the ones this account may bind (1024 on Linux): Docker publishes as root,
// so that says nothing about the port being in use.
func privileged(err error) bool { return errors.Is(err, syscall.EACCES) }

// procHolds reports whether a socket in Linux's /proc/net tables holds
// port where a bind to ip would collide: a TCP listener, or any UDP
// socket. Elsewhere the tables are missing, and nothing is found.
func procHolds(ip string, port int, proto string) bool {
	for _, f := range []string{"/proc/net/" + proto, "/proc/net/" + proto + "6"} {
		if data, err := os.ReadFile(f); err == nil && holds(string(data), ip, port, proto == "tcp") {
			return true
		}
	}
	return false
}

// holds reads one /proc/net table: each row's local address is hex
// ("0100007F:0035" is 127.0.0.1:53, IPv4 in little-endian order), and
// state 0A is LISTEN.
func holds(table, ip string, port int, tcp bool) bool {
	want := net.ParseIP(ip)
	for _, line := range strings.Split(table, "\n")[1:] {
		f := strings.Fields(line)
		if len(f) < 4 || (tcp && f[3] != "0A") {
			continue
		}
		hexIP, hexPort, ok := strings.Cut(f[1], ":")
		if n, err := strconv.ParseUint(hexPort, 16, 16); !ok || err != nil || int(n) != port {
			continue
		}
		b, err := hex.DecodeString(hexIP)
		if err != nil || (len(b) != 4 && len(b) != 16) {
			continue
		}
		for i := 0; i+4 <= len(b); i += 4 { // each 32-bit word is little-endian
			b[i], b[i+1], b[i+2], b[i+3] = b[i+3], b[i+2], b[i+1], b[i]
		}
		held := net.IP(b)
		if held.IsUnspecified() || want == nil || want.IsUnspecified() || held.Equal(want) {
			return true
		}
	}
	return false
}

// Binding is one resolved host port of an app.
type Binding struct {
	App       *catalog.App
	Var       string // controlling variable, "" for literal ports
	HostIP    string
	HostPort  int
	Container int
	Protocol  string
}

// Change is a port move written to .env.
type Change struct {
	Var    string
	From   int
	To     int
	Reason string
}

// Plan is the port outcome for an install.
type Plan struct {
	Bindings []Binding
	Changes  []Change
	Problems []string
}

// Input bundles what the planner needs.
type Input struct {
	Apps    []*catalog.App // apps that will be started
	Env     map[string]string
	Report  *detect.Report
	Prober  Prober
	MaxPort int // highest port to try (default 65000)
}

// Resolve plans host ports for the apps.
func Resolve(in Input) *Plan {
	plan := &Plan{}
	if in.MaxPort == 0 {
		in.MaxPort = 65000
	}
	env := map[string]string{}
	for k, v := range in.Env {
		env[k] = v
	}
	starting := map[string]bool{}
	for _, a := range in.Apps {
		starting[a.ID] = true
	}
	owners := in.Report.PublishedPorts()
	claimed := map[string]string{} // port/proto -> app id claiming it in this plan
	// Ports held by apps that keep running claim their ports first.
	for key, o := range owners {
		if o.App != nil {
			claimed[key] = o.App.ID
		} else {
			claimed[key] = "container " + o.Container.Name
		}
	}
	movedVar := map[string]bool{}

	for _, a := range in.Apps {
		for _, p := range a.Ports {
			r, err := p.Resolve(compose.MapLookup(env))
			if err != nil {
				plan.Problems = append(plan.Problems, fmt.Sprintf("%s: %v", a.ID, err))
				continue
			}
			if r.HostPort == 0 {
				continue // ephemeral
			}
			varName, _, hasVar := p.HostVar()
			key := detect.PortKey(r.HostPort, r.Protocol)
			holder, taken := claimed[key]
			sameApp := taken && holder == a.ID
			conflict := taken && !sameApp
			if !taken {
				// Not held by a container we know about: ask the OS.
				if !in.Prober.Free(r.HostIP, r.HostPort, r.Protocol) {
					conflict, holder = true, "another program on this machine"
				}
			}
			if conflict && hasVar && movedVar[varName] {
				// Another binding of this variable already moved it; re-resolve.
				r, _ = p.Resolve(compose.MapLookup(env))
				key = detect.PortKey(r.HostPort, r.Protocol)
				conflict = false
			}
			if conflict {
				if !hasVar {
					plan.Problems = append(plan.Problems, fmt.Sprintf("%s needs fixed host port %s, which is used by %s", a.ID, key, holder))
					continue
				}
				next := findFree(r.HostPort+1, r.HostIP, r.Protocol, in.MaxPort, claimed, in.Prober)
				if next == 0 {
					plan.Problems = append(plan.Problems, fmt.Sprintf("%s: no free port found for %s", a.ID, varName))
					continue
				}
				plan.Changes = append(plan.Changes, Change{Var: varName, From: r.HostPort, To: next, Reason: fmt.Sprintf("%d/%s is used by %s", r.HostPort, r.Protocol, holder)})
				env[varName] = strconv.Itoa(next)
				movedVar[varName] = true
				r.HostPort = next
				key = detect.PortKey(next, r.Protocol)
			}
			claimed[key] = a.ID
			plan.Bindings = append(plan.Bindings, Binding{App: a, Var: varName, HostIP: r.HostIP, HostPort: r.HostPort, Container: r.Container, Protocol: r.Protocol})
		}
	}
	sort.SliceStable(plan.Changes, func(i, j int) bool { return plan.Changes[i].Var < plan.Changes[j].Var })
	return plan
}

func findFree(start int, ip, proto string, max int, claimed map[string]string, prober Prober) int {
	for port := start; port <= max; port++ {
		if _, taken := claimed[detect.PortKey(port, proto)]; taken {
			continue
		}
		if prober.Free(ip, port, proto) {
			return port
		}
	}
	return 0
}

// WebURL returns the local URL for an app's UI given its bindings. Apps that
// share another container's network (qBittorrent behind Gluetun) publish
// their UI through that container.
func WebURL(a *catalog.App, bindings []Binding, lookup compose.Lookup) string {
	if n := a.Native(); n != nil {
		return fmt.Sprintf("http://localhost:%d", n.Port)
	}
	web := a.WebContainerPort(lookup)
	if web == 0 {
		return ""
	}
	for _, b := range bindings {
		if b.App.ID != a.ID && b.App.ID != a.ProxyTarget() {
			continue
		}
		if b.Container == web && b.Protocol == "tcp" {
			host := b.HostIP
			if host == "" || host == "0.0.0.0" || host == "127.0.0.1" {
				host = "localhost"
			}
			url := fmt.Sprintf("http://%s:%d", host, b.HostPort)
			if p := a.WebPath(); p != "/" {
				url += p
			}
			return url
		}
	}
	return ""
}

// AppBindings resolves an app's ports without planning (for status output).
func AppBindings(a *catalog.App, lookup compose.Lookup) []Binding {
	var out []Binding
	for _, p := range a.Ports {
		r, err := p.Resolve(lookup)
		if err != nil || r.HostPort == 0 {
			continue
		}
		name, _, _ := p.HostVar()
		out = append(out, Binding{App: a, Var: name, HostIP: r.HostIP, HostPort: r.HostPort, Container: r.Container, Protocol: strings.ToLower(r.Protocol)})
	}
	return out
}
