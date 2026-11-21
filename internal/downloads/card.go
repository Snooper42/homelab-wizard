package downloads

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/diskspace"
)

// Card is Status's Downloads card: what's on the way, in plain words, and
// a warning before the media drive fills. Its Line is the card's first
// line (Getting 2 · 1 stuck: no search site has it · Drive 82% full).
type Card struct {
	Line string `json:"line"`
	// Items, stuck first: one per download (an app's queue entry, a season
	// pack as one) and per request nothing has been found for. A wall
	// screen gets them without their names.
	Items []Item `json:"items,omitempty"`
	// Drive is the fuller of the media and downloads drives; nil when
	// neither could be read (not set, or not plugged in).
	Drive *Drive `json:"drive,omitempty"`
	// Warning is the drive's warning in words, "" below 85% full; at 95% it
	// leads the Line too.
	Warning string `json:"warning,omitempty"`
	// Unread are the apps that didn't answer, by name.
	Unread []string `json:"unread,omitempty"`
	// Apps: whether any media app is installed and running (or resting); a
	// homelab without them shows no card.
	Apps bool `json:"apps"`
}

// Item states, in the order the card lists them.
const (
	Stuck   = "stuck"
	Getting = "getting"
	Waiting = "waiting"
	Filing  = "filing"
)

// Item is one thing on the way.
type Item struct {
	Name    string `json:"name"`
	App     string `json:"app"`               // the app that asked for it: Sonarr, Radarr, Lidarr
	State   string `json:"state"`             // Stuck, Getting, Waiting, Filing
	Words   string `json:"words"`             // "42% · about 20 minutes left", "Nobody is sharing it yet"
	Percent int    `json:"percent"`           // while Getting
	Request bool   `json:"request,omitempty"` // a Seerr request, not a download
}

// Drive is how full a drive is.
type Drive struct {
	Name     string `json:"name"` // "media", "media, downloads"
	Used     int    `json:"used"` // percent
	Free     uint64 `json:"free"`
	Total    uint64 `json:"total"`
	FilmsFit int    `json:"filmsFit"` // roughly, at filmSize each
}

// The drive's thresholds (arr item 6): a warning at 85%, the card's first
// line at 95%.
const (
	warnAt = 85
	fullAt = 95
)

// filmSize is a film's size for "room for about N more films": an HD film
// as the apps pick one by default, roughly.
const filmSize = 4 << 30

// notFoundAfter is how long a request may go with nothing found before the
// card calls it stuck: the apps search at once, and Sonarr and Radarr wait
// an hour for Usenet first (TORRENT_DELAY_MINUTES).
const notFoundAfter = 90 * time.Minute

// Record is one entry of an app's queue, with what the card needs.
type Record struct {
	App           string // the app's name
	Name          string
	Group         string // records sharing a download (a season pack)
	DownloadID    string
	Status        string // queued, paused, downloading, completed, failed, warning, delay, downloadClientUnavailable
	TrackedState  string // downloading, importBlocked, importPending, importing, imported, failedPending, failed, ignored
	TrackedStatus string // ok, warning, error
	Size, Left    float64
	TimeLeft      string // "00:20:13", "1.02:03:04"
}

// Request is a Seerr request on the way, as the card needs it.
type Request struct {
	App       string // the app it went to: Sonarr or Radarr
	Name      string
	Age       time.Duration
	Queued    bool // its film or show is in that app's queue
	Read      bool // that app was read (false: resting, or didn't answer)
	NotOutYet bool
}

// Readings are what the card is made from.
type Readings struct {
	Apps     bool
	Records  []Record
	Torrents []Torrent // to tell a torrent nobody shares
	Requests []Request
	Unread   []string
	Volumes  []diskspace.Volume
}

