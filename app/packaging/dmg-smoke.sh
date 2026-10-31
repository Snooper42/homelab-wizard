#!/usr/bin/env bash
# Opens the DMG as a person does: mounted, the app dragged to Applications
# (here ~/Applications), then started. Checks what rides inside the bundle
# (the CLI, the menu bar helper, the homelab files, an intact signature),
# that the app is still running after 20 seconds, and keeps a screenshot.
#
#   app/packaging/dmg-smoke.sh <file.dmg> [screenshot.png]
set -euo pipefail

dmg="$1"
shot="${2:-build/dmg-smoke.png}"
mnt="$(mktemp -d)"
hdiutil attach -nobrowse -readonly -mountpoint "$mnt" "$dmg" >/dev/null
trap 'hdiutil detach "$mnt" -quiet || true' EXIT

app="$(ls -d "$mnt"/*.app | head -1)"
[ -L "$mnt/Applications" ] || { echo "The DMG has no Applications shortcut to drag the app onto." >&2; exit 1; }
dest="$HOME/Applications"
mkdir -p "$dest"
bundle="$dest/$(basename "$app")"
rm -rf "$bundle"
ditto "$app" "$bundle"

codesign --verify --deep --strict "$bundle"
"$bundle/Contents/Helpers/homelab" version
for f in Contents/Helpers/homelab-tray Contents/Resources/homelab-kit.tar.gz Contents/Library/LaunchAgents/com.homelab.agent.plist; do
	[ -e "$bundle/$f" ] || { echo "$f is missing from the app" >&2; exit 1; }
done

# Each program runs on the oldest macOS the builds have run on (the menu
# bar helper's 14.0), whatever macOS built it.
oldest=14.0
for f in "Contents/MacOS/$(defaults read "$bundle/Contents/Info" CFBundleExecutable)" Contents/Helpers/homelab-tray "Contents/Library/LoginItems/Homelab Wizard Agent.app/Contents/MacOS/homelab"; do
	mins="$(otool -arch all -l "$bundle/$f" | awk '/LC_BUILD_VERSION/ { b = 1 } b && $1 == "minos" { print $2; b = 0 } /LC_VERSION_MIN_MACOSX/ { m = 1 } m && $1 == "version" { print $2; m = 0 }')"
	[ -n "$mins" ] || { echo "$f names no macOS it needs." >&2; exit 1; }
	for v in $mins; do
		awk -v v="$v" -v o="$oldest" 'BEGIN { split(v, a, "."); split(o, b, "."); exit !(a[1] + 0 < b[1] + 0 || (a[1] + 0 == b[1] + 0 && a[2] + 0 <= b[2] + 0)) }' ||
			{ echo "$f needs macOS $v; the builds run on macOS $oldest and later." >&2; exit 1; }
	done
	echo "$f: macOS $(echo $mins | tr ' ' ',') and later"
done

name="$(defaults read "$bundle/Contents/Info" CFBundleExecutable)"
open "$bundle"
started=""
for _ in $(seq 1 30); do
	sleep 1
	if pgrep -x "$name" >/dev/null; then started=yes; break; fi
done
[ -n "$started" ] || { echo "$name did not start." >&2; exit 1; }
sleep 20
pgrep -x "$name" >/dev/null || { echo "$name quit within 20 seconds of starting." >&2; exit 1; }

mkdir -p "$(dirname "$shot")"
screencapture -x "$shot"
pkill -x "$name" || true
pkill -f "$bundle/Contents/Helpers/" || true
echo "The DMG's app starts from Applications; screenshot: $shot"
