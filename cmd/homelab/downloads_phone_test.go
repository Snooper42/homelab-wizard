package main

import (
	"context"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/downloads"
)

// The Downloads card on a phone (arr item 6): a wall screen, which anyone
// walking past can read, gets it without what's being downloaded; the
// owner's phones get it whole. Not a household member's phone, which gets
// none of the homelab's cards.
func TestDownloadsOnAPhone(t *testing.T) {
	card := downloads.Card{Line: "Getting 1", Apps: true, Items: []downloads.Item{{Name: "A Film (2024)", App: "Radarr", State: downloads.Getting, Words: "42%"}}}
	got, ok := phoneDownloads(card).(downloads.Card)
	if !ok || got.Line != "Getting 1" || len(got.Items) != 1 || got.Items[0].Name != "" || got.Items[0].Words != "42%" {
		t.Errorf("wall screen's card: %+v", got)
	}
	wall := companion.WithCaller(context.Background(), companion.Device{ID: "w1", Name: "Hall screen", Kiosk: true})
	phone := companion.WithCaller(context.Background(), companion.Device{ID: "p1", Name: "Phone"})
	if !kiosk(wall) || kiosk(phone) || kiosk(context.Background()) {
		t.Error("kiosk: a wall screen is one, a phone and the computer aren't")
	}
	h := &homelab{root: t.TempDir()}
	m, ok := h.phoneMethods()["Downloads"]
	if !ok || m.Member || m.Change {
		t.Errorf("Downloads: %+v (a look-only call for the owner's phones and wall screens)", m)
	}
}
