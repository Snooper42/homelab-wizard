package main

// Tdarr wants a sign-in (accounts are on in Tdarr 2.4x and after). Before a
// job that talks to Tdarr, a Tdarr with no account yet gets one made for
// Tidy Up: user homelab, a generated password, both kept in .env (Settings ›
// Tidy Up), the way Tdarr's own first sign-up makes one. One that has an
// account already is left as it is: its login goes in Settings.

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
)

// tdarrClient reaches Tdarr's sign-up; tests replace it.
var tdarrClient = &http.Client{Timeout: 15 * time.Second}

// tdarrStartWait is how long a Tdarr made again may take to answer with its
// key.
var tdarrStartWait = 90 * time.Second

// tdarrJob is whether kind's action talks to Tdarr.
func tdarrJob(kind, action string) bool {
	return kind == "tdarr" || (kind == "movies" || kind == "tv") && (action == "run" || action == "collect")
}

// tdarrAccount makes Tdarr's first account for Tidy Up when the homelab has
// no key or login for it, and Tdarr takes a sign-up (it has no account yet).
// Anything else (Tdarr not running, an account already there) changes
// nothing: the engine says what Tdarr wants then.
func (h *homelab) tdarrAccount(ctx context.Context, env map[string]string) {
	if env["TDARR_API_KEY"] != "" || env["TDARR_USER"] != "" {
		return
	}
	pw, err := envfile.NewSecret("TDARR_PASSWORD")
	if err != nil {
		return
	}
	body, _ := json.Marshal(map[string]string{"username": "homelab", "password": pw})
	url := "http://127.0.0.1:" + cmp.Or(env["TDARR_PORT"], "8265") + "/api/v2/public/auth/register"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := tdarrClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusForbidden {
		// Tdarr 3 takes no sign-up at all: it gets a key instead.
		h.tdarrKey(ctx, env)
		return
	}
	var got struct {
		Token string `json:"token"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&got) != nil || got.Token == "" {
		return
	}
	if h.setEnv("TDARR_USER", "homelab") != nil || h.setEnv("TDARR_PASSWORD", pw) != nil {
		return
	}
	env["TDARR_USER"], env["TDARR_PASSWORD"] = "homelab", pw
	h.ui.Info("Made Tdarr's account for Tidy Up: homelab (its password is in Settings › Tidy Up)")
}

// tdarrKey gives Tidy Up a key to Tdarr when Tdarr takes no sign-up (Tdarr 3
// answers every one 403): TDARR_API_KEY, in Tdarr's own key shape, kept in
// .env, and Tdarr made again so it reads it as its seededApiKey
// (compose/media-automation.yaml). It waits until Tdarr answers with it.
func (h *homelab) tdarrKey(ctx context.Context, env map[string]string) {
	a, ok := h.catalog.Get("tdarr")
	if !ok {
		return
	}
	client, err := h.docker(ctx)
	if err != nil {
		return
	}
	key, err := envfile.NewSecret("TDARR_API_KEY")
	if err != nil || h.setEnv("TDARR_API_KEY", key) != nil {
		return
	}
	env["TDARR_API_KEY"] = key
	if err := client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", "--force-recreate", a.ID); err != nil {
		h.ui.Warn("Tdarr: couldn't restart it to take its key for Tidy Up: %v", err)
		return
	}
	h.ui.Info("Gave Tdarr a key for Tidy Up (TDARR_API_KEY, in Settings › Tidy Up) and restarted it to take it")
	body := []byte(`{"data":{"collection":"LibrarySettingsJSONDB","mode":"getAll"}}`)
	url := "http://127.0.0.1:" + cmp.Or(env["TDARR_PORT"], "8265") + "/api/v2/cruddb"
	for deadline := time.Now().Add(tdarrStartWait); time.Now().Before(deadline); time.Sleep(2 * time.Second) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-api-key", key)
		if resp, err := tdarrClient.Do(req); err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
	}
}

// tdarrAPI is Tdarr's API on this machine, with Tidy Up's key or login,
// for the battery saver: whether Tdarr is converting a file, and its
// transcode workers held at nought while it finishes one, then given back.
type tdarrAPI struct {
	port   uint16
	header http.Header
}

// newTdarrAPI signs in to Tdarr as Tidy Up does, with the homelab's
// settings (env): its key, else its login.
func newTdarrAPI(ctx context.Context, env map[string]string) *tdarrAPI {
	// Only ever this machine: the port is read as a number, and the address
	// made from it alone.
	port, err := strconv.ParseUint(cmp.Or(env["TDARR_PORT"], "8265"), 10, 16)
	if err != nil || port == 0 {
		port = 8265
	}
	t := &tdarrAPI{port: uint16(port), header: http.Header{}}
	if key := env["TDARR_API_KEY"]; key != "" {
		t.header.Set("x-api-key", key)
	} else if env["TDARR_USER"] != "" {
		var got struct {
			Token string `json:"token"`
		}
		if t.do(ctx, http.MethodPost, "/api/v2/public/auth/login", nil, map[string]string{"username": env["TDARR_USER"], "password": env["TDARR_PASSWORD"]}, &got) == nil && got.Token != "" {
			t.header.Set("Authorization", "Bearer "+got.Token)
		}
	}
	return t
}

// do sends one call: data wrapped as Tdarr's API wants it ({"data": …}),
// or raw sent as it is.
func (t *tdarrAPI) do(ctx context.Context, method, path string, data, raw, out any) error {
	var body io.Reader
	switch {
	case data != nil:
		b, _ := json.Marshal(map[string]any{"data": data})
		body = bytes.NewReader(b)
	case raw != nil:
		b, _ := json.Marshal(raw)
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, fmt.Sprintf("http://127.0.0.1:%d%s", t.port, path), body)
	if err != nil {
		return err
	}
	req.Header = t.header.Clone()
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := tdarrClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Tdarr answered %s", resp.Status)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// tdarrNode is one of Tdarr's nodes: its workers on a file now, and how
// many of each kind it may run.
type tdarrNode struct {
	Workers      map[string]json.RawMessage `json:"workers"`
	WorkerLimits map[string]any             `json:"workerLimits"`
}

func (n tdarrNode) limit(kind string) int {
	f, _ := n.WorkerLimits[kind].(float64)
	return int(f)
}

func (t *tdarrAPI) nodes(ctx context.Context) (map[string]tdarrNode, error) {
	var nodes map[string]tdarrNode
	err := t.do(ctx, http.MethodGet, "/api/v2/get-nodes", nil, nil, &nodes)
	return nodes, err
}

// busy reports whether any node is converting a file; ok is false when
// Tdarr doesn't answer (and so can't be converting one).
func (t *tdarrAPI) busy(ctx context.Context) (busy, ok bool) {
	nodes, err := t.nodes(ctx)
	if err != nil {
		return false, false
	}
	for _, n := range nodes {
		if len(n.Workers) > 0 {
			return true, true
		}
	}
	return false, true
}

// tdarrTranscode are the worker kinds that convert files (the health checks
// are light, and left as they are).
var tdarrTranscode = []string{"transcodecpu", "transcodegpu"}

// hold lowers each node's transcode workers to nought, one at a time as
// Tdarr's API takes them: it starts no new file and finishes the ones it
// has. What it lowered, by "node/kind", to give back.
func (t *tdarrAPI) hold(ctx context.Context) map[string]int {
	held := map[string]int{}
	nodes, err := t.nodes(ctx)
	if err != nil {
		return held
	}
	for id, n := range nodes {
		for _, kind := range tdarrTranscode {
			for range n.limit(kind) {
				if t.do(ctx, http.MethodPost, "/api/v2/alter-worker-limit", map[string]string{"nodeID": id, "process": "decrease", "workerType": kind}, nil, nil) != nil {
					break
				}
				held[id+"/"+kind]++
			}
		}
	}
	return held
}

// giveBack raises the workers hold lowered; false when Tdarr doesn't
// answer yet (just started), for a later run.
func (t *tdarrAPI) giveBack(ctx context.Context, held map[string]int) bool {
	for key, n := range held {
		id, kind, _ := strings.Cut(key, "/")
		for range n {
			if t.do(ctx, http.MethodPost, "/api/v2/alter-worker-limit", map[string]string{"nodeID": id, "process": "increase", "workerType": kind}, nil, nil) != nil {
				return false
			}
			held[key]--
		}
		delete(held, key)
	}
	return true
}

// Tdarr rests while it has nothing to do (the owner, Nov 9: memory on a
// 16GB Mac). It does only what Tidy Up hands it (its libraries scan nothing
// on their own), so once no film or episode is with it and no job has
// needed it for a while, the agent stops it and notes it in
// data/stopped.json as Tidy Up's ("tidy"), which everything that starts
// apps by itself skips. A job that needs it starts it first. Someone who
// starts it meanwhile keeps it up until a job next uses it; a stop made by
// a person is never undone here. TIDY_TDARR_REST=false keeps it up.

// whyTidy is Tidy Up's stop of a resting Tdarr in data/stopped.json.
const whyTidy = "tidy"

// tdarrRestAfter is how long after the last job that needed Tdarr it rests.
var tdarrRestAfter = 15 * time.Minute

// needsTdarr is whether a run may hand Tdarr work or ask it something:
// Tdarr's own jobs, filing a film or episode (a bloated one goes through
// Tdarr first), and an inbox sweep with a video to file. inboxVideo is
// asked only for that sweep.
func needsTdarr(kind, action string, apply bool, rest []string, inboxVideo func() bool) bool {
	switch {
	case tdarrJob(kind, action):
		return true
	case (kind == "movies" || kind == "tv") && action == "file":
		return true
	case kind == "inbox" && action == "name":
		return len(rest) > 1 && (rest[1] == "movie" || rest[1] == "episode")
	case kind == "inbox" && action == "scan" && apply:
		return inboxVideo()
	}
	return false
}

// tdarrAnswers is whether Tdarr's server answers at all on this machine
// (one asking for a sign-in is up).
func tdarrAnswers(ctx context.Context, env map[string]string) bool {
	t := newTdarrAPI(ctx, map[string]string{"TDARR_PORT": env["TDARR_PORT"]}) // no key nor login: whether it answers at all
	err := t.do(ctx, http.MethodGet, "/api/v2/status", nil, nil, nil)
	return err == nil || strings.Contains(err.Error(), "answered 4")
}

// useTdarr is called before and after a job that needs Tdarr: a resting
// Tdarr is started first (say tells the household), and the job counts as
// Tidy Up's use of it, so it rests only a while after.
func (h *homelab) useTdarr(ctx context.Context, say func(string)) {
	h.wakeTdarr(ctx, say)
	rec := media.LoadRecord(h.root)
	rec.TdarrUsed, rec.TdarrLeftUp = time.Now().UTC(), false
	_ = rec.Save(h.root)
}

// wakeTdarr starts a Tdarr that Tidy Up rested, and waits until it answers.
// One that won't start stays as it was: the job then says Tdarr isn't
// answering, as it would of any stopped Tdarr.
func (h *homelab) wakeTdarr(ctx context.Context, say func(string)) {
	path := stopped.Path(h.root)
	if s, ok := stopped.Load(path)["tdarr"]; !ok || s.Why != whyTidy {
		return
	}
	// On battery the saver would pause it again: it rests until power, as
	// a Tdarr the saver paused does.
	if onBattery, known := battery.Power(); known && onBattery && !strings.EqualFold(h.envMap()["BATTERY_SAVER"], "false") {
		return
	}
	a, ok := h.catalog.Get("tdarr")
	if !ok {
		return
	}
	client, err := h.docker(ctx)
	if err != nil {
		return
	}
	say("Starting Tdarr, which was resting")
	if err := client.Compose(ctx, h.project(a.File), a.Profiles, "start", a.ID); err != nil {
		say(fmt.Sprintf("Tdarr didn't start: %v", err))
		return
	}
	_ = stopped.Update(path, func(r stopped.Record) bool {
		if s, ok := r["tdarr"]; ok && s.Why == whyTidy {
			delete(r, "tdarr")
			return true
		}
		return false
	})
	rec := media.LoadRecord(h.root)
	rec.TdarrResting = false
	_ = rec.Save(h.root)
	env := h.envMap()
	for deadline := time.Now().Add(tdarrStartWait); ctx.Err() == nil && time.Now().Before(deadline); time.Sleep(2 * time.Second) {
		if tdarrAnswers(ctx, env) {
			return
		}
	}
}

// restTdarr, from the agent's minute, stops the Tdarr Tidy Up uses when it
// has nothing to do: no film or episode with it, not converting, no job and
// no start for a while. One not set up for Tidy Up, one the battery saver
// has, or one a person stopped or started, is left as it is.
func (h *homelab) restTdarr(ctx context.Context, env map[string]string, home string, now time.Time) {
	if off(env["TIDY_TDARR_REST"]) || h.jobRunning() {
		return
	}
	path := stopped.Path(h.root)
	if stopped.Load(path).Has("tdarr") {
		return // resting already, or stopped by a person
	}
	rec := media.LoadRecord(h.root)
	// Only the Tdarr Tidy Up uses (Set up Tdarr made its libraries): one
	// installed for its own sake, or not set up yet, is left running.
	if !rec.TdarrResting && (len(rec.TdarrLibraries) == 0 || rec.TdarrLeftUp || now.Sub(rec.TdarrUsed) < tdarrRestAfter ||
		media.HasTdarrWork(home, "movies") || media.HasTdarrWork(home, "tv")) {
		return
	}
	if bs := battery.Load(battery.Path(h.root)); slices.Contains(bs.Paused, "tdarr") || slices.Contains(bs.Finishing, "tdarr") {
		return // the battery saver's, until it is plugged in
	}
	a, ok := h.catalog.Get("tdarr")
	if !ok {
		return
	}
	client, err := h.docker(ctx)
	if err != nil {
		return
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return
	}
	running := false
	if st, _ := detect.Analyze(h.catalog, containers).State("tdarr"); st == detect.Running {
		running = true
	}
	if rec.TdarrResting {
		// Out of data/stopped.json while Tidy Up had it resting: someone
		// started it (Status, its page) or said it's no longer stopped. Up
		// is theirs until a job next uses it.
		rec.TdarrResting, rec.TdarrLeftUp = false, running
		_ = rec.Save(h.root)
		return
	}
	if !running {
		return
	}
	// Just installed, started, or updated: up a while before it rests.
	for _, c := range containers {
		if c.Service() == "tdarr" && !c.StartedAt.IsZero() && now.Sub(c.StartedAt) < tdarrRestAfter {
			return
		}
	}
	if busy, ok := newTdarrAPI(ctx, env).busy(ctx); ok && busy {
		return
	}
	// In the record first, so nothing that starts apps starts it meanwhile.
	mine := stopped.Stop{Since: now.UTC().Truncate(time.Second), Why: whyTidy}
	added := false
	if err := stopped.Update(path, func(r stopped.Record) bool {
		if r.Has("tdarr") {
			return false
		}
		r["tdarr"], added = mine, true
		return true
	}); err != nil || !added {
		return
	}
	if err := client.Compose(ctx, h.project(a.File), a.Profiles, "stop", a.ID); err != nil {
		h.ui.Warn("Tdarr: couldn't stop it to rest: %v", err)
		_ = stopped.Update(path, func(r stopped.Record) bool {
			if s, ok := r["tdarr"]; ok && s.Why == whyTidy && s.Since.Equal(mine.Since) {
				delete(r, "tdarr")
				return true
			}
			return false
		})
		return
	}
	rec = media.LoadRecord(h.root)
	rec.TdarrResting = true
	_ = rec.Save(h.root)
	h.ui.Info("Tdarr is resting: Tidy Up starts it again when it has a video to shrink")
}
