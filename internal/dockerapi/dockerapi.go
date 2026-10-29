// Package dockerapi talks to the container engine's own API over its
// socket, the way the docker CLI does, for what the homelab reads all the
// time: the containers, their events, what they use, and the engine's
// info. Reading these through the CLI starts a process each time, which
// on Windows costs most of Status's time (0.10's timings); here it is one
// HTTP request on a connection kept open.
//
// It answers in the CLI's own JSON (docker inspect, docker info, docker
// events), so internal/docker decodes both the same way, and falls back
// to the CLI on any error. Starting, stopping, and updating stay with
// docker compose. On Windows it reads Docker Desktop's named pipe
// (dial_windows.go), elsewhere a unix socket (dial_other.go).
package dockerapi

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Client is the engine's API at one socket.
type Client struct {
	// Socket is the engine's socket or pipe, as found
	// ("/Users/sam/.orbstack/run/docker.sock", `\\.\pipe\docker_engine`).
	Socket string
	http   *http.Client
}

// ErrNoSocket means no engine socket was found where the CLI would look.
var ErrNoSocket = errors.New("no container engine socket found")

// New is a client for the engine at socket.
func New(socket string) *Client {
	return &Client{Socket: socket, http: &http.Client{Transport: &http.Transport{
		DialContext:         func(ctx context.Context, _, _ string) (net.Conn, error) { return dial(ctx, socket) },
		MaxIdleConnsPerHost: 8,
		IdleConnTimeout:     90 * time.Second,
	}}}
}

// Find is where the CLI would reach the engine on this machine: DOCKER_HOST,
// then the current docker context, then where OrbStack, Docker Desktop, a
// rootless engine, and the system's engine listen. Only a socket or pipe
// that is there counts.
func Find() (string, error) {
	home, _ := os.UserHomeDir()
	if h := os.Getenv("DOCKER_HOST"); h != "" {
		if p, ok := address(h); ok && listening(p) {
			return p, nil
		}
		return "", fmt.Errorf("DOCKER_HOST %s is not a socket here", h)
	}
	if h := contextHost(home); h != "" {
		if p, ok := address(h); ok && listening(p) {
			return p, nil
		}
	}
	for _, p := range defaults(home) {
		if listening(p) {
			return p, nil
		}
	}
	return "", ErrNoSocket
}

// contextHost is the current docker context's endpoint, as the CLI keeps it
// in ~/.docker: config.json names the context, contexts/meta/<sha256 of
// the name>/meta.json holds its host. "" for the default context.
func contextHost(home string) string {
	dir := os.Getenv("DOCKER_CONFIG")
	if dir == "" {
		dir = filepath.Join(home, ".docker")
	}
	name := os.Getenv("DOCKER_CONTEXT")
	if name == "" {
		var cfg struct {
			CurrentContext string `json:"currentContext"`
		}
		data, err := os.ReadFile(filepath.Join(dir, "config.json"))
		if err != nil || json.Unmarshal(data, &cfg) != nil {
			return ""
		}
		name = cfg.CurrentContext
	}
	if name == "" || name == "default" {
		return ""
	}
	sum := sha256.Sum256([]byte(name))
	data, err := os.ReadFile(filepath.Join(dir, "contexts", "meta", hex.EncodeToString(sum[:]), "meta.json"))
	if err != nil {
		return ""
	}
	var meta struct {
		Endpoints map[string]struct {
			Host string `json:"Host"`
		} `json:"Endpoints"`
	}
	if json.Unmarshal(data, &meta) != nil {
		return ""
	}
	return meta.Endpoints["docker"].Host
}

// get asks the engine for path (with query), returning the body of a 200.
func (c *Client) get(ctx context.Context, path string, query url.Values) ([]byte, error) {
	resp, err := c.do(ctx, path, query)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (c *Client) do(ctx context.Context, path string, query url.Values) (*http.Response, error) {
	u := "http://engine" + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		var e struct {
			Message string `json:"message"`
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		if json.Unmarshal(body, &e) != nil || e.Message == "" {
			e.Message = strings.TrimSpace(string(body))
		}
		return nil, &Error{Status: resp.StatusCode, Message: e.Message}
	}
	return resp, nil
}

// Error is the engine refusing a request.
type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string { return fmt.Sprintf("engine API %d: %s", e.Status, e.Message) }

// Ping is whether the engine answers.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.get(ctx, "/_ping", nil)
	return err
}

// Info is the engine's own description, as docker info --format json.
func (c *Client) Info(ctx context.Context) ([]byte, error) { return c.get(ctx, "/info", nil) }

