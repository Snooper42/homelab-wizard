package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// fakeTdarr is Tdarr's API for the battery saver: one node, its transcode
// workers' limit, and whether a worker is on a file; it keeps the limit
// changes it was sent. down: it doesn't answer.
type fakeTdarr struct {
	mu      sync.Mutex
	limit   int
	working bool
	down    bool
	changes []string
}

func (f *fakeTdarr) serve(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		if f.down {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		if r.Header.Get("x-api-key") != "tdarr-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch r.URL.Path {
		case "/api/v2/get-nodes":
			workers := map[string]any{}
			if f.working {
				workers["w1"] = map[string]any{"file": "/media/tv/Show/S01E04.mkv", "percentage": 40}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"n1": map[string]any{"nodeName": "homelab",
				"workerLimits": map[string]any{"transcodecpu": f.limit, "transcodegpu": 0, "healthcheckcpu": 1}, "workers": workers}})
		case "/api/v2/alter-worker-limit":
			var b struct {
				Data struct{ NodeID, Process, WorkerType string } `json:"data"`
			}
			_ = json.NewDecoder(r.Body).Decode(&b)
			if b.Data.NodeID != "n1" || b.Data.WorkerType != "transcodecpu" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			if b.Data.Process == "decrease" {
				f.limit--
			} else {
				f.limit++
			}
			f.changes = append(f.changes, b.Data.Process)
			_, _ = w.Write([]byte("OK"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	_, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	return port
}

// Nov 8, the owner: 81 GB of half-made copies in Tdarr's cache, each left
// when the battery saver stopped Tdarr in the middle of a video. Unplugged
// while Tdarr converts one, the other heavy apps pause at once, but Tdarr
// takes no new file (its workers held at nought) and finishes the one it
// has; once it's idle it pauses too; plugged in again, it starts and gets
// its workers back. A Tdarr that doesn't answer is stopped as before.
func TestBatterySaverLetsTdarrFinishItsVideo(t *testing.T) {
	on := true
	battery.Power = func() (bool, bool) { return on, true }
	t.Cleanup(func() { battery.Power = func() (bool, bool) { return false, false } })
	td := &fakeTdarr{limit: 2, working: true}
	root, _ := repoCopy(t, "TDARR_PORT="+td.serve(t), "TDARR_API_KEY=tdarr-key")
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	saver := func(sonarr, tdarr bool) string {
		t.Helper()
		calls := fakeDocker(t, []docker.FakeContainer{
			{Name: "homelab_media_automation-sonarr-1", Image: "x", Running: sonarr, Health: "healthy", Project: "homelab_media_automation", Service: "sonarr"},
			{Name: "homelab_media_automation-tdarr-1", Image: "x", Running: tdarr, Health: "healthy", Project: "homelab_media_automation", Service: "tdarr"},
		})
		client, err := h.docker(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		containers, _ := client.Containers(context.Background())
		h.batterySaver(context.Background(), client, containers)
		return readCalls(t, calls)
	}
	path := battery.Path(root)

	// Unplugged mid-video: Sonarr stops, Tdarr finishes.
	log := saver(true, true)
	if !strings.Contains(log, "stop sonarr") || strings.Contains(log, "tdarr") {
		t.Fatalf("unplugged mid-video:\n%s", log)
	}
	st := battery.Load(path)
	if !slices.Equal(st.Paused, []string{"sonarr"}) || !slices.Equal(st.Finishing, []string{"tdarr"}) || st.Held["n1/transcodecpu"] != 2 || td.limit != 0 {
		t.Fatalf("after unplugging: %+v, Tdarr's limit %d", st, td.limit)
	}

	// Still on the video: left alone.
	if log := saver(false, true); strings.Contains(log, "stop") {
		t.Fatalf("stopped mid-video:\n%s", log)
	}

	// Done with it: paused too.
	td.working = false
	if log := saver(false, true); !strings.Contains(log, "stop tdarr") {
		t.Fatalf("idle Tdarr not paused:\n%s", log)
	}
	if st := battery.Load(path); !slices.Equal(st.Paused, []string{"sonarr", "tdarr"}) || len(st.Finishing) != 0 || st.Held["n1/transcodecpu"] != 2 {
		t.Fatalf("after it finished: %+v", st)
	}

	// Plugged in: both start, Tdarr's two workers come back.
	on = false
	if log := saver(false, false); !strings.Contains(log, "start") || !strings.Contains(log, "sonarr") || !strings.Contains(log, "tdarr") {
		t.Fatalf("plugged in:\n%s", log)
	}
	if td.limit != 2 || !slices.Equal(td.changes, []string{"decrease", "decrease", "increase", "increase"}) {
		t.Errorf("Tdarr's workers: limit %d, changes %v", td.limit, td.changes)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("nothing left to undo, yet the record stayed: %+v", battery.Load(path))
	}

	// A Tdarr that doesn't answer can't be converting: stopped at once, as before.
	on, td.down, td.working = true, true, true
	if log := saver(true, true); !strings.Contains(log, "tdarr") || !strings.Contains(log, "sonarr") {
		t.Fatalf("unanswering Tdarr:\n%s", log)
	}
	if st := battery.Load(path); !slices.Equal(st.Paused, []string{"sonarr", "tdarr"}) || len(st.Finishing) != 0 || st.Held != nil {
		t.Errorf("unanswering Tdarr: %+v", st)
	}
}
