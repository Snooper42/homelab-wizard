package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// TestMemoryAlert: docker stats' memory is added up by app (a container
// the catalog knows to its app, with its id for Stop; any other to its own
// name), the three biggest kept, and the alert names them, how long, and
// how to stop the biggest.
func TestMemoryAlert(t *testing.T) {
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	label := func(project, service string) map[string]string {
		return map[string]string{"com.docker.compose.project": project, "com.docker.compose.service": service}
	}
	report := detect.Analyze(h.catalog, []docker.Container{
		{Name: "immich-server", Running: true, Labels: label("homelab_immich", "immich-server")},
		{Name: "duplicati", Running: true, Labels: label("homelab_system", "duplicati")},
	})
	stats := []docker.Stat{
		{Name: "duplicati", Mem: "300MiB / 8GiB"},
		{Name: "immich-server", Mem: "2.5GiB / 8GiB"},
		{Name: "someones-own", Mem: "3GiB / 8GiB"},
		{Name: "tiny", Mem: "20MiB / 8GiB"},
		{Name: "not-measured", Mem: "-- / --"},
	}
	m := appsMemory(stats, report, 8<<30)
	if m.Total != 8<<30 || m.Used != (2560+300+3072+20)<<20 {
		t.Fatalf("used %d of %d", m.Used, m.Total)
	}
	want := []health.AppMemory{{Name: "someones-own", Bytes: 3 << 30}, {ID: "immich-server", Name: "Immich", Bytes: 2560 << 20}, {ID: "duplicati", Name: "Duplicati", Bytes: 300 << 20}}
	if len(m.Biggest) != 3 {
		t.Fatalf("biggest: %+v", m.Biggest)
	}
	for i, w := range want {
		if m.Biggest[i] != w {
			t.Fatalf("biggest[%d] = %+v, want %+v", i, m.Biggest[i], w)
		}
	}

	m.Used, m.Since = 7_500<<20, time.Date(2026, 11, 6, 10, 0, 0, 0, time.UTC)
	m.Biggest = m.Biggest[1:]
	msg := memoryAlert(m, m.Since.Add(15*time.Minute))
	for _, w := range []string{"92% of the 8.0 GB", "for 15 minutes", "The biggest: Immich 2.5 GB, Duplicati 300 MB.", "from Status (or homelab stop immich-server)."} {
		if !strings.Contains(msg.Body, w) {
			t.Fatalf("alert lacks %q:\n%s", w, msg.Body)
		}
	}
	if msg.Title != "Homelab: memory nearly full" || msg.Priority != 4 {
		t.Fatalf("alert: %q priority %d", msg.Title, msg.Priority)
	}
	m.Used = 4 << 30
	if b := memoryBack(m); !strings.Contains(b.Body, "50%") {
		t.Fatalf("back: %s", b.Body)
	}
}

// TestWatchdogMemoryPressure: the watchdog measures the apps' memory on
// each run and alerts once it has stayed high for 10 minutes, naming the
// biggest app, and again once when it is back down; Status's summary
// carries the biggest only while the alert stands.
func TestWatchdogMemoryPressure(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "healthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	dir := filepath.Dir(calls)
	write := func(name, data string) {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(data), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("info.json", `{"ServerVersion":"27.0.0","OperatingSystem":"OrbStack","MemTotal":8589934592}`)
	write("stats.txt", `{"Name":"homelab_security-vaultwarden-1","CPUPerc":"1.0%","MemUsage":"7.5GiB / 8GiB"}`+"\n")
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	state := func() health.State { return health.LoadState(health.StatePath(root)) }

	if out, _ := homelabCmd(t, root, "", "watchdog"); strings.Contains(out, "memory:") {
		t.Fatalf("alerted on the first high run:\n%s", out)
	}
	if m := state().Memory; m == nil || m.Since.IsZero() || m.Alerted {
		t.Fatalf("first high run kept %+v", m)
	}
	// As if the first run was 15 minutes ago.
	if err := health.UpdateState(health.StatePath(root), func(s *health.State) { s.Memory.Since = s.Memory.Since.Add(-15 * time.Minute) }); err != nil {
		t.Fatal(err)
	}
	out, _ := homelabCmd(t, root, "", "watchdog")
	if !strings.Contains(out, "memory: the apps use 94% of what Docker has") {
		t.Fatalf("no alert after 15 minutes high:\n%s", out)
	}
	sum := state().Summary()
	if sum.Memory == nil || len(sum.Memory.Biggest) != 1 || sum.Memory.Biggest[0].ID != "vaultwarden" {
		t.Fatalf("Status's summary: %+v", sum.Memory)
	}
	if out, _ := homelabCmd(t, root, "", "watchdog"); strings.Contains(out, "memory:") {
		t.Fatalf("alerted twice:\n%s", out)
	}
	write("stats.txt", `{"Name":"homelab_security-vaultwarden-1","CPUPerc":"1.0%","MemUsage":"2GiB / 8GiB"}`+"\n")
	homelabCmd(t, root, "", "watchdog")
	if s := state(); s.Memory == nil || s.Memory.Alerted || s.Summary().Memory != nil {
		t.Fatalf("down again: %+v", s.Memory)
	}
}
