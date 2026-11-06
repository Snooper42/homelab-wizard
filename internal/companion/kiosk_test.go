package companion

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

// N26: a wall screen stays one. Pairing as a screen takes away changes and
// Finances, as anyone walking past could use them; the Phones page must not
// give them back later, though it may show the money card.
func TestAWallScreenStaysOne(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	h := (&Server{Store: store}).Handler()
	code, err := store.NewPairing("Kitchen screen", true, FinancesEdit)
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodPost, "/api/pair", strings.NewReader(`{"code":"`+code+`","kiosk":true}`))
	r.RemoteAddr = "127.0.0.1:52000" // encrypted: Tailscale Serve on this machine
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	var out struct{ Device Me }
	if err := json.NewDecoder(w.Body).Decode(&out); err != nil || w.Code != 200 {
		t.Fatalf("pair: %d %v", w.Code, err)
	}
	if out.Device.CanChange || out.Device.Finances != "" {
		t.Fatalf("a screen paired with %+v", out.Device)
	}
	id := out.Device.ID
	if _, err := store.SetCanChange(id, true); !errors.Is(err, ErrKiosk) {
		t.Errorf("a wall screen was allowed changes: %v", err)
	}
	for _, level := range []string{FinancesView, FinancesEdit} {
		if _, err := store.SetFinances(id, level); !errors.Is(err, ErrKiosk) {
			t.Errorf("a wall screen was given Finances %s: %v", level, err)
		}
	}
	if d, err := store.SetFinances(id, FinancesCard); err != nil || d.Finances != FinancesCard {
		t.Errorf("the money card on a wall screen: %+v %v", d, err)
	}
	if d := store.Devices()[0]; !d.Kiosk || d.CanChange || d.Finances != FinancesCard {
		t.Errorf("the screen is kept as %+v", d)
	}
}
