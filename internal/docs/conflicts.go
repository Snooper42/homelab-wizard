package docs

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// conflictKinds are the files a merge can leave markers in that no
// compiler reads: the docs, the compose files, the settings template.
var conflictKinds = map[string]bool{".md": true, ".yaml": true, ".yml": true, ".example": true}

// CheckConflicts reports lines a merge left behind (<<<<<<< and >>>>>>>
// at a line's start) in the Markdown, YAML, and .env.example files under
// paths, files or folders. Go files are left to the compiler.
func CheckConflicts(root string, paths ...string) []Issue {
	var issues []Issue
	check := func(path string) {
		data, err := os.ReadFile(path)
		if err != nil || !bytes.Contains(data, []byte("<<<<<<< ")) && !bytes.Contains(data, []byte(">>>>>>> ")) {
			return
		}
		rel, _ := filepath.Rel(root, path)
		s := bufio.NewScanner(bytes.NewReader(data))
		s.Buffer(make([]byte, 0, 64*1024), len(data)+1)
		for n := 1; s.Scan(); n++ {
			if line := s.Text(); strings.HasPrefix(line, "<<<<<<< ") || strings.HasPrefix(line, ">>>>>>> ") {
				issues = append(issues, Issue{filepath.ToSlash(rel), fmt.Sprintf("line %d is left from a merge conflict: %s", n, line)})
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
			if err == nil && !e.IsDir() && conflictKinds[filepath.Ext(path)] {
				check(path)
			}
			return nil
		})
	}
	return issues
}
