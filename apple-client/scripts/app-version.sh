#!/bin/bash
# The Homelab app's version and build, printed as two words:
#
#   apple-client/scripts/app-version.sh      # 0.40.3 118
#
# - The version is the computer's: the newest Homelab Wizard release this
#   checkout has (its v0.40.3 tag), so the phone and the computer show the
#   same number (the owner, Nov 23, 2026). Before the first release, or in a
#   copy without the history, it is the computer's VERSION file.
# - The build (Apple's CFBundleVersion) counts every change to the app ever
#   (Shared/ and Widget/), so it only goes up, as TestFlight needs, and tells
#   two builds of the same version apart.
#
# Without the whole history (a downloaded copy, a shallow clone) the build
# is 0.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)" # apple-client/
# Release tags only (v0.40.3): not nightly, not a test build's v0.41.0-beta.
version="$(git -C "$HERE" tag --list 'v*' --merged HEAD --sort=-v:refname 2>/dev/null |
  grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true)"
version="${version#v}" build=0
if [ "$(git -C "$HERE" rev-parse --is-shallow-repository 2>/dev/null)" = false ]; then
  build="$(git -C "$HERE" rev-list --count HEAD -- Shared Widget)"
fi
if [ -z "$version" ]; then
  version="$(tr -d ' \t\r\n' <"$HERE/../VERSION")"
  if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "VERSION should be three numbers, like 0.17.0 (it reads: $version)" >&2
    exit 1
  fi
fi
echo "$version $build"
