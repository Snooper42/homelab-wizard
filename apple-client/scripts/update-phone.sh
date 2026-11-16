#!/bin/bash
# Puts the newest Homelab app on the iPhone (or iPad) plugged into this Mac:
# goes to this checkout, pulls main, and runs run-on-iphone.sh with the
# prefix used before. The one command for every new version.
#
#   apple-client/scripts/update-phone.sh                 # the prefix used last time
#   apple-client/scripts/update-phone.sh com.yourname    # a prefix, remembered from now on
#   HOMELAB_DEVICE="My iPad" apple-client/scripts/update-phone.sh
#   apple-client/scripts/update-phone.sh --add-command   # then `homelab-phone` from any folder
#
# The prefix comes from the command line, else the one this script saved
# (~/.config/homelab/phone-prefix), else the Xcode project run-on-iphone.sh
# made the first time. It pulls only a clean checkout of main, and only
# forward (git pull --ff-only), so nothing of yours is ever merged or lost.
set -uo pipefail

# All of it in one function, read before it runs: git pull may change this file while it does.
main() {
  HERE="$(cd "$(dirname "$0")" && pwd)"
  # The checkout this script is in (tests point it elsewhere).
  ROOT="${HOMELAB_CHECKOUT:-$(cd "$HERE/../.." && pwd)}"
  RUN="${HOMELAB_RUN_SCRIPT:-$HERE/run-on-iphone.sh}"
  SAVED="${XDG_CONFIG_HOME:-$HOME/.config}/homelab/phone-prefix"
  PROJECT="${HOMELAB_XCODE_DIR:-$HOME/Developer/HomelabClient-xcode}/HomelabClient.xcodeproj/project.pbxproj"

  if [ "${1:-}" = --add-command ]; then
    RC_FILE="${HOMELAB_SHELL_RC:-$HOME/.zshrc}"
    LINE="alias homelab-phone='$HERE/update-phone.sh'"
    if [ -f "$RC_FILE" ] && grep -qF "alias homelab-phone=" "$RC_FILE"; then
      echo "homelab-phone is already in $RC_FILE."
    else
      printf '\n# The newest Homelab app on the iPhone plugged into this Mac (homelab-wizard)\n%s\n' "$LINE" >>"$RC_FILE"
      echo "Added homelab-phone to $RC_FILE. Open a new Terminal window, then run: homelab-phone"
    fi
    exit 0
  fi

  PREFIX="${1:-}"
  if [ -z "$PREFIX" ] && [ -f "$SAVED" ]; then PREFIX="$(head -1 "$SAVED" | tr -d '[:space:]')"; fi
  if [ -z "$PREFIX" ] && [ -f "$PROJECT" ]; then
    PREFIX="$(sed -n 's/.*PRODUCT_BUNDLE_IDENTIFIER = "\{0,1\}\([A-Za-z0-9.-]*\)\.HomelabClient"\{0,1\};.*/\1/p' "$PROJECT" | head -1)"
  fi
  if [ -z "$PREFIX" ]; then
    echo "Which prefix? Run it once with the one you chose the first time, for example:" >&2
    echo "  $0 com.yourname" >&2
    exit 2
  fi
  case "$PREFIX" in
    *[!a-zA-Z0-9.-]*|.*|*.) echo "The prefix may only have letters, numbers, dots and hyphens: $PREFIX" >&2; exit 2 ;;
  esac

  cd "$ROOT" || { echo "Couldn't go to $ROOT" >&2; exit 1; }
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  if [ "$BRANCH" != main ]; then
    echo "This checkout ($ROOT) is on ${BRANCH:-no branch}, not main. Switch first: git -C \"$ROOT\" checkout main" >&2
    exit 1
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "This checkout ($ROOT) has changes of its own, so it isn't pulled. See them with: git -C \"$ROOT\" status" >&2
    exit 1
  fi
  echo "Pulling the newest version into ${ROOT}…"
  if ! git pull --ff-only --quiet; then
    echo "Couldn't pull (no network, or main went somewhere this checkout can't follow). Nothing was changed." >&2
    exit 1
  fi
  echo "Now at: $(git log -1 --format='%h %s')"

  mkdir -p "$(dirname "$SAVED")" && printf '%s\n' "$PREFIX" >"$SAVED"
  exec "$RUN" "$PREFIX" "${2:-}"
}
main "$@"
exit
