package homepage

import (
	"os"
	"path/filepath"
	"testing"
)

// Homepage's config is replaced whole, never rewritten in place: the
// Homepage container reads it live, and a read at that moment would show
// a dashboard with half its apps.
func TestTheConfigIsReplacedWhole(t *testing.T) {
	path := filepath.Join(t.TempDir(), "services.yaml")
	if _, err := Write(path, []byte(Marker+"\n- one\n")); err != nil {
		t.Fatal(err)
	}
	was, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Write(path, []byte(Marker+"\n- one\n- two\n")); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("the config was rewritten in place")
	}
}
