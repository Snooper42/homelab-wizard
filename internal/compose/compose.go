// Package compose reads the parts of a compose file the CLI needs: services in
// file order with their ports, volumes, networks, labels, dependencies,
// profiles, and x-homelab metadata, plus the catalog-wide x-homelab blocks.
package compose

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// File is one parsed compose file (one Compose project), with the
// services of the files it includes.
type File struct {
	Path     string
	Dir      string
	Includes []string // included files, in order
	// Category is set for compose/<category>.yaml: one category's apps, a
	// project run from the homelab folder, not a stack of its own.
	Category   string
	Name       string // the top-level `name:` (project name)
	Services   map[string]*Service
	Order      []string
	Networks   map[string]Network // top-level networks by key
	Categories []Category
	Bundles    []Bundle
	Natives    []Native
	// SmallBaseline is x-homelab-small-baseline: the only apps `up` starts
	// in a folder the desktop app made (catalog.Load).
	SmallBaseline []string
	// Format is x-homelab-format: the layout of the compose files, so a
	// program that knows an older one can say it needs updating.
	Format int
}

// Network is a top-level network definition.
type Network struct {
	Key      string
	Name     string // explicit name, "" when Compose derives one
	External bool
}

// Category groups apps in listings and docs (x-homelab-categories).
type Category struct {
	ID    string
	Label string
}

// Bundle is a named preset of apps (x-homelab-bundles).
type Bundle struct {
	ID          string
	Name        string   `yaml:"name"`
	Description string   `yaml:"description"`
	Apps        []string `yaml:"apps"`
	// Aliases are extra selector tokens for the bundle, e.g. "*-arr".
	Aliases []string `yaml:"aliases"`
	// Starter bundles are the first picks for a new homelab (Photos,
	// Passwords, ...), shown above the full list in the app.
	Starter bool `yaml:"starter"`
}

// Native is an app that runs on the Mac itself (x-homelab-native).
type Native struct {
	ID             string
	Name           string `yaml:"name"`
	Category       string `yaml:"category"`
	Description    string `yaml:"description"`
	Subdomain      string `yaml:"subdomain"`
	Port           int    `yaml:"port"`
	Install        string `yaml:"install"`         // how to install it on macOS
	InstallLinux   string `yaml:"install_linux"`   // on Linux
	InstallWindows string `yaml:"install_windows"` // and on Windows
	Public         bool   `yaml:"public"`
	Doc            string `yaml:"doc"`
	Phone          string `yaml:"phone"`
}

// Service is one compose service.
type Service struct {
	ID   string
	File *File // the project's file (compose.yaml for the core)
	// Source is the file the service is written in: File's own path, or a
	// file it includes (compose/media.yaml).
	Source       string
	Image        string
	BuildContext string
	Profiles     []string
	DependsOn    []string
	NetworkMode  string
	Networks     []string // network keys the service joins
	Ports        []Port
	Volumes      []Volume
	Labels       map[string]string
	Meta         Meta
}

// Meta is the x-homelab block of a service.
type Meta struct {
	Name        string  `yaml:"name"`
	Category    string  `yaml:"category"`
	Description string  `yaml:"description"`
	Subdomain   string  `yaml:"subdomain"`
	Web         WebPort `yaml:"web"`
	ProxyHost   string  `yaml:"proxy_host"`
	Path        string  `yaml:"path"`
	Internal    bool    `yaml:"internal"`
	Public      bool    `yaml:"public"`
	// Admin marks an app whose pages manage the homelab (infrastructure
	// apps are admin apps already); validate refuses to make one public.
	Admin bool `yaml:"admin"`
	// Local keeps an app's pages on this computer: no address on the tailnet
	// or the domain, for an app without a sign-in of its own (Dozzle).
	Local     bool     `yaml:"local"`
	Aliases   []string `yaml:"aliases"`
	Conflicts []string `yaml:"conflicts"`
	Requires  []string `yaml:"requires"`
	// Login names the .env settings the homelab signs in to the app with
	// (the user or email, then the password), for Status's Sign in.
	Login   []string `yaml:"login"`
	Dump    string   `yaml:"dump"`
	Archive []string `yaml:"archive"` // named volumes `homelab backup` tars up
	Doc     string   `yaml:"doc"`
	Warning string   `yaml:"warning"`
	// Memory is about what the app uses, in MB, rounded up from a busy
	// day; set for apps above the default of their kind (catalog.Memory).
	Memory int `yaml:"memory"`
	// Pin says why an image is updated by hand rather than by Watchtower
	// (databases and locally built images have a reason already).
	Pin string `yaml:"pin"`
	// Seed is a repository folder of starter files copied into the app's
	// first data folder when it is installed, never over existing files.
	Seed string `yaml:"seed"`
	// URL names the .env setting that holds the address the app is opened
	// at, which it needs to know (sign-in, links). Empty in .env means
	// https://<subdomain>.<domain>; in Home mode homelab tailnet setup
	// writes the tailnet address there.
	URL string `yaml:"url"`
	// Phone is the phone app people use it with, for their welcome page
	// (homelab person add).
	Phone string `yaml:"phone"`
	// Version names the .env setting that holds a database's major
	// version (image postgres:${KEY:-N}); homelab db upgrade moves it on.
	Version string `yaml:"version"`
	// Releases is the GitHub project (owner/name) whose releases the image
	// ships, when its image does not say: what an update brings is read
	// from there.
	Releases string `yaml:"releases"`
}

