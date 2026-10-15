package duplicati

import (
	"os"
	"path/filepath"
	"strings"
	"time"
)

// The .env keys holding the jobs' encryption passphrases. The Secrets job
// has its own: it holds .env, so with that one passphrase (kept outside
// this machine) every other passphrase can be recovered.
const (
	SecretsPassphraseKey = "DUPLICATI_SECRETS_PASSPHRASE"
	PassphraseKey        = "DUPLICATI_PASSPHRASE"
)

// HomelabJob is one of the jobs docs/Automation.md lists.
type HomelabJob struct {
	Name    string
	Folder  string   // under BACKUP_DESTINATION
	Sources []string // as Duplicati sees them (compose.yaml mounts)
	Exclude []string
	Every   string       // 1D or 1W
	Weekday time.Weekday // for weekly jobs
	Hour    int
	Minute  int
	Secrets bool // uses the Secrets passphrase
	// Large jobs (photos, the Jellyfin library, books) wait for their
	// schedule instead of running at once, and are only created when
	// their folder on this machine has something in it.
	Large bool
	Host  func(env map[string]string, home string) string
}

// HomelabJobs are the jobs, in the order the night runs them.
var HomelabJobs = []HomelabJob{
	{Name: "Homelab Photos", Folder: "photos", Sources: []string{"/source/immich/"}, Every: "1D", Hour: 1, Large: true,
		Host: func(env map[string]string, _ string) string {
			return or(env["IMMICH_UPLOAD_LOCATION"], "/Volumes/Media/photos")
		}},
	{Name: "Homelab Databases", Folder: "databases", Sources: []string{"/staging/databases/", "/staging/volumes/"}, Every: "1D", Hour: 5},
	{Name: "Homelab Secrets", Folder: "secrets", Sources: []string{"/staging/secrets/"}, Every: "1D", Hour: 5, Secrets: true},
	{Name: "Homelab AppData", Folder: "appdata", Sources: []string{"/source/appdata/"}, Exclude: []string{"/source/appdata/duplicati/"}, Every: "1D", Hour: 5, Minute: 30},
	{Name: "Homelab Stack Data", Folder: "stack-data", Sources: []string{"/source/homelab-appdata/"}, Every: "1D", Hour: 5, Minute: 30},
	{Name: "Homelab Infrastructure", Folder: "infrastructure", Sources: []string{"/source/stacks/"}, Every: "1W", Weekday: time.Sunday, Hour: 6},
	{Name: "Homelab Jellyfin", Folder: "jellyfin", Sources: []string{"/source/jellyfin/"}, Every: "1W", Weekday: time.Sunday, Hour: 2, Large: true,
		Exclude: []string{"/source/jellyfin/cache/", "/source/jellyfin/transcodes/", "/source/jellyfin/log/"},
		Host: func(env map[string]string, home string) string {
			return expandHome(or(env["JELLYFIN_DATA_DIR"], "~/.local/share/jellyfin"), home)
		}},
	{Name: "Homelab Calibre", Folder: "calibre", Sources: []string{"/source/calibre/"}, Every: "1W", Weekday: time.Sunday, Hour: 3, Large: true,
		Host: func(env map[string]string, _ string) string {
			return filepath.Join(or(env["MEDIA_ROOT"], "/Volumes/Media"), "Books")
		}},
}

// Planned is what setup would do with one job.
type Planned struct {
	Job    HomelabJob
	Action string // create, exists, or skip
	Reason string // for skip: why
	First  time.Time
}

// Plan decides, for each homelab job, whether to create it: not when a job
// of that name exists, nor a large job whose folder is empty or missing.
func Plan(env map[string]string, home string, existing []Job, now time.Time) []Planned {
	have := map[string]bool{}
	for _, j := range existing {
		have[strings.ToLower(j.Name)] = true
	}
	out := make([]Planned, 0, len(HomelabJobs))
	for _, j := range HomelabJobs {
		p := Planned{Job: j, Action: "create", First: j.Next(now)}
		switch {
		case have[strings.ToLower(j.Name)]:
			p.Action = "exists"
		case j.Host != nil && isEmpty(j.Host(env, home)):
			p.Action, p.Reason = "skip", j.Host(env, home)+" is empty or missing"
		}
		out = append(out, p)
	}
	return out
}

// Next is the job's first scheduled run after now, in now's time zone.
func (j HomelabJob) Next(now time.Time) time.Time {
	t := time.Date(now.Year(), now.Month(), now.Day(), j.Hour, j.Minute, 0, 0, now.Location())
	if j.Every == "1W" {
		t = t.AddDate(0, 0, (int(j.Weekday)-int(t.Weekday())+7)%7)
		if !t.After(now) {
			t = t.AddDate(0, 0, 7)
		}
		return t
	}
	if !t.After(now) {
		t = t.AddDate(0, 0, 1)
	}
	return t
}

// When says when a job runs, e.g. "daily at 05:30" or "Sundays at 02:00".
func (j HomelabJob) When() string {
	at := time.Date(2000, 1, 1, j.Hour, j.Minute, 0, 0, time.UTC).Format("15:04")
	if j.Every == "1W" {
		return j.Weekday.String() + "s at " + at
	}
	return "daily at " + at
}

func isEmpty(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return true
	}
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), ".") {
			return false
		}
	}
	return true
}

func expandHome(p, home string) string {
	if strings.HasPrefix(p, "~/") {
		return filepath.Join(home, p[2:])
	}
	return p
}

func or(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
