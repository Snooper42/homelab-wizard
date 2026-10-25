package progress

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

func tracker(t *testing.T) *Tracker {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	return New(c, map[string]string{"GHOSTFOLIO_DB_VERSION": "17"})
}

// feed reads lines and returns each app's last update, and the log lines.
func feed(tr *Tracker, lines ...string) (map[string]Update, []string) {
	last, log := map[string]Update{}, []string{}
	for _, l := range lines {
		ups, text := tr.Line(l)
		for _, u := range ups {
			last[u.App] = u
		}
		if text != "" {
			log = append(log, text)
		}
	}
	return last, log
}

// The JSON Compose 5 prints for docker compose --progress json up (taken
// from a real run, with the homelab's names).
func TestJSONProgress(t *testing.T) {
	tr := tracker(t)
	last, log := feed(tr,
		`{"id":"Image deluan/navidrome:latest","status":"Working","text":"Pulling"}`,
		`{"id":"39c2ddfd6010","parent_id":"Image deluan/navidrome:latest","status":"Working","text":"Pulling fs layer","details":"0B"}`,
		`{"id":"d7e507024086","parent_id":"Image deluan/navidrome:latest","status":"Working","text":"Pulling fs layer","details":"0B"}`,
		`{"id":"39c2ddfd6010","parent_id":"Image deluan/navidrome:latest","status":"Working","text":"Downloading","details":"8.389MB","current":8388608,"total":15522356,"percent":54}`,
	)
	if u := last["navidrome"]; u.Stage != "downloading" || u.Percent != 27 || u.Words != "Downloading · 27%" || u.Name != "Navidrome" {
		t.Fatalf("halfway through one of two layers: %+v", u)
	}
	if len(log) != 1 || log[0] != "Image deluan/navidrome:latest Pulling" {
		t.Errorf("the log leaves out each layer: %q", log)
	}
	last, _ = feed(tr,
		`{"id":"d7e507024086","parent_id":"Image deluan/navidrome:latest","status":"Done","text":"Download complete","details":"0B","percent":100}`,
		`{"id":"39c2ddfd6010","parent_id":"Image deluan/navidrome:latest","status":"Done","text":"Download complete","details":"0B","percent":100}`,
		`{"id":"Image deluan/navidrome:latest","status":"Done","text":"Pulled"}`,
		`{"id":"Network homelab","status":"Done","text":"Created"}`,
		`{"id":"Container homelab_media-navidrome-1","status":"Working","text":"Creating"}`,
		`{"id":"Container homelab_media-navidrome-1","status":"Working","text":"Starting"}`,
		`{"id":"Container homelab_media-navidrome-1","status":"Done","text":"Started"}`,
	)
	if u := last["navidrome"]; u.Stage != "running" || !u.Done || u.Words != "Running" {
		t.Errorf("started: %+v", u)
	}
	if _, ok := last["homelab"]; ok {
		t.Error("a network is not an app")
	}
}

func TestPlainProgress(t *testing.T) {
	tr := tracker(t)
	last, log := feed(tr,
		" Image deluan/navidrome:latest Pulling ",
		" 39c2ddfd6010 Downloading [====>      ]  8.389MB/15.52MB",
		" Container homelab_media-navidrome-1 Recreate",
		" Container homelab_media-navidrome-1 Recreated",
		" Container homelab_media-navidrome-1 Starting",
	)
	if u := last["navidrome"]; u.Stage != "starting" || u.Done || u.Percent != -1 {
		t.Errorf("starting: %+v", u)
	}
	if len(log) != 4 {
		t.Errorf("the layer's line is left out of the log: %q", log)
	}
	// Older Compose names the service while pulling.
	if last, _ = feed(tr, " sonarr Pulling"); last["sonarr"].Stage != "downloading" {
		t.Errorf("older Compose: %+v", last["sonarr"])
	}
}

func TestImageSharedAndInterpolated(t *testing.T) {
	tr := tracker(t)
	for _, img := range []string{"postgres:17", "docker.io/library/postgres:17"} {
		last, _ := feed(tr, `{"id":"Image `+img+`","status":"Working","text":"Pulling"}`)
		if last["ghostfolio-db"].Stage != "downloading" {
			t.Errorf("docker.io/library/postgres:${GHOSTFOLIO_DB_VERSION:-17} as %s: %+v", img, last)
		}
	}
}

func TestFailureNamesTheApp(t *testing.T) {
	tr := tracker(t)
	last, log := feed(tr, `{"error":true,"message":"Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint homelab_media-navidrome-1 (9573036f1c40): Bind for 127.0.0.1:4533 failed: port is already allocated"}`,
		`{"level":"warning","msg":"Found orphan containers (old-1) for this project."}`)
	if u := last["navidrome"]; !u.Failed || !strings.Contains(u.Words, "port is already allocated") {
		t.Errorf("failed: %+v", u)
	}
	if len(log) != 2 || !strings.HasPrefix(log[0], "Error response from daemon") || !strings.HasPrefix(log[1], "Found orphan") {
		t.Errorf("errors and warnings read as text: %q", log)
	}
}

func TestDownloadEndAfterStartChangesNothing(t *testing.T) {
	tr := tracker(t)
	feed(tr, " Container homelab_media-navidrome-1 Started")
	if last, _ := feed(tr, " Image deluan/navidrome:latest Pulled"); len(last) != 0 {
		t.Errorf("a late Pulled moved a running app back: %+v", last)
	}
}
