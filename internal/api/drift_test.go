package api

import (
	"context"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

type fakeHasher struct {
	asked  int
	bySvc  map[string]string
	failed bool
}

func (f *fakeHasher) ConfigHashes(_ context.Context, p docker.Project) (map[string]string, error) {
	f.asked++
	if f.failed {
		return nil, context.DeadlineExceeded
	}
	return f.bySvc, nil
}

func TestChanged(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	ctr := func(project, svc, hash string) docker.Container {
		return docker.Container{Name: project + "-" + svc + "-1", Image: "x", State: "running", Running: true, Labels: map[string]string{
			"com.docker.compose.project": project, "com.docker.compose.service": svc, docker.ConfigHashLabel: hash}}
	}
	containers := []docker.Container{
		ctr("homelab_security", "ntfy", "old"),
		ctr("homelab_security", "vaultwarden", "same"),
		ctr("homelab_security", "uptime-kuma", ""), // made before the label, or by hand
		ctr("someone_else", "crowdsec", "other"),   // not the homelab's project
	}
	f := &fakeHasher{bySvc: map[string]string{"ntfy": "new", "vaultwarden": "same", "uptime-kuma": "x", "crowdsec": "y"}}
	env := filepath.Join(t.TempDir(), ".env")
	got := Changed(context.Background(), c, f, env, containers)
	if len(got) != 1 || !got["ntfy"] {
		t.Errorf("changed = %v", got)
	}
	if f.asked != 1 {
		t.Errorf("asked Compose %d times for one project", f.asked)
	}
	Changed(context.Background(), c, f, env, containers)
	if f.asked != 1 {
		t.Error("asked again with the files unchanged")
	}
	st := Status{Apps: []AppStatus{{ID: "ntfy"}, {ID: "vaultwarden"}}}
	st.MarkChanged(got)
	if !st.Apps[0].SettingsChanged || st.Apps[1].SettingsChanged {
		t.Errorf("marked %+v", st.Apps)
	}
}

func TestChangedWithoutCompose(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	containers := []docker.Container{{Name: "n", Image: "x", State: "running", Running: true, Labels: map[string]string{
		"com.docker.compose.project": "homelab_media", "com.docker.compose.service": "navidrome", docker.ConfigHashLabel: "h"}}}
	if got := Changed(context.Background(), c, &fakeHasher{failed: true}, filepath.Join(t.TempDir(), ".env"), containers); len(got) != 0 {
		t.Errorf("a project Compose could not read: %v", got)
	}
}
