// Package rootless sets up Docker in the home folder, run by the user
// rather than root (Docker's rootless mode): for SteamOS, whose system
// folders are read-only and replaced by every update, and any Linux without
// Docker. The files are Docker's own static builds and the Compose plugin,
// checked against the checksums below; Docker's setup tool makes the user
// service and the CLI context; what only an administrator can do (the ID
// ranges in /etc/subuid and /etc/subgid, the low ports AdGuard Home and
// the proxy need) is one script, asked for once. /etc and the home folder
// both survive SteamOS updates.
package rootless

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// Version is the Docker set up, and ComposeVersion its Compose plugin.
const (
	Version        = "29.9.2"
	ComposeVersion = "v5.6.1"
)

// A download and its SHA-256.
type file struct{ URL, SHA256 string }

type bundle struct{ Docker, Extras, Compose file }

// Base is where Docker's static builds come from; tests replace it, and
// ComposeBase.
var (
	Base        = "https://download.docker.com/linux/static/stable"
	ComposeBase = "https://github.com/docker/compose/releases/download"
)

// bundles are the files for each processor, as Go names it.
func bundles() map[string]bundle {
	return map[string]bundle{
		"amd64": {
			Docker:  file{Base + "/x86_64/docker-" + Version + ".tgz", "9ac225999fd5e863f7694c728ef23d480616b1e5639328fa309befd4243d69eb"},
			Extras:  file{Base + "/x86_64/docker-rootless-extras-" + Version + ".tgz", "f2663b230a7afc13dea88fc589685331d01f5f3fc458b92ab40e2388db452ed2"},
			Compose: file{ComposeBase + "/" + ComposeVersion + "/docker-compose-linux-x86_64", "47737f4236e6d3ccea7291995203f8f018058783b4c3a9469119811a0b5db8c0"},
		},
		"arm64": {
			Docker:  file{Base + "/aarch64/docker-" + Version + ".tgz", "873b3e0207857c3b2f28392fb922f3ea6efe37620c16d4d4aaf2fef409c90b73"},
			Extras:  file{Base + "/aarch64/docker-rootless-extras-" + Version + ".tgz", "6b7da07c75eee49353657fdc3b9d7e8f4abe44bdd3fd735eaa8e1b0bc3fbc797"},
			Compose: file{ComposeBase + "/" + ComposeVersion + "/docker-compose-linux-aarch64", "42cfa75f51ad0ccf290bad37899e0038a8c10a0069e85233ecc1d53e3ff1347d"},
		},
	}
}

// Dir is where Docker is kept in home; BinDir holds its programs.
func Dir(home string) string {
	return filepath.Join(home, ".local", "share", "homelab-wizard", "docker")
}
func BinDir(home string) string { return filepath.Join(Dir(home), "bin") }

// ComposePlugin is where the docker CLI looks for Compose.
func ComposePlugin(home string) string {
	return filepath.Join(home, ".docker", "cli-plugins", "docker-compose")
}

// Installed reports whether Docker's programs are in home.
func Installed(home string) bool {
	_, err := os.Stat(filepath.Join(BinDir(home), "dockerd-rootless.sh"))
	return err == nil
}

// System is what the checks read; tests replace it.
type System struct {
	ReadFile func(string) ([]byte, error)
	LookPath func(string) (string, error)
	Run      func(name string, args ...string) error
	// CanOpen reports whether this user may read and write a device.
	CanOpen func(string) bool
}

// Host is the running system.
var Host = System{ReadFile: os.ReadFile, LookPath: exec.LookPath, Run: func(name string, args ...string) error { return exec.Command(name, args...).Run() },
	CanOpen: func(p string) bool {
		f, err := os.OpenFile(p, os.O_RDWR, 0)
		if err == nil {
			f.Close()
		}
		return err == nil
	}}

// Check is what rootless Docker needs and whether this system has it.
type Check struct {
	User        string
	UID         int
	NewUIDMap   bool // newuidmap and newgidmap, to map the ID ranges
	IP          bool // the ip command (iproute2), for the containers' network
	Tun         bool // /dev/net/tun, which the containers' network needs open
	SubIDs      bool // ID ranges for the user in /etc/subuid and /etc/subgid
	LowPorts    bool // the user may listen on ports from 53 up (DNS, http, https)
	SystemdUser bool // the user's systemd, for the service
	Linger      bool // the user's services run without a login
}

// Inspect reads what this system has for user.
func (s System) Inspect(user string, uid int) Check {
	c := Check{User: user, UID: uid}
	_, e1 := s.LookPath("newuidmap")
	_, e2 := s.LookPath("newgidmap")
	c.NewUIDMap = e1 == nil && e2 == nil
	// ip often sits in /usr/sbin, outside a user's PATH; rootlesskit finds it there.
	_, err := s.LookPath("ip")
	_, sbin := s.LookPath("/usr/sbin/ip")
	_, bin := s.LookPath("/usr/bin/ip")
	c.IP = err == nil || sbin == nil || bin == nil
	c.Tun = s.CanOpen != nil && s.CanOpen("/dev/net/tun")
	has := func(path string) bool {
		data, err := s.ReadFile(path)
		if err != nil {
			return false
		}
		for _, line := range strings.Split(string(data), "\n") {
			if f := strings.Split(line, ":"); len(f) == 3 && (f[0] == user || f[0] == strconv.Itoa(uid)) {
				return true
			}
		}
		return false
	}
	c.SubIDs = has("/etc/subuid") && has("/etc/subgid")
	if data, err := s.ReadFile("/proc/sys/net/ipv4/ip_unprivileged_port_start"); err == nil {
		n, err := strconv.Atoi(strings.TrimSpace(string(data)))
		c.LowPorts = err == nil && n <= LowestPort
	}
	c.SystemdUser = s.Run("systemctl", "--user", "show-environment") == nil
	_, err = s.ReadFile("/var/lib/systemd/linger/" + user)
	c.Linger = err == nil
	return c
}

