package custom

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// repoCopy copies the compose files and .env.example into a temp folder.
func repoCopy(t *testing.T) string {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	src := filepath.Join(filepath.Dir(file), "..", "..")
	root := t.TempDir()
	files, _ := filepath.Glob(filepath.Join(src, "stacks", "*", "compose.yaml"))
	parts, _ := filepath.Glob(filepath.Join(src, "compose", "*.yaml"))
	files = append(files, parts...)
	files = append(files, filepath.Join(src, "compose.yaml"), filepath.Join(src, ".env.example"))
	for _, f := range files {
		rel, _ := filepath.Rel(src, f)
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		os.MkdirAll(filepath.Dir(filepath.Join(root, rel)), 0o755)
		if err := os.WriteFile(filepath.Join(root, rel), data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func TestAddAndRemove(t *testing.T) {
	root := repoCopy(t)
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	spec := Spec{ID: Slug("My Wiki!"), Name: "My Wiki", Image: "ghcr.io/requarks/wiki:2", Port: 3000, Category: "productivity",
		Volumes: []string{"/wiki/data"}, Env: map[string]string{"DB_TYPE": "sqlite", "NOTE": "costs $5"}}
	if spec.ID != "my-wiki" {
		t.Fatalf("slug %q", spec.ID)
	}
	next, port, err := Add(root, c, spec, nil)
	if err != nil {
		t.Fatal(err)
	}
	a, ok := next.Get("my-wiki")
	if !ok || !a.Optional() || !a.HasWeb() || a.Name() != "My Wiki" || port < 18000 {
		t.Fatalf("app %+v, port %d", a, port)
	}
	if len(Apps(next)) != 1 || len(a.Volumes) != 1 || !strings.Contains(a.Volumes[0].Raw, "data/appdata/my-wiki/wiki-data:/wiki/data") {
		t.Fatalf("volumes %+v", a.Volumes)
	}
	stack, _ := os.ReadFile(filepath.Join(root, File))
	if !strings.Contains(string(stack), `NOTE: "costs $$5"`) {
		t.Fatalf("$ not escaped:\n%s", stack)
	}
	if !strings.Contains(string(stack), fmt.Sprintf("127.0.0.1}:%d:3000", port)) || !a.Custom() {
		t.Fatalf("port or custom flag:\n%s", stack)
	}

	// Taken IDs, bad images, and unknown categories leave everything as it was.
	for _, bad := range []Spec{
		{ID: "my-wiki", Name: "Again", Image: "x/y", Category: "documents"},
		{ID: "sonarr", Name: "Sonarr", Image: "x/y", Category: "documents"},
		{ID: "other", Name: "Other", Image: "bad image", Category: "documents"},
		{ID: "other", Name: "Other", Image: "x/y", Category: "nope"},
		{ID: "other", Name: "Other", Image: "x/y", Category: "documents", Volumes: []string{"relative"}},
	} {
		if _, _, err := Add(root, next, bad, nil); err == nil {
			t.Errorf("accepted %+v", bad)
		}
	}
	if after, _ := os.ReadFile(filepath.Join(root, File)); string(after) != string(stack) {
		t.Fatal("a refused app changed the stack")
	}

	if err := Remove(root, "my-wiki"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, File)); !os.IsNotExist(err) {
		t.Fatal("the empty stack file was kept")
	}
	if err := Remove(root, "my-wiki"); err == nil {
		t.Fatal("removed twice")
	}
}

func TestRemoveKeepsOtherTopLevelSections(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, File)
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	_ = os.WriteFile(path, []byte("services:\n  wiki:\n    image: a\n  notes:\n    image: b\nvolumes:\n  wikidata:\n"), 0o644)
	if err := Remove(root, "notes"); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	if want := "services:\n  wiki:\n    image: a\nvolumes:\n  wikidata:\n"; string(data) != want {
		t.Fatalf("got:\n%s", data)
	}
}

func TestVolumePathsAreChecked(t *testing.T) {
	c, err := catalog.Load(repoCopy(t))
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range []string{"/data #x", "/..", "/a/../b", "/with space", "data"} {
		s := Spec{ID: "my-app", Name: "Mine", Image: "nginx", Category: "documents", Volumes: []string{v}}
		if err := s.Check(c); err == nil || !strings.Contains(err.Error(), "folder") {
			t.Errorf("%q: %v", v, err)
		}
	}
}

// Your own app's settings are often a database password or an API key, so
// the command that adds it (from the desktop app or the web page) carries
// them on its input, never its command line, where anyone on the machine
// could read them in the process list (Q review of #911).
func TestAddArgsKeepSettingsOffTheCommandLine(t *testing.T) {
	s := Spec{ID: "whiteboard", Name: "Whiteboard", Image: "docker.io/excalidraw/excalidraw:latest", Category: "documents", Port: 80,
		Volumes: []string{"/data"}, Env: map[string]string{"DB_PASSWORD": "s3cret-pw", "API_KEY": "k3y"}}
	args, stdin, err := s.AddArgs()
	if err != nil {
		t.Fatal(err)
	}
	line := strings.Join(args, " ")
	for _, secret := range []string{"s3cret-pw", "k3y", "DB_PASSWORD", "--env "} {
		if strings.Contains(line, secret) {
			t.Errorf("%q on the command line: %s", secret, line)
		}
	}
	if !slices.Contains(args, "--env-stdin") || stdin != "API_KEY=k3y\nDB_PASSWORD=s3cret-pw\n" {
		t.Errorf("args %q, stdin %q", args, stdin)
	}
	if want := "custom add whiteboard --image docker.io/excalidraw/excalidraw:latest --name Whiteboard --category documents --apply --port 80 --volume /data --env-stdin"; line != want {
		t.Errorf("args:\n%s\nwant\n%s", line, want)
	}
	// No settings: nothing to read.
	s.Env = nil
	if args, stdin, _ := s.AddArgs(); slices.Contains(args, "--env-stdin") || stdin != "" {
		t.Errorf("no settings: %q %q", args, stdin)
	}
	// A setting with a line break would set another.
	s.Env = map[string]string{"A": "x\nB=y"}
	if _, _, err := s.AddArgs(); err == nil {
		t.Error("a setting with a line break was taken")
	}
}
