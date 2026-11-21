package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/Snooper42/homelab-wizard/internal/qbitconf"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// qbitPassword gives a qBittorrent made before the homelab made its login
// the one in Settings (wiring.FixQbitPassword): it stops qBittorrent, which
// writes its settings back as it stops, puts QBITTORRENT_USER and
// QBITTORRENT_PASSWORD's hash in its settings file, and starts it again.
// The password itself is written nowhere new.
func (h *homelab) qbitPassword(ctx context.Context) error {
	env := h.envMap()
	password := env["QBITTORRENT_PASSWORD"]
	if password == "" {
		return errors.New("there's no QBITTORRENT_PASSWORD in Settings to give qBittorrent")
	}
	user := env["QBITTORRENT_USER"]
	if user == "" {
		user = "admin"
	}
	dir := wiring.AppsFrom(h.catalog, func(id string) bool { return id == "qbittorrent" }, env, homeDir())["qbittorrent"].ConfigDir
	if dir == "" {
		return errors.New("can't find qBittorrent's settings folder")
	}
	path := filepath.Join(dir, qbitconf.Path)
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("qBittorrent has no settings file yet (%w): start it once, then connect again", err)
	}
	if err := h.lifecycle("stop")(ctx, []string{"qbittorrent"}); err != nil {
		return err
	}
	// Read after it stopped: it saved its settings as it went.
	err := func() error {
		info, err := os.Stat(path)
		if err != nil {
			return err
		}
		conf, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		next, err := qbitconf.SetLogin(conf, user, password)
		if err != nil {
			return err
		}
		return os.WriteFile(path, next, info.Mode().Perm())
	}()
	// Started again either way: a failed write leaves it as it was.
	if serr := h.lifecycle("start")(ctx, []string{"qbittorrent"}); err == nil {
		err = serr
	}
	if err == nil {
		h.ui.OK("qBittorrent signs in with the password in Settings")
	}
	return err
}
