// Package selfupdate keeps the desktop app current: it compares the commit
// a build was made from with the newest release (each change to main
// publishes one, v0.9.1, v0.9.2, …, as the repository's Latest), and replaces the app with that release's
// build for this system (install.go says which) and opens it again,
// without the browser or Terminal.
package selfupdate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/transfer"
)

// stableTag is a release the stable channel takes: a new minor or major
// version (v0.10.0, v1.0.0), not every build in between.
var stableTag = regexp.MustCompile(`^v\d+\.\d+\.0(-[0-9A-Za-z.]+)?$`)

// MacAsset is the macOS build in a release.
const MacAsset = "Homelab-Wizard-macOS.dmg"

// API is GitHub's API (tests point it at a fake).
var API = "https://api.github.com"

// Release is the newest build.
type Release struct {
	Commit string `json:"commit"` // what it was built from
	Page   string `json:"page"`   // the release's page, to download by hand
	MacDMG string `json:"-"`      // the macOS build's download address
	// MacSHA256 is GitHub's checksum of it, checked before it is opened.
	MacSHA256 string `json:"-"`
	When      string `json:"when,omitempty"`
	// Version is the release's tag on the stable channel ("" for nightly).
	Version string `json:"version,omitempty"`
	// Assets are every file of the release, for the other systems' builds.
	Assets []Asset `json:"-"`
	// Repo is the repository it came from, "owner/name": its builds are
	// checked against that repository's build provenance (N29).
	Repo string `json:"-"`
}

// Asset is one file of a release, with GitHub's SHA-256 of it.
type Asset struct {
	Name, URL, SHA256 string
}

// release is the part of GitHub's release JSON read here.
type release struct {
	TagName         string `json:"tag_name"`
	Draft           bool   `json:"draft"`
	TargetCommitish string `json:"target_commitish"`
	HTMLURL         string `json:"html_url"`
	PublishedAt     string `json:"published_at"`
	Body            string `json:"body"`
	Assets          []struct {
		Name   string `json:"name"`
		URL    string `json:"browser_download_url"`
		Digest string `json:"digest"` // "sha256:<hex>"
	} `json:"assets"`
}

// get reads one GitHub API address into v; accept "" is JSON.
func get(ctx context.Context, path, accept string, v any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, API+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", cmpOr(accept, "application/vnd.github+json"))
	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return errNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GitHub answered %s", resp.Status)
	}
	body := io.LimitReader(resp.Body, 4<<20)
	if s, ok := v.(*string); ok {
		b, err := io.ReadAll(body)
		*s = strings.TrimSpace(string(b))
		return err
	}
	return json.NewDecoder(body).Decode(v)
}

var errNotFound = errors.New("not found")

