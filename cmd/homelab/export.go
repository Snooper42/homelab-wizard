package main

import (
	"bytes"
	"cmp"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/export"
)

// immichPaths are where Immich's upload location sits inside its
// container: /data since 1.133, /usr/src/app/upload before.
var immichPaths = []string{"/data/", "/usr/src/app/upload/"}

// exportCmd writes every app's data in open formats into one folder:
// database tables as CSV, Paperless's documents with their tags, Immich's
// albums (and with --photos the originals), and encrypted vault exports.
func (h *homelab) exportCmd(ctx context.Context, args []string) error {
	fs := newFlags("export")
	apply := applyFlag(fs)
	to := fs.String("to", "", "")
	photos := fs.Bool("photos", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	env := h.envMap()
	out := *to
	if out == "" {
		out = filepath.Join(h.root, "export-"+time.Now().Format("2006-01-02"))
	}
	out, _ = filepath.Abs(out)
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	report := detect.Analyze(h.catalog, containers)
	type db struct {
		app       *catalog.App
		container string
	}
	var dbs []db
	for _, a := range h.catalog.Apps {
		if a.Meta.Dump == "" {
			continue
		}
		if ctr, ok := runningContainer(report, a.ID); ok {
			dbs = append(dbs, db{a, ctr.Name})
		}
	}
	paperless, hasPaperless := runningContainer(report, "paperless")
	immichDB, hasImmich := runningContainer(report, "immich-database")
	upload := cmp.Or(env["IMMICH_UPLOAD_LOCATION"], "/Volumes/Media/photos")
	vaults := encryptedVaultExports(h.stagingDir("secrets"))

	u.Title("Export")
	u.Info("into %s", out)
	for _, d := range dbs {
		u.Info("%s: every table as CSV", owner(h.catalog, d.app).Name())
	}
	if hasPaperless {
		u.Info("Paperless-ngx: every document with its tags (its own exporter)")
	}
	if hasImmich {
		u.Info("Immich: the albums as CSV")
		if *photos {
			u.Info("Immich: copy the original photos and videos from %s (as large as the library)", upload)
		} else {
			u.Info("%s", u.Dim("the original photos stay in "+upload+" (--photos copies them too)"))
		}
	}
	if len(vaults) > 0 {
		u.Info("the encrypted password vault exports (%d)", len(vaults))
	} else {
		u.Info("%s", u.Dim("no encrypted vault export yet: the README says how to make one"))
	}
	if err := h.goAhead(*apply, "\nExport?"); err != nil {
		return err
	}

	sum := export.Summary{Made: time.Now(), Machine: h.host.Name}
	fail := func(format string, a ...any) {
		msg := fmt.Sprintf(format, a...)
		sum.Failed = append(sum.Failed, msg)
		u.Fail("%s", msg)
	}
	tables, sqliteReady := 0, false
	for _, d := range dbs {
		dir := filepath.Join(out, "tables", d.app.ID)
		var n int
		var err error
		if path, ok := strings.CutPrefix(d.app.Meta.Dump, "sqlite:"); ok {
			if !sqliteReady {
				if err := h.ensureSQLiteImage(ctx, client); err != nil {
					fail("%v", err)
					continue
				}
				sqliteReady = true
			}
			n, err = export.SQLiteTables(ctx, client, d.container, path, dir)
		} else {
			n, err = export.PostgresTables(ctx, client, d.container, dir)
		}
		switch {
		case errors.Is(err, export.ErrNoDatabase):
			continue
		case err != nil:
			fail("%s: %v", d.app.ID, err)
		default:
			tables += n
			u.OK("%s: %d tables", owner(h.catalog, d.app).Name(), n)
		}
	}
	if tables > 0 {
		sum.Parts = append(sum.Parts, export.Part{Folder: "tables/", Title: "Every app's data as tables",
			What:      fmt.Sprintf("%d CSV files, one per table, in a folder per app and database: budgets and transactions, holdings, recipes, bookmarks, tasks, and the rest.", tables),
			Elsewhere: "Each opens in Numbers, Excel, or Google Sheets. Most services import CSV with a column mapping."})
	}

	if hasPaperless {
		var b bytes.Buffer
		err := client.ExecTo(ctx, &b, paperless.Name, "document_exporter", "/usr/src/paperless/export", "--delete", "--no-progress-bar")
		if err != nil {
			fail("Paperless-ngx: %v", err)
		} else if n, sz, err := export.CopyTree(filepath.Join(h.root, "appdata", "paperless", "export"), filepath.Join(out, "documents")); err != nil {
			fail("Paperless-ngx: copying its export: %v", err)
		} else {
			u.OK("Paperless-ngx: %d files (%s)", n, size(sz))
			sum.Parts = append(sum.Parts, export.Part{Folder: "documents/", Title: "Documents (Paperless-ngx)",
				What:      "Every original document, its archived PDF with the recognised text, and manifest.json with each one's title, date, tags, correspondent, and type.",
				Elsewhere: "Another Paperless-ngx takes the folder as it is (document_importer). Anything else takes the PDFs; manifest.json says which tags each had."})
		}
	}

	if hasImmich {
		where := func(p string) string {
			for _, prefix := range immichPaths {
				if rel, ok := strings.CutPrefix(p, prefix); ok {
					if *photos {
						return filepath.ToSlash(filepath.Join("photos", rel))
					}
					return filepath.Join(upload, rel)
				}
			}
			return p
		}
		if albums, err := export.ImmichAlbums(ctx, client, immichDB.Name); err != nil {
			fail("Immich: %v", err)
		} else if err := export.WriteAlbums(filepath.Join(out, "photos", "albums.csv"), albums, where); err != nil {
			fail("Immich: %v", err)
		} else {
			u.OK("Immich: %d photos in albums", len(albums))
		}
		what := "albums.csv: each album, its owner, and the photos in it, with where each original is."
		if *photos {
			copied, total := 0, int64(0)
			for _, sub := range export.ImmichOriginals {
				src := filepath.Join(upload, sub)
				if _, err := os.Stat(src); err != nil {
					continue
				}
				n, got, err := export.CopyTree(src, filepath.Join(out, "photos", sub))
				copied, total = copied+n, total+got
				if err != nil {
					fail("Immich: copying the originals: %v", err)
					break
				}
			}
			u.OK("Immich: %d originals copied (%s)", copied, size(total))
			what = fmt.Sprintf("The %d original photos and videos as they were taken, in a folder per person, and ", copied) + what
		}
		sum.Parts = append(sum.Parts, export.Part{Folder: "photos/", Title: "Photos (Immich)", What: what,
			Elsewhere: "Upload the originals to iCloud Photos, Google Photos, or another Immich; their dates and places are in the files themselves. albums.csv says which go together."})
	}

	if len(vaults) > 0 {
		for _, v := range vaults {
			if _, err := backup.CopyVerified(v, filepath.Join(out, "passwords", filepath.Base(v))); err != nil {
				fail("the vault export %s: %v", filepath.Base(v), err)
			}
		}
		u.OK("%d encrypted vault exports", len(vaults))
	}
	sum.Parts = append(sum.Parts, export.Part{Folder: "passwords/", Title: "Passwords (Vaultwarden)",
		What:      fmt.Sprintf("%d encrypted vault exports from recovery-staging/secrets. Each opens with the password chosen when it was made. Each person exports their own vault: Bitwarden web vault › Tools › Export vault › .json (Encrypted) › Password protected.", len(vaults)),
		Elsewhere: "Bitwarden, 1Password, and Proton Pass import Bitwarden's encrypted .json."})

	for _, l := range []struct{ key, title, what string }{
		{"MEDIA_ROOT", "Films, series, music, and books", "The media drive: plain video, audio, and book files in folders by kind."},
		{"SYNC_ROOT", "Synced folders (Syncthing)", "The folders Syncthing keeps in step, as plain files."},
	} {
		if v := env[l.key]; v != "" {
			sum.Left = append(sum.Left, export.Part{Folder: v, Title: l.title, What: l.what})
		}
	}

	var b bytes.Buffer
	if err := export.Readme(&b, sum); err != nil {
		return err
	}
	if err := os.MkdirAll(out, 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(out, "README.html"), b.Bytes(), 0o600); err != nil {
		return err
	}
	u.OK("the export: %s (README.html says what is in it)", out)
	if len(sum.Failed) > 0 {
		return fmt.Errorf("%d part(s) were not exported", len(sum.Failed))
	}
	return nil
}

// owner is the app a database belongs to (its compose service's main app).
func owner(c *catalog.Catalog, a *catalog.App) *catalog.App {
	if p, ok := c.Get(strings.TrimSuffix(strings.TrimSuffix(a.ID, "-db"), "-database")); ok {
		return p
	}
	return a
}

// encryptedVaultExports are the encrypted Bitwarden exports kept in dir.
func encryptedVaultExports(dir string) []string {
	var out []string
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		name := strings.ToLower(e.Name())
		if !e.IsDir() && strings.HasPrefix(name, "bitwarden_") && strings.Contains(name, "encrypted") && strings.HasSuffix(name, ".json") {
			out = append(out, filepath.Join(dir, e.Name()))
		}
	}
	return out
}
