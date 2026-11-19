#!/bin/bash
# Runs the scripts people run on their Mac against stand-ins for Xcode, the
# iPhone, the network and the homelab command, and checks what they print
# and do. Nothing real is built, installed, paired or changed.
#
#   apple-client/scripts/test-scripts.sh
#
# CI runs it (.github/workflows/apple-client.yml); it also runs on Linux.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
BIN="$WORK/bin" HL="$WORK/homelab" CALLS="$WORK/calls.log"
mkdir -p "$BIN" "$HL" "$WORK/home"
export CALLS
failures=0

# --- Stand-ins ---------------------------------------------------------------

stub() { printf '#!/bin/bash\n%s\n' "$2" >"$BIN/$1"; chmod +x "$BIN/$1"; }

# The homelab command: two paired devices, one used and one never; a pair
# prints a code, the https link, the home-Wi-Fi link and a QR code.
cat >"$HL/homelab" <<'EOF'
#!/bin/bash
[ "$1" = --no-color ] && shift
echo "homelab $*" >>"$CALLS"
case "$1 $2" in
  "phone list"|"phone ")
    printf '  a1b2c3  Test Mac      can make changes  no finances  paired 6 Nov 2026  last seen 6 Nov 05:50\n'
    printf '  0f9e8d  Test Mac      can make changes  no finances  paired 6 Nov 2026  last seen never\n'
    printf '  c0ffee  Test iPhone   looks only        no finances  paired 6 Nov 2026  last seen never\n' ;;
  "phone pair")
    printf 'Pair a phone\n  On the phone, open the companion and enter ABCD2345 (it works once, for 10 minutes):\n\n'
    printf '    https://homelab.example.com/#pair=ABCD2345\n    http://mac.local:8099/#pair=ABCD2345\n\n'
    printf '  Or scan this with the phone'"'"'s camera:\n\n  QRLINE1\n  QRLINE2\n\n  Then, in Safari: Share › Add to Home Screen.\n' ;;
  "phone remove") echo "  $3 is unpaired" ;;
esac
EOF
chmod +x "$HL/homelab"

