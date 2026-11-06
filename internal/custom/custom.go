// Package custom adds your own apps to the homelab. Each becomes a service
// in stacks/custom/compose.yaml with the same x-homelab metadata as the
// catalog, so install, the proxy, status, backups, and the desktop app treat
// it like any other app. Its data folders live under data/appdata/<id>,
// which the AppData backup job already covers. Like .env, the custom stack
// is yours alone: it is ignored by git, never touches a tracked file (so
// git pull keeps working), and stays out of the generated docs.
package custom

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
	"github.com/Snooper42/homelab-wizard/internal/ports"
)

// Spec describes an app to add.
type Spec struct {
	ID          string            `json:"id"` // lowercase letters, digits, and hyphens
	Name        string            `json:"name"`
	Image       string            `json:"image"`
	Port        int               `json:"port"` // the container's web port; 0 for none
	Category    string            `json:"category"`
	Description string            `json:"description"`
	Volumes     []string          `json:"volumes"` // paths inside the container to keep
	Env         map[string]string `json:"env"`
}

// File is the custom stack, relative to the repository root.
var File = filepath.Join("stacks", "custom", "compose.yaml")

const header = `# homelab_custom: your own apps, added with "homelab custom add" (or the
# app's "Add your own app"). Each service carries the same x-homelab
# metadata as the catalog, so install, the proxy, status, and backups treat
# it like the rest. Edit freely; "homelab validate" checks it.

name: homelab_custom

x-service: &service
  restart: unless-stopped
  security_opt: ["no-new-privileges:true"]
  logging:
    driver: json-file
    options: { max-size: 10m, max-file: "3" }

networks:
  default:
  homelab:
    name: homelab
    external: true

services:
`

