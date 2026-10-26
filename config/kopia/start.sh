#!/bin/sh
# Kopia's start in the homelab (compose/system.yaml): connect to its
# repository, making it the first time, give each source the nightly
# schedule, then serve the web page. KOPIA_PASSWORD encrypts the
# repository; keep it with the recovery kit.
set -e
if ! kopia repository status >/dev/null 2>&1; then
  if [ -f /repository/kopia.repository.f ]; then
    kopia repository connect filesystem --path=/repository
  else
    kopia repository create filesystem --path=/repository
  fi
fi
# After the nightly dumps (03:30), so each night's copy holds them.
for source in /source/appdata /source/homelab-appdata /source/stacks /source/immich /source/jellyfin /source/calibre /staging/databases /staging/secrets; do
  [ -d "$source" ] && kopia policy set "$source" --snapshot-time=03:45 --compression=zstd >/dev/null
done
exec kopia server start --insecure --address=0.0.0.0:51515 \
  --server-username=admin --server-password="$KOPIA_SERVER_PASSWORD" \
  --disable-csrf-token-checks
