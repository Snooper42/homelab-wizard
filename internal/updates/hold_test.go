package updates

import (
	"path/filepath"
	"testing"
	"time"
)

// Items 87 and 88: a new image waits its days from when it was first seen,
// a newer one starts its own wait, an app behind for MaxHold takes the
// newest, and an unknown digest holds nothing.
func TestTheShortHold(t *testing.T) {
	day := 24 * time.Hour
	t0 := time.Date(2026, 11, 12, 4, 0, 0, 0, time.UTC)
	local := []string{"vaultwarden/server@sha256:old"}
	h := Holds{}

	if take, _ := h.Decide("vaultwarden", 3, "sha256:old", local, t0); !take || len(h) != 0 {
		t.Fatalf("nothing new: take it as it is, waiting for nothing: %v %v", take, h)
	}
	take, until := h.Decide("vaultwarden", 3, "sha256:new1", local, t0)
	if take || !until.Equal(t0.Add(3*day)) {
		t.Fatalf("a release seen today waits 3 days: %v %v", take, until)
	}
	if take, _ := h.Decide("vaultwarden", 3, "sha256:new1", local, t0.Add(2*day)); take {
		t.Fatal("taken after 2 days")
	}
	if take, _ := h.Decide("vaultwarden", 3, "sha256:new1", local, t0.Add(3*day)); !take {
		t.Fatal("not taken after 3 days")
	}
	// Taken: the image here is that one, so it waits for nothing.
	if take, _ := h.Decide("vaultwarden", 3, "sha256:new1", []string{"vaultwarden/server@sha256:new1"}, t0.Add(3*day)); !take || len(h) != 0 {
		t.Fatalf("after the update: %v %v", take, h)
	}

	// A newer one on day 2 starts its own wait; releases every 2 days still
	// update once the app has been behind MaxHold.
	h = Holds{}
	for d := 0; d < 14; d += 2 {
		take, _ := h.Decide("crowdsec", 3, "sha256:r"+string(rune('a'+d)), local, t0.Add(time.Duration(d)*day))
		if take {
			t.Fatalf("taken on day %d, its release 0 days old", d)
		}
	}
	if take, _ := h.Decide("crowdsec", 3, "sha256:latest", local, t0.Add(14*day)); !take {
		t.Error("an app behind for 14 days still waits")
	}

	// Unknown digest, or no hold: as before.
	if take, _ := (Holds{}).Decide("pocket-id", 3, "", local, t0); !take {
		t.Error("an unread digest held the app")
	}
	if take, _ := (Holds{}).Decide("jellyfin", 0, "sha256:new", local, t0); !take {
		t.Error("an app with no hold was held")
	}

	// Kept between runs, the account's own.
	path := filepath.Join(t.TempDir(), "data", "update-holds.json")
	h = Holds{}
	h.Decide("vaultwarden", 3, "sha256:new1", local, t0)
	if err := h.Save(path); err != nil {
		t.Fatal(err)
	}
	if got := LoadHolds(path); !got["vaultwarden"].Seen.Equal(t0) || got.Waiting()[0] != "vaultwarden" {
		t.Errorf("read back: %+v", got)
	}
}
