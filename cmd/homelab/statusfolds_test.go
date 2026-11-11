package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/statusfolds"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// The groups folded on Status, from a phone (the owner, Nov 10: folds sync): reading them is the owner's phones'
// to look at; saving them is a change, so a phone that only looks, a wall screen and a member's phone keep their own;
// what one saves, the next reads, and the app's record is the same.
func TestStatusFoldsFromAPhone(t *testing.T) {
	fakeDocker(t, nil)
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	methods := h.phoneMethods()
	if m := methods["StatusFolds"]; m.Call == nil || m.Change || m.Member {
		t.Fatalf("StatusFolds is the owner's phones', to look at: %+v", m)
	}
	if m := methods["SetStatusFolds"]; m.Call == nil || !m.Change || m.Member {
		t.Fatalf("SetStatusFolds is a change, the owner's phones' only: %+v", m)
	}
	ctx := companion.WithCaller(context.Background(), companion.Device{ID: "a1", Name: "Sam's iPhone", CanChange: true})
	arg, _ := json.Marshal(map[string]bool{"Media": false, "Photos": true})
	if _, _, err := methods["SetStatusFolds"].Call(ctx, []json.RawMessage{arg}); err != nil {
		t.Fatal(err)
	}
	if got := statusfolds.Load(root); len(got) != 2 || got["Media"] || !got["Photos"] {
		t.Fatalf("kept: %v", got)
	}
	v, _, err := methods["StatusFolds"].Call(ctx, nil)
	if read, _ := json.Marshal(v); err != nil || string(read) != `{"Media":false,"Photos":true}` {
		t.Fatalf("read back: %s %v", read, err)
	}
	for _, bad := range []string{``, `"Media"`, `{"":true}`} {
		var args []json.RawMessage
		if bad != "" {
			args = []json.RawMessage{json.RawMessage(bad)}
		}
		if _, _, err := methods["SetStatusFolds"].Call(ctx, args); err == nil {
			t.Errorf("saved %q", bad)
		}
	}
}
