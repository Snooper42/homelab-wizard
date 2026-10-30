package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// rebuildMark is kept while a rebuild runs, so running it again after a
// missing folder is fixed carries on without restoring the files again.
const rebuildMark = "homelab-rebuild.json"

// rebuildState is what rebuildMark holds.
type rebuildState struct {
	From     string    `json:"from"`
	Restored time.Time `json:"restored"`
}

// rebuild is Disaster Recovery's full rebuild in one command, for a machine
// that lost its homelab: from the backup folder Duplicati wrote to (the
// cloud drive's folder, or the backup drive), it restores the Secrets job
// with DUPLICATI_SECRETS_PASSPHRASE (.env and the household's records),
// then with the passphrase that .env holds the database copies, the apps'
// data, the stacks' data, and your own apps, each with Duplicati's own
// command line in a throwaway container; then it brings the homelab back
// as a move in does (the backup's app versions, the volumes and databases,
// the apps that ran, the jobs) and makes Duplicati's jobs again from their
// backups. The photos, the Jellyfin library, and the books, which live on
// their own drives, are left for a restore of their own.
func (h *homelab) rebuild(ctx context.Context, args []string) error {
	fs := newFlags("rebuild")
	apply := applyFlag(fs)
	force := fs.Bool("force", false, "")
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(pos) != 1 {
		return errors.New("usage: homelab rebuild <backup folder> [--apply] (the folder BACKUP_DESTINATION named: it holds secrets, appdata, databases, …)")
	}
	folder, err := filepath.Abs(pos[0])
	if err != nil {
		return err
	}
	if !duplicati.HasBackup(filepath.Join(folder, "secrets")) {
		return fmt.Errorf("%s has no Homelab Secrets backup (a secrets folder with Duplicati's files): name the folder the backups went to", folder)
	}
	u := h.ui
	mark := filepath.Join(h.root, "data", rebuildMark)
	restored := false
	if data, err := os.ReadFile(mark); err == nil {
		var st rebuildState
		restored = json.Unmarshal(data, &st) == nil && st.From == folder
	}
	if !restored && !*force && hasFiles(filepath.Join(h.root, "data", "appdata")) {
		return errors.New("this homelab folder already has apps' data (data/appdata); rebuild into a new one, or add --force to replace it")
	}

	jobs := rebuildJobs(folder)
	u.Title("Rebuild from the backups")
	u.Info("from %s", folder)
	if restored {
		u.Info("the files were restored from it already: carry on")
	} else {
		u.Info("restore .env and the household's records (Homelab Secrets, with %s)", duplicati.SecretsPassphraseKey)
		for _, j := range jobs {
			u.Info("restore %s into %s", j.job.Name, j.into)
		}
	}
	u.Info("start each app on the version that wrote its data, load the volumes and databases, and start the apps that ran")
	u.Info("make Duplicati's jobs again from their backups")
	if err := h.goAhead(*apply, "\nRebuild?"); err != nil {
		return err
	}

	if !restored {
		secret, err := h.secretsPassphrase()
		if err != nil {
			return err
		}
		client, err := h.docker(ctx)
		if err != nil {
			return err
		}
		image := h.duplicatiImage()
		staging := h.stagingDir("secrets")
		if err := restoreJob(ctx, client, image, folder, "secrets", staging, secret); err != nil {
			return fmt.Errorf("Homelab Secrets: %w", err)
		}
		if err := h.takeSecrets(staging); err != nil {
			return err
		}
		u.OK(".env and the household's records restored")
		changes, err := envfile.Rehome(h.envFile, domain.HostIdentity())
		if err != nil {
			return fmt.Errorf("the settings for this machine: %w", err)
		}
		for _, c := range changes {
			u.OK("%s %s %s", c.Key, c.Reason, c.Value)
		}
		if err := h.setEnv("BACKUP_DESTINATION", folder); err != nil {
			return err
		}
		pass := h.envMap()[duplicati.PassphraseKey]
		if pass == "" {
			return fmt.Errorf("the restored .env has no %s, which the other jobs need", duplicati.PassphraseKey)
		}
		for _, j := range jobs {
			if err := restoreJob(ctx, client, image, folder, j.job.Folder, j.dir(h), pass); err != nil {
				return fmt.Errorf("%s: %w", j.job.Name, err)
			}
			if j.job.Folder == "infrastructure" {
				if err := h.takeCustomApps(j.dir(h)); err != nil {
					return err
				}
			}
			u.OK("%s restored", j.job.Name)
		}
		// Your own apps came back with the infrastructure.
		if cat, err := catalog.Load(h.root); err == nil {
			h.catalog = cat
		}
		data, _ := json.Marshal(rebuildState{From: folder, Restored: time.Now()})
		if err := os.WriteFile(mark, data, 0o600); err != nil {
			return err
		}
	}

	pinned, err := h.bringBack(ctx, h.backupApps(), "homelab rebuild "+folder)
	if err != nil {
		return err
	}
	if err := h.duplicatiSetup(ctx, []string{"--apply", "--no-run"}); err != nil {
		u.Warn("Duplicati's jobs: %v (Setup › Create the backup jobs tries again)", err)
	}
	if err := os.Rename(mark, filepath.Join(h.root, "data", "homelab-rebuild-done.json")); err != nil {
		u.Warn("%v", err)
	}
	u.OK("rebuilt from %s", folder)
	var more []string
	for _, j := range duplicati.HomelabJobs {
		if j.Large && duplicati.HasBackup(filepath.Join(folder, j.Folder)) && j.Host != nil {
			home, _ := os.UserHomeDir()
			more = append(more, fmt.Sprintf("%s is not restored by this (it is large, and lives on its own drive): if %s is empty, restore it there from Duplicati (Restore › Homelab… › %s).", j.Name, j.Host(h.envMap(), home), j.Name))
		}
	}
	h.leftToDo(pinned, more...)
	return nil
}

