// Package progress reads what Compose prints while it works, its JSON
// progress (docker compose --progress json) or the plain lines it prints
// otherwise, and says for each app what is happening, in plain words: the
// app's window shows a row per app instead of Docker's own lines.
package progress

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
)

// Update is one app's state now.
type Update struct {
	App  string `json:"app"`  // the app's ID
	Name string `json:"name"` // as people know it
	// Stage is waiting, downloading, building, setting-up, starting,
	// running, stopping, stopped, removing, removed, or failed.
	Stage string `json:"stage"`
	Words string `json:"words"` // the stage in a few plain words
	// Percent is how far a download is, 0 to 100; -1 when not known.
	Percent int  `json:"percent"`
	Done    bool `json:"done"`
	Failed  bool `json:"failed,omitempty"`
}

// Tracker turns Compose's lines into Updates. It is not safe for use by
// several goroutines at once.
type Tracker struct {
	names   map[string]string   // app ID → name
	byImage map[string][]string // image as Compose names it → app IDs
	layers  map[string]map[string]int
	stage   map[string]string // app → its last stage, so a download's end does not undo a start
}

// New makes a Tracker for the apps in c, with images as env gives them.
func New(c *catalog.Catalog, env map[string]string) *Tracker {
	t := &Tracker{names: map[string]string{}, byImage: map[string][]string{}, layers: map[string]map[string]int{}, stage: map[string]string{}}
	if c == nil {
		return t
	}
	lookup := compose.MapLookup(env)
	for _, a := range c.Apps {
		t.names[a.ID] = a.Name()
		if a.Image == "" {
			continue
		}
		img, err := compose.Interpolate(a.Image, lookup)
		if err != nil || img == "" {
			continue
		}
		ref := short(img)
		t.byImage[ref] = append(t.byImage[ref], a.ID)
	}
	return t
}

// event is a line of Compose's JSON progress.
type event struct {
	ID       string `json:"id"`
	ParentID string `json:"parent_id"`
	Status   string `json:"status"`
	Text     string `json:"text"`
	Details  string `json:"details"`
	Percent  int    `json:"percent"`
	// A failure, or a warning, instead of progress.
	Error   bool   `json:"error"`
	Message string `json:"message"`
	Level   string `json:"level"`
	Msg     string `json:"msg"`
}

// layerLine is a plain line about one image layer, which says nothing about
// which app it is for.
var layerLine = regexp.MustCompile(`^[0-9a-f]{12} (Pulling fs layer|Waiting|Downloading|Verifying Checksum|Download complete|Extracting|Pull complete|Already exists)`)

// Line reads one line Compose printed. It returns the apps it changed, and
// the line for a log people read: Compose's JSON as plain text, and ""
// for a line not worth reading (one image layer's progress).
func (t *Tracker) Line(line string) ([]Update, string) {
	s := strings.TrimSpace(line)
	if strings.HasPrefix(s, "{") {
		var e event
		if json.Unmarshal([]byte(s), &e) == nil {
			return t.event(e)
		}
	}
	if layerLine.MatchString(s) {
		return nil, ""
	}
	// Plain lines: "Container homelab_media-navidrome-1 Started",
	// "Image deluan/navidrome:latest Pulling", or with older Compose
	// "navidrome Pulling".
	f := strings.Fields(s)
	switch {
	case len(f) >= 3 && f[0] == "Container":
		if id := t.container(f[1]); id != "" {
			return t.set(id, strings.Join(f[2:], " ")), line
		}
	case len(f) >= 3 && f[0] == "Image":
		return t.image(f[1], strings.Join(f[2:], " "), -1), line
	case len(f) == 2 && t.names[f[0]] != "" && (f[1] == "Pulling" || f[1] == "Pulled"):
		return t.set(f[0], f[1]), line
	}
	return nil, line
}

