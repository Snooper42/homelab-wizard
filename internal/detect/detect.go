// Package detect matches containers already on the machine (OrbStack, Docker
// Desktop, ...) to catalog apps, so installs can skip what is already running.
package detect

import (
	"fmt"
	"path"
	"regexp"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// State of an app on this machine.
type State int

const (
	// NotInstalled means no matching container exists.
	NotInstalled State = iota
	// Stopped means this project's container exists but is not running.
	Stopped
	// Running means this project's container is running.
	Running
	// External means the app runs in a container outside this project.
	External
)

func (s State) String() string {
	return [...]string{"not installed", "stopped", "running", "running elsewhere"}[s]
}

// How a container was matched to an app.
const (
	ByLabel = "compose project"
	ByImage = "same image"
	ByName  = "same name"
)

// Match ties a container to an app.
type Match struct {
	App       *catalog.App
	Container docker.Container
	How       string
}

// Report is the detection result.
type Report struct {
	Containers []docker.Container
	byApp      map[string][]Match
	// Unmatched lists running containers that are not catalog apps.
	Unmatched []docker.Container
}

// genericImages are shared base images that must not identify an app by
// image alone (someone's own Postgres is not MoneyMatter's database).
var genericImages = map[string]bool{
	"postgres": true, "postgis": true, "redis": true, "valkey": true, "mariadb": true, "mysql": true,
	"mongo": true, "nginx": true, "alpine": true, "busybox": true, "ubuntu": true, "debian": true,
}

var (
	digest = regexp.MustCompile(`@sha256:[a-f0-9]+$`)
	tag    = regexp.MustCompile(`:[\w][\w.-]*$`)
)

// NormalizeImage reduces an image reference to "owner/name" without registry,
// tag, or digest, so lscr.io/linuxserver/sonarr:latest and
// ghcr.io/linuxserver/sonarr compare equal.
func NormalizeImage(ref string) string {
	ref = strings.ToLower(strings.TrimSpace(ref))
	ref = tag.ReplaceAllString(digest.ReplaceAllString(ref, ""), "")
	parts := strings.Split(ref, "/")
	if len(parts) > 1 && (strings.ContainsAny(parts[0], ".:") || parts[0] == "localhost") {
		parts = parts[1:]
	}
	if len(parts) == 2 && parts[0] == "library" {
		parts = parts[1:]
	}
	return strings.Join(parts, "/")
}

// imageName is the last path segment of a normalized image.
func imageName(ref string) string { return path.Base(NormalizeImage(ref)) }

// Analyze matches containers to apps. A container belongs to an app when its
// Compose labels name the app's own project and service; otherwise it is
// matched by image or name as "running elsewhere".
func Analyze(c *catalog.Catalog, containers []docker.Container) *Report {
	r := &Report{Containers: containers, byApp: map[string][]Match{}}
	ours := map[string]bool{}
	for _, f := range c.Files {
		ours[f.Name] = true
	}
	for _, ctr := range containers {
		matched := false
		if ours[ctr.Project()] || catalog.LegacyProjects[ctr.Project()] {
			if app, ok := c.Get(ctr.Service()); ok && app.Native() == nil && (app.Project() == ctr.Project() || catalog.LegacyProjects[ctr.Project()]) && app.ID == ctr.Service() {
				r.byApp[app.ID] = append(r.byApp[app.ID], Match{app, ctr, ByLabel})
				continue
			}
		}
		for _, app := range c.Apps {
			if how := externalMatch(app, ctr); how != "" {
				r.byApp[app.ID] = append(r.byApp[app.ID], Match{app, ctr, how})
				matched = true
				break
			}
		}
		if !matched && ctr.Running && !ours[ctr.Project()] {
			r.Unmatched = append(r.Unmatched, ctr)
		}
	}
	return r
}

func externalMatch(app *catalog.App, ctr docker.Container) string {
	// Internal helpers, native apps, and generic base images never identify
	// an app from outside the homelab projects.
	if app.Internal() || app.Native() != nil {
		return ""
	}
	// Resolve ${IMMICH_VERSION:-v3}-style references with their defaults;
	// the tag is dropped when comparing anyway.
	image, err := compose.Interpolate(app.Image, compose.MapLookup(nil))
	if err == nil && image != "" && !genericImages[imageName(image)] {
		// Exact image, or the same app from another publisher
		// (hotio/sonarr vs linuxserver/sonarr).
		if NormalizeImage(image) == NormalizeImage(ctr.Image) || imageName(image) == imageName(ctr.Image) {
			return ByImage
		}
	}
	// Container names: "sonarr", "immich_server", "stack-sonarr-1", "stack_sonarr_1".
	name := strings.ReplaceAll(strings.ToLower(ctr.Name), "_", "-")
	id := strings.ReplaceAll(app.ID, "_", "-")
	if name == id || name == id+"-1" || strings.HasSuffix(name, "-"+id+"-1") {
		return ByName
	}
	return ""
}

// Matches returns the containers matched to an app.
func (r *Report) Matches(appID string) []Match { return r.byApp[appID] }

// State summarizes an app's status, preferring this project's container.
func (r *Report) State(appID string) (State, *Match) {
	var stopped, external *Match
	for i, m := range r.byApp[appID] {
		m := m
		switch {
		case m.How == ByLabel && m.Container.Running:
			return Running, &r.byApp[appID][i]
		case m.How == ByLabel:
			stopped = &m
		case m.Container.Running && external == nil:
			external = &m
		}
	}
	if external != nil {
		return External, external
	}
	if stopped != nil {
		return Stopped, stopped
	}
	return NotInstalled, nil
}

// PortOwner identifies who holds a host port.
type PortOwner struct {
	Container docker.Container
	App       *catalog.App // nil if the container is not a catalog app
}

// PortKey formats a host port/protocol pair.
func PortKey(port int, proto string) string { return fmt.Sprintf("%d/%s", port, proto) }

// PublishedPorts maps host port/protocol to the running container holding it.
func (r *Report) PublishedPorts() map[string]PortOwner {
	out := map[string]PortOwner{}
	appOf := map[string]*catalog.App{}
	for _, ms := range r.byApp {
		for _, m := range ms {
			appOf[m.Container.ID] = m.App
		}
	}
	for _, ctr := range r.Containers {
		if !ctr.Running {
			continue
		}
		for _, p := range ctr.Ports {
			out[PortKey(p.HostPort, p.Protocol)] = PortOwner{Container: ctr, App: appOf[ctr.ID]}
		}
	}
	return out
}

// Summary lists matched apps for display, sorted by app id.
func (r *Report) Summary() []Match {
	var out []Match
	for _, ms := range r.byApp {
		out = append(out, ms...)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].App.ID != out[j].App.ID {
			return out[i].App.ID < out[j].App.ID
		}
		return out[i].Container.Name < out[j].Container.Name
	})
	return out
}
