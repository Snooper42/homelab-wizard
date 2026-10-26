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
  # Anything inside not theirs (a kopia command run as root through
  # docker exec leaves root's files) is handed back too.
  for dir in /app/config /app/cache /app/logs /repository; do
    [ -z "$(find "$dir" \( ! -user "$PUID" -o ! -group "$PGID" \) -print -quit 2>/dev/null)" ] || chown -R "$PUID:$PGID" "$dir" || true
  done
  # Where its restores land, beside the dumps it leaves alone.
  mkdir -p /staging/restore-test && chown "$PUID:$PGID" /staging/restore-test || true
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups /bin/sh "$0"
fi
if [ ! -w /repository ]; then
  echo "Kopia cannot write to its repository folder (KOPIA_REPOSITORY) as $(id -u):$(id -g)." >&2
  echo "A drive formatted exFAT or FAT takes its owner from how it was mounted: mount it as you, or choose another folder." >&2
  exit 1
fi
# Which repository its settings are connected to, by the ID in the
# repository's own file. When KOPIA_REPOSITORY points somewhere else, the
# settings would still say connected and write into a folder with no
# repository file, which nothing could open later: so a different
# repository, or none, means disconnect first.
id=$(grep -o '"uniqueID": *"[^"]*"' /repository/kopia.repository.f 2>/dev/null || true)
if [ -z "$id" ] || [ "$id" != "$(cat /app/config/homelab-repository.id 2>/dev/null)" ] || ! kopia repository status >/dev/null 2>&1; then
  [ -f /app/config/repository.config ] && kopia repository disconnect >/dev/null 2>&1 || true
  # The same owner on every machine, whoever runs it: homelab@homelab.
  if [ -n "$id" ]; then
    kopia repository connect filesystem --path=/repository --override-username=homelab --override-hostname=homelab
  else
    kopia repository create filesystem --path=/repository --override-username=homelab --override-hostname=homelab
    id=$(grep -o '"uniqueID": *"[^"]*"' /repository/kopia.repository.f)
  fi
  printf '%s\n' "$id" > /app/config/homelab-repository.id
fi
# After the nightly dumps (03:30), so each night's copy holds them.
for source in /source/appdata /source/homelab-appdata /source/stacks /source/immich /source/jellyfin /source/calibre /staging/databases /staging/secrets; do
  [ -d "$source" ] && kopia policy set "$source" --snapshot-time=03:45 --compression=zstd >/dev/null
done
exec kopia server start --insecure --address=0.0.0.0:51515 \
  --server-username=admin --server-password="$KOPIA_SERVER_PASSWORD" \
  --disable-csrf-token-checks
