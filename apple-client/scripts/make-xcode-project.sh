#!/bin/bash
# Makes the Xcode project for the iPhone and iPad app, with every setting the README's
# "Make the Xcode project" steps describe, using XcodeGen. The project is
# written outside the repository (by default ~/Developer/HomelabClient-xcode),
# so no .xcodeproj is ever committed. It points at this checkout's Shared/
# folder, so a git pull updates it.
#
#   apple-client/scripts/make-xcode-project.sh com.yourname [TEAMID]
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
# A second argument (the 10-character team ID, shown in Xcode under
# Signing & Capabilities or at developer.apple.com) wins over that.
TEAM="${2:-}"
# Next, the team already picked in Xcode for the project made last time.
if [ -z "$TEAM" ] && [ -f "$OUT/HomelabClient.xcodeproj/project.pbxproj" ]; then
  TEAM="$(sed -n 's/.*DEVELOPMENT_TEAM = "\{0,1\}\([A-Z0-9]\{10\}\)"\{0,1\};.*/\1/p' "$OUT/HomelabClient.xcodeproj/project.pbxproj" | head -1)"
fi
[ -n "$TEAM" ] || TEAM="$(security find-certificate -c "Apple Development" -p 2>/dev/null \
  | openssl x509 -noout -subject 2>/dev/null \
  | sed -n 's/.*OU *= *\([A-Z0-9]\{10\}\).*/\1/p' | head -1 || true)"

# The day you join the paid Apple Developer Program (README, "The day you
# sign"): HOMELAB_SIGNED=1 turns on everything HOMELAB_WIDGET=1 does, plus
# push notifications (aps-environment), and builds the code under
# #if HOMELAB_SIGNED. Without it, the project is the same as before.
SIGNED_ENT="" SIGNED_FLAG=""
if [ -n "${HOMELAB_SIGNED:-}" ]; then
  HOMELAB_WIDGET=1
  SIGNED_ENT="        aps-environment: development"
  SIGNED_FLAG="        SWIFT_ACTIVE_COMPILATION_CONDITIONS: \"\$(inherited) HOMELAB_SIGNED\""
fi

# The Home Screen widget (Widget/), only with HOMELAB_WIDGET=1:
# it needs an App Group, which a free Apple ID may not sign, so the default
# project leaves it out and can't fail on it. The pieces below stay empty
# without it, and the project comes out as before.
IOS_WIDGET_DEP="" IOS_GROUP_INFO="" IOS_GROUP_ENT="" WIDGET_TARGETS=""
if [ -n "${HOMELAB_WIDGET:-}" ]; then
  # iPhone's App Groups start with "group.".
  IOS_GROUP="group.$PREFIX.HomelabClient"
  IOS_WIDGET_DEP="      - target: HomelabWidget-iOS"
  IOS_GROUP_INFO="        HomelabAppGroup: \"$IOS_GROUP\""
  IOS_GROUP_ENT="        com.apple.security.application-groups:
          - \"$IOS_GROUP\""
  WIDGET_TARGETS="  # The Home Screen widget, the same on iPhone and iPad.
  HomelabWidget-iOS:
    type: app-extension
    platform: iOS
    sources:
      - path: \"$HERE/Widget\"
      - path: \"$SHARED/Views/Theme.swift\"
      - path: \"$SHARED/Models/WidgetSummary.swift\"
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: $PREFIX.HomelabClient.Widget
        PRODUCT_NAME: HomelabWidget
        TARGETED_DEVICE_FAMILY: \"1,2\"
    info:
      path: Widget-iOS.plist
      properties:
        CFBundleDisplayName: Homelab
$IOS_GROUP_INFO
        NSExtension:
          NSExtensionPointIdentifier: com.apple.widgetkit-extension
    entitlements:
      path: HomelabWidget-iOS.entitlements
      properties:
$IOS_GROUP_ENT"
fi

mkdir -p "$OUT"

