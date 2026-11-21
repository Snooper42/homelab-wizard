package downloads

import (
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/diskspace"
)

const gb = 1 << 30

// drive is a media drive used percent full, of 1000 GB.
func drive(used int) []diskspace.Volume {
	total := uint64(1000 * gb)
	return []diskspace.Volume{{Names: []string{"media"}, Free: total * uint64(100-used) / 100, Total: total}}
}

// The card's first line says, in words, what's on the way: the plan's own
// example, two coming and a request nothing was found for.
func TestCardSaysWhatIsOnTheWay(t *testing.T) {
	c := Build(Readings{
		Apps: true,
		Records: []Record{
			{App: "Radarr", Name: "Dune: Part Two (2024)", DownloadID: "A", Status: "downloading", Size: 100, Left: 58, TimeLeft: "00:20:13"},
			{App: "Sonarr", Name: "Severance S2 E3", DownloadID: "B", Status: "downloading", Size: 100, Left: 10, TimeLeft: "1.02:03:04"},
		},
		Requests: []Request{{App: "Radarr", Name: "Arrival (2016)", Age: 3 * time.Hour, Read: true}},
		Volumes:  drive(82),
	})
	if want := "Getting 2 · 1 stuck: no search site has it · Drive 82% full"; c.Line != want {
		t.Fatalf("line = %q, want %q", c.Line, want)
	}
	if c.Items[0].Name != "Arrival (2016)" || c.Items[0].State != Stuck || c.Items[0].Words != "No search site has it yet" {
		t.Errorf("stuck first, with why: %+v", c.Items[0])
	}
	if got := c.Items[1]; got.Percent != 42 || got.Words != "42% · about 20 minutes left" {
		t.Errorf("getting: %+v", got)
	}
	if got := c.Items[2]; got.Words != "90% · about 26 hours left" {
		t.Errorf("getting, a day: %+v", got)
	}
	if c.Warning != "" {
		t.Errorf("no warning at 82%%: %q", c.Warning)
	}
}

// Each state of a download, in words; a season pack is one item, and a
// torrent nobody shares is stuck.
func TestCardSaysEachStateInWords(t *testing.T) {
	c := Build(Readings{
		Apps: true,
		Records: []Record{
			{App: "Sonarr", Name: "Slow Horses S4 E1", Group: "Slow Horses", DownloadID: "PACK", Status: "downloading", Size: 10, Left: 5},
			{App: "Sonarr", Name: "Slow Horses S4 E2", Group: "Slow Horses", DownloadID: "PACK", Status: "downloading", Size: 10, Left: 5},
			{App: "Sonarr", Name: "Slow Horses S4 E3", Group: "Slow Horses", DownloadID: "pack", Status: "downloading", Size: 10, Left: 5},
			{App: "Radarr", Name: "Alone", DownloadID: "DEAD", Status: "downloading", Size: 10, Left: 10},
			{App: "Radarr", Name: "Done", DownloadID: "C", Status: "completed"},
			{App: "Radarr", Name: "Later", DownloadID: "D", Status: "delay"},
			{App: "Lidarr", Name: "Failed", DownloadID: "E", Status: "failed"},
		},
		Torrents: []Torrent{{Hash: "dead", State: "stalledDL", Progress: 0}, {Hash: "pack", State: "downloading", Progress: 0.5}},
		Requests: []Request{
			{App: "Radarr", Name: "Soon", Age: 5 * time.Minute, Read: true},
			{App: "Radarr", Name: "Next year", Age: 30 * time.Hour, Read: true, NotOutYet: true},
			{App: "Sonarr", Name: "Resting", Age: 30 * time.Hour},
			{App: "Radarr", Name: "Queued", Age: 30 * time.Hour, Read: true, Queued: true},
		},
	})
	want := map[string][2]string{
		"Slow Horses (3 episodes)": {Getting, "50%"},
		"Alone":                    {Stuck, "Nobody is sharing it yet"},
		"Done":                     {Filing, "Finished: being put in the library"},
		"Later":                    {Waiting, "Waiting a little in case a Usenet copy turns up"},
		"Failed":                   {Stuck, "The download failed: Lidarr is looking for another copy"},
		"Soon":                     {Waiting, "Looking for it"},
		"Next year":                {Waiting, "Not out yet: Radarr gets it once it is"},
		"Resting":                  {Waiting, "Looking for it"},
	}
	if len(c.Items) != len(want) {
		t.Fatalf("items = %+v", c.Items)
	}
	for _, it := range c.Items {
		if w, ok := want[it.Name]; !ok || it.State != w[0] || it.Words != w[1] {
			t.Errorf("%s: %s %q, want %v", it.Name, it.State, it.Words, w)
		}
	}
	if c.Items[0].State != Stuck || c.Items[len(c.Items)-1].State != Filing {
		t.Errorf("stuck first, filing last: %+v", c.Items)
	}
	if want := "Getting 1 · 2 stuck · 4 waiting · Filing 1"; c.Line != want {
		t.Errorf("line = %q, want %q (no drive read: none said)", c.Line, want)
	}
}

