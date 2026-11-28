package duplicati

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// A large job (photos, the Jellyfin library, books, the synced Files) backs
// up a folder on its own drive. Unplugged, Docker leaves an empty folder in
// its place, and Duplicati, on its own schedule inside its container, would
// back that up as every file deleted, the newest version a blind restore
// takes (docs/SRE-Audit-2026-11.md, H5). The nightly backup alerts about it
// (Preflight), but cannot stop Duplicati's own run; this does. Each large
// job runs a guard first (Duplicati's run-script-before-required), which
// refuses to start the backup while the job's folder holds nothing: the run
// ends with an error, which Backups and the watchdog report, and no new
// version is written. Proven against the real image on Nov 28, 2026: with
// the folder empty, no version, and the job's last error the guard's; with
// a file in it, the backup as before.

// GuardOption is the job option the guard goes in.
const GuardOption = "--run-script-before-required"

// GuardsFolder is where the guards are, under recovery-staging, which
// Duplicati mounts as /staging.
const GuardsFolder = "guards"

// GuardPath is a large job's guard as Duplicati sees it; "" for a job that
// has none.
func GuardPath(j HomelabJob) string {
	if !j.Large {
		return ""
	}
	return "/staging/" + GuardsFolder + "/" + j.Folder + ".sh"
}

// GuardScript is the guard for j: it fails while any of j's folders, as
// Duplicati sees them, is missing or holds only hidden files (Finder's
// .DS_Store), as Plan's isEmpty counts them.
func GuardScript(j HomelabJob) string {
	var b strings.Builder
	b.WriteString("#!/bin/sh\n")
	fmt.Fprintf(&b, "# Written by homelab duplicati setup: %s refuses to back up an empty folder,\n", j.Name)
	b.WriteString("# which an unplugged drive leaves (internal/duplicati/guard.go).\n")
	for _, src := range j.Sources {
		fmt.Fprintf(&b, "if [ -z \"$(ls -A %q 2>/dev/null | grep -v '^\\.')\" ]; then\n", src)
		fmt.Fprintf(&b, "  echo %q >&2\n", src+" is empty or missing (is its drive plugged in?): not backed up, so the last backup stays the newest")
		b.WriteString("  exit 1\nfi\n")
	}
	b.WriteString("exit 0\n")
	return b.String()
}

// WriteGuards writes each large job's guard into staging/guards (on this
// machine), readable and runnable by Duplicati's account; each file is
// written whole and renamed in.
func WriteGuards(staging string) error {
	dir := filepath.Join(staging, GuardsFolder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	for _, j := range HomelabJobs {
		if GuardPath(j) == "" {
			continue
		}
		path := filepath.Join(dir, j.Folder+".sh")
		tmp := path + ".new"
		if err := os.WriteFile(tmp, []byte(GuardScript(j)), 0o755); err != nil {
			return err
		}
		// WriteFile keeps the mode of a file already there; this one is new.
		if err := os.Chmod(tmp, 0o755); err != nil { // #nosec G302 -- Duplicati's account runs it; it holds no secret
			return err
		}
		if err := os.Rename(tmp, path); err != nil {
			return err
		}
	}
	return nil
}

// EnsureGuard puts guard in job id's options, unless it is there already,
// and reports whether it changed the job. The job is read and written back
// whole, as Duplicati's own editor does: its passphrase comes back masked
// (***), which Duplicati keeps as the one it has, proven on Nov 28, 2026
// (the job's backup, made after, opened with the real passphrase and
// refused the mask).
func (c *Client) EnsureGuard(ctx context.Context, id, guard string) (bool, error) {
	var job struct {
		Backup   map[string]json.RawMessage `json:"Backup"`
		Schedule json.RawMessage            `json:"Schedule"`
	}
	if err := c.call(ctx, http.MethodGet, "/api/v1/backup/"+id, nil, &job); err != nil {
		return false, err
	}
	if job.Backup == nil {
		return false, fmt.Errorf("Duplicati did not return job %s", id)
	}
	var settings []map[string]any
	if raw, ok := job.Backup["Settings"]; ok {
		if err := json.Unmarshal(raw, &settings); err != nil {
			return false, fmt.Errorf("job %s's options: %w", id, err)
		}
	}
	for i, s := range settings {
		if name, _ := s["Name"].(string); strings.TrimLeft(name, "-") == strings.TrimLeft(GuardOption, "-") {
			if v, _ := s["Value"].(string); v == guard {
				return false, nil
			}
			settings[i]["Value"] = guard
			return true, c.putJob(ctx, id, job.Backup, settings, job.Schedule)
		}
	}
	settings = append(settings, map[string]any{"Filter": "", "Name": GuardOption, "Value": guard, "Argument": nil})
	return true, c.putJob(ctx, id, job.Backup, settings, job.Schedule)
}

func (c *Client) putJob(ctx context.Context, id string, backup map[string]json.RawMessage, settings []map[string]any, schedule json.RawMessage) error {
	raw, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	backup["Settings"] = raw
	body := map[string]any{"Backup": backup}
	if len(schedule) > 0 && string(schedule) != "null" {
		body["Schedule"] = schedule
	}
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return c.call(ctx, http.MethodPut, "/api/v1/backup/"+id, data, nil)
}
