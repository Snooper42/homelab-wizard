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
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
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
	base   string
	header http.Header
}

// tdarrAPI signs in to Tdarr as Tidy Up does: its key, else its login.
func (h *homelab) tdarrAPI(ctx context.Context) *tdarrAPI {
	env := h.envMap()
	t := &tdarrAPI{base: "http://127.0.0.1:" + cmp.Or(env["TDARR_PORT"], "8265"), header: http.Header{}}
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
	req, err := http.NewRequestWithContext(ctx, method, t.base+path, body)
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
