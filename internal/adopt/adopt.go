// Package adopt moves apps that already run outside the homelab (an older
// setup's containers) into it: the old container's folders and volumes are
// copied to where the homelab keeps them, matched by their path inside the
// container, and the generated secrets their data depends on (a database
// password) are carried into .env. The old containers are only stopped.
package adopt

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"gopkg.in/yaml.v3"
)

// Mount is one mount of an old container, as docker inspect reports it.
type Mount struct {
	Type        string // "bind" or "volume"
	Name        string // the volume name
	Source      string
	Destination string
}

// Old is a container being adopted.
type Old struct {
	Name   string
	Image  string
	Mounts []Mount
	Env    map[string]string
}

// Copy moves one folder or volume into the homelab.
type Copy struct {
	From, To             string // a host folder, or a volume name
	FromVolume, ToVolume bool
	Target               string // the path inside the container
}

// Step is everything adopting one app does.
type Step struct {
	App      *catalog.App
	Old      Old
	Copies   []Copy
	Settings map[string]string // .env key -> value carried over (secret)
}

// Plan works out the copies and settings for one app. env and example are
// the .env and .env.example values; home expands ~.
func Plan(c *catalog.Catalog, a *catalog.App, old Old, env, example map[string]string, home string) (Step, error) {
	s := Step{App: a, Old: old, Settings: map[string]string{}}
	lookup := compose.MapLookup(env)
	image, err := compose.Interpolate(a.Image, lookup)
	if err != nil {
		image = a.Image
	}
	if err := samePostgres(image, old.Image); err != nil {
		return s, err
	}
	root := filepath.Clean(c.Root)
	for _, v := range a.Volumes {
		m, ok := mountAt(old.Mounts, v.Target)
		if !ok {
			continue
		}
		r, err := v.Resolve(lookup, a.File.Dir, home)
		if err != nil || r.Source == "" {
			continue
		}
		cp := Copy{Target: v.Target, FromVolume: m.Type == "volume", From: m.Source}
		if cp.FromVolume {
			cp.From = m.Name
		}
		switch {
		case r.Bind && !within(r.Source, root):
			continue // a shared folder such as the media drive: already in place
		case r.Bind:
			cp.To = r.Source
		default:
			cp.To, cp.ToVolume = a.Project()+"_"+r.Source, true
		}
		if cp.From == cp.To {
			continue
		}
		s.Copies = append(s.Copies, cp)
	}
	refs, err := envRefs(a.Source, a.ID)
	if err != nil {
		return s, err
	}
	for key, variable := range refs {
		v, ok := old.Env[key]
		if ok && v != "" && envfile.Placeholder.MatchString(example[variable]) && env[variable] != v {
			s.Settings[variable] = v
		}
	}
	return s, nil
}

func mountAt(mounts []Mount, target string) (Mount, bool) {
	for _, m := range mounts {
		if strings.TrimRight(m.Destination, "/") == strings.TrimRight(target, "/") {
			return m, true
		}
	}
	return Mount{}, false
}

func within(path, dir string) bool {
	rel, err := filepath.Rel(dir, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

var postgresRe = regexp.MustCompile(`(?:^|/)postgres:(\d+)`)

// samePostgres refuses to move PostgreSQL data between major versions,
// which cannot read each other's files.
func samePostgres(newImage, oldImage string) error {
	n, o := postgresRe.FindStringSubmatch(newImage), postgresRe.FindStringSubmatch(oldImage)
	if n != nil && o != nil && n[1] != o[1] {
		return fmt.Errorf("the old database is PostgreSQL %s and the homelab runs %s; its files cannot be copied across versions (dump and restore instead)", o[1], n[1])
	}
	return nil
}

var refRe = regexp.MustCompile(`^\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-[^}]*)?\}$`)

// envRefs maps the service's environment keys whose whole value is one
// .env variable (POSTGRES_PASSWORD: ${MONEYMATTER_DB_PASSWORD}) to it.
func envRefs(path, service string) (map[string]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var f struct {
		Services map[string]struct {
			Environment yaml.Node `yaml:"environment"`
		} `yaml:"services"`
	}
	if err := yaml.Unmarshal(data, &f); err != nil {
		return nil, err
	}
	out := map[string]string{}
	add := func(k, v string) {
		if m := refRe.FindStringSubmatch(strings.TrimSpace(v)); m != nil {
			out[k] = m[1]
		}
	}
	n := f.Services[service].Environment
	switch n.Kind {
	case yaml.MappingNode:
		for i := 0; i+1 < len(n.Content); i += 2 {
			add(n.Content[i].Value, n.Content[i+1].Value)
		}
	case yaml.SequenceNode:
		for _, item := range n.Content {
			if k, v, ok := strings.Cut(item.Value, "="); ok {
				add(k, v)
			}
		}
	}
	return out, nil
}
