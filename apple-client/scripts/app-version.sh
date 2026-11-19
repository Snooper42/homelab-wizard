#!/bin/bash
# The Homelab app's version and build, worked out from apple-client/VERSION
# and this checkout's history, printed as two words:
#
#   apple-client/scripts/app-version.sh      # 0.4.3 118
#
# - VERSION holds the first two numbers (0.4). They go up by hand when a
#   milestone lands; 1.0 is kept for the day the app is signed and on
#   TestFlight (README, "The day you sign").
# - The last number counts the changes to the app itself (Shared/ and Widget/)
#   since VERSION last changed: 0.4.0, then 0.4.1 with the next one, and so on.
#   Main takes each change as one squashed commit, so it's one per merged PR.
# - The build (Apple's CFBundleVersion) counts every change to the app ever,
#   so it only goes up, even when VERSION does.
#
# Without the history (a downloaded copy, a shallow clone), it prints the
# VERSION with .0 and build 0, and the app shows just "0.4.0".
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)" # apple-client/
base="$(tr -d ' \t\r\n' <"$HERE/VERSION")"
if ! [[ "$base" =~ ^[0-9]+\.[0-9]+$ ]]; then
  echo "apple-client/VERSION should be two numbers, like 0.4 (it reads: $base)" >&2
  exit 1
fi

patch=0 build=0
if [ "$(git -C "$HERE" rev-parse --is-shallow-repository 2>/dev/null)" = false ]; then
  since="$(git -C "$HERE" log -1 --format=%H -- VERSION)"
  [ -z "$since" ] || patch="$(git -C "$HERE" rev-list --count "$since..HEAD" -- Shared Widget)"
  build="$(git -C "$HERE" rev-list --count HEAD -- Shared Widget)"
fi
echo "$base.$patch $build"
