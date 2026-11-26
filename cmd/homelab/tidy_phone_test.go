package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/core"
)

// Lane D, D4: Tidy Up on a phone is one look-only call, for the owner's phones only (the owner, Nov 26): not a
// household member's, nor a wall screen; and no call a phone may make is Tidy Up's moving, undoing or deleting.
func TestTidyOnAPhone(t *testing.T) {
	h := &homelab{root: t.TempDir()}
	methods := h.phoneMethods()
	m, ok := methods["TidyOverview"]
	if !ok || m.Member || m.Change {
		t.Fatalf("TidyOverview: %+v (a look-only call for the owner's phones)", m)
	}
	for name := range methods {
		if strings.HasPrefix(name, "Tidy") && name != "TidyOverview" {
			t.Errorf("a phone may call %s", name)
		}
	}
	wall := companion.WithCaller(context.Background(), companion.Device{ID: "w1", Name: "Hall screen", Kiosk: true})
	if v, _, err := m.Call(wall, nil); err == nil {
		t.Errorf("a wall screen reads Tidy Up: %+v", v)
	}
	phone := companion.WithCaller(context.Background(), companion.Device{ID: "p1", Name: "Phone"})
	v, _, err := m.Call(phone, nil)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(v)
	var o core.Tidy
	if err := json.Unmarshal(data, &o); err != nil || o.Today == nil || len(o.Libraries) == 0 {
		t.Errorf("%s %v", data, err)
	}
}
