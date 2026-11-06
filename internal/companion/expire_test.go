package companion

import (
	"path/filepath"
	"testing"
	"time"
)

func TestAccessThatExpires(t *testing.T) {
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	s := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	s.Now = func() time.Time { return now }
	pair := func(name string, change bool, money string) (Device, string) {
		code, err := s.NewPairing(name, change, money)
		if err != nil {
			t.Fatal(err)
		}
		d, token, err := s.Pair(code, "")
		if err != nil {
			t.Fatal(err)
		}
		return d, token
	}
	guest, token := pair("Guest's phone", true, FinancesEdit)
	screen, _ := pair("Kitchen screen", false, FinancesCard)

	if _, err := s.SetUntil(guest.ID, now.Add(7*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetUntil("kitchen screen", now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if d, ok := s.Lookup(token); !ok || !d.CanChange || d.Finances != FinancesEdit || !d.Until.Equal(now.Add(7*24*time.Hour)) {
		t.Fatalf("before its time: %+v", d)
	}
	if p := s.Phones(); p[0].Until.IsZero() {
		t.Error("Phones does not say until when")
	}

	// A week on: it only looks, and its token still works for that.
	now = now.Add(7*24*time.Hour + time.Second)
	d, ok := s.Lookup(token)
	if !ok || d.CanChange || d.Finances != "" || !d.Until.IsZero() {
		t.Fatalf("after its time: %+v %v", d, ok)
	}
	// The wall screen keeps its money card: never more than that.
	for _, d := range s.Devices() {
		if d.ID == screen.ID && (d.Finances != FinancesCard || !d.Until.IsZero()) {
			t.Errorf("the screen after its time: %+v", d)
		}
	}
	// Kept so: read again from the file, it has not come back.
	again := NewStore(s.Path)
	again.Now = s.Now
	if d := again.Devices()[0]; d.CanChange || d.Finances != "" {
		t.Errorf("came back from the file: %+v", d)
	}

	// Given more again, with no end: it keeps it.
	if _, err := s.SetCanChange(guest.ID, true); err != nil {
		t.Fatal(err)
	}
	now = now.Add(365 * 24 * time.Hour)
	if d, _ := s.Lookup(token); !d.CanChange {
		t.Error("an end set before was kept")
	}
	// A time already past ends it at once; an unknown phone is said.
	if d, err := s.SetUntil(guest.ID, now.Add(-time.Minute)); err != nil || d.CanChange {
		t.Errorf("a past time: %+v %v", d, err)
	}
	if _, err := s.SetUntil("nobody", now); err == nil {
		t.Error("an unknown phone was taken")
	}
}
