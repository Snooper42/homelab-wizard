package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/recovery"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// KitFile is the printable recovery kit in the homelab folder.
const kitFile = "recovery-kit.html"

// backupHolds says, per Duplicati job folder, what the job keeps.
var backupHolds = map[string]string{ // #nosec G101 -- descriptions of backup jobs, no credentials
	"photos":         "Immich's photos and videos",
	"databases":      "a dump of every database",
	"secrets":        ".env, with every password and key",
	"appdata":        "the apps' settings and data (data/appdata)",
	"stack-data":     "the stacks' own data (appdata)",
	"infrastructure": "the stacks folder, your own apps included",
	"jellyfin":       "Jellyfin's library data",
	"calibre":        "the books",
}

// recoveryKit writes the printable recovery kit: where the backups and
// the passphrases are (never the passphrases), and how to restore.
func (h *homelab) recoveryKit(ctx context.Context, args []string) error {
	fs := newFlags("recovery-kit")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	env := h.envMap()
	k := recovery.Kit{Made: time.Now(), Machine: h.host.Name, Root: h.root, Destination: env["BACKUP_DESTINATION"], Domain: env["HOMELAB_DOMAIN"], TailnetHost: env["TAILSCALE_HOST"]}
	if h.host.Machine != "" {
		k.Machine += " · " + h.host.Machine
	}
	if c, err := upgrade.Inspect(ctx, h.root, false); err == nil && !c.Kit {
		k.Repository = c.Web
	}
	for _, j := range duplicati.HomelabJobs {
		k.Jobs = append(k.Jobs, recovery.Job{Name: j.Name, Holds: backupHolds[j.Folder]})
	}
	if client, err := h.docker(ctx); err == nil {
		if containers, err := client.Containers(ctx); err == nil {
			report := detect.Analyze(h.catalog, containers)
			for _, a := range h.catalog.Apps {
				if st, _ := report.State(a.ID); st == detect.Running && !a.Internal() {
					k.Apps = append(k.Apps, a.Name())
				}
			}
		}
	}
	if list, err := people.Load(people.Path(h.root)); err == nil {
		for _, p := range list {
			if p.Active() {
				k.People = append(k.People, p.Name)
			}
		}
	}
	var b bytes.Buffer
	if err := recovery.Render(&b, k); err != nil {
		return err
	}
	path := filepath.Join(h.root, kitFile)
	if err := os.WriteFile(path, b.Bytes(), 0o600); err != nil {
		return err
	}
	h.ui.OK("the recovery kit: %s", path)
	h.ui.Printf("  %s\n", h.ui.Dim("Open it, print it, write the Secrets passphrase on it by hand, and keep it with your important papers."))
	return nil
}