// rebuildJob is one backup job a rebuild restores, and where to.
type rebuildJob struct {
	job  duplicati.HomelabJob
	into string // as said to the person
	path []string
}

func (j rebuildJob) dir(h *homelab) string {
	return filepath.Join(append([]string{h.root}, j.path...)...)
}

// rebuildJobs are the jobs restored after the Secrets job, each into the
// folder it backs up (the Databases job's two sources share
// recovery-staging), those with a backup in folder.
func rebuildJobs(folder string) []rebuildJob {
	where := map[string]rebuildJob{
		"databases":      {into: "recovery-staging (the database copies, the volumes, the apps' versions)", path: []string{"recovery-staging"}},
		"appdata":        {into: "data/appdata", path: []string{"data", "appdata"}},
		"stack-data":     {into: "appdata", path: []string{"appdata"}},
		"infrastructure": {into: "stacks/custom (your own apps)", path: []string{"recovery-staging", "rebuild", "stacks"}},
	}
	var out []rebuildJob
	for _, j := range duplicati.HomelabJobs {
		w, ok := where[j.Folder]
		if !ok || !duplicati.HasBackup(filepath.Join(folder, j.Folder)) {
			continue
		}
		w.job = j
		out = append(out, w)
	}
	return out
}

// restoreJob restores the newest version of the job whose backup is in
// folder/job into dir, with Duplicati's own command line in a throwaway
// container of image: no Duplicati jobs or database are needed, as on a new
// machine. It runs as this account, so the files are its own; the
// passphrase goes in the container's environment, never on a command line.
func restoreJob(ctx context.Context, client *docker.Client, image, folder, job, dir, passphrase string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	args := []string{"run", "--rm", "-e", "PASSPHRASE",
		// Duplicati keeps its own files in a folder of its own; the image's
		// (/config) is the server's, which a throwaway run must not use.
		"-e", "HOME=/tmp/duplicati", "-e", "DUPLICATI__SERVER_DATAFOLDER=/tmp/duplicati", "-e", "TMPDIR=/tmp",
		"-v", folder + ":/destination:ro", "-v", dir + ":/restore"}
	if runtime.GOOS != "windows" {
		args = append(args, "--user", strconv.Itoa(os.Getuid())+":"+strconv.Itoa(os.Getgid()))
	}
	args = append(args, "--entrypoint", "/app/duplicati/duplicati-cli", image,
		"restore", "file:///destination/"+job, "*", "--restore-path=/restore", "--no-local-db=true")
	cmd := procattr.Hide(exec.CommandContext(ctx, client.Bin, args...))
	cmd.Env = append(os.Environ(), "PASSPHRASE="+passphrase)
	out, err := cmd.CombinedOutput()
	if err == nil {
		return nil
	}
	if bytes.Contains(out, []byte("invalid passphrase")) {
		return errors.New("the passphrase does not open it")
	}
	return fmt.Errorf("%w\n%s", err, lastLines(withoutTrace(out), 4))
}

// withoutTrace drops a .NET stack trace's lines from Duplicati's output.
func withoutTrace(out []byte) []byte {
	var keep [][]byte
	for _, l := range bytes.Split(out, []byte("\n")) {
		t := bytes.TrimSpace(l)
		if bytes.HasPrefix(t, []byte("at ")) || bytes.HasPrefix(t, []byte("---")) || len(t) == 0 {
			continue
		}
		keep = append(keep, l)
	}
	return bytes.Join(keep, []byte("\n"))
}

