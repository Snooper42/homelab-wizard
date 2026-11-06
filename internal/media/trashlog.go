package media

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
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

// TrashKeep is how long the trash log keeps a line whose run no screen
// offers Undo for any more.
const TrashKeep = 30 * 24 * time.Hour

// TrimTrashLog drops the trash log's lines that Undo can no longer reach:
// their run is not one rec offers Undo for (Recent activity, or an
// action's last run) and they are older than TrashKeep. The engines add to
// it only while a job holds the media lock, as the caller does.
func TrimTrashLog(root string, rec Record, now time.Time) error {
	path := TrashLogPath(root)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	offered := map[string]bool{}
	for _, a := range rec.Activity {
		offered[a.Undo] = true
	}
	for _, runs := range rec.Last {
		for _, r := range runs {
			offered[r.ID] = true
		}
	}
	delete(offered, "")
	cutoff := now.Add(-TrashKeep)
	var kept []string
	dropped := false
	for _, line := range strings.Split(strings.TrimRight(string(data), "\n"), "\n") {
		var e struct{ Run, At string }
		if json.Unmarshal([]byte(line), &e) != nil || e.Run == "" {
			dropped = true
			continue
		}
		at, err := time.ParseInLocation("2006-01-02T15:04:05", e.At, now.Location())
		if !offered[e.Run] && (err != nil || at.Before(cutoff)) {
			dropped = true
			continue
		}
		kept = append(kept, line)
	}
	if !dropped {
		return nil
	}
	out := ""
	if len(kept) > 0 {
		out = strings.Join(kept, "\n") + "\n"
	}
	return lockedfile.Write(path, []byte(out), 0o600)
}
