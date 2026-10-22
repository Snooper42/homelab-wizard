#!/bin/sh
# Installs Homelab Wizard on a Mac or a Linux PC, or replaces the copy
# already there:
#
#   curl -fsSL https://raw.githubusercontent.com/Snooper42/homelab-wizard/main/install.sh | sh
#
# It downloads the newest build from the repository's Latest release and
# checks it against the SHA-256 checksum GitHub keeps for the file.
#
# On a Mac it copies the app to Applications and opens it. A file curl
# downloads carries no quarantine flag, so macOS opens the unsigned app
# without the "damaged" or "unidentified developer" warning, and no xattr
# step is needed.
#
# On Linux it installs the package for the system (.deb with apt, .rpm with
# dnf or rpm, the Arch package with pacman; sudo asks for the password), or,
# on SteamOS or with HOMELAB_APPIMAGE=1, puts the AppImage in
# ~/Applications. Windows has install.ps1.
set -eu

repo="${HOMELAB_REPO:-Snooper42/homelab-wizard}"

say() { printf '%s\n' "$*"; }
fail() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

os="$(uname -s)"
case "$os" in
Darwin) need="curl shasum hdiutil ditto" ;;
Linux)
  [ "$(uname -m)" = x86_64 ] || fail "the Linux builds are for x86-64 PCs; this one is $(uname -m)."
  need="curl sha256sum"
  ;;
*) fail "this installs the app on a Mac or a Linux PC; on Windows, use install.ps1 (see the README)." ;;
esac
for tool in $need; do
  has "$tool" || fail "$tool is missing."
done

tmp="$(mktemp -d)"
mnt="$tmp/mnt"
cleanup() {
  [ "$os" = Darwin ] && [ -d "$mnt" ] && hdiutil detach -quiet -force "$mnt" >/dev/null 2>&1
  rm -rf "$tmp"
}
trap cleanup EXIT INT TERM

# fetch PREFIX SUFFIX downloads the release file whose name starts with
# PREFIX and ends with SUFFIX into $tmp, checks it, and prints its path.
# The release's JSON is split one key per line, so it is read without jq:
# each asset lists its name before its digest and download address.
fetch() {
  [ -f "$tmp/release.json" ] || curl -fsSL -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$repo/releases/latest" -o "$tmp/release.json" ||
    fail "GitHub could not be reached."
  fields="$(tr ',{}[]' '\n\n\n\n\n' <"$tmp/release.json" | awk -v pre="$1" -v suf="$2" '
    /"name": *"/ { n = $0; sub(/.*"name": *"/, "", n); sub(/".*/, "", n)
      mine = index(n, pre) == 1 && substr(n, length(n) - length(suf) + 1) == suf; if (mine) name = n }
    mine && /"digest": *"sha256:/ { sub(/.*"sha256:/, ""); sub(/".*/, ""); sha = $0 }
    mine && /"browser_download_url": *"/ { sub(/.*"browser_download_url": *"/, ""); sub(/".*/, ""); url = $0 }
    END { if (sha != "" && url != "") print sha, name, url }')"
  [ -n "$fields" ] || fail "the Latest release has no $1…$2 with a checksum."
  sha="${fields%% *}"
  rest="${fields#* }"
  file="$tmp/${rest%% *}"
  url="${rest#* }"
  say "Downloading ${rest%% *}..." >&2
  curl -fL --progress-bar "$url" -o "$file" || fail "the download failed."
  if has shasum; then got="$(shasum -a 256 "$file" | awk '{print $1}')"; else got="$(sha256sum "$file" | awk '{print $1}')"; fi
  [ "$got" = "$sha" ] || fail "the download does not match GitHub's checksum (expected $sha, got $got); nothing was installed."
  printf '%s\n' "$file"
}

say "Looking up the newest build..."

if [ "$os" = Darwin ]; then
  name="Homelab Wizard.app"
  dmg="$(fetch Homelab-Wizard-macOS.dmg .dmg)"
  mkdir "$mnt"
  hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mnt" "$dmg" || fail "the disk image could not be opened."
  [ -d "$mnt/$name" ] || fail "the disk image holds no $name."

  # /Applications when this account can write to it (an administrator can),
  # else the Applications folder in the home folder.
  dir=/Applications
  [ -w "$dir" ] || { dir="$HOME/Applications"; mkdir -p "$dir"; }
  app="$dir/$name"

  if [ -d "$app" ]; then
    say "Quitting the running app..."
    osascript -e 'quit app "Homelab Wizard"' >/dev/null 2>&1 || true
    i=0
    while pgrep -f "$app/Contents/MacOS/" >/dev/null 2>&1 && [ $i -lt 50 ]; do sleep 0.2; i=$((i + 1)); done
    pkill -f "$app/Contents/Helpers/" 2>/dev/null || true
  fi

  # Copied beside the old app first, so a failed copy leaves it as it was.
  say "Copying the app to $dir..."
  rm -rf "$app.new" "$app.old"
  ditto "$mnt/$name" "$app.new" || { rm -rf "$app.new"; fail "the app could not be copied to $dir."; }
  [ -d "$app" ] && mv "$app" "$app.old"
  mv "$app.new" "$app"
  rm -rf "$app.old"
  xattr -dr com.apple.quarantine "$app" 2>/dev/null || true

  say "Opening Homelab Wizard. From now on it updates itself."
  open "$app"
  exit 0
fi

# Linux: the package the system installs, or the AppImage where there is
# none (SteamOS keeps its system read-only).
kind=appimage
if [ "${HOMELAB_APPIMAGE:-}" != 1 ] && ! grep -qi '^ID=steamos' /etc/os-release 2>/dev/null; then
  if has apt-get && has dpkg; then kind=deb
  elif has pacman; then kind=arch
  elif has dnf || has rpm; then kind=rpm
  fi
fi
sudo=""
[ "$(id -u)" = 0 ] || sudo=sudo
pkill -f "[h]omelab-wizard --tray" 2>/dev/null || true
case "$kind" in
deb)
  f="$(fetch homelab-wizard_ _amd64.deb)"
  say "Installing it with apt (sudo asks for your password)..."
  $sudo apt-get update -qq || true
  $sudo apt-get install -y --reinstall --allow-downgrades "$f" || fail "apt could not install it."
  app=/usr/bin/homelab-wizard
  ;;
rpm)
  f="$(fetch homelab-wizard- .x86_64.rpm)"
  say "Installing it (sudo asks for your password)..."
  if has dnf; then $sudo dnf install -y "$f"; else $sudo rpm -U --replacepkgs --oldpackage "$f"; fi || fail "the package could not be installed."
  app=/usr/bin/homelab-wizard
  ;;
arch)
  f="$(fetch homelab-wizard- -x86_64.pkg.tar.zst)"
  say "Installing it with pacman (sudo asks for your password)..."
  $sudo pacman -U --noconfirm "$f" || fail "pacman could not install it."
  app=/usr/bin/homelab-wizard
  ;;
appimage)
  f="$(fetch Homelab-Wizard-x86_64.AppImage .AppImage)"
  mkdir -p "$HOME/Applications"
  app="$HOME/Applications/Homelab-Wizard-x86_64.AppImage"
  chmod +x "$f"
  mv -f "$f" "$app"
  say "Put the AppImage in ~/Applications; Setup › Add to the app menu lists it with your apps."
  ;;
esac

say "Opening Homelab Wizard. From now on it updates itself."
if has setsid; then setsid "$app" >/dev/null 2>&1 </dev/null & else nohup "$app" >/dev/null 2>&1 </dev/null & fi
