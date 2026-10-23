// Package releases says what an app's update brings before it is applied:
// the GitHub releases of the project its image is built from that are
// newer than the version it runs, with the start of each one's notes.
package releases

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// API is GitHub's API (tests point it at a fake).
var API = "https://api.github.com"

// TTL is how long a project's releases are kept before GitHub is asked
// again; unsigned requests are limited to 60 an hour.
const TTL = 6 * time.Hour

// Release is one published release, newest first in a list.
type Release struct {
	Tag  string    `json:"tag"`
	Name string    `json:"name,omitempty"`
	When time.Time `json:"when"`
	URL  string    `json:"url"`
	// Notes are the start of its notes as plain text.
	Notes string `json:"notes,omitempty"`
}

// Preview is what updating one app brings.
type Preview struct {
	App  string `json:"app"`
	Repo string `json:"repo,omitempty"` // owner/name on GitHub; "" when not known
	// Running is the version it runs, when its image says.
	Running string `json:"running,omitempty"`
	// Placed says Running is among the releases, so Releases are exactly
	// the ones newer than it; otherwise Releases is only the newest.
	Placed   bool      `json:"placed"`
	Releases []Release `json:"releases"`
	Page     string    `json:"page,omitempty"` // the project's releases page
}

// Current says it runs the newest release.
func (p Preview) Current() bool { return p.Placed && len(p.Releases) == 0 }

// Summary is one line on what an update brings, for the CLI.
func (p Preview) Summary() string {
	switch {
	case p.Repo == "":
		return "no release notes known"
	case p.Current():
		return p.Running + " is the newest release"
	case len(p.Releases) == 0:
		return "no releases published"
	case !p.Placed && p.Running == "":
		return "newest release " + p.Releases[0].Tag + " (the version it runs is not labelled)"
	case !p.Placed:
		return "runs " + p.Running + "; newest release " + p.Releases[0].Tag
	case len(p.Releases) == 1:
		return p.Running + " → " + p.Releases[0].Tag
	}
	return fmt.Sprintf("%s → %s (%d releases)", p.Running, p.Releases[0].Tag, len(p.Releases))
}

var githubSource = regexp.MustCompile(`^(?:https?://|git@)?github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git)?(?:/.*)?$`)

// Repo is the GitHub project an app's releases are published in: named in
// its catalog entry (meta), else from its image's source label, else from
// a ghcr.io image's name; "" when none says.
func Repo(meta, ref string, labels map[string]string) string {
	if meta != "" {
		return meta
	}
	if m := githubSource.FindStringSubmatch(labels["org.opencontainers.image.source"]); m != nil {
		return m[1] + "/" + m[2]
	}
	if rest, ok := strings.CutPrefix(ref, "ghcr.io/"); ok {
		rest, _, _ = strings.Cut(rest, "@")
		parts := strings.Split(rest, "/")
		if len(parts) >= 2 {
			name, _, _ := strings.Cut(parts[1], ":")
			return parts[0] + "/" + name
		}
	}
	return ""
}

var versionLike = regexp.MustCompile(`^v?\d+\.\d+`)

// Version is the version an image is, from its version label or else a
// tag like 1.2 or v1.2.3; "" for moving tags (latest, stable, 2).
func Version(ref string, labels map[string]string) string {
	if v := strings.TrimSpace(labels["org.opencontainers.image.version"]); versionLike.MatchString(v) {
		return v
	}
	ref, _, _ = strings.Cut(ref, "@")
	if i := strings.LastIndex(ref, ":"); i > strings.LastIndex(ref, "/") {
		if tag := ref[i+1:]; versionLike.MatchString(tag) {
			return tag
		}
	}
	return ""
}

func same(tag, version string) bool {
	norm := func(s string) string { return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(s)), "v") }
	return norm(tag) == norm(version)
}

// Place makes the preview from a project's releases, newest first.
func Place(app, repo, running string, list []Release) Preview {
	p := Preview{App: app, Repo: repo, Running: running, Releases: []Release{}}
	if repo == "" {
		return p
	}
	p.Page = "https://github.com/" + repo + "/releases"
	if running != "" {
		for i, r := range list {
			if same(r.Tag, running) {
				p.Placed, p.Releases = true, list[:i]
				return p
			}
		}
	}
	if len(list) > 0 {
		p.Releases = list[:1]
	}
	return p
}

// cache is every project's releases read, in data/releases.json.
type cache map[string]struct {
	At       time.Time `json:"at"`
	Releases []Release `json:"releases"`
}

