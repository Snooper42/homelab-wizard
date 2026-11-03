package media

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// InboxSignature sums up what's in the inbox folders: each entry's name,
// size, and time. The agent runs the inbox only when it changed since a
// sweep that left nothing waiting, so a quiet Downloads costs no Python.
// An entry still within its five quiet minutes changes the signature as
// the clock passes them, so it's looked at once it has settled.
func InboxSignature(folders []string, now time.Time) string {
	h := sha256.New()
	for _, f := range folders {
		entries, err := os.ReadDir(f)
		if err != nil {
			fmt.Fprintf(h, "%s\x00missing\n", f)
			continue
		}
		names := make([]string, 0, len(entries))
		for _, e := range entries {
			if strings.HasPrefix(e.Name(), ".") {
				continue
			}
			names = append(names, e.Name())
		}
		sort.Strings(names)
		for _, n := range names {
			fi, err := os.Stat(filepath.Join(f, n))
			if err != nil {
				continue
			}
			settled := now.Sub(fi.ModTime()) >= 5*time.Minute
			fmt.Fprintf(h, "%s\x00%s\x00%d\x00%d\x00%t\n", f, n, fi.Size(), fi.ModTime().Unix(), settled)
		}
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// HasTdarrWork reports whether an engine has files with Tdarr: queued for
// shrinking, or downloads waiting in staging (~/.homelab-media/<kind>.json).
func HasTdarrWork(home, kind string) bool {
	data, err := os.ReadFile(filepath.Join(home, ".homelab-media", kind+".json"))
	if err != nil {
		return false
	}
	var st struct {
		Files   map[string]struct{ Status string } `json:"files"`
		Pending map[string]any                     `json:"pending"`
	}
	if json.Unmarshal(data, &st) != nil {
		return false
	}
	if len(st.Pending) > 0 {
		return true
	}
	for _, f := range st.Files {
		if f.Status == "queued" {
			return true
		}
	}
	return false
}
