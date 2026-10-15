// Package backup produces the files Duplicati picks up from recovery-staging:
// consistent database dumps and a verified copy of .env. It also checks a
// restore test by hashing restored files against the originals.
//
// Every step checks its own result instead of trusting an exit code: a dump
// must end with Postgres's completion marker, a copy must hash identically.
package backup

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Execer runs a command inside a container, streaming stdout to w.
type Execer interface {
	ExecTo(ctx context.Context, w io.Writer, container string, args ...string) error
}

// dumpComplete ends every successful pg_dumpall.
const dumpComplete = "PostgreSQL database cluster dump complete"

// PostgresDump writes a gzipped pg_dumpall of container to dir as
// <name>-YYYYMMDD-HHMMSS.sql.gz and returns its path. The credentials come
// from the container's own POSTGRES_USER, so nothing secret leaves it.
func PostgresDump(ctx context.Context, ex Execer, container, dir, name string, now time.Time) (string, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	final := filepath.Join(dir, fmt.Sprintf("%s-%s.sql.gz", name, now.Format("20060102-150405")))
	tmp, err := os.CreateTemp(dir, "."+name+"-*.partial")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	gz := gzip.NewWriter(tmp)
	tail := &tailWriter{max: 256}
	err = ex.ExecTo(ctx, io.MultiWriter(gz, tail), container, "sh", "-c", `pg_dumpall --clean --if-exists -U "$POSTGRES_USER"`)
	if cerr := gz.Close(); err == nil {
		err = cerr
	}
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return "", fmt.Errorf("dumping %s: %w", container, err)
	}
	if !bytes.Contains(tail.buf, []byte(dumpComplete)) {
		return "", fmt.Errorf("dumping %s: the dump is incomplete (no %q at the end)", container, dumpComplete)
	}
	if err := os.Chmod(tmp.Name(), 0o600); err != nil {
		return "", err
	}
	return final, os.Rename(tmp.Name(), final)
}

// SQLiteImage has sqlite3 and su-exec; homelab backup builds it from
// dockerfiles/sqlite the first time it is needed.
const SQLiteImage = "homelab/sqlite:1"

// sqliteScript copies the live database in $1 with SQLite's online backup
// (a consistent snapshot while the app keeps writing), as the file's owner
// so no root-owned journal is left behind, checks the copy, and writes it
// to stdout.
const sqliteScript = `set -e
db="$1"
[ -f "$db" ] || { echo "no database at $db" >&2; exit 3; }
su-exec "$(stat -c %u:%g "$db")" sqlite3 "$db" ".backup /tmp/copy.db"
[ "$(sqlite3 /tmp/copy.db 'PRAGMA integrity_check')" = ok ] || { echo "the copy of $db failed its integrity check" >&2; exit 4; }
cat /tmp/copy.db`

// ErrNoDatabase is returned when the app has no database at the path (yet,
// or it uses another engine).
var ErrNoDatabase = errors.New("no database at that path")

// SQLiteDump writes a gzipped, checked copy of the SQLite database at db
// (a path inside container) to dir as <name>-YYYYMMDD-HHMMSS.sqlite.gz.
func SQLiteDump(ctx context.Context, r Runner, container, db, dir, name string, now time.Time) (string, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	final := filepath.Join(dir, fmt.Sprintf("%s-%s.sqlite.gz", name, now.Format("20060102-150405")))
	tmp, err := os.CreateTemp(dir, "."+name+"-*.partial")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	gz := gzip.NewWriter(tmp)
	head := &headWriter{max: 16}
	err = r.RunTo(ctx, io.MultiWriter(gz, head), "--volumes-from", container, SQLiteImage, "sh", "-c", sqliteScript, "sh", db)
	if cerr := gz.Close(); err == nil {
		err = cerr
	}
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		msg := err.Error()
		if i := strings.LastIndex(msg, ": "); i >= 0 {
			msg = msg[i+2:]
		}
		if strings.HasPrefix(msg, "no database at") {
			return "", fmt.Errorf("%s: %w (%s)", container, ErrNoDatabase, db)
		}
		return "", fmt.Errorf("copying %s's database: %s", container, msg)
	}
	if string(head.buf) != "SQLite format 3\x00" {
		return "", fmt.Errorf("copying %s's database: the copy is not a SQLite database", container)
	}
	if err := os.Chmod(tmp.Name(), 0o600); err != nil {
		return "", err
	}
	return final, os.Rename(tmp.Name(), final)
}