stub dscacheutil 'echo "name: homelab.example.com"; echo "ip_address: ${FAKE_IP:-192.168.1.10}"'
stub curl 'if [ -n "${FAKE_CURL_RC:-}" ]; then echo "curl: (${FAKE_CURL_RC}) ${FAKE_CURL_ERR:-failed}" >&2; exit "$FAKE_CURL_RC"; fi; printf "%s" "${FAKE_HTTP:-401}"'
stub pgrep 'exit 1'
stub pkill 'exit 1'
stub osascript 'exit 0'
stub open 'echo "open $*" >>"$CALLS"'
stub scutil 'echo "Test Mac"'
stub pbcopy 'cat >"$CALLS.clipboard"'
stub security 'exit 1'
stub xcodegen 'mkdir -p HomelabClient.xcodeproj'
# go: there, but nothing it's asked builds (no network here); the project is made without the Finances code.
stub go 'echo "go $*" >>"$CALLS"; exit 1'
# xcodebuild: makes the app where the scheme's build puts it.
stub xcodebuild 'echo "xcodebuild $*" >>"$CALLS"
[ -n "${FAKE_BUILD_FAIL:-}" ] && { echo "Foo.swift:1:1: error: cannot find x in scope"; exit 65; }
[ -n "${FAKE_BUILD_DEVMODE:-}" ] && { echo "{ platform:iOS, name:iPhone, error:Developer Mode disabled To use iPhone for development, enable Developer Mode }"; exit 70; }
case "$*" in *HomelabClient-iOS*) d=Debug-iphoneos ;; *) d=Debug ;; esac
mkdir -p "$HOMELAB_XCODE_DIR/build/Build/Products/$d/HomelabClient.app"'
# xcrun devicectl: one iPhone (and a simulator, which is skipped).
stub system_profiler 'echo "${FAKE_USB:-}"'
stub ipconfig 'echo "${FAKE_WIFI_DNS:-}"'
stub dig 'echo "${FAKE_WIFI_IP:-}"'
stub xcrun 'if [ "$1 $2 $3" = "devicectl list devices" ]; then
[ -n "${FAKE_NO_PHONE:-}" ] && { echo '"'"'{"result":{"devices":[{"identifier":"SIM","deviceProperties":{"name":"Sim"},"hardwareProperties":{"platform":"iOS","reality":"virtual"},"connectionProperties":{}}]}}'"'"' >"$5"; exit 0; }
[ -n "${FAKE_UNPAIRED:-}" ] && { echo '"'"'{"result":{"devices":[{"identifier":"CORE-1","deviceProperties":{"name":"iPhone","developerModeStatus":"enabled"},"hardwareProperties":{"platform":"iOS","udid":"00008110-ABC"},"connectionProperties":{"pairingState":"unpaired","transportType":"wired"}}]}}'"'"' >"$5"; exit 0; }
[ -n "${FAKE_TWO:-}" ] && { echo '"'"'{"result":{"devices":[{"identifier":"CORE-1","deviceProperties":{"name":"Test iPhone 2","developerModeStatus":"enabled"},"hardwareProperties":{"platform":"iOS","udid":"00008110-ABC"},"connectionProperties":{"pairingState":"paired","transportType":"wired"}},{"identifier":"CORE-2","deviceProperties":{"name":"Test iPad","developerModeStatus":"enabled"},"hardwareProperties":{"platform":"iOS","udid":"00008120-DEF"},"connectionProperties":{"pairingState":"paired","transportType":"wired"}},{"identifier":"CORE-3","deviceProperties":{"name":"Old iPhone"},"hardwareProperties":{"platform":"iOS","udid":"00008030-OLD"},"connectionProperties":{"pairingState":"paired","tunnelState":"unavailable"}}]}}'"'"' >"$5"; exit 0; }
[ -n "${FAKE_ONE_WIRED:-}" ] && { echo '"'"'{"result":{"devices":[{"identifier":"CORE-2","deviceProperties":{"name":"iPad","developerModeStatus":"enabled"},"hardwareProperties":{"platform":"iOS","udid":"00008120-DEF"},"connectionProperties":{"pairingState":"paired","transportType":"localNetwork","tunnelState":"disconnected"}},{"identifier":"CORE-1","deviceProperties":{"name":"iPhone","developerModeStatus":"enabled"},"hardwareProperties":{"platform":"iOS","udid":"00008110-ABC"},"connectionProperties":{"pairingState":"paired","transportType":"wired"}}]}}'"'"' >"$5"; exit 0; }
[ -n "${FAKE_NONE_NEAR:-}" ] && { echo '"'"'{"result":{"devices":[{"identifier":"CORE-3","deviceProperties":{"name":"Old iPhone"},"hardwareProperties":{"platform":"iOS","udid":"00008030-OLD"},"connectionProperties":{"tunnelState":"unavailable"}},{"identifier":"CORE-4","deviceProperties":{"name":"Old iPad"},"hardwareProperties":{"platform":"iOS","udid":"00008030-OLD2"},"connectionProperties":{"tunnelState":"unavailable"}}]}}'"'"' >"$5"; exit 0; }
[ -n "${FAKE_NO_REALITY:-}" ] && { echo '"'"'{"result":{"devices":[{"identifier":"CORE-1","deviceProperties":{"name":"iPhone"},"hardwareProperties":{"platform":"iOS","udid":"00008110-ABC"},"connectionProperties":{"transportType":"wired"}}]}}'"'"' >"$5"; exit 0; }
cat >"$5" <<J
{"result":{"devices":[{"identifier":"CORE-1","deviceProperties":{"name":"Test iPhone 2","developerModeStatus":"${FAKE_DEVMODE:-enabled}"},"hardwareProperties":{"platform":"iOS","udid":"00008110-ABC","reality":"physical"},"connectionProperties":{"pairingState":"paired","tunnelState":"connected"}},{"identifier":"SIM","deviceProperties":{"name":"Sim"},"hardwareProperties":{"platform":"iOS","reality":"virtual"},"connectionProperties":{}}]}}
J
exit 0; fi
echo "xcrun $*" >>"$CALLS"'

