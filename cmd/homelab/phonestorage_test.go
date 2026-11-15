package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/storage"
)

// A phone gets what each app's folder takes, never whose photos take what:
// the household's names and email addresses stay on the computer, whether
// the card was read here or came from the agent as JSON.
func TestPhoneStorageKeepsPeopleOff(t *testing.T) {
	when := time.Date(2026, 11, 15, 3, 0, 0, 0, time.UTC)
	rec := storage.Record{
		When:   when,
		Photos: []storage.Person{{Name: "Alex Example", Email: "alex@example.com", Bytes: 9 << 30}},
		Apps:   []storage.Folder{{App: "immich", Bytes: 12 << 30}, {App: "vikunja", Bytes: 40 << 20}},
	}
	fromAgent, _ := json.Marshal(rec)
	for name, data := range map[string]any{"read here": rec, "from the agent": json.RawMessage(fromAgent)} {
		out, err := json.Marshal(phoneStorage(data))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		got := string(out)
		for _, private := range []string{"Alex", "alex@example.com", "photos", "email"} {
			if strings.Contains(got, private) {
				t.Errorf("%s: %q reached the phone: %s", name, private, got)
			}
		}
		if !strings.Contains(got, `"app":"immich"`) || !strings.Contains(got, `"app":"vikunja"`) || !strings.Contains(got, `"when":"2026-11-15T03:00:00Z"`) {
			t.Errorf("%s: the apps' folders are missing: %s", name, got)
		}
	}
	// Something that isn't a reading becomes nothing rather than passing through.
	if out, _ := json.Marshal(phoneStorage("not a record")); string(out) != "null" {
		t.Errorf("not a record: %s", out)
	}
}
