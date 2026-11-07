#!/usr/bin/env python3
"""Fetches a logo for every app the homelab knows, into the asset catalog.

    python3 apple-client/scripts/fetch-app-logos.py

It needs Pillow (pip install pillow). The app list is read from the
homelab's own compose files (compose.yaml, compose/*.yaml,
stacks/*/compose.yaml in this checkout), leaving out helpers marked
`internal`, plus the native apps. Each app's logo comes from
homarr-labs/dashboard-icons (Apache 2.0; apple-client/licenses/), made for
homelab dashboards. It's re-encoded from its pixels as a 180 px PNG (60 pt
at 3x), so nothing but the picture is kept, into
Shared/Assets.xcassets/AppLogos/<app id>.imageset. The phone companion,
the homelab itself, gets the app's own mark.

Run it again after apps are added to the catalog; it skips logos already
there unless --again is given. A name the logo set spells differently goes
in ALIASES below.
"""
import io
import json
import os
import sys
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.dirname(HERE)
REPO = os.path.dirname(CLIENT)
OUT = os.path.join(CLIENT, "Shared", "Assets.xcassets", "AppLogos")
SOURCE = "https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png/{}.png"
SIZE = 180

# App ids the logo set names differently, best first.
ALIASES = {
    "immich-server": ["immich"],
    "jellyfin-container": ["jellyfin"],
    "moneymatter-frontend": ["moneymatter"],
    "firefly-iii": ["firefly-iii", "firefly"],
    "firefly-iii-importer": ["firefly-iii", "firefly"],
    "beszel-agent": ["beszel"],
    "cloudflared": ["cloudflared", "cloudflare-zero-trust", "cloudflare"],
    "paperless": ["paperless-ngx", "paperless"],
    "paperless-ai": ["paperless-ai", "paperless-ngx"],
    "changedetection": ["changedetection", "changedetection-io"],
    "tandoor": ["tandoor-recipes", "tandoor"],
    "seerr": ["seerr", "jellyseerr", "overseerr"],
    "actual-budget": ["actual-budget", "actual"],
    "calibre-web": ["calibre-web", "calibre"],
    # Ad blocking on the tailnet: AdGuard Home, reached over the tailnet.
    "tailnet-dns": ["adguard-home"],
}

# Drawn here, not fetched: the companion is the homelab itself.
OWN_MARK = {"homelab-companion"}


def app_ids():
    """The apps in the homelab's compose files, helpers left out, and the native ones."""
    import glob

    try:
        import yaml
    except ImportError:
        sys.exit("This needs PyYAML too: pip install pyyaml")
    files = [os.path.join(REPO, "compose.yaml")]
    files += sorted(glob.glob(os.path.join(REPO, "compose", "*.yaml")))
    files += sorted(glob.glob(os.path.join(REPO, "stacks", "*", "compose.yaml")))
    ids = set()
    for path in files:
        if not os.path.exists(path):
            continue
        with open(path) as f:
            doc = yaml.safe_load(f) or {}
        for name, service in (doc.get("services") or {}).items():
            meta = (service or {}).get("x-homelab") or {}
            if not meta.get("internal"):
                ids.add(name)
        ids.update(doc.get("x-homelab-native") or [])
    return sorted(ids)


def too_light(image):
    """Whether a logo is white on nothing, made for dark backgrounds, so it
    would vanish on its white tile."""
    raw = image.convert("RGBA").resize((64, 64)).tobytes()
    seen = [raw[i:i + 4] for i in range(0, len(raw), 4) if raw[i + 3] > 128]
    if not seen:
        return False
    light = sum(1 for r, g, b, _ in seen if min(r, g, b) > 225)
    return light / len(seen) > 0.97


def fetch(names):
    """The first of names the logo set has, as an image. A white logo is
    swapped for the set's dark version of it, where there is one."""
    for name in names:
        found, image = fetch_one(name)
        if image is None:
            continue
        if too_light(image):
            dark, darker = fetch_one(f"{name}-dark")
            if darker is not None:
                return dark, darker
        return found, image
    return None, None


def fetch_one(name):
    """The logo set's image called name, or (None, None)."""
    try:
        with urllib.request.urlopen(SOURCE.format(name), timeout=30) as response:
            data = response.read(4 << 20)
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception:
        return None, None
    return name, image


# How much of the tile a logo on its own fills, so they all look the same size.
INSET = 0.74


def is_tile(image):
    """Whether the logo is already a square tile of its own (opaque corners)."""
    w, h = image.size
    if abs(w - h) > max(w, h) * 0.04:
        return False
    corners = [image.getpixel((x, y))[3] for x in (2, w - 3) for y in (2, h - 3)]
    return min(corners) > 200


def square(image):
    """The logo as a SIZE-wide square, from its pixels only.

    A logo that's already a tile is kept as it is. Any other is centred on a
    white tile, so dark logos read in Dark Mode and every app's icon is the
    same shape, the way the Home Screen shows them.
    """
    image = image.convert("RGBA")
    if is_tile(image):
        return image.resize((SIZE, SIZE), Image.LANCZOS)
    inner = round(SIZE * INSET)
    image.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    canvas.paste(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2), image)
    return canvas


def own_mark():
    """The companion's logo: the app's own server rack on its violet tile."""
    import importlib.util

    spec = importlib.util.spec_from_file_location("make_app_icon", os.path.join(HERE, "make-app-icon.py"))
    icon = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(icon)
    return icon.ios("light").convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)


def save(app_id, image):
    folder = os.path.join(OUT, f"{app_id}.imageset")
    os.makedirs(folder, exist_ok=True)
    image.save(os.path.join(folder, f"{app_id}.png"), optimize=True)
    with open(os.path.join(folder, "Contents.json"), "w") as f:
        json.dump({"images": [{"filename": f"{app_id}.png", "idiom": "universal", "scale": "3x"}],
                   "info": {"author": "xcode", "version": 1}}, f, indent=2)
        f.write("\n")


def main():
    again = "--again" in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith("--")] or app_ids()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "Contents.json"), "w") as f:
        json.dump({"info": {"author": "xcode", "version": 1}, "properties": {"provides-namespace": True}}, f, indent=2)
        f.write("\n")
    missing = []
    for app_id in ids:
        if not again and os.path.exists(os.path.join(OUT, f"{app_id}.imageset", f"{app_id}.png")):
            continue
        if app_id in OWN_MARK:
            save(app_id, own_mark())
            print(f"{app_id}: the app's own mark")
            continue
        name, image = fetch(ALIASES.get(app_id, [app_id]))
        if image is None:
            missing.append(app_id)
            continue
        save(app_id, square(image))
        print(f"{app_id}: {name}")
    if missing:
        print("No logo found for: " + ", ".join(missing) + " (add a name to ALIASES)")


if __name__ == "__main__":
    main()
