// Package install plans and applies app installs: skip what already runs or
// cannot start yet, fix port conflicts, prepare .env, folders, and the shared
// network, then `compose up` each project.
package install

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/selector"
	"github.com/Snooper42/homelab-wizard/internal/sysmem"
)

// Skip records an app that will not be started.
type Skip struct {
	App    *catalog.App
	Reason string
}

// Plan is everything an install will do.
type Plan struct {
	Selection  *selector.Selection
	Start      []*catalog.App
	Skips      []Skip
	Ports      *ports.Plan
	EnvChanges []envfile.Change
	Dirs       []string // folders to create for bind mounts
	Seeds      []Seed   // starter files to copy into new data folders
	Networks   []string // external networks the projects need
	Warnings   []string
	Problems   []string
	Env        *envfile.File
	// Memory is what every app running after the install uses, against
	// the room this machine has for them, in MB (Room 0: not known).
	Memory Memory
}

// Memory is the plan's memory check.
type Memory struct {
	Use, Room int
}

// Seed is starter files for an app's data folder (x-homelab seed).
type Seed struct {
	App      string
	From, To string
	Files    []string // only those not in To yet
}

// Options control planning.
type Options struct {
	// IncludeExisting starts apps even if they already run outside the homelab.
	IncludeExisting bool
}

// Inputs are the collaborators a plan needs.
type Inputs struct {
	Catalog    *catalog.Catalog
	EnvFile    string
	EnvExample string
	Containers []docker.Container
	Prober     ports.Prober
	Identity   envfile.Identity
	Home       string // expands ~ in bind mounts
	Options    Options
	// Set holds settings entered in a form (KEY: value). They go into .env
	// when the plan is applied and are never echoed back.
	Set map[string]string
	// Host is the machine the apps run on; the zero value means this one.
	Host host.Profile
	// MemoryMB is this machine's memory (sysmem.TotalMB); 0 skips the
	// check that the apps fit.
	MemoryMB int
}

// ProjectFor is how the CLI runs Compose for one file: its own directory and
// project name, with the shared .env for interpolation.
func ProjectFor(f *compose.File, envFile string) docker.Project {
	return docker.Project{Dir: f.Dir, ComposeFile: f.Path, EnvFile: envFile, Name: f.Name}
}

