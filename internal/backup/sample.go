package backup

import (
	"io/fs"
	"math/rand"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// skipDirs are folders whose files change constantly or are rebuilt.
var skipDirs = map[string]bool{"cache": true, "caches": true, "log": true, "logs": true, "tmp": true, "temp": true, "transcodes": true, "thumbs": true}

// skipSuffixes are a live database's side files and other transient files.
var skipSuffixes = []string{"-wal", "-shm", "-journal", ".lock", ".pid", ".partial", ".sock", ".tmp"}

// SampleFiles picks up to n files under root for an automatic restore
// test: regular, non-empty files up to 20 MB, unchanged for over a day (so
// last night's backup holds them as they are), outside caches, logs, and
// live database side files, spread across as many top-level folders as
// possible. Top-level folders in skipTop are left out. Paths are relative
// to root, with forward slashes.
func SampleFiles(root string, n int, now time.Time, rnd *rand.Rand, skipTop ...string) ([]string, error) {
	skip := map[string]bool{}
	for _, s := range skipTop {
		skip[s] = true
	}
	groups := map[string][]string{}
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // unreadable folders are skipped, not fatal
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)
		top := strings.SplitN(rel, "/", 2)[0]
		if d.IsDir() {
			if rel != "." && (skip[top] || skipDirs[strings.ToLower(d.Name())] || strings.HasPrefix(d.Name(), ".")) {
				return filepath.SkipDir
			}
			return nil
		}
		if !d.Type().IsRegular() || top == rel || strings.HasPrefix(d.Name(), ".") {
			return nil
		}
		for _, s := range skipSuffixes {
			if strings.HasSuffix(strings.ToLower(d.Name()), s) {
				return nil
			}
		}
		fi, err := d.Info()
		if err != nil || fi.Size() == 0 || fi.Size() > 20<<20 || now.Sub(fi.ModTime()) < 24*time.Hour {
			return nil
		}
		groups[top] = append(groups[top], rel)
		return nil
	})
	if err != nil {
		return nil, err
	}
	tops := make([]string, 0, len(groups))
	for t := range groups {
		tops = append(tops, t)
		sort.Strings(groups[t])
		rnd.Shuffle(len(groups[t]), func(i, j int) { groups[t][i], groups[t][j] = groups[t][j], groups[t][i] })
	}
	sort.Strings(tops)
	rnd.Shuffle(len(tops), func(i, j int) { tops[i], tops[j] = tops[j], tops[i] })
	var out []string
	for round := 0; len(out) < n; round++ {
		added := false
		for _, t := range tops {
			if round < len(groups[t]) && len(out) < n {
				out = append(out, groups[t][round])
				added = true
			}
		}
		if !added {
			break
		}
	}
	sort.Strings(out)
	return out, nil
}
