#!/bin/bash
# Builds the iPhone app, puts it on the iPhone plugged into this Mac, opens
# it, and shows a pairing QR code to scan in it: one command instead of the
# Xcode steps.
#
#   apple-client/scripts/run-on-iphone.sh com.yourname
#
# Before the first run:
#   - the iPhone is plugged in with a cable, unlocked, and "Trust This Computer" was tapped;
#   - Developer Mode is on (iPhone Settings › Privacy & Security › Developer Mode;
#     it shows up there after Xcode has seen the phone once, and needs a restart);
#   - the homelab's https address works: apple-client/scripts/phone-address.sh
#
# With a free Apple ID the app works for 7 days; run this again to renew it.
# The pairing is kept across runs. HOMELAB_DEVICE="Name" picks a phone when
# more than one is connected; HOMELAB_PAIR_AGAIN=1 makes a new pairing code anyway.
set -euo pipefail

PREFIX="${1:-}"
if [ -z "$PREFIX" ]; then
  echo "Usage: $0 <bundle id prefix, for example com.yourname> [TEAMID]" >&2
  exit 2
fi
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${HOMELAB_XCODE_DIR:-$HOME/Developer/HomelabClient-xcode}"
export HOMELAB_XCODE_DIR="$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Checking the homelab's address…"
HOMELAB_FROM_SCRIPT=1 "$HERE/phone-address.sh" || exit 1
echo

# The iPhone, as Xcode's devicectl sees it: its CoreDevice id, its UDID (for
# xcodebuild), its name and whether Developer Mode is on.
echo "Looking for the iPhone…"
if ! xcrun devicectl list devices --json-output "$TMP/devices.json" >/dev/null 2>&1; then
  echo "Xcode's device tool didn't answer. Is Xcode installed and opened once?" >&2
  exit 1
fi
/usr/bin/python3 -I - "$TMP/devices.json" "${HOMELAB_DEVICE:-}" >"$TMP/device.tsv" <<'PY'
import json, sys
devices = json.load(open(sys.argv[1])).get("result", {}).get("devices", [])
want = sys.argv[2]
for d in devices:
    hw, dp, cp = d.get("hardwareProperties", {}), d.get("deviceProperties", {}), d.get("connectionProperties", {})
    if hw.get("platform") != "iOS" or hw.get("reality") != "physical":
        continue
    name = dp.get("name", "")
    if want and name != want:
        continue
    print("\t".join([d.get("identifier", ""), hw.get("udid", ""), name,
                     dp.get("developerModeStatus", ""), cp.get("pairingState", ""),
                     cp.get("tunnelState", "")]))
PY
COUNT="$(grep -c . "$TMP/device.tsv" || true)"
if [ "$COUNT" = 0 ]; then
  cat >&2 <<MSG
No iPhone found${HOMELAB_DEVICE:+ named "$HOMELAB_DEVICE"}. Plug it in with a cable, unlock it, and tap Trust if it asks.
Then run this again.
MSG
  exit 1
fi
if [ "$COUNT" != 1 ]; then
  echo "More than one iPhone is connected. Pick one by its name:" >&2
  cut -f3 "$TMP/device.tsv" | while IFS= read -r N; do printf '  HOMELAB_DEVICE="%s" %s %s\n' "$N" "$0" "$PREFIX"; done >&2
  exit 1
fi
IFS=$'\t' read -r DEVICE UDID NAME DEVMODE PAIRING TUNNEL <"$TMP/device.tsv"
echo "Found $NAME."
if [ "$PAIRING" != "paired" ]; then
  echo "This Mac isn't trusted by $NAME yet. Unlock the phone, tap Trust, enter its passcode, then run this again." >&2
  exit 1
fi
if [ "$DEVMODE" != "enabled" ]; then
  cat >&2 <<MSG
Developer Mode is off on $NAME. On the phone: Settings › Privacy & Security › Developer Mode,
turn it on, and restart the phone when it asks. (If the switch isn't there, keep the phone
plugged in and unlocked, open Xcode once, and look again.) Then run this again.
MSG
  exit 1
