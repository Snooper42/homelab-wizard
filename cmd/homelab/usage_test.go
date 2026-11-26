package main

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
	appusage "github.com/Snooper42/homelab-wizard/internal/usage"
)

func TestUsageDue(t *testing.T) {
	now := time.Now()
	for _, c := range []struct {
		last time.Time
		due  bool
	}{{time.Time{}, true}, {now.Add(-4 * time.Minute), false}, {now.Add(-5 * time.Minute), true}, {now.Add(-8 * time.Hour), true}} {
		if got := usageDue(now, c.last); got != c.due {
			t.Errorf("last %v: %v", c.last, got)
		}
	}
}

// Lane D, D2: the agent's sample is docker stats' processor and memory, each app by its compose service.
func TestSampleUsage(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
		{Name: "homelab_cloud-immich-server-1", Image: "ghcr.io/immich-app/immich-server:release", Running: true, Project: "homelab_cloud", Service: "immich-server"},
	})
	stats := `{"Name":"homelab_security-vaultwarden-1","CPUPerc":"0.5%","MemUsage":"20MiB / 8GiB"}` + "\n" +
		`{"Name":"homelab_cloud-immich-server-1","CPUPerc":"12.0%","MemUsage":"1GiB / 8GiB"}` + "\n"
	if err := os.WriteFile(filepath.Join(filepath.Dir(calls), "stats.txt"), []byte(stats), 0o644); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}}
	now := time.Now()
	if err := h.sampleUsage(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	h.nightlyJob("backup", now)
	got, err := appusage.Read(appusage.Path(root), now.Add(time.Second), 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.At) != 1 || got.CPU[0] != 12.5 || got.Mem[0] != (1<<30)+(20<<20) {
		t.Fatalf("%+v", got)
	}
	if got.Apps["vaultwarden"].CPU[0] != 0.5 || got.Apps["immich-server"].Mem[0] != 1<<30 {
		t.Errorf("each app: %+v", got.Apps)
	}
	if len(got.Jobs) != 1 || got.Jobs[0].Name != "backup" {
		t.Errorf("jobs: %+v", got.Jobs)
	}
}
