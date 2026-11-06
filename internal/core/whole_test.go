package core

import (
	"os"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// The note of the last Docker read that went back to the CLI is replaced
// whole, never rewritten in place: the app reads it for Status's note.
func TestTheAPIFallbackNoteIsReplacedWhole(t *testing.T) {
	root := t.TempDir()
	if err := SaveAPIFallback(root, docker.Fallback{When: time.Now(), Read: "containers"}); err != nil {
		t.Fatal(err)
	}
	was, err := os.Stat(apiFallbackPath(root))
	if err != nil {
		t.Fatal(err)
	}
	if err := SaveAPIFallback(root, docker.Fallback{When: time.Now(), Read: "info"}); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(apiFallbackPath(root))
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("docker-api.json was rewritten in place")
	}
}
