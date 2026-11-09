package main

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	goruntime "runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Tidy Up: the screen's data (internal/media, read without Python) and its
// jobs, which run homelab media and pass the engines' events on as
// "media:event".

// TidyUp is what the Tidy Up screen shows.
type TidyUp struct {
	Libraries []TidyLibrary    `json:"libraries"`
	Lock      *media.Lock      `json:"lock,omitempty"`
	Stale     *media.Lock      `json:"stale,omitempty"`
	Activity  []media.Activity `json:"activity"`
	Freed     int64            `json:"freed"`
	Checks    []media.Check    `json:"checks"`
	Inbox     TidyInbox        `json:"inbox"`
	// Today is what the inbox filed today, newest first (What I did today).
	Today []media.Filed `json:"today"`
	// Needs is what the inbox couldn't place, or Undo put back (Needs a look).
	Needs []media.Need `json:"needs"`
	// Settings are the TIDY_ settings from .env, for the screen's words.
	Settings map[string]string `json:"settings"`
	// Reports is the folder the engines write their reports into.
	Reports string `json:"reports"`
	Trash   string `json:"trash"` // "the Trash", or "the Recycle Bin"
	// Tdarr are the libraries homelab media tdarr setup made ("movies", "tv").
	Tdarr map[string]string `json:"tdarr,omitempty"`
	// Drive is the disk most of the libraries are on, and its space; none
	// when no library's folder is there.
	Drive *TidyDrive `json:"drive,omitempty"`
}

// TidyDrive is the media drive: its name ("Hobbies", "M:"; "" for the
// machine's own disk) and space in bytes.
type TidyDrive struct {
	Name  string `json:"name,omitempty"`
	Free  uint64 `json:"free"`
	Total uint64 `json:"total"`
}

// TidyLibrary is one library: its folder, where it stands, and its last runs.
type TidyLibrary struct {
	Kind   string               `json:"kind"`
	Folder string               `json:"folder"`
	Found  bool                 `json:"found"`
	Stage  string               `json:"stage"` // music: new, scanned, built, swapped, verified, freed
	Last   map[string]media.Run `json:"last,omitempty"`
	Freed  int64                `json:"freed"`
	// Counts are the engine's own record (movies, tv: lean, bloated,
	// queued, failed; audiobooks: merged, failed), from ~/.homelab-media.
	Counts map[string]int `json:"counts,omitempty"`
	// Waiting: downloads in Tdarr's queue before they're filed.
	Waiting int `json:"waiting,omitempty"`
	// Size is the library's size on disk as last measured (in the
	// background, at most every few hours); 0 until it has been.
	Size int64 `json:"size,omitempty"`
	// NoCalibre: books in a folder that isn't a Calibre library (no
	// metadata.db), Loose of them, for Make a Calibre library to offer.
	NoCalibre bool `json:"noCalibre,omitempty"`
	Loose     int  `json:"loose,omitempty"`
}

// TidyInbox is the Downloads watcher: the folders it watches (Gone: those
// not there now, a drive unplugged), and When it files what's in them
// (TIDY_INBOX_WHEN: arrive, daily, or manual).
type TidyInbox struct {
	Folders  []string   `json:"folders"`
	Gone     []string   `json:"gone,omitempty"`
	When     string     `json:"when"`
	Watching bool       `json:"watching"`
	Last     *media.Run `json:"last,omitempty"`
}

// inboxWhens are TIDY_INBOX_WHEN's choices; arrive when unset.
var inboxWhens = []string{"arrive", "daily", "manual"}

func inboxWhen(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	if slices.Contains(inboxWhens, v) {
		return v
	}
	return "arrive"
}

// TidySetInbox keeps the folders Tidy Up watches and when it files what's
// in them (the Inbox card's Add, Remove, and when), in .env.
func (a *App) TidySetInbox(folders []string, when string) (TidyUp, error) {
	var keep []string
	for _, f := range folders {
		if f = strings.TrimSpace(f); f != "" && !slices.Contains(keep, f) {
			keep = append(keep, f)
		}
	}
	if len(keep) == 0 {
		return TidyUp{}, errors.New("keep at least one folder for Tidy Up to watch")
	}
	if !slices.Contains(inboxWhens, when) {
		return TidyUp{}, fmt.Errorf("when is arrive, daily, or manual, not %q", when)
	}
	if _, err := a.SaveSettings(map[string]string{"TIDY_INBOX_FOLDERS": strings.Join(keep, ";"), "TIDY_INBOX_WHEN": when}); err != nil {
		return TidyUp{}, err
	}
	return a.TidyUp()
}

