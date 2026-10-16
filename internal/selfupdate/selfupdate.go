// Package selfupdate keeps the desktop app current: it compares the commit
// a build was made from with the rolling "nightly" pre-release the release
// workflow publishes from main, and on macOS replaces the app with that
// release's build and opens it again, without the browser or Terminal.
package selfupdate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
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
	When   string `json:"when,omitempty"`
}

// Latest reads the nightly release of repo ("owner/name").
func Latest(ctx context.Context, repo string) (Release, error) {
	var r Release
	if repo == "" {
		return r, errors.New("no repository to look for app builds in")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, API+"/repos/"+repo+"/releases/tags/"+Tag, nil)
	if err != nil {
		return r, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return r, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return r, errors.New("no app build has been published yet")
	}
	if resp.StatusCode != http.StatusOK {
		return r, fmt.Errorf("GitHub answered %s", resp.Status)
	}
	var body struct {
		TargetCommitish string `json:"target_commitish"`
		HTMLURL         string `json:"html_url"`
		PublishedAt     string `json:"published_at"`
		Body            string `json:"body"`
		Assets          []struct {
			Name string `json:"name"`
			URL  string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&body); err != nil {
		return r, err
	}
	r.Commit, r.Page, r.When = body.TargetCommitish, body.HTMLURL, body.PublishedAt
	// The workflow writes "Built from <sha>." in the notes too, in case the
	// release points at a branch name.
	if f := strings.Fields(body.Body); len(r.Commit) != 40 {
		for i, w := range f {
			if w == "from" && i+1 < len(f) {
				r.Commit = strings.TrimRight(f[i+1], ".")
			}
		}
	}
	for _, a := range body.Assets {
		if a.Name == MacAsset {
			r.MacDMG = a.URL
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

// InstallMac downloads r's macOS build, puts its app next to bundle as
// bundle.new, and starts a helper that waits for this process to quit,
// swaps the two, and opens the new one. The caller quits next.
func InstallMac(ctx context.Context, r Release, bundle string) error {
	if r.MacDMG == "" {
		return errors.New("the newest build has no macOS download")
	}
	if bundle == "" {
		return errors.New("this app is not running from an .app, so it cannot replace itself")
	}
	dir, err := os.MkdirTemp("", "homelab-update-")
	if err != nil {
		return err
	}
	dmg := filepath.Join(dir, MacAsset)
	if err := download(ctx, r.MacDMG, dmg); err != nil {
		return err
	}
	mnt := filepath.Join(dir, "mnt")
	if out, err := exec.CommandContext(ctx, "hdiutil", "attach", "-nobrowse", "-readonly", "-mountpoint", mnt, dmg).CombinedOutput(); err != nil {
		return fmt.Errorf("opening the download: %v %s", err, strings.TrimSpace(string(out)))
	}
	defer exec.Command("hdiutil", "detach", "-force", mnt).Run()
	apps, _ := filepath.Glob(filepath.Join(mnt, "*.app"))
	if len(apps) == 0 {
		return errors.New("the download holds no app")
	}
	staged := bundle + ".new"
	_ = os.RemoveAll(staged)
	if out, err := exec.CommandContext(ctx, "ditto", apps[0], staged).CombinedOutput(); err != nil {
		return fmt.Errorf("copying the new app next to this one: %v %s", err, strings.TrimSpace(string(out)))
	}
	return exec.Command("/bin/sh", "-c", swapScript, "sh", strconv.Itoa(os.Getpid()), bundle, staged).Start()
}

// swapScript waits for the app to quit, stops its menu bar helper, puts
// the new app in place (keeping the old one until that worked), and opens
// it. $1 is the app's process, $2 the bundle, $3 the new one.
const swapScript = `pid="$1"; app="$2"; new="$3"
i=0; while kill -0 "$pid" 2>/dev/null && [ $i -lt 300 ]; do sleep 0.2; i=$((i+1)); done
pkill -f "$app/Contents/Helpers/" 2>/dev/null
rm -rf "$app.old" && mv "$app" "$app.old" && mv "$new" "$app" && rm -rf "$app.old" || { [ -d "$app" ] || mv "$app.old" "$app"; }
xattr -dr com.apple.quarantine "$app" 2>/dev/null
open "$app"`

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

// Repo turns a repository's web address into "owner/name".
func Repo(web string) string {
	return strings.TrimPrefix(strings.TrimSuffix(web, "/"), "https://github.com/")
}
