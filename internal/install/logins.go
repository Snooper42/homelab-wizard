package install

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/qbitconf"
)

// planLogins plans qBittorrent's first settings file, with the login in
// .env (QBITTORRENT_USER, QBITTORRENT_PASSWORD), when it has no settings
// yet: it then never prints a temporary password, and wire signs in at
// once. With no password in .env, one is made. A qBittorrent with its own
// settings keeps them.
func planLogins(plan *Plan, root string, lookup compose.Lookup, home string) error {
	for _, a := range plan.Start {
		if a.ID != "qbittorrent" {
			continue
		}
		dir := ""
		for _, v := range a.Volumes {
			if r, err := v.Resolve(lookup, a.File.Dir, home); err == nil && r.Bind && v.Target == "/config" && within(r.Source, root) {
				dir = r.Source
			}
		}
		if dir == "" {
			continue
		}
		path := filepath.Join(dir, qbitconf.Path)
		if exists(path) {
			continue
		}
		user, _ := plan.Env.Get("QBITTORRENT_USER")
		if user == "" {
			user = "admin"
		}
		pw, _ := plan.Env.Get("QBITTORRENT_PASSWORD")
		if pw == "" {
			made, err := envfile.NewSecret("QBITTORRENT_PASSWORD")
			if err != nil {
				return err
			}
			pw = made
			plan.Env.Set("QBITTORRENT_PASSWORD", pw)
			plan.EnvChanges = append(plan.EnvChanges, envfile.Change{Key: "QBITTORRENT_PASSWORD", Reason: "generated secret", Secret: true})
		}
		data, err := qbitconf.First(user, pw)
		if err != nil {
			return err
		}
		plan.Logins = append(plan.Logins, Login{App: a.ID, Path: path, Data: data})
	}
	return nil
}

// writeLogin writes a planned settings file, never over one the app has
// made since the plan.
func writeLogin(l Login) error {
	if err := os.MkdirAll(filepath.Dir(l.Path), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(l.Path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if errors.Is(err, fs.ErrExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if _, err := f.Write(l.Data); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}