# --- Checks --------------------------------------------------------------------

run() { # run <name> <command...>: output in $OUT, exit code in $RC
  : >"$CALLS"
  # HOMELAB_FINANCE_HOME: not this checkout's Frameworks/, which CI's Mac job has built the Finances code into.
  OUT="$(HOME="$WORK/home" HOMELAB_ROOT="$HL" HOMELAB_XCODE_DIR="$WORK/xcode" HOMELAB_FINANCE_HOME="$WORK/frameworks" PATH="$BIN:$PATH" "$@" 2>&1)"
  RC=$?
}
expect() { # expect <what> <condition...>
  local what="$1"; shift
  if "$@"; then echo "ok    $what"; else echo "FAIL  $what"; echo "$OUT" | sed 's/^/      | /'; failures=$((failures + 1)); fi
}
says() { grep -qF -- "$1" <<<"$OUT"; }
called() { grep -qF -- "$1" "$CALLS"; }
code() { [ "$RC" = "$1" ]; }

env_with() { printf '%s\n' "$@" >"$HL/.env"; }

echo "all scripts"
# macOS's bash 3.2 reads the bytes of a character like "…" right after $NAME
# as part of the name ("NAME…: unbound variable"): write ${NAME}… instead.
OUT="$(perl -ne 'print "$ARGV:$.: $_" if /\$[A-Za-z_]\w*[^\x00-\x7F]/; close ARGV if eof' "$HERE"/*.sh 2>&1)"
expect "no \$NAME right before a non-ASCII character" test -z "$OUT"

echo "make-xcode-project.sh"
yml="$WORK/xcode/project.yml"
yaml_ok() { command -v python3 >/dev/null && python3 -c 'import yaml' 2>/dev/null || return 0; python3 -c 'import sys, yaml; yaml.safe_load(open(sys.argv[1]))' "$yml"; }
run env HOMELAB_NO_OPEN=1 "$HERE/make-xcode-project.sh" com.example ABCDE12345
expect "the default project: no push, no widget, no signed code" bash -c '[ "$0" = 0 ] && ! grep -q "aps-environment\|HOMELAB_SIGNED\|HomelabWidget\|application-groups" "$1"' "$RC" "$yml"
expect "the default project is valid YAML" yaml_ok
expect "the app takes homelab:// links" bash -c 'grep -q "CFBundleURLSchemes:" "$0" && grep -q "^ *- homelab$" "$0"' "$yml"
run env HOMELAB_NO_OPEN=1 HOMELAB_WIDGET=1 "$HERE/make-xcode-project.sh" com.example ABCDE12345
expect "HOMELAB_WIDGET=1: the widget and its App Group, no push" bash -c '[ "$0" = 0 ] && grep -q "group.com.example.HomelabClient" "$1" && grep -q "HomelabWidget-iOS:" "$1" && ! grep -q "aps-environment\|HOMELAB_SIGNED" "$1"' "$RC" "$yml"
expect "the widget project is valid YAML" yaml_ok
run env HOMELAB_NO_OPEN=1 HOMELAB_SIGNED=1 "$HERE/make-xcode-project.sh" com.example ABCDE12345
expect "HOMELAB_SIGNED=1: push, the signed code, and the widget" bash -c '[ "$0" = 0 ] && grep -q "aps-environment: development" "$1" && grep -q "HOMELAB_SIGNED" "$1" && grep -q "HomelabWidget-iOS:" "$1"' "$RC" "$yml"
expect "the signed project is valid YAML" yaml_ok
run env HOMELAB_NO_OPEN=1 "$HERE/make-xcode-project.sh" com.example ABCDE12345
expect "Go that builds nothing: the project all the same, without the Finances code, and says so" bash -c '[ "$0" = 0 ] && grep -q "gomobile" "$2" && ! grep -q "HomelabFinance.xcframework" "$1"' "$RC" "$yml" "$CALLS"
expect "it says private Finances need Go" says "private Finances can't open in this build"
mkdir -p "$WORK/HomelabFinance.xcframework"
run env HOMELAB_NO_OPEN=1 HOMELAB_FINANCE_XCFRAMEWORK="$WORK/HomelabFinance.xcframework" HOMELAB_WIDGET=1 "$HERE/make-xcode-project.sh" com.example ABCDE12345
expect "the Finances code made: linked, not embedded, beside the widget" bash -c '[ "$0" = 0 ] && grep -q "framework: \"$2\"" "$1" && grep -q "embed: false" "$1" && grep -q "target: HomelabWidget-iOS" "$1" && [ "$(grep -c "dependencies:" "$1")" = 1 ]' "$RC" "$yml" "$WORK/HomelabFinance.xcframework"
expect "the project with the Finances code is valid YAML" yaml_ok
run env HOMELAB_NO_OPEN=1 HOMELAB_WIDGET=1 "$HERE/make-xcode-project.sh" com.example ABCDE12345
v="$("$HERE/app-version.sh")"
expect "the project carries the app's version and build (app-version.sh)" bash -c 'grep -q "MARKETING_VERSION: \"${0%% *}\"" "$1" && grep -q "CURRENT_PROJECT_VERSION: \"${0#* }\"" "$1"' "$v" "$yml"
expect "the app and its widget show the same version, so Xcode doesn't warn" bash -c '[ "$(grep -c "CFBundleShortVersionString: \$(MARKETING_VERSION)" "$0")" = 2 ] && [ "$(grep -c "CFBundleVersion: \$(CURRENT_PROJECT_VERSION)" "$0")" = 2 ]' "$yml"
expect "it says which version it made" says "The Homelab app ${v%% *} (build ${v#* })"

