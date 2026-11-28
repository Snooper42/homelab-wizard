#!/bin/bash
# The reliability reset's live check (Phase 4): the real Docker engine, a
# container's whole life, a folder shared with Docker, a volume and a
# PostgreSQL database backed up and restored, a Duplicati blind restore, the
# scheduled agent's launchd plist and PATH, each connected app, and the
# disks' runway, in a throwaway workspace: nothing of the household's is
# changed. It prints a PASS/FAIL table to paste back.
#
#   scripts/verify-mac-live.sh            run it
#   scripts/verify-mac-live.sh --keep     keep the workspace to look at
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "Homelab Wizard live check, $(date '+%a %b %-d %Y, %-I:%M %p %Z'), $(sw_vers -productName 2>/dev/null || uname -s) $(sw_vers -productVersion 2>/dev/null || uname -r), commit $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
exec ./homelab doctor --live "$@"
