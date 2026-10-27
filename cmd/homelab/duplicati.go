package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// duplicatiCmd is homelab duplicati setup|jobs.
func (h *homelab) duplicatiCmd(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: homelab duplicati destination [folder] | setup [--apply] [--no-run] | jobs")
	}
	switch args[0] {
	case "destination":
		return h.duplicatiDestination(args[1:])
	case "setup":
		return h.duplicatiSetup(ctx, args[1:])
	case "jobs":
		c, err := h.duplicatiLogin(ctx)
		if err != nil {
			return err
		}
		jobs, err := c.Jobs(ctx, time.Now())
		if err != nil {
			return err
		}
		if h.ui.JSON {
			emit(h.ui, "jobs", jobs)
			return nil
		}
		rows := make([][]string, 0, len(jobs))
		for _, j := range jobs {
			last := "never"
			if !j.LastFinished.IsZero() {
				last = ago(j.LastFinished)
			}
			next := "-"
			if !j.NextRun.IsZero() {
				next = until(j.NextRun)
			}
			rows = append(rows, []string{j.Name, j.State, last, next, j.Size, j.ErrorMessage})
		}
		h.ui.Table([]string{"JOB", "STATE", "LAST RUN", "NEXT RUN", "SIZE", "ERROR"}, rows)
		return nil
	}
	return fmt.Errorf("unknown duplicati command %q (destination, setup, or jobs)", args[0])
}

