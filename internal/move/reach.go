package move

import (
	"archive/tar"
	"bufio"
	"encoding/json"
	"io"
	"os"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// Reach is what a bundle brings that keeps its reach into the homelab
// once moved in: paired phones, a Cloudflare tunnel and its domain, and
// your own apps, which Docker runs as they are written. From your own old
// machine that is the point; from a file someone else made it would let
// them in, so move in names each before it asks.
type Reach struct {
	Phones []string // each paired phone's name, "(may make changes)" when it may
	Tunnel bool     // a Cloudflare tunnel token
	Domain string   // HOMELAB_DOMAIN
	Custom []string // own apps, "id (image)", with what each takes beyond an ordinary app
}

// Any reports whether the bundle brings anything that reaches in.
func (r Reach) Any() bool {
	return len(r.Phones) > 0 || r.Tunnel || r.Domain != "" || len(r.Custom) > 0
}

// Brings reads what the bundle at path brings that reaches in, without
// unpacking it.
func Brings(path string) (Reach, error) {
	var r Reach
	f, err := os.Open(path)
	if err != nil {
		return r, err
	}
	defer f.Close()
	tr := tar.NewReader(f)
	for {
		h, err := tr.Next()
		if err == io.EOF {
			return r, nil
		}
		if err != nil {
			return r, err
		}
		if h.Typeflag != tar.TypeReg {
			continue
		}
		body := io.LimitReader(tr, 4<<20)
		switch strings.TrimPrefix(h.Name, "./") {
		case ".env":
			sc := bufio.NewScanner(body)
			for sc.Scan() {
				k, v, ok := strings.Cut(strings.TrimSpace(sc.Text()), "=")
				v = strings.Trim(strings.TrimSpace(v), `"'`)
				switch {
				case !ok || v == "":
				case k == "TUNNEL_TOKEN":
					r.Tunnel = true
				case k == "HOMELAB_DOMAIN":
					r.Domain = v
				}
			}
		case "data/phones.json":
			var s struct {
				Devices []struct {
					Name      string `json:"name"`
					CanChange bool   `json:"canChange"`
				} `json:"devices"`
			}
			if json.NewDecoder(body).Decode(&s) == nil {
				for _, d := range s.Devices {
					name := d.Name
					if d.CanChange {
						name += " (may make changes)"
					}
					r.Phones = append(r.Phones, name)
				}
			}
		case "stacks/custom/compose.yaml":
			var c struct {
				Services map[string]ownApp `yaml:"services"`
			}
			if yaml.NewDecoder(body).Decode(&c) == nil {
				for id, s := range c.Services {
					what := s.Image
					if takes := s.takes(); len(takes) > 0 {
						what += "; " + strings.Join(takes, ", ")
					}
					r.Custom = append(r.Custom, id+" ("+what+")")
				}
				sort.Strings(r.Custom)
			}
		}
	}
}

// ownApp is an own app as a bundle's stacks/custom file writes it: what it
// runs, and what it asks of the computer beyond an ordinary app.
type ownApp struct {
	Image       string      `yaml:"image"`
	Privileged  bool        `yaml:"privileged"`
	NetworkMode string      `yaml:"network_mode"`
	Pid         string      `yaml:"pid"`
	CapAdd      []string    `yaml:"cap_add"`
	Devices     []yaml.Node `yaml:"devices"`
	Volumes     []yaml.Node `yaml:"volumes"`
	Ports       []yaml.Node `yaml:"ports"`
}

// openPorts are the ports an own app publishes beyond this computer: on
// every address (no host IP, 0.0.0.0, ::) or one that is neither this
// computer's own (127.0.0.1, localhost, ::1) nor ${BIND_IP…}, which is.
func (a ownApp) openPorts() []string {
	var out []string
	for _, p := range a.Ports {
		ip, published := "", ""
		if p.Kind == yaml.MappingNode {
			for i := 0; i+1 < len(p.Content); i += 2 {
				switch p.Content[i].Value {
				case "host_ip":
					ip = p.Content[i+1].Value
				case "published":
					published = p.Content[i+1].Value
				}
			}
		} else {
			// [ip:]published:target[/proto], or a target alone (a port
			// Docker picks, on every address). An IPv6 or ${…} host is
			// split at its last colons, not inside it.
			spec, _, _ := strings.Cut(p.Value, "/")
			parts := splitPort(spec)
			switch len(parts) {
			case 3:
				ip, published = parts[0], parts[1]
			case 2:
				published = parts[0]
			default:
				published = "a port Docker picks"
			}
		}
		ip = strings.Trim(ip, "[]")
		local := ip == "127.0.0.1" || ip == "localhost" || ip == "::1" || strings.HasPrefix(ip, "${BIND_IP")
		if !local {
			out = append(out, published)
		}
	}
	return out
}

// splitPort splits a short port spec into its host IP, published port and
// target, keeping a ${…} or [IPv6] host whole.
func splitPort(spec string) []string {
	host := ""
	if strings.HasPrefix(spec, "${") || strings.HasPrefix(spec, "[") {
		end := strings.IndexAny(spec, "}]")
		if end < 0 || end+1 >= len(spec) || spec[end+1] != ':' {
			return []string{spec}
		}
		host, spec = spec[:end+1], spec[end+2:]
	}
	parts := strings.Split(spec, ":")
	if host != "" {
		return append([]string{host}, parts...)
	}
	if len(parts) > 3 { // a bare IPv6 host
		return []string{strings.Join(parts[:len(parts)-2], ":"), parts[len(parts)-2], parts[len(parts)-1]}
	}
	return parts
}

// takes says, in the household's words, what the app asks for that an
// ordinary app does not (N30): any of these gives it the computer, or
// what is on it, beyond its own folder.
func (a ownApp) takes() []string {
	var out []string
	if a.Privileged {
		out = append(out, "privileged: full control of this computer")
	}
	sock, root := false, false
	for _, v := range a.Volumes {
		src := v.Value // the short form, source:target[:mode]
		if v.Kind == yaml.MappingNode {
			src = ""
			for i := 0; i+1 < len(v.Content); i += 2 {
				if v.Content[i].Value == "source" {
					src = v.Content[i+1].Value
				}
			}
		} else {
			src, _, _ = strings.Cut(src, ":")
		}
		sock = sock || strings.HasSuffix(src, "docker.sock")
		root = root || src == "/"
	}
	if sock {
		out = append(out, "Docker's socket: control of every app")
	}
	if root {
		out = append(out, "its whole disk")
	}
	if a.NetworkMode == "host" {
		out = append(out, "this computer's network")
	}
	if a.Pid == "host" {
		out = append(out, "this computer's processes")
	}
	if len(a.CapAdd) > 0 {
		out = append(out, "added powers ("+strings.Join(a.CapAdd, ", ")+")")
	}
	if len(a.Devices) > 0 {
		out = append(out, "this computer's devices")
	}
	if open := a.openPorts(); len(open) > 0 {
		out = append(out, "the home network, on "+strings.Join(open, ", "))
	}
	return out
}
