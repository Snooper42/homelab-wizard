package docs

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	mdLinkAngle = regexp.MustCompile(`\]\(<([^>]+)>\)`)
	mdLink      = regexp.MustCompile(`\]\(([^)<\s]+)(?:\s+"[^"]*")?\)`)
	htmlLink    = regexp.MustCompile(`(?:src|href|srcset)="([^"]+)"`)
	inlineCode  = regexp.MustCompile("`[^`]*`")
	descriptor  = regexp.MustCompile(`^\d+(\.\d+)?[wx]$`) // a srcset size, such as 2x
)

// CheckLinks reports relative links in Markdown files (paths may be files or
// folders) that point at files that do not exist. Web links, anchors within
// a page, and anything inside code are skipped.
func CheckLinks(root string, paths ...string) []Issue {
	var issues []Issue
	check := func(path string) {
		data, err := os.ReadFile(path)
		if err != nil {
			return
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)
		for _, target := range relativeLinks(string(data)) {
			p := target
			if i := strings.IndexAny(p, "#?"); i >= 0 {
				p = p[:i]
			}
			if p == "" {
				continue
			}
			if dec, err := url.PathUnescape(p); err == nil {
				p = dec
			}
			if _, err := os.Stat(filepath.Join(filepath.Dir(path), filepath.FromSlash(p))); err != nil {
				issues = append(issues, Issue{rel, fmt.Sprintf("broken link to %s", target)})
			}
		}
	}
	for _, p := range paths {
		full := filepath.Join(root, p)
		fi, err := os.Stat(full)
		if err != nil {
			continue
		}
		if !fi.IsDir() {
			check(full)
			continue
		}
		_ = filepath.WalkDir(full, func(path string, e os.DirEntry, err error) error {
			if err == nil && !e.IsDir() && filepath.Ext(path) == ".md" {
				check(path)
			}
			return nil
		})
	}
	return issues
}

// relativeLinks lists the link targets in Markdown text that are files in
// the repository, outside fenced and inline code.
func relativeLinks(text string) []string {
	var out []string
	fenced := false
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			fenced = !fenced
			continue
		}
		if fenced {
			continue
		}
		line = inlineCode.ReplaceAllString(line, "")
		var found []string
		for _, m := range mdLinkAngle.FindAllStringSubmatch(line, -1) {
			found = append(found, m[1])
		}
		for _, m := range mdLink.FindAllStringSubmatch(line, -1) {
			found = append(found, m[1])
		}
		for _, m := range htmlLink.FindAllStringSubmatch(line, -1) {
			found = append(found, strings.Fields(m[1])...) // srcset may list sizes
		}
		for _, t := range found {
			if t == "" || strings.HasPrefix(t, "#") || strings.Contains(t, "://") || strings.HasPrefix(t, "mailto:") || descriptor.MatchString(t) {
				continue
			}
			out = append(out, t)
		}
	}
	return out
}
