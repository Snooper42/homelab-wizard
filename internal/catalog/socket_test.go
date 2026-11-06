package catalog

import (
	"strings"
	"testing"
)

// Whatever mounts Docker's socket controls the computer, read-only mount
// or not (docs/Security.md, Docker socket): whoever controls its image
// would too. So it is pinned to a version and updated by hand after
// reading its notes, never by the nightly update (M6).
func TestWhatHoldsTheDockerSocketIsPinned(t *testing.T) {
	n := 0
	for _, a := range load(t).Apps {
		holds := false
		for _, v := range a.Volumes {
			holds = holds || strings.HasSuffix(strings.SplitN(v.Target, ":", 2)[0], "docker.sock")
		}
		if !holds {
			continue
		}
		n++
		if a.Meta.Pin == "" {
			t.Errorf("%s holds Docker's socket but the nightly update takes it (no x-homelab pin)", a.ID)
		}
		if tag := a.Image[strings.LastIndex(a.Image, ":")+1:]; !strings.Contains(a.Image, ":") || tag == "latest" || !strings.Contains(tag, "_VERSION") && !strings.ContainsAny(tag, "0123456789") {
			t.Errorf("%s holds Docker's socket on a moving tag: %s", a.ID, a.Image)
		}
	}
	if n < 2 {
		t.Errorf("only %d apps hold Docker's socket: the test no longer sees the volumes", n)
	}
}