// TidyPickFolder opens the system's folder picker for a folder to watch;
// "" when cancelled.
func (a *App) TidyPickFolder() (string, error) {
	return directoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose a folder for Tidy Up to watch", CanCreateDirectories: true})
}

// TidyUp reads Tidy Up's record, the lock, and what this machine has.
func (a *App) TidyUp() (TidyUp, error) {
	env := core.Env(a.root)
	home, _ := os.UserHomeDir()
	rec := media.LoadRecord(a.root)
	out := TidyUp{Activity: rec.Activity, Settings: map[string]string{}, Reports: media.ReportsDir(a.root),
		Trash: media.TrashName(goruntime.GOOS), Tdarr: rec.TdarrLibraries}
	if out.Activity == nil {
		out.Activity = []media.Activity{}
	}
	for k, v := range env {
		if strings.HasPrefix(k, "TIDY_") {
			out.Settings[k] = v
		}
	}
	if l, running := media.ReadLock(a.root); running {
		out.Lock = &l
	} else if l.PID > 0 {
		out.Stale = &l
	}
	sizes := media.LoadSizes(home)
	present := map[string]string{}
	var locs []diskspace.Location
	for _, kind := range media.Kinds {
		lib := TidyLibrary{Kind: kind, Folder: media.Library(env, home, kind), Last: rec.Last[kind], Freed: rec.Freed[kind]}
		_, err := os.Stat(lib.Folder)
		lib.Found = err == nil
		lib.Stage = stage(kind, rec.Last[kind])
		lib.Counts, lib.Waiting = engineCounts(home, kind)
		lib.Size = sizes[kind].Bytes
		if lib.Found && kind == "books" && !media.IsCalibreLibrary(lib.Folder) {
			lib.NoCalibre, lib.Loose = true, media.LooseBooks(lib.Folder)
		}
		if lib.Found {
			present[kind] = lib.Folder
			locs = append(locs, diskspace.Location{Name: kind, Path: lib.Folder})
		}
		out.Freed += lib.Freed
		out.Libraries = append(out.Libraries, lib)
	}
	out.Drive = mediaDrive(locs)
	// Measured again in the background when older than six hours: the next read has them.
	refreshSizes(home, present, 6*time.Hour, time.Now)
	out.Inbox = TidyInbox{Folders: media.InboxFolders(env, home), When: inboxWhen(env["TIDY_INBOX_WHEN"]), Watching: !offSetting(env["TIDY_UP"]) && !offSetting(env["TIDY_INBOX"])}
	for _, f := range out.Inbox.Folders {
		if _, err := os.Stat(f); err != nil {
			out.Inbox.Gone = append(out.Inbox.Gone, f)
		}
	}
	if r, ok := rec.Last["inbox"]["scan"]; ok {
		out.Inbox.Last = &r
	}
	out.Today = media.FiledToday(a.root, time.Now())
	out.Needs = media.NeedsLook(a.root)
	out.Checks = media.Preflight(a.ctx, media.DefaultProbe(), env, home)
	return out, nil
}

// refreshSizes starts the background measure (a test swaps it, so nothing
// keeps writing into its temporary home after it ends).
var refreshSizes = media.RefreshSizes

// mediaDrive is the disk holding the most libraries (the media drive), by
// the name of its top folder: "Hobbies" for /Volumes/Hobbies/music, "M:" on
// Windows.
func mediaDrive(locs []diskspace.Location) *TidyDrive {
	var best *diskspace.Volume
	for _, v := range diskspace.Check(locs) {
		if best == nil || len(v.Names) > len(best.Names) {
			v := v
			best = &v
		}
	}
	if best == nil {
		return nil
	}
	return &TidyDrive{Name: driveName(best.Path, os.Getenv("USER")), Free: best.Free, Total: best.Total}
}