// WebPort is "web: 8080" (container port of the UI) or "web: false" (no UI).
type WebPort struct {
	Set      bool
	Disabled bool
	Port     int
}

// UnmarshalYAML accepts an integer or false.
func (w *WebPort) UnmarshalYAML(n *yaml.Node) error {
	w.Set = true
	if n.Tag == "!!bool" {
		var b bool
		if err := n.Decode(&b); err != nil {
			return err
		}
		w.Disabled = !b
		return nil
	}
	p, err := strconv.Atoi(n.Value)
	if err != nil {
		return fmt.Errorf("x-homelab.web must be a port number or false, got %q", n.Value)
	}
	w.Port = p
	return nil
}

// Port is one published port. Raw parts keep their ${VAR:-default} form.
type Port struct {
	Raw       string
	HostIP    string // raw, may contain variables
	Host      string // raw, may contain variables; empty = ephemeral
	Container string
	Protocol  string
}

// HostVar returns the variable controlling the host port, if any, and its default.
func (p Port) HostVar() (name, def string, ok bool) {
	refs := Refs(p.Host)
	if len(refs) == 0 {
		return "", "", false
	}
	return refs[0].Name, refs[0].Default, true
}

// Resolved is a port with variables expanded.
type Resolved struct {
	HostIP    string
	HostPort  int
	Container int
	Protocol  string
}

// Resolve expands the port's variables.
func (p Port) Resolve(lookup Lookup) (Resolved, error) {
	r := Resolved{Protocol: p.Protocol}
	ip, err := Interpolate(p.HostIP, lookup)
	if err != nil {
		return r, err
	}
	r.HostIP = ip
	if p.Host != "" {
		host, err := Interpolate(p.Host, lookup)
		if err != nil {
			return r, err
		}
		if r.HostPort, err = strconv.Atoi(strings.TrimSpace(host)); err != nil {
			return r, fmt.Errorf("port %q: host port %q is not a number", p.Raw, host)
		}
	}
	c, err := Interpolate(p.Container, lookup)
	if err != nil {
		return r, err
	}
	if r.Container, err = strconv.Atoi(strings.TrimSpace(c)); err != nil {
		return r, fmt.Errorf("port %q: container port %q is not a number", p.Raw, c)
	}
	return r, nil
}

// ParsePort parses short syntax: [ip:][host:]container[/proto], where any part
// may be a ${...} expression containing colons.
func ParsePort(raw string) (Port, error) {
	p := Port{Raw: raw, Protocol: "tcp"}
	body := raw
	if i := strings.LastIndex(body, "/"); i >= 0 && !strings.Contains(body[i:], "}") {
		p.Protocol = strings.ToLower(body[i+1:])
		body = body[:i]
	}
	parts := splitTopLevel(body, ':')
	switch len(parts) {
	case 1:
		p.Container = parts[0]
	case 2:
		p.Host, p.Container = parts[0], parts[1]
	case 3:
		p.HostIP, p.Host, p.Container = parts[0], parts[1], parts[2]
	default:
		return p, fmt.Errorf("unsupported port syntax %q", raw)
	}
	if strings.Contains(p.Host, "-") && !strings.Contains(p.Host, "${") {
		return p, fmt.Errorf("port ranges are not supported: %q", raw)
	}
	return p, nil
}

