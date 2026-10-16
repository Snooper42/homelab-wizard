package docker

import (
	"testing"
	"time"
)

func TestParseInspect(t *testing.T) {
	data := []byte(`[
	 {"Id": "abc", "Name": "/homelab_core-vaultwarden-1", "RestartCount": 3,
	  "Config": {"Image": "vaultwarden/server:latest", "Labels": {"com.docker.compose.project": "homelab_core", "com.docker.compose.service": "vaultwarden"}},
	  "State": {"Status": "running", "Running": true, "StartedAt": "2026-10-11T07:30:15.123456789Z", "Health": {"Status": "healthy"}},
	  "NetworkSettings": {"Ports": {"80/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8087"}]}}},
	 {"Id": "def", "Name": "/never-started", "Config": {"Image": "busybox"},
	  "State": {"Status": "created", "Running": false, "StartedAt": "0001-01-01T00:00:00Z"}}
	]`)
	got, err := ParseInspect(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d containers", len(got))
	}
	vw := got[0]
	want := time.Date(2026, 10, 11, 7, 30, 15, 123456789, time.UTC)
	if vw.Name != "homelab_core-vaultwarden-1" || !vw.Running || vw.Health != "healthy" || vw.Restarts != 3 || !vw.StartedAt.Equal(want) {
		t.Errorf("vaultwarden = %+v", vw)
	}
	if vw.Service() != "vaultwarden" || len(vw.Ports) != 1 || vw.Ports[0].HostPort != 8087 {
		t.Errorf("labels or ports: %+v", vw)
	}
	if never := got[1]; !never.StartedAt.IsZero() || never.Labels == nil {
		t.Errorf("a container that never started: %+v", never)
	}
}

func TestParseDiskUsage(t *testing.T) {
	out := []byte(`{"Active":"4","Reclaimable":"12.3GB (51%)","Size":"24.1GB","TotalCount":"9","Type":"Images"}
{"Active":"4","Reclaimable":"0B (0%)","Size":"1.2MB","TotalCount":"4","Type":"Containers"}
{"Active":"0","Reclaimable":"1.1GB","Size":"1.1GB","TotalCount":"12","Type":"Build Cache"}
`)
	us, err := ParseDiskUsage(out)
	if err != nil || len(us) != 3 {
		t.Fatalf("%v %+v", err, us)
	}
	if us[0].Type != "Images" || us[0].Size != "24.1GB" || us[0].Unused() != "12.3GB" || us[2].Unused() != "1.1GB" {
		t.Errorf("%+v", us)
	}
	if us, err := ParseDiskUsage(nil); err != nil || len(us) != 0 {
		t.Errorf("empty: %v %+v", err, us)
	}
}

func TestParseStats(t *testing.T) {
	out := []byte(`{"CPUPerc":"0.12%","MemUsage":"40MiB / 7.6GiB","Name":"vaultwarden"}
{"CPUPerc":"143.50%","MemUsage":"1.2GiB / 7.6GiB","Name":"immich_machine_learning"}
{"CPUPerc":"--","MemUsage":"-- / --","Name":"starting"}
`)
	st, err := ParseStats(out)
	if err != nil || len(st) != 3 {
		t.Fatalf("%v %+v", err, st)
	}
	if st[0].Name != "immich_machine_learning" || st[0].CPU != 143.5 || st[0].Mem != "1.2GiB" || st[1].CPU != 0.12 || st[2].CPU != 0 {
		t.Errorf("%+v", st)
	}
	if st, err := ParseStats(nil); err != nil || len(st) != 0 {
		t.Errorf("empty: %v %+v", err, st)
	}
}