// duplicatiDestination sets BACKUP_DESTINATION: the folder given, or a
// "Homelab Backups" folder in the Proton Drive this Mac keeps in sync.
func (h *homelab) duplicatiDestination(args []string) error {
	fs := newFlags("duplicati destination")
	apply := applyFlag(fs)
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	var dest string
	switch {
	case len(pos) == 1:
		dest = h.hostPath(pos[0])
	case len(pos) > 1:
		return fmt.Errorf("usage: homelab duplicati destination [folder]")
	default:
		home, _ := os.UserHomeDir()
		drives := backup.ProtonDrive(home)
		switch len(drives) {
		case 0:
			if h.host.OS != "darwin" {
				return fmt.Errorf("no Proton Drive folder here: name the folder backups go to, homelab duplicati destination <folder> (a backup drive, or a folder a cloud drive syncs)")
			}
			return fmt.Errorf("no Proton Drive folder on this Mac (~/Library/CloudStorage/ProtonDrive-…): install Proton Drive and sign in, or name a folder")
		case 1:
			dest = filepath.Join(drives[0], backup.FolderName)
		default:
			return fmt.Errorf("more than one Proton Drive folder; name the one to use:\n  %s", strings.Join(drives, "\n  "))
		}
	}
	u := h.ui
	u.Title("Backup destination")
	u.Info("BACKUP_DESTINATION → %s", dest)
	if _, err := os.Stat(dest); err != nil {
		u.Info("the folder is made now")
	}
	u.Info("then Create the backup jobs (homelab duplicati setup) mounts it in Duplicati")
	if err := h.goAhead(*apply, "\nUse this folder?"); err != nil {
		return err
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	h.giveToPUID(dest)
	f, err := envfile.Load(h.envFile)
	if err != nil {
		return err
	}
	f.Set("BACKUP_DESTINATION", dest)
	if err := f.Save(); err != nil {
		return err
	}
	u.OK("BACKUP_DESTINATION is %s", dest)
	return nil
}

func (h *homelab) duplicatiLogin(ctx context.Context) (*duplicati.Client, error) {
	env := h.envMap()
	port := env["DUPLICATI_PORT"]
	if port == "" {
		port = "8200"
	}
	return duplicati.Login(ctx, "http://127.0.0.1:"+port, env["DUPLICATI_PASSWORD"])
}

// duplicatiSetup creates the backup jobs docs/Automation.md lists, with
// generated passphrases kept in .env, alerts to ntfy, and a first run of
// the small ones.
func (h *homelab) duplicatiSetup(ctx context.Context, args []string) error {
	fs := newFlags("duplicati setup")
	apply := applyFlag(fs)
	noRun := fs.Bool("no-run", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	env := h.envMap()
	dest := h.hostPath(env["BACKUP_DESTINATION"])
	if env["BACKUP_DESTINATION"] == "" || env["BACKUP_DESTINATION"] == "./backups" {
		return fmt.Errorf("put the Proton Drive folder in BACKUP_DESTINATION first (Setup › Backups leave this machine), then run homelab up")
	}
	if st, err := os.Stat(dest); err != nil || !st.IsDir() {
		return fmt.Errorf("BACKUP_DESTINATION %s does not exist (is Proton Drive running?)", dest)
	}
	c, err := h.duplicatiLogin(ctx)
	if err != nil {
		return err
	}
	existing, err := c.Jobs(ctx, time.Now())
	if err != nil {
		return err
	}
	home, _ := os.UserHomeDir()
	plan := duplicati.Plan(env, home, existing, time.Now())

	u := h.ui
	u.Title("Duplicati backup jobs")
	creating := 0
	for _, p := range plan {
		switch p.Action {
		case "exists":
			u.OK("%s: already in Duplicati, left as it is", p.Job.Name)
		case "skip":
			u.Info("%s: not now, %s", p.Job.Name, p.Reason)
		default:
			creating++
			run := "runs once now"
			switch {
			case duplicati.HasBackup(filepath.Join(dest, p.Job.Folder)):
				run = "its folder already holds a backup: the job's database is rebuilt from it (repair), with the passphrase in .env"
			case p.Job.Large || *noRun:
				run = "first run " + p.First.Format("Mon 2 Jan 15:04")
			}
			u.Printf("  %s %s: %s → %s, %s; %s\n", u.Green("+"), p.Job.Name, strings.Join(p.Job.Sources, ", "),
				filepath.Join(dest, p.Job.Folder), p.Job.When(), run)
		}
	}
	if creating == 0 {
		u.OK("nothing to create")
		return h.duplicatiAlerts(ctx, c, env, true)
	}
	newKeys := []string{}
	for _, k := range []string{duplicati.SecretsPassphraseKey, duplicati.PassphraseKey} {
		if v := env[k]; v == "" || envfile.Placeholder.MatchString(v) {
			newKeys = append(newKeys, k)
		}
	}
	u.Info("encrypted with AES; smart retention (a version a day for a week, a week for a month, a month for a year)")
	if len(newKeys) > 0 {
		u.Info("generate the passphrases into .env: %s", strings.Join(newKeys, ", "))
	} else {
		u.Info("passphrases from .env: %s for Homelab Secrets, %s for the rest", duplicati.SecretsPassphraseKey, duplicati.PassphraseKey)
	}
	if env["NTFY_PUBLISH_AUTH"] != "" {
		u.Info("every job reports warnings and errors to the duplicati-alerts topic")
	} else {
		u.Info("alerts come with Set up the alert token (homelab notify setup), which adds them to every job")
	}
	if err := h.goAhead(*apply, "\nCreate the jobs?"); err != nil {
		return err
	}

	if len(newKeys) > 0 {
		f, err := envfile.Load(h.envFile)
		if err != nil {
			return err
		}
		for _, k := range newKeys {
			v, err := envfile.NewSecret(k)
			if err != nil {
				return err
			}
			f.Set(k, v)
			env[k] = v
		}
		if err := f.Save(); err != nil {
			return err
		}
		u.OK("passphrases saved in .env (%s)", strings.Join(newKeys, ", "))
	}
	// The folders the jobs read and write, so a first run finds them.
	for _, d := range []string{"databases", "volumes", "secrets"} {
		if err := os.MkdirAll(h.stagingDir(d), 0o755); err != nil {
			return err
		}
	}
	for _, p := range plan {
		if p.Action == "create" {
			if err := os.MkdirAll(filepath.Join(dest, p.Job.Folder), 0o755); err != nil {
				return err
			}
			h.giveToPUID(filepath.Join(dest, p.Job.Folder))
		}
	}
	// Duplicati must see the same folder at /destination. After a change to
	// BACKUP_DESTINATION it still has the old one until it is recreated.
	if ok, err := h.duplicatiSees(ctx, c, plan); err != nil {
		return err
	} else if !ok {
		u.Info("Duplicati still has the old backup folder; recreating it so it mounts %s", dest)
		if c, err = h.recreateDuplicati(ctx); err != nil {
			return fmt.Errorf("Duplicati does not see %s at /destination, and recreating it failed (%v): run homelab up, then this again", dest, err)
		}
		if ok, err := h.duplicatiSees(ctx, c, plan); err != nil || !ok {
			return fmt.Errorf("Duplicati does not see %s at /destination even after recreating it: check that compose.yaml mounts BACKUP_DESTINATION", dest)
		}
		u.OK("Duplicati sees the backup folder")
	}
	var started, repairing []string
	for _, p := range plan {
		if p.Action != "create" {
			continue
		}
		existing := duplicati.HasBackup(filepath.Join(dest, p.Job.Folder))
		key := duplicati.PassphraseKey
		if p.Job.Secrets {
			key = duplicati.SecretsPassphraseKey
		}
		id, err := c.Create(ctx, duplicati.NewJob{
			Name: p.Job.Name, Description: "Made by homelab duplicati setup (docs/Automation.md)",
			Sources: p.Job.Sources, Exclude: p.Job.Exclude, Target: "file:///destination/" + p.Job.Folder,
			Passphrase: env[key], Every: p.Job.Every, First: p.First,
		})
		if err != nil {
			return fmt.Errorf("creating %s: %w", p.Job.Name, err)
		}
		u.OK("%s created (%s)", p.Job.Name, p.Job.When())
		if existing {
			// A new machine: rebuild the job's database from the backup
			// before its next run, or Duplicati refuses to back up there.
			if err := c.Repair(ctx, id); err != nil {
				u.Warn("%s: could not start rebuilding its database: %v (Duplicati › the job › Database › Repair)", p.Job.Name, err)
			} else {
				repairing = append(repairing, p.Job.Name)
			}
		} else if !p.Job.Large && !*noRun {
			if err := c.Run(ctx, id); err != nil {
				u.Warn("%s: could not start its first run: %v", p.Job.Name, err)
			} else {
				started = append(started, p.Job.Name)
			}
		}
	}
	if err := h.duplicatiAlerts(ctx, c, env, false); err != nil {
		u.Warn("alerts: %v", err)
	}
	if len(repairing) > 0 {
		u.OK("rebuilding the databases of the jobs whose backup was already there: %s", strings.Join(repairing, ", "))
	}
	if len(started) > 0 {
		u.OK("first runs queued, one after another: %s (Backups › Off-site jobs shows them finish)", strings.Join(started, ", "))
	}
	u.Printf("\n  %s\n  %s\n", u.Bold("Keep "+duplicati.SecretsPassphraseKey+" outside this machine."),
		u.Dim("Open .env (open -e .env), copy it into Vaultwarden, and write it on the recovery kit. It opens the Secrets backup, which holds .env with every other passphrase; without it nothing can be restored."))
	return nil
}

// duplicatiSees says whether Duplicati sees each new job's folder in
// /destination.
func (h *homelab) duplicatiSees(ctx context.Context, c *duplicati.Client, plan []duplicati.Planned) (bool, error) {
	seen, err := c.List(ctx, "/destination")
	if err != nil {
		return false, fmt.Errorf("asking Duplicati what is in /destination: %w", err)
	}
	for _, p := range plan {
		if p.Action == "create" && !slices.Contains(seen, p.Job.Folder) {
			return false, nil
		}
	}
	return true, nil
}

// recreateDuplicati recreates the Duplicati container from compose.yaml
// (picking up a new BACKUP_DESTINATION) and signs in again once it answers.
func (h *homelab) recreateDuplicati(ctx context.Context) (*duplicati.Client, error) {
	a, ok := h.catalog.Get("duplicati")
	if !ok {
		return nil, fmt.Errorf("duplicati is not in the catalog")
	}
	client, err := h.docker(ctx)
	if err != nil {
		return nil, err
	}
	if err := client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", "--force-recreate", a.ID); err != nil {
		return nil, err
	}
	var last error
	for deadline := time.Now().Add(duplicatiStartWait); time.Now().Before(deadline); time.Sleep(2 * time.Second) {
		c, err := h.duplicatiLogin(ctx)
		if err == nil {
			return c, nil
		}
		last = err
	}
	return nil, fmt.Errorf("it did not answer within %s: %v", duplicatiStartWait, last)
}

// giveToPUID hands folders this made to the account the apps run as
// (PUID, PGID) when this runs as root, so Duplicati, running as that
// account, can write in them. As anyone else they are already theirs.
func (h *homelab) giveToPUID(dirs ...string) {
	if os.Geteuid() != 0 {
		return
	}
	env := h.envMap()
	uid, err1 := strconv.Atoi(env["PUID"])
	gid, err2 := strconv.Atoi(env["PGID"])
	if err1 != nil || err2 != nil || uid == 0 {
		return
	}
	for _, d := range dirs {
		_ = os.Lchown(d, uid, gid)
	}
}

// duplicatiStartWait is how long a recreated Duplicati may take to answer.
var duplicatiStartWait = 90 * time.Second

// duplicatiAlerts points every Duplicati job's warnings and errors at the
// duplicati-alerts topic, as a server-wide option. quiet skips the
// message when the alert token does not exist yet.
func (h *homelab) duplicatiAlerts(ctx context.Context, c *duplicati.Client, env map[string]string, quiet bool) error {
	auth := env["NTFY_PUBLISH_AUTH"]
	if auth == "" {
		if !quiet {
			h.ui.Info("alerts: after Set up the alert token, which adds them to every job")
		}
		return nil
	}
	if err := c.SetOptions(ctx, map[string]string{
		"send-http-url":   "http://ntfy:80/duplicati-alerts?auth=" + auth,
		"send-http-level": "Warning,Error,Fatal",
	}); err != nil {
		return err
	}
	h.ui.OK("every Duplicati job reports warnings and errors to duplicati-alerts")
	return nil
}

// hostPath resolves a path from .env on this machine: ~ is the home
// folder, and a relative path is under the homelab folder.
func (h *homelab) hostPath(p string) string {
	switch {
	case p == "":
		return ""
	case strings.HasPrefix(p, "~/"):
		home, _ := os.UserHomeDir()
		return filepath.Join(home, p[2:])
	case filepath.IsAbs(p):
		return p
	}
	return filepath.Join(h.root, p)
}
