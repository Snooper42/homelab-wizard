#!/bin/bash
# Makes the Xcode project for the Mac app, with every setting the README's
# "Make the Xcode project" steps describe, using XcodeGen. The project is
# written outside the repository (by default ~/Developer/HomelabClient-xcode),
# so no .xcodeproj is ever committed. It points at this checkout's Shared/
# folder, so a git pull updates it.
#
#   apple-client/scripts/make-xcode-project.sh com.yourname
#
# The argument is the bundle identifier prefix (reverse domain, for example
# com.snooper42); the app becomes <prefix>.HomelabClient.
set -euo pipefail

PREFIX="${1:-}"
if [ -z "$PREFIX" ]; then
  echo "Usage: $0 <bundle id prefix, for example com.yourname>" >&2
  exit 2
fi
case "$PREFIX" in
  *[!a-zA-Z0-9.-]*|.*|*.) echo "The prefix may only have letters, numbers, dots and hyphens: $PREFIX" >&2; exit 2 ;;
esac

HERE="$(cd "$(dirname "$0")/.." && pwd)"        # apple-client/
SHARED="$HERE/Shared"
OUT="${HOMELAB_XCODE_DIR:-$HOME/Developer/HomelabClient-xcode}"
[ -d "$SHARED" ] || { echo "No Shared/ folder at $SHARED" >&2; exit 1; }

if ! command -v xcodegen >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Installing XcodeGen with Homebrew…"
    brew install xcodegen
  else
    echo "XcodeGen isn't installed and neither is Homebrew." >&2
    echo "Install Homebrew from https://brew.sh, then run this again." >&2
    exit 1
  fi
fi

# The signing team: read from this Mac's Apple Development certificate, which
# Xcode makes once an Apple ID is added under Xcode > Settings > Accounts.
TEAM="$(security find-certificate -c "Apple Development" -p 2>/dev/null \
  | openssl x509 -noout -subject 2>/dev/null \
  | sed -n 's/.*OU *= *\([A-Z0-9]\{10\}\).*/\1/p' | head -1 || true)"

mkdir -p "$OUT"
cat > "$OUT/project.yml" <<YAML
name: HomelabClient
options:
  bundleIdPrefix: $PREFIX
  deploymentTarget:
    macOS: "14.0"
settings:
  base:
    SWIFT_VERSION: "6.0"
    # The sources mark @MainActor where they mean it.
    SWIFT_DEFAULT_ACTOR_ISOLATION: nonisolated
    SWIFT_APPROACHABLE_CONCURRENCY: NO
    CODE_SIGN_STYLE: Automatic
    DEVELOPMENT_TEAM: "$TEAM"
    ENABLE_HARDENED_RUNTIME: YES
targets:
  HomelabClient:
    type: application
    platform: macOS
    sources:
      - path: "$SHARED"
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: $PREFIX.HomelabClient
        PRODUCT_NAME: HomelabClient
    info:
      path: Info.plist
      properties:
        CFBundleDisplayName: Homelab
        LSApplicationCategoryType: public.app-category.utilities
        NSFaceIDUsageDescription: Touch ID unlocks Homelab, which controls your servers.
        ITSAppUsesNonExemptEncryption: false
        # For the companion on this Mac only (http://127.0.0.1:8099). The app's
        # own ServerEndpoint still refuses plain http to anything but loopback.
        NSAppTransportSecurity:
          NSAllowsLocalNetworking: true
    entitlements:
      path: HomelabClient.entitlements
      properties:
        com.apple.security.app-sandbox: true
        com.apple.security.network.client: true
YAML

(cd "$OUT" && xcodegen generate --quiet)
echo "Made $OUT/HomelabClient.xcodeproj"
if [ -z "$TEAM" ]; then
  echo "No signing team found. In Xcode: the HomelabClient target > Signing & Capabilities > Team, pick yours."
fi
open "$OUT/HomelabClient.xcodeproj"
