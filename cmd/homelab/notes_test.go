package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/releases"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestUpdatesNotes(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:v2.32.0", Running: true, Project: "homelab_security", Service: "ntfy"}})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/binwiederhier/ntfy/releases" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{"tag_name": "v2.33.0", "html_url": "https://github.com/binwiederhier/ntfy/releases/tag/v2.33.0", "body": "## Features\r\n* Templates for **webhooks**"},
			{"tag_name": "v2.32.0"},
		})
	}))
	defer srv.Close()
	releases.API = srv.URL
	defer func() { releases.API = "http://127.0.0.1:1" }()

	root, _ := repoCopy(t)
	out := &bytes.Buffer{}
	h, err := newHomelab(&ui.UI{Out: out}, root)
	if err != nil {
		t.Fatal(err)
	}
	if err := h.updates(context.Background(), []string{"notes", "ntfy"}); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"ntfy: v2.32.0 → v2.33.0", "Features\n  - Templates for webhooks", "releases/tag/v2.33.0", "All releases: https://github.com/binwiederhier/ntfy/releases"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
	out.Reset()
	h.whatsNew(context.Background(), []string{"ntfy", "memos"})
	if got := out.String(); !strings.Contains(got, "ntfy: v2.32.0 → v2.33.0") || strings.Contains(got, "Memos") {
		t.Errorf("whatsNew:\n%s", got)
	}
	if err := h.updates(context.Background(), []string{"notes", "memos"}); err == nil || !strings.Contains(err.Error(), "not running") {
		t.Errorf("an app that is not running: %v", err)
	}
}
