package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
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

// Adding apps from the web page (serve_web_install.go): a device allowed to change things, over https (the form's
// passwords go through it), and the selection is apps or sets, never a flag for the command it runs.
func TestWebInstallMethods(t *testing.T) {
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	m := h.webInstallMethods()
	for _, name := range []string{"Plan", "Install", "AddCustom", "Wire", "WireSeerr", "FixQbitPassword"} {
		if !m[name].Change {
			t.Errorf("%s: only a device allowed to change things", name)
		}
	}
	for _, name := range []string{"Plan", "Install", "WireSeerr"} {
		if !m[name].Private {
			t.Errorf("%s carries passwords: over https only", name)
		}
	}
	raw := func(v ...any) []json.RawMessage {
		var out []json.RawMessage
		for _, x := range v {
			b, _ := json.Marshal(x)
			out = append(out, b)
		}
		return out
	}
	if _, _, err := installArgs(raw([]string{"--root=/"}, nil)); err == nil {
		t.Error("a flag passed as an app")
	}
	if tokens, set, err := installArgs(raw([]string{"jellyfin", "media"}, map[string]string{"TZ": "Europe/Lisbon"})); err != nil || len(tokens) != 2 || set["TZ"] != "Europe/Lisbon" {
		t.Errorf("installArgs: %v %v %v", tokens, set, err)
	}
	if _, _, err := installArgs(raw([]string{"jellyfin"})); err != nil {
		t.Errorf("no settings typed: %v", err)
	}
	if err := h.runSelfJSON(context.Background(), time.Second, map[string]string{"X": "a\nB=b"}, func(jsonLine) {}, func(string) {}, "plan"); err == nil || !strings.Contains(err.Error(), "one line") {
		t.Errorf("a setting with a line break would set another: %v", err)
	}
	if all := h.servedMethods(); all["Install"].Stream == nil || all["Wire"].Stream == nil {
		t.Error("Install and Connect apps stream their progress")
	}
}

// Settings and Phones on the web page (serve_web_settings.go): the computer's powers, each for a device allowed to
// change things over https (and only at home: companion.Server.AtHome); a phone paired, given more, and removed.
func TestWebSettingsMethods(t *testing.T) {
	root, _ := repoCopy(t, "PHONE_COMPANION=true")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	phones := h.webPhoneMethods()
	for name, m := range phones {
		if !m.Change || !m.Private || m.Member {
			t.Errorf("%s: the owner's device allowed to change things, over https: %+v", name, m)
		}
	}
	for _, name := range []string{"PersonAction", "OpenWelcome"} {
		if m := h.webSettingsMethods()[name]; !m.Change || !m.Private {
			t.Errorf("%s: a device allowed to change things, over https", name)
		}
	}
	call := func(name string, args ...any) (any, error) {
		t.Helper()
		var raw []json.RawMessage
		for _, a := range args {
			b, _ := json.Marshal(a)
			raw = append(raw, b)
		}
		v, _, err := phones[name].Call(context.Background(), raw)
		return v, err
	}
	v, err := call("PairPhone", "Sam's iPhone", false, "")
	if err != nil {
		t.Fatal(err)
	}
	if p := v.(webPairing); p.Code == "" {
		t.Fatalf("no code: %+v", p)
	}
	if _, _, err := h.webSettingsMethods()["PersonAction"].Call(context.Background(), nil); err == nil {
		t.Error("PersonAction with nothing")
	}
	if _, _, err := h.webSettingsMethods()["PersonAction"].Call(context.Background(), []json.RawMessage{json.RawMessage(`"add"`), json.RawMessage(`"--root=/"`)}); err == nil {
		t.Error("a flag taken as a name")
	}
	if _, _, err := h.webSettingsMethods()["OpenWelcome"].Call(context.Background(), []json.RawMessage{json.RawMessage(`"../../etc/passwd"`)}); err == nil {
		t.Error("a path taken as a person")
	}
	if got := (webUninstall{Data: true, App: true}).args(); strings.Join(got, " ") != "uninstall --data --app" {
		t.Errorf("uninstall's flags: %v", got)
	}
}

// Finances on the web page (serve_web_finances.go): reading the apps and a logo change Finances, so a device that may
// change them; the calendar's link for one that may see them; never a member's.
func TestWebFinanceMethods(t *testing.T) {
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	m := h.webFinanceMethods()
	for _, name := range []string{"FinancesFromFirefly", "FinancesFromWallos", "FinancesFromGhostfolio", "FinancesFetchLogo"} {
		if m[name].Finances != companion.FinancesEdit || m[name].Member {
			t.Errorf("%s: a device that may change Finances, the owner's: %+v", name, m[name])
		}
	}
	if m["FinancesCalendar"].Finances != companion.FinancesView {
		t.Error("the calendar's link: a device that may see Finances")
	}
	if _, _, err := m["FinancesFromWallos"].Call(context.Background(), nil); err == nil || !strings.Contains(err.Error(), "WALLOS_API_KEY") {
		t.Errorf("Wallos with no key says so: %v", err)
	}
}
