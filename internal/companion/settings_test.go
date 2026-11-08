package companion

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// The Settings form (Private methods) goes only over the https link, never
// to a wall screen; a phone allowed only to look reads it and saves nothing.
func TestSettingsGoOnlyOverHTTPSAndNeverToAWallScreen(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	saved := 0
	h := (&Server{Store: store, Methods: map[string]Method{
		"Settings": {Private: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			return "the form", nil, nil
		}},
		"SaveSettings": {Change: true, Private: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			saved++
			return nil, nil, nil
		}},
	}}).Handler()
	do := func(path, body, token string, encrypted bool) (int, map[string]any) {
		t.Helper()
		r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		r.RemoteAddr = "192.168.1.20:52000"
		if encrypted {
			r.Header.Set("X-Forwarded-Proto", "https")
		}
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		var out map[string]any
		_ = json.NewDecoder(w.Body).Decode(&out)
		return w.Code, out
	}
	pair := func(name string, canChange, kiosk bool) string {
		t.Helper()
		code, err := store.NewPairing(name, canChange, "")
		if err != nil {
			t.Fatal(err)
		}
		status, out := do("/api/pair", `{"code":"`+code+`","kiosk":`+strconv.FormatBool(kiosk)+`}`, "", true)
		if status != 200 {
			t.Fatalf("pair %s: %d %v", name, status, out)
		}
		return out["token"].(string)
	}
	said := func(out map[string]any) string { s, _ := out["error"].(string); return s }

	changer, looker, screen := pair("Anna's iPhone", true, false), pair("Ben's iPhone", false, false), pair("Hall screen", false, true)
	if status, out := do("/api/call/Settings", "[]", changer, true); status != 200 || out["result"] != "the form" {
		t.Errorf("Settings over https: %d %v", status, out)
	}
	if status, out := do("/api/call/SaveSettings", "[{}]", changer, true); status != 200 || saved != 1 {
		t.Errorf("a save from a phone allowed changes: %d %v", status, out)
	}
	if status, out := do("/api/call/Settings", "[]", looker, true); status != 200 {
		t.Errorf("Settings to a phone allowed only to look: %d %v", status, out)
	}
	if status, out := do("/api/call/SaveSettings", "[{}]", looker, true); status != 403 || saved != 1 {
		t.Errorf("a save from a phone allowed only to look: %d %v", status, out)
	}
	if status, out := do("/api/call/Settings", "[]", looker, false); status != 403 || !strings.Contains(said(out), "https link") {
		t.Errorf("Settings over the home Wi-Fi's plain HTTP: %d %v", status, out)
	}
	if status, out := do("/api/call/Settings", "[]", screen, true); status != 403 || !strings.Contains(said(out), "wall screen") {
		t.Errorf("Settings to a wall screen: %d %v", status, out)
	}
}
