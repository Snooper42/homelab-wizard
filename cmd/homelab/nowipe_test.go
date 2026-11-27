package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// The owner, Nov 27, 2026: a phone or the web page must never be able to
// wipe the homelab, the apps' data, or the backups. Deleting them needs
// someone at the computer and the command's own confirmation. These tests
// hold that from three sides: no such method is served, no served code
// names a deleting command or flag, and the one action that could reach a
// volume refuses before it runs anything.
func TestNoWipeFromThePhone(t *testing.T) {
	root, _ := repoCopy(t, "PHONE_COMPANION=true")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	served := h.servedMethods()
	for name := range served {
		lower := strings.ToLower(name)
		for _, bad := range []string{"uninstall", "wipe", "erase", "deletedata", "deletebackup", "purge"} {
			if strings.Contains(lower, bad) {
				t.Errorf("%s is served to phones and the web page: deleting the homelab's data stays on the computer", name)
			}
		}
	}

	// Removing old containers' volumes deletes the data in them: refused,
	// with a reason, before any command is run.
	homelab := served["Homelab"]
	args := []json.RawMessage{json.RawMessage(`"cleanup"`), json.RawMessage(`"volumes"`), json.RawMessage(`true`)}
	_, log, err := homelab.Call(context.Background(), args)
	if err == nil || !strings.Contains(err.Error(), "on the computer") {
		t.Fatalf("cleanup --volumes from the web page: %v", err)
	}
	if len(log) > 0 {
		t.Errorf("a command ran before the refusal: %q", log)
	}
}

// What phones and the web page run is in cmd/homelab/serve*.go. None of it
// may name the commands or flags that delete data or backups, so adding one
// back is a test failure, not a review to remember.
func TestServedCodeNamesNoDeletingCommand(t *testing.T) {
	files, err := filepath.Glob("serve*.go")
	if err != nil || len(files) == 0 {
		t.Fatalf("no serve*.go files: %v", err)
	}
	deleting := regexp.MustCompile(`"(uninstall|--data|--backups|--volumes|--everything-else|--folder|prune)"`)
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		src, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for i, line := range strings.Split(string(src), "\n") {
			if m := deleting.FindString(line); m != "" {
				t.Errorf("%s:%d names %s, which deletes data or backups: that stays on the computer", f, i+1, m)
			}
		}
	}
}
