// Package docker talks to the container runtime through the docker CLI, which
// works the same with OrbStack, Docker Desktop, and Colima; the reads it
// makes all the time go to the engine's API when its socket is found (api.go).
package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/dockerapi"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/rootless"
)

// Runner executes commands. Swapped out in tests.
type Runner interface {
	// Output runs a command and returns stdout.
	Output(ctx context.Context, name string, args ...string) ([]byte, error)
	// Stream runs a command connected to the terminal.
	Stream(ctx context.Context, dir, name string, args ...string) error
	// Pipe runs a command with stdout written to w.
	Pipe(ctx context.Context, w io.Writer, name string, args ...string) error
}

// ExecRunner runs real processes.
type ExecRunner struct {
	Stdout, Stderr io.Writer
}

// Output implements Runner.
func (r ExecRunner) Output(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := procattr.Hide(exec.CommandContext(ctx, name, args...))
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return out, fmt.Errorf("%s %s: %s", filepath.Base(name), strings.Join(args, " "), msg)
	}
	return out, nil
}

// Stream implements Runner.
func (r ExecRunner) Stream(ctx context.Context, dir, name string, args ...string) error {
	cmd := procattr.Hide(exec.CommandContext(ctx, name, args...))
	cmd.Dir = dir
	cmd.Stdin = os.Stdin
	cmd.Stdout, cmd.Stderr = r.Stdout, r.Stderr
	if cmd.Stdout == nil {
		cmd.Stdout = os.Stdout
	}
	if cmd.Stderr == nil {
		cmd.Stderr = os.Stderr
	}
	// The end of what it printed, for why it failed: compose prints its
	// progress and its errors to stderr.
	tail := &tailBuffer{max: 8 << 10}
	cmd.Stderr = io.MultiWriter(cmd.Stderr, tail)
	err := cmd.Run()
	if err != nil {
		if _, ok := briefLimit(tail.String()); ok {
			return fmt.Errorf("%w (%w)", ErrRegistryBusy, err)
		}
		if why := Why(tail.String()); why != "" {
			return fmt.Errorf("%s (%w)", why, err)
		}
	}
	return err
}

// ErrRegistryBusy is a registry asking to wait a moment between downloads
// (toomanyrequests, with a retry-after of seconds or less): not the hourly
// limit, so Compose tries again by itself.
var ErrRegistryBusy = errors.New("the image registry is spacing out downloads; try again in a few minutes")

// retryAfter is a rate limit's wait in docker's output, as GitHub's and
// lscr.io's registries give it: "toomanyrequests: retry-after: 751.197µs".
var retryAfter = regexp.MustCompile(`(?i)toomanyrequests: retry-after: ([0-9.]+(?:ns|µs|us|ms|s|m))`)

// briefLimit reports a rate limit that asks to wait a minute or less.
func briefLimit(out string) (time.Duration, bool) {
	m := retryAfter.FindStringSubmatch(out)
	if m == nil {
		return 0, false
	}
	d, err := time.ParseDuration(strings.ReplaceAll(m[1], "µs", "us"))
	return d, err == nil && d <= time.Minute
}

// registryBusyWaits are how long Compose waits before each try again after
// ErrRegistryBusy: a little longer each time.
var registryBusyWaits = []time.Duration{5 * time.Second, 15 * time.Second, 30 * time.Second}

// tailBuffer keeps the last max bytes written to it.
type tailBuffer struct {
	max int
	buf []byte
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	t.buf = append(t.buf, p...)
	if len(t.buf) > t.max {
		t.buf = append([]byte(nil), t.buf[len(t.buf)-t.max:]...)
	}
	return len(p), nil
}

func (t *tailBuffer) String() string { return string(t.buf) }

var (
	errorLine = regexp.MustCompile(`(?i)\b(error|failed|denied|forbidden|unauthorized|toomanyrequests|too many requests|no such host|not found)\b`)
	queryPart = regexp.MustCompile(`\?[^\s"']*`)
	urlHost   = regexp.MustCompile(`https?://([^/\s"']+)`)
	// The host port in docker's "port taken" errors: "Bind for 0.0.0.0:4533
	// failed", "exposing port UDP 0.0.0.0:53", "host port for 0.0.0.0:53:…".
	takenPort = regexp.MustCompile(`(?i)(?:bind for|exposing port (?:tcp|udp)|host port for) [\d.]*:(\d+)`)
)

