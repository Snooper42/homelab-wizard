package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

const mediaUsage = `homelab media: Tidy Up, your music, books, films, TV, and audiobooks sorted, tagged, and lean

  homelab media [status] [--json]          each library, the lock, and the last runs
  homelab media preflight [--json]         what Tidy Up needs on this machine, with the fixes
  homelab media install ffmpeg [--yes]     fetch ffmpeg and ffprobe for Tidy Up alone (a pinned,
                                           checked build in ~/.homelab-media/bin): no Terminal
  homelab media <library> <action> [...]   run an engine; library is music, books, movies, tv, or audiobooks
      music       scan, run, finalize, verify, free-space, navidrome-cleanup, playlists,
                  lyrics [--check], genres [--apply], genre-counts, undo, delete-backup,
                  file <paths>, status
      books       review [--skip 12,34], apply, undo, genre-counts, status,
                  build [--yes] (a Calibre library from a folder of books with none)
      movies, tv  scan, run (into Tdarr's queue), collect, dedupe, posters, file <paths>, genre-counts, status
      audiobooks  scan, run (one .m4b a book), file <paths>, status
  homelab media inbox [--apply]            file what's finished downloading in Downloads
  homelab media inbox undo <id>            put one download What I did today filed back where it was
  homelab media inbox name <path> movie "<title>" [<year>]
  homelab media inbox name <path> episode "<show>" <season> [<episode>]
  homelab media inbox name <path> album <MusicBrainz release id>
                                           file a download Tidy Up couldn't place, as you name it
  homelab media inbox leave <path>         leave a download be: Tidy Up never files it
  homelab media scrub [--apply]            sweep leftovers whose film, song or book is gone
  homelab media tdarr setup [--apply]      Tdarr's space-saving libraries for films and TV
  homelab media restore <run> [--yes]      put back what one run put in %[1]s (Undo on Tidy Up)
  homelab media arr [--apply]              Sonarr, Radarr and Lidarr stop renaming and importing:
                                           Tidy Up files their downloads instead

  --events json   one JSON object per line, for apps (the engines' own events)
  --yes           the step that asks (finalize, undo, apply) goes ahead: only after you agreed
  --background    run it detached; it outlives this window (scripts/logs/media)

Whatever is thrown away goes to %[1]s, never straight away. One job moves files at a time
(homelab.media.lock); while it does, the nightly updates leave the media apps and Duplicati waits.
`

// media runs Tidy Up (internal/media and the engines in tools/media).
func (h *homelab) media(ctx context.Context, args []string) error {
	if len(args) == 0 || args[0] == "status" {
		return h.mediaStatus(ctx, args)
	}
	switch args[0] {
	case "-h", "--help", "help":
		fmt.Fprintf(h.ui.Out, mediaUsage, media.TrashName(runtime.GOOS))
		return nil
	case "preflight":
		return h.mediaPreflight(ctx, args[1:])
	case "install":
		return h.mediaInstall(ctx, args[1:])
	case "inbox":
		// What I did today's Undo, and Needs a look's answers: homelab media
		// inbox undo <id>, name <path> movie|episode|album ..., leave <path>.
		if len(args) > 1 && (args[1] == "undo" || args[1] == "name" || args[1] == "leave") {
			return h.mediaEngine(ctx, "inbox", args[1], args[2:])
		}
		return h.mediaEngine(ctx, "inbox", "scan", args[1:])
	case "scrub":
		return h.mediaEngine(ctx, "scrubber", "scan", args[1:])
	case "tdarr":
		if len(args) < 2 || args[1] != "setup" {
			return errors.New("homelab media tdarr setup [--apply]")
		}
		return h.mediaEngine(ctx, "tdarr", "setup", args[2:])
	case "arr":
		return h.mediaArr(ctx, args[1:])
	case "restore":
		if len(args) < 2 || strings.HasPrefix(args[1], "-") {
			return errors.New("homelab media restore <run> [--yes]: the run is in Tidy Up's record (data/media.json)")
		}
		return h.mediaEngine(ctx, "trash", "restore", args[1:])
	case "tick":
		return h.mediaTick(ctx)
	}
	if !slices.Contains(media.Kinds, args[0]) {
		fmt.Fprintf(h.ui.Out, mediaUsage, media.TrashName(runtime.GOOS))
		return fmt.Errorf("no %q in Tidy Up", args[0])
	}
	if len(args) < 2 {
		return fmt.Errorf("homelab media %s <%s>", args[0], strings.Join(media.Actions(args[0]), "|"))
	}
	return h.mediaEngine(ctx, args[0], args[1], args[2:])
}

