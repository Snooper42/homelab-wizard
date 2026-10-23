package api

import (
	"context"
	"os"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/install"
)

// Hasher is what Changed asks for each project's configuration hashes
// (*docker.Client).
type Hasher interface {
	ConfigHashes(ctx context.Context, p docker.Project) (map[string]string, error)
}

// hashCache keeps each project's hashes while its compose file and .env
// are unchanged: asking Compose takes a tenth of a second a project.
var hashCache = struct {
	sync.Mutex
	seen map[string]hashes
}{seen: map[string]hashes{}}

type hashes struct {
	file, env time.Time
	bySvc     map[string]string
}

func modTime(path string) time.Time {
	if fi, err := os.Stat(path); err == nil {
		return fi.ModTime()
	}
	return time.Time{}
}

// Changed is the running apps whose container was made from other
// settings than their compose file and .env give now (an edit to .env, or
// a homelab upgrade `up` has not applied yet), by app id. Apps whose
// project Compose cannot read are left out.
func Changed(ctx context.Context, c *catalog.Catalog, h Hasher, envFile string, containers []docker.Container) map[string]bool {
	report := detect.Analyze(c, containers)
	type running struct {
		app  *catalog.App
		made string // the hash its container was made with
	}
	var apps []running
	projects := map[string]docker.Project{}
	for _, a := range c.Apps {
		if a.Native() != nil || a.File == nil {
			continue
		}
		st, m := report.State(a.ID)
		if st != detect.Running || m == nil || m.Container.Project() != a.Project() {
			continue // not made by the homelab's own project
		}
		if made := m.Container.Labels[docker.ConfigHashLabel]; made != "" {
			apps = append(apps, running{a, made})
			projects[a.File.Path] = install.ProjectFor(a.File, envFile)
		}
	}
	// Each project's hashes at once: Compose takes a moment for each.
	byProject := map[string]map[string]string{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for path, p := range projects {
		wg.Add(1)
		go func() {
			defer wg.Done()
			now := projectHashes(ctx, h, p)
			mu.Lock()
			byProject[path] = now
			mu.Unlock()
		}()
	}
	wg.Wait()
	changed := map[string]bool{}
	for _, r := range apps {
		if want, ok := byProject[r.app.File.Path][r.app.ID]; ok && want != r.made {
			changed[r.app.ID] = true
		}
	}
	return changed
}

func projectHashes(ctx context.Context, h Hasher, p docker.Project) map[string]string {
	file, env := modTime(p.ComposeFile), modTime(p.EnvFile)
	hashCache.Lock()
	kept, ok := hashCache.seen[p.ComposeFile]
	hashCache.Unlock()
	if ok && kept.file.Equal(file) && kept.env.Equal(env) {
		return kept.bySvc
	}
	bySvc, err := h.ConfigHashes(ctx, p)
	if err != nil {
		return nil
	}
	hashCache.Lock()
	hashCache.seen[p.ComposeFile] = hashes{file: file, env: env, bySvc: bySvc}
	hashCache.Unlock()
	return bySvc
}

// MarkChanged sets SettingsChanged on the apps in changed.
func (st *Status) MarkChanged(changed map[string]bool) {
	for i := range st.Apps {
		st.Apps[i].SettingsChanged = changed[st.Apps[i].ID]
	}
}