// goos is the system plainWhy advises for; tests replace it.
var goos = runtime.GOOS

// Why is the reason in docker's output, in a line: in plain words for the
// usual causes (a download rate limited or refused, a registry out of
// reach), wherever compose printed it, since a cancelled pull's "No such
// image" can follow it; else the last line that names an error, without the
// long signed query of a download address. "" when there is none.
func Why(out string) string {
	lines := strings.Split(strings.TrimSpace(out), "\n")
	last := ""
	for i := len(lines) - 1; i >= 0; i-- {
		l := strings.TrimSpace(lines[i])
		if !errorLine.MatchString(l) {
			continue
		}
		if why := plainWhy(l); why != "" {
			return why
		}
		if last == "" {
			last = l
		}
	}
	if last == "" {
		return ""
	}
	last = queryPart.ReplaceAllString(last, "")
	if len(last) > 240 {
		last = last[:240] + "…"
	}
	return last
}

// plainWhy is a docker error line in plain words, for the usual causes; "" otherwise.
func plainWhy(line string) string {
	host := ""
	if m := urlHost.FindStringSubmatch(line); m != nil {
		host = m[1]
	}
	low := strings.ToLower(line)
	switch {
	case strings.Contains(low, "toomanyrequests") || strings.Contains(low, "too many requests"):
		if strings.Contains(low, "docker.io") || strings.Contains(low, "pull rate limit") {
			return "Docker Hub's download limit for this internet connection was reached; try again in an hour, or sign in with docker login (a free Docker account) for a higher limit"
		}
		return "the image registry's download limit was reached; try again in an hour"
	case host != "" && (strings.Contains(low, "forbidden") || strings.Contains(low, "denied") || strings.Contains(low, "unauthorized")):
		return "the image download from " + host + " was refused (a firewall, proxy, or the registry itself)"
	case host != "" && (strings.Contains(low, "no such host") || strings.Contains(low, "i/o timeout") || strings.Contains(low, "connection refused")):
		return "could not reach " + host + "; check the internet connection"
	case strings.Contains(low, "port is already allocated") || strings.Contains(low, "address already in use") || strings.Contains(low, "only one usage of each socket address") || strings.Contains(low, "ports are not available"):
		m := takenPort.FindStringSubmatch(line)
		if m == nil {
			return "a port the app needs is taken by another program on this machine"
		}
		if m[1] == "53" && goos == "windows" {
			return "port 53 (DNS), which AdGuard Home needs, is taken by Windows' Internet Connection Sharing (the Mobile hotspot service): in PowerShell as administrator run Set-Service SharedAccess -StartupType Disabled, then restart the PC"
		}
		if m[1] == "53" {
			return "port 53 (DNS), which AdGuard Home needs, is taken by another program on this machine (another DNS server or ad blocker); stop it, then try again"
		}
		return "port " + m[1] + " is taken by another program on this machine: stop that program, or give the app another port in Settings"
	}
	return ""
}

// Pipe implements Runner.
func (r ExecRunner) Pipe(ctx context.Context, w io.Writer, name string, args ...string) error {
	cmd := procattr.Hide(exec.CommandContext(ctx, name, args...))
	var stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = w, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("%s %s: %s", filepath.Base(name), strings.Join(args, " "), msg)
	}
	return nil
}

// Client wraps the docker CLI.
type Client struct {
	Runner Runner
	Bin    string
	// Progress is how Compose reports its work in Compose: "" for its
	// usual lines, "json" for one JSON object per step, which the app reads
	// into a row per app (internal/progress). Set it only where
	// JSONProgress says Compose can.
	Progress string
	// API is the engine's API, for the reads (api.go); nil uses the CLI.
	API *dockerapi.Client
}

// ErrNoDocker means no docker CLI was found.
var ErrNoDocker = errors.New("docker CLI not found")

