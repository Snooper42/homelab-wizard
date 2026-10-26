package pgexec

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
)

// container runs the command as docker exec would, in a shell on this
// machine with a psql that prints what it was given, and the container's
// environment.
type container struct {
	t    *testing.T
	env  []string
	args []string
}

func (c *container) ExecTo(ctx context.Context, w io.Writer, name string, args ...string) error {
	c.args = args
	failed := errors.New("docker exec " + name + " " + strings.Join(args, " ") + `: ERROR:  relation "x" does not exist`)
	if runtime.GOOS == "windows" {
		// No shell to run it in; Linux and macOS run it.
		if slices.Contains(c.env, "PSQL_FAILS=1") {
			return failed
		}
		return nil
	}
	bin := c.t.TempDir()
	psql := "#!/bin/sh\nfor a in \"$@\"; do printf '%s\\n' \"$a\"; done\n[ \"$PSQL_FAILS\" = 1 ] && exit 3\nexit 0\n"
	os.WriteFile(filepath.Join(bin, "psql"), []byte(psql), 0o755)
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Env = append([]string{"PATH=" + bin + ":/usr/bin:/bin"}, c.env...)
	var stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = w, &stderr
	if err := cmd.Run(); err != nil {
		// docker exec's error names the whole command line, then psql's words.
		return failed
	}
	return nil
}

func TestQuery(t *testing.T) {
	ctx := context.Background()
	sql := `SELECT count(*) FROM "user" WHERE name = 'it''s $HOME'`
	for _, c := range []struct {
		name, db string
		env      []string
		want     string
	}{
		{"the named database", "immich", []string{"POSTGRES_USER=postgres", "POSTGRES_DB=other"}, "immich"},
		{"the container's POSTGRES_DB", "", []string{"POSTGRES_USER=postgres", "POSTGRES_DB=paperless"}, "paperless"},
		{"the user's own database", "", []string{"POSTGRES_USER=vikunja"}, "vikunja"},
	} {
		t.Run(c.name, func(t *testing.T) {
			ex := &container{t: t, env: c.env}
			var out bytes.Buffer
			if err := Query(ctx, ex, &out, "db", c.db, sql); err != nil {
				t.Fatal(err)
			}
			if ex.args[0] != "sh" || ex.args[len(ex.args)-1] != sql || ex.args[len(ex.args)-2] != c.db {
				t.Fatalf("the statement is not passed as its own argument: %q", ex.args)
			}
			if runtime.GOOS == "windows" {
				return
			}
			got := Lines(out.Bytes())
			for _, want := range []string{"-X", "ON_ERROR_STOP=1", "-At", sql} {
				if !slices.Contains(got, want) {
					t.Errorf("psql was not given %q: %q", want, got)
				}
			}
			if i := slices.Index(got, "-d"); i < 0 || got[i+1] != c.want {
				t.Errorf("database %q, want %q", got, c.want)
			}
		})
	}
}

func TestQueryError(t *testing.T) {
	ex := &container{t: t, env: []string{"POSTGRES_USER=postgres", "PSQL_FAILS=1"}}
	err := Query(context.Background(), ex, io.Discard, "db", "", "SELECT * FROM x")
	if err == nil || err.Error() != `ERROR:  relation "x" does not exist` {
		t.Fatalf("psql's own words, without the command line: %v", err)
	}
}

func TestLines(t *testing.T) {
	if got := Lines([]byte("\n a \n\nb\r\n  \n")); !slices.Equal(got, []string{"a", "b"}) {
		t.Fatalf("%q", got)
	}
	if Lines(nil) != nil {
		t.Fatal("no output, no lines")
	}
}
