#!/bin/sh
# Kopia's start in the homelab (compose/system.yaml): connect to its
# repository, making it the first time, give each source the nightly
# schedule, then serve the web page. KOPIA_PASSWORD encrypts the
# repository; keep it with the recovery kit.
set -e
# Started as root, like the linuxserver images: Kopia's own folders are
# handed to PUID/PGID, then everything after runs as them, so what it
# restores is yours to read and copy back.
if [ "$(id -u)" = 0 ] && [ "${PUID:-0}" != 0 ]; then
  for dir in /app/config /app/cache /app/logs /repository; do
    [ "$(stat -c %u:%g "$dir")" = "$PUID:$PGID" ] || chown -R "$PUID:$PGID" "$dir" || true
  done
  # Where its restores land, beside the dumps it leaves alone.
  mkdir -p /staging/restore-test && chown "$PUID:$PGID" /staging/restore-test || true
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups /bin/sh "$0"
fi
if ! kopia repository status >/dev/null 2>&1; then
  # The same owner on every machine, whoever runs it: homelab@homelab.
  if [ -f /repository/kopia.repository.f ]; then
    kopia repository connect filesystem --path=/repository --override-username=homelab --override-hostname=homelab
  else
    kopia repository create filesystem --path=/repository --override-username=homelab --override-hostname=homelab
  fi
fi
# After the nightly dumps (03:30), so each night's copy holds them.
for source in /source/appdata /source/homelab-appdata /source/stacks /source/immich /source/jellyfin /source/calibre /staging/databases /staging/secrets; do
  [ -d "$source" ] && kopia policy set "$source" --snapshot-time=03:45 --compression=zstd >/dev/null
done
exec kopia server start --insecure --address=0.0.0.0:51515 \
  --server-username=admin --server-password="$KOPIA_SERVER_PASSWORD" \
  --disable-csrf-token-checks