// driveName is a drive's name from a folder on it: the volume's name on a Mac
// (/Volumes/Hobbies), a mounted drive's on Linux (/media/you/Hobbies or
// /media/Hobbies, /run/media/deck/Hobbies, /mnt/Hobbies), the drive letter
// on Windows, else "" (the machine's own disk).
func driveName(p, user string) string {
	if v := filepath.VolumeName(p); v != "" {
		return v
	}
	parts := strings.Split(filepath.ToSlash(filepath.Clean(p)), "/")
	at := func(i int) string {
		if i < len(parts) {
			return parts[i]
		}
		return ""
	}
	switch at(1) {
	case "Volumes", "mnt":
		return at(2)
	case "media":
		if at(2) == user && at(3) != "" {
			return at(3)
		}
		return at(2)
	case "run":
		if at(2) == "media" {
			return at(4)
		}
	}
	return ""
}

func offSetting(v string) bool {
	v = strings.ToLower(strings.TrimSpace(v))
	return v == "false" || v == "0" || v == "no" || v == "off"
}

// stage is where a library's cleanup stands, from its last runs.
func stage(kind string, last map[string]media.Run) string {
	after := func(a, b string) bool {
		ra, ok := last[a]
		return ok && ra.OK && (last[b].At.IsZero() || ra.At.After(last[b].At))
	}
	switch kind {
	case "music":
		switch {
		case after("free-space", "run") && after("free-space", "finalize"):
			return "freed"
		case after("verify", "finalize") && after("finalize", "undo"):
			return "verified"
		case after("finalize", "undo") && after("finalize", "run"):
			return "swapped"
		case after("run", "scan") || last["run"].OK:
			return "built"
		case last["scan"].OK:
			return "scanned"
		}
	case "books":
		switch {
		case after("apply", "review"):
			return "applied"
		case last["review"].OK:
			return "reviewed"
		}
	default:
		if last["run"].OK {
			return "running"
		}
		if last["scan"].OK {
			return "scanned"
		}
	}
	return "new"
}

// engineCounts reads an engine's own record in ~/.homelab-media.
func engineCounts(home, kind string) (map[string]int, int) {
	data, err := os.ReadFile(filepath.Join(home, ".homelab-media", kind+".json"))
	if err != nil {
		return nil, 0
	}
	var st struct {
		Files   map[string]struct{ Status string } `json:"files"`
		Pending map[string]json.RawMessage         `json:"pending"`
		Done    map[string]json.RawMessage         `json:"done"`
		Failed  map[string]json.RawMessage         `json:"failed"`
	}
	if json.Unmarshal(data, &st) != nil {
		return nil, 0
	}
	counts := map[string]int{}
	for _, f := range st.Files {
		counts[f.Status]++
	}
	if st.Done != nil {
		counts["merged"] = len(st.Done)
	}
	if len(st.Failed) > 0 {
		counts["failed"] += len(st.Failed)
	}
	return counts, len(st.Pending)
}

// tidyJob is the one Tidy Up job the window runs, for Stop.
type tidyJob struct {
	mu     sync.Mutex
	cancel context.CancelFunc
}

var tidy tidyJob

// TidyRun runs homelab media for kind and action, sending each of the
// engine's events as "media:event". yes answers the step's question: the
// screen asked first. kind "inbox", "scrubber", "tdarr", and "arr" are the
// inbox, the scrubber, Tdarr's setup, and the *arr hand-over.
func (a *App) TidyRun(kind, action string, args []string, yes bool) error {
	tidy.mu.Lock()
	if tidy.cancel != nil {
		tidy.mu.Unlock()
		return errors.New("a Tidy Up job is running: wait for it, or stop it")
	}
	ctx, cancel := context.WithCancel(a.ctx)
	tidy.cancel = cancel
	tidy.mu.Unlock()
	defer func() {
		tidy.mu.Lock()
		tidy.cancel = nil
		tidy.mu.Unlock()
		cancel()
	}()
	cli, err := tidyArgs(kind, action, args, yes)
	if err != nil {
		return err
	}
	// Needs a look's answers move only what Needs a look listed.
	if kind == "inbox" && (action == "name" || action == "leave") && !needsListed(a.root, args[0]) {
		return errors.New("that download isn't waiting in Needs a look any more")
	}
	c := core.CLIContext(ctx, a.root, cli...)
	c.Cancel = func() error { return interrupt(c.Process) }
	out, err := c.StdoutPipe()
	if err != nil {
		return err
	}
	var tail, failed tailLines
	c.Stderr = &tail
	if err := c.Start(); err != nil {
		return err
	}
	readEvents(out, func(ev map[string]any) {
		// What the command said went wrong, on its own output (ffmpeg not installed): the reason, if it fails.
		if ev["type"] == "fail" {
			failed.Write([]byte(fmt.Sprint(ev["text"]) + "\n"))
		}
		emitEvent(a.ctx, "media:event", ev)
	})
	err = c.Wait()
	if ctx.Err() != nil && a.ctx.Err() == nil {
		return errors.New("stopped: run it again to carry on where it left off")
	}
	if err != nil {
		// Its reason, not "exit status 1": what it wrote last on its errors, or the last line it marked ✗.
		for _, t := range []*tailLines{&tail, &failed} {
			if why := t.last(); why != "" {
				return errors.New(why)
			}
		}
	}
	return err
}

