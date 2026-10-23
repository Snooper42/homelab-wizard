package main

import (
	"io"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// In Home mode the phone's ntfy app needs ntfy's tailnet address, never the
// template's example domain.
func TestNtfyPhoneAddress(t *testing.T) {
	c, err := catalog.Load(repoDir())
	if err != nil {
		t.Fatal(err)
	}
	h := &homelab{ui: &ui.UI{Out: io.Discard}, catalog: c}
	for _, tc := range []struct {
		env  map[string]string
		want string
	}{
		{map[string]string{"HOMELAB_DOMAIN": "home.example.org"}, "https://ntfy.home.example.org"},
		{map[string]string{"TAILSCALE_HOST": "homelab.tail1.ts.net", "NTFY_PORT": "9293"}, "https://homelab.tail1.ts.net:9293"},
		{map[string]string{}, "on your tailnet"},
	} {
		got := h.ntfyPhoneAddress(tc.env)
		if !strings.Contains(got, tc.want) || strings.Contains(got, "example.com") {
			t.Errorf("%v: %q", tc.env, got)
		}
	}
}
