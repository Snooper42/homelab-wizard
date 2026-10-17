// Package upgrade checks the homelab folder's git checkout against GitHub
// and brings it up to date, fast-forward only, so nothing local is ever
// merged or overwritten.
package upgrade

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/kit"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// Change is one commit waiting on GitHub.
type Change struct {
	Hash    string    `json:"hash"`
	Subject string    `json:"subject"`
	When    time.Time `json:"when"`
}

// Check is how the checkout compares with its upstream branch.
type Check struct {
	Branch          string   `json:"branch"`
	Upstream        string   `json:"upstream"`
	Behind          int      `json:"behind"`
	Ahead           int      `json:"ahead"`
	Changes         []Change `json:"changes"` // newest first, at most MaxChanges
	Dirty           []string `json:"dirty,omitempty"`
	AppChanged      bool     `json:"appChanged"`      // the desktop app or menu bar sources
	SettingsChanged bool     `json:"settingsChanged"` // .env.example: up adds the new keys
	Version         string   `json:"version"`         // VERSION here
	NewVersion      string   `json:"newVersion"`      // VERSION upstream
	FetchError      string   `json:"fetchError,omitempty"`
	// Notes are the CHANGELOG entries the update brings (first sentences).
	Notes []string `json:"notes,omitempty"`
	// Channel is UPDATE_CHANNEL: stable (the newest release tag on the
	// upstream branch) or testing (the upstream branch itself). Target is
	// what an upgrade moves to: the tag, or the upstream branch.
	Channel string    `json:"channel"`
	Target  string    `json:"target"`
	Web     string    `json:"web,omitempty"` // the repository's page, e.g. https://github.com/owner/repo
	Checked time.Time `json:"checked"`
	// Kit is a folder the desktop app made from the homelab files it
	// carries (no git): updates come with new app builds, from KitPath.
	Kit     bool   `json:"kit,omitempty"`
	KitPath string `json:"-"`
}

// MaxChanges is how many waiting commits a Check lists.
const MaxChanges = 15

// appPaths are the sources of the desktop app and its menu bar helper: the
// app module, its frontend, and what it shares with the CLI.
var appPaths = []string{"app", "web", "internal/core"}

