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
# xcodebuild: makes the app where the scheme's build puts it.
stub xcodebuild 'echo "xcodebuild $*" >>"$CALLS"
[ -n "${FAKE_BUILD_FAIL:-}" ] && { echo "Foo.swift:1:1: error: cannot find x in scope"; exit 65; }
case "$*" in *HomelabClient-iOS*) d=Debug-iphoneos ;; *) d=Debug ;; esac
mkdir -p "$HOMELAB_XCODE_DIR/build/Build/Products/$d/HomelabClient.app"'
# xcrun devicectl: one iPhone (and a simulator, which is skipped).
stub xcrun 'if [ "$1 $2 $3" = "devicectl list devices" ]; then
cat >"$5" <<J
{"result":{"devices":[{"identifier":"CORE-1","deviceProperties":{"name":"Test iPhone 2","developerModeStatus":"${FAKE_DEVMODE:-enabled}"},"hardwareProperties":{"platform":"iOS","udid":"00008110-ABC","reality":"physical"},"connectionProperties":{"pairingState":"paired","tunnelState":"connected"}},{"identifier":"SIM","deviceProperties":{"name":"Sim"},"hardwareProperties":{"platform":"iOS","reality":"virtual"},"connectionProperties":{}}]}}
J
exit 0; fi
echo "xcrun $*" >>"$CALLS"'

# --- Checks --------------------------------------------------------------------

run() { # run <name> <command...>: output in $OUT, exit code in $RC
  : >"$CALLS"
  OUT="$(HOME="$WORK/home" HOMELAB_ROOT="$HL" HOMELAB_XCODE_DIR="$WORK/xcode" PATH="$BIN:$PATH" "$@" 2>&1)"
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
FAKE_CURL_RC=60 FAKE_CURL_ERR="SSL certificate problem" run "$HERE/phone-address.sh"
expect "an untrusted certificate fails" bash -c '[ "$0" = 1 ] && grep -q "isn.t trusted" <<<"$1"' "$RC" "$OUT"
FAKE_HTTP=502 run "$HERE/phone-address.sh"
expect "the proxy without the companion" bash -c '[ "$0" = 1 ] && grep -q "schedule status" <<<"$1"' "$RC" "$OUT"
FAKE_HTTP=403 run "$HERE/phone-address.sh"
expect "through the tunnel is refused" bash -c '[ "$0" = 1 ] && grep -q "Cloudflare" <<<"$1"' "$RC" "$OUT"
FAKE_IP=203.0.113.5 run "$HERE/phone-address.sh"
expect "a public address is called out" says "isn't a home-network address"

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
FAKE_DEVMODE=disabled run "$HERE/run-on-iphone.sh" com.example
expect "Developer Mode off: says where to turn it on" bash -c '[ "$0" = 1 ] && grep -q "Developer Mode" <<<"$1"' "$RC" "$OUT"
FAKE_BUILD_FAIL=1 run "$HERE/run-on-iphone.sh" com.example
expect "a failed build shows the compiler's error" bash -c '[ "$0" = 1 ] && grep -q "cannot find x in scope" <<<"$1"' "$RC" "$OUT"

echo "run-on-this-mac.sh"
run "$HERE/run-on-this-mac.sh" com.example ABCDE12345
expect "builds and opens the Mac app" bash -c 'grep -q "scheme HomelabClient " "$CALLS" && grep -q "open .*Debug/HomelabClient.app" "$CALLS"'
expect "already paired and used: no new code" bash -c 'grep -q "already paired" <<<"$0" && ! grep -q "phone pair" "$CALLS"' "$OUT"
HOMELAB_PAIR_AGAIN=1 run "$HERE/run-on-this-mac.sh" com.example ABCDE12345
expect "asked to pair again: the localhost link is on the clipboard" bash -c '[ "$(cat "$CALLS.clipboard")" = "localhost:8099/#pair=ABCD2345" ]'

echo
if [ "$failures" = 0 ]; then echo "All script checks passed."; else echo "$failures script check(s) failed."; exit 1; fi