// Volume is one mount. Source keeps its ${VAR} form; Resolve expands it.
type Volume struct {
	Raw      string
	Source   string // "" for anonymous volumes
	Target   string
	ReadOnly bool
}

// ResolvedVolume is a volume with its source expanded.
type ResolvedVolume struct {
	Source string // absolute host path for binds, the name for named volumes
	Target string
	Bind   bool
}

// Resolve expands the source and decides bind vs named volume the way
// Compose does: paths starting with ".", "/", or "~" are binds. Relative
// paths resolve against dir (the project directory), "~" against home.
func (v Volume) Resolve(lookup Lookup, dir, home string) (ResolvedVolume, error) {
	src, err := Interpolate(v.Source, lookup)
	if err != nil {
		return ResolvedVolume{}, err
	}
	r := ResolvedVolume{Source: src, Target: v.Target}
	switch {
	case src == "":
	case src == "~" || strings.HasPrefix(src, "~/"):
		r.Bind, r.Source = true, filepath.Join(home, strings.TrimPrefix(src, "~"))
	case strings.HasPrefix(src, "/") || isDrivePath(src):
		r.Bind, r.Source = true, filepath.Clean(src)
	case strings.HasPrefix(src, "."):
		r.Bind, r.Source = true, filepath.Join(dir, src)
	}
	return r, nil
}

// isDrivePath reports a Windows absolute path such as C:\media or C:/media.
func isDrivePath(s string) bool {
	return len(s) >= 3 && (s[0]|0x20) >= 'a' && (s[0]|0x20) <= 'z' && s[1] == ':' && (s[2] == '\\' || s[2] == '/')
}

func parseVolume(raw string) Volume {
	parts := splitTopLevel(raw, ':')
	v := Volume{Raw: raw}
	switch len(parts) {
	case 1:
		v.Target = parts[0]
	case 2:
		v.Source, v.Target = parts[0], parts[1]
	default:
		v.Source, v.Target = parts[0], parts[1]
		for _, opt := range strings.Split(parts[2], ",") {
			if opt == "ro" {
				v.ReadOnly = true
			}
		}
	}
	return v
}