func cmpOr(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// For is the newest build for an update channel: the newest vX.Y.0 release
// on "stable", the newest build of main on anything else.
func For(ctx context.Context, repo, channel string) (Release, error) {
	if channel == "stable" {
		return LatestStable(ctx, repo)
	}
	return Latest(ctx, repo)
}

// LatestStable reads the newest published vX.Y.0 release of repo that has
// builds, with the commit its tag points at.
func LatestStable(ctx context.Context, repo string) (Release, error) {
	var r Release
	if repo == "" {
		return r, errors.New("no repository to look for app builds in")
	}
	var list []release
	if err := get(ctx, "/repos/"+repo+"/releases?per_page=20", "", &list); err != nil {
		return r, err
	}
	for _, b := range list {
		// A release without files is notes only (a version tagged after
		// the fact), nothing to update to.
		if b.Draft || !stableTag.MatchString(b.TagName) || len(b.Assets) == 0 {
			continue
		}
		r = fromRelease(b)
		r.Repo = repo
		r.Commit = ""
		if err := get(ctx, "/repos/"+repo+"/commits/"+b.TagName, "application/vnd.github.sha", &r.Commit); err != nil {
			return r, err
		}
		return r, nil
	}
	return r, errors.New("no release has been published yet")
}

func fromRelease(b release) Release {
	r := Release{Commit: b.TargetCommitish, Page: b.HTMLURL, When: b.PublishedAt, Version: b.TagName}
	for _, a := range b.Assets {
		sum, _ := strings.CutPrefix(a.Digest, "sha256:")
		r.Assets = append(r.Assets, Asset{Name: a.Name, URL: a.URL, SHA256: sum})
		if a.Name == MacAsset {
			r.MacDMG, r.MacSHA256 = a.URL, sum
		}
	}
	return r
}

// Latest reads the repository's Latest release: the newest build of main.
func Latest(ctx context.Context, repo string) (Release, error) {
	var r Release
	if repo == "" {
		return r, errors.New("no repository to look for app builds in")
	}
	var body release
	if err := get(ctx, "/repos/"+repo+"/releases/latest", "", &body); err == errNotFound {
		return r, errors.New("no app build has been published yet")
	} else if err != nil {
		return r, err
	}
	r = fromRelease(body)
	r.Repo = repo
	// The workflow writes "Built from <sha>." in the notes too, in case the
	// release points at a branch name.
	if f := strings.Fields(body.Body); len(r.Commit) != 40 {
		for i, w := range f {
			if w == "from" && i+1 < len(f) {
				r.Commit = strings.TrimRight(f[i+1], ".")
			}
		}
	}
	return r, nil
}

// Newer reports whether r is a different build from built (the commit
// this app was made from); a local build (no commit) is never offered one.
func (r Release) Newer(built string) bool {
	return built != "" && r.Commit != "" && !strings.HasPrefix(r.Commit, built) && !strings.HasPrefix(built, r.Commit)
}

// CanInstall reports whether this app can put r's build for its system in
// place of itself.
func CanInstall(r Release) bool {
	in := Current()
	if in.Kind == "" {
		return false
	}
	_, ok := in.asset(r)
	return ok
}

// Install downloads r's build for this system and starts a helper that
// puts it in place of this app once this process quits, then opens it.
// The caller quits next. on, when not nil, hears how far the download is
// (Stage).
func Install(ctx context.Context, r Release, on func(done, total int64)) error {
	staged, err := Stage(ctx, r, StageDir(), on)
	if err != nil {
		return err
	}
	return Swap(staged, true)
}

// StageDir is where a downloaded build waits to be put in place: the
// user's cache folder, so nothing extra shows in Applications.
func StageDir() string {
	dir, err := os.UserCacheDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "Homelab Wizard", "update")
}

// LogPath is where putting a build in place notes each step, beside the
// download's folder (which each download empties): the line that starts
// "ERROR:" says why a build did not go in place.
func LogPath() string { return filepath.Join(filepath.Dir(StageDir()), "update.log") }

// Failure is why the last attempt to put a build in place failed, from
// the log's ERROR line, or "" when the log has none.
func Failure() string {
	data, err := os.ReadFile(LogPath())
	if err != nil {
		return ""
	}
	why := ""
	for _, l := range strings.Split(string(data), "\n") {
		if _, after, ok := strings.Cut(l, "ERROR: "); ok {
			why = strings.TrimSpace(after)
		}
	}
	return why
}

// Stage downloads r's build for this system into dir (emptied first) and
// checks it against GitHub's checksum. A Mac build's app is copied out of
// its disk image, and that app's path returned; elsewhere it is the file
// downloaded. on, when not nil, is called as the download comes in, with
// the bytes in and the size (-1 when GitHub did not say).
func Stage(ctx context.Context, r Release, dir string, on func(done, total int64)) (string, error) {
	in := Current()
	if in.Kind == "" {
		return "", errors.New("this copy of the app cannot replace itself; download the newest build from the release page")
	}
	a, ok := in.asset(r)
	if !ok {
		return "", fmt.Errorf("the newest build has no download for this system (%s)", in.Kind)
	}
	if in.Kind == KindMac {
		// A disk image left open by an update that stopped part way (the
		// app quit, the Mac slept) would make emptying dir fail with
		// "resource busy" on every try.
		if _, err := os.Stat(filepath.Join(dir, "mnt")); err == nil {
			exec.Command("hdiutil", "detach", "-force", filepath.Join(dir, "mnt")).Run()
		}
	}
	if err := os.RemoveAll(dir); err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	if in.Kind != KindMac {
		file := filepath.Join(dir, a.Name)
		if err := download(ctx, a.URL, file, on); err != nil {
			return "", err
		}
		if err := verify(file, a.SHA256); err != nil {
			os.Remove(file)
			return "", err
		}
		// GitHub's checksum comes from the release itself; the build
		// provenance says this repository's own workflow made the file (N29).
		if !needsProvenance(r.When) {
			return file, nil
		}
		if err := Provenance(ctx, r.Repo, a.Name, a.SHA256); err != nil {
			os.Remove(file)
			return "", err
		}
		return file, nil
	}
	dmg := filepath.Join(dir, MacAsset)
	defer os.Remove(dmg)
	if err := download(ctx, a.URL, dmg, on); err != nil {
		return "", err
	}
	if err := verify(dmg, a.SHA256); err != nil {
		return "", err
	}
	// The build provenance, as off the Mac (N29): an ad-hoc app (no Team
	// ID, so keepsSigner has nothing to hold it to) would otherwise take any
	// disk image the release page lists (N51).
	if needsProvenance(r.When) {
		if err := Provenance(ctx, r.Repo, a.Name, a.SHA256); err != nil {
			return "", err
		}
	}
	mnt := filepath.Join(dir, "mnt")
	if out, err := exec.CommandContext(ctx, "hdiutil", "attach", "-nobrowse", "-readonly", "-mountpoint", mnt, dmg).CombinedOutput(); err != nil {
		return "", fmt.Errorf("opening the download: %v %s", err, strings.TrimSpace(string(out)))
	}
	defer exec.Command("hdiutil", "detach", "-force", mnt).Run()
	apps, _ := filepath.Glob(filepath.Join(mnt, "*.app"))
	if len(apps) == 0 {
		return "", errors.New("the download holds no app")
	}
	staged := filepath.Join(dir, filepath.Base(apps[0]))
	if out, err := exec.CommandContext(ctx, "ditto", apps[0], staged).CombinedOutput(); err != nil {
		return "", fmt.Errorf("unpacking the new app: %v %s", err, strings.TrimSpace(string(out)))
	}
	if err := keepsSigner(ctx, in.Path, staged); err != nil {
		os.RemoveAll(staged)
		return "", err
	}
	return staged, nil
}

