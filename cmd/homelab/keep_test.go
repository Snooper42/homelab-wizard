package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// ntfyWith is ntfy's container with its own folder, a file it only reads,
// and a folder outside the homelab.
func ntfyWith(root, imageID string) docker.FakeContainer {
	return docker.FakeContainer{Name: "ntfy", Image: "binwiederhier/ntfy:latest", ImageID: imageID, Running: true, Project: "homelab_security", Service: "ntfy",
		Mounts: []docker.Mount{
			{Type: "bind", Source: filepath.Join(root, "data", "appdata", "ntfy"), Target: "/var/lib/ntfy", Writable: true},
			{Type: "bind", Source: filepath.Join(root, "config", "ntfy"), Target: "/etc/ntfy", Writable: false},
			{Type: "bind", Source: filepath.Join(root, "recovery-staging"), Target: "/staging", Writable: true},
			{Type: "volume", Name: "homelab_security_ntfy-cache", Target: "/var/cache/ntfy", Writable: true},
			{Type: "volume", Name: "0123456789abcdef", Target: "/tmp", Writable: true},
		}}
}

func TestUpdateKeepsACopyFirst(t *testing.T) {
	root, _ := repoCopy(t)
	_ = os.MkdirAll(filepath.Join(root, "data", "appdata", "ntfy"), 0o755)
	calls := fakeDocker(t, []docker.FakeContainer{ntfyWith(root, "sha256:old")})

	// No newer image: no copy, and ntfy is not stopped.
	t.Setenv("FAKE_IMAGE_ID", "sha256:old")
	if out, code := homelabCmd(t, root, "", "update", "ntfy"); code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if strings.Contains(readCalls(t, calls), "stop ntfy") || len(backup.Copies(filepath.Join(root, "recovery-staging"), "ntfy")) > 0 {
		t.Fatalf("copied with no newer image:\n%s", readCalls(t, calls))
	}

	// A newer image: stopped, its folder and volume copied, then started on it.
	t.Setenv("FAKE_IMAGE_ID", "sha256:new")
	out, code := homelabCmd(t, root, "", "update", "ntfy")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	log := readCalls(t, calls)
	pull, stop, tar, up := strings.Index(log, "pull --ignore-buildable ntfy"), strings.Index(log, "stop ntfy"), strings.Index(log, "tar czf"), strings.LastIndex(log, "up --detach ntfy")
	if pull < 0 || stop < pull || tar < stop || up < tar {
		t.Fatalf("pull, stop, copy, then up:\n%s", log)
	}
	cp, ok := backup.LatestCopy(filepath.Join(root, "recovery-staging"), "ntfy")
	if !ok || cp.ImageID != "sha256:old" || len(cp.Mounts) != 2 {
		t.Fatalf("copy: %+v", cp)
	}
	for _, m := range cp.Mounts {
		if st, err := os.Stat(filepath.Join(cp.Dir, m.Archive)); err != nil || st.Size() == 0 {
			t.Errorf("%s: no archive", m.Source)
		}
	}
	if cp.Mounts[0].Kind != "folder" || cp.Mounts[1].Source != "homelab_security_ntfy-cache" || !strings.Contains(out, "copied data/appdata/ntfy, homelab_security_ntfy-cache") {
		t.Errorf("copy %+v\n%s", cp.Mounts, out)
	}

	// Over UPDATE_COPY_LIMIT: left out, and said.
	t.Setenv("FAKE_DU_KB", "3000000")
	out, code = homelabCmd(t, root, "", "update", "ntfy")
	if code != 0 || !strings.Contains(out, "not copied") || !strings.Contains(out, "UPDATE_COPY_LIMIT") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if cs := backup.Copies(filepath.Join(root, "recovery-staging"), "ntfy"); len(cs) != 1 || len(cs[0].Skipped) != 2 {
		t.Errorf("only the newest copy is kept, with both left out: %+v", cs)
	}
}

func TestRollbackPutsTheDataBack(t *testing.T) {
	root, _ := repoCopy(t)
	_ = os.MkdirAll(filepath.Join(root, "data", "appdata", "ntfy"), 0o755)
	calls := fakeDocker(t, []docker.FakeContainer{ntfyWith(root, "sha256:old")})
	t.Setenv("FAKE_IMAGE_ID", "sha256:new")
	if out, code := homelabCmd(t, root, "", "update", "ntfy"); code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	path := updates.HistoryPath(root)
	hist := updates.LoadHistory(path)
	hist.Apps["ntfy"] = &updates.Record{Ref: "binwiederhier/ntfy:latest", Current: "sha256:new", Previous: "sha256:old", Updated: time.Now().Add(-time.Hour)}
	if err := hist.Save(path); err != nil {
		t.Fatal(err)
	}
	calls = fakeDocker(t, []docker.FakeContainer{ntfyWith(root, "sha256:new")})

	out, code := homelabCmd(t, root, "", "rollback", "ntfy")
	if code != 0 || !strings.Contains(out, "put back its data from just before the update") {
		t.Fatalf("preview: exit %d\n%s", code, out)
	}
	out, code = homelabCmd(t, root, "", "rollback", "ntfy", "--apply")
	log := readCalls(t, calls)
	if code != 0 || !strings.Contains(out, "what it held since is in recovery-staging/rolled-back/ntfy") {
		t.Fatalf("exit %d:\n%s\n%s", code, out, log)
	}
	// Today's set aside before anything is put back, then the earlier image.
	aside, load, up := strings.LastIndex(log, "tar czf"), strings.Index(log, "tar xzf"), strings.LastIndex(log, "up --detach --no-deps --force-recreate ntfy")
	if aside < 0 || load < aside || up < load {
		t.Fatalf("set aside, put back, then started:\n%s", log)
	}
	if dirs, _ := filepath.Glob(filepath.Join(root, "recovery-staging", "rolled-back", "ntfy", "*", "*.tar.gz")); len(dirs) != 2 {
		t.Errorf("today's data set aside: %v", dirs)
	}

	// --data on its own, after a rollback that kept today's data.
	fakeDocker(t, []docker.FakeContainer{ntfyWith(root, "sha256:old")})
	if out, code := homelabCmd(t, root, "", "rollback", "ntfy", "--data", "--apply"); code != 0 || !strings.Contains(out, "data is as it was before the update") {
		t.Fatalf("--data: exit %d\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "rollback", "ntfy", "--data", "--image-only"); code == 0 || !strings.Contains(out, "usage") {
		t.Errorf("both: exit %d\n%s", code, out)
	}
}
