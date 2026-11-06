#!/bin/bash
# Builds the Mac app, opens it, and puts a pairing link for the homelab on
# this Mac on the clipboard: one command instead of the Xcode steps.
#
#   apple-client/scripts/run-on-this-mac.sh com.yourname
#
# It needs Xcode, signed in under Xcode > Settings > Apple Accounts (a free
# Apple ID is enough). It makes the project with make-xcode-project.sh,
# builds with xcodebuild (which creates the signing profile itself), and
# makes the pairing code with the homelab in ~/Homelab (or $HOMELAB_ROOT).
set -euo pipefail

PREFIX="${1:-}"
if [ -z "$PREFIX" ]; then
  echo "Usage: $0 <bundle id prefix, for example com.yourname> [TEAMID]" >&2
  exit 2
fi
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${HOMELAB_XCODE_DIR:-$HOME/Developer/HomelabClient-xcode}"
HOMELAB="${HOMELAB_ROOT:-$HOME/Homelab}"
export HOMELAB_XCODE_DIR="$OUT"

# Xcode can lock up when its open project is replaced under it, and the old
# app must not hold on to the screen.
if pgrep -x Xcode >/dev/null; then
  echo "Closing Xcode while the project is remade…"
  osascript -e 'quit app "Xcode"' >/dev/null 2>&1 || true
  sleep 2
fi
pkill -x HomelabClient 2>/dev/null || true

echo "Making the project…"
HOMELAB_NO_OPEN=1 "$HERE/make-xcode-project.sh" "$PREFIX" "${2:-}"

echo "Building (the first time takes a few minutes)…"
LOG="$OUT/build.log"
if ! xcodebuild -project "$OUT/HomelabClient.xcodeproj" -scheme HomelabClient \
     -configuration Debug -destination 'platform=macOS' \
     -derivedDataPath "$OUT/build" -allowProvisioningUpdates build >"$LOG" 2>&1; then
  echo >&2
  echo "The build failed. The errors:" >&2
  grep -E 'error:|warning: .*signing|No Account|No profiles|requires a development team' "$LOG" | sort -u | head -20 >&2 || tail -30 "$LOG" >&2
  echo >&2
  echo "The whole log is in $LOG" >&2
  exit 1
fi
APP="$OUT/build/Build/Products/Debug/HomelabClient.app"
[ -d "$APP" ] || { echo "Built, but no app at $APP" >&2; exit 1; }
open "$APP"
echo "Opened the app."

# A pairing code from the homelab on this Mac, as a link the app reads in one paste.
if [ -x "$HOMELAB/homelab" ]; then
  CLI=("$HOMELAB/homelab")
elif [ -x "/Applications/Homelab Wizard.app/Contents/Helpers/homelab" ]; then
  CLI=("/Applications/Homelab Wizard.app/Contents/Helpers/homelab" --root "$HOMELAB")
else
  echo "No homelab found in $HOMELAB, so no pairing code. Make one in Homelab Wizard: Settings › Phones." >&2
  exit 0
fi
PAIR="$("${CLI[@]}" --no-color phone pair --name "$(scutil --get ComputerName 2>/dev/null || echo Mac)" --can-change 2>/dev/null || true)"
CODE="$(printf '%s\n' "$PAIR" | grep -o 'enter [A-Z0-9]\{8\}' | head -1 | cut -d' ' -f2 || true)"
if [ -z "$CODE" ]; then
  echo "Couldn't make a pairing code. Make one in Homelab Wizard: Settings › Phones." >&2
  exit 0
fi
printf 'localhost:8099/#pair=%s' "$CODE" | pbcopy
cat <<DONE

Ready. The pairing link is on the clipboard (code $CODE, good for 10 minutes).
In the app: click in Address, press ⌘V, then click Pair.
DONE
