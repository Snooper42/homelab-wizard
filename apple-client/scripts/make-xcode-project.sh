#!/bin/bash
# Makes the Xcode project for the Mac and iPhone apps, with every setting the README's
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

# The Home Screen and desktop widget (Widget/), only with HOMELAB_WIDGET=1:
# it needs an App Group, which a free Apple ID may not sign, so the default
# project leaves it out and can't fail on it. The pieces below stay empty
# without it, and the project comes out as before.
MAC_WIDGET_DEP="" IOS_WIDGET_DEP="" MAC_GROUP_INFO="" IOS_GROUP_INFO=""
MAC_GROUP_ENT="" IOS_GROUP_ENT="" WIDGET_TARGETS=""
if [ -n "${HOMELAB_WIDGET:-}" ]; then
  # The Mac's App Groups carry the team's prefix; iPhone's start with "group.".
  MAC_GROUP="\$(TeamIdentifierPrefix)$PREFIX.HomelabClient"
  IOS_GROUP="group.$PREFIX.HomelabClient"
  MAC_WIDGET_DEP="    dependencies:
      - target: HomelabWidget"
  IOS_WIDGET_DEP="    dependencies:
      - target: HomelabWidget-iOS"
  MAC_GROUP_INFO="        HomelabAppGroup: \"$MAC_GROUP\""
  IOS_GROUP_INFO="        HomelabAppGroup: \"$IOS_GROUP\""
  MAC_GROUP_ENT="        com.apple.security.application-groups:
          - \"$MAC_GROUP\""
  IOS_GROUP_ENT="        com.apple.security.application-groups:
          - \"$IOS_GROUP\""
  WIDGET_TARGETS="  # The desktop widget: \"All well\" or how many need a look (Widget/).
  HomelabWidget:
    type: app-extension
    platform: macOS
    sources:
      - path: \"$HERE/Widget\"
      - path: \"$SHARED/Views/Theme.swift\"
      - path: \"$SHARED/Models/WidgetSummary.swift\"
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: $PREFIX.HomelabClient.Widget
        PRODUCT_NAME: HomelabWidget
        ENABLE_HARDENED_RUNTIME: YES
    info:
      path: Widget-macOS.plist
      properties:
        CFBundleDisplayName: Homelab
$MAC_GROUP_INFO
        NSExtension:
          NSExtensionPointIdentifier: com.apple.widgetkit-extension
    entitlements:
      path: HomelabWidget.entitlements
      properties:
        com.apple.security.app-sandbox: true
$MAC_GROUP_ENT
  # The Home Screen widget, the same on iPhone and iPad.
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
cat > "$OUT/project.yml" <<YAML
name: HomelabClient
options:
  bundleIdPrefix: $PREFIX
  deploymentTarget:
    macOS: "14.0"
    iOS: "17.0"
settings:
  base:
    SWIFT_VERSION: "6.0"
    # The sources mark @MainActor where they mean it.
    SWIFT_DEFAULT_ACTOR_ISOLATION: nonisolated
    SWIFT_APPROACHABLE_CONCURRENCY: NO
    CODE_SIGN_STYLE: Automatic
    DEVELOPMENT_TEAM: "$TEAM"
    # Shared/Assets.xcassets: the blue accent, for the system's own controls too.
    ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: AccentColor
    # Shared/Assets.xcassets/AppIcon (drawn by make-app-icon.py).
    ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
targets:
  # The Mac app.
  HomelabClient:
    type: application
    platform: macOS
    sources:
      - path: "$SHARED"
    scheme:
      gatherCoverageData: false
$MAC_WIDGET_DEP
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: $PREFIX.HomelabClient
        PRODUCT_NAME: HomelabClient
        ENABLE_HARDENED_RUNTIME: YES
    info:
      path: Info.plist
      properties:
        CFBundleDisplayName: Homelab
$MAC_GROUP_INFO
        LSApplicationCategoryType: public.app-category.utilities
        NSFaceIDUsageDescription: Touch ID unlocks Homelab, which controls your servers.
        NSLocalNetworkUsageDescription: Homelab talks to your homelab on the home network.
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
        # Makes Xcode sign with a provisioning profile, which the
        # data-protection Keychain needs (else errSecMissingEntitlement, -34018).
        keychain-access-groups:
          - "\$(AppIdentifierPrefix)$PREFIX.HomelabClient"
$MAC_GROUP_ENT
  # The iPhone and iPad app: the same sources, https only (no ATS exception).
  HomelabClient-iOS:
    type: application
    platform: iOS
    sources:
      - path: "$SHARED"
    scheme:
      gatherCoverageData: false
$IOS_WIDGET_DEP
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: $PREFIX.HomelabClient
        PRODUCT_NAME: HomelabClient
        TARGETED_DEVICE_FAMILY: "1,2"
    info:
      path: Info-iOS.plist
      properties:
        CFBundleDisplayName: Homelab
$IOS_GROUP_INFO
        NSFaceIDUsageDescription: Face ID unlocks Homelab, which controls your servers.
        NSCameraUsageDescription: The camera scans the pairing QR code your computer shows.
        NSLocalNetworkUsageDescription: Homelab talks to your homelab on the home network.
        ITSAppUsesNonExemptEncryption: false
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
