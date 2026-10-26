package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/progress"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// In a terminal, Compose's output becomes a line per app: drawn again in
// place while its download moves, ended when it runs, and anything else
// Compose says kept below.
func TestAppRows(t *testing.T) {
	c, err := catalog.Load(repoDir())
	if err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	u := &ui.UI{Out: &out, Live: true}
	r := newAppRows(u, progress.New(c, nil))
	for _, l := range []string{
		`{"id":"Image deluan/navidrome:latest","status":"Working","text":"Pulling"}`,
		`{"id":"39c2ddfd6010","parent_id":"Image deluan/navidrome:latest","status":"Working","text":"Downloading","details":"8.389MB","current":8388608,"total":15522356,"percent":54}`,
		`{"id":"39c2ddfd6010","parent_id":"Image deluan/navidrome:latest","status":"Working","text":"Downloading","details":"8.389MB","current":8388608,"total":15522356,"percent":54}`,
		`{"id":"Container homelab_media-navidrome-1","status":"Working","text":"Creating"}`,
		`{"id":"Container homelab_media-navidrome-1","status":"Done","text":"Started"}`,
		"Error response from daemon: something",
	} {
		r.Write([]byte(l + "\n"))
	}
	r.Write([]byte(`{"id":"Container homelab_media-feishin-1","status":"Working","text":"Creating"}`))
	r.Flush()
	got := out.String()
	for _, want := range []string{
		"  • Navidrome  Downloading\r\x1b[K  • Navidrome  Downloading · 54%\r\x1b[K",
		"  ✓ Navidrome  Running\n",
		"    Error response from daemon: something\n",
		"Feishin  Setting up\n",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("no %q in\n%q", want, got)
		}
	}
	if strings.Count(got, "Downloading · 54%") != 1 {
		t.Errorf("the same row drawn twice:\n%q", got)
	}
	if strings.Contains(got, "39c2ddfd6010") {
		t.Errorf("a layer's line got through:\n%q", got)
	}
}
