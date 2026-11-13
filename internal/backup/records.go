package backup

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/history"
)

// RecordsFolder is where the nightly backup keeps the homelab's own records,
// inside recovery-staging/secrets so the encrypted Homelab Secrets job takes
// them off-site with .env (the paired phones' token hashes and the apps'
// sign-in secrets are among them).
const RecordsFolder = "data"

// recordDirs are the folders in data/ that are records rather than an app's
// data or a cache: the household's welcome pages, the apps' sign-in
// settings, the receipts kept with Finances' transactions, the pictures
// of the Collection's cards, and each household member's own Finances
// (members/<username>/data).
var recordDirs = []string{"people", "sso", "finance-receipts", "finance-cards", "members"}

// CopyRecords copies the homelab's own records from dataDir (the homelab
// folder's data/) into dst: every .json file directly in it, the people,
// sso, finance-receipts, finance-cards, and members folders, and a snapshot of homelab.db (the
// record of what was done). Not data/appdata (the AppData job has it), the icon cache,
// or a sync folder. dst is replaced as a whole, so a record removed here is
// gone from the next night's copy too, and a copy that fails halfway leaves
// the previous night's in place. It returns how many files were copied.
func CopyRecords(dataDir, dst string) (int, error) {
	tmp := dst + ".new"
	if err := os.RemoveAll(tmp); err != nil {
		return 0, err
	}
	count := 0
	copyFile := func(src, rel string) error {
		if _, err := CopyVerified(src, filepath.Join(tmp, rel)); err != nil {
			return err
		}
		count++
		return nil
	}
	entries, err := os.ReadDir(dataDir)
	if os.IsNotExist(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	for _, e := range entries {
		if e.Type().IsRegular() && strings.HasSuffix(e.Name(), ".json") {
			if err := copyFile(filepath.Join(dataDir, e.Name()), e.Name()); err != nil {
				return 0, err
			}
		}
	}
	for _, dir := range recordDirs {
		root := filepath.Join(dataDir, dir)
		err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				if os.IsNotExist(err) && path == root {
					return filepath.SkipDir
				}
				return err
			}
			if !d.Type().IsRegular() {
				return nil // folders are made as files land; links are not followed
			}
			rel, err := filepath.Rel(dataDir, path)
			if err != nil {
				return err
			}
			return copyFile(path, rel)
		})
		if err != nil {
			return 0, err
		}
	}
	// The record of what was done (data/homelab.db, internal/history): a
	// consistent copy made through SQLite, never the file mid-write.
	if _, err := os.Stat(filepath.Join(dataDir, filepath.Base(history.Path("")))); err == nil {
		d, err := history.Open(filepath.Dir(dataDir))
		if err != nil {
			return 0, err
		}
		err = d.Snapshot(filepath.Join(tmp, filepath.Base(history.Path(""))))
		d.Close()
		if err != nil {
			return 0, fmt.Errorf("copying the record of what was done: %w", err)
		}
		count++
	}
	if count == 0 {
		_ = os.RemoveAll(tmp)
		return 0, os.RemoveAll(dst)
	}
	if err := os.RemoveAll(dst); err != nil {
		return 0, err
	}
	if err := os.Rename(tmp, dst); err != nil {
		return 0, fmt.Errorf("putting the records copy in place: %w", err)
	}
	return count, nil
}