// mediaFlags takes homelab's own flags out of an engine's: --events,
// --yes, --background; the rest go to the engine as they are.
type mediaFlags struct {
	events, yes, background, apply bool
	rest                           []string
}

func parseMediaFlags(args []string) mediaFlags {
	var f mediaFlags
	for i := 0; i < len(args); i++ {
		switch a := args[i]; {
		case a == "--events" && i+1 < len(args):
			f.events = args[i+1] == "json"
			i++
		case a == "--events=json":
			f.events = true
		case a == "--yes" || a == "-y":
			f.yes = true
		case a == "--background":
			f.background = true
		case a == "--apply":
			f.apply = true
			f.rest = append(f.rest, a)
		default:
			f.rest = append(f.rest, a)
		}
	}
	return f
}

// mediaPython finds Python, or says how to get it.
func (h *homelab) mediaPython(ctx context.Context) ([]string, error) {
	if py := os.Getenv("HOMELAB_PYTHON"); py != "" {
		return strings.Fields(py), nil
	}
	p := mediaProbe()
	py, _ := p.Python(ctx)
	if py == nil {
		for _, c := range media.Preflight(ctx, p, h.envMap(), homeDir()) {
			if c.ID == "python" {
				return nil, fmt.Errorf("Tidy Up needs Python 3.8 or newer. %s", c.Fix)
			}
		}
	}
	return py, nil
}

// mediaProbe looks at this machine for Tidy Up's checks; tests replace it.
var mediaProbe = media.DefaultProbe

func homeDir() string {
	home, _ := os.UserHomeDir()
	return home
}

// mediaSettings writes homelab_media.json from .env and what's installed.
func (h *homelab) mediaSettings(ctx context.Context, py []string) error {
	env := h.envMap()
	installed := map[string]bool{}
	if client, err := h.docker(ctx); err == nil {
		if containers, err := client.Containers(ctx); err == nil {
			report := detect.Analyze(h.catalog, containers)
			for _, a := range h.catalog.Apps {
				if st, _ := report.State(a.ID); st == detect.Running || st == detect.Stopped {
					installed[a.ID] = true
				}
			}
		}
	}
	probe := mediaProbe()
	gpu, _ := probe.GPU(ctx)
	in := media.Inputs{Root: h.root, Env: env, Home: homeDir(), Installed: func(id string) bool { return installed[id] },
		NativeJellyfin: !installed["jellyfin-container"] && portAnswers(or(env["JELLYFIN_PORT"], "8096")),
		GPU:            gpu, Record: media.LoadRecord(h.root), LocalEngine: probe.LocalEngine(ctx, py)}
	in.CalibreDir, _ = media.CalibreDir(probe, env, homeDir())
	_, err := media.Write(h.root, media.Settings(in))
	return err
}

