#!/bin/bash
# The phones (and Macs) paired with the homelab on this computer.
#
#   apple-client/scripts/phones.sh               list them
#   apple-client/scripts/phones.sh tidy          remove the ones never used, after asking
#   apple-client/scripts/phones.sh remove <id>   remove one by its ID (the first column)
#
# A device that is removed can't reach the homelab any more: its token stops
# working at once. It takes IDs only, never names, since two devices can have
# the same name and the homelab would remove the first one.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=homelab-cli.sh
. "$HERE/homelab-cli.sh"
if ! find_homelab_cli; then
  echo "No homelab found in $HOMELAB. If it's somewhere else, run: HOMELAB_ROOT=/path/to/it $0 ${*:-}" >&2
  exit 1
fi

case "${1:-list}" in
  list)
    "${HOMELAB_CLI[@]}" phone list
    ;;
  remove)
    ID="${2:-}"
    if ! [[ "$ID" =~ ^[0-9a-f]{6}$ ]]; then
      echo "Give the device's ID, the six letters and numbers in the first column of: $0" >&2
      exit 2
    fi
    if ! phone_rows | grep -qE "^  $ID  "; then
      echo "No paired device has the ID $ID. The list:" >&2
      "${HOMELAB_CLI[@]}" phone list >&2
      exit 1
    fi
    "${HOMELAB_CLI[@]}" phone remove "$ID"
    ;;
  tidy)
    # A pairing that failed half way (the device got its token but couldn't
    # keep it) was never used, so it reads "last seen never".
    STALE="$(phone_rows | grep -E 'last seen never$' || true)"
    if [ -z "$STALE" ]; then
      echo "Every paired device has been used. Nothing to tidy."
      "${HOMELAB_CLI[@]}" phone list
      exit 0
    fi
    echo "These paired devices have never been used:"
    echo
    printf '%s\n' "$STALE"
    echo
    echo "A device you paired in the last few minutes but haven't opened yet is on this list too."
    read -r -p "Remove all of them? [y/N] " ANSWER
    case "$ANSWER" in
      y|Y|yes|Yes)
        printf '%s\n' "$STALE" | awk '{print $1}' | while read -r ID; do
          "${HOMELAB_CLI[@]}" phone remove "$ID"
        done
        echo
        "${HOMELAB_CLI[@]}" phone list
        ;;
      *)
        echo "Nothing removed."
        ;;
    esac
    ;;
  *)
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
