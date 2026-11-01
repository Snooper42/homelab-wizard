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

// A pull request can come from anyone's fork: no workflow may run its code
// with write access or secrets (pull_request_target, workflow_run), each
// starts from read-only access, and no step puts text the pull request's
// author wrote (its title, branch, body, a comment) into a script.
func TestWorkflowsGiveAPullRequestNothing(t *testing.T) {
	files, _ := filepath.Glob(filepath.Join("..", "..", ".github", "workflows", "*.yml"))
	injected := regexp.MustCompile(`\$\{\{\s*github\.(event\.(pull_request|issue|comment|review|head_commit)|head_ref)`)
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		text, name := string(data), filepath.Base(f)
		for _, trigger := range []string{"pull_request_target", "workflow_run"} {
			if regexp.MustCompile(`(?m)^\s+` + trigger + `:`).MatchString(text) {
				t.Errorf("%s runs on %s, which gives a fork's code write access and secrets", name, trigger)
			}
		}
		if !regexp.MustCompile(`(?m)^permissions:`).MatchString(text) {
			t.Errorf("%s does not set its permissions at the top", name)
		}
		if m := injected.FindString(text); m != "" {
			t.Errorf("%s puts %s… into a step: text a pull request's author wrote", name, m)
		}
	}
}
