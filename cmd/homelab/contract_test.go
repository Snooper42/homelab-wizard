package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/history"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

var updateContract = flag.Bool("update-contract", false, "write apple-client/Tests/Resources/CompanionContract.json")

// CompanionContract is what the iPhone app's tests read of the computer
// (apple-client/Tests/ContractTests.swift): the /api/me answer as this
// computer gives it, with every call it answers. A call added, renamed or
// removed here changes the file; the Swift tests then check the phone
// still decodes it and calls nothing the computer lacks.
type CompanionContract struct {
	Me companion.Me `json:"me"`
	// AlertLog is what the AlertLog call answers, in history.Alert's shape:
	// an alert snoozed from a phone, one cleared, and one about no check.
	AlertLog []history.Alert `json:"alertLog"`
}

// sampleAlertLog is AlertLog's sample, at fixed times so the file stays
// the same from run to run.
func sampleAlertLog() []history.Alert {
	at := func(s string) *time.Time { t, _ := time.Parse(time.RFC3339, s); return &t }
	return []history.Alert{
		{ID: 3, At: *at("2026-11-11T14:02:00Z"), Topic: "tunnel-watchdog", Title: "Homelab: something is down", Body: "crowdsec bouncer: no pull for 9 minutes", Priority: 4, Checks: []string{"crowdsec bouncer"}, SnoozedUntil: at("2026-11-11T15:02:00Z"), SnoozedBy: "Phone"},
		{ID: 2, At: *at("2026-11-11T03:10:00Z"), Topic: "tunnel-watchdog", Title: "Homelab: something is down", Body: "vikunja: not answering", Priority: 4, Checks: []string{"vikunja"}, ClearedAt: at("2026-11-11T03:40:00Z")},
		{ID: 1, At: *at("2026-11-09T04:00:00Z"), Topic: "watchtower", Title: "Homelab: an update was rolled back", Body: "Navidrome"},
	}
}

// The file the iPhone app's tests read is what the computer answers today
// (go test ./cmd/homelab -run TestCompanionContract -update-contract writes it).
func TestCompanionContract(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{})
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	store := companion.NewStore(filepath.Join(t.TempDir(), "phones.json"))
	s := &companion.Server{Store: store, Methods: h.phoneMethods(), Version: "1.2.3"}
	me := s.MeFor(companion.Device{ID: "a1b2c3", Name: "Phone", CanChange: true, Finances: companion.FinancesEdit})
	if me.Computer == nil || !slices.Contains(me.Computer.Methods, "Status") {
		t.Fatalf("the computer says it can do: %+v", me.Computer)
	}
	want, _ := json.MarshalIndent(CompanionContract{Me: me, AlertLog: sampleAlertLog()}, "", "  ")
	want = append(want, '\n')
	path := filepath.Join("..", "..", "apple-client", "Tests", "Resources", "CompanionContract.json")
	if *updateContract {
		if err := os.WriteFile(path, want, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	got, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(got, want) {
		t.Fatalf("apple-client/Tests/Resources/CompanionContract.json is out of date: go test ./cmd/homelab -run TestCompanionContract -update-contract (%v)", err)
	}
}
