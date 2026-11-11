// Package statusfolds keeps which groups on Status are folded and which
// open, by the group's name ("Media": false is folded), as one record in
// data/ the app, the phone's page and the iPhone app all read, so a group
// folded on one is folded on the others (the owner, Nov 10). It is what
// the person picked; a group not in it opens or folds by itself (open when
// something in it needs a look). Show every app is each device's own and
// is not kept here. Changed under its lock (internal/lockedfile) and saved
// whole, 0600.
package statusfolds

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"unicode"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// The most groups, and the longest name, a record keeps: Status has a few
// dozen categories at most, each a word or two.
const (
	maxGroups = 64
	maxName   = 64
)

// Path is the record in the homelab folder.
func Path(root string) string { return filepath.Join(root, "data", "status-folds.json") }

type record struct {
	Open map[string]bool `json:"open"`
}

// Load is each group picked and whether it is open; none (never nil) when
// there is no record or it can't be read.
func Load(root string) map[string]bool {
	var r record
	if data, err := os.ReadFile(Path(root)); err == nil {
		_ = json.Unmarshal(data, &r)
	}
	if r.Open == nil {
		return map[string]bool{}
	}
	return r.Open
}

// Save keeps open as the groups picked, whole (empty: none picked, each
// group back to opening by itself). A name that isn't one (empty, too
// long, with control characters) or too many are refused, and the record
// is left as it was.
func Save(root string, open map[string]bool) error {
	if len(open) > maxGroups {
		return errors.New("too many groups")
	}
	for name := range open {
		if name == "" || len([]rune(name)) > maxName {
			return errors.New("that isn't a group on Status")
		}
		for _, c := range name {
			if unicode.IsControl(c) {
				return errors.New("that isn't a group on Status")
			}
		}
	}
	if open == nil {
		open = map[string]bool{}
	}
	data, err := json.Marshal(record{Open: open})
	if err != nil {
		return err
	}
	return lockedfile.Update(Path(root), 0o600, func([]byte) ([]byte, bool) { return append(data, '\n'), true })
}
