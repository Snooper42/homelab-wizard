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
	Custom []string // own apps, "id (image)"
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
				Services map[string]struct {
					Image string `yaml:"image"`
				} `yaml:"services"`
			}
			if yaml.NewDecoder(body).Decode(&c) == nil {
				for id, s := range c.Services {
					r.Custom = append(r.Custom, id+" ("+s.Image+")")
				}
				sort.Strings(r.Custom)
			}
		}
	}
}