fi
[ -n "$UDID" ] || { echo "Xcode didn't give $NAME's UDID. Unlock the phone and run this again." >&2; exit 1; }

if pgrep -x Xcode >/dev/null; then
  echo "Closing Xcode while the project is remade…"
  osascript -e 'quit app "Xcode"' >/dev/null 2>&1 || true
  sleep 2
fi
echo "Making the project…"
HOMELAB_NO_OPEN=1 "$HERE/make-xcode-project.sh" "$PREFIX" "${2:-}"

echo "Building for $NAME (the first time takes a few minutes)…"
LOG="$OUT/build-ios.log"
if ! xcodebuild -project "$OUT/HomelabClient.xcodeproj" -scheme HomelabClient-iOS \
     -configuration Debug -destination "id=$UDID" \
     -derivedDataPath "$OUT/build" -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
     build >"$LOG" 2>&1; then
  echo >&2
  echo "The build failed. The errors:" >&2
  grep -E 'error:|No Account|No profiles|requires a development team|maximum number|Developer Mode' "$LOG" | sort -u | head -20 >&2 || tail -30 "$LOG" >&2
  echo >&2
  echo "The whole log is in $LOG" >&2
  exit 1
fi
APP="$OUT/build/Build/Products/Debug-iphoneos/HomelabClient.app"
[ -d "$APP" ] || { echo "Built, but no app at $APP" >&2; exit 1; }

echo "Installing on ${NAME}…"
if ! xcrun devicectl device install app --device "$DEVICE" "$APP" >"$TMP/install.log" 2>&1; then
  echo "Installing failed:" >&2
  tail -5 "$TMP/install.log" >&2
  echo "Is the phone unlocked?" >&2
  exit 1
fi
if xcrun devicectl device process launch --device "$DEVICE" "$PREFIX.HomelabClient" >"$TMP/launch.log" 2>&1; then
  echo "Opened Homelab on $NAME."
else
  cat <<MSG
Installed, but the phone wouldn't open it yet: the first time, it has to trust your Apple ID.
On the phone: Settings › General › VPN & Device Management › your Apple ID under
Developer App › Trust. Then open Homelab from the Home Screen.
MSG
fi

# A pairing code, shown as a QR code to scan in the app.
# shellcheck source=homelab-cli.sh
. "$HERE/homelab-cli.sh"
if ! find_homelab_cli; then
  echo "No homelab found in $HOMELAB, so no pairing code. Make one in Homelab Wizard: Settings › Phones." >&2
  exit 0
fi
if [ -z "${HOMELAB_PAIR_AGAIN:-}" ] && phone_rows | grep -F "  $NAME  " | grep -vqE 'last seen never$'; then
  cat <<DONE

Ready. $NAME is already paired, so no new code was made.
If the app asks to pair anyway, run this again with HOMELAB_PAIR_AGAIN=1 in front.
DONE
  exit 0
fi
PAIR="$("${HOMELAB_CLI[@]}" phone pair --name "$NAME" --can-change 2>/dev/null || true)"
CODE="$(printf '%s\n' "$PAIR" | grep -o 'enter [A-Z0-9]\{8\}' | head -1 | cut -d' ' -f2 || true)"
LINK="$(printf '%s\n' "$PAIR" | grep -o 'https://[^ ]*#pair=[A-Z0-9]\{8\}' | head -1 || true)"
if [ -z "$CODE" ] || [ -z "$LINK" ]; then
  echo "Couldn't make a pairing code with an https link. Make one in Homelab Wizard: Settings › Phones." >&2
  exit 0
fi
echo
echo "In Homelab on $NAME, tap Scan the Computer's QR Code, and point the phone at this:"
printf '%s\n' "$PAIR" | awk '/Or scan this/{on=1; next} /Then, in Safari/{on=0} on'
cat <<DONE
Or type the address ${LINK%%/#pair=*} and the code $CODE (good for 10 minutes), then tap Pair.
DONE