echo "app-version.sh"
# A history of its own: VERSION, then changes to the app and to other files.
repo="$WORK/version-repo"
mkdir -p "$repo/apple-client/scripts" "$repo/apple-client/Shared" "$repo/apple-client/Widget"
cp "$HERE/app-version.sh" "$repo/apple-client/scripts/"
g() { git -C "$repo" -c user.name=t -c user.email=t@example.com "$@" >/dev/null 2>&1; }
commit() { echo "$RANDOM" >>"$repo/apple-client/$1"; g add -A; g commit -m "$1"; }
g init -q
commit Shared/a.swift
printf '0.4\n' >"$repo/apple-client/VERSION"; commit Shared/b.swift
av() { OUT="$("$repo/apple-client/scripts/app-version.sh" 2>&1)"; RC=$?; }
av; expect "the change that sets VERSION is .0, and the build counts every change to the app" test "$OUT" = "0.4.0 2"
commit Shared/a.swift; commit Widget/w.swift
av; expect "each change to the app after it is one more" test "$OUT" = "0.4.2 4"
commit README.md; commit scripts/x.sh
av; expect "a change to the README or a script isn't a new version" test "$OUT" = "0.4.2 4"
printf '0.5\n' >"$repo/apple-client/VERSION"; g add -A; g commit -m "0.5"
av; expect "raising VERSION starts its count again; the build doesn't go back" test "$OUT" = "0.5.0 4"
commit Shared/a.swift
av; expect "and goes on from there" test "$OUT" = "0.5.1 5"
cp -r "$repo/apple-client" "$WORK/no-history"
OUT="$("$WORK/no-history/scripts/app-version.sh" 2>&1)"
expect "without the history: VERSION with .0, build 0" test "$OUT" = "0.5.0 0"
printf 'version 0.4\n' >"$WORK/no-history/VERSION"
OUT="$("$WORK/no-history/scripts/app-version.sh" 2>&1)"; RC=$?
expect "a VERSION that isn't two numbers stops it, saying why" bash -c '[ "$0" != 0 ] && grep -q "should be two numbers" <<<"$1"' "$RC" "$OUT"

