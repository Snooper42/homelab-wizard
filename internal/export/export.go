// Package export writes the household's data in open formats into one
// folder, to keep or to take to another service: every database's tables
// as CSV, Paperless's own export (documents with their tags), Immich's
// albums as CSV beside the original photos, and the encrypted password
// vault exports. Nothing in it needs the homelab to read.
package export

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/pgexec"
)

// Execer runs a command in a running container, streaming stdout to w.
type Execer = pgexec.Execer

// Runner runs a throwaway container (docker run --rm …), streaming stdout.
type Runner interface {
	RunTo(ctx context.Context, w io.Writer, args ...string) error
}

var psql = pgexec.Query

var lines = pgexec.Lines

var unsafeName = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

// fileName makes a table or album name safe as a file name.
func fileName(s string) string {
	s = strings.Trim(unsafeName.ReplaceAllString(s, "-"), "-.")
	if s == "" {
		s = "unnamed"
	}
	return s
}

// PostgresTables writes every table of every database in container as
// <dir>/<database>/<table>.csv (with a header row), and returns how many.
func PostgresTables(ctx context.Context, ex Execer, container, dir string) (int, error) {
	var b bytes.Buffer
	if err := psql(ctx, ex, &b, container, "", "select datname from pg_database where not datistemplate and datname <> 'postgres' order by 1"); err != nil {
		return 0, fmt.Errorf("%s: listing the databases: %w", container, err)
	}
	n := 0
	for _, db := range lines(b.Bytes()) {
		var t bytes.Buffer
		q := "select schemaname, tablename, format('%I.%I', schemaname, tablename) from pg_tables where schemaname not in ('pg_catalog', 'information_schema') order by 1, 2"
		if err := psql(ctx, ex, &t, container, db, q); err != nil {
			return n, fmt.Errorf("%s: listing %s's tables: %w", container, db, err)
		}
		for _, row := range lines(t.Bytes()) {
			f := strings.SplitN(row, "|", 3)
			if len(f) != 3 {
				continue
			}
			name := f[1]
			if f[0] != "public" {
				name = f[0] + "." + f[1]
			}
			path := filepath.Join(dir, fileName(db), fileName(name)+".csv")
			if err := toFile(path, func(w io.Writer) error {
				return psql(ctx, ex, w, container, db, `\copy (select * from `+f[2]+`) to stdout with (format csv, header)`)
			}); err != nil {
				return n, fmt.Errorf("%s: %s.%s: %w", container, db, name, err)
			}
			n++
		}
	}
	return n, nil
}

// toFile writes a file through fill, leaving nothing behind on failure.
func toFile(path string, fill func(io.Writer) error) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	err = fill(f)
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(path)
	}
	return err
}

// sqliteScript snapshots the database in $1, writes each table as CSV,
// and sends them as a tar on stdout.
const sqliteScript = `set -e
db="$1"
[ -f "$db" ] || { echo "no database at $db" >&2; exit 3; }
su-exec "$(stat -c %u:%g "$db")" sqlite3 "$db" ".backup /tmp/copy.db"
mkdir -p /tmp/out
sqlite3 /tmp/copy.db "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'" | while IFS= read -r t; do
  q=$(printf '%s' "$t" | sed 's/"/""/g')
  f=$(printf '%s' "$t" | tr -c 'A-Za-z0-9._\n-' '-')
  sqlite3 -csv -header /tmp/copy.db "select * from \"$q\"" > "/tmp/out/$f.csv"
done
cd /tmp/out && tar -cf - .`

// ErrNoDatabase means the app has not made its database yet.
var ErrNoDatabase = errors.New("no database yet")

// SQLiteTables writes every table of the SQLite database at db (a path
// inside container) as <dir>/<table>.csv, and returns how many.
func SQLiteTables(ctx context.Context, r Runner, container, db, dir string) (int, error) {
	var b bytes.Buffer
	if err := r.RunTo(ctx, &b, "--volumes-from", container, backup.SQLiteImage, "sh", "-c", sqliteScript, "sh", db); err != nil {
		if strings.Contains(err.Error(), "no database at") {
			return 0, ErrNoDatabase
		}
		return 0, fmt.Errorf("%s: %w", container, err)
	}
	return untar(&b, dir, ".csv")
}