# The computer's own Finances code for the phone (mobile/finance, built with
# gomobile by `make phone-finance-framework`): a household member's private
# Finances open with it, read forward on her phone. Made here when Go is on
# this Mac and that code changed since; without it the app is made all the
# same, and says so where they'd open. HOMELAB_FINANCE_XCFRAMEWORK names one
# already made (and builds nothing).
ROOT="$(cd "$HERE/.." && pwd)"
FINANCE="${HOMELAB_FINANCE_XCFRAMEWORK:-$HERE/Frameworks/HomelabFinance.xcframework}"
if [ -z "${HOMELAB_FINANCE_XCFRAMEWORK:-}" ] && command -v go >/dev/null 2>&1; then
  if [ ! -d "$FINANCE" ] || [ -n "$(find "$ROOT/mobile" "$ROOT/internal/finance" -name '*.go' -newer "$FINANCE" 2>/dev/null | head -1)" ]; then
    echo "Building the Finances code for the phone (a minute or two the first time)…"
    v="$(sed -n 's/^MOBILE_VERSION := //p' "$ROOT/Makefile")"
    if ! { go install "golang.org/x/mobile/cmd/gomobile@$v" "golang.org/x/mobile/cmd/gobind@$v" \
           && PATH="$(go env GOPATH)/bin:$PATH" make -C "$ROOT" phone-finance-framework; } >"$OUT/finance-build.log" 2>&1; then
      echo "The Finances code for the phone didn't build (its log: $OUT/finance-build.log), so the app is made without it." >&2
    fi
  fi
fi
FINANCE_DEP=""
if [ -d "$FINANCE" ]; then
  FINANCE_DEP="      - framework: \"$FINANCE\"
        embed: false"
else
  echo "Without Go on this Mac (go.dev/dl), a household member's private Finances can't open in this build of the app. Install it and run this again."
fi
DEPENDENCIES=""
if [ -n "$IOS_WIDGET_DEP$FINANCE_DEP" ]; then
  DEPENDENCIES="    dependencies:
$IOS_WIDGET_DEP
$FINANCE_DEP"
fi

cat > "$OUT/project.yml" <<YAML
name: HomelabClient
options:
  bundleIdPrefix: $PREFIX
  deploymentTarget:
    iOS: "17.0"
settings:
  base:
    SWIFT_VERSION: "6.0"
    # The sources mark @MainActor where they mean it.
    SWIFT_DEFAULT_ACTOR_ISOLATION: nonisolated
    SWIFT_APPROACHABLE_CONCURRENCY: NO
    CODE_SIGN_STYLE: Automatic
    DEVELOPMENT_TEAM: "$TEAM"
    # Shared/Assets.xcassets: the violet accent, for the system's own controls too.
    ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: AccentColor
    # Shared/Assets.xcassets/AppIcon (drawn by make-app-icon.py).
    ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
targets:
  # The iPhone and iPad app: https only (no ATS exception).
  HomelabClient-iOS:
    type: application
    platform: iOS
    sources:
      - path: "$SHARED"
    scheme:
      gatherCoverageData: false
$DEPENDENCIES
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: $PREFIX.HomelabClient
        PRODUCT_NAME: HomelabClient
        TARGETED_DEVICE_FAMILY: "1,2"
$SIGNED_FLAG
    info:
      path: Info-iOS.plist
      properties:
        CFBundleDisplayName: Homelab
$IOS_GROUP_INFO
        NSFaceIDUsageDescription: Face ID unlocks Homelab, which controls your servers.
        NSCameraUsageDescription: The camera scans the pairing QR code your computer shows, and takes a photo of a card for your Collection when you ask.
        NSLocalNetworkUsageDescription: Homelab talks to your homelab on the home network.
        ITSAppUsesNonExemptEncryption: false
        # Links into the app (homelab://, Shared/Models/DeepLink.swift).
        CFBundleURLTypes:
          - CFBundleURLName: \$(PRODUCT_BUNDLE_IDENTIFIER)
            CFBundleURLSchemes:
              - homelab
        UILaunchScreen: {}
        UIApplicationSceneManifest:
          UIApplicationSupportsMultipleScenes: true
        UISupportedInterfaceOrientations:
          - UIInterfaceOrientationPortrait
          - UIInterfaceOrientationLandscapeLeft
          - UIInterfaceOrientationLandscapeRight
        UISupportedInterfaceOrientations~ipad:
          - UIInterfaceOrientationPortrait
          - UIInterfaceOrientationPortraitUpsideDown
          - UIInterfaceOrientationLandscapeLeft
          - UIInterfaceOrientationLandscapeRight
    entitlements:
      path: HomelabClient-iOS.entitlements
      properties:
        keychain-access-groups:
          - "\$(AppIdentifierPrefix)$PREFIX.HomelabClient"
$IOS_GROUP_ENT
$SIGNED_ENT
$WIDGET_TARGETS
YAML

(cd "$OUT" && xcodegen generate --quiet)
echo "Made $OUT/HomelabClient.xcodeproj"
if [ -z "$TEAM" ]; then
  echo "No signing team found. Without one the app can't keep its key in the Keychain."
  echo "In Xcode: the HomelabClient target > Signing & Capabilities > Team, pick yours."
  echo "Running this script again resets it; pass the team ID as a second argument to keep it."
fi
[ -n "${HOMELAB_NO_OPEN:-}" ] || open "$OUT/HomelabClient.xcodeproj"
