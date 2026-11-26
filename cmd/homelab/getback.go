package main

// homelab get-back: one file or a whole app's folder from a chosen night, through the backup engine (quality-loop
// Q4 (c); For Account 2, item 22). The app's folder from that night is restored into recovery-staging/get-back, then
// saved as a copy (to Downloads, or --to) or put back in place, the folder there now set aside first in
// recovery-staging/put-back, so putting back is undone by putting that back.
//
//	homelab get-back <app> --nights [--engine kopia]
//	homelab get-back <app> [--night newest|N|<time>] [--file <path in its folder>] [--to <folder> | --put-back] --apply

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/appdata"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/kopia"
)

// appdataJob is the Duplicati job that holds the apps' folders.
const appdataJob = "Homelab AppData"

// getBackFolder is where an app's own folder is on this machine, and where each engine sees it: the apps' data
// (APPDATA_ROOT, /source/appdata) or a stack's (appdata/, /source/homelab-appdata).
type getBackFolder struct {
	host, source, name string
}

func (h *homelab) getBackFolder(app string) (getBackFolder, error) {
	if app == "" || strings.ContainsAny(app, `/\`) || app == "." || app == ".." {
		return getBackFolder{}, fmt.Errorf("%q isn't an app", app)
	}
	if dir := appdata.Path(h.root, app); isDir(dir) {
		return getBackFolder{host: dir, source: "/source/appdata", name: app}, nil
	}
	if dir := filepath.Join(h.root, "appdata", app); isDir(dir) {
		return getBackFolder{host: dir, source: "/source/homelab-appdata", name: app}, nil
	}
	return getBackFolder{}, fmt.Errorf("%s has no folder of its own in the backups (its data is in a database the nightly backup dumps, or it keeps none)", h.appName(app))
}

func isDir(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && fi.IsDir()
}

// getBackNight is a night an engine holds, for the list and the choice.
type getBackNight struct {
	At    time.Time `json:"at"`
	Files int       `json:"files,omitempty"`
	ref   string    // Duplicati's time for it, or Kopia's snapshot root
	dup   duplicati.Night
}

func (h *homelab) getBackNights(ctx context.Context, engine string, f getBackFolder) ([]getBackNight, any, error) {
	env := h.envMap()
	switch engine {
	case "", "duplicati":
		port := env["DUPLICATI_PORT"]
		if port == "" {
			port = "8200"
		}
		c, err := duplicati.Login(ctx, "http://127.0.0.1:"+port, env["DUPLICATI_PASSWORD"])
		if err != nil {
			return nil, nil, err
		}
		ns, err := c.Nights(ctx, appdataJob)
		if err != nil {
			return nil, nil, err
		}
		out := make([]getBackNight, len(ns))
		for i, n := range ns {
			out[i] = getBackNight{At: n.At, Files: n.Files, dup: n}
		}
		return out, c, nil
	case "kopia":
		port := env["KOPIA_PORT"]
		if port == "" {
			port = "51515"
		}
		c := kopia.New("http://127.0.0.1:"+port, env["KOPIA_SERVER_PASSWORD"])
		ss, err := c.Snapshots(ctx, f.source)
		if err != nil {
			return nil, nil, err
		}
		out := make([]getBackNight, len(ss))
		for i, s := range ss {
			out[i] = getBackNight{At: s.StartTime.UTC(), ref: s.RootID}
		}
		return out, c, nil
	}
	return nil, nil, fmt.Errorf("--engine is duplicati or kopia")
}

// pickNight is the night asked for: newest (or empty), a number from the list (0 the newest), or a time or a day.
func pickNight(nights []getBackNight, want string) (getBackNight, error) {
	if len(nights) == 0 {
		return getBackNight{}, errors.New("the backup holds no night yet")
	}
	want = strings.TrimSpace(want)
	if want == "" || want == "newest" {
		return nights[0], nil
	}
	if n, err := strconv.Atoi(want); err == nil {
		if n < 0 || n >= len(nights) {
			return getBackNight{}, fmt.Errorf("night %d: the backup holds %d (0 the newest)", n, len(nights))
		}
		return nights[n], nil
	}
	if t, err := time.Parse(time.RFC3339, want); err == nil {
		for _, n := range nights {
			if n.At.Equal(t.UTC()) {
				return n, nil
			}
		}
		return getBackNight{}, fmt.Errorf("the backup holds no night at %s", want)
	}
	if d, err := time.ParseInLocation("2006-01-02", want, time.Local); err == nil {
		for _, n := range nights {
			if y, m, dd := n.At.Local().Date(); y == d.Year() && m == d.Month() && dd == d.Day() {
				return n, nil
			}
		}
		return getBackNight{}, fmt.Errorf("the backup holds no night on %s", want)
	}
	return getBackNight{}, fmt.Errorf("--night is newest, a number from the list, a time (RFC 3339) or a day (2006-01-02)")
}

// restored finds the app's folder in what the engine restored: Duplicati keeps the path above it, or part of it.
func restored(staging, app string) string {
	dir := staging
	for range 6 {
		entries, err := os.ReadDir(dir)
		if err != nil || len(entries) != 1 || !entries[0].IsDir() {
			return dir
		}
		switch entries[0].Name() {
		case "source", "appdata", "homelab-appdata", app:
			dir = filepath.Join(dir, entries[0].Name())
			if entries[0].Name() == app {
				return dir
			}
		default:
			return dir
		}
	}
	return dir
}

// inside is the path rel names under dir, refused when it climbs out.
func inside(dir, rel string) (string, error) {
	p := filepath.Join(dir, filepath.FromSlash(rel))
	r, err := filepath.Rel(dir, p)
	if err != nil || r == ".." || strings.HasPrefix(r, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", fmt.Errorf("%s isn't in the app's folder", rel)
	}
	return p, nil
}

func copyOne(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	tmp := dst + ".get-back"
	out, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, info.Mode().Perm())
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	os.Chtimes(tmp, info.ModTime(), info.ModTime())
	return os.Rename(tmp, dst)
}

func (h *homelab) getBack(ctx context.Context, args []string) error {
	fs := newFlags("get-back")
	apply := applyFlag(fs)
	engine := fs.String("engine", "duplicati", "")
	list := fs.Bool("nights", false, "")
	night := fs.String("night", "newest", "")
	file := fs.String("file", "", "")
	to := fs.String("to", "", "")
	putBack := fs.Bool("put-back", false, "")
	rest, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(rest) != 1 {
		return errors.New("homelab get-back <app>: the app to get something back for")
	}
	if *putBack && *to != "" {
		return errors.New("--put-back or --to, not both")
	}
	app := rest[0]
	u := h.ui
	f, err := h.getBackFolder(app)
	if err != nil {
		return err
	}
	nights, client, err := h.getBackNights(ctx, *engine, f)
	if err != nil {
		return err
	}
	if *list {
		if u.JSON {
			emit(u, "nights", map[string]any{"app": app, "engine": *engine, "nights": nights})
			return nil
		}
		for i, n := range nights {
			u.Printf("%2d  %s\n", i, n.At.Local().Format("Mon Jan 2 3:04 PM"))
		}
		return nil
	}
	n, err := pickNight(nights, *night)
	if err != nil {
		return err
	}
	what := h.appName(app) + "'s folder"
	if *file != "" {
		what = *file
	}
	when := n.At.Local().Format("Mon Jan 2 3:04 PM")
	dest := *to
	if !*putBack && dest == "" {
		home, _ := os.UserHomeDir()
		dest = filepath.Join(home, "Downloads", fmt.Sprintf("%s from %s", h.appName(app), n.At.Local().Format("Jan 2 2006 3-04 PM")))
	}
	u.Title("Get something back")
	u.Info("%s as it was %s (%s)", what, when, *engine)
	if *putBack {
		u.Info("put back in %s; what's there now is set aside in %s first", f.host, h.rel(h.stagingDir("put-back")))
	} else {
		u.Info("saved as a copy in %s", dest)
	}
	if err := h.goAhead(*apply, "\nGet it back?"); err != nil {
		return err
	}
	staging := h.stagingDir("get-back", app)
	if err := clearRestore(staging); err != nil {
		return err
	}
	if err := os.MkdirAll(staging, 0o755); err != nil {
		return err
	}
	h.giveToPUID(staging)
	u.Step(1, 2, "The backup restores %s", what)
	switch c := client.(type) {
	case *duplicati.Client:
		if err := c.RestoreAt(ctx, appdataJob, []string{f.source + "/" + f.name + "/"}, n.dup, "/staging/get-back/"+app, 30*time.Minute); err != nil {
			return err
		}
	case *kopia.Client:
		obj, err := c.Find(ctx, n.ref, f.name)
		if err != nil {
			return err
		}
		if err := c.Restore(ctx, obj, "/staging/get-back/"+app, 30*time.Minute); err != nil {
			return err
		}
	}
	got := restored(staging, app)
	src := got
	if *file != "" {
		if src, err = inside(got, *file); err != nil {
			return err
		}
		if _, err := os.Stat(src); err != nil {
			return fmt.Errorf("%s wasn't in the backup %s", *file, when)
		}
	}
	u.Step(2, 2, "Putting it where it goes")
	if !*putBack {
		if *file != "" {
			if err := copyOne(src, filepath.Join(dest, filepath.Base(src))); err != nil {
				return err
			}
		} else if _, _, err := appdata.Copy(src, dest, nil); err != nil {
			return err
		}
		u.OK("saved in %s", dest)
		if u.JSON {
			emit(u, "got-back", map[string]string{"saved": dest})
		}
		return clearRestore(staging)
	}
	aside := h.stagingDir("put-back", app+"-"+time.Now().Format("20060102-150405"))
	for i := 2; ; i++ {
		if _, err := os.Lstat(aside); errors.Is(err, os.ErrNotExist) {
			break
		}
		aside = h.stagingDir("put-back", fmt.Sprintf("%s-%s-%d", app, time.Now().Format("20060102-150405"), i))
	}
	if *file != "" {
		target, err := inside(f.host, *file)
		if err != nil {
			return err
		}
		if _, err := os.Stat(target); err == nil {
			if err := copyOne(target, filepath.Join(aside, filepath.FromSlash(*file))); err != nil {
				return fmt.Errorf("setting %s aside first, so nothing was put back: %w", *file, err)
			}
		}
		if err := copyOne(src, target); err != nil {
			return err
		}
		u.OK("put back %s as it was %s; what was there is in %s", *file, when, h.rel(aside))
	} else {
		// The whole folder: the app stops while its folder is swapped, and starts again.
		stopped := h.stopForGetBack(ctx, app)
		defer h.startAfterGetBack(ctx, stopped)
		if err := os.MkdirAll(filepath.Dir(aside), 0o755); err != nil {
			return err
		}
		if err := os.Rename(f.host, aside); err != nil {
			return fmt.Errorf("setting %s aside first, so nothing was put back: %w", f.host, err)
		}
		if _, _, err := appdata.Copy(src, f.host, nil); err != nil {
			os.RemoveAll(f.host)
			_ = os.Rename(aside, f.host)
			return fmt.Errorf("putting the folder back, so the one there before is back: %w", err)
		}
		u.OK("put back %s as it was %s; the folder there before is in %s", h.appName(app), when, h.rel(aside))
	}
	if u.JSON {
		emit(u, "got-back", map[string]string{"putBack": f.host, "aside": aside})
	}
	return clearRestore(staging)
}

// stopForGetBack stops the app's running containers (its own and its helpers', by Compose service), for its folder
// to be swapped; it returns their names.
func (h *homelab) stopForGetBack(ctx context.Context, app string) []string {
	client, err := h.docker(ctx)
	if err != nil {
		return nil
	}
	cs, err := client.Containers(ctx)
	if err != nil {
		return nil
	}
	var names []string
	for _, c := range cs {
		if c.Running && (c.Service() == app || strings.HasPrefix(c.Service(), app+"-")) {
			names = append(names, c.Name)
		}
	}
	if len(names) > 0 {
		if _, err := client.Runner.Output(ctx, client.Bin, append([]string{"stop"}, names...)...); err != nil {
			h.ui.Warn("stopping %s: %v", h.appName(app), err)
		}
	}
	return names
}

func (h *homelab) startAfterGetBack(ctx context.Context, names []string) {
	if len(names) == 0 {
		return
	}
	client, err := h.docker(ctx)
	if err != nil {
		return
	}
	if _, err := client.Runner.Output(context.WithoutCancel(ctx), client.Bin, append([]string{"start"}, names...)...); err != nil {
		h.ui.Warn("starting it again: %v", err)
	}
}