// duplicatiImage is the image the homelab's Duplicati runs.
func (h *homelab) duplicatiImage() string {
	if a, ok := h.catalog.Get("duplicati"); ok {
		if ref, err := compose.Interpolate(a.Image, compose.MapLookup(h.envMap())); err == nil && ref != "" {
			return ref
		}
	}
	return "lscr.io/linuxserver/duplicati:latest"
}

// takeSecrets puts what the Secrets job restored in place: homelab.env as
// .env (only this account may read it), and the household's records
// (the people, the paired phones, the sign-in settings) into data.
func (h *homelab) takeSecrets(staging string) error {
	copied := filepath.Join(staging, "homelab.env")
	env, err := os.ReadFile(copied)
	if err != nil {
		return fmt.Errorf("the Secrets backup has no homelab.env: %w", err)
	}
	// Restored as Duplicati found it; only this account may read it, as
	// the nightly backup's copy.
	if err := os.Chmod(copied, 0o600); err != nil {
		return err
	}
	if err := os.WriteFile(h.envFile, env, 0o600); err != nil {
		return err
	}
	// The records the app writes for this account alone, as it does.
	return copyTree(filepath.Join(staging, "data"), filepath.Join(h.root, "data"), true)
}

// takeCustomApps puts your own apps (stacks/custom) from the restored
// infrastructure in place; the rest of stacks comes with the homelab files.
func (h *homelab) takeCustomApps(restored string) error {
	return copyTree(filepath.Join(restored, "custom"), filepath.Join(h.root, "stacks", "custom"), false)
}

// backupApps are the apps the newest backup found running (its record of
// their images), which a rebuild starts again.
func (h *homelab) backupApps() []string {
	path := newestIn(h.stagingDir("databases", backup.ImagesFolder))
	if path == "" {
		return nil
	}
	im, err := backup.LoadImages(path)
	if err != nil {
		return nil
	}
	var ids []string
	for id := range im.Apps {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

// copyTree copies the files under src into dst, keeping their folders, and
// their modes or, private, readable by this account alone; a missing src
// copies nothing. Links are left out, and a file is opened within src, so a
// restored backup cannot copy in a file from outside it.
func copyTree(src, dst string, private bool) error {
	if _, err := os.Stat(src); os.IsNotExist(err) {
		return nil
	}
	root, err := os.OpenRoot(src)
	if err != nil {
		return err
	}
	defer root.Close()
	return fs.WalkDir(root.FS(), ".", func(rel string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		to := filepath.Join(dst, filepath.FromSlash(rel))
		if d.IsDir() {
			return os.MkdirAll(to, 0o755)
		}
		if !d.Type().IsRegular() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		in, err := root.Open(rel)
		if err != nil {
			return err
		}
		defer in.Close()
		mode := info.Mode().Perm()
		if private {
			mode = 0o600
		}
		out, err := os.OpenFile(to, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
		if err != nil {
			return err
		}
		if _, err := io.Copy(out, in); err != nil {
			out.Close()
			return err
		}
		return out.Close()
	})
}

// secretsPassphrase is DUPLICATI_SECRETS_PASSPHRASE: from this process's
// environment (the app gives it so), else asked for in a terminal, the
// typing hidden where the terminal can hide it.
func (h *homelab) secretsPassphrase() (string, error) {
	if p := os.Getenv(duplicati.SecretsPassphraseKey); p != "" {
		return p, nil
	}
	if !h.ui.Interactive {
		return "", fmt.Errorf("%s is needed to open Homelab Secrets: set it in the environment, or run this in a terminal to be asked", duplicati.SecretsPassphraseKey)
	}
	hidden := echo(false)
	prompt := "The Secrets passphrase (" + duplicati.SecretsPassphraseKey + ", from Vaultwarden or the recovery kit):"
	if !hidden {
		prompt += " (it shows as you type)"
	}
	p, err := h.ui.Ask(prompt)
	if hidden {
		echo(true)
		h.ui.Printf("\n")
	}
	if err != nil {
		return "", err
	}
	if p == "" {
		return "", errors.New("no passphrase given")
	}
	return p, nil
}

// echo turns a Unix terminal's echo off or on (stty), saying whether it
// could.
func echo(on bool) bool {
	if runtime.GOOS == "windows" {
		return false
	}
	flag := "-echo"
	if on {
		flag = "echo"
	}
	cmd := exec.Command("stty", flag)
	cmd.Stdin = os.Stdin
	return cmd.Run() == nil
}