echo "phones.sh"
run "$HERE/phones.sh"
expect "lists the devices" says "a1b2c3"
run "$HERE/phones.sh" remove "Test Mac"
expect "refuses a name, takes only an ID" code 2
run "$HERE/phones.sh" remove 123456
expect "refuses an ID nobody has" code 1
run "$HERE/phones.sh" remove 0f9e8d
expect "removes by ID" called "homelab phone remove 0f9e8d"
run bash -c "echo n | '$HERE/phones.sh' tidy"
expect "tidy asks first, and no removes nothing" bash -c '! grep -q "phone remove" "$CALLS"'
run bash -c "echo y | '$HERE/phones.sh' tidy"
expect "tidy removes every never-used device" bash -c 'grep -q "phone remove 0f9e8d" "$CALLS" && grep -q "phone remove c0ffee" "$CALLS" && ! grep -q "phone remove a1b2c3" "$CALLS"'

echo "phone-address.sh"
env_with 'HOMELAB_DOMAIN=' 'TAILSCALE_HOST='
run "$HERE/phone-address.sh"
expect "no domain: says how to set one" bash -c '[ "$0" = 1 ] && grep -q "homelab domain setup" <<<"$1"' "$RC" "$OUT"
env_with 'HOMELAB_DOMAIN="example.com"' 'SECRET=hunter2'
run "$HERE/phone-address.sh"
expect "the whole way works (401 behind the proxy)" bash -c '[ "$0" = 0 ] && grep -q "certificate is trusted" <<<"$1"' "$RC" "$OUT"
expect "never prints another setting from .env" bash -c '! grep -q hunter2 <<<"$0"' "$OUT"
expect "no proxy key yet: recommends setting up the domain again" says "./homelab domain setup"
env_with 'HOMELAB_DOMAIN="example.com"' 'COMPANION_PROXY_KEY=k3y-n0t-to-print'
run "$HERE/phone-address.sh"
expect "with the proxy key: no recommendation, and the key never shown" bash -c '! grep -q "domain setup" <<<"$0" && ! grep -q k3y-n0t <<<"$0"' "$OUT"
env_with 'HOMELAB_DOMAIN="example.com"' 'SECRET=hunter2'
FAKE_CURL_RC=60 FAKE_CURL_ERR="SSL certificate problem" run "$HERE/phone-address.sh"
expect "an untrusted certificate fails" bash -c '[ "$0" = 1 ] && grep -q "isn.t trusted" <<<"$1"' "$RC" "$OUT"
FAKE_HTTP=502 run "$HERE/phone-address.sh"
expect "the proxy without the companion" bash -c '[ "$0" = 1 ] && grep -q "schedule status" <<<"$1"' "$RC" "$OUT"
FAKE_HTTP=403 run "$HERE/phone-address.sh"
expect "through the tunnel is refused" bash -c '[ "$0" = 1 ] && grep -q "Cloudflare" <<<"$1"' "$RC" "$OUT"
FAKE_IP=203.0.113.5 run "$HERE/phone-address.sh"
expect "a public address is called out" says "isn't a home-network address"
FAKE_IP=127.0.0.1 FAKE_WIFI_DNS=192.168.1.10 FAKE_WIFI_IP=192.168.1.10 run "$HERE/phone-address.sh"
expect "loopback on the Mac that runs it: asks the Wi-Fi's DNS, which gives a home address" bash -c '[ "$0" = 0 ] && grep -q "from the Wi-Fi.s DNS, which the phone uses" <<<"$1" && ! grep -q "isn.t a home-network" <<<"$1"' "$RC" "$OUT"
FAKE_IP=127.0.0.1 FAKE_WIFI_DNS=192.168.1.1 run "$HERE/phone-address.sh"
expect "loopback, and the Wi-Fi's DNS doesn't know it: says so" says "192.168.1.1), which didn't answer"