// untar writes the regular files in a tar with this suffix into dir.
func untar(r io.Reader, dir, suffix string) (int, error) {
	tr := tar.NewReader(r)
	n := 0
	for {
		h, err := tr.Next()
		if err == io.EOF {
			return n, nil
		}
		if err != nil {
			return n, err
		}
		name := filepath.Base(h.Name)
		if h.Typeflag != tar.TypeReg || !strings.HasSuffix(name, suffix) {
			continue
		}
		if err := toFile(filepath.Join(dir, fileName(strings.TrimSuffix(name, suffix))+suffix), func(w io.Writer) error {
			_, err := io.Copy(w, tr)
			return err
		}); err != nil {
			return n, err
		}
		n++
	}
}

// Album is one photo in one Immich album.
type Album struct {
	Album, Owner, File, Path string // Path: where the original is inside Immich
}

// albumQueries are Immich's schema since 1.137 (singular table names) and
// before it.
var albumQueries = []string{
	`select al."albumName", u.email, a."originalFileName", a."originalPath" from album al join album_asset aa on aa."albumId" = al.id join asset a on a.id = aa."assetId" join "user" u on u.id = al."ownerId" where al."deletedAt" is null order by 1, 3`,
	`select al."albumName", u.email, a."originalFileName", a."originalPath" from albums al join albums_assets_assets aa on aa."albumsId" = al.id join assets a on a.id = aa."assetsId" join users u on u.id = al."ownerId" where al."deletedAt" is null order by 1, 3`,
}

// ImmichAlbums reads every album and the photos in it from Immich's database.
func ImmichAlbums(ctx context.Context, ex Execer, container string) ([]Album, error) {
	var last error
	for _, q := range albumQueries {
		var b bytes.Buffer
		if err := psql(ctx, ex, &b, container, "", `\copy (`+q+`) to stdout with (format csv)`); err != nil {
			last = err
			continue
		}
		rows, err := csv.NewReader(&b).ReadAll()
		if err != nil {
			return nil, err
		}
		out := make([]Album, 0, len(rows))
		for _, r := range rows {
			if len(r) == 4 {
				out = append(out, Album{r[0], r[1], r[2], r[3]})
			}
		}
		return out, nil
	}
	return nil, fmt.Errorf("reading Immich's albums: %w", last)
}

// WriteAlbums writes albums.csv: album, owner, file name, and where the
// original is (relative to the export when it was copied, else on disk).
func WriteAlbums(path string, albums []Album, where func(inImmich string) string) error {
	return toFile(path, func(w io.Writer) error {
		c := csv.NewWriter(w)
		_ = c.Write([]string{"album", "owner", "file", "original"})
		for _, a := range albums {
			_ = c.Write([]string{a.Album, a.Owner, a.File, where(a.Path)})
		}
		c.Flush()
		return c.Error()
	})
}

// ImmichOriginals are the folders under Immich's upload location that hold
// the original photos and videos (the rest is thumbnails and transcodes it
// can make again).
var ImmichOriginals = []string{"library", "upload"}

// CopyTree copies the regular files under src to dst, keeping their
// layout and times, and returns how many and their size. Links are skipped.
func CopyTree(src, dst string) (files int, size int64, err error) {
	err = filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, p)
		if d.IsDir() || !d.Type().IsRegular() || strings.HasPrefix(d.Name(), ".") && rel != "." {
			if d.IsDir() && strings.HasPrefix(d.Name(), ".") && rel != "." {
				return filepath.SkipDir
			}
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if err := copyFile(p, filepath.Join(dst, rel), info); err != nil {
			return err
		}
		files++
		size += info.Size()
		return nil
	})
	return files, size, err
}

func copyFile(src, dst string, info fs.FileInfo) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	if err := toFile(dst, func(w io.Writer) error { _, err := io.Copy(w, in); return err }); err != nil {
		return err
	}
	return os.Chtimes(dst, info.ModTime(), info.ModTime())
}