// headWriter keeps the first max bytes written.
type headWriter struct {
	buf []byte
	max int
}

func (h *headWriter) Write(p []byte) (int, error) {
	if n := h.max - len(h.buf); n > 0 {
		h.buf = append(h.buf, p[:min(n, len(p))]...)
	}
	return len(p), nil
}

// tailWriter keeps the last max bytes written.
type tailWriter struct {
	buf []byte
	max int
}

func (t *tailWriter) Write(p []byte) (int, error) {
	t.buf = append(t.buf, p...)
	if len(t.buf) > t.max {
		t.buf = t.buf[len(t.buf)-t.max:]
	}
	return len(p), nil
}

// Runner starts a throwaway container, streaming stdout to w.
type Runner interface {
	RunTo(ctx context.Context, w io.Writer, args ...string) error
}

// VolumeArchive writes a gzipped tar of a named Docker volume to dir as
// <name>-YYYYMMDD-HHMMSS.tar.gz, then reads it back to prove it is a
// complete archive. It returns the path and the number of entries.
func VolumeArchive(ctx context.Context, r Runner, volume, dir, name string, now time.Time) (string, int, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", 0, err
	}
	final := filepath.Join(dir, fmt.Sprintf("%s-%s.tar.gz", name, now.Format("20060102-150405")))
	tmp, err := os.CreateTemp(dir, "."+name+"-*.partial")
	if err != nil {
		return "", 0, err
	}
	defer os.Remove(tmp.Name())
	err = r.RunTo(ctx, tmp, "-v", volume+":/data:ro", "alpine:3", "tar", "czf", "-", "-C", "/data", ".")
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return "", 0, fmt.Errorf("archiving volume %s: %w", volume, err)
	}
	entries, err := countTar(tmp.Name())
	if err != nil {
		return "", 0, fmt.Errorf("archiving volume %s: the archive does not read back: %w", volume, err)
	}
	if err := os.Chmod(tmp.Name(), 0o600); err != nil {
		return "", 0, err
	}
	return final, entries, os.Rename(tmp.Name(), final)
}

func countTar(path string) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	zr, err := gzip.NewReader(f)
	if err != nil {
		return 0, err
	}
	tr := tar.NewReader(zr)
	n := 0
	for {
		if _, err := tr.Next(); err == io.EOF {
			return n, nil
		} else if err != nil {
			return n, err
		}
		n++
	}
}

// Rotate deletes all but the newest keep dumps or archives named
// <prefix>-<timestamp>.sql.gz / .tar.gz in dir.
func Rotate(dir, prefix string, keep int) ([]string, error) {
	sql, err := filepath.Glob(filepath.Join(dir, prefix+"-*.sql.gz"))
	if err != nil {
		return nil, err
	}
	tgz, err := filepath.Glob(filepath.Join(dir, prefix+"-*.tar.gz"))
	if err != nil {
		return nil, err
	}
	lite, err := filepath.Glob(filepath.Join(dir, prefix+"-*.sqlite.gz"))
	if err != nil {
		return nil, err
	}
	matches := append(append(sql, tgz...), lite...)
	if keep < 1 {
		keep = 1 // never the dump just made
	}
	sort.Strings(matches) // timestamps sort chronologically
	var removed []string
	for len(matches) > keep {
		if err := os.Remove(matches[0]); err != nil {
			return removed, err
		}
		removed = append(removed, matches[0])
		matches = matches[1:]
	}
	return removed, nil
}

// CopyVerified copies src to dst (mode 0600) and confirms the copy hashes
// the same as the source.
func CopyVerified(src, dst string) (string, error) {
	data, err := os.ReadFile(src)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return "", err
	}
	if err := os.WriteFile(dst, data, 0o600); err != nil {
		return "", err
	}
	if err := os.Chmod(dst, 0o600); err != nil {
		return "", err
	}
	want, err := HashFile(src)
	if err != nil {
		return "", err
	}
	got, err := HashFile(dst)
	if err != nil {
		return "", err
	}
	if got != want {
		return "", fmt.Errorf("copy of %s does not match the original", src)
	}
	return got, nil
}

