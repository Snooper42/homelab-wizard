package media

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// bookExt are the files Calibre takes as a book's (books_tidy.py's
// BOOK_EXT).
var bookExt = map[string]bool{".epub": true, ".azw3": true, ".azw": true, ".mobi": true, ".kepub": true,
	".pdf": true, ".fb2": true, ".lit": true, ".djvu": true}

// IsCalibreLibrary reports whether a folder is a Calibre library (it holds
// Calibre's metadata.db).
func IsCalibreLibrary(dir string) bool {
	fi, err := os.Stat(filepath.Join(dir, "metadata.db"))
	return err == nil && !fi.IsDir()
}

// LooseBooks counts the folders under dir holding a book's files, one book
// each as Calibre exports them, for Make a Calibre library to offer: hidden
// folders, and a book loose at the top, aren't counted (books_tidy.py's
// book_folders).
func LooseBooks(dir string) int {
	seen := map[string]bool{}
	_ = filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") && p != dir {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if !d.IsDir() && bookExt[strings.ToLower(filepath.Ext(p))] {
			if parent := filepath.Dir(p); parent != dir {
				seen[parent] = true
			}
		}
		return nil
	})
	return len(seen)
}