echo "run-on-iphone.sh"
run "$HERE/run-on-iphone.sh"
expect "needs the prefix" code 2
run "$HERE/run-on-iphone.sh" com.example ABCDE12345
expect "builds the iOS scheme for the phone's UDID" called "-scheme HomelabClient-iOS -configuration Debug -destination id=00008110-ABC"
expect "installs on the phone" called "xcrun devicectl device install app --device CORE-1"
expect "opens the app" called "xcrun devicectl device process launch --device CORE-1 com.example.HomelabClient"
expect "pairs with the https link, named for the phone" called "homelab phone pair --name Test iPhone 2 --can-change"
expect "shows the QR code, not the Safari line" bash -c 'grep -q QRLINE1 <<<"$0" && ! grep -q Safari <<<"$0"' "$OUT"
expect "gives the address and code to type" says "https://homelab.example.com and the code ABCD2345"
FAKE_UNPAIRED=1 run "$HERE/run-on-iphone.sh" com.example ABCDE12345
expect "not trusted yet: the Mac asks the phone, then goes on" bash -c 'grep -q "devicectl manage pair --device CORE-1" "$CALLS" && grep -q "trusts this Mac" <<<"$0" && grep -q "id=00008110-ABC" "$CALLS"' "$OUT"
FAKE_NO_REALITY=1 run "$HERE/run-on-iphone.sh" com.example ABCDE12345
expect "a real iPhone that Xcode doesn't mark physical is still found" called "-destination id=00008110-ABC"
FAKE_TWO=1 run "$HERE/run-on-iphone.sh" com.example ABCDE12345
expect "an iPhone and an iPad connected: the app on each in turn, not the one Xcode only remembers" bash -c 'grep -q "install app --device CORE-1" "$0" && grep -q "install app --device CORE-2" "$0" && ! grep -q "CORE-3\|00008030" "$0" && grep -q "Up to date: Test iPhone 2, Test iPad" <<<"$1" && [ "$2" = 0 ]' "$CALLS" "$OUT" "$RC"
FAKE_ONE_WIRED=1 run "$HERE/run-on-iphone.sh" com.example ABCDE12345
expect "the iPhone on a cable, the iPad only on the Wi-Fi: just the iPhone, no names asked" bash -c '[ "$2" = 0 ] && grep -q "install app --device CORE-1" "$0" && ! grep -q "CORE-2" "$0" && grep -q "Found iPhone" <<<"$1"' "$CALLS" "$OUT" "$RC"
FAKE_TWO=1 HOMELAB_DEVICE="Test iPad" run "$HERE/run-on-iphone.sh" com.example ABCDE12345
expect "HOMELAB_DEVICE: only that one" bash -c 'grep -q "install app --device CORE-2" "$0" && ! grep -q "install app --device CORE-1" "$0"' "$CALLS"
FAKE_NONE_NEAR=1 run "$HERE/run-on-iphone.sh" com.example
expect "two known, none connected: says to plug one in" bash -c '[ "$0" = 1 ] && grep -q "none is connected now" <<<"$1" && ! grep -q "install app" "$2"' "$RC" "$OUT" "$CALLS"
FAKE_NO_PHONE=1 run "$HERE/run-on-iphone.sh" com.example
expect "no iPhone, none on USB: says to check the cable" bash -c '[ "$0" = 1 ] && grep -q "many only charge" <<<"$1"' "$RC" "$OUT"
FAKE_NO_PHONE=1 FAKE_USB="iPhone:" run "$HERE/run-on-iphone.sh" com.example
expect "no iPhone for Xcode, one on USB: says to open Xcode once" bash -c '[ "$0" = 1 ] && grep -q "open -a Xcode" <<<"$1"' "$RC" "$OUT"
FAKE_DEVMODE=disabled run "$HERE/run-on-iphone.sh" com.example
expect "Developer Mode off: says where to turn it on" bash -c '[ "$0" = 1 ] && grep -q "Developer Mode" <<<"$1"' "$RC" "$OUT"
FAKE_BUILD_DEVMODE=1 run "$HERE/run-on-iphone.sh" com.example
expect "Developer Mode off, found only by the build: says where to turn it on" bash -c '[ "$0" = 1 ] && grep -q "Turn On when it asks" <<<"$1"' "$RC" "$OUT"
FAKE_BUILD_FAIL=1 run "$HERE/run-on-iphone.sh" com.example
expect "a failed build shows the compiler's error" bash -c '[ "$0" = 1 ] && grep -q "cannot find x in scope" <<<"$1"' "$RC" "$OUT"