// HashFile returns a file's sha256 in hex.
func HashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// RestoreReport is the result of VerifyRestore.
type RestoreReport struct {
	Restored  int // files found in the restore
	Checked   int
	Matched   int
	Different []string // restored but not identical to the original
	Changed   []string // different, but the original changed after the backup
	Missing   []string // restored but absent from the original location
	Prefix    string   // the folder under original the restore lines up with
}

// VerifyRestore hashes up to sample restored files (spread evenly across the
// restore) against the files at the same relative paths under original.
// Duplicati drops the folders a restored selection has in common, so the
// restore may line up with a folder inside original; that is found from the
// first file. Duplicati also restores modification times: an original
// changed after the backup (a live database) is reported as changed, not
// as a failure.
func VerifyRestore(restored, original string, sample int) (RestoreReport, error) {
	var r RestoreReport
	var files []string
	err := filepath.WalkDir(restored, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.Type().IsRegular() {
			rel, _ := filepath.Rel(restored, path)
			files = append(files, rel)
		}
		return nil
	})
	if err != nil {
		return r, err
	}
	sort.Strings(files)
	r.Restored = len(files)
	if len(files) == 0 {
		return r, fmt.Errorf("no files found under %s", restored)
	}
	picked := files
	if sample > 0 && len(files) > sample {
		picked = nil
		step := float64(len(files)) / float64(sample)
		for i := 0; i < sample; i++ {
			picked = append(picked, files[int(float64(i)*step)])
		}
	}
	r.Prefix = lineUp(original, picked)
	for _, rel := range picked {
		r.Checked++
		orig := filepath.Join(original, r.Prefix, rel)
		want, err := HashFile(orig)
		if err != nil {
			r.Missing = append(r.Missing, rel)
			continue
		}
		got, err := HashFile(filepath.Join(restored, rel))
		if err != nil {
			return r, err
		}
		switch {
		case got == want:
			r.Matched++
		case changedSince(orig, filepath.Join(restored, rel)):
			r.Changed = append(r.Changed, rel)
		default:
			r.Different = append(r.Different, rel)
		}
	}
	return r, nil
}

// lineUp finds the folder under original (none, or up to two levels down)
// where the first restored files exist.
func lineUp(original string, files []string) string {
	candidates := []string{""}
	if dirs, err := os.ReadDir(original); err == nil {
		for _, d := range dirs {
			if !d.IsDir() {
				continue
			}
			candidates = append(candidates, d.Name())
			if sub, err := os.ReadDir(filepath.Join(original, d.Name())); err == nil {
				for _, s := range sub {
					if s.IsDir() {
						candidates = append(candidates, filepath.Join(d.Name(), s.Name()))
					}
				}
			}
		}
	}
	for _, rel := range files[:min(3, len(files))] {
		for _, c := range candidates {
			if fi, err := os.Stat(filepath.Join(original, c, rel)); err == nil && fi.Mode().IsRegular() {
				return c
			}
		}
	}
	return ""
}

// changedSince reports whether the original was modified after the
// restored copy's time, which Duplicati sets to the time it was backed up.
func changedSince(original, restored string) bool {
	o, err := os.Stat(original)
	if err != nil {
		return false
	}
	r, err := os.Stat(restored)
	return err == nil && o.ModTime().After(r.ModTime().Add(2*time.Second))
}

// Summary is a one-line description of a report.
func (r RestoreReport) Summary() string {
	parts := []string{fmt.Sprintf("%d of %d sampled files identical", r.Matched, r.Checked)}
	if len(r.Different) > 0 {
		parts = append(parts, fmt.Sprintf("%d different", len(r.Different)))
	}
	if len(r.Changed) > 0 {
		parts = append(parts, fmt.Sprintf("%d changed since the backup", len(r.Changed)))
	}
	if len(r.Missing) > 0 {
		parts = append(parts, fmt.Sprintf("%d not at the original path", len(r.Missing)))
	}
	return strings.Join(parts, ", ")
}
