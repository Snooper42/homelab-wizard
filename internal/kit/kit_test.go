package kit

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func repo(t *testing.T, files map[string]string) (string, []string) {
	t.Helper()
	root := t.TempDir()
	var names []string
	for name, body := range files {
		p := filepath.Join(root, filepath.FromSlash(name))
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		mode := os.FileMode(0o644)
		if name == "homelab" {
			mode = 0o755
		}
		if err := os.WriteFile(p, []byte(body), mode); err != nil {
			t.Fatal(err)
		}
		names = append(names, name)
	}
	return root, names
}

func pack(t *testing.T, files map[string]string, commit string) string {
	t.Helper()
	root, names := repo(t, files)
	var buf bytes.Buffer
	if _, err := Pack(&buf, root, names, "0.1.0", commit); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(t.TempDir(), FileName)
	if err := os.WriteFile(out, buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	return out
}

func read1(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		return "<missing>"
	}
	return string(data)
}

func TestExtractAndUpdate(t *testing.T) {
	v1 := pack(t, map[string]string{
		"compose.yaml": "name: homelab_core\n", ".env.example": "A=1\n", "homelab": "#!/bin/bash\n",
		"docs/Old.md": "old", "docs/Mine.md": "v1", "app/main.go": "package main", "docs/images/x.png": "png",
		".env": "SECRET=1", "stacks/custom/compose.yaml": "mine",
	}, "aaaaaaaaaa1")
	m, err := Info(v1)
	if err != nil || m.Short() != "aaaaaaa" || len(m.Files) != 5 {
		t.Fatalf("info %+v %v", m, err)
	}
	dest := filepath.Join(t.TempDir(), "Homelab")
	if _, err := Extract(v1, dest); err != nil {
		t.Fatal(err)
	}
	if fi, err := os.Stat(filepath.Join(dest, "homelab")); err != nil || (runtime.GOOS != "windows" && fi.Mode()&0o111 == 0) { // Windows has no execute bit (homelab.cmd runs there)
		t.Errorf("the launcher should be executable: %v", err)
	}
	for _, gone := range []string{"app/main.go", "docs/images/x.png", ".env", "stacks/custom/compose.yaml"} {
		if _, err := os.Stat(filepath.Join(dest, gone)); err == nil {
			t.Errorf("%s should not be in the kit", gone)
		}
	}
	if _, ok := Installed(dest); !ok {
		t.Fatal("no marker after extract")
	}
	if _, err := Extract(v1, dest); err == nil || !strings.Contains(err.Error(), "already has files") {
		t.Errorf("extracting over a folder: %v", err)
	}

	// The household's own files, and an edit to one of the kit's.
	_ = os.WriteFile(filepath.Join(dest, ".env"), []byte("SECRET=real"), 0o600)
	_ = os.WriteFile(filepath.Join(dest, "docs", "Mine.md"), []byte("my edit"), 0o644)

	v2 := pack(t, map[string]string{
		"compose.yaml": "name: homelab_core\ninclude: []\n", ".env.example": "A=1\n", "homelab": "#!/bin/bash\n",
		"docs/Mine.md": "v2", "docs/New.md": "new",
	}, "bbbbbbbbbb2")
	m2, changes, err := Update(v2, dest)
	if err != nil || m2.Short() != "bbbbbbb" {
		t.Fatalf("update %+v %v", m2, err)
	}
	got := map[string]string{}
	for _, c := range changes {
		got[c.Path] = c.What
	}
	want := map[string]string{"compose.yaml": "updated", "docs/New.md": "added", "docs/Old.md": "removed", "docs/Mine.md": "kept your copy as docs/Mine.md.local"}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s: %q, want %q (all: %v)", k, got[k], v, changes)
		}
	}
	if len(changes) != len(want) {
		t.Errorf("unchanged files should not be listed: %v", changes)
	}
	if read1(t, filepath.Join(dest, ".env")) != "SECRET=real" || read1(t, filepath.Join(dest, "docs", "Mine.md")) != "v2" || read1(t, filepath.Join(dest, "docs", "Mine.md.local")) != "my edit" {
		t.Error("settings kept, the new version written, and the edit saved beside it")
	}
	if m, _ := Installed(dest); m.Commit != "bbbbbbbbbb2" {
		t.Errorf("marker %+v", m)
	}
}

