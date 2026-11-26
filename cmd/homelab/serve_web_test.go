package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// The web page's methods (serve_web.go): what changes needs a device allowed to change things, passwords and keys go
// over https only, and the phone's own answer wins where both serve one.
func TestWebMethods(t *testing.T) {
	root, _ := repoCopy(t, "NPM_API_PASSWORD=hunter2hunter2", "TZ=Europe/Lisbon", "PHONE_COMPANION=true")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	web := h.webMethods()
	for _, name := range []string{"CrashSeen", "MarkKept", "CopySetting", "CopyAppKey", "SendToPhone", "RecoveryKit"} {
		if !web[name].Change {
			t.Errorf("%s changes something or hands out a secret: only a device allowed to change things may call it", name)
		}
	}
	for _, name := range []string{"Kept", "Unkept", "MarkKept", "CopySetting", "CopyAppKey", "People", "RecoveryKit"} {
		if !web[name].Private {
			t.Errorf("%s is about passwords or the household: over https only", name)
		}
	}
	for name, m := range web {
		if m.Member {
			t.Errorf("%s is the owner's alone", name)
		}
	}
	all := h.servedMethods()
	for name := range h.phoneMethods() {
		if _, ok := all[name]; !ok {
			t.Errorf("the phone's %s is no longer served", name)
		}
	}
	call := func(name string, args ...any) (any, error) {
		t.Helper()
		var raw []json.RawMessage
		for _, a := range args {
			b, _ := json.Marshal(a)
			raw = append(raw, b)
		}
		v, _, err := all[name].Call(context.Background(), raw)
		return v, err
	}
	if v, err := call("CopySetting", "NPM_API_PASSWORD"); err != nil || v != "hunter2hunter2" {
		t.Errorf("CopySetting of a saved password: %v, %v", v, err)
	}
	if _, err := call("CopySetting", "TZ"); err == nil {
		t.Error("CopySetting handed out a setting that is not a secret")
	}
	if _, err := call("MarkKept", "NPM_API_PASSWORD", true); err != nil {
		t.Fatal(err)
	}
	if v, _ := call("Kept"); !v.(map[string]bool)["NPM_API_PASSWORD"] {
		t.Errorf("ticked Saved, Kept says %v", v)
	}
	if _, err := call("QR", "javascript:alert(1)"); err == nil {
		t.Error("QR made a code of something that is not a web address")
	}
	if v, err := call("QR", "https://todo.example.com"); err != nil || !strings.HasPrefix(v.(string), "data:image/svg+xml") {
		t.Errorf("QR: %.40v, %v", v, err)
	}
	if v, err := call("People"); err != nil || v == nil {
		t.Errorf("People with no household yet: %v, %v", v, err)
	}
}