// FindCLI locates docker, including OrbStack and Docker Desktop install paths
// that are missing from PATH when launched from Finder.
func FindCLI() (string, error) {
	if p, err := exec.LookPath("docker"); err == nil {
		return p, nil
	}
	home, _ := os.UserHomeDir()
	for _, p := range []string{
		filepath.Join(home, ".orbstack", "bin", "docker"),
		filepath.Join(rootless.BinDir(home), "docker"), // homelab runtime install
		filepath.Join(home, ".local", "bin", "docker"),
		filepath.Join(home, "bin", "docker"),
		"/opt/homebrew/bin/docker",
		"/usr/local/bin/docker",
		"/Applications/Docker.app/Contents/Resources/bin/docker",
		filepath.Join(os.Getenv("ProgramFiles"), "Docker", "Docker", "resources", "bin", "docker.exe"),
	} {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
	}
	return "", ErrNoDocker
}

// New returns a client for the docker CLI found on this machine.
func New() (*Client, error) {
	bin, err := FindCLI()
	if err != nil {
		return nil, err
	}
	return WithAPI(&Client{Runner: ExecRunner{}, Bin: bin}), nil
}

// NoAccess reports whether err is the engine refusing this account, which
// is not in the docker group (Linux) or docker-users (Windows): it is
// running, so starting it does not help.
func NoAccess(err error) bool {
	for ; err != nil; err = errors.Unwrap(err) {
		low := strings.ToLower(err.Error())
		if (strings.Contains(low, "permission denied") || strings.Contains(low, "access is denied")) &&
			(strings.Contains(low, "docker") || strings.Contains(low, "pipe")) {
			return true
		}
	}
	return false
}

// Explained is an error shown in plainer words (Msg) that still wraps the
// engine's own (Err), so NoAccess can tell what it was.
type Explained struct {
	Msg string
	Err error
}

func (e Explained) Error() string { return e.Msg }
func (e Explained) Unwrap() error { return e.Err }

// Info describes the engine.
type Info struct {
	ServerVersion   string `json:"ServerVersion"`
	OperatingSystem string `json:"OperatingSystem"`
	Name            string `json:"Name"`
	Architecture    string `json:"Architecture"`
	NCPU            int    `json:"NCPU"`
	MemTotal        int64  `json:"MemTotal"`
	// SecurityOptions are the engine's: "name=seccomp,profile=builtin",
	// "name=selinux", ...
	SecurityOptions []string `json:"SecurityOptions"`
}

// SELinux reports whether the engine gives containers SELinux labels, as
// Fedora's moby-engine does: they then cannot read host folders that are
// not labelled for containers.
func (i Info) SELinux() bool {
	for _, o := range i.SecurityOptions {
		if slices.Contains(strings.Split(o, ","), "name=selinux") {
			return true
		}
	}
	return false
}

// Runtime names the engine provider.
func (i Info) Runtime() string {
	switch os := strings.ToLower(i.OperatingSystem); {
	case strings.Contains(os, "orbstack"):
		return "OrbStack"
	case strings.Contains(os, "docker desktop"):
		return "Docker Desktop"
	case strings.Contains(strings.ToLower(i.Name), "colima"):
		return "Colima"
	case runtime.GOOS == "linux":
		// Docker Engine itself: it reports the host's own system
		// ("Ubuntu 24.04.5 LTS"), which is not the engine's name.
		return "Docker Engine"
	case i.OperatingSystem != "":
		return i.OperatingSystem
	}
	return "unknown"
}

// Info returns engine information; an error means the engine is not running.
func (c *Client) Info(ctx context.Context) (Info, error) {
	if info, ok := c.apiInfo(ctx); ok {
		return info, nil
	}
	var info Info
	out, err := c.Runner.Output(ctx, c.Bin, "info", "--format", "{{json .}}")
	if err != nil {
		return info, err
	}
	if err := json.Unmarshal(bytes.TrimSpace(out), &info); err != nil {
		return info, fmt.Errorf("docker info: %w", err)
	}
	return info, nil
}

// Usage is one line of `docker system df`: what the engine keeps on disk
// for one kind of object, and how much of it nothing uses.
type Usage struct {
	Type        string `json:"Type"`        // Images, Containers, Local Volumes, Build Cache
	Size        string `json:"Size"`        // "24.1GB"
	Reclaimable string `json:"Reclaimable"` // "12.3GB (51%)"
}

// Unused is the reclaimable size without its share: "12.3GB".
func (u Usage) Unused() string {
	s, _, _ := strings.Cut(u.Reclaimable, " ")
	return s
}

// DiskUsage reads `docker system df`.
func (c *Client) DiskUsage(ctx context.Context) ([]Usage, error) {
	out, err := c.Runner.Output(ctx, c.Bin, "system", "df", "--format", "{{json .}}")
	if err != nil {
		return nil, err
	}
	return ParseDiskUsage(out)
}

