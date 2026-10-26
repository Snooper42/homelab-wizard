package compose

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestInterpolate(t *testing.T) {
	env := MapLookup(map[string]string{"SET": "v", "EMPTY": "", "PORT": "9000"})
	cases := map[string]string{
		"plain":                             "plain",
		"$$literal":                         "$literal",
		"${SET}":                            "v",
		"$SET/x":                            "v/x",
		"${UNSET:-def}":                     "def",
		"${EMPTY:-def}":                     "def",
		"${EMPTY-def}":                      "",
		"${UNSET-def}":                      "def",
		"${SET:+alt}":                       "alt",
		"${UNSET:+alt}":                     "",
		"${BIND_IP:-127.0.0.1}:${PORT:-80}": "127.0.0.1:9000",
		"${UNSET:-${SET:-x}}":               "v",
	}
	for in, want := range cases {
		got, err := Interpolate(in, env)
		if err != nil || got != want {
			t.Errorf("Interpolate(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	if _, err := Interpolate("${UNSET:?need it}", env); err == nil {
		t.Error("expected error for required variable")
	}
}

func TestRefs(t *testing.T) {
	refs := Refs("${BIND_IP:-127.0.0.1}:${SONARR_PORT:-8989}:8989")
	if len(refs) != 2 || refs[1].Name != "SONARR_PORT" || refs[1].Default != "8989" || !refs[1].HasDefault {
		t.Fatalf("unexpected refs: %+v", refs)
	}
}

func TestParsePort(t *testing.T) {
	p, err := ParsePort("${PIHOLE_DNS_BIND_IP:-127.0.0.1}:${PIHOLE_DNS_PORT:-53}:53/udp")
	if err != nil {
		t.Fatal(err)
	}
	if p.Protocol != "udp" || p.Container != "53" {
		t.Fatalf("bad parse: %+v", p)
	}
	if name, def, ok := p.HostVar(); !ok || name != "PIHOLE_DNS_PORT" || def != "53" {
		t.Fatalf("bad host var: %s %s %v", name, def, ok)
	}
	r, err := p.Resolve(MapLookup(map[string]string{"PIHOLE_DNS_PORT": "5353"}))
	if err != nil || r.HostPort != 5353 || r.HostIP != "127.0.0.1" || r.Container != 53 {
		t.Fatalf("bad resolve: %+v %v", r, err)
	}
	if p, _ := ParsePort("8080"); p.Host != "" || p.Container != "8080" {
		t.Fatalf("container-only port: %+v", p)
	}
}

func TestLoadRepoCompose(t *testing.T) {
	f, err := Load(repoFile(t, "compose.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if f.Name != "homelab_core" || len(f.Bundles) == 0 || len(f.Categories) != 9 || len(f.Natives) != 2 || f.Natives[0].Port != 8096 || f.Natives[1].Port != 8099 {
		t.Fatalf("catalog file: name %q, bundles %d, categories %d, natives %+v", f.Name, len(f.Bundles), len(f.Categories), f.Natives)
	}
	load := func(name string) *File {
		t.Helper()
		f, err := Load(repoFile(t, filepath.Join("compose", name)))
		if err != nil {
			t.Fatal(err)
		}
		if len(f.Order) != len(f.Services) || len(f.Services) == 0 {
			t.Fatalf("%s: %d services", name, len(f.Services))
		}
		if nw := f.Networks["default"]; !nw.External || nw.Name != "homelab" {
			t.Fatalf("%s: default network %+v", name, nw)
		}
		return f
	}
	ma := load("media-automation.yaml")
	if ma.Name != "homelab_media_automation" {
		t.Fatalf("project %q", ma.Name)
	}
	qb := ma.Services["qbittorrent"]
	if qb == nil || len(qb.DependsOn) == 0 || qb.DependsOn[0] != "gluetun" || ma.Services["gluetun"] == nil {
		t.Fatalf("qbittorrent should depend on gluetun via network_mode, in the same project, got %+v", qb)
	}
	if npm := load("network.yaml").Services["nginx-proxy-manager"]; npm.Meta.Web.Port != 81 || npm.BuildContext == "" || npm.Labels["com.centurylinklabs.watchtower.enable"] != "false" {
		t.Fatalf("npm: web %d, build %q, labels %v", npm.Meta.Web.Port, npm.BuildContext, npm.Labels)
	}
	if w := load("system.yaml").Services["watchtower"].Meta.Web; !w.Set || !w.Disabled {
		t.Fatalf("watchtower should have web: false, got %+v", w)
	}
}

func TestMergeKeysAndVolumes(t *testing.T) {
	f, err := Parse("/srv/x/compose.yaml", []byte(`
name: demo
x-base: &base
  restart: unless-stopped
  labels: [a=1]
services:
  app:
    <<: *base
    image: demo/app
    networks: [default, homelab]
    volumes:
      - ./data:/data
      - ${MEDIA:-/Volumes/Media}/music:/music:ro
      - cache:/cache
      - ~/x:/x
      - type: bind
        source: /etc/hosts
        target: /hosts
        read_only: true
  other:
    <<: *base
    labels:
      b: "2"
networks:
  homelab: {name: homelab, external: true}
`))
	if err != nil {
		t.Fatal(err)
	}
	app := f.Services["app"]
	if app.Labels["a"] != "1" || len(app.Networks) != 2 || len(app.Volumes) != 5 {
		t.Fatalf("app: labels %v networks %v volumes %d", app.Labels, app.Networks, len(app.Volumes))
	}
	if other := f.Services["other"]; other.Labels["b"] != "2" || other.Labels["a"] != "" {
		t.Fatalf("explicit labels should win over merged ones: %v", other.Labels)
	}
	lookup := MapLookup(nil)
	// A bind's source is a path on this computer, in its own form (the
	// target is always the container's).
	host := filepath.FromSlash
	want := []ResolvedVolume{
		{Source: host("/srv/x/data"), Target: "/data", Bind: true},
		{Source: host("/Volumes/Media/music"), Target: "/music", Bind: true},
		{Source: "cache", Target: "/cache"},
		{Source: host("/Users/me/x"), Target: "/x", Bind: true},
		{Source: host("/etc/hosts"), Target: "/hosts", Bind: true},
	}
	for i, v := range app.Volumes {
		got, err := v.Resolve(lookup, f.Dir, "/Users/me")
		if err != nil || got != want[i] {
			t.Errorf("volume %d: got %+v %v, want %+v", i, got, err, want[i])
		}
	}
	if !app.Volumes[1].ReadOnly || !app.Volumes[4].ReadOnly || app.Volumes[0].ReadOnly {
		t.Error("read-only flags not parsed")
	}
	if app.Volumes[4].Type != "bind" || app.Volumes[0].Type != "" {
		t.Errorf("types: %q %q", app.Volumes[4].Type, app.Volumes[0].Type)
	}
	if nw := f.Networks["homelab"]; !nw.External || nw.Name != "homelab" {
		t.Fatalf("network: %+v", nw)
	}
}

func repoFile(t *testing.T, name string) string {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", name)
}

func TestWindowsDrivePathsAreBinds(t *testing.T) {
	v := parseVolume("${MEDIA_ROOT}/movies:/movies")
	for _, root := range []string{`C:\media`, "D:/media"} {
		r, err := v.Resolve(MapLookup(map[string]string{"MEDIA_ROOT": root}), "/hl", "/home/me")
		if err != nil || !r.Bind {
			t.Errorf("%s: bind %v, err %v", root, r.Bind, err)
		}
	}
	if isDrivePath("C:media") || isDrivePath("data:/x") {
		t.Error("relative or named sources counted as drive paths")
	}
}

func TestInclude(t *testing.T) {
	dir := t.TempDir()
	write := func(name, body string) string {
		p := filepath.Join(dir, name)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
		return p
	}
	write("compose/media.yaml", "x-service: &service\n  restart: unless-stopped\nservices:\n  music:\n    <<: *service\n    image: navidrome\n    volumes: [./data/appdata/music:/data]\n    x-homelab: {name: Music, category: media}\n")
	main := write("compose.yaml", "name: homelab_core\ninclude:\n  - path: compose/media.yaml\n    project_directory: .\nservices:\n  proxy:\n    image: npm\n")
	f, err := Load(main)
	if err != nil {
		t.Fatal(err)
	}
	m := f.Services["music"]
	if m == nil || m.File != f || m.Source != filepath.Join(dir, "compose", "media.yaml") || f.Services["proxy"].Source != main || len(f.Includes) != 1 {
		t.Fatalf("included service: %+v, includes %v", m, f.Includes)
	}
	if strings.Join(f.Order, ",") != "music,proxy" {
		t.Errorf("order %v", f.Order)
	}

	bad := write("bad.yaml", "include:\n  - compose/media.yaml\n")
	if _, err := Load(bad); err == nil || !strings.Contains(err.Error(), "project_directory") {
		t.Errorf("an include without project_directory: %v", err)
	}
	dup := write("dup.yaml", "include:\n  - path: compose/media.yaml\n    project_directory: .\n  - path: compose/media.yaml\n    project_directory: .\n")
	if _, err := Load(dup); err == nil || !strings.Contains(err.Error(), "already defined") {
		t.Errorf("a service defined twice: %v", err)
	}
}
