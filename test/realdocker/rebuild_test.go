//go:build realdocker

package realdocker

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/duplicati"
)

// TestRebuildFromDuplicati is Disaster Recovery's full rebuild against real
// Docker, on a homelab of its own: apps with data in them, the nightly
// backup, and every Duplicati job run into a backup folder beside the
// homelab, as a backup drive would be; then the homelab wiped, and `homelab
// rebuild <that folder>` with DUPLICATI_SECRETS_PASSPHRASE brings back .env,
// the apps' data, and the databases from those backups alone (1.0: "A
// restore brings back the versions that wrote the data"), each app
// answering with its data again. The rebuild's time goes on the run's
// summary page. REALDOCKER_REBUILD=1 runs it (the nightly workflow's
// rebuild job).
func TestRebuildFromDuplicati(t *testing.T) {
	if os.Getenv("REALDOCKER_REBUILD") == "" {
		t.Skip("REALDOCKER_REBUILD is not set")
	}
	l := newLab(t)
	t.Cleanup(func() {
		if t.Failed() {
			l.keepReport()
		}
		_, _ = l.try("uninstall", "--data", "--apply")
	})
	var as []realApp
	for _, a := range apps {
		if slices.Contains([]string{"duplicati", "vaultwarden", "paperless", "actual-budget", "firefly-iii"}, a.id) {
			as = append(as, a)
		}
	}
	var ids []string
	for _, a := range as {
		ids = append(ids, a.id)
	}
	l.run(append([]string{"install"}, append(ids, "--apply")...)...)
	l.setEnv("HOMELAB_BASELINE", "small")
	for _, key := range []string{"MEDIA_ROOT", "DOWNLOADS_ROOT", "IMMICH_UPLOAD_LOCATION"} {
		if dir := l.env(key); dir != "" {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				t.Fatal(err)
			}
		}
	}
	l.run("up", "--apply")
	l.up(as)
	// Duplicati's seed gives it the backup folder beside the homelab and
	// makes its jobs; the others put their data in.
	for _, a := range as {
		if a.seed != nil {
			if err := a.seed(l); err != nil {
				t.Fatalf("%s: %v", a.id, err)
			}
		}
	}

	// The night: the backup's copies, then every Duplicati job.
	l.run("backup")
	runDuplicatiJobs(t, l)
	dest, secret := l.env("BACKUP_DESTINATION"), l.env(duplicati.SecretsPassphraseKey)
	if dest == "" || secret == "" {
		t.Fatalf("BACKUP_DESTINATION %q, a Secrets passphrase set: %v", dest, secret != "")
	}

	// The machine is lost: nothing of the homelab is left but its files.
	l.run("uninstall", "--data", "--apply")
	if entries, _ := os.ReadDir(filepath.Join(l.root, "data", "appdata")); len(entries) > 0 {
		t.Fatalf("data/appdata still holds %d entries after uninstall --data", len(entries))
	}

	t.Setenv(duplicati.SecretsPassphraseKey, secret)
	start := time.Now()
	l.run("rebuild", dest, "--apply")
	l.up(as)
	for _, a := range as {
		if a.check != nil {
			if err := a.check(l); err != nil {
				t.Errorf("%s after the rebuild: %v", a.id, err)
			}
		}
	}
	if !t.Failed() {
		took := time.Since(start).Round(time.Second)
		t.Logf("the rebuild: %d apps back with their data from Duplicati's backups in %s", len(as), took)
		l.summary(fmt.Sprintf("Rebuild from Duplicati's backups: %d apps back with their data in %s, on a wiped machine", len(as), took))
	}
}

// runDuplicatiJobs runs each of Duplicati's jobs now, as the night would,
// one after another, and waits for each to finish without an error.
func runDuplicatiJobs(t *testing.T, l *lab) {
	t.Helper()
	port := l.env("DUPLICATI_PORT")
	if port == "" {
		port = "8200"
	}
	base := "http://127.0.0.1:" + port
	ctx := context.Background()
	c, err := duplicati.Login(ctx, base, l.env("DUPLICATI_PASSWORD"))
	if err != nil {
		t.Fatal(err)
	}
	var login struct{ AccessToken string }
	if err := request("POST", base+"/api/v1/auth/login", map[string]any{"Password": l.env("DUPLICATI_PASSWORD"), "RememberMe": false}, &login); err != nil {
		t.Fatal(err)
	}
	if err := duplicatiIdle(base, login.AccessToken, 10*time.Minute); err != nil {
		t.Fatal(err)
	}
	jobs, err := c.Jobs(ctx, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	for _, j := range jobs {
		since := time.Now()
		if err := c.Run(ctx, j.ID); err != nil {
			t.Fatalf("running %s: %v", j.Name, err)
		}
		if err := duplicatiIdle(base, login.AccessToken, 10*time.Minute); err != nil {
			t.Fatalf("%s: %v", j.Name, err)
		}
		done, err := c.Jobs(ctx, time.Now())
		if err != nil {
			t.Fatal(err)
		}
		for _, d := range done {
			if d.ID != j.ID {
				continue
			}
			if d.LastFinished.Before(since) || d.LastError.After(since) {
				t.Fatalf("%s did not back up: finished %s, %q", j.Name, d.LastFinished, d.ErrorMessage)
			}
			t.Logf("%s backed up", j.Name)
		}
	}
}
