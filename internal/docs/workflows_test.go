package docs

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Every action the workflows use is pinned to a commit (docs/Security.md,
// M1): a tag can be moved to other code, and the release workflow can
// write the builds that every copy's Update installs. Dependabot proposes
// new commits; a new step must arrive pinned too.
func TestWorkflowActionsArePinned(t *testing.T) {
	files, err := filepath.Glob(filepath.Join("..", "..", ".github", "workflows", "*.yml"))
	if err != nil || len(files) == 0 {
		t.Fatalf("no workflows found: %v", err)
	}
	uses := regexp.MustCompile(`^\s*(?:-\s*)?uses:\s*(\S+)`)
	pinned := regexp.MustCompile(`^[\w.-]+/[\w./-]+@[0-9a-f]{40}$`)
	n := 0
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for i, line := range strings.Split(string(data), "\n") {
			m := uses.FindStringSubmatch(line)
			if m == nil || strings.HasPrefix(m[1], "./") {
				continue // the repository's own actions come with its commit
			}
			n++
			if !pinned.MatchString(m[1]) {
				t.Errorf("%s:%d uses %s, not pinned to a commit", filepath.Base(f), i+1, m[1])
			}
		}
	}
	if n < 20 {
		t.Errorf("read only %d actions from the workflows", n)
	}
}
