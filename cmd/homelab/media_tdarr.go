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
	"net/http"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// tdarrClient reaches Tdarr's sign-up; tests replace it.
var tdarrClient = &http.Client{Timeout: 15 * time.Second}

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
