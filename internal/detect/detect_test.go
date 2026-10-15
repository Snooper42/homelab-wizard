package detect

import (
	"context"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

func TestNormalizeImage(t *testing.T) {
	cases := map[string]string{
		"lscr.io/linuxserver/sonarr:latest":  "linuxserver/sonarr",
		"ghcr.io/linuxserver/sonarr":         "linuxserver/sonarr",
		"linuxserver/sonarr:4.0@sha256:abcd": "linuxserver/sonarr",
		"postgres:16":                        "postgres",
		"docker.io/library/redis:7":          "redis",
		"localhost:5000/me/app:dev":          "me/app",
	}
	for in, want := range cases {
		if got := NormalizeImage(in); got != want {
			t.Errorf("NormalizeImage(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAnalyze(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	fake := &docker.FakeRunner{Containers: []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "lscr.io/linuxserver/sonarr:latest", Running: true, Project: "homelab_media_automation", Service: "sonarr",
			Ports: []docker.PublishedPort{{HostIP: "127.0.0.1", HostPort: 8989, Port: 8989, Protocol: "tcp"}}},
		{Name: "my-radarr", Image: "hotio/radarr:release", Running: true},
		{Name: "navidrome", Image: "someone/music-server", Running: true},
		{Name: "jellyfin", Image: "jellyfin/jellyfin", Running: true},
		{Name: "immich_server", Image: "ghcr.io/immich-app/immich-server:v3", Running: true, Project: "immich", Service: "immich-server"},
		{Name: "homelab_paperless-paperless-1", Image: "ghcr.io/paperless-ngx/paperless-ngx", Running: true, Project: "homelab_paperless", Service: "paperless"},
		{Name: "my-postgres", Image: "postgres:16", Running: true,
			Ports: []docker.PublishedPort{{HostIP: "0.0.0.0", HostPort: 5055, Port: 5432, Protocol: "tcp"}}},
		{Name: "homelab_media_automation-bazarr-1", Image: "lscr.io/linuxserver/bazarr", Running: false, Project: "homelab_media_automation", Service: "bazarr"},
	}}
	ctrs, err := (&docker.Client{Runner: fake, Bin: "docker"}).Containers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	r := Analyze(c, ctrs)
	expect := map[string]State{
		"sonarr":         Running,
		"radarr":         External,     // hotio image, same app
		"navidrome":      External,     // same container name
		"immich-server":  External,     // another Compose project running Immich
		"paperless":      Running,      // a stack project managed by homelab
		"jellyfin":       NotInstalled, // native apps are never matched to containers
		"bazarr":         Stopped,
		"moneymatter-db": NotInstalled, // generic postgres must not match
	}
	for id, want := range expect {
		if got, _ := r.State(id); got != want {
			t.Errorf("%s: state %v, want %v", id, got, want)
		}
	}
	owners := r.PublishedPorts()
	if o := owners["5055/tcp"]; o.Container.Name != "my-postgres" || o.App != nil {
		t.Fatalf("port 5055 owner = %+v", o)
	}
	if o := owners["8989/tcp"]; o.App == nil || o.App.ID != "sonarr" {
		t.Fatalf("port 8989 owner = %+v", o)
	}
	if _, m := r.State("immich-server"); m == nil || m.How != ByImage {
		t.Fatalf("immich should match by image even though the tag is a variable: %+v", m)
	}
	if len(r.Unmatched) != 2 || r.Unmatched[0].Name != "jellyfin" || r.Unmatched[1].Name != "my-postgres" {
		t.Fatalf("unmatched = %+v", r.Unmatched)
	}
}
