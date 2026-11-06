package selfupdate

import (
	"context"
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
		{"an ad-hoc app takes any", "not set", "ZZZZZ99999", "1", ""},
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