var (
	idRe    = regexp.MustCompile(`^[a-z][a-z0-9-]{1,30}$`)
	keyRe   = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
	imageRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/:@-]*$`)
)

// Slug turns a name into an app ID: "My Wiki!" -> "my-wiki".
func Slug(name string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			dash = false
		case b.Len() > 0 && !dash:
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.Trim(b.String(), "-")
}

// Check reports what is wrong with s, if anything.
func (s Spec) Check(c *catalog.Catalog) error {
	switch {
	case !idRe.MatchString(s.ID):
		return fmt.Errorf("the ID %q must be 2-31 lowercase letters, digits, or hyphens, starting with a letter", s.ID)
	case appExists(c, s.ID):
		return fmt.Errorf("%s is already an app (homelab apps)", s.ID)
	case !imageRe.MatchString(s.Image):
		return fmt.Errorf("the image %q is not a valid image name, such as ghcr.io/owner/app:latest", s.Image)
	case s.Port < 0 || s.Port > 65535:
		return fmt.Errorf("the port %d is out of range", s.Port)
	case strings.TrimSpace(s.Name) == "":
		return fmt.Errorf("give the app a name")
	case c.CategoryLabel(s.Category) == s.Category:
		return fmt.Errorf("unknown category %q", s.Category)
	}
	for _, v := range s.Volumes {
		if !strings.HasPrefix(v, "/") || strings.ContainsAny(v, ":,#\"' \t\r\n") || v == "/" || slices.Contains(strings.Split(v, "/"), "..") {
			return fmt.Errorf("the folder %q must be an absolute path inside the container, such as /data", v)
		}
	}
	for k := range s.Env {
		if !keyRe.MatchString(k) {
			return fmt.Errorf("the setting %q is not a valid name", k)
		}
	}
	return nil
}

func appExists(c *catalog.Catalog, id string) bool {
	if _, ok := c.Get(id); ok {
		return true
	}
	_, ok := c.Bundle(id)
	return ok
}

// q quotes a string for YAML (a JSON string is valid YAML); "$" is escaped so
// Compose does not interpolate it.
func q(s string) string {
	b, _ := json.Marshal(strings.ReplaceAll(s, "$", "$$"))
	return string(b)
}

// Block is the compose service for s, published on hostPort.
func (s Spec) Block(hostPort int) string {
	var b strings.Builder
	fmt.Fprintf(&b, "  %s:\n    <<: *service\n    image: %s\n    profiles: [optional]\n    environment:\n      TZ: ${TZ:-UTC}\n", s.ID, q(s.Image))
	keys := make([]string, 0, len(s.Env))
	for k := range s.Env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		fmt.Fprintf(&b, "      %s: %s\n", k, q(s.Env[k]))
	}
	if s.Port > 0 {
		fmt.Fprintf(&b, "    ports:\n      - ${BIND_IP:-127.0.0.1}:%d:%d\n", hostPort, s.Port)
	}
	if len(s.Volumes) > 0 {
		b.WriteString("    volumes:\n")
		for _, v := range s.Volumes {
			fmt.Fprintf(&b, "      - ../../data/appdata/%s/%s:%s\n", s.ID, strings.ReplaceAll(strings.Trim(v, "/"), "/", "-"), v)
		}
	}
	b.WriteString("    networks: [default, homelab]\n    x-homelab:\n")
	desc := s.Description
	if strings.TrimSpace(desc) == "" {
		desc = s.Name
	}
	fmt.Fprintf(&b, "      name: %s\n      category: %s\n      description: %s\n", q(s.Name), s.Category, q(desc))
	if s.Port > 0 {
		fmt.Fprintf(&b, "      subdomain: %s\n      web: %d\n", s.ID, s.Port)
	} else {
		b.WriteString("      web: false\n")
	}
	return b.String()
}

// FreePort picks a host port from 18000 up that no app uses by default.
func FreePort(c *catalog.Catalog, env map[string]string) int {
	used := map[int]bool{}
	lookup := compose.MapLookup(env)
	for _, a := range c.Apps {
		for _, bnd := range ports.AppBindings(a, lookup) {
			used[bnd.HostPort] = true
		}
	}
	p := 18000
	for used[p] {
		p++
	}
	return p
}

// Add writes s into the custom stack on a free port, then reloads and
// validates the catalog; on any problem the stack is put back as it was. It
// returns the reloaded catalog and the host port.
func Add(root string, c *catalog.Catalog, s Spec, env map[string]string) (*catalog.Catalog, int, error) {
	if n, ok := catalog.LegacyCategories[s.Category]; ok {
		s.Category = n // a category from before the regroup
	}
	if err := s.Check(c); err != nil {
		return c, 0, err
	}
	example, err := os.ReadFile(filepath.Join(root, ".env.example"))
	if err != nil {
		return c, 0, err
	}
	path := filepath.Join(root, File)
	var next *catalog.Catalog
	var hostPort int
	var aerr error
	// Under the file's lock from reading it to checking the result: the app
	// and homelab custom add are processes of their own, and an add that
	// read the file a moment before another's would write over it.
	err = lockedfile.Update(path, 0o644, func(old []byte) ([]byte, bool) {
		// Read again here: another add may have come in since c was read,
		// with its ID or its port.
		cur, err := catalog.Load(root)
		if err != nil {
			aerr = err
			return nil, false
		}
		if aerr = s.Check(cur); aerr != nil {
			return nil, false
		}
		hostPort = FreePort(cur, env)
		stack := header
		if old != nil {
			stack = strings.TrimRight(string(old), "\n") + "\n"
		}
		if !strings.HasSuffix(stack, "services:\n") {
			stack += "\n"
		}
		stack += s.Block(hostPort)
		if aerr = lockedfile.Write(path, []byte(stack), 0o644); aerr != nil {
			return nil, false
		}
		next, aerr = catalog.Load(root)
		if aerr == nil {
			if issues := next.Validate(declared(string(example))); len(issues) > 0 {
				var msgs []string
				for _, i := range issues {
					msgs = append(msgs, i.String())
				}
				aerr = fmt.Errorf("the new app does not validate: %s", strings.Join(msgs, "; "))
			}
		}
		if aerr != nil {
			return old, true // as it was; none before: removed
		}
		return nil, false
	})
	if aerr != nil {
		return c, 0, aerr
	}
	if err != nil {
		return c, 0, err
	}
	return next, hostPort, nil
}

func declared(example string) map[string]bool {
	out := map[string]bool{}
	for _, line := range strings.Split(example, "\n") {
		if k, _, ok := strings.Cut(strings.TrimSpace(line), "="); ok && keyRe.MatchString(k) && !strings.HasPrefix(k, "#") {
			out[k] = true
		}
	}
	return out
}

// Remove takes id out of the custom stack (the file goes with the last
// app). Its data folder stays.
func Remove(root, id string) error {
	path := filepath.Join(root, File)
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("%s is not one of your own apps", id)
	}
	var rerr error
	err := lockedfile.Update(path, 0o644, func(data []byte) ([]byte, bool) {
		out, ok := without(string(data), id)
		if !ok {
			rerr = fmt.Errorf("%s is not one of your own apps", id)
			return nil, false
		}
		return out, true // nil, with the last app: the file goes
	})
	if rerr != nil {
		return rerr
	}
	return err
}

// without is the custom stack without id's service, and whether it had
// one; nil when id was the last.
func without(data, id string) ([]byte, bool) {
	lines := strings.Split(data, "\n")
	var out []string
	in, found, remaining, services := false, false, 0, false
	serviceRe := regexp.MustCompile(`^  ([a-z0-9-]+):\s*$`)
	for _, l := range lines {
		// Any other top-level key (volumes:, networks:) ends the services
		// section, and with it the app being removed.
		if top := l != "" && l[0] != ' ' && l[0] != '\t' && l[0] != '#'; top {
			services, in = strings.HasPrefix(l, "services:"), false
		}
		if m := serviceRe.FindStringSubmatch(l); m != nil && services {
			in = m[1] == id
			found = found || in
			if !in {
				remaining++
			}
		}
		if !in {
			out = append(out, l)
		}
	}
	if !found {
		return nil, false
	}
	if remaining == 0 {
		return nil, true
	}
	return []byte(strings.TrimRight(strings.Join(out, "\n"), "\n") + "\n"), true
}

// Apps lists your own apps.
func Apps(c *catalog.Catalog) []*catalog.App {
	var out []*catalog.App
	for _, a := range c.Apps {
		if a.File != nil && filepath.Base(a.File.Dir) == "custom" {
			out = append(out, a)
		}
	}
	return out
}
