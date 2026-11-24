#!/usr/bin/env python3
"""The app logos the iPhone app ships (Shared/Assets.xcassets/AppLogos, from
homarr-labs/dashboard-icons, Apache 2.0), for the computer's pages and the
phone's in the browser too: each at 64 px in web/dist/applogos/<id>.png, and
their ids in web/src/status/appLogos.ts, so a page asks only for the ones that
are there. Run after fetch-app-logos.py adds some (Pillow).

    python3 apple-client/scripts/web-app-logos.py
"""
import pathlib
import re

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "apple-client" / "Shared" / "Assets.xcassets" / "AppLogos"
OUT = ROOT / "web" / "dist" / "applogos"
IDS = ROOT / "web" / "src" / "status" / "appLogos.ts"
SIZE = 64

OUT.mkdir(parents=True, exist_ok=True)
ids = []
for d in sorted(SRC.glob("*.imageset")):
    app = d.name[: -len(".imageset")]
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", app):
        continue
    pngs = sorted(d.glob("*.png"))
    if not pngs:
        continue
    img = Image.open(pngs[0]).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    img.save(OUT / f"{app}.png", optimize=True)
    ids.append(app)
for old in OUT.glob("*.png"):
    if old.stem not in ids:
        old.unlink()
IDS.write_text(
    "// The apps with a logo in web/dist/applogos (made by apple-client/scripts/web-app-logos.py from the iPhone app's\n"
    "// AppLogos, homarr-labs/dashboard-icons, Apache 2.0). Don't edit by hand: run the script.\n"
    "export const appLogos = new Set([\n"
    + "".join(f"  '{i}',\n" for i in ids)
    + "]);\n"
)
print(f"{len(ids)} logos")