// tidyArgs is the homelab command line for one of the screen's jobs.
func tidyArgs(kind, action string, args []string, yes bool) ([]string, error) {
	var cli []string
	switch kind {
	case "inbox":
		cli = []string{"media", "inbox"}
		if action == "undo" || action == "name" || action == "leave" {
			cli = append(cli, action)
		}
	case "scrubber":
		cli = []string{"media", "scrub"}
	case "tdarr":
		cli = []string{"media", "tdarr", "setup"}
	case "arr":
		return []string{"media", "arr", "--apply"}, nil
	case "trash":
		cli = []string{"media", "restore"}
	case "install":
		// The Install button beside a missing tool: ffmpeg is the one it fetches.
		if action != "ffmpeg" {
			return nil, fmt.Errorf("no install of %q in Tidy Up", action)
		}
		cli = []string{"media", "install", "ffmpeg"}
	default:
		if _, err := media.Lookup(kind, action); err != nil {
			return nil, err
		}
		cli = []string{"media", kind, action}
	}
	rest, err := tidyScreenArgs(kind, action, args)
	if err != nil {
		return nil, err
	}
	cli = append(cli, rest...)
	cli = append(cli, "--events", "json")
	if yes {
		cli = append(cli, "--yes")
	}
	return cli, nil
}

// What the screen sends a job besides its kind and action: Undo's run, the
// books' ids to leave alone, --apply or --check, and music lyrics' --tidy. Anything else (another
// library, other settings, files of the page's choosing) is refused, so a
// bug in the page can't point Tidy Up at any folder but the libraries.
var (
	tidyRunID = regexp.MustCompile(`^[a-z]+(-[a-z]+)+-[0-9]+$`)
	tidyIDs   = regexp.MustCompile(`^[0-9]+(,[0-9]+)*$`)
	// tidyFiledID is one line of What I did today (inbox.py's describe).
	tidyFiledID = regexp.MustCompile(`^[0-9a-f]{12}$`)
)

func tidyScreenArgs(kind, action string, args []string) ([]string, error) {
	var out []string
	runs := 0
	for i := 0; i < len(args); i++ {
		switch a := args[i]; {
		case a == "--yes" || a == "-y" || a == "--background":
			// the screen's yes is its own argument
		case a == "--apply" || a == "--check":
			out = append(out, a)
		case a == "--tidy" && kind == "music" && action == "lyrics":
			// Tidy lyrics: the songs' own lyrics set right, on this computer.
			out = append(out, a)
		case a == "--skip" && i+1 < len(args) && tidyIDs.MatchString(args[i+1]):
			out = append(out, a, args[i+1])
			i++
		case kind == "trash" && tidyRunID.MatchString(a):
			out = append(out, a)
			runs++
		case kind == "inbox" && action == "undo" && tidyFiledID.MatchString(a):
			out = append(out, a)
			runs++
		case kind == "inbox" && (action == "name" || action == "leave") && i == 0:
			// Needs a look's answers: the download (one Needs a look listed:
			// TidyRun checks), then for name what it is, in the person's words.
			rest, err := tidyNameArgs(action, args)
			if err != nil {
				return nil, err
			}
			return append(out, rest...), nil
		default:
			return nil, fmt.Errorf("Tidy Up doesn't run a job with %q", a)
		}
	}
	if kind == "inbox" && (action == "name" || action == "leave") {
		return nil, errors.New("Tidy Up doesn't run that: which download?")
	}
	if (kind == "trash" || kind == "inbox" && action == "undo") && runs != 1 {
		return nil, errors.New("Undo puts back one run at a time")
	}
	return out, nil
}