// Build makes the card from what was read.
func Build(r Readings) Card {
	c := Card{Apps: r.Apps, Unread: r.Unread}
	unshared := map[string]bool{}
	for _, t := range r.Torrents {
		if t.Unshared() {
			unshared[strings.ToLower(t.Hash)] = true
		}
	}
	// One item per download: a season pack is one, named for the show.
	type group struct {
		rec   Record
		count int
	}
	var order []string
	groups := map[string]*group{}
	for _, rec := range r.Records {
		k := rec.App + "\x00" + strings.ToLower(rec.DownloadID)
		if rec.DownloadID == "" {
			k += "\x00" + strconv.Itoa(len(order))
		}
		if g, ok := groups[k]; ok {
			g.count++
			continue
		}
		groups[k] = &group{rec: rec, count: 1}
		order = append(order, k)
	}
	for _, k := range order {
		g := groups[k]
		it := item(g.rec, unshared[strings.ToLower(g.rec.DownloadID)])
		if g.count > 1 && g.rec.Group != "" {
			it.Name = fmt.Sprintf("%s (%d episodes)", g.rec.Group, g.count)
		}
		c.Items = append(c.Items, it)
	}
	for _, q := range r.Requests {
		if q.Queued {
			continue // its download is listed
		}
		it := Item{Name: q.Name, App: q.App, Request: true}
		switch {
		case q.NotOutYet:
			it.State, it.Words = Waiting, "Not out yet: "+q.App+" gets it once it is"
		case !q.Read || q.Age < notFoundAfter:
			it.State, it.Words = Waiting, "Looking for it"
		default:
			it.State, it.Words = Stuck, "No search site has it yet"
		}
		c.Items = append(c.Items, it)
	}
	rank := map[string]int{Stuck: 0, Getting: 1, Waiting: 2, Filing: 3}
	slices.SortStableFunc(c.Items, func(a, b Item) int { return rank[a.State] - rank[b.State] })

	if v := fullest(r.Volumes); v != nil {
		c.Drive = v
		c.Warning = warning(*v)
	}
	c.Line = line(c)
	return c
}

// item is one download's state and words.
func item(rec Record, unshared bool) Item {
	it := Item{Name: rec.Name, App: rec.App}
	if it.Name == "" {
		it.Name = "Something " + rec.App + " asked for"
	}
	switch {
	case rec.Status == "completed" || slices.Contains([]string{"importPending", "importing", "imported"}, rec.TrackedState):
		it.State, it.Words = Filing, "Finished: being put in the library"
	case rec.Status == "failed" || rec.TrackedState == "failedPending" || rec.TrackedState == "failed":
		it.State, it.Words = Stuck, "The download failed: "+rec.App+" is looking for another copy"
	case rec.Status == "downloadClientUnavailable":
		it.State, it.Words = Stuck, "The download app isn't answering"
	case rec.Status == "paused":
		it.State, it.Words = Stuck, "Paused in the download app"
	case unshared:
		it.State, it.Words = Stuck, "Nobody is sharing it yet"
	case rec.Status == "warning" || rec.TrackedStatus == "warning" || rec.TrackedStatus == "error" || rec.TrackedState == "importBlocked":
		it.State, it.Words = Stuck, rec.App+" has a problem with it: open "+rec.App+" to see why"
	case rec.Status == "delay":
		it.State, it.Words = Waiting, "Waiting a little in case a Usenet copy turns up"
	case rec.Status == "queued":
		it.State, it.Words = Waiting, "Waiting its turn"
	default:
		it.State = Getting
		if rec.Size > 0 {
			it.Percent = min(100, max(0, int((rec.Size-rec.Left)*100/rec.Size)))
		}
		it.Words = fmt.Sprintf("%d%%", it.Percent)
		if left := timeLeft(rec.TimeLeft); left != "" {
			it.Words += " · " + left
		}
	}
	return it
}

