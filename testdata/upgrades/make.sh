#!/bin/sh
# Makes testdata/upgrades/<tag>: the files a homelab folder of that release
# keeps (.env, data/*.json, scripts/logs/*.json), written by that release's
# own code. For each tag: its CLI installs ntfy against a stand-in Docker
# (so .env is made as that release made it), holds ntfy's updates, and two
# settings are changed as a person would in Settings; then make/main.go,
# built inside that tag, writes the rest.
#
#   testdata/upgrades/make.sh v0.2.0 v0.3.0 ...
#
# Run from the repository; it needs git, Go, and the tags.
set -eu
repo=$(git rev-parse --show-toplevel)
work=$(mktemp -d)
trap 'git -C "$repo" worktree prune; rm -rf "$work"' EXIT

mkdir -p "$work/bin" "$work/home"
cat > "$work/bin/docker" <<'EOF'
#!/bin/sh
# A stand-in Docker: answers what the CLI asks to find an engine, and
# succeeds at everything else without doing it.
# With FIXTURE_NTFY set, ntfy's container runs.
case "$1 ${2:-}" in
  "ps "*) [ -n "${FIXTURE_NTFY:-}" ] && echo id0;;
  "inspect "*) [ -n "${FIXTURE_NTFY:-}" ] && echo '[{"Id":"id0","Name":"/homelab_security-ntfy-1","Image":"sha256:2222222222222222222222222222222222222222222222222222222222222222","Config":{"Image":"binwiederhier/ntfy:latest","Labels":{"com.docker.compose.project":"homelab_security","com.docker.compose.service":"ntfy"}},"State":{"Status":"running","Running":true},"Mounts":[],"NetworkSettings":{"Ports":{}}}]' || echo '[]';;
  "info "*) echo '{"ServerVersion":"27.0.0","OperatingSystem":"Docker Engine","Name":"fixture","Architecture":"x86_64","NCPU":4,"MemTotal":8589934592}';;
  "compose version") echo "2.29.1";;
  "version "*) echo "27.0.0";;
esac
exit 0
EOF
chmod +x "$work/bin/docker"

for tag in "$@"; do
  src="$work/src-$tag" root="$work/root-$tag" out="$repo/testdata/upgrades/$tag"
  git -C "$repo" worktree add -q --detach "$src" "$tag"
  (cd "$src" && go build -o "$work/homelab-$tag" ./cmd/homelab)
  mkdir -p "$root" && git -C "$repo" archive "$tag" | tar -x -C "$root"
  hl() { PATH="$work/bin:$PATH" HOME="$work/home" "$work/homelab-$tag" --root "$root" --no-color "$@" >"$work/out" 2>&1 || { cat "$work/out"; exit 1; }; }
  hl install ntfy --apply
  FIXTURE_NTFY=1 hl updates hold ntfy
  # Settings a person changed: the time zone and ntfy's port.
  for kv in TZ=Europe/Amsterdam NTFY_PORT=9393; do
    key=${kv%%=*}
    grep -v "^$key=" "$root/.env" > "$work/env" || true
    echo "$kv" >> "$work/env" && cat "$work/env" > "$root/.env"
  done
  mkdir -p "$src/cmd/fixture" && cp "$repo/testdata/upgrades/make/main.go" "$src/cmd/fixture/main.go"
  (cd "$src" && go run ./cmd/fixture/main.go "$root")
  rm -rf "$out" && mkdir -p "$out/data" "$out/scripts/logs"
  # Named as the backup names its copy, since .env is ignored by git.
  cp "$root/.env" "$out/homelab.env"
  cp "$root"/data/*.json "$out/data/"
  cp "$root"/scripts/logs/*.json "$out/scripts/logs/"
  # The stand-in home folder becomes a person's, the same in every set.
  find "$out" -type f -exec sed -i.bak "s|$work/home|/home/sam|g" {} \; -exec rm {}.bak \;
  git -C "$repo" worktree remove --force "$src"
  echo "made $out"
done