// tidyNameArgs are Needs a look's: leave <path>, or name <path> movie
// <title> [<year>] / episode <show> <season> [<episode>]. A word that looks
// like a flag is refused, so a title can't turn into --library.
func tidyNameArgs(action string, args []string) ([]string, error) {
	bad := errors.New("Tidy Up doesn't run that: say what it is")
	if len(args) == 0 || !filepath.IsAbs(args[0]) {
		return nil, bad
	}
	if action == "leave" {
		if len(args) != 1 {
			return nil, bad
		}
		return args, nil
	}
	if len(args) < 3 || (args[1] != "movie" && args[1] != "episode") || strings.TrimSpace(args[2]) == "" {
		return nil, bad
	}
	nums := args[3:]
	if len(nums) > 2 || args[1] == "movie" && len(nums) > 1 || args[1] == "episode" && len(nums) == 0 {
		return nil, bad
	}
	for _, a := range append([]string{args[2]}, nums...) {
		if strings.HasPrefix(strings.TrimSpace(a), "-") {
			return nil, bad
		}
	}
	for _, n := range nums {
		if !tidyNumber.MatchString(n) {
			return nil, bad
		}
	}
	return args, nil
}

var tidyNumber = regexp.MustCompile(`^[0-9]{1,4}$`)

// readEvents sends each line as an event: the engines' JSON as it is, the
// CLI's own lines (homelab media arr) as "info".
func readEvents(r io.Reader, send func(map[string]any)) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64<<10), 8<<20)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		var ev map[string]any
		if strings.HasPrefix(line, "{") && json.Unmarshal([]byte(line), &ev) == nil && ev["type"] != nil {
			send(ev)
			continue
		}
		// A line the command marked ✗ is a failure (red on the screen); the rest are what it says.
		typ := "info"
		if strings.HasPrefix(line, "✗") {
			typ = "fail"
		}
		send(map[string]any{"type": typ, "text": strings.TrimSpace(strings.TrimLeft(line, " ✓!✗•"))})
	}
}

// tailLines keeps the last lines a command wrote, for its error.
type tailLines struct {
	mu    sync.Mutex
	lines []string
}

func (t *tailLines) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	for _, l := range strings.Split(string(p), "\n") {
		if l = strings.TrimSpace(l); l != "" {
			t.lines = append(t.lines, l)
		}
	}
	if len(t.lines) > 20 {
		t.lines = t.lines[len(t.lines)-20:]
	}
	return len(p), nil
}

func (t *tailLines) last() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	for i := len(t.lines) - 1; i >= 0; i-- {
		l := strings.TrimLeft(t.lines[i], "✗ ")
		if !strings.HasPrefix(l, "exit status") {
			return l
		}
	}
	return ""
}

// TidyRunning is a Tidy Up job that holds the lock (another window's, the
// agent's, a terminal's), and where its log says it has got to.
type TidyRunning struct {
	Lock *media.Lock     `json:"lock,omitempty"`
	Now  media.Following `json:"now"`
}

// TidyLock is the job holding Tidy Up's lock now, if any, with its step and
// bar: light enough for the screen to ask every few seconds while one runs
// (TidyUp also checks this machine's tools, which takes longer).
func (a *App) TidyLock() TidyRunning {
	l, running := media.ReadLock(a.root)
	if !running {
		return TidyRunning{}
	}
	return TidyRunning{Lock: &l, Now: media.Follow(a.root, l)}
}

// TidyStop stops the job the window runs; the engine saves where it got to.
func (a *App) TidyStop() {
	tidy.mu.Lock()
	defer tidy.mu.Unlock()
	if tidy.cancel != nil {
		tidy.cancel()
	}
}

// TidyReveal shows a Tidy Up folder or report in the file manager: one of
// the libraries, the reports, or a file in them.
func (a *App) TidyReveal(path string) error {
	env := core.Env(a.root)
	home, _ := os.UserHomeDir()
	allowed := []string{media.ReportsDir(a.root), media.LogDir(a.root)}
	for _, k := range media.Kinds {
		allowed = append(allowed, media.Library(env, home, k))
	}
	allowed = append(allowed, media.InboxFolders(env, home)...)
	clean := filepath.Clean(path)
	for _, root := range allowed {
		if clean == filepath.Clean(root) || strings.HasPrefix(clean, filepath.Clean(root)+string(filepath.Separator)) {
			if _, err := os.Stat(clean); err != nil {
				return errors.New("it isn't there any more")
			}
			return core.Reveal(clean)
		}
	}
	return errors.New("that isn't one of Tidy Up's folders")
}

