package selfupdate

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// N24: a Mac app signed with a Developer ID takes an update only from the
// same team. GitHub's checksum comes from the same release as the download,
// so it cannot tell a release someone else put there; the signature can.
// An app with no Team ID (an ad-hoc build) has none to keep, as before.
func TestAMacUpdateKeepsItsSigner(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("sh stand-ins for hdiutil, ditto, and codesign")
	}
	bin := t.TempDir()
	stub := func(name, body string) {
		if err := os.WriteFile(filepath.Join(bin, name), []byte("#!/bin/sh\n"+body), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	// hdiutil attach … -mountpoint <mnt> <dmg> opens a disk image holding the app.
	stub("hdiutil", `[ "$1" = attach ] || exit 0
mkdir -p "$5/Homelab Wizard.app/Contents/MacOS" && echo new >"$5/Homelab Wizard.app/Contents/MacOS/homelab-wizard"
`)
	stub("ditto", `cp -R "$1" "$2"
`)
	// The installed app is signed by OLD_TEAM; the download (under update/)
	// by NEW_TEAM, and its signature holds when NEW_OK is 1.
	stub("codesign", `last=""; for a; do last="$a"; done
case "$last" in
  */update/*) team="$NEW_TEAM"; ok="$NEW_OK";;
  *) team="$OLD_TEAM"; ok=1;;
esac
case "$1" in
  -dv) echo "Executable=$last" >&2; echo "TeamIdentifier=$team" >&2; exit 0;;
  --verify) [ "$ok" = 1 ] && exit 0; echo "$last: invalid signature (code or signature have been modified)" >&2; exit 1;;
esac
exit 1
`)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	installed := filepath.Join(t.TempDir(), "Applications", "Homelab Wizard.app")
	installedAs(t, Installed{Kind: KindMac, Path: installed})

	for _, c := range []struct {
		name, old, new, ok string
		refused            string // "" when the update goes ahead
	}{
		{"the same team", "ABCDE12345", "ABCDE12345", "1", ""},
		{"another team", "ABCDE12345", "ZZZZZ99999", "1", "signed by someone else"},
		{"no team (ad-hoc)", "ABCDE12345", "not set", "1", "signed by someone else"},
		{"a broken signature", "ABCDE12345", "ABCDE12345", "0", "signature does not hold"},
		{"an ad-hoc app takes any signer", "not set", "ZZZZZ99999", "1", ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Setenv("OLD_TEAM", c.old)
			t.Setenv("NEW_TEAM", c.new)
			t.Setenv("NEW_OK", c.ok)
			rel := serve(t, map[string][]byte{MacAsset: []byte("a disk image")}, nil)
			dir := filepath.Join(t.TempDir(), "update")
			staged, err := Stage(context.Background(), rel, dir, nil)
			if c.refused == "" {
				if err != nil {
					t.Fatalf("refused: %v", err)
				}
				if read(filepath.Join(staged, "Contents", "MacOS", "homelab-wizard")) != "new\n" {
					t.Fatalf("staged %s", staged)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), c.refused) {
				t.Fatalf("took the build: %q, %v", staged, err)
			}
			if _, serr := os.Stat(filepath.Join(dir, "Homelab Wizard.app")); serr == nil {
				t.Error("the refused app was left staged")
			}
		})
	}
}