// ParseDiskUsage reads `docker system df --format {{json .}}`, one object
// per line.
func ParseDiskUsage(out []byte) ([]Usage, error) {
	var usage []Usage
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var u Usage
		if err := json.Unmarshal([]byte(line), &u); err != nil {
			return nil, fmt.Errorf("docker system df: %w", err)
		}
		usage = append(usage, u)
	}
	return usage, nil
}

// ComposeVersion returns the compose plugin version.
func (c *Client) ComposeVersion(ctx context.Context) (string, error) {
	out, err := c.Runner.Output(ctx, c.Bin, "compose", "version", "--short")
	return strings.TrimSpace(string(out)), err
}

// Event is one change the engine reports about a container (`docker
// events`): it was created, started, stopped, died, removed, or its health
// changed ("health_status: healthy").
type Event struct {
	Action string `json:"Action"`
	Actor  struct {
		ID         string            `json:"ID"`
		Attributes map[string]string `json:"Attributes"`
	} `json:"Actor"`
}

// Service is the Compose service the event is about, or the container's
// name when Compose did not make it.
func (e Event) Service() string {
	if s := e.Actor.Attributes["com.docker.compose.service"]; s != "" {
		return s
	}
	return e.Actor.Attributes["name"]
}

// eventActions are the container events that change what Status shows; a
// health check runs an exec every few seconds, which is left out.
var eventActions = []string{"create", "start", "restart", "stop", "die", "kill", "destroy", "pause", "unpause", "rename", "health_status"}

// Events follows the engine's container events, calling fn for each, until
// ctx ends or the engine stops (which returns its error).
func (c *Client) Events(ctx context.Context, fn func(Event)) error {
	if err, ok := c.apiEvents(ctx, fn); ok {
		return err
	}
	args := []string{"events", "--format", "{{json .}}", "--filter", "type=container"}
	for _, a := range eventActions {
		args = append(args, "--filter", "event="+a)
	}
	w := &lineSplitter{line: func(line []byte) {
		var e Event
		if json.Unmarshal(line, &e) == nil && e.Action != "" && !strings.HasPrefix(e.Action, "exec_") {
			fn(e)
		}
	}}
	return c.Runner.Pipe(ctx, w, c.Bin, args...)
}

// lineSplitter calls line for each complete line written to it.
type lineSplitter struct {
	line func([]byte)
	buf  []byte
}

func (l *lineSplitter) Write(p []byte) (int, error) {
	l.buf = append(l.buf, p...)
	for {
		i := bytes.IndexByte(l.buf, '\n')
		if i < 0 {
			return len(p), nil
		}
		if line := bytes.TrimSpace(l.buf[:i]); len(line) > 0 {
			l.line(line)
		}
		l.buf = l.buf[i+1:]
	}
}

// PublishedPort is a host port bound by a container.
type PublishedPort struct {
	HostIP   string
	HostPort int
	Port     int // container port
	Protocol string
}

// Container is the subset of docker inspect the CLI uses.
type Container struct {
	ID      string
	Name    string
	Image   string // what it was started from, e.g. lscr.io/linuxserver/sonarr:latest
	ImageID string // the image it runs, sha256:…
	State   string
	Running bool
	Health  string // "healthy", "unhealthy", "starting", or "" without a healthcheck
	Labels  map[string]string
	Ports   []PublishedPort
	// StartedAt is when the container last started; Restarts counts the
	// times its restart policy restarted it (a crash loop shows here).
	StartedAt time.Time
	Restarts  int
	// Why it last stopped: the error Docker gave when it could not start it
	// (a missing folder, say), and its exit code.
	Error    string
	ExitCode int
	// RestartPolicy is "unless-stopped", "always", "no", or "on-failure".
	RestartPolicy string
	// Binds are the folders on this machine mounted into it.
	Binds []string
	// Mounts are its folders and named volumes, with where they appear
	// inside and whether it can write to them.
	Mounts []Mount
}

// Mount is one of a container's mounts: a folder on this machine (bind,
// Source) or a named volume (volume, Name).
type Mount struct {
	Type     string
	Name     string
	Source   string
	Target   string
	Writable bool
}

// Project returns the compose project label.
func (c Container) Project() string { return c.Labels["com.docker.compose.project"] }