func or(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

// portAnswers reports whether something listens on a port of this machine.
var portAnswers = func(port string) bool {
	c, err := net.DialTimeout("tcp", "127.0.0.1:"+port, 300*time.Millisecond)
	if err != nil {
		return false
	}
	c.Close()
	return true
}

// mediaEngine runs one engine action: settings, the checks, the lock,
// then the engine, its events shown and its result recorded.
func (h *homelab) mediaEngine(ctx context.Context, kind, action string, args []string) error {
	act, err := media.Lookup(kind, action)
	if err != nil {
		return err
	}
	f := parseMediaFlags(args)
	if f.background {
		return h.mediaBackground(kind, action, args)
	}
	py, err := h.mediaPython(ctx)
	if err != nil {
		return err
	}
	env := h.envMap()
	if tdarrJob(kind, action) {
		h.tdarrAccount(ctx, env)
	}
	// Python was found above (HOMELAB_PYTHON, or the probe): the other checks.
	checks := slices.DeleteFunc(media.Preflight(ctx, mediaProbe(), env, homeDir()), func(c media.Check) bool { return c.ID == "python" })
	// Lyrics set right on this computer (--tidy), or counted (--check), are
	// light: only asking LRCLIB about every song waits for power.
	heavy := act.Power && !(kind == "music" && action == "lyrics" && (slices.Contains(f.rest, "--tidy") || slices.Contains(f.rest, "--check")))
	if c := media.Blocking(checks, kind, heavy); c != nil {
		if c.ID == "power" {
			return media.ErrOnBattery
		}
		return fmt.Errorf("%s: %s. %s", c.Name, c.Note, c.Fix)
	}
	if err := h.mediaSettings(ctx, py); err != nil {
		return err
	}
	// The inbox's sweep and the scrubber only preview without --apply: no
	// lock then. The inbox's Undo, name, and leave act at once.
	preview := kind == "inbox" && action == "scan" || kind == "scrubber" || kind == "tdarr"
	lock := act.Lock && (f.apply || !preview)
	if kind == "music" && action == "genres" && !f.apply || kind == "music" && action == "lyrics" && slices.Contains(f.rest, "--check") {
		lock = false
	}
	logf, err := media.LogFile(h.root, kind, action)
	if err != nil {
		return err
	}
	defer logf.Close()
	// warn tells the household: in a terminal, or to the app as an event.
	warn := func(msg string) {
		if f.events {
			line, _ := json.Marshal(media.Event{Type: "warn", Text: msg})
			fmt.Fprintln(h.ui.Out, string(line))
			return
		}
		h.ui.Warn("%s", msg)
	}
	if lock {
		stale, err := media.Acquire(h.root, kind, action, logf.Name())
		if err != nil {
			return err
		}
		if stale != nil {
			warn(fmt.Sprintf("%s %s stopped part-way at %s; this run carries on from there", stale.Kind, stale.Action, stale.Start.Local().Format("15:04")))
		}
		h.pauseDuplicati(ctx)
		defer func() {
			_ = media.Release(h.root)
			h.resumeDuplicati(ctx)
		}()
	}
	// A beets venv left pointing at a Python that was upgraded away fails
	// every music job: it goes, and the engine makes it again.
	if removed, rerr := media.RepairVenv(ctx, homeDir()); rerr != nil || removed {
		msg := "Tidy Up's beets setup stopped working (its Python was updated); it's installed again on this run, which takes about a minute"
		if rerr != nil {
			msg = fmt.Sprintf("Tidy Up's beets setup in %s doesn't work and couldn't be removed (%v). Delete that folder and run again", media.VenvPath(homeDir()), rerr)
		}
		warn(msg)
	}
	job := media.Job{Root: h.root, Kind: kind, Action: action, Args: f.rest, Env: env, Python: py, Yes: f.yes, Log: logf,
		Out: func(ev media.Event, line string) {
			if f.events {
				fmt.Fprintln(h.ui.Out, line)
				return
			}
			// status --json: printed as it is. An engine's own info events
			// are JSON lines too, and are shown as text like the rest.
			if ev.Raw == nil && strings.HasPrefix(strings.TrimSpace(line), "{") {
				fmt.Fprintln(h.ui.Out, line)
				return
			}
			if l := ev.Line(); l != "" {
				fmt.Fprintln(h.ui.Out, l)
			}
		}}
	run, err := media.Execute(ctx, job)
	if action != "status" {
		rec := media.LoadRecord(h.root)
		rec.Note(kind, run)
		if kind == "tdarr" && run.OK {
			if libs, ok := run.Result["libraries"].(map[string]any); ok {
				rec.TdarrLibraries = map[string]string{}
				for k, v := range libs {
					if s, _ := v.(string); s != "" {
						rec.TdarrLibraries[k] = s
					}
				}
			}
		}
		if kind == "inbox" && f.apply {
			rec.LastInbox = time.Now().UTC()
		}
		if kind == "scrubber" && f.apply {
			rec.LastScrub = time.Now().UTC()
		}
		if serr := rec.Save(h.root); serr != nil {
			h.ui.Warn("Tidy Up's record: %v", serr)
		}
		// Still under the media lock, which the engines write the trash
		// log under: what Undo can no longer reach goes.
		if lock {
			if terr := media.TrimTrashLog(h.root, rec, time.Now()); terr != nil {
				h.ui.Warn("Tidy Up's trash log: %v", terr)
			}
		}
	}
	return err
}

// mediaBackground starts the same command detached: it outlives the
// window and the app, writing its events to scripts/logs/media.
func (h *homelab) mediaBackground(kind, action string, args []string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	var rest []string
	for _, a := range args {
		if a != "--background" {
			rest = append(rest, a)
		}
	}
	if !slices.Contains(rest, "--events") && !slices.Contains(rest, "--events=json") {
		rest = append(rest, "--events", "json")
	}
	full := []string{"--root", h.root, "media"}
	switch kind {
	case "inbox", "scrubber":
		full = append(full, map[string]string{"inbox": "inbox", "scrubber": "scrub"}[kind])
		if kind == "inbox" && action != "scan" {
			full = append(full, action)
		}
	case "tdarr":
		full = append(full, "tdarr", "setup")
	case "trash":
		full = append(full, "restore")
	default:
		full = append(full, kind, action)
	}
	if err := os.MkdirAll(media.LogDir(h.root), 0o755); err != nil {
		return err
	}
	// Kept as the agent's job logs are: past jobLogLimit its older half
	// moves to background.1.log.
	out, err := openJobLog(media.LogDir(h.root), "background", jobLogLimit)
	if err != nil {
		return err
	}
	defer out.Close()
	c := procattr.Hide(exec.Command(self, append(full, rest...)...))
	c.Dir, c.Stdout, c.Stderr = h.root, out, out
	detach(c)
	if err := c.Start(); err != nil {
		return err
	}
	h.ui.OK("Running in the background (process %d); Tidy Up shows its progress, and scripts/logs/media has its log.", c.Process.Pid)
	return c.Process.Release()
}

// mediaStatus is Tidy Up at a glance, without Python: the record, the lock,
// and each library's folder.
func (h *homelab) mediaStatus(ctx context.Context, args []string) error {
	env := h.envMap()
	home := homeDir()
	lock, running := media.ReadLock(h.root)
	type lib struct {
		Kind   string `json:"kind"`
		Folder string `json:"folder"`
		Found  bool   `json:"found"`
	}
	var libs []lib
	for _, k := range media.Kinds {
		p := media.Library(env, home, k)
		_, err := os.Stat(p)
		libs = append(libs, lib{k, p, err == nil})
	}
	out := map[string]any{"libraries": libs, "record": media.LoadRecord(h.root), "inbox": media.InboxFolders(env, home),
		"tools": media.ToolsDir(h.root), "reports": media.ReportsDir(h.root)}
	if running {
		out["lock"] = lock
	} else if lock.PID > 0 {
		out["stale"] = lock
	}
	if h.ui.JSON || slices.Contains(args, "--json") {
		data, _ := json.Marshal(out)
		fmt.Fprintln(h.ui.Out, string(data))
		return nil
	}
	u := h.ui
	u.Title("Tidy Up")
	for _, l := range libs {
		state := u.Green("found")
		if !l.Found {
			state = u.Yellow("not found (drive unplugged?)")
		}
		u.Printf("  %-11s %s  %s\n", l.Kind, l.Folder, state)
	}
	if running {
		u.Printf("\n  Running: %s %s since %s\n", lock.Kind, lock.Action, lock.Start.Local().Format("15:04"))
	} else if lock.PID > 0 {
		u.Warn("%s %s stopped part-way; run it again to carry on", lock.Kind, lock.Action)
	}
	rec := media.LoadRecord(h.root)
	if n := len(rec.Activity); n > 0 {
		u.Printf("\n  Recent:\n")
		for _, a := range rec.Activity[max(0, n-8):] {
			u.Printf("    %s  %s%s\n", a.At.Local().Format("Jan 2 15:04"), a.Text, u.Dim(prefix(" · ", a.Sub)))
		}
	}
	return nil
}

func prefix(p, s string) string {
	if s == "" {
		return ""
	}
	return p + s
}

// mediaPreflight lists what Tidy Up needs and how this machine stands.
func (h *homelab) mediaPreflight(ctx context.Context, args []string) error {
	p := mediaProbe()
	p.Runtime = func(ctx context.Context) error {
		c, err := h.docker(ctx)
		if err != nil {
			return err
		}
		_, err = c.Info(ctx)
		return err
	}
	checks := media.Preflight(ctx, p, h.envMap(), homeDir())
	if h.ui.JSON || slices.Contains(args, "--json") {
		data, _ := json.Marshal(checks)
		fmt.Fprintln(h.ui.Out, string(data))
		return nil
	}
	h.ui.Title("Tidy Up: this machine")
	for _, c := range checks {
		if c.OK {
			h.ui.OK("%s: %s", c.Name, c.Note)
		} else {
			h.ui.Warn("%s: %s. %s", c.Name, c.Note, c.Fix)
		}
	}
	return nil
}

// mediaArr hands the libraries to Tidy Up: Sonarr, Radarr, and Lidarr stop
// renaming files and importing finished downloads; LazyLibrarian is told how.
func (h *homelab) mediaArr(ctx context.Context, args []string) error {
	fs := newFlags("media arr")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	w := wiring.New(h.catalog, containers, h.envMap(), homeDir())
	u := h.ui
	plan := w.HandOverPlan()
	if len(plan) == 0 {
		u.Println("Nothing to hand over: none of Sonarr, Radarr, Lidarr, or LazyLibrarian is running.")
		return nil
	}
	if u.JSON {
		emit(u, "handover", plan)
	} else {
		u.Title("Tidy Up owns the libraries")
		for _, l := range plan {
			u.Info("%s", l.Text)
		}
	}
	if err := h.goAhead(*apply, "\nChange these settings?"); err != nil {
		return err
	}
	failed := 0
	w.HandOver(ctx, func(l wiring.Link) {
		if u.JSON {
			emit(u, "link", l)
		}
		switch l.State {
		case "failed":
			failed++
			if !u.JSON {
				u.Fail("%s: %s", l.Text, l.Detail)
			}
		case "manual":
			if !u.JSON {
				u.Warn("%s: %s", l.Text, l.Detail)
			}
		default:
			if !u.JSON {
				u.OK("%s%s", l.Text, u.Dim(map[string]string{"already": " (already)"}[l.State]))
			}
		}
	})
	if failed > 0 {
		return fmt.Errorf("%d setting(s) not changed", failed)
	}
	return nil
}

// pauseDuplicati holds Duplicati's scheduled backups while files move, so
// no backup reads a library half-way through a swap. Best effort: a
// homelab without Duplicati has nothing to pause.
func (h *homelab) pauseDuplicati(ctx context.Context) {
	env := h.envMap()
	if env["DUPLICATI_PASSWORD"] == "" || strings.HasPrefix(env["DUPLICATI_PASSWORD"], "__") || !portAnswers(or(env["DUPLICATI_PORT"], "8200")) {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	c, err := h.duplicatiLogin(ctx)
	if err == nil {
		err = c.Pause(ctx)
	}
	if err != nil {
		return
	}
	rec := media.LoadRecord(h.root)
	rec.DuplicatiPaused = true
	_ = rec.Save(h.root)
}

// resumeDuplicati lets Duplicati run again, when the media lock paused it.
func (h *homelab) resumeDuplicati(ctx context.Context) {
	rec := media.LoadRecord(h.root)
	if !rec.DuplicatiPaused || media.Held(h.root) {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
	defer cancel()
	c, err := h.duplicatiLogin(ctx)
	if err == nil {
		err = c.Resume(ctx)
	}
	if err != nil {
		h.ui.Warn("Duplicati is still paused (%v): resume it in its menu", err)
		return
	}
	rec = media.LoadRecord(h.root)
	rec.DuplicatiPaused = false
	_ = rec.Save(h.root)
}

// Tidy Up's timetable, run by the agent every minute.
const (
	scrubHour    = 3 // the nightly scrubber, daily at 03:00
	collectEvery = 5 * time.Minute
)

// mediaTick is the agent's minute for Tidy Up: the inbox when Downloads
// changed, Tdarr's finished work every few minutes, the scrubber daily at
// 03:00, and Duplicati resumed after a job that crashed. Nothing while a
// job holds the lock.
func (h *homelab) mediaTick(ctx context.Context) error {
	env := h.envMap()
	if off(env["TIDY_UP"]) {
		return nil
	}
	if media.Held(h.root) {
		return nil
	}
	h.resumeDuplicati(ctx)
	rec := media.LoadRecord(h.root)
	now := time.Now()
	home := homeDir()
	var errs []error
	if !off(env["TIDY_INBOX"]) {
		sig := media.InboxSignature(media.InboxFolders(env, home), now)
		if inboxDue(env["TIDY_INBOX_WHEN"], sig != rec.InboxSeen, now, rec.Last["inbox"]["scan"].At) {
			if err := h.mediaEngine(ctx, "inbox", "scan", []string{"--apply"}); err != nil && !errors.Is(err, media.ErrBusy) {
				errs = append(errs, err)
			}
			rec = media.LoadRecord(h.root)
			if last := rec.Last["inbox"]["scan"]; last.OK && len(anyList(last.Result["waiting"])) == 0 {
				rec.InboxSeen = sig
				_ = rec.Save(h.root)
			}
		}
	}
	for _, kind := range []string{"movies", "tv"} {
		if media.HasTdarrWork(home, kind) && now.Sub(rec.Last[kind]["collect"].At) >= collectEvery {
			if err := h.mediaEngine(ctx, kind, "collect", nil); err != nil && !errors.Is(err, media.ErrBusy) {
				errs = append(errs, err)
			}
		}
	}
	if !off(env["TIDY_SCRUB"]) && scrubDue(now, rec.LastScrub) {
		if err := h.mediaEngine(ctx, "scrubber", "scan", []string{"--apply"}); err != nil && !errors.Is(err, media.ErrBusy) {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// inboxDue is whether the agent sweeps the watched folders now, by
// TIDY_INBOX_WHEN: "daily" once after 03:00 (beside the nightly scrubber),
// "manual" never (Tidy up now does), else as things arrive: when the
// folders changed since the last sweep that left nothing waiting.
func inboxDue(when string, changed bool, now, last time.Time) bool {
	switch strings.ToLower(strings.TrimSpace(when)) {
	case "manual":
		return false
	case "daily":
		return scrubDue(now, last)
	}
	return changed
}

// scrubDue: 03:00 has passed today and the scrubber hasn't run since.
func scrubDue(now, last time.Time) bool {
	at := time.Date(now.Year(), now.Month(), now.Day(), scrubHour, 0, 0, 0, now.Location())
	return !now.Before(at) && last.Before(at)
}

func off(v string) bool {
	v = strings.ToLower(strings.TrimSpace(v))
	return v == "false" || v == "0" || v == "no" || v == "off"
}

func anyList(v any) []any {
	l, _ := v.([]any)
	return l
}
