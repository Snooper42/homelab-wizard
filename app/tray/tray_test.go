package tray

import (
	"bytes"
	"image/color"
	"image/png"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

func TestSummaryAndLooks(t *testing.T) {
	st := api.Status{Apps: []api.AppStatus{
		{ID: "immich-server", Name: "Immich", State: "running", Health: "healthy", URL: "http://localhost:2283", Address: "photos.example.com"},
		{ID: "sonarr", Name: "Sonarr", State: "running", Health: "unhealthy", URL: "http://localhost:8989"},
		{ID: "ntfy", Name: "ntfy", State: "stopped"},
	}}
	if got := Summary(st); got != "2 of 3 apps running" {
		t.Errorf("summary %q", got)
	}
	if got := Summary(api.Status{Apps: st.Apps[:1]}); got != "1 app running" {
		t.Errorf("summary %q", got)
	}
	if got := Summary(api.Status{}); got != "No apps yet" || SummaryDot(api.Status{}) != DotOff {
		t.Errorf("no apps: %q", got)
	}
	if SummaryDot(st) != DotLook || SummaryDot(api.Status{Apps: st.Apps[:1]}) != DotOK {
		t.Error("the summary's dot")
	}
	loop := api.Status{Apps: []api.AppStatus{
		{Name: "File Browser", State: "running", Health: "restarting"},
		{Name: "Immich", State: "running", Health: "healthy", NotAnswering: "HTTP 502"},
		{Name: "Sonarr", State: "running", Health: "unhealthy"},
		{Name: "Uptime Kuma", State: "missing"},
		{Name: "ntfy", State: "missing"},
		{Name: "Syncthing", State: "stopped"},
	}, Missing: 2}
	if got := Looks(loop, 5); strings.Join(got, "|") != "File Browser keeps restarting|Immich does not answer|Sonarr is unwell|Uptime Kuma is not running|ntfy is not running" {
		t.Errorf("looks %q", got)
	}
	if got := Looks(loop, 3); len(got) != 3 || got[2] != "and 3 more need a look" {
		t.Errorf("looks, at most 3: %q", got)
	}
	if got := Looks(api.Status{Apps: st.Apps[:1]}, 3); len(got) != 0 {
		t.Errorf("all well: %q", got)
	}
	now := time.Date(2026, 10, 28, 9, 41, 0, 0, time.UTC)
	for _, c := range []struct {
		needs int
		ago   time.Duration
		want  string
	}{
		{0, 10 * time.Second, "All healthy · checked just now"},
		{1, 70 * time.Second, "One needs a look · checked a minute ago"},
		{3, 12 * time.Minute, "3 need a look · checked 12 minutes ago"},
		{0, 3 * time.Hour, "All healthy · checked 3 hours ago"},
	} {
		if got := StatusLine(c.needs, now.Add(-c.ago), now); got != c.want {
			t.Errorf("%d, %v: %q, want %q", c.needs, c.ago, got, c.want)
		}
	}
	if UpdatesTitle(updates.State{Schedule: "daily at 04:00"}) != "Pause nightly updates" || UpdatesTitle(updates.State{Paused: true}) != "Resume nightly updates" {
		t.Error("updates title")
	}
	if icon := ico(iconPNG(blueInk, true)); !bytes.HasPrefix(icon, []byte{0, 0, 1, 0, 1, 0, 32, 32}) || !bytes.Contains(icon, []byte("PNG")) {
		t.Error("bad .ico")
	}
	for _, d := range []Dot{DotOK, DotLook, DotDown, DotOff, DotDone, DotUpdate, DotNone} {
		img, err := png.Decode(bytes.NewReader(dotPNG(d)))
		if err != nil {
			t.Fatal(err)
		}
		_, _, _, centre := img.At(16, 16).RGBA()
		_, _, _, corner := img.At(1, 1).RGBA()
		if corner != 0 || (centre == 0) != (d == DotNone) {
			t.Errorf("dot %q: centre alpha %d, corner %d", d, centre, corner)
		}
	}
}

// Open an app lists the installed apps under their categories, in the
// catalog's order, with their state, the address a running one opens,
// and no more lines than there is room for.
func TestEntries(t *testing.T) {
	media := &compose.File{Name: "homelab_media", Categories: []compose.Category{{ID: "cloud", Label: "Cloud & Files"}, {ID: "media", Label: "Media"}},
		Services: map[string]*compose.Service{}}
	for id, cat := range map[string]string{"jellyfin": "media", "navidrome": "media", "filebrowser": "cloud", "syncthing": "cloud"} {
		media.Services[id] = &compose.Service{ID: id, Meta: compose.Meta{Category: cat}}
		media.Order = append(media.Order, id)
	}
	c := catalog.New(media)
	st := api.Status{Apps: []api.AppStatus{
		{ID: "jellyfin", Name: "Jellyfin", State: "running", Health: "healthy", URL: "http://localhost:8096", Address: "jellyfin.example.com"},
		{ID: "navidrome", Name: "Navidrome", State: "running", URL: "http://localhost:4533"},
		{ID: "filebrowser", Name: "File Browser", State: "running", Health: "restarting", URL: "http://localhost:8085"},
		{ID: "syncthing", Name: "Syncthing", State: "stopped"},
		{ID: "vikunja", Name: "Vikunja", State: "missing"},
		{ID: "mine", Name: "My app", State: "running", URL: "http://localhost:9000"},
	}}
	got := Entries(st, c, slots)
	var lines []string
	for _, e := range got {
		line := e.Title + " [" + string(e.Dot) + "] " + e.URL
		if e.Header {
			line = "# " + e.Title
		}
		lines = append(lines, line)
	}
	want := []string{
		"# Cloud & Files",
		"File Browser · restarting [look] http://localhost:8085",
		"Syncthing · stopped [off] ",
		"# Media",
		"Jellyfin [ok] https://jellyfin.example.com",
		"Navidrome [ok] http://localhost:4533",
		"# Other",
		"My app [ok] http://localhost:9000",
	}
	if strings.Join(lines, "\n") != strings.Join(want, "\n") {
		t.Errorf("entries:\n%s\nwant:\n%s", strings.Join(lines, "\n"), strings.Join(want, "\n"))
	}
	if short := Entries(st, c, 4); len(short) != 3 || short[2].Header {
		t.Errorf("room for 4 lines: %+v", short)
	}
	if none := Entries(st, nil, slots); len(none) != 6 || none[0].Title != "Other" {
		t.Errorf("without a catalog, one list: %+v", none)
	}
}

func TestAlertTitle(t *testing.T) {
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	if got := AlertTitle(notify.Event{Title: "Tunnel down", Time: now.Add(-3 * time.Hour)}, now); got != "Tunnel down · 3 hours ago" {
		t.Errorf("%q", got)
	}
	if got := AlertTitle(notify.Event{Message: "vikunja: new image", Time: now.Add(-90 * time.Second)}, now); got != "vikunja: new image · a minute ago" {
		t.Errorf("%q", got)
	}
}

func TestBackupTitle(t *testing.T) {
	now := time.Date(2026, 10, 10, 20, 0, 0, 0, time.UTC)
	for _, c := range []struct {
		last time.Time
		h24  bool
		want string
	}{
		{time.Date(2026, 10, 10, 3, 12, 0, 0, time.UTC), false, "Backed up at 3:12 this morning"},
		{time.Date(2026, 10, 10, 3, 12, 0, 0, time.UTC), true, "Backed up at 03:12 this morning"},
		{time.Date(2026, 10, 10, 15, 5, 0, 0, time.UTC), false, "Backed up at 3:05 this afternoon"},
		{time.Date(2026, 10, 10, 19, 30, 0, 0, time.UTC), true, "Backed up at 19:30 this evening"},
		{time.Date(2026, 10, 9, 23, 30, 0, 0, time.UTC), false, "Backed up yesterday at 11:30"},
		{now.Add(-30 * time.Hour), false, "Last backup 30 hours ago · check Backups"},
		{now.Add(-3 * 24 * time.Hour), false, "Last backup 3 days ago · check Backups"},
	} {
		if got := BackupTitle(c.last, now, c.h24); got != c.want {
			t.Errorf("%v: %q, want %q", c.last, got, c.want)
		}
		if late, dot := strings.HasPrefix(c.want, "Last backup"), BackupDot(c.last, now); (dot == DotLook) != late || (dot == DotDone) == late {
			t.Errorf("%v: mark %q", c.last, dot)
		}
	}
}

// The update line says what the app's look found, in the same words as
// the window's line; nothing when nothing waits.
func TestUpdateItem(t *testing.T) {
	for _, c := range []struct {
		f    Found
		want string
	}{
		{Found{Ready: true, Version: "0.15.0"}, "Update to 0.15.0"},
		{Found{Ready: true}, "Update Homelab Wizard"},
		{Found{Version: "0.15.0"}, ""},
	} {
		if got := UpdateItem(c.f); got != c.want {
			t.Errorf("%+v: %q, want %q", c.f, got, c.want)
		}
	}
}

// What the app's look found reaches the tray, which runs apart from it.
func TestFoundKept(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPDATA", t.TempDir())
	if f := LoadFound(); !f.Looked.IsZero() {
		t.Fatalf("a look before any: %+v", f)
	}
	want := Found{Looked: time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC), Ready: true, Version: "0.15.0"}
	if err := SaveFound(want); err != nil {
		t.Fatal(err)
	}
	if got := LoadFound(); !got.Looked.Equal(want.Looked) || got.Ready != want.Ready || got.Version != want.Version {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestWatchdogTitle(t *testing.T) {
	if got := WatchdogTitle(health.Summary{Checks: 40}); got != "" {
		t.Errorf("nothing failing: %q", got)
	}
	one := health.Summary{Failing: []health.Failure{{Name: "crowdsec bouncer"}}}
	if got := WatchdogTitle(one); got != "Check failing: crowdsec bouncer" {
		t.Errorf("one: %q", got)
	}
	// The owner's menu (28 Oct): three names ran off the line. The line
	// says how many; its tooltip names them.
	many := health.Summary{Failing: []health.Failure{{Name: "crowdsec bouncer"}, {Name: "immich-database backup"}, {Name: "duplicati Homelab Photos"}}}
	if got := WatchdogTitle(many); got != "3 watchdog checks failing" {
		t.Errorf("many: %q", got)
	}
	if got := WatchdogTip(many); got != "crowdsec bouncer, immich-database backup, duplicati Homelab Photos; click for Status" {
		t.Errorf("tip: %q", got)
	}
}

func TestAppearanceKeepsOnlyWhatItKnows(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home) // os.UserHomeDir on Windows
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("AppData", t.TempDir())
	if a := LoadAppearance(); a != (Appearance{Theme: "system", Contrast: "system", Layout: "classic", Motion: "system", Transparency: "system"}) {
		t.Errorf("defaults: %+v", a)
	}
	kept, err := SaveAppearance(Appearance{Theme: "dark", Accent: "#E11D48", Contrast: "loud", Layout: "islands", Icon: "red", Motion: "none", Transparency: "glass"})
	if err != nil {
		t.Fatal(err)
	}
	want := Appearance{Theme: "dark", Accent: "#E11D48", Contrast: "system", Layout: "islands", Motion: "none", Transparency: "system"}
	if kept != want || LoadAppearance() != want {
		t.Errorf("kept %+v, read back %+v", kept, LoadAppearance())
	}
}

func TestIconInk(t *testing.T) {
	for _, c := range []struct {
		a      Appearance
		ink    color.NRGBA
		picked bool
	}{
		{Appearance{}, color.NRGBA{}, false},
		{Appearance{Icon: "#22c55e"}, color.NRGBA{R: 0x22, G: 0xc5, B: 0x5e, A: 255}, true},
		{Appearance{Icon: "accent", Accent: "#e11d48"}, color.NRGBA{R: 0xe1, G: 0x1d, B: 0x48, A: 255}, true},
		{Appearance{Icon: "accent"}, color.NRGBA{}, false}, // the system's accent: the usual icon
	} {
		if ink, picked := c.a.IconInk(); ink != c.ink || picked != c.picked {
			t.Errorf("%+v: %v %v", c.a, ink, picked)
		}
	}
}

func TestIconDot(t *testing.T) {
	plain, dot := iconPNG(blueInk, false), iconPNG(blueInk, true)
	if bytes.Equal(plain, dot) {
		t.Fatal("the dot changes nothing")
	}
	img, err := png.Decode(bytes.NewReader(dot))
	if err != nil {
		t.Fatal(err)
	}
	if c := color.NRGBAModel.Convert(img.At(25, 7)).(color.NRGBA); c != attentionInk {
		t.Errorf("the dot's centre is %v", c)
	}
	if NeedsALook(api.Status{Missing: 1, Apps: []api.AppStatus{{Health: "unhealthy"}, {NotAnswering: "HTTP 502"}, {Health: "healthy"}}}) != 3 {
		t.Error("NeedsALook counts missing, unwell, and not answering apps")
	}
}
