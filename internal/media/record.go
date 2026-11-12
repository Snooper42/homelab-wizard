package media

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// Run is the outcome of one engine run: its result event, and when.
type Run struct {
	Action string         `json:"action"`
	OK     bool           `json:"ok"`
	Exit   int            `json:"exit"`
	At     time.Time      `json:"at"`
	Result map[string]any `json:"result,omitempty"`
	// ID names the run in the trash log; Back is how many things it put in
	// the Trash that Undo can put back.
	ID   string `json:"id,omitempty"`
	Back int    `json:"back,omitempty"`
	// Why is what the engine said when it gave up (its last failure line),
	// for Recent and the tabs to say instead of "the log says why".
	Why string `json:"why,omitempty"`
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
	// TdarrUsed is when a job last needed Tdarr: it rests only once that is
	// a while ago. TdarrResting: Tidy Up stopped it (data/stopped.json says
	// "tidy"), to start it again for a job. TdarrLeftUp: someone started it
	// while it rested, so it stays up until a job next uses it.
	TdarrUsed    time.Time `json:"tdarrUsed,omitzero"`
	TdarrResting bool      `json:"tdarrResting,omitempty"`
	TdarrLeftUp  bool      `json:"tdarrLeftUp,omitempty"`
	// The *arr apps rest too (the owner, Nov 9). ArrResting: Tidy Up stopped
	// ArrStopped (data/stopped.json says "tidy") at ArrRested. ArrWoke: when
	// it last started them (every 12 hours, for a request, or for a job).
	// ArrBusy: when something was last pending, as they rest only a while
	// after. ArrLeftUp: someone started one while they rested, so they stay
	// up until the next 12-hour wake.
	ArrResting bool      `json:"arrResting,omitempty"`
	ArrStopped []string  `json:"arrStopped,omitempty"`
	ArrRested  time.Time `json:"arrRested,omitzero"`
	ArrWoke    time.Time `json:"arrWoke,omitzero"`
	ArrBusy    time.Time `json:"arrBusy,omitzero"`
	ArrLeftUp  bool      `json:"arrLeftUp,omitempty"`
}

// Activity is one line of Tidy Up's Recent activity.
type Activity struct {
	At   time.Time `json:"at"`
	Kind string    `json:"kind"`
	Text string    `json:"text"`
	Sub  string    `json:"sub,omitempty"`
	// Undo is the run whose Trash it can put back ("trash restore <it>").
	Undo string `json:"undo,omitempty"`
	// Action is what it was (its job's action, "finalize") when the job did
	// what it set out to; none for a run that stopped. Recently done finds
	// an Undo by it, never by Text's words.
	Action string `json:"action,omitempty"`
	// Freed is what the run freed, in bytes, when it did what it set out to
	// and freed something: the figure on the right of its row in Recently
	// done. Sub no longer says it; a line from before has none, and its Sub
	// still says it.
	Freed int64 `json:"freed,omitempty"`
}

// Said is the line's words after its title, with what it freed: the
// command line's Recent, which has no column for a figure.
func (a Activity) Said() string {
	if a.Freed <= 0 {
		return a.Sub
	}
	if a.Sub == "" {
		return Bytes(a.Freed) + " freed"
	}
	return a.Sub + " · " + Bytes(a.Freed) + " freed"
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
	return lockedfile.Write(path, append(data, '\n'), 0o644)
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
	if kind == "trash" && run.Action == "restore" && run.OK {
		// Put back: its line no longer offers Undo.
		if id, _ := run.Result["run"].(string); id != "" {
			for i := range r.Activity {
				if r.Activity[i].Undo == id {
					r.Activity[i].Undo = ""
				}
			}
		}
	}
	if text, sub := Describe(kind, run); text != "" {
		a := Activity{At: run.At, Kind: kind, Text: text, Sub: sub}
		if run.OK {
			a.Action = run.Action
			a.Freed = max(num(run.Result["freed"]), 0)
		}
		if run.Back > 0 && run.OK && undoable(kind, run.Action) {
			a.Undo = run.ID
		}
		r.Activity = append(r.Activity, a)
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
		case (kind == "movies" || kind == "tv") && run.Action == "collect":
			// The agent collects every few minutes: one that can't (Tdarr
			// paused on battery, or stopped) makes no line each time; the
			// tab says Tdarr isn't answering.
			return "", ""
		case kind == "inbox" && run.Action == "name":
			// It stays in Needs a look, which says why.
			return "Couldn't file it as you named it", run.Why
		}
		if run.Why != "" {
			return title(kind) + ": " + run.Action + " stopped", run.Why
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
		return "Old library in the Trash", ""
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
	case "books review":
		// It changes nothing (the review page is what to look at), but Books says it was done.
		if n := num(res["changes"]); n > 0 {
			return "Books looked over", plural(num(res["books"]), "book") + " · " + commas(n) + " could look tidier"
		}
		return "Books looked over", plural(num(res["books"]), "book") + " · nothing to change"
	case "books apply":
		return "Books tidied", plural(num(res["changed"]), "book") + " · " + plural(num(res["covers"]), "cover")
	case "inbox undo":
		return "Put back where it came from", ""
	case "inbox name":
		return "Filed as you named it", ""
	case "inbox leave":
		return "Left where it is", ""
	case "books build":
		if applied, _ := res["applied"].(bool); !applied {
			return "", ""
		}
		return "Calibre library made", plural(num(res["added"]), "book")
	case "movies collect", "tv collect":
		if num(res["replaced"]) == 0 && len(anyList(res["filed"])) == 0 {
			return "", ""
		}
		return title(kind) + " shrunk", plural(num(res["replaced"]), "file") + " replaced"
	case "movies dedupe", "tv dedupe":
		if num(res["removed"]) == 0 {
			return "", ""
		}
		return "Extra copies in the Trash", plural(num(res["removed"]), "copy")
	case "movies posters", "tv posters":
		if num(res["asked"]) == 0 {
			return "", ""
		}
		return "Posters asked of Jellyfin", plural(num(res["asked"]), map[string]string{"movies": "film", "tv": "show"}[kind]) + " · they show as Jellyfin finds them"
	case "trash restore":
		if num(res["restored"]) == 0 {
			return "", ""
		}
		return "Put back from the Trash", plural(num(res["restored"]), "thing") + " where they were"
	case "audiobooks run":
		return "Audiobooks merged", plural(num(res["merged"]), "book") + " into one .m4b each"
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