// timeLeft is an app's timeleft ("00:20:13", "1.02:03:04") in words:
// "about 20 minutes left"; "" when unknown.
func timeLeft(s string) string {
	if s == "" {
		return ""
	}
	days := 0
	if d, rest, ok := strings.Cut(s, "."); ok && !strings.Contains(d, ":") {
		days, _ = strconv.Atoi(d)
		s = rest
	}
	parts := strings.Split(s, ":")
	if len(parts) != 3 {
		return ""
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return ""
	}
	total := time.Duration(days*24+h)*time.Hour + time.Duration(m)*time.Minute
	switch {
	case total < 2*time.Minute:
		return "almost done"
	case total < time.Hour:
		return fmt.Sprintf("about %d minutes left", int(total.Minutes()))
	case total < 2*time.Hour:
		return "about an hour left"
	case total < 48*time.Hour:
		return fmt.Sprintf("about %d hours left", int(total.Hours()))
	}
	return fmt.Sprintf("about %d days left", int(total.Hours()/24))
}

// fullest is the fullest of the drives, by share used.
func fullest(vols []diskspace.Volume) *Drive {
	var best *Drive
	for _, v := range vols {
		if v.Total == 0 {
			continue
		}
		used := int((v.Total - min(v.Free, v.Total)) * 100 / v.Total) // #nosec G115 -- a percentage, 0 to 100
		if best == nil || used > best.Used {
			best = &Drive{Name: v.Label(), Used: used, Free: v.Free, Total: v.Total, FilmsFit: int(v.Free / filmSize)} // #nosec G115 -- a count of films
		}
	}
	return best
}

// warning is the drive's warning in words; "" below warnAt.
func warning(d Drive) string {
	room := "no room for another film"
	switch {
	case d.FilmsFit == 1:
		room = "room for about 1 more film"
	case d.FilmsFit > 1:
		room = fmt.Sprintf("room for about %d more films", d.FilmsFit)
	}
	switch {
	case d.Used >= fullAt:
		return fmt.Sprintf("The %s drive is almost full (%d%%): %s. Downloads stop when it fills.", d.Name, d.Used, room)
	case d.Used >= warnAt:
		return fmt.Sprintf("The %s drive is %d%% full: %s.", d.Name, d.Used, room)
	}
	return ""
}

// line is the card's first line.
func line(c Card) string {
	var parts []string
	if c.Drive != nil && c.Drive.Used >= fullAt {
		parts = append(parts, fmt.Sprintf("Drive almost full (%d%%)", c.Drive.Used))
	}
	count := map[string]int{}
	whys := map[string]bool{}
	for _, it := range c.Items {
		count[it.State]++
		if it.State == Stuck {
			whys[shortWhy(it)] = true
		}
	}
	if n := count[Getting]; n > 0 {
		parts = append(parts, fmt.Sprintf("Getting %d", n))
	}
	if n := count[Stuck]; n > 0 {
		s := fmt.Sprintf("%d stuck", n)
		if len(whys) == 1 {
			for w := range whys {
				s += ": " + w
			}
		}
		parts = append(parts, s)
	}
	if n := count[Waiting]; n > 0 {
		parts = append(parts, fmt.Sprintf("%d waiting", n))
	}
	if n := count[Filing]; n > 0 {
		parts = append(parts, fmt.Sprintf("Filing %d", n))
	}
	if len(parts) == 0 || (len(parts) == 1 && c.Drive != nil && c.Drive.Used >= fullAt) {
		parts = append(parts, "Nothing on the way")
	}
	if c.Drive != nil && c.Drive.Used < fullAt {
		parts = append(parts, fmt.Sprintf("Drive %d%% full", c.Drive.Used))
	}
	for _, name := range c.Unread {
		parts = append(parts, name+" didn't answer")
	}
	return strings.Join(parts, " · ")
}

// shortWhy is a stuck item's reason for the first line.
func shortWhy(it Item) string {
	switch {
	case it.Request:
		return "no search site has it"
	case strings.HasPrefix(it.Words, "Nobody is sharing"):
		return "nobody is sharing it"
	case strings.HasPrefix(it.Words, "The download failed"):
		return "the download failed"
	case strings.HasPrefix(it.Words, "The download app"):
		return "the download app isn't answering"
	case strings.HasPrefix(it.Words, "Paused"):
		return "paused"
	}
	return "open " + it.App + " to see why"
}
