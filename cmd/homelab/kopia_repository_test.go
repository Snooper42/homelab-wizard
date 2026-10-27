package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

func TestKopiaRepository(t *testing.T) {
	calls := fakeDocker(t, nil)
	root, _ := repoCopy(t)
	env, _ := envfile.Load(filepath.Join(root, ".env"))
	dup, _ := env.Get("BACKUP_DESTINATION")
	for _, c := range []struct {
		args []string
		want string
	}{
		{[]string{"kopia"}, "usage"},
		{[]string{"kopia", "melt"}, "unknown kopia command"},
		{[]string{"kopia", "repository"}, "usage"},
		{[]string{"kopia", "repository", filepath.Join(dup, "kopia"), "--apply"}, "Duplicati's backups"},
		{[]string{"kopia", "repository", filepath.Join(root, "data", "kopia-here"), "--apply"}, "folders Kopia backs up"},
	} {
		if out, code := homelabCmd(t, root, "", c.args...); code == 0 || !strings.Contains(out, c.want) {
			t.Errorf("%v: exit %d, want %q\n%s", c.args, code, c.want, out)
		}
	}
	repo := filepath.Join(t.TempDir(), "Homelab Kopia")
	if out, code := homelabCmd(t, root, "", "kopia", "repository", repo); code != 0 || !strings.Contains(out, "Preview only") {
		t.Fatalf("without --apply only a preview: exit %d\n%s", code, out)
	}
	if _, err := os.Stat(repo); err == nil {
		t.Fatal("a preview made the folder")
	}
	out, code := homelabCmd(t, root, "", "kopia", "repository", repo, "--apply")
	if code != 0 || !strings.Contains(out, "homelab install kopia") {
		t.Fatalf("exit %d\n%s", code, out)
	}
	if st, err := os.Stat(repo); err != nil || !st.IsDir() {
		t.Fatal("the folder was not made")
	}
	saved, _ := envfile.Load(filepath.Join(root, ".env"))
	if got, _ := saved.Get("KOPIA_REPOSITORY"); got != repo {
		t.Fatalf("KOPIA_REPOSITORY=%q, want %q", got, repo)
	}
	if strings.Contains(readCalls(t, calls), "--force-recreate") {
		t.Error("Kopia is not installed, yet it was recreated")
	}

	// Installed: moved to a folder that already holds a repository, it
	// says it connects there, keeps the old copies, and starts again.
	calls = fakeDocker(t, []docker.FakeContainer{{Name: "kopia", Image: "kopia/kopia:0.23.1", Running: true, Project: "homelab_system", Service: "kopia"}})
	_ = os.WriteFile(filepath.Join(repo, "kopia.repository.f"), []byte("{}"), 0o600)
	next := t.TempDir()
	_ = os.WriteFile(filepath.Join(next, "kopia.repository.f"), []byte("{}"), 0o600)
	out, code = homelabCmd(t, root, "", "kopia", "repository", next, "--apply")
	if code != 0 || !strings.Contains(out, "already there") || !strings.Contains(out, "stay there") || !strings.Contains(out, "started again") {
		t.Fatalf("exit %d\n%s", code, out)
	}
	if got := readCalls(t, calls); !strings.Contains(got, "--force-recreate kopia") {
		t.Errorf("Kopia was not recreated:\n%s", got)
	}
}