func TestUpdateRefusesACheckout(t *testing.T) {
	v1 := pack(t, map[string]string{"compose.yaml": "x"}, "c1c1c1c1")
	if _, _, err := Update(v1, t.TempDir()); err == nil || !strings.Contains(err.Error(), "homelab upgrade") {
		t.Errorf("a folder the app did not make: %v", err)
	}
}

func TestNotAKit(t *testing.T) {
	p := filepath.Join(t.TempDir(), "x.tar.gz")
	_ = os.WriteFile(p, []byte("not gzip"), 0o644)
	if _, err := Info(p); err == nil {
		t.Error("a non-kit should be refused")
	}
}

// The CLI embeds web/ (the phone companion), so a kit without it cannot
// build the CLI where Go is installed.
func TestKitCarriesWhatTheCLIBuildsFrom(t *testing.T) {
	for _, p := range []string{"web/web.go", "web/dist/app.js", "cmd/homelab/main.go", "internal/core/core.go", "go.mod"} {
		if !Included(p) {
			t.Errorf("%s is left out of the kit", p)
		}
	}
	for _, p := range []string{"app/main.go", "assets/logo.svg", ".github/workflows/ci.yml"} {
		if Included(p) {
			t.Errorf("%s is in the kit", p)
		}
	}
}

func TestReadFileAndEdited(t *testing.T) {
	archive := pack(t, map[string]string{"compose.yaml": "name: homelab_core\n", "docs/Mine.md": "v1"}, "abc")
	if got, err := ReadFile(archive, "docs/Mine.md"); err != nil || string(got) != "v1" {
		t.Fatalf("%q %v", got, err)
	}
	if _, err := ReadFile(archive, "docs/None.md"); err == nil || !strings.Contains(err.Error(), "has no docs/None.md") {
		t.Fatalf("a file the kit has not: %v", err)
	}
	if _, err := ReadFile(filepath.Join(t.TempDir(), "gone.zip"), "x"); err == nil {
		t.Fatal("no archive")
	}
	if m, _ := Info(archive); m.Short() != "abc" {
		t.Fatalf("a short commit: %q", m.Short())
	}

	dest := filepath.Join(t.TempDir(), "Homelab")
	m, err := Extract(archive, dest)
	if err != nil {
		t.Fatal(err)
	}
	if got := Edited(dest, m); len(got) != 0 {
		t.Fatalf("edited before any edit: %v", got)
	}
	os.WriteFile(filepath.Join(dest, "docs", "Mine.md"), []byte("mine"), 0o644)
	os.Remove(filepath.Join(dest, "compose.yaml")) // removed is not edited
	if got := Edited(dest, m); len(got) != 1 || got[0] != "docs/Mine.md" {
		t.Fatalf("edited: %v", got)
	}
}

// The kit beside the program, where each system's package puts it.
func TestBundled(t *testing.T) {
	old := executable
	t.Cleanup(func() { executable = old })
	for _, c := range []struct{ name, exe, kit string }{
		{"macOS", "Homelab Wizard.app/Contents/MacOS/homelab-wizard", "Homelab Wizard.app/Contents/Resources/" + FileName},
		{"Windows", "Homelab Wizard/homelab-wizard.exe", "Homelab Wizard/" + FileName},
		{"Linux", "usr/bin/homelab-wizard", "usr/share/homelab-wizard/" + FileName},
	} {
		root := t.TempDir()
		exe := filepath.Join(root, filepath.FromSlash(c.exe))
		os.MkdirAll(filepath.Dir(exe), 0o755)
		os.WriteFile(exe, nil, 0o755)
		executable = func() (string, error) { return exe, nil }
		if got := Bundled(); got != "" {
			t.Errorf("%s: a kit before there is one: %s", c.name, got)
		}
		kit := filepath.Join(root, filepath.FromSlash(c.kit))
		os.MkdirAll(filepath.Dir(kit), 0o755)
		os.WriteFile(kit, []byte("zip"), 0o644)
		if got, _ := filepath.EvalSymlinks(Bundled()); got != mustReal(t, kit) {
			t.Errorf("%s: %q, want %q", c.name, got, kit)
		}
	}
	executable = func() (string, error) { return "", os.ErrNotExist }
	if Bundled() != "" {
		t.Error("a kit without a program")
	}
}

func mustReal(t *testing.T, p string) string {
	t.Helper()
	r, err := filepath.EvalSymlinks(p)
	if err != nil {
		t.Fatal(err)
	}
	return r
}