// splitTopLevel splits on sep outside ${...}.
func splitTopLevel(s string, sep byte) []string {
	var parts []string
	depth, start := 0, 0
	for i := 0; i < len(s); i++ {
		switch {
		case s[i] == '{':
			depth++
		case s[i] == '}':
			depth--
		case s[i] == sep && depth == 0:
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	return append(parts, s[start:])
}

// Load parses a compose file.
func Load(path string) (*File, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return Parse(path, data)
}

// Parse parses compose YAML.
func Parse(path string, data []byte) (*File, error) {
	var root yaml.Node
	if err := yaml.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	if len(root.Content) == 0 || root.Content[0].Kind != yaml.MappingNode {
		return nil, fmt.Errorf("%s: not a YAML mapping", path)
	}
	f := &File{Path: path, Dir: filepath.Dir(path), Services: map[string]*Service{}, Networks: map[string]Network{}}
	for _, kv := range pairs(root.Content[0]) {
		if err := f.parseTop(kv[0].Value, kv[1]); err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
	}
	return f, nil
}

func (f *File) parseTop(key string, val *yaml.Node) error {
	switch key {
	case "name":
		f.Name = val.Value
	case "include":
		return f.parseIncludes(val)
	case "x-homelab-format":
		n, err := strconv.Atoi(val.Value)
		if err != nil {
			return fmt.Errorf("x-homelab-format: %w", err)
		}
		f.Format = n
	case "services":
		return f.parseServices(val)
	case "networks":
		for _, n := range pairs(val) {
			var def struct {
				Name     string `yaml:"name"`
				External bool   `yaml:"external"`
			}
			if n[1].Kind == yaml.MappingNode {
				if err := n[1].Decode(&def); err != nil {
					return fmt.Errorf("network %s: %w", n[0].Value, err)
				}
			}
			f.Networks[n[0].Value] = Network{Key: n[0].Value, Name: def.Name, External: def.External}
		}
	case "x-homelab-categories":
		for _, c := range pairs(val) {
			f.Categories = append(f.Categories, Category{ID: c[0].Value, Label: c[1].Value})
		}
	case "x-homelab-bundles":
		for _, b := range pairs(val) {
			bundle := Bundle{ID: b[0].Value}
			if err := b[1].Decode(&bundle); err != nil {
				return fmt.Errorf("bundle %s: %w", bundle.ID, err)
			}
			f.Bundles = append(f.Bundles, bundle)
		}
	case "x-homelab-small-baseline":
		if err := val.Decode(&f.SmallBaseline); err != nil {
			return fmt.Errorf("x-homelab-small-baseline: %w", err)
		}
	case "x-homelab-native":
		for _, n := range pairs(val) {
			native := Native{ID: n[0].Value}
			if err := n[1].Decode(&native); err != nil {
				return fmt.Errorf("native app %s: %w", native.ID, err)
			}
			f.Natives = append(f.Natives, native)
		}
	}
	return nil
}

// parseIncludes reads each included file into this project. Every include
// must set project_directory to ".", so paths in it resolve from the
// project's folder as they would in the main file.
func (f *File) parseIncludes(n *yaml.Node) error {
	if n.Kind != yaml.SequenceNode {
		return fmt.Errorf("include: want a list")
	}
	for _, item := range n.Content {
		var inc struct {
			Path       string `yaml:"path"`
			ProjectDir string `yaml:"project_directory"`
		}
		if item.Kind == yaml.ScalarNode {
			inc.Path = item.Value
		} else if err := item.Decode(&inc); err != nil {
			return fmt.Errorf("include: %w", err)
		}
		if inc.Path == "" {
			return fmt.Errorf("include: an entry without a path")
		}
		if inc.ProjectDir == "" || filepath.Clean(inc.ProjectDir) != "." {
			return fmt.Errorf("include %s: set project_directory: . so its paths resolve from %s", inc.Path, filepath.Base(f.Dir))
		}
		path := filepath.Join(f.Dir, inc.Path)
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("include: %w", err)
		}
		sub, err := Parse(path, data)
		if err != nil {
			return err
		}
		f.Includes = append(f.Includes, path)
		for _, id := range sub.Order {
			if _, dup := f.Services[id]; dup {
				return fmt.Errorf("include %s: service %s is already defined", inc.Path, id)
			}
			s := sub.Services[id]
			s.File = f
			f.Services[id] = s
			f.Order = append(f.Order, id)
		}
		for k, nw := range sub.Networks {
			if _, ok := f.Networks[k]; !ok {
				f.Networks[k] = nw
			}
		}
	}
	return nil
}

// pairs returns a mapping's key/value nodes, expanding YAML merge keys
// (<<: *anchor or <<: [*a, *b]); explicit keys win over merged ones.
func pairs(n *yaml.Node) [][2]*yaml.Node {
	for n != nil && n.Kind == yaml.AliasNode {
		n = n.Alias
	}
	if n == nil || n.Kind != yaml.MappingNode {
		return nil
	}
	var own, merged [][2]*yaml.Node
	for i := 0; i+1 < len(n.Content); i += 2 {
		k, v := n.Content[i], n.Content[i+1]
		if k.Kind == yaml.ScalarNode && k.Value == "<<" && (k.Tag == "!!merge" || k.Tag == "") {
			sources := []*yaml.Node{v}
			if v.Kind == yaml.SequenceNode {
				sources = v.Content
			}
			for _, s := range sources {
				merged = append(merged, pairs(s)...)
			}
			continue
		}
		own = append(own, [2]*yaml.Node{k, v})
	}
	seen := map[string]bool{}
	for _, kv := range own {
		seen[kv[0].Value] = true
	}
	for _, kv := range merged {
		if !seen[kv[0].Value] {
			seen[kv[0].Value] = true
			own = append(own, kv)
		}
	}
	return own
}

func (f *File) parseServices(n *yaml.Node) error {
	for _, kv := range pairs(n) {
		id := kv[0].Value
		s := &Service{ID: id, File: f, Source: f.Path, Labels: map[string]string{}}
		for _, field := range pairs(kv[1]) {
			if err := s.parseField(field[0].Value, field[1]); err != nil {
				return fmt.Errorf("service %s, %s: %w", id, field[0].Value, err)
			}
		}
		if dep, ok := strings.CutPrefix(s.NetworkMode, "service:"); ok {
			s.DependsOn = appendUnique(s.DependsOn, dep)
		}
		f.Services[id] = s
		f.Order = append(f.Order, id)
	}
	return nil
}

func (s *Service) parseField(key string, val *yaml.Node) error {
	var err error
	switch key {
	case "image":
		s.Image = val.Value
	case "build":
		if val.Kind == yaml.ScalarNode {
			s.BuildContext = val.Value
		} else {
			var b struct {
				Context string `yaml:"context"`
			}
			err = val.Decode(&b)
			s.BuildContext = b.Context
		}
	case "profiles":
		err = val.Decode(&s.Profiles)
	case "network_mode":
		s.NetworkMode = val.Value
	case "networks":
		if val.Kind == yaml.SequenceNode {
			err = val.Decode(&s.Networks)
		} else {
			for _, nw := range pairs(val) {
				s.Networks = append(s.Networks, nw[0].Value)
			}
		}
	case "depends_on":
		s.DependsOn, err = decodeDependsOn(val)
	case "ports":
		s.Ports, err = decodePorts(val)
	case "volumes":
		s.Volumes, err = decodeVolumes(val)
	case "labels":
		err = decodeLabels(val, s.Labels)
	case "x-homelab":
		err = val.Decode(&s.Meta)
	}
	return err
}

func decodeDependsOn(n *yaml.Node) ([]string, error) {
	var out []string
	switch n.Kind {
	case yaml.SequenceNode:
		err := n.Decode(&out)
		return out, err
	case yaml.MappingNode:
		for _, kv := range pairs(n) {
			out = append(out, kv[0].Value)
		}
		return out, nil
	}
	return nil, fmt.Errorf("unexpected depends_on form")
}

func decodePorts(n *yaml.Node) ([]Port, error) {
	var out []Port
	for _, item := range n.Content {
		if item.Kind == yaml.ScalarNode {
			p, err := ParsePort(item.Value)
			if err != nil {
				return nil, err
			}
			out = append(out, p)
			continue
		}
		var long struct {
			Target    string `yaml:"target"`
			Published string `yaml:"published"`
			HostIP    string `yaml:"host_ip"`
			Protocol  string `yaml:"protocol"`
		}
		if err := item.Decode(&long); err != nil {
			return nil, err
		}
		p := Port{Raw: fmt.Sprintf("%s:%s", long.Published, long.Target), HostIP: long.HostIP, Host: long.Published, Container: long.Target, Protocol: "tcp"}
		if long.Protocol != "" {
			p.Protocol = long.Protocol
		}
		out = append(out, p)
	}
	return out, nil
}

func decodeVolumes(n *yaml.Node) ([]Volume, error) {
	var out []Volume
	for _, item := range n.Content {
		if item.Kind == yaml.ScalarNode {
			out = append(out, parseVolume(item.Value))
			continue
		}
		var long struct {
			Source   string `yaml:"source"`
			Target   string `yaml:"target"`
			ReadOnly bool   `yaml:"read_only"`
		}
		if err := item.Decode(&long); err != nil {
			return nil, err
		}
		out = append(out, Volume{Raw: long.Source + ":" + long.Target, Source: long.Source, Target: long.Target, ReadOnly: long.ReadOnly})
	}
	return out, nil
}

func decodeLabels(n *yaml.Node, into map[string]string) error {
	if n.Kind == yaml.SequenceNode {
		var list []string
		if err := n.Decode(&list); err != nil {
			return err
		}
		for _, l := range list {
			k, v, _ := strings.Cut(l, "=")
			into[strings.TrimSpace(k)] = strings.TrimSpace(v)
		}
		return nil
	}
	for _, kv := range pairs(n) {
		into[kv[0].Value] = kv[1].Value
	}
	return nil
}

func appendUnique(list []string, v string) []string {
	for _, x := range list {
		if x == v {
			return list
		}
	}
	return append(list, v)
}
