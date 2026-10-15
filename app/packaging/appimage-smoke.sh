#!/usr/bin/env bash
# Starts the AppImage with the system's WebKitGTK moved out of the way, as
# on SteamOS, and checks that the app comes up on its own copy: the window's
# web process runs from inside the AppImage. Needs root (to move the
# libraries), xvfb-run, and ImageMagick's import for the screenshot.
#
#   app/packaging/appimage-smoke.sh <file.AppImage> [screenshot.png]
set -euo pipefail

image="$(readlink -f "$1")"
shot="${2:-build/appimage-smoke.png}"
lib="$(pkg-config --variable=libdir webkit2gtk-4.1)"
hidden="$(mktemp -d)"
log="$(mktemp)"

restore() { mv "$hidden"/* "$lib"/ 2>/dev/null || true; }
trap restore EXIT
mv "$lib/webkit2gtk-4.1" "$lib"/libwebkit2gtk-4.1.so* "$lib"/libjavascriptcoregtk-4.1.so* "$hidden"/

mkdir -p "$(dirname "$shot")"
shot="$(readlink -f "$(dirname "$shot")")/$(basename "$shot")"
export APPIMAGE_EXTRACT_AND_RUN=1
# A homelab folder is not needed: without one the app opens on Setup.
(cd /tmp && timeout 40 xvfb-run -a -s "-screen 0 1280x800x24" sh -c "\"$image\" & sleep 20; import -window root \"$shot\"; sleep 5" >"$log" 2>&1) &
runner=$!

ok=""
for _ in $(seq 1 30); do
	sleep 1
	for pid in $(pgrep -f WebKitWebProcess || true); do
		# The web process must load the AppImage's WebKitGTK, not a system one.
		if grep -q 'appimage_extracted_.*libwebkit2gtk-4.1' "/proc/$pid/maps" 2>/dev/null; then
			ok=yes
		fi
	done
	[ -n "$ok" ] && break
done
wait "$runner" || true
restore
trap - EXIT

if [ -z "$ok" ]; then
	echo "The AppImage did not start its own WebKitGTK web process. Its output:" >&2
	cat "$log" >&2
	exit 1
fi
echo "The AppImage runs on its own WebKitGTK; screenshot: $shot"
