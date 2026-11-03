package media

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// Run is the outcome of one engine run: its result event, and when.
type Run struct {
	Action string         `json:"action"`
	OK     bool           `json:"ok"`
	Exit   int            `json:"exit"`
	At     time.Time      `json:"at"`
	Result map[string]any `json:"result,omitempty"`
}

// Record is data/media.json: what Tidy Up knows without running Python,
// for Status's Needs a look, the Tidy Up screen, and the agent's timetable.
type Record struct {
	// Last is each kind's newest run of each action: Last["music"]["verify"].
	Last map[string]map[string]Run `json:"last,omitempty"`
	// Activity is the newest things done, newest last (at most 40).
	Activity []Activity `json:"activity,omitempty"`
	// TdarrLibraries are the library IDs tdarr setup made: "movies", "tv".
	TdarrLibraries map[string]string `json:"tdarrLibraries,omitempty"`
	// Freed is the bytes put in the Trash by kind, all time.
	Freed map[string]int64 `json:"freed,omitempty"`
	// LastScrub, LastInbox: the agent's timetable.
	LastScrub time.Time `json:"lastScrub,omitzero"`
	LastInbox time.Time `json:"lastInbox,omitzero"`
	// InboxSeen is the inbox folders' signature at the last sweep that
	// left nothing waiting: the agent skips Python while it is unchanged.
	InboxSeen string `json:"inboxSeen,omitempty"`
	// DuplicatiPaused: the media lock paused Duplicati, so it resumes it.
	DuplicatiPaused bool `json:"duplicatiPaused,omitempty"`
}

// Activity is one line of Tidy Up's Recent activity.
type Activity struct {
	At   time.Time `json:"at"`
	Kind string    `json:"kind"`
	Text string    `json:"text"`
	Sub  string    `json:"sub,omitempty"`
}

// RecordPath is where the record lives.
func RecordPath(root string) string { return filepath.Join(root, "data", "media.json") }

// LoadRecord reads the record; none is an empty one.
func LoadRecord(root string) Record {
	var r Record
	if data, err := os.ReadFile(RecordPath(root)); err == nil {
		_ = json.Unmarshal(data, &r)
	}
	return r
}