// It warns before the drive is full: at 85% in words with roughly how many
// films fit, and at 95% first on the line.
func TestCardWarnsBeforeTheDriveIsFull(t *testing.T) {
	c := Build(Readings{Apps: true, Volumes: drive(40)})
	if c.Line != "Nothing on the way · Drive 40% full" || c.Warning != "" {
		t.Errorf("40%%: %q %q", c.Line, c.Warning)
	}
	c = Build(Readings{Apps: true, Volumes: drive(88)})
	if c.Warning != "The media drive is 88% full: room for about 30 more films." {
		t.Errorf("88%%: %q", c.Warning)
	}
	c = Build(Readings{Apps: true, Volumes: drive(97), Records: []Record{{App: "Radarr", Name: "X", DownloadID: "A", Status: "downloading"}}})
	if !strings.HasPrefix(c.Line, "Drive almost full (97%) · Getting 1") {
		t.Errorf("97%%: line %q", c.Line)
	}
	if c.Warning != "The media drive is almost full (97%): room for about 7 more films. Downloads stop when it fills." {
		t.Errorf("97%%: %q", c.Warning)
	}
	c = Build(Readings{Apps: true, Volumes: drive(100)})
	if c.Line != "Drive almost full (100%) · Nothing on the way" || !strings.Contains(c.Warning, "no room for another film") {
		t.Errorf("full: %q %q", c.Line, c.Warning)
	}
	// The fuller of the media and downloads drives.
	c = Build(Readings{Apps: true, Volumes: append(drive(50), diskspace.Volume{Names: []string{"downloads"}, Free: 10 * gb, Total: 100 * gb})})
	if c.Drive == nil || c.Drive.Name != "downloads" || c.Drive.Used != 90 {
		t.Errorf("fullest: %+v", c.Drive)
	}
}

// An app that didn't answer is said, not taken for nothing on the way.
func TestCardSaysWhoDidNotAnswer(t *testing.T) {
	c := Build(Readings{Apps: true, Unread: []string{"Sonarr"}})
	if c.Line != "Nothing on the way · Sonarr didn't answer" {
		t.Errorf("line = %q", c.Line)
	}
}

func TestTimeLeftInWords(t *testing.T) {
	for in, want := range map[string]string{
		"":           "",
		"00:00:40":   "almost done",
		"00:20:13":   "about 20 minutes left",
		"01:10:00":   "about an hour left",
		"05:00:00":   "about 5 hours left",
		"3.04:00:00": "about 3 days left",
		"junk":       "",
	} {
		if got := timeLeft(in); got != want {
			t.Errorf("timeLeft(%q) = %q, want %q", in, got, want)
		}
	}
}