// Build creates a plan for a selection.
func Build(in Inputs, sel *selector.Selection) (*Plan, error) {
	env, changes, err := envfile.Prepare(in.EnvFile, in.EnvExample, in.Identity)
	if err != nil {
		return nil, err
	}
	if len(in.Set) > 0 {
		changes = applySettings(env, changes, in.Set)
	}
	plan := &Plan{Selection: sel, Env: env, EnvChanges: changes}
	report := detect.Analyze(in.Catalog, in.Containers)
	envMap := env.Map()
	lookup := compose.MapLookup(envMap)
	mediaRoot := filepath.Clean(expandHome(envMap["MEDIA_ROOT"], in.Home))
	// A media folder in the home folder, not on an external drive, is
	// made when missing rather than waited for, as on Linux and Windows.
	mediaMounted := envMap["MEDIA_ROOT"] != "" && (exists(mediaRoot) ||
		diskspace.ExternalDrive(mediaRoot) == "" && in.Home != "" && within(mediaRoot, in.Home))

	if in.Host.OS == "" {
		in.Host = host.Current()
	}
	held := map[string]string{} // apps that cannot start, with the reason
	for _, a := range sel.Apps {
		if why := blocker(a, sel, held, envMap, in.Home, mediaRoot, mediaMounted, lookup, in.Host); why != "" {
			held[a.ID] = why
			plan.Skips = append(plan.Skips, Skip{a, why})
			continue
		}
		state, m := report.State(a.ID)
		switch state {
		case detect.Running:
			plan.Skips = append(plan.Skips, Skip{a, "already running"})
			continue
		case detect.External:
			where := fmt.Sprintf("container %q (%s, %s)", m.Container.Name, m.Container.Image, m.How)
			if parent, isDep := sel.RequiredBy[a.ID]; isDep {
				plan.Warnings = append(plan.Warnings, fmt.Sprintf("%s also runs as %s; %s needs its own copy, so one will be started", a.ID, where, parent))
			} else if !in.Options.IncludeExisting {
				// Compose would start the homelab's own copy for anything
				// that depends on it, so dependents wait as well.
				held[a.ID] = "it runs outside the homelab"
				plan.Skips = append(plan.Skips, Skip{a, "already running as " + where})
				continue
			}
		}
		plan.Start = append(plan.Start, a)
		if a.Meta.Warning != "" {
			plan.Warnings = append(plan.Warnings, a.Name()+": "+a.Meta.Warning)
		}
	}

	plan.Start = dropUnneededHelpers(in.Catalog, plan)

	// Alternatives that are already running block their counterparts.
	for _, a := range plan.Start {
		for _, other := range a.Meta.Conflicts {
			if st, _ := report.State(other); st == detect.Running {
				plan.Problems = append(plan.Problems, fmt.Sprintf("%s cannot run alongside %s, which is already running; stop it first (homelab stop %s)", a.ID, other, other))
			}
		}
	}

	plan.Ports = ports.Resolve(ports.Input{Apps: plan.Start, Env: envMap, Report: report, Prober: in.Prober})
	plan.Problems = append(plan.Problems, plan.Ports.Problems...)
	for _, ch := range plan.Ports.Changes {
		env.Set(ch.Var, strconv.Itoa(ch.To))
		envMap[ch.Var] = strconv.Itoa(ch.To)
	}

	// Bind-mount folders inside the homelab or on the media drive, and the
	// ones an app writes in your home folder (Jellyfin's container keeps
	// its library in JELLYFIN_DATA_DIR), are created up front, so they
	// belong to you rather than to the container runtime.
	root := filepath.Clean(in.Catalog.Root)
	seen := map[string]bool{}
	for _, a := range plan.Start {
		for _, v := range a.Volumes {
			r, err := v.Resolve(lookup, a.File.Dir, in.Home)
			if err != nil || !r.Bind || seen[r.Source] {
				continue
			}
			seen[r.Source] = true
			inside := within(r.Source, root) || mediaMounted && within(r.Source, mediaRoot) ||
				!v.ReadOnly && in.Home != "" && within(r.Source, in.Home)
			if inside && !exists(r.Source) && filepath.Ext(r.Source) == "" {
				plan.Dirs = append(plan.Dirs, r.Source)
			}
		}
	}
	sort.Strings(plan.Dirs)
	for _, a := range plan.Start {
		if s, ok := seedFor(a, root, lookup, in.Home); ok {
			plan.Seeds = append(plan.Seeds, s)
		}
	}
	plan.Networks = in.Catalog.ExternalNetworks(plan.Start)
	plan.Memory = memoryCheck(in, report, plan)
	return plan, nil
}

// memoryCheck adds up what the apps running after the install use, and
// warns when it is more than this machine has room for beside the system
// and everyday apps: it would slow down and swap.
func memoryCheck(in Inputs, report *detect.Report, plan *Plan) Memory {
	var apps []*catalog.App
	seen := map[string]bool{}
	for _, a := range plan.Start {
		apps, seen[a.ID] = append(apps, a), true
	}
	for _, a := range in.Catalog.Apps {
		if st, _ := report.State(a.ID); st == detect.Running && !seen[a.ID] {
			apps, seen[a.ID] = append(apps, a), true
		}
	}
	m := Memory{}
	for _, a := range apps {
		m.Use += a.Memory()
	}
	if in.MemoryMB <= 0 {
		return m
	}
	m.Room = sysmem.Room(in.MemoryMB)
	if m.Use <= m.Room || len(plan.Start) == 0 {
		return m
	}
	// The heaviest of what this install starts, to leave out first.
	start := append([]*catalog.App(nil), plan.Start...)
	sort.SliceStable(start, func(i, j int) bool { return start[i].Memory() > start[j].Memory() })
	var heavy []string
	for _, a := range start[:min(3, len(start))] {
		heavy = append(heavy, fmt.Sprintf("%s %s", a.Name(), GB(a.Memory())))
	}
	plan.Warnings = append(plan.Warnings, fmt.Sprintf("Memory: with these, the apps use about %s, and this machine has %s, which leaves room for about %s beside the system and everyday apps. It would slow down: leave out the heaviest (%s), or add apps one at a time later.",
		GB(m.Use), GB(in.MemoryMB), GB(m.Room), strings.Join(heavy, ", ")))
	return m
}

// GB writes MB as gigabytes to one decimal ("1.2 GB"), or MB below one.
func GB(mb int) string {
	if mb < 1024 {
		return fmt.Sprintf("%d MB", mb)
	}
	return strconv.FormatFloat(float64(mb)/1024, 'f', 1, 64) + " GB"
}

