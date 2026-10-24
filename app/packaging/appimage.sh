#!/usr/bin/env bash
# Builds Homelab Wizard as an AppImage: one file that runs on Linux systems
# where WebKitGTK cannot be installed, such as SteamOS (read-only system,
# no package manager). It holds the app, the homelab CLI, and WebKitGTK
# with its helper processes.
#
# Run from the repository root after the Linux wails build, on the oldest
# distribution the AppImage should support (it needs that glibc or newer):
#
#   app/packaging/appimage.sh <homelab CLI binary> <output .AppImage> [tools dir]
#
# The tools dir holds linuxdeploy-x86_64.AppImage, its GTK plugin, and its
# AppImage plugin; they are downloaded at the pinned versions when missing.
set -euo pipefail

cli="$1"
out="$2"
tools="${3:-build/appimage-tools}"
appdir="build/appimage/AppDir"

LINUXDEPLOY=1-alpha-20251107-1
PLUGIN_APPIMAGE=1-alpha-20250213-1
PLUGIN_GTK=7a3fbc31a9e5075073ff8790f26effbac5f84453

mkdir -p "$tools"
fetch() {
	[ -s "$tools/$1" ] || curl -fsSL -o "$tools/$1" "$2"
	chmod +x "$tools/$1"
}
fetch linuxdeploy-x86_64.AppImage "https://github.com/linuxdeploy/linuxdeploy/releases/download/$LINUXDEPLOY/linuxdeploy-x86_64.AppImage"
fetch linuxdeploy-plugin-appimage-x86_64.AppImage "https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/$PLUGIN_APPIMAGE/linuxdeploy-plugin-appimage-x86_64.AppImage"
fetch linuxdeploy-plugin-gtk.sh "https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/$PLUGIN_GTK/linuxdeploy-plugin-gtk.sh"
export PATH="$PWD/$tools:$PATH"
# Runs the tools without FUSE (containers and CI runners often lack it).
export APPIMAGE_EXTRACT_AND_RUN=1

rm -rf "$appdir"
id=io.github.snooper42.HomelabWizard
mkdir -p "$appdir/usr/bin" "$appdir/usr/share/applications" "$appdir/usr/share/metainfo" "$appdir/usr/share/icons/hicolor/256x256/apps"
install -m 755 app/build/bin/homelab-wizard "$appdir/usr/bin/homelab-wizard"
install -m 644 "app/packaging/$id.desktop" "$appdir/usr/share/applications/$id.desktop"
install -m 644 "app/packaging/$id.metainfo.xml" "$appdir/usr/share/metainfo/$id.appdata.xml"
convert app/build/linux/icon.png -resize 256x256 "$appdir/usr/share/icons/hicolor/256x256/apps/homelab-wizard.png"

# WebKitGTK starts its network and web processes from a folder fixed when
# it was built (/usr/lib/<arch>/webkit2gtk-4.1). Copy that folder in, and
# below point the library at the copy.
webkit_lib="$(pkg-config --variable=libdir webkit2gtk-4.1)"
webkit_exec="$webkit_lib/webkit2gtk-4.1"
mkdir -p "$appdir$webkit_exec"
cp -a "$webkit_exec"/WebKit*Process "$webkit_exec"/injected-bundle "$appdir$webkit_exec/"

linuxdeploy-x86_64.AppImage --appdir "$appdir" \
	--executable "$appdir/usr/bin/homelab-wizard" \
	--deploy-deps-only "$appdir$webkit_exec" \
	--desktop-file "$appdir/usr/share/applications/$id.desktop" \
	--icon-file "$appdir/usr/share/icons/hicolor/256x256/apps/homelab-wizard.png" \
	--plugin gtk

# The CLI is a static Go binary; linuxdeploy fails on files without
# dynamic dependencies, so it goes in afterwards.
install -m 755 "$cli" "$appdir/usr/bin/homelab"
# The homelab files, so the app can make the homelab folder itself.
if [ -f build/homelab-kit.tar.gz ]; then
	install -D -m 644 build/homelab-kit.tar.gz "$appdir/usr/share/homelab-wizard/homelab-kit.tar.gz"
fi

# Replace the library's /usr/lib/<arch>/webkit2gtk-4.1 with ././/lib/<arch>/
# webkit2gtk-4.1: the same length, so the library stays valid, and relative
# to the working folder, which AppRun sets to the AppImage's usr folder.
python3 - "$appdir/usr/lib" "$webkit_exec" <<'EOF'
import glob, sys
libdir, exec_dir = sys.argv[1], sys.argv[2].encode()
assert exec_dir.startswith(b"/usr/")
relative = b"././" + exec_dir[len(b"/usr"):]
patched = 0
for path in glob.glob(libdir + "/libwebkit2gtk-4.1.so*"):
    data = open(path, "rb").read()
    if exec_dir in data:
        open(path, "wb").write(data.replace(exec_dir, relative))
        patched += 1
if not patched:
    sys.exit("no libwebkit2gtk-4.1 holding " + exec_dir.decode() + " was found to patch")
EOF

# AppRun: the GTK plugin's settings, then the app from inside usr (above).
rm -f "$appdir/AppRun" "$appdir/AppRun.wrapped"
cat > "$appdir/AppRun" <<'EOF'
#!/bin/sh
# Written by app/packaging/appimage.sh.
HERE="$(dirname "$(readlink -f "$0")")"
export APPDIR="${APPDIR:-$HERE}"
for hook in "$APPDIR"/apprun-hooks/*.sh; do
	[ -e "$hook" ] && . "$hook"
done
# WebKitGTK finds its helper processes relative to this folder.
cd "$APPDIR/usr" || exit 1
exec "$APPDIR/usr/bin/homelab-wizard" "$@"
EOF
chmod 755 "$appdir/AppRun"

# The AppStream metadata is checked here, without the network: the plugin's
# own check fetches its URLs, and the repository's pages are private.
if command -v appstreamcli >/dev/null; then
	appstreamcli validate --no-net "$appdir/usr/share/metainfo/$id.appdata.xml"
fi

mkdir -p "$(dirname "$out")"
LDAI_NO_APPSTREAM=1 LDAI_OUTPUT="$out" linuxdeploy-plugin-appimage-x86_64.AppImage --appdir "$appdir"
echo "wrote $out"
