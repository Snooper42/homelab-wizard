package media

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
)

// TrashLogPath is where the engines note what they put in the Trash, by run
// (data/media-trash.jsonl): one line {run, from, to} each, so Undo can put
// them back. "to" is empty for the Recycle Bin, which doesn't say where.
func TrashLogPath(root string) string { return filepath.Join(root, "data", "media-trash.jsonl") }

// Thrown is how many things run put in the Trash, and how many of them can
// be put back from here (their place in the Trash is known).
func Thrown(root, run string) (all, back int) {
	f, err := os.Open(TrashLogPath(root))
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64<<10), 1<<20)
	for sc.Scan() {
		var e struct{ Run, From, To string }
		if json.Unmarshal(sc.Bytes(), &e) != nil || e.Run != run {
			continue
		}
		all++
		if e.To != "" {
			back++
		}
	}
	return all, back
}

// undoable: what a run put in the Trash can be put back. Not a Tdarr copy's
// original (the smaller copy has its name now), nor the old music library
// (the organizer has closed that cleanup; its backup back on the drive
// wouldn't reopen it).
func undoable(kind, action string) bool {
	return !(action == "collect" || action == "run" && (kind == "movies" || kind == "tv") || kind == "music" && action == "free-space")
}