// applySettings writes form values into env. A value replaces any change
// Prepare planned for the same key and is marked secret so plans hide it.
func applySettings(env *envfile.File, changes []envfile.Change, set map[string]string) []envfile.Change {
	keys := make([]string, 0, len(set))
	for k := range set {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var out []envfile.Change
	for _, c := range changes {
		if _, ok := set[c.Key]; !ok {
			out = append(out, c)
		}
	}
	for _, k := range keys {
		// An empty value (an unset shell variable in --set-stdin) never
		// clears what is stored.
		if strings.TrimSpace(set[k]) == "" {
			continue
		}
		if old, ok := env.Get(k); ok && old == set[k] {
			continue
		}
		env.Set(k, set[k])
		out = append(out, envfile.Change{Key: k, Reason: "entered in the form", Secret: true})
	}
	return out
}

// dropUnneededHelpers skips helpers (databases, caches, APIs) that only
// serve apps which are not starting, such as a stack's database when the
// stack's app already runs outside the homelab. Helpers nothing depends on
// are kept.
func dropUnneededHelpers(c *catalog.Catalog, plan *Plan) []*catalog.App {
	needed := map[string]bool{}
	var need func(id string)
	need = func(id string) {
		if needed[id] {
			return
		}
		needed[id] = true
		if a, ok := c.Get(id); ok {
			for _, d := range a.DependsOn {
				need(d)
			}
		}
	}
	for _, a := range plan.Start {
		if !a.Internal() {
			need(a.ID)
		}
	}
	dependent := map[string]string{} // helper -> the first app that uses it
	for _, a := range c.Apps {
		for _, d := range a.DependsOn {
			if _, ok := dependent[d]; !ok {
				dependent[d] = a.ID
			}
		}
	}
	var start []*catalog.App
	for _, a := range plan.Start {
		if by, ok := dependent[a.ID]; ok && a.Internal() && !needed[a.ID] {
			plan.Skips = append(plan.Skips, Skip{a, "only needed by " + by + ", which is not starting"})
			continue
		}
		start = append(start, a)
	}
	return start
}

// seedFor plans an app's starter files: those in its seed folder that its
// first data folder inside the homelab does not have yet.
func seedFor(a *catalog.App, root string, lookup compose.Lookup, home string) (Seed, bool) {
	if a.Meta.Seed == "" {
		return Seed{}, false
	}
	from := filepath.Join(root, a.Meta.Seed)
	entries, err := os.ReadDir(from)
	if err != nil {
		return Seed{}, false
	}
	for _, v := range a.Volumes {
		r, err := v.Resolve(lookup, a.File.Dir, home)
		if err != nil || !r.Bind || !within(r.Source, root) {
			continue
		}
		s := Seed{App: a.ID, From: from, To: r.Source}
		for _, e := range entries {
			if !e.IsDir() && !exists(filepath.Join(r.Source, e.Name())) {
				s.Files = append(s.Files, e.Name())
			}
		}
		return s, len(s.Files) > 0
	}
	return Seed{}, false
}

// NativeState reports whether a native app is installed on this machine,
// and whether it answers; api sets it (it reads the disk and the app's
// port), and nil leaves both unknown.
var NativeState func(n *compose.Native) (installed, up bool)

// blocker explains why an app cannot start yet, or returns "".
func blocker(a *catalog.App, sel *selector.Selection, held map[string]string, env map[string]string, home, mediaRoot string, mediaMounted bool, lookup compose.Lookup, hp host.Profile) string {
	if n := a.Native(); n != nil {
		if NativeState != nil {
			switch installed, up := NativeState(n); {
			case up:
				return "already running"
			case installed:
				return "is installed on " + hp.Machine + ": open it there, and Status shows it"
			}
		}
		how := n.Install
		switch hp.OS {
		case "linux":
			how = n.InstallLinux
		case "windows":
			how = n.InstallWindows
		}
		if how != "" {
			return "runs natively on " + hp.Machine + ", so you install it yourself: " + how
		}
		return "runs natively on " + hp.Machine
	}
	for _, dep := range a.DependsOn {
		if why, ok := held[dep]; ok && sel.Has(dep) {
			if why == "it runs outside the homelab" {
				return "uses " + dep + ", which runs outside the homelab (stop it there, or add --include-existing)"
			}
			return "waits for " + dep
		}
	}
	var missing []string
	for _, v := range a.Meta.Requires {
		if strings.TrimSpace(env[v]) == "" {
			missing = append(missing, v)
		}
	}
	if len(missing) > 0 {
		return "set " + strings.Join(missing, ", ") + " in .env first"
	}
	if !mediaMounted {
		for _, v := range a.Volumes {
			r, err := v.Resolve(lookup, a.File.Dir, home)
			if err == nil && r.Bind && mediaRoot != "." && within(r.Source, mediaRoot) {
				return "the media drive " + mediaRoot + " is not mounted"
			}
		}
	}
	return ""
}

func within(path, dir string) bool {
	rel, err := filepath.Rel(dir, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func expandHome(p, home string) string {
	if p == "~" || strings.HasPrefix(p, "~/") {
		return filepath.Join(home, strings.TrimPrefix(p, "~"))
	}
	return p
}

// Ready reports whether the plan can be applied.
func (p *Plan) Ready() bool { return len(p.Problems) == 0 }

// Event reports progress while a plan is applied. Each step is sent when it
// begins and again when it ends (Done, with Error on failure).
type Event struct {
	Step    int      `json:"step"`
	Steps   int      `json:"steps"`
	Name    string   `json:"name"`              // "env", "folders", "networks", or "start"
	Project string   `json:"project,omitempty"` // the Compose project for "start"
	Apps    []string `json:"apps,omitempty"`
	Done    bool     `json:"done"`
	Error   string   `json:"error,omitempty"`
}

// Apply writes .env, creates folders and networks, and starts the apps one
// Compose project at a time (core first, then the stacks).
func Apply(ctx context.Context, p *Plan, client *docker.Client, c *catalog.Catalog, envFile string) error {
	return ApplyWithProgress(ctx, p, client, c, envFile, nil)
}

// ApplyWithProgress is Apply that reports each step to progress (may be nil).
func ApplyWithProgress(ctx context.Context, p *Plan, client *docker.Client, c *catalog.Catalog, envFile string, progress func(Event)) error {
	if !p.Ready() {
		return fmt.Errorf("plan has unresolved problems")
	}
	type step struct {
		name          string
		file          *compose.File
		ids, profiles []string
	}
	steps := []step{{name: "env"}, {name: "folders"}, {name: "networks"}}
	for _, f := range c.Files {
		s := step{name: "start", file: f}
		seen := map[string]bool{}
		for _, a := range p.Start {
			if a.File != f {
				continue
			}
			s.ids = append(s.ids, a.ID)
			for _, prof := range a.Profiles {
				if !seen[prof] {
					seen[prof] = true
					s.profiles = append(s.profiles, prof)
				}
			}
		}
		if len(s.ids) > 0 {
			steps = append(steps, s)
		}
	}
	run := func(s step) error {
		switch s.name {
		case "env":
			if err := p.Env.Save(); err != nil {
				return fmt.Errorf("writing .env: %w", err)
			}
		case "folders":
			for _, d := range p.Dirs {
				if err := os.MkdirAll(d, 0o755); err != nil {
					return err
				}
			}
			for _, sd := range p.Seeds {
				if err := os.MkdirAll(sd.To, 0o755); err != nil {
					return err
				}
				for _, f := range sd.Files {
					data, err := os.ReadFile(filepath.Join(sd.From, f))
					if err != nil {
						return err
					}
					if err := os.WriteFile(filepath.Join(sd.To, f), data, 0o644); err != nil {
						return err
					}
				}
			}
		case "networks":
			for _, n := range p.Networks {
				if _, err := client.EnsureNetwork(ctx, n); err != nil {
					return fmt.Errorf("creating the %s network: %w", n, err)
				}
			}
		case "start":
			args := append([]string{"up", "--detach", "--no-recreate"}, s.ids...)
			if err := client.Compose(ctx, ProjectFor(s.file, envFile), s.profiles, args...); err != nil {
				return fmt.Errorf("starting %s: %w", s.file.Name, err)
			}
		}
		return nil
	}
	for i, s := range steps {
		ev := Event{Step: i + 1, Steps: len(steps), Name: s.name, Apps: s.ids}
		if s.file != nil {
			ev.Project = s.file.Name
		}
		if progress != nil {
			progress(ev)
		}
		err := run(s)
		ev.Done = true
		if err != nil {
			ev.Error = err.Error()
		}
		if progress != nil {
			progress(ev)
		}
		if err != nil {
			return err
		}
	}
	return nil
}