func (t *Tracker) event(e event) ([]Update, string) {
	switch {
	case e.Error:
		// Which app it was about, when the message names its container.
		var ups []Update
		for _, w := range strings.FieldsFunc(e.Message, func(r rune) bool { return r == ' ' || r == '(' || r == ')' || r == ':' || r == '"' }) {
			if id := t.container(w); id != "" {
				ups = append(ups, t.fail(id, e.Message))
			}
		}
		return ups, e.Message
	case e.Msg != "":
		return nil, e.Msg
	case e.ParentID != "":
		img, ok := strings.CutPrefix(e.ParentID, "Image ")
		if !ok {
			return nil, ""
		}
		layers := t.layers[img]
		if layers == nil {
			layers = map[string]int{}
			t.layers[img] = layers
		}
		p := e.Percent
		if e.Status == "Done" {
			p = 100
		}
		layers[e.ID] = p
		total := 0
		for _, v := range layers {
			total += v
		}
		return t.image(img, "Downloading", total/len(layers)), ""
	}
	kind, id, _ := strings.Cut(e.ID, " ")
	text := strings.TrimSpace(e.ID + " " + e.Text)
	if e.Details != "" && e.Status == "Error" {
		text += ": " + e.Details
	}
	switch kind {
	case "Container":
		if app := t.container(id); app != "" {
			if e.Status == "Error" {
				return []Update{t.fail(app, strings.TrimSpace(e.Text+" "+e.Details))}, text
			}
			return t.set(app, e.Text), text
		}
	case "Image":
		return t.image(id, e.Text, -1), text
	}
	return nil, text
}

// image updates every app that runs img.
func (t *Tracker) image(img, text string, percent int) []Update {
	var ups []Update
	for _, id := range t.byImage[short(img)] {
		if percent >= 0 {
			ups = append(ups, t.update(id, "downloading", percent))
			continue
		}
		ups = append(ups, t.set(id, text)...)
	}
	return ups
}

// short is an image as Docker Hub's own short name gives it, with its tag:
// docker.io/library/postgres:17 and postgres:17 are the same image.
func short(img string) string {
	img = strings.TrimPrefix(strings.TrimPrefix(img, "docker.io/"), "library/")
	if !strings.Contains(img[strings.LastIndex(img, "/")+1:], ":") && !strings.Contains(img, "@") {
		img += ":latest"
	}
	return img
}

// stages are Compose's words for what it does, as a stage.
var stages = map[string]string{
	"Pulling": "downloading", "Downloading": "downloading", "Pulled": "downloaded",
	"Building": "building", "Built": "downloaded",
	"Creating": "setting-up", "Created": "setting-up", "Recreate": "replacing", "Recreated": "replacing",
	"Waiting": "waiting", "Starting": "starting", "Started": "running", "Healthy": "running", "Running": "running",
	"Restarting": "starting", "Restarted": "running",
	"Stopping": "stopping", "Stopped": "stopped", "Exited": "stopped",
	"Removing": "removing", "Removed": "removed",
	"Error": "failed",
}

// words are each stage in plain words.
var words = map[string]string{
	"waiting": "Waiting for the apps it needs", "downloading": "Downloading", "downloaded": "Downloaded",
	"building": "Building", "setting-up": "Setting up", "replacing": "Replacing it with the new version",
	"starting": "Starting", "running": "Running", "stopping": "Stopping", "stopped": "Stopped",
	"removing": "Removing", "removed": "Removed", "failed": "Something went wrong",
}

// done stages end an app's part of the job.
var done = map[string]bool{"running": true, "stopped": true, "removed": true, "failed": true}

func (t *Tracker) set(id, text string) []Update {
	stage, ok := stages[strings.TrimSpace(text)]
	if !ok {
		return nil
	}
	// A download that ends after the app started says nothing new.
	if (stage == "downloaded" || stage == "downloading") && t.stage[id] != "" && t.stage[id] != "downloading" && t.stage[id] != "downloaded" {
		return nil
	}
	p := -1
	if stage == "downloaded" {
		p = 100
	}
	return []Update{t.update(id, stage, p)}
}

func (t *Tracker) update(id, stage string, percent int) Update {
	t.stage[id] = stage
	u := Update{App: id, Name: t.names[id], Stage: stage, Words: words[stage], Percent: percent, Done: done[stage], Failed: stage == "failed"}
	if stage == "downloading" && percent >= 0 {
		u.Words = "Downloading · " + strconv.Itoa(percent) + "%"
	}
	if u.Name == "" {
		u.Name = id
	}
	return u
}

func (t *Tracker) fail(id, why string) Update {
	u := t.update(id, "failed", -1)
	if why != "" {
		u.Words = why
	}
	return u
}

// container is the app a container belongs to, from its name: Compose
// names them <project>-<service>-<n>, the projects have no hyphens
// (homelab_media), and the service is the app's ID.
func (t *Tracker) container(name string) string {
	i := strings.LastIndexByte(name, '-')
	if i < 0 {
		return ""
	}
	_, svc, ok := strings.Cut(name[:i], "-")
	if !ok || t.names[svc] == "" {
		return ""
	}
	return svc
}
