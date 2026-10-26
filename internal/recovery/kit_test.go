package recovery

import (
	"strings"
	"testing"
	"time"
)

// The kit says where everything a restore needs is, and holds none of it:
// passphrases are named, never written.
func TestKitNamesWhereThingsAreAndHoldsNoSecret(t *testing.T) {
	k := Kit{
		Made:        time.Date(2026, 10, 26, 9, 0, 0, 0, time.UTC),
		Machine:     "Ubuntu 24.04 · ThinkCentre",
		Root:        "/home/anna/Homelab",
		Destination: "/media/anna/Backup/Homelab Backups",
		Domain:      "example.com",
		TailnetHost: "homelab.tail1.ts.net",
		Repository:  "https://github.com/Snooper42/homelab-wizard",
		Jobs:        []Job{{"Homelab Secrets", "the settings and passwords (.env)"}, {"Homelab AppData", "the apps' data"}},
		Apps:        []string{"Vaultwarden", "Immich"},
		People:      []string{"Anna", "Ben <img src=x>"},
	}
	var b strings.Builder
	if err := Render(&b, k); err != nil {
		t.Fatal(err)
	}
	page := b.String()
	for _, want := range []string{
		"/media/anna/Backup/Homelab Backups", "Homelab Secrets", "Homelab AppData",
		"DUPLICATI_SECRETS_PASSPHRASE", "DUPLICATI_PASSPHRASE", "example.com", "homelab.tail1.ts.net",
		"https://github.com/Snooper42/homelab-wizard", "Vaultwarden, Immich", "/home/anna/Homelab", "Disaster Recovery",
	} {
		if !strings.Contains(page, want) {
			t.Errorf("the kit does not say %q", want)
		}
	}
	// A blank line to write the Secrets passphrase on, by hand.
	if !strings.Contains(page, `class="write"`) {
		t.Error("no place to write the Secrets passphrase")
	}
	if strings.Contains(page, "<img src=x>") {
		t.Error("names are put on the page as text, not as HTML")
	}
}

func TestKitInHomeModeFromAFolderTheAppMade(t *testing.T) {
	var b strings.Builder
	if err := Render(&b, Kit{Destination: "/Volumes/Backup", Jobs: []Job{{"Homelab Secrets", ".env"}}}); err != nil {
		t.Fatal(err)
	}
	page := b.String()
	if strings.Contains(page, "Domain and DNS") || strings.Contains(page, "People in the household") || strings.Contains(page, "<td>Tailscale</td>") {
		t.Error("rows for a domain, a tailnet, or people that are not there")
	}
	if !strings.Contains(page, "Homelab Wizard (it carries them)") {
		t.Error("a folder the app made: the app carries the homelab's files")
	}
}

type failingWriter struct{}

func (failingWriter) Write([]byte) (int, error) { return 0, errFull }

var errFull = errorString("the disk is full")

type errorString string

func (e errorString) Error() string { return string(e) }

func TestKitThatCannotBeWritten(t *testing.T) {
	if err := Render(failingWriter{}, Kit{}); err == nil || !strings.Contains(err.Error(), "the recovery kit") {
		t.Errorf("got %v", err)
	}
}