// Inspect is every container, running or not, as docker inspect prints
// them all: one JSON array.
func (c *Client) Inspect(ctx context.Context) ([]byte, error) {
	data, err := c.get(ctx, "/containers/json", url.Values{"all": {"1"}})
	if err != nil {
		return nil, err
	}
	var list []struct {
		ID string `json:"Id"`
	}
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, fmt.Errorf("engine API containers: %w", err)
	}
	out := make([][]byte, len(list))
	errs := make([]error, len(list))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for i, ct := range list {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			out[i], errs[i] = c.get(ctx, "/containers/"+url.PathEscape(id)+"/json", nil)
		}(i, ct.ID)
	}
	wg.Wait()
	var b bytes.Buffer
	b.WriteByte('[')
	n := 0
	for i := range list {
		var gone *Error
		if errors.As(errs[i], &gone) && gone.Status == http.StatusNotFound {
			continue // removed between the list and its inspect
		}
		if errs[i] != nil {
			return nil, errs[i]
		}
		if n > 0 {
			b.WriteByte(',')
		}
		b.Write(bytes.TrimSpace(out[i]))
		n++
	}
	b.WriteByte(']')
	return b.Bytes(), nil
}

// Events follows the engine's events for the containers, with these
// actions, calling fn with each as docker events --format '{{json .}}'
// prints it, until ctx ends or the engine stops.
func (c *Client) Events(ctx context.Context, actions []string, fn func(line []byte)) error {
	filters, _ := json.Marshal(map[string][]string{"type": {"container"}, "event": actions})
	resp, err := c.do(ctx, "/events", url.Values{"filters": {string(filters)}})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	dec := json.NewDecoder(bufio.NewReader(resp.Body))
	for {
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return fmt.Errorf("engine API events: %w", err)
		}
		fn(raw)
	}
}

// Stat is one running container's use, as docker stats --no-stream
// computes it.
type Stat struct {
	Name string
	CPU  float64 // percent of one processor, so 250 is two and a half
	Mem  string  // "12.5MiB", in the CLI's words
}

// Stats is what each running container uses now: the engine measures
// over a second, so this takes about one.
func (c *Client) Stats(ctx context.Context) ([]Stat, error) {
	data, err := c.get(ctx, "/containers/json", nil)
	if err != nil {
		return nil, err
	}
	var list []struct {
		ID    string   `json:"Id"`
		Names []string `json:"Names"`
	}
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, fmt.Errorf("engine API containers: %w", err)
	}
	stats := make([]Stat, len(list))
	ok := make([]bool, len(list))
	var wg sync.WaitGroup
	for i, ct := range list {
		wg.Add(1)
		go func(i int, id string, names []string) {
			defer wg.Done()
			body, err := c.get(ctx, "/containers/"+url.PathEscape(id)+"/stats", url.Values{"stream": {"false"}})
			if err != nil {
				return
			}
			if s, err := ParseStat(body); err == nil {
				if len(names) > 0 {
					s.Name = strings.TrimPrefix(names[0], "/")
				}
				stats[i], ok[i] = s, true
			}
		}(i, ct.ID, ct.Names)
	}
	wg.Wait()
	out := []Stat{}
	for i := range stats {
		if ok[i] {
			out = append(out, stats[i])
		}
	}
	return out, nil
}

// ParseStat reads one /containers/{id}/stats answer the way the CLI does:
// processor use against the whole machine's over the same interval, times
// the processors; memory without the page cache it could give back.
func ParseStat(body []byte) (Stat, error) {
	var s struct {
		Name     string `json:"name"`
		CPUStats struct {
			Usage struct {
				Total  uint64   `json:"total_usage"`
				PerCPU []uint64 `json:"percpu_usage"`
			} `json:"cpu_usage"`
			System uint64 `json:"system_cpu_usage"`
			Online uint32 `json:"online_cpus"`
		} `json:"cpu_stats"`
		PreCPU struct {
			Usage struct {
				Total uint64 `json:"total_usage"`
			} `json:"cpu_usage"`
			System uint64 `json:"system_cpu_usage"`
		} `json:"precpu_stats"`
		Memory struct {
			Usage uint64            `json:"usage"`
			Stats map[string]uint64 `json:"stats"`
		} `json:"memory_stats"`
	}
	if err := json.Unmarshal(body, &s); err != nil {
		return Stat{}, fmt.Errorf("engine API stats: %w", err)
	}
	st := Stat{Name: strings.TrimPrefix(s.Name, "/")}
	cpus := float64(s.CPUStats.Online)
	if cpus == 0 {
		cpus = float64(len(s.CPUStats.Usage.PerCPU))
	}
	cpuDelta := float64(s.CPUStats.Usage.Total) - float64(s.PreCPU.Usage.Total)
	sysDelta := float64(s.CPUStats.System) - float64(s.PreCPU.System)
	if cpuDelta > 0 && sysDelta > 0 {
		st.CPU = cpuDelta / sysDelta * cpus * 100
	}
	used := s.Memory.Usage
	// cgroup v2 calls the page cache inactive_file; v1 total_inactive_file.
	for _, k := range []string{"inactive_file", "total_inactive_file"} {
		if v, ok := s.Memory.Stats[k]; ok && v < used {
			used -= v
			break
		}
	}
	st.Mem = BytesSize(float64(used))
	return st, nil
}

// BytesSize is n in the CLI's words: binary units, four significant figures
// ("12.47MiB", "1.234GiB").
func BytesSize(n float64) string {
	units := []string{"B", "KiB", "MiB", "GiB", "TiB"}
	i := 0
	for n >= 1024 && i < len(units)-1 {
		n /= 1024
		i++
	}
	return fmt.Sprintf("%.4g%s", n, units[i])
}
