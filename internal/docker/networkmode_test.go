package docker

import "testing"

// A container's network comes from HostConfig.NetworkMode: Connect apps
// reaches Prowlarr where its container really is (wiring.followContainers).
func TestParseInspectReadsNetworkMode(t *testing.T) {
	cs, err := ParseInspect([]byte(`[{"Id":"p","Name":"/prowlarr","HostConfig":{"NetworkMode":"container:abc"}},{"Id":"s","Name":"/sonarr","HostConfig":{"NetworkMode":"homelab"}},{"Id":"o","Name":"/old"}]`))
	if err != nil {
		t.Fatal(err)
	}
	for i, want := range []string{"container:abc", "homelab", ""} {
		if cs[i].NetworkMode != want {
			t.Errorf("%s: %q, want %q", cs[i].Name, cs[i].NetworkMode, want)
		}
	}
}
