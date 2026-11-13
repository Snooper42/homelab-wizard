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

// secretArg is a secret variable's value handed to a program as an argument
// another way: as mosquitto_passwd -b's password, or inside a URL (a cron job
// that calls .../cron/$TOKEN runs wget with the token in its arguments).
var secretArg = []*regexp.Regexp{
	regexp.MustCompile(`mosquitto_passwd\s[^|]*-b\b`),
	regexp.MustCompile(`://[^\s"']*\$\$?\{?[A-Z0-9_]*(?:TOKEN|PASSWORD|SECRET|PASSPHRASE)`),
}

// envLine is a variable set in a service's environment: KEY: value.
var envLine = regexp.MustCompile(`^\s*[A-Z][A-Z0-9_]*:\s`)

// Item 113: Frigate's broker made its password file with mosquitto_passwd -b
// and the password as an argument, and Firefly III's cron called
// /api/v1/cron/<token> with wget; each was in every account's ps for a
// moment. Both go through a shell's own printf (no process of its own)
// into a pipe or a 0600 file now.
func TestNoSecretAsAnArgument(t *testing.T) {
	for _, dir := range []string{"compose", "stacks"} {
		_ = filepath.WalkDir(filepath.Join("..", "..", dir), func(p string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() || !(strings.HasSuffix(p, ".yaml") || strings.HasSuffix(p, ".yml")) {
				return nil
			}
			raw, rerr := os.ReadFile(p)
			if rerr != nil {
				t.Fatal(rerr)
			}
			for i, line := range strings.Split(string(raw), "\n") {
				// A variable in the environment (DATABASE_URL: postgres://…:${…}@…) is where a
				// secret belongs (N48): only command lines are read.
				if strings.HasPrefix(strings.TrimSpace(line), "#") || envLine.MatchString(line) {
					continue
				}
				for _, re := range secretArg {
					if m := re.FindString(line); m != "" {
						t.Errorf("%s:%d hands a secret to a program as an argument (%s): pipe it, or read it from a 0600 file", p, i+1, m)
					}
				}
			}
			return nil
		})
	}
}