// keepsSigner refuses a new Mac app not signed by the team that signed the
// one installed (N24). GitHub's checksum comes from the same release as the
// download, so it says the file arrived whole, not who made it: a release
// put up by someone who got at the repository would pass it, and the swap
// takes the quarantine off, so Gatekeeper would not ask either. An app
// with no Team ID (an ad-hoc build, made without the Developer ID secret)
// has no signer to keep, and takes the update as before.
func keepsSigner(ctx context.Context, installed, staged string) error {
	team := teamOf(ctx, installed)
	if team == "" {
		return nil
	}
	if out, err := exec.CommandContext(ctx, "codesign", "--verify", "--deep", "--strict", staged).CombinedOutput(); err != nil {
		return fmt.Errorf("the new build's signature does not hold (%s), so it was not installed; download the newest build from the release page instead", strings.TrimSpace(string(out)))
	}
	if got := teamOf(ctx, staged); got != team {
		return fmt.Errorf("the new build is signed by someone else (team %s, not %s), so it was not installed; download the newest build from the release page instead", cmpOr(got, "none"), team)
	}
	return nil
}

// teamOf is the Team ID app is signed with: "" for none (an ad-hoc
// signature, no signature, or no app there).
func teamOf(ctx context.Context, app string) string {
	out, _ := exec.CommandContext(ctx, "codesign", "-dv", "--verbose=2", app).CombinedOutput()
	for _, line := range strings.Split(string(out), "\n") {
		if v, ok := strings.CutPrefix(strings.TrimSpace(line), "TeamIdentifier="); ok && v != "not set" {
			return v
		}
	}
	return ""
}

// Swap starts a helper that waits for this process to quit, puts staged
// (from Stage) in place of this app, and opens the new app when reopen is
// set; otherwise only the menu bar or tray item comes back, if it was
// running.
func Swap(staged string, reopen bool) error {
	in := Current()
	again := "0"
	if reopen {
		again = "1"
	}
	pid := strconv.Itoa(os.Getpid())
	switch in.Kind {
	case KindMac:
		return StartHelper(exec.Command("/bin/sh", "-c", swapScript, "sh", pid, in.Path, staged, again, LogPath()))
	case KindAppImage, KindDeb, KindRPM, KindArch:
		return swapLinux(in, pid, staged, again)
	case KindWindows, KindWindowsPortable:
		return swapWindows(in, pid, staged, again)
	}
	return errors.New("this copy of the app cannot replace itself; download the newest build from the release page")
}

// StartHelper starts the helper that puts a build in place; tests catch it
// instead, the desktop app's too.
var StartHelper = (*exec.Cmd).Start