// N51: an ad-hoc Mac app has no signer to keep, so its update is held to
// the build provenance, as Windows' and Linux's are (N29): a disk image
// the release lists but this repository's workflow didn't build is refused.
func TestAnAdHocMacUpdateNeedsItsProvenance(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("sh stand-ins for hdiutil, ditto, and codesign")
	}
	bin := t.TempDir()
	for name, body := range map[string]string{
		"hdiutil":  "[ \"$1\" = attach ] || exit 0\nmkdir -p \"$5/Homelab Wizard.app/Contents/MacOS\" && echo new >\"$5/Homelab Wizard.app/Contents/MacOS/homelab-wizard\"\n",
		"ditto":    "cp -R \"$1\" \"$2\"\n",
		"codesign": "[ \"$1\" = -dv ] && { echo 'TeamIdentifier=not set' >&2; exit 0; }\nexit 0\n",
	} {
		if err := os.WriteFile(filepath.Join(bin, name), []byte("#!/bin/sh\n"+body), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	installedAs(t, Installed{Kind: KindMac, Path: filepath.Join(t.TempDir(), "Homelab Wizard.app")})

	rel := serve(t, map[string][]byte{MacAsset: []byte("a disk image")}, nil)
	if _, err := Stage(context.Background(), rel, filepath.Join(t.TempDir(), "update"), nil); err != nil {
		t.Fatalf("an attested disk image was refused: %v", err)
	}
	// The same download, with no attestation for it.
	old := Provenance
	Provenance = func(context.Context, string, string, string) error {
		return errors.New("no build provenance for " + MacAsset)
	}
	t.Cleanup(func() { Provenance = old })
	dir := filepath.Join(t.TempDir(), "update")
	if staged, err := Stage(context.Background(), rel, dir, nil); err == nil || !strings.Contains(err.Error(), "no build provenance") {
		t.Fatalf("an unattested disk image was taken: %q, %v", staged, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "Homelab Wizard.app")); err == nil {
		t.Error("the refused app was staged")
	}
	// A release from before builds were attested is taken as before.
	rel.When = "2026-11-01T00:00:00Z"
	if _, err := Stage(context.Background(), rel, filepath.Join(t.TempDir(), "update"), nil); err != nil {
		t.Errorf("a release from before attestations: %v", err)
	}
}

// Security list item 4 (Q review of #908): an app signed with a certificate
// of the household's own has no Team ID, so the team check above passes any
// signer. The installed app's designated requirement (codesign -d -r-) names
// its certificate, so the staged app is held to it: the same certificate is
// taken, another one or none is refused. An ad-hoc app's requirement is its
// own code hash, which no new build meets, so it keeps nothing, as before.
func TestAMacUpdateKeepsItsDesignatedRequirement(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("sh stand-ins for hdiutil, ditto, and codesign")
	}
	bin := t.TempDir()
	stub := func(name, body string) {
		if err := os.WriteFile(filepath.Join(bin, name), []byte("#!/bin/sh\n"+body), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	stub("hdiutil", `[ "$1" = attach ] || exit 0
mkdir -p "$5/Homelab Wizard.app/Contents/MacOS" && echo new >"$5/Homelab Wizard.app/Contents/MacOS/homelab-wizard"
`)
	stub("ditto", `cp -R "$1" "$2"
`)
	// The installed app's requirement is OLD_REQ; the download (under
	// update/) is signed so that it meets NEW_REQ only. Neither has a team.
	stub("codesign", `last=""; req=""; for a; do last="$a"; case "$a" in -R=*) req="${a#-R}";; esac; done
case "$last" in
  */update/*) mine="$NEW_REQ";;
  *) mine="$OLD_REQ";;
esac
case "$1" in
  -dv) echo "Executable=$last" >&2; echo "TeamIdentifier=not set" >&2; exit 0;;
  -d) echo "Executable=$last" >&2; [ -n "$mine" ] || exit 1; echo "designated => $mine"; exit 0;;
  --verify) [ -z "$req" ] && exit 0; [ "$req" = "=$mine" ] && exit 0; echo "$last: valid on disk" >&2; echo "$last: does not satisfy its designated Requirement" >&2; exit 3;;
esac
exit 1
`)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	installedAs(t, Installed{Kind: KindMac, Path: filepath.Join(t.TempDir(), "Applications", "Homelab Wizard.app")})

	const ours = `identifier "com.homelab.wizard" and certificate leaf = H"1111111111111111111111111111111111111111"`
	const theirs = `identifier "com.homelab.wizard" and certificate leaf = H"2222222222222222222222222222222222222222"`
	for _, c := range []struct {
		name, old, new string
		refused        string // "" when the update goes ahead
	}{
		{"the same certificate", ours, ours, ""},
		{"another certificate", ours, theirs, "signed by someone else"},
		{"an ad-hoc build", ours, `cdhash H"3333333333333333333333333333333333333333"`, "signed by someone else"},
		{"an ad-hoc app takes any signer", `cdhash H"4444444444444444444444444444444444444444"`, theirs, ""},
		{"no requirement read", "", theirs, ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Setenv("OLD_REQ", c.old)
			t.Setenv("NEW_REQ", c.new)
			rel := serve(t, map[string][]byte{MacAsset: []byte("a disk image")}, nil)
			dir := filepath.Join(t.TempDir(), "update")
			staged, err := Stage(context.Background(), rel, dir, nil)
			if c.refused == "" {
				if err != nil {
					t.Fatalf("refused: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), c.refused) {
				t.Fatalf("took the build: %q, %v", staged, err)
			}
			if _, serr := os.Stat(filepath.Join(dir, "Homelab Wizard.app")); serr == nil {
				t.Error("the refused app was left staged")
			}
		})
	}
}