// LowestPort is the lowest port the homelab listens on: AdGuard Home's DNS.
const LowestPort = 53

// PortsFile keeps the low ports open to users across restarts.
const PortsFile = "/etc/sysctl.d/90-homelab-ports.conf"

// RootScript is the one script an administrator runs for what c lacks:
// the ID ranges and the low ports. "" when nothing is lacking.
func (c Check) RootScript() string {
	var steps []string
	if !c.SubIDs {
		// The usual range, after any a user already has.
		u := shellQuote(c.User)
		steps = append(steps,
			"grep -q '^'"+u+"':' /etc/subuid 2>/dev/null || echo "+u+":100000:65536 >> /etc/subuid",
			"grep -q '^'"+u+"':' /etc/subgid 2>/dev/null || echo "+u+":100000:65536 >> /etc/subgid")
	}
	if !c.LowPorts {
		steps = append(steps,
			"mkdir -p /etc/sysctl.d",
			"echo 'net.ipv4.ip_unprivileged_port_start="+strconv.Itoa(LowestPort)+"' > "+PortsFile,
			"sysctl -w net.ipv4.ip_unprivileged_port_start="+strconv.Itoa(LowestPort))
	}
	for i, st := range steps {
		steps[i] = "{ " + st + "; }"
	}
	return strings.Join(steps, " && ")
}

func shellQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'" }

// Problems are what c lacks that nothing here can put right.
func (c Check) Problems() []string {
	var out []string
	if !c.NewUIDMap {
		out = append(out, "newuidmap and newgidmap are not installed (the uidmap or shadow package)")
	}
	if !c.IP {
		out = append(out, "the ip command is not installed (the iproute2 package)")
	}
	if !c.Tun {
		out = append(out, "this account cannot open /dev/net/tun, which the containers' network needs")
	}
	if !c.SystemdUser {
		out = append(out, "there is no systemd for this user (systemctl --user), which runs Docker as a service")
	}
	return out
}

// Download fetches Docker and Compose for goarch into home, checks each
// against its checksum, and unpacks them: Docker's programs into BinDir,
// Compose where the docker CLI looks for it. A file that does not match
// stops it before anything is unpacked.
func Download(ctx context.Context, home, goarch string, client *http.Client, say func(string)) error {
	b, ok := bundles()[goarch]
	if !ok {
		return fmt.Errorf("Docker's builds are for 64-bit Intel or AMD and ARM processors, not %s", goarch)
	}
	return download(ctx, home, b, client, say)
}

func download(ctx context.Context, home string, b bundle, client *http.Client, say func(string)) error {
	if client == nil {
		client = http.DefaultClient
	}
	tmp, err := os.MkdirTemp("", "homelab-docker-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)
	got := map[string]string{}
	for _, f := range []struct {
		what string
		file
	}{{"Docker " + Version, b.Docker}, {"Docker's rootless tools", b.Extras}, {"Compose " + ComposeVersion, b.Compose}} {
		say("Downloading " + f.what)
		path := filepath.Join(tmp, filepath.Base(f.URL))
		if err := fetch(ctx, client, f.URL, f.SHA256, path); err != nil {
			return fmt.Errorf("%s: %w", f.what, err)
		}
		got[f.URL] = path
	}
	say("Unpacking")
	bin := BinDir(home)
	if err := os.MkdirAll(bin, 0o755); err != nil {
		return err
	}
	for _, f := range []file{b.Docker, b.Extras} {
		if err := untar(got[f.URL], bin); err != nil {
			return err
		}
	}
	plugin := ComposePlugin(home)
	if err := os.MkdirAll(filepath.Dir(plugin), 0o755); err != nil {
		return err
	}
	return copyFile(got[b.Compose.URL], plugin, 0o755)
}

// fetch downloads url to path and checks its SHA-256.
func fetch(ctx context.Context, client *http.Client, url, want, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: %s", url, resp.Status)
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	h := sha256.New()
	if _, err := io.Copy(io.MultiWriter(f, h), resp.Body); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if sum := hex.EncodeToString(h.Sum(nil)); sum != want {
		return fmt.Errorf("the download does not match its checksum (got %s, want %s); nothing was installed", sum, want)
	}
	return nil
}

// untar unpacks the regular files of a .tgz into dir, without the folder
// they are in (docker/dockerd → dir/dockerd).
func untar(path, dir string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	zr, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	tr := tar.NewReader(zr)
	for {
		h, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		if h.Typeflag != tar.TypeReg {
			continue
		}
		name := filepath.Base(h.Name)
		if name == "." || name == "/" || strings.ContainsAny(name, `/\`) {
			continue
		}
		out, err := os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
		if err != nil {
			return err
		}
		// #nosec G110 -- Docker's own archive, checked against its checksum first
		if _, err := io.Copy(out, tr); err != nil {
			out.Close()
			return err
		}
		if err := out.Close(); err != nil {
			return err
		}
	}
}

func copyFile(from, to string, mode os.FileMode) error {
	data, err := os.ReadFile(from)
	if err != nil {
		return err
	}
	return os.WriteFile(to, data, mode)
}

// SetupCommand is Docker's setup tool, which makes the user service
// (systemctl --user docker), starts it, and points the docker CLI at it
// (the "rootless" context).
func SetupCommand(ctx context.Context, home string) *exec.Cmd {
	bin := BinDir(home)
	c := exec.CommandContext(ctx, filepath.Join(bin, "dockerd-rootless-setuptool.sh"), "install")
	c.Env = append(os.Environ(), "PATH="+bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	return c
}