// Inspect compares the checkout at root with its upstream. With fetch it
// first asks GitHub for the newest commits; a failed fetch is reported in
// FetchError and the comparison uses what was fetched before.
func Inspect(ctx context.Context, root string, fetch bool) (Check, error) {
	c := Check{Checked: time.Now()}
	if installed, ok := kit.Installed(root); ok {
		return inspectKit(c, root, installed, kit.Bundled())
	}
	if _, err := git(ctx, root, "rev-parse", "--git-dir"); err != nil {
		return c, errors.New("the homelab folder is not a git checkout; clone it as in docs/Getting Started.md")
	}
	branch, err := git(ctx, root, "symbolic-ref", "--short", "-q", "HEAD")
	if err != nil {
		return c, errors.New("the homelab folder is not on a branch: git checkout main")
	}
	c.Branch = branch
	up, err := git(ctx, root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
	if err != nil {
		return c, fmt.Errorf("the %s branch does not follow a branch on GitHub: git checkout main", branch)
	}
	c.Upstream = up
	if url, err := git(ctx, root, "remote", "get-url", strings.SplitN(up, "/", 2)[0]); err == nil {
		c.Web = WebURL(url)
	}
	if fetch {
		remote := strings.SplitN(up, "/", 2)[0]
		fctx, cancel := context.WithTimeout(ctx, 90*time.Second)
		_, err := git(fctx, root, "fetch", "--quiet", "--tags", remote)
		cancel()
		if err != nil {
			c.FetchError = err.Error()
		}
	}
	c.Channel, c.Target = Channel(root), "@{u}"
	counts, err := git(ctx, root, "rev-list", "--left-right", "--count", "HEAD...@{u}")
	if err != nil {
		return c, err
	}
	if f := strings.Fields(counts); len(f) == 2 {
		c.Ahead, _ = strconv.Atoi(f[0])
		c.Behind, _ = strconv.Atoi(f[1])
	}
	if c.Channel == Stable {
		// The newest release on the upstream branch; nothing before the first.
		c.Target, c.Behind = newestRelease(ctx, root), 0
		if c.Target != "" {
			n, _ := git(ctx, root, "rev-list", "--count", "HEAD.."+c.Target)
			c.Behind, _ = strconv.Atoi(n)
		}
	}
	target := c.Target
	if c.Behind > 0 {
		log, err := git(ctx, root, "log", "--format=%h%x09%ct%x09%s", "-n", strconv.Itoa(MaxChanges), "HEAD.."+target)
		if err != nil {
			return c, err
		}
		for _, line := range strings.Split(log, "\n") {
			f := strings.SplitN(line, "\t", 3)
			if len(f) != 3 {
				continue
			}
			sec, _ := strconv.ParseInt(f[1], 10, 64)
			c.Changes = append(c.Changes, Change{Hash: f[0], Subject: f[2], When: time.Unix(sec, 0)})
		}
		cur, _ := git(ctx, root, "show", "HEAD:CHANGELOG.md")
		next, _ := git(ctx, root, "show", target+":CHANGELOG.md")
		c.Notes = NewNotes(cur, next)
		changed, _ := git(ctx, root, append([]string{"diff", "--name-only", "HEAD..." + target, "--"}, append(appPaths, ".env.example")...)...)
		for _, f := range strings.Fields(changed) {
			if f == ".env.example" {
				c.SettingsChanged = true
			} else {
				c.AppChanged = true
			}
		}
	}
	c.Version, _ = git(ctx, root, "show", "HEAD:VERSION")
	if target != "" {
		c.NewVersion, _ = git(ctx, root, "show", target+":VERSION")
	}
	dirty, _ := git(ctx, root, "diff", "--name-only", "HEAD") // tracked files edited here
	c.Dirty = strings.Fields(dirty)
	return c, nil
}

// inspectKit compares a folder the app made with the kit it carries now.
func inspectKit(c Check, root string, installed kit.Manifest, bundled string) (Check, error) {
	c.Kit, c.Upstream, c.Version = true, "the homelab files in this app", installed.Version
	c.Dirty = kit.Edited(root, installed)
	if bundled == "" {
		return c, nil
	}
	next, err := kit.Info(bundled)
	if err != nil {
		c.FetchError = err.Error()
		return c, nil
	}
	c.NewVersion = next.Version
	if next.Commit == installed.Commit {
		return c, nil
	}
	c.Behind, c.KitPath = 1, bundled
	c.Changes = []Change{{Hash: next.Short(), Subject: "Homelab files from this build of the app (was " + installed.Short() + ")"}}
	c.SettingsChanged = next.Files[".env.example"] != installed.Files[".env.example"]
	if data, err := kit.ReadFile(bundled, "CHANGELOG.md"); err == nil {
		cur, _ := os.ReadFile(filepath.Join(root, "CHANGELOG.md"))
		c.Notes = NewNotes(string(cur), string(data))
	}
	return c, nil
}

// AppBehind counts the commits in the checkout since built (the commit a
// desktop app was built from) that changed the app's sources. ok is false
// when built is unknown here.
func AppBehind(ctx context.Context, root, built string) (n int, ok bool) {
	if built == "" {
		return 0, false
	}
	if _, err := git(ctx, root, "cat-file", "-e", built+"^{commit}"); err != nil {
		return 0, false
	}
	// Only a folder that grew from this build can be ahead of it: one on
	// another line of history (another repository's main, say) says nothing.
	if _, err := git(ctx, root, "merge-base", "--is-ancestor", built, "HEAD"); err != nil {
		return 0, false
	}
	out, err := git(ctx, root, append([]string{"rev-list", "--count", built + "..HEAD", "--"}, appPaths...)...)
	if err != nil {
		return 0, false
	}
	n, err = strconv.Atoi(out)
	return n, err == nil
}

// WebURL turns a GitHub remote (git@github.com:o/r.git, https://github.com/o/r)
// into the repository's web address; "" for anything else.
func WebURL(remote string) string {
	r := strings.TrimSuffix(strings.TrimSpace(remote), ".git")
	switch {
	case strings.HasPrefix(r, "git@github.com:"):
		return "https://github.com/" + strings.TrimPrefix(r, "git@github.com:")
	case strings.HasPrefix(r, "ssh://git@github.com/"):
		return "https://github.com/" + strings.TrimPrefix(r, "ssh://git@github.com/")
	case strings.HasPrefix(r, "https://github.com/"):
		return r
	}
	return ""
}

// Pull fast-forwards the checkout to its upstream. Git refuses, and Pull
// returns its reason, when local commits or edits would be overwritten.
func Pull(ctx context.Context, root string) (string, error) {
	return git(ctx, root, "pull", "--ff-only", "--quiet")
}

// PullTo fast-forwards the checkout to what the Check says: the upstream
// branch or, on the stable channel, its newest release tag.
func PullTo(ctx context.Context, root string, c Check) (string, error) {
	if c.Channel == Stable && c.Target != "" {
		return git(ctx, root, "merge", "--ff-only", "--quiet", c.Target)
	}
	return Pull(ctx, root)
}

// The channels: Stable follows release tags (v1.2.3), Testing the
// upstream branch (main), which is the default.
const (
	Stable  = "stable"
	Testing = "testing"
)

// ChannelKey is the .env setting that picks the channel.
const ChannelKey = "UPDATE_CHANNEL"

// Channel reads UPDATE_CHANNEL from the folder's .env.
func Channel(root string) string {
	if env, err := envfile.Load(filepath.Join(root, ".env")); err == nil {
		if v, _ := env.Get(ChannelKey); strings.EqualFold(strings.TrimSpace(v), Stable) {
			return Stable
		}
	}
	return Testing
}

// newestRelease is the newest v* tag the upstream branch contains, "" when
// there is none yet.
func newestRelease(ctx context.Context, root string) string {
	tags, err := git(ctx, root, "tag", "--list", "v*", "--merged", "@{u}", "--sort=-v:refname")
	if err != nil {
		return ""
	}
	if f := strings.Fields(tags); len(f) > 0 {
		return f[0]
	}
	return ""
}

// git runs one git command in root and returns its trimmed output. It
// never prompts: a missing credential is an error, not a hang.
func git(ctx context.Context, root string, args ...string) (string, error) {
	cmd := procattr.Hide(exec.CommandContext(ctx, "git", append([]string{"-C", root}, args...)...))
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "LC_ALL=C")
	if os.Getenv("GIT_SSH_COMMAND") == "" {
		cmd.Env = append(cmd.Env, "GIT_SSH_COMMAND=ssh -o BatchMode=yes")
	}
	var out, errb bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &errb
	if err := cmd.Run(); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return "", errors.New("git is not installed (on macOS: xcode-select --install)")
		}
		msg := strings.TrimSpace(errb.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("git %s: %s", args[0], firstLines(msg, 3))
	}
	return strings.TrimSpace(out.String()), nil
}

func firstLines(s string, n int) string {
	lines := strings.Split(s, "\n")
	if len(lines) > n {
		lines = lines[:n]
	}
	return strings.Join(lines, " ")
}