// Save writes the record beside its place and renames it in.
func (r Record) Save(root string) error {
	path := RecordPath(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(r, "", "  ")
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(data, '\n'), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// Note keeps a run's outcome, the activity it amounts to, and what it freed.
func (r *Record) Note(kind string, run Run) {
	if r.Last == nil {
		r.Last = map[string]map[string]Run{}
	}
	if r.Last[kind] == nil {
		r.Last[kind] = map[string]Run{}
	}
	r.Last[kind][run.Action] = run
	if freed := num(run.Result["freed"]); freed > 0 {
		if r.Freed == nil {
			r.Freed = map[string]int64{}
		}
		r.Freed[kind] += freed
	}
	if text, sub := Describe(kind, run); text != "" {
		r.Activity = append(r.Activity, Activity{At: run.At, Kind: kind, Text: text, Sub: sub})
		if len(r.Activity) > 40 {
			r.Activity = r.Activity[len(r.Activity)-40:]
		}
	}
}

// Describe is a run in the words of Recent activity; "" for a run worth no line.
func Describe(kind string, run Run) (text, sub string) {
	res := run.Result
	if !run.OK {
		if run.Exit == 130 {
			return "", ""
		}
		switch {
		case kind == "music" && run.Action == "verify":
			return "Some songs are missing", plural(num(res["missing"]), "song") + " not in the new library or set aside"
		case kind == "music" && run.Action == "free-space":
			return "The old library was kept", "Not every song is accounted for"
		}
		return title(kind) + ": " + run.Action + " stopped", "The log says why"
	}
	switch kind + " " + run.Action {
	case "music run":
		return "Cleaned library built", plural(num(res["in_library"]), "song") + " · " + plural(num(res["set_aside"]), "copy") + " set aside"
	case "music finalize":
		return "Cleaned library swapped in", "Navidrome paused and backed up"
	case "music undo":
		return "Old library put back", ""
	case "music verify":
		return "Nothing went missing", plural(num(res["original"]), "song") + " before = " + plural(num(res["new"]), "song") + " + " + plural(num(res["set_aside"]), "song") + " set aside"
	case "music free-space":
		return "Old library in the Trash", Bytes(num(res["freed"])) + " freed"
	case "music navidrome-cleanup":
		return "Navidrome tidied", plural(num(res["removed"]), "missing entry") + " removed, full scan"
	case "music playlists":
		return "Smart playlists written", plural(int64(len(anyList(res["playlists"]))), "genre playlist")
	case "music lyrics":
		if b, _ := res["check"].(bool); b {
			return "", ""
		}
		return "Lyrics added", plural(num(res["added"]), "song") + " · " + plural(num(res["upgraded"]), "plain one") + " now time-synced"
	case "music genres":
		return "Genres folded into yours", plural(num(res["applied"]), "song")
	case "books apply":
		return "Books tidied", plural(num(res["changed"]), "book") + " · " + plural(num(res["covers"]), "cover")
	case "movies collect", "tv collect":
		if num(res["replaced"]) == 0 && len(anyList(res["filed"])) == 0 {
			return "", ""
		}
		return title(kind) + " shrunk", plural(num(res["replaced"]), "file") + " replaced · " + Bytes(num(res["freed"])) + " freed"
	case "movies dedupe", "tv dedupe":
		if num(res["removed"]) == 0 {
			return "", ""
		}
		return "Extra copies in the Trash", plural(num(res["removed"]), "copy") + " · " + Bytes(num(res["freed"])) + " freed"
	case "movies posters", "tv posters":
		if num(res["asked"]) == 0 {
			return "", ""
		}
		return "Posters asked of Jellyfin", plural(num(res["asked"]), map[string]string{"movies": "film", "tv": "show"}[kind]) + " · they show as Jellyfin finds them"
	case "audiobooks run":
		return "Audiobooks merged", plural(num(res["merged"]), "book") + " into one .m4b each · " + Bytes(num(res["freed"])) + " freed"
	case "scrubber scan":
		if b, _ := res["applied"].(bool); !b || num(res["files"])+num(res["folders"]) == 0 {
			return "", ""
		}
		return "Leftovers swept", plural(num(res["files"]), "leftover") + " and " + plural(num(res["folders"]), "empty folder") + " in the Trash"
	case "inbox scan":
		n := int64(0)
		if m, ok := res["filed"].(map[string]any); ok {
			for _, v := range m {
				n += int64(len(anyList(v)))
			}
		}
		if n == 0 {
			return "", ""
		}
		return "Filed from Downloads", plural(n, "item")
	}
	return "", ""
}

func title(kind string) string {
	return map[string]string{"music": "Music", "books": "Books", "movies": "Movies", "tv": "TV", "audiobooks": "Audiobooks",
		"inbox": "Inbox", "scrubber": "Scrubber"}[kind]
}

func num(v any) int64 {
	switch n := v.(type) {
	case float64:
		return int64(n)
	case int:
		return int64(n)
	case int64:
		return n
	case json.Number:
		i, _ := n.Int64()
		return i
	}
	return 0
}

func anyList(v any) []any {
	l, _ := v.([]any)
	return l
}

func plural(n int64, word string) string {
	s := commas(n) + " " + word
	if n == 1 {
		return s
	}
	switch {
	case len(word) > 1 && word[len(word)-1] == 'y' && word != "copy" && !isVowel(word[len(word)-2]):
		return s[:len(s)-1] + "ies"
	case word == "copy":
		return commas(n) + " copies"
	}
	return s + "s"
}

func isVowel(b byte) bool { return b == 'a' || b == 'e' || b == 'i' || b == 'o' || b == 'u' }

func commas(n int64) string {
	s := []byte{}
	str := []byte(itoa(n))
	for i, c := range str {
		if i > 0 && (len(str)-i)%3 == 0 && str[i-1] != '-' {
			s = append(s, ',')
		}
		s = append(s, c)
	}
	return string(s)
}

func itoa(n int64) string {
	b, _ := json.Marshal(n)
	return string(b)
}

// Bytes is a size in words: "100 GB", "4.2 MB".
func Bytes(n int64) string {
	f := float64(n)
	for _, u := range []string{"bytes", "KB", "MB", "GB", "TB"} {
		if f < 1000 || u == "TB" {
			if u == "bytes" {
				return itoa(int64(f)) + " bytes"
			}
			if f >= 100 {
				return itoa(int64(f+0.5)) + " " + u
			}
			whole := int64(f*10+0.5) / 10
			tenth := int64(f*10+0.5) % 10
			if tenth == 0 {
				return itoa(whole) + " " + u
			}
			return itoa(whole) + "." + itoa(tenth) + " " + u
		}
		f /= 1000
	}
	return ""
}
