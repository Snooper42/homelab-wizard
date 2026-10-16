// Package selfupdate keeps the desktop app current: it compares the commit
// a build was made from with the rolling "nightly" pre-release the release
// workflow publishes from main, and on macOS replaces the app with that
// release's build and opens it again, without the browser or Terminal.
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
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Tag is the rolling pre-release each build of main replaces.
const Tag = "nightly"

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

// For is the newest build for an update channel: the newest v* release on
// "stable", the nightly build of main on anything else.
func For(ctx context.Context, repo, channel string) (Release, error) {
	if channel == "stable" {
		return LatestStable(ctx, repo)
	}
	return Latest(ctx, repo)
}

// LatestStable reads the newest published v* release of repo, with the
// commit its tag points at.
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
		if b.Draft || !strings.HasPrefix(b.TagName, "v") {
			continue
		}
		r = fromRelease(b)
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
		if a.Name == MacAsset {
			r.MacDMG = a.URL
			r.MacSHA256, _ = strings.CutPrefix(a.Digest, "sha256:")
		}
	}
	return r
}

// Latest reads the nightly release of repo ("owner/name").
func Latest(ctx context.Context, repo string) (Release, error) {
	var r Release
	if repo == "" {
		return r, errors.New("no repository to look for app builds in")
	}
	var body release
	if err := get(ctx, "/repos/"+repo+"/releases/tags/"+Tag, "", &body); err == errNotFound {
		return r, errors.New("no app build has been published yet")
	} else if err != nil {
		return r, err
	}
	r = fromRelease(body)
	r.Version = ""
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

// CanInstall reports whether this platform updates in place.
func CanInstall(r Release) bool { return runtime.GOOS == "darwin" && r.MacDMG != "" }

// Bundle is the .app this program runs from, "" when it is not in one.
func Bundle() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	exe, _ = filepath.EvalSymlinks(exe)
	i := strings.Index(exe, ".app/Contents/")
	if i < 0 {
		return ""
	}
	return exe[:i+len(".app")]
}

// InstallMac downloads r's macOS build and starts a helper that puts it in
// place of bundle once this process quits, then opens it. The caller quits
// next.
func InstallMac(ctx context.Context, r Release, bundle string) error {
	if bundle == "" {
		return errors.New("this app is not running from an .app, so it cannot replace itself")
	}
	staged, err := Stage(ctx, r, StageDir())
	if err != nil {
		return err
	}
	return Swap(bundle, staged, true)
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

// Stage downloads r's macOS build, checks it against GitHub's checksum,
// and copies its app into dir (emptied first), returning the app's path.
func Stage(ctx context.Context, r Release, dir string) (string, error) {
	if r.MacDMG == "" {
		return "", errors.New("the newest build has no macOS download")
	}
	if err := os.RemoveAll(dir); err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	dmg := filepath.Join(dir, MacAsset)
	defer os.Remove(dmg)
	if err := download(ctx, r.MacDMG, dmg); err != nil {
		return "", err
	}
	if err := verify(dmg, r.MacSHA256); err != nil {
		return "", err
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
	return staged, nil
}

// Swap starts a helper that waits for this process to quit, puts staged in
// place of bundle, and opens the new app when reopen is set; otherwise only
// the menu bar item comes back, if it was running.
func Swap(bundle, staged string, reopen bool) error {
	if bundle == "" {
		return errors.New("this app is not running from an .app, so it cannot replace itself")
	}
	again := "0"
	if reopen {
		again = "1"
	}
	return exec.Command("/bin/sh", "-c", swapScript, "sh", strconv.Itoa(os.Getpid()), bundle, staged, again).Start()
}

// swapScript waits for the app to quit, stops its menu bar helper, puts
// the new app in place (keeping the old one until that worked), and opens
// it or restarts the menu bar helper. $1 is the app's process, $2 the
// bundle, $3 the new one, $4 1 to open it.
const swapScript = `pid="$1"; app="$2"; new="$3"; reopen="$4"
i=0; while kill -0 "$pid" 2>/dev/null && [ $i -lt 300 ]; do sleep 0.2; i=$((i+1)); done
tray=0; pgrep -f "$app/Contents/Helpers/" >/dev/null 2>&1 && tray=1
pkill -f "$app/Contents/Helpers/" 2>/dev/null
rm -rf "$app.old"
if mv "$app" "$app.old"; then
  if mv "$new" "$app" 2>/dev/null || ditto "$new" "$app"; then rm -rf "$app.old" "$new"; else rm -rf "$app"; mv "$app.old" "$app"; fi
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

func download(ctx context.Context, url, path string) error {
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
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}

// verify checks path against want, GitHub's SHA-256 of the file; a
// release without one (older GitHub records) is let through.
func verify(path, want string) error {
	if want == "" {
		return nil
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
