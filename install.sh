#!/bin/sh
# Installs Homelab Wizard on a Mac, or replaces the copy in Applications:
#
#   curl -fsSL https://raw.githubusercontent.com/Snooper42/homelab-wizard/main/install.sh | sh
#
# It downloads the newest build from the repository's Latest release, checks
# it against the SHA-256 checksum GitHub keeps for the file, copies the app
# to Applications, and opens it. A file curl downloads carries no quarantine
# flag, so macOS opens the unsigned app without the "damaged" or
# "unidentified developer" warning, and no xattr step is needed.
set -eu

repo="${HOMELAB_REPO:-Snooper42/homelab-wizard}"
asset="Homelab-Wizard-macOS.dmg"
name="Homelab Wizard.app"

say() { printf '%s\n' "$*"; }
fail() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = Darwin ] || fail "this installs the Mac app; for Windows and Linux, see the README."
for tool in curl shasum hdiutil ditto; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool is missing."
done

tmp="$(mktemp -d)"
mnt="$tmp/mnt"
mkdir "$mnt"
cleanup() {
  [ -d "$mnt" ] && hdiutil detach -quiet -force "$mnt" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT INT TERM

# The release's assets, one key per line, so the file's own address and
# checksum can be read without jq. Each asset lists its name before its
# digest and download address.
say "Looking up the newest build..."
curl -fsSL -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$repo/releases/latest" -o "$tmp/release.json" ||
  fail "GitHub could not be reached."
fields="$(tr ',{}[]' '\n\n\n\n\n' <"$tmp/release.json" | awk -v asset="$asset" '
  /"name": *"/ { mine = index($0, "\"" asset "\"") > 0 }
  mine && /"digest": *"sha256:/ { sub(/.*"sha256:/, ""); sub(/".*/, ""); sha = $0 }
  mine && /"browser_download_url": *"/ { sub(/.*"browser_download_url": *"/, ""); sub(/".*/, ""); url = $0 }
  END { if (sha != "" && url != "") print sha, url }')"
[ -n "$fields" ] || fail "the Latest release has no $asset with a checksum."
sha="${fields%% *}"
url="${fields#* }"

say "Downloading $asset..."
curl -fL --progress-bar "$url" -o "$tmp/$asset" || fail "the download failed."
got="$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')"
[ "$got" = "$sha" ] || fail "the download does not match GitHub's checksum (expected $sha, got $got); nothing was installed."

hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mnt" "$tmp/$asset" || fail "the disk image could not be opened."
[ -d "$mnt/$name" ] || fail "the disk image holds no $name."

# /Applications when this account can write to it (an administrator can),
# else the Applications folder in the home folder.
dir=/Applications
[ -w "$dir" ] || { dir="$HOME/Applications"; mkdir -p "$dir"; }
app="$dir/$name"

if [ -d "$app" ]; then
  say "Quitting the running app..."
  osascript -e 'quit app "Homelab Wizard"' >/dev/null 2>&1 || true
  i=0
  while pgrep -f "$app/Contents/MacOS/" >/dev/null 2>&1 && [ $i -lt 50 ]; do sleep 0.2; i=$((i + 1)); done
  pkill -f "$app/Contents/Helpers/" 2>/dev/null || true
fi

# Copied beside the old app first, so a failed copy leaves it as it was.
say "Copying the app to $dir..."
rm -rf "$app.new" "$app.old"
ditto "$mnt/$name" "$app.new" || { rm -rf "$app.new"; fail "the app could not be copied to $dir."; }
[ -d "$app" ] && mv "$app" "$app.old"
mv "$app.new" "$app"
rm -rf "$app.old"
xattr -dr com.apple.quarantine "$app" 2>/dev/null || true

say "Opening Homelab Wizard. From now on it updates itself."
open "$app"
