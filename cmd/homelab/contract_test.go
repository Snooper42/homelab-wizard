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

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/docker"
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
	want, _ := json.MarshalIndent(CompanionContract{Me: me}, "", "  ")
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
