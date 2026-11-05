package notify

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// The apps whose alerts are off are a record in data/, changed under its
// lock, not a line in .env: turning one off, twice, on again, and on when
// it was not off.
func TestQuietIsARecord(t *testing.T) {
	root := t.TempDir()
	for _, c := range []struct {
		app   string
		quiet bool
		want  string
	}{
		{"vikunja", true, "vikunja"},
		{"immich", true, "vikunja,immich"},
		{"vikunja", true, "immich,vikunja"},
		{"vikunja", false, "immich"},
		{"ntfy", false, "immich"},
	} {
		if err := SetQuiet(root, c.app, c.quiet); err != nil {
			t.Fatal(err)
		}
		if got := strings.Join(LoadQuiet(root, nil), ","); got != c.want {
			t.Errorf("after %s %v: %q, want %q", c.app, c.quiet, got, c.want)
		}
	}
	info, err := os.Stat(QuietPath(root))
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("the record is %v, want 0600", info.Mode().Perm())
	}
}

// Before the record, .env's ALERTS_OFF held them: they still count until
// CarryQuiet moves them into the record and takes the key out of .env,
// once, whatever was in the record already.
func TestQuietCarriedOverFromEnv(t *testing.T) {
	root := t.TempDir()
	env := map[string]string{"ALERTS_OFF": " paperless, ,vikunja"}
	if got := strings.Join(LoadQuiet(root, env), ","); got != "paperless,vikunja" {
		t.Errorf("before the carry-over: %q", got)
	}
	if err := SetQuiet(root, "immich", true); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(LoadQuiet(root, env), ","); got != "immich,paperless,vikunja" {
		t.Errorf("record and .env together: %q", got)
	}

	p := filepath.Join(root, ".env")
	if err := os.WriteFile(p, []byte("TZ=UTC\n# Apps the watchdog checks but does not alert about.\nALERTS_OFF=paperless,vikunja\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	f, _ := envfile.Load(p)
	if moved, err := CarryQuiet(root, f); err != nil || !moved {
		t.Fatalf("CarryQuiet: %v %v", moved, err)
	}
	if err := f.Save(); err != nil {
		t.Fatal(err)
	}
	f, _ = envfile.Load(p)
	if _, ok := f.Get("ALERTS_OFF"); ok {
		t.Error("ALERTS_OFF is still in .env")
	}
	if got := strings.Join(LoadQuiet(root, f.Map()), ","); got != "immich,paperless,vikunja" {
		t.Errorf("after the carry-over: %q", got)
	}
	if moved, err := CarryQuiet(root, f); err != nil || moved {
		t.Errorf("a second carry-over: %v %v", moved, err)
	}
}

// The app, a phone, and a terminal can each turn an app's alerts off at
// once: none of their changes is lost.
func TestQuietLosesNoChange(t *testing.T) {
	root := t.TempDir()
	var wg sync.WaitGroup
	for i := range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := SetQuiet(root, fmt.Sprintf("app%02d", i), true); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if got := LoadQuiet(root, nil); len(got) != 20 {
		t.Errorf("%d of 20 kept: %v", len(got), got)
	}
}