echo "update-phone.sh"
# A checkout of a stand-in origin's main, one commit behind it; run-on-iphone.sh a stand-in that says what it got.
export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.invalid GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.invalid
ORIGIN="$WORK/origin.git" CO="$WORK/checkout" SEED="$WORK/seed"
git init -q --bare -b main "$ORIGIN"
git init -q -b main "$SEED" && echo one >"$SEED/f" && git -C "$SEED" add f && git -C "$SEED" commit -qm one && git -C "$SEED" push -q "$ORIGIN" main
git clone -q "$ORIGIN" "$CO"
echo two >"$SEED/f" && git -C "$SEED" commit -qam "two, the newest" && git -C "$SEED" push -q "$ORIGIN" main
cat >"$WORK/run-stand-in" <<'EOF2'
#!/bin/bash
echo "run-on-iphone $*" >>"$CALLS"
EOF2
chmod +x "$WORK/run-stand-in"
up() { HOMELAB_CHECKOUT="$CO" HOMELAB_RUN_SCRIPT="$WORK/run-stand-in" HOMELAB_SHELL_RC="$WORK/home/.zshrc" run "$HERE/update-phone.sh" "$@"; }
up
expect "no prefix given, saved or in a project: asks for it" bash -c '[ "$0" = 2 ] && grep -q "com.yourname" <<<"$1" && ! grep -q run-on-iphone "$2"' "$RC" "$OUT" "$CALLS"
mkdir -p "$WORK/xcode/HomelabClient.xcodeproj"
printf '\t\tPRODUCT_BUNDLE_IDENTIFIER = com.found.HomelabClient.Widget;\n\t\tPRODUCT_BUNDLE_IDENTIFIER = com.found.HomelabClient;\n' >"$WORK/xcode/HomelabClient.xcodeproj/project.pbxproj"
up
expect "the prefix from the Xcode project the first run made, after pulling main" bash -c '[ "$0" = 0 ] && grep -q "run-on-iphone com.found" "$1" && [ "$(cat "$2/f")" = two ] && grep -q "two, the newest" <<<"$3"' "$RC" "$CALLS" "$CO" "$OUT"
expect "the prefix remembered" bash -c '[ "$(cat "$0/.config/homelab/phone-prefix")" = com.found ]' "$WORK/home"
up com.given
expect "a prefix given: used, and remembered for next time" bash -c 'grep -q "run-on-iphone com.given" "$0" && [ "$(cat "$1/.config/homelab/phone-prefix")" = com.given ]' "$CALLS" "$WORK/home"
up
expect "no prefix given: the one remembered" called "run-on-iphone com.given"
up 'com.bad;rm -rf'
expect "a prefix that isn't one is refused" bash -c '[ "$0" = 2 ] && ! grep -q run-on-iphone "$1"' "$RC" "$CALLS"
echo mine >"$CO/f"
up
expect "changes of its own: nothing pulled, nothing run" bash -c '[ "$0" = 1 ] && grep -q "changes of its own" <<<"$1" && ! grep -q run-on-iphone "$2"' "$RC" "$OUT" "$CALLS"
git -C "$CO" checkout -q -- f && git -C "$CO" checkout -q -b elsewhere
up
expect "another branch: says to switch, nothing run" bash -c '[ "$0" = 1 ] && grep -q "checkout main" <<<"$1" && ! grep -q run-on-iphone "$2"' "$RC" "$OUT" "$CALLS"
git -C "$CO" checkout -q main
up --add-command
up --add-command
expect "--add-command adds homelab-phone once" bash -c '[ "$(grep -c "alias homelab-phone=" "$0")" = 1 ] && grep -q "update-phone.sh" "$0"' "$WORK/home/.zshrc"
printf "export KEEP=1\nalias homelab-phone='/moved/away/update-phone.sh'\n" >"$WORK/home/.zshrc"
up --add-command
expect "--add-command points an old homelab-phone here, keeping the rest" bash -c '[ "$(grep -c "alias homelab-phone=" "$0")" = 1 ] && ! grep -q /moved/away "$0" && grep -q "$1/update-phone.sh" "$0" && grep -q "export KEEP=1" "$0"' "$WORK/home/.zshrc" "$HERE"

echo
if [ "$failures" = 0 ]; then echo "All script checks passed."; else echo "$failures script check(s) failed."; exit 1; fi