// TidyBook is one book in the books review: what would change, and its covers.
type TidyBook struct {
	ID      int          `json:"id"`
	Title   string       `json:"title"`
	Changes []TidyChange `json:"changes"`
	// Cover: a new cover is proposed (TidyCover shows both).
	Cover bool `json:"cover"`
	// Held: the review left it alone (it looks misfiled).
	Held bool `json:"held"`
}

// TidyChange is one field of a book: before and after, and why.
type TidyChange struct {
	Field  string `json:"field"`
	Old    string `json:"old"`
	New    string `json:"new"`
	Reason string `json:"reason,omitempty"`
}

// TidyReview is the last books review, read from its reports: each book
// that would change, for the screen's own review (before and after, and a
// Leave alone switch for each).
func (a *App) TidyReview() ([]TidyBook, error) {
	dir := media.ReportsDir(a.root)
	f, err := os.Open(filepath.Join(dir, "calibre_cleanup_preview.csv"))
	if err != nil {
		return []TidyBook{}, nil
	}
	defer f.Close()
	rows, err := csv.NewReader(f).ReadAll()
	if err != nil {
		return nil, err
	}
	byID := map[int]*TidyBook{}
	for i, r := range rows {
		if i == 0 || len(r) < 6 {
			continue
		}
		id, err := strconv.Atoi(r[0])
		if err != nil {
			continue
		}
		b := byID[id]
		if b == nil {
			b = &TidyBook{ID: id, Title: r[1]}
			byID[id] = b
		}
		b.Changes = append(b.Changes, TidyChange{Field: r[2], Old: r[3], New: r[4], Reason: r[5]})
	}
	newCovers, _ := filepath.Glob(filepath.Join(dir, "calibre_covers", "new", "*.jpg"))
	for _, p := range newCovers {
		id, err := strconv.Atoi(strings.SplitN(filepath.Base(p), " - ", 2)[0])
		if err != nil {
			continue
		}
		b := byID[id]
		if b == nil {
			title := strings.TrimSuffix(strings.SplitN(filepath.Base(p), " - ", 2)[len(strings.SplitN(filepath.Base(p), " - ", 2))-1], ".jpg")
			b = &TidyBook{ID: id, Title: title}
			byID[id] = b
		}
		b.Cover = true
	}
	held := map[int]bool{}
	if r, ok := media.LoadRecord(a.root).Last["books"]["review"]; ok {
		for _, v := range anySlice(r.Result["held"]) {
			if n, ok := v.(float64); ok {
				held[int(n)] = true
			}
		}
	}
	out := []TidyBook{}
	for _, b := range byID {
		b.Held = held[b.ID]
		out = append(out, *b)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Title) < strings.ToLower(out[j].Title) })
	return out, nil
}

func anySlice(v any) []any {
	s, _ := v.([]any)
	return s
}

// TidyCover is a book's cover from the review as a data: URL: which is
// "current" (as it is) or "new" (the one proposed); "" when there is none.
func (a *App) TidyCover(id int, which string) string {
	if !slices.Contains([]string{"current", "new"}, which) {
		return ""
	}
	hits, _ := filepath.Glob(filepath.Join(media.ReportsDir(a.root), "calibre_covers", which, strconv.Itoa(id)+" - *.jpg"))
	if len(hits) == 0 {
		return ""
	}
	data, err := os.ReadFile(hits[0])
	if err != nil || len(data) > 4<<20 {
		return ""
	}
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(data)
}

// interrupt asks a job to stop as Ctrl-C would, so the engine saves where
// it got to; Windows has no such signal for another process: it ends.
func interrupt(p *os.Process) error {
	if goruntime.GOOS == "windows" {
		return p.Kill()
	}
	return p.Signal(os.Interrupt)
}

// needsListed: the path is one Needs a look lists.
func needsListed(root, path string) bool {
	for _, n := range media.NeedsLook(root) {
		if filepath.Clean(n.Path) == filepath.Clean(path) {
			return true
		}
	}
	return false
}