// swapScript waits for the app to quit (a minute, then it asks it to stop,
// as Windows' helper does; one still open is left alone, with an ERROR,
// rather than moved under the running app, whose open would only bring it
// forward), stops its menu bar helper, puts
// the new app in place (keeping the old one until that worked), and opens
// it or restarts the menu bar helper. $1 is the app's process, $2 the
// bundle, $3 the new one, $4 1 to open it, $5 the log (LogPath), whose
// ERROR line says why the new app did not go in place.
const swapScript = `pid="$1"; app="$2"; new="$3"; reopen="$4"; log="$5"
note() { [ -n "$log" ] && echo "$(date +%Y-%m-%dT%H:%M:%S) $*" >>"$log"; }
[ -n "$log" ] && mkdir -p "$(dirname "$log")" && echo "$(date +%Y-%m-%dT%H:%M:%S) update: $new into $app" >"$log"
i=0; while kill -0 "$pid" 2>/dev/null && [ $i -lt "${HW_SWAP_WAIT:-300}" ]; do sleep 0.2; i=$((i+1)); done
if kill -0 "$pid" 2>/dev/null; then kill "$pid" 2>/dev/null; i=0; while kill -0 "$pid" 2>/dev/null && [ $i -lt 25 ]; do sleep 0.2; i=$((i+1)); done; fi
if kill -0 "$pid" 2>/dev/null; then note "ERROR: the app was still open after it was asked to quit, so the new build was not put in place: quit it, then update again"; exit 0; fi
tray=0; pgrep -f "$app/Contents/Helpers/" >/dev/null 2>&1 && tray=1
pkill -f "$app/Contents/Helpers/" 2>/dev/null
rm -rf "$app.old"
if mv "$app" "$app.old"; then
  if mv "$new" "$app" 2>/dev/null || ditto "$new" "$app"; then rm -rf "$app.old" "$new"; note done; else rm -rf "$app"; mv "$app.old" "$app"; note "ERROR: the new app could not be copied into $app"; fi
else
  note "ERROR: $app could not be moved aside (is it in a folder this account cannot change?)"
fi
xattr -dr com.apple.quarantine "$app" 2>/dev/null
if [ "$reopen" = 1 ]; then open "$app"
elif [ "$tray" = 1 ]; then nohup "$app/Contents/Helpers/homelab-tray" >/dev/null 2>&1 &
fi`

// Notes are the changes between two builds, newest first: the first line
// of each commit on main, without merge commits or the "(#12)" of a pull
// request. Empty when GitHub cannot compare them.
func Notes(ctx context.Context, repo, from, to string) []string {
	if repo == "" || from == "" || to == "" {
		return nil
	}
	var cmp struct {
		Commits []struct {
			Commit struct {
				Message string `json:"message"`
			} `json:"commit"`
		} `json:"commits"`
	}
	if err := get(ctx, "/repos/"+repo+"/compare/"+from+"..."+to, "", &cmp); err != nil {
		return nil
	}
	var notes []string
	for i := len(cmp.Commits) - 1; i >= 0; i-- {
		line, _, _ := strings.Cut(cmp.Commits[i].Commit.Message, "\n")
		line = strings.TrimSpace(pullNumber.ReplaceAllString(line, ""))
		if line == "" || strings.HasPrefix(line, "Merge ") {
			continue
		}
		notes = append(notes, line)
	}
	return notes
}

var pullNumber = regexp.MustCompile(`\s*\(#\d+\)$`)

func download(ctx context.Context, url, path string, on func(done, total int64)) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := (&http.Client{Timeout: 10 * time.Minute}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("downloading the new app: %s", resp.Status)
	}
	f, err := create(path)
	if err != nil {
		return err
	}
	count := &transfer.Bytes{W: f, Total: resp.ContentLength, On: on}
	_, err = io.Copy(count, resp.Body)
	count.Close()
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		// Cut off, or the disk is full: nothing half-written is kept.
		os.Remove(path)
		return fmt.Errorf("downloading the new app: %w", err)
	}
	return nil
}

// create makes the download's file; tests make one on a full disk.
var create = func(path string) (io.WriteCloser, error) { return os.Create(path) }

// verify checks path against want, GitHub's SHA-256 of the file. A file
// without one is refused: GitHub gives one for every release file, so its
// absence means something is off.
func verify(path, want string) error {
	if want == "" {
		return errors.New("GitHub gave no checksum for the download, so it was not installed; download the newest build from the release page instead")
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	if got := hex.EncodeToString(h.Sum(nil)); !strings.EqualFold(got, want) {
		return fmt.Errorf("the download does not match GitHub's checksum (got %s, want %s), so it was not installed; try again", got[:12], want[:min(12, len(want))])
	}
	return nil
}

// Repo turns a repository's web address into "owner/name".
func Repo(web string) string {
	return strings.TrimPrefix(strings.TrimSuffix(web, "/"), "https://github.com/")
}
