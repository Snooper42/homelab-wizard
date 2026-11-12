package catalog

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// secretFlag is a command-line option named for a secret and given a
// variable's value: --server-password="$KOPIA_SERVER_PASSWORD".
var secretFlag = regexp.MustCompile(`--[A-Za-z0-9-]*(?i:password|passphrase|token|secret)[A-Za-z0-9-]*[= ]+["']?\$`)

// N48: no app is started with a secret on its command line. On Linux every
// account on the computer sees a container's command lines (ps), so a
// password there is everyone's: it goes in the environment, which only
// the container's own user and root can read.
func TestNoSecretOnACommandLine(t *testing.T) {
	var files []string
	for _, dir := range []string{"config", "compose", "stacks", "dockerfiles"} {
		_ = filepath.WalkDir(filepath.Join("..", "..", dir), func(p string, d os.DirEntry, err error) error {
			if err == nil && !d.IsDir() && (strings.HasSuffix(p, ".sh") || strings.HasSuffix(p, ".yaml") || strings.HasSuffix(p, ".yml")) {
				files = append(files, p)
			}
			return nil
		})
	}
	if len(files) < 20 {
		t.Fatalf("only %d files read: the test no longer finds the compose files and scripts", len(files))
	}
	for _, f := range files {
		raw, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for i, line := range strings.Split(string(raw), "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "#") {
				continue
			}
			if m := secretFlag.FindString(line); m != "" {
				t.Errorf("%s:%d passes a secret on a command line (%s…): read it from the environment instead", f, i+1, m)
			}
		}
	}
}