var mu sync.Mutex

// CachePath is the cache in the homelab folder.
func CachePath(root string) string { return filepath.Join(root, "data", "releases.json") }

// List is repo's published releases, newest first, from the cache at path
// while it is fresh. When GitHub cannot be asked, an older copy is used.
func List(ctx context.Context, path, repo string) ([]Release, error) {
	mu.Lock()
	c := cache{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &c)
	}
	mu.Unlock()
	kept, ok := c[repo]
	if ok && time.Since(kept.At) < TTL {
		return kept.Releases, nil
	}
	list, err := fetch(ctx, repo)
	if err != nil {
		if ok {
			return kept.Releases, nil
		}
		return nil, err
	}
	mu.Lock()
	defer mu.Unlock()
	c = cache{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &c)
	}
	kept.At, kept.Releases = time.Now(), list
	c[repo] = kept
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err == nil {
		data, _ := json.MarshalIndent(c, "", "  ")
		_ = os.WriteFile(path, append(data, '\n'), 0o644)
	}
	return list, nil
}

// For is the preview of updating app, which runs the image ref with
// labels; meta is its catalog entry's releases setting.
func For(ctx context.Context, path, app, meta, ref string, labels map[string]string) (Preview, error) {
	repo, running := Repo(meta, ref, labels), Version(ref, labels)
	if repo == "" {
		return Place(app, "", running, nil), nil
	}
	list, err := List(ctx, path, repo)
	if err != nil {
		return Place(app, repo, running, nil), err
	}
	return Place(app, repo, running, list), nil
}

var errNotFound = errors.New("GitHub has no such project")

func fetch(ctx context.Context, repo string) ([]Release, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, API+"/repos/"+repo+"/releases?per_page=30", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "homelab-wizard")
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusNotFound:
		return nil, fmt.Errorf("%s: %w", repo, errNotFound)
	case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusForbidden && resp.Header.Get("X-RateLimit-Remaining") == "0":
		return nil, errors.New("GitHub asks to wait before more questions (about an hour)")
	case resp.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("GitHub answered %s", resp.Status)
	}
	var raw []struct {
		TagName     string    `json:"tag_name"`
		Name        string    `json:"name"`
		Draft       bool      `json:"draft"`
		Prerelease  bool      `json:"prerelease"`
		HTMLURL     string    `json:"html_url"`
		PublishedAt time.Time `json:"published_at"`
		Body        string    `json:"body"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&raw); err != nil {
		return nil, err
	}
	list := []Release{}
	for _, r := range raw {
		if r.Draft || r.Prerelease {
			continue
		}
		name := strings.TrimSpace(r.Name)
		if same(name, r.TagName) {
			name = ""
		}
		list = append(list, Release{Tag: r.TagName, Name: name, When: r.PublishedAt, URL: r.HTMLURL, Notes: Brief(r.Body, 14)})
	}
	return list, nil
}

var (
	comment = regexp.MustCompile(`(?s)<!--.*?-->`)
	image   = regexp.MustCompile(`!\[[^\]]*\]\([^)]*\)`)
	link    = regexp.MustCompile(`\[([^\]]+)\]\([^)]*\)`)
	tag     = regexp.MustCompile(`</?[a-zA-Z][^>]*>`)
	emph    = regexp.MustCompile(`\*\*|__|` + "`")
	heading = regexp.MustCompile(`^#{1,6}\s*`)
	bullet  = regexp.MustCompile(`^[*+]\s+`)
)

// Brief is the start of release notes (markdown) as plain text: at most
// lines lines, each cut to a readable length, with … when there is more.
func Brief(body string, lines int) string {
	body = comment.ReplaceAllString(strings.ReplaceAll(body, "\r\n", "\n"), "")
	var out []string
	more := false
	for _, l := range strings.Split(body, "\n") {
		l = strings.TrimSpace(tag.ReplaceAllString(image.ReplaceAllString(l, ""), ""))
		l = emph.ReplaceAllString(link.ReplaceAllString(l, "$1"), "")
		l = bullet.ReplaceAllString(heading.ReplaceAllString(l, ""), "- ")
		if l == "" || l == "-" || strings.Trim(l, "-=*_ ") == "" {
			continue
		}
		if len(out) == lines {
			more = true
			break
		}
		if r := []rune(l); len(r) > 160 {
			l = string(r[:159]) + "…"
		}
		out = append(out, l)
	}
	if more {
		out = append(out, "…")
	}
	return strings.Join(out, "\n")
}