// Service returns the compose service label.
func (c Container) Service() string { return c.Labels["com.docker.compose.service"] }

// Containers lists every container (running or not).
func (c *Client) Containers(ctx context.Context) ([]Container, error) {
	if cs, ok := c.apiContainers(ctx); ok {
		return cs, nil
	}
	out, err := c.Runner.Output(ctx, c.Bin, "ps", "--all", "--quiet", "--no-trunc")
	if err != nil {
		return nil, err
	}
	ids := strings.Fields(string(out))
	if len(ids) == 0 {
		return nil, nil
	}
	data, err := c.Runner.Output(ctx, c.Bin, append([]string{"inspect"}, ids...)...)
	if err != nil {
		return nil, err
	}
	return ParseInspect(data)
}

// ParseInspect decodes `docker inspect` output.
func ParseInspect(data []byte) ([]Container, error) {
	var raw []struct {
		ID           string `json:"Id"`
		Name         string `json:"Name"`
		ImageID      string `json:"Image"`
		RestartCount int    `json:"RestartCount"`
		HostConfig   struct {
			RestartPolicy struct {
				Name string `json:"Name"`
			} `json:"RestartPolicy"`
		} `json:"HostConfig"`
		Mounts []struct {
			Type        string `json:"Type"`
			Name        string `json:"Name"`
			Source      string `json:"Source"`
			Destination string `json:"Destination"`
			RW          bool   `json:"RW"`
		} `json:"Mounts"`
		Config struct {
			Image  string            `json:"Image"`
			Labels map[string]string `json:"Labels"`
		} `json:"Config"`
		State struct {
			Status    string `json:"Status"`
			Running   bool   `json:"Running"`
			StartedAt string `json:"StartedAt"`
			Error     string `json:"Error"`
			ExitCode  int    `json:"ExitCode"`
			Health    *struct {
				Status string `json:"Status"`
			} `json:"Health"`
		} `json:"State"`
		NetworkSettings struct {
			Ports map[string][]struct {
				HostIP   string `json:"HostIp"`
				HostPort string `json:"HostPort"`
			} `json:"Ports"`
		} `json:"NetworkSettings"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("docker inspect: %w", err)
	}
	out := make([]Container, 0, len(raw))
	for _, r := range raw {
		c := Container{
			ID:       r.ID,
			Name:     strings.TrimPrefix(r.Name, "/"),
			Image:    r.Config.Image,
			ImageID:  r.ImageID,
			State:    r.State.Status,
			Running:  r.State.Running,
			Labels:   r.Config.Labels,
			Restarts: r.RestartCount,
			Error:    r.State.Error,
			ExitCode: r.State.ExitCode,

			RestartPolicy: r.HostConfig.RestartPolicy.Name,
		}
		for _, m := range r.Mounts {
			if m.Type == "bind" && m.Source != "" {
				c.Binds = append(c.Binds, m.Source)
			}
			c.Mounts = append(c.Mounts, Mount{Type: m.Type, Name: m.Name, Source: m.Source, Target: m.Destination, Writable: m.RW})
		}
		// A container that never started reports 0001-01-01.
		if t, err := time.Parse(time.RFC3339Nano, r.State.StartedAt); err == nil && t.Year() > 1 {
			c.StartedAt = t
		}
		if r.State.Health != nil {
			c.Health = r.State.Health.Status
		}
		if c.Labels == nil {
			c.Labels = map[string]string{}
		}
		keys := make([]string, 0, len(r.NetworkSettings.Ports))
		for k := range r.NetworkSettings.Ports {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			portStr, proto, _ := strings.Cut(k, "/")
			cport, _ := strconv.Atoi(portStr)
			for _, b := range r.NetworkSettings.Ports[k] {
				hp, err := strconv.Atoi(b.HostPort)
				if err != nil || hp == 0 {
					continue
				}
				c.Ports = append(c.Ports, PublishedPort{HostIP: b.HostIP, HostPort: hp, Port: cport, Protocol: proto})
			}
		}
		out = append(out, c)
	}
	return out, nil
}

// EnsureNetwork creates an external network if it does not exist yet.
func (c *Client) EnsureNetwork(ctx context.Context, name string) (created bool, err error) {
	if _, err := c.Runner.Output(ctx, c.Bin, "network", "inspect", name); err == nil {
		return false, nil
	}
	if _, err := c.Runner.Output(ctx, c.Bin, "network", "create", name); err != nil {
		return false, err
	}
	return true, nil
}

// Tag gives an image (by ID or reference) another reference.
func (c *Client) Tag(ctx context.Context, image, ref string) error {
	_, err := c.Runner.Output(ctx, c.Bin, "image", "tag", image, ref)
	return err
}

// ImageID is the ID of the image a reference names on this machine now
// (after a pull, the new one).
func (c *Client) ImageID(ctx context.Context, ref string) (string, error) {
	out, err := c.Runner.Output(ctx, c.Bin, "image", "inspect", "--format", "{{.Id}}", ref)
	return strings.TrimSpace(string(out)), err
}

// RepoDigests are the registry digests an image is known by on this
// machine (repo@sha256:…): none for an image built here.
func (c *Client) RepoDigests(ctx context.Context, image string) ([]string, error) {
	out, err := c.Runner.Output(ctx, c.Bin, "image", "inspect", "--format", "{{json .RepoDigests}}", image)
	if err != nil {
		return nil, err
	}
	var digests []string
	err = json.Unmarshal(bytes.TrimSpace(out), &digests)
	return digests, err
}

// RemoveContainer stops and removes a container (docker rm --force).
func (c *Client) RemoveContainer(ctx context.Context, id string) error {
	_, err := c.Runner.Output(ctx, c.Bin, "rm", "--force", id)
	return err
}

// RemoveImage removes an image reference; the image goes with its last one.
func (c *Client) RemoveImage(ctx context.Context, ref string) error {
	_, err := c.Runner.Output(ctx, c.Bin, "image", "rm", ref)
	return err
}

// PruneDangling removes images no reference points at any more.
func (c *Client) PruneDangling(ctx context.Context) error {
	_, err := c.Runner.Output(ctx, c.Bin, "image", "prune", "--force")
	return err
}

// ExecStdin runs a command in a running container with r as its input
// (docker exec -i) and returns what it printed, stdout and stderr.
func (c *Client) ExecStdin(ctx context.Context, r io.Reader, container string, args ...string) ([]byte, error) {
	cmd := procattr.Hide(exec.CommandContext(ctx, c.Bin, append([]string{"exec", "-i", container}, args...)...))
	cmd.Stdin = r
	return cmd.CombinedOutput()
}

// Exec runs a command in a running container and returns its stdout.
func (c *Client) Exec(ctx context.Context, container string, args ...string) ([]byte, error) {
	cli := append([]string{"exec", container}, args...)
	var out bytes.Buffer
	if ran, err := c.apiExec(ctx, container, nil, args, &out, cli); ran {
		return out.Bytes(), err
	}
	return c.Runner.Output(ctx, c.Bin, cli...)
}

// ExecEnv is Exec passing the named variables from this process's
// environment, so their values (passwords) stay off the command line.
func (c *Client) ExecEnv(ctx context.Context, container string, env []string, args ...string) ([]byte, error) {
	cli := []string{"exec"}
	var pairs []string
	for _, name := range env {
		cli = append(cli, "-e", name)
		// As docker exec -e NAME: a variable this process does not have
		// is left out.
		if v, ok := os.LookupEnv(name); ok {
			pairs = append(pairs, name+"="+v)
		}
	}
	cli = append(append(cli, container), args...)
	var out bytes.Buffer
	if ran, err := c.apiExec(ctx, container, pairs, args, &out, cli); ran {
		return out.Bytes(), err
	}
	return c.Runner.Output(ctx, c.Bin, cli...)
}

// ExecTo runs a command in a running container, streaming stdout to w.
func (c *Client) ExecTo(ctx context.Context, w io.Writer, container string, args ...string) error {
	cli := append([]string{"exec", container}, args...)
	if ran, err := c.apiExec(ctx, container, nil, args, w, cli); ran {
		return err
	}
	return c.Runner.Pipe(ctx, w, c.Bin, cli...)
}

// RunTo runs a throwaway container (docker run --rm ...), streaming stdout
// to w. These are background work (dumps, archives), so they yield the CPU
// to the apps while it is busy.
func (c *Client) RunTo(ctx context.Context, w io.Writer, args ...string) error {
	return c.Runner.Pipe(ctx, w, c.Bin, append([]string{"run", "--rm", "--cpu-shares", BackgroundShares}, args...)...)
}

// BackgroundShares is the CPU weight of background work, against Docker's
// default 1024: a quarter while an app needs the CPU, all of it otherwise.
const BackgroundShares = "256"

// Project identifies one compose project the CLI manages.
type Project struct {
	Dir         string
	ComposeFile string
	EnvFile     string
	Name        string
}

// ComposeArgs returns the global arguments for `docker compose`.
func (p Project) ComposeArgs(profiles []string) []string {
	args := []string{"compose", "--project-directory", p.Dir, "-f", p.ComposeFile, "-p", p.Name}
	if _, err := os.Stat(p.EnvFile); err == nil {
		args = append(args, "--env-file", p.EnvFile)
	}
	for _, prof := range profiles {
		args = append(args, "--profile", prof)
	}
	return args
}

// Compose runs `docker compose <args>` attached to the terminal.
func (c *Client) Compose(ctx context.Context, p Project, profiles []string, args ...string) error {
	all := p.ComposeArgs(profiles)
	if c.Progress != "" {
		all = append([]string{all[0], "--progress", c.Progress}, all[1:]...)
	}
	for i := 0; ; i++ {
		err := c.Runner.Stream(ctx, p.Dir, c.Bin, append(all, args...)...)
		if !errors.Is(err, ErrRegistryBusy) || i == len(registryBusyWaits) {
			return err
		}
		select {
		case <-ctx.Done():
			return err
		case <-time.After(registryBusyWaits[i]):
		}
	}
}

// JSONProgress reports whether this Compose prints its progress as JSON
// (--progress json): older ones refuse the flag or the value.
func (c *Client) JSONProgress(ctx context.Context) bool {
	_, err := c.Runner.Output(ctx, c.Bin, "compose", "--progress", "json", "ls")
	return err == nil
}

// ConfigHashes is each service's configuration hash as Compose would
// create its container now (every profile), by service name. A container
// keeps the hash it was made with (ConfigHashLabel); when they differ, `up`
// recreates it.
func (c *Client) ConfigHashes(ctx context.Context, p Project) (map[string]string, error) {
	out, err := c.Runner.Output(ctx, c.Bin, append(p.ComposeArgs([]string{"*"}), "config", "--hash", "*")...)
	if err != nil {
		return nil, err
	}
	hashes := map[string]string{}
	for _, line := range strings.Split(string(out), "\n") {
		if svc, hash, ok := strings.Cut(strings.TrimSpace(line), " "); ok {
			hashes[svc] = hash
		}
	}
	return hashes, nil
}

// ConfigHashLabel is the label Compose keeps a container's configuration
// hash in.
const ConfigHashLabel = "com.docker.compose.config-hash"

// Stat is one running container's share of the machine right now: CPU as a
// percent of one core (so it can pass 100) and the memory it holds.
type Stat struct {
	Name string  `json:"name"`
	CPU  float64 `json:"cpu"`
	Mem  string  `json:"mem"`
}

// Stats reads `docker stats` once, busiest first. It takes a second or two,
// since docker measures over an interval.
func (c *Client) Stats(ctx context.Context) ([]Stat, error) {
	if stats, ok := c.apiStats(ctx); ok {
		return stats, nil
	}
	out, err := c.Runner.Output(ctx, c.Bin, "stats", "--no-stream", "--format", "{{json .}}")
	if err != nil {
		return nil, err
	}
	return ParseStats(out)
}

// ParseStats reads `docker stats --format {{json .}}`, one object per line.
func ParseStats(out []byte) ([]Stat, error) {
	stats := []Stat{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var raw struct{ Name, CPUPerc, MemUsage string }
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			return nil, fmt.Errorf("docker stats: %w", err)
		}
		cpu, _ := strconv.ParseFloat(strings.TrimSuffix(strings.TrimSpace(raw.CPUPerc), "%"), 64)
		mem, _, _ := strings.Cut(raw.MemUsage, "/")
		stats = append(stats, Stat{Name: raw.Name, CPU: cpu, Mem: strings.TrimSpace(mem)})
	}
	sortStats(stats)
	return stats, nil
}

// sortStats puts the busiest first.
func sortStats(stats []Stat) {
	sort.SliceStable(stats, func(i, j int) bool { return stats[i].CPU > stats[j].CPU })
}
