// Package pgexec runs psql inside a PostgreSQL container as the
// container's own user, so no password leaves it.
package pgexec

import (
	"context"
	"errors"
	"io"
	"strings"
)

// Execer runs a command in a running container, streaming stdout to w.
type Execer interface {
	ExecTo(ctx context.Context, w io.Writer, container string, args ...string) error
}

// Query runs one statement (or a \copy) in database db, "" for the
// container's POSTGRES_DB, writing psql's unaligned output to w.
func Query(ctx context.Context, ex Execer, w io.Writer, container, db, sql string) error {
	script := `psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "${1:-${POSTGRES_DB:-$POSTGRES_USER}}" -At -c "$2"`
	err := ex.ExecTo(ctx, w, container, "sh", "-c", script, "sh", db, sql)
	if err != nil {
		// The command line is long; psql's own message follows it.
		msg := err.Error()
		if i := strings.LastIndex(msg, sql+": "); i >= 0 {
			msg = msg[i+len(sql)+2:]
		}
		return errors.New(strings.TrimSpace(msg))
	}
	return nil
}

// Lines are the non-empty lines of psql's output.
func Lines(b []byte) []string {
	var out []string
	for _, l := range strings.Split(string(b), "\n") {
		if l = strings.TrimSpace(l); l != "" {
			out = append(out, l)
		}
	}
	return out
}
