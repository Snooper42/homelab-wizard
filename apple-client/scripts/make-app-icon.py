#!/usr/bin/env python3
"""Draws the app icon into Shared/Assets.xcassets/AppIcon.appiconset.

    python3 apple-client/scripts/make-app-icon.py

It needs Pillow (pip install pillow). The icon is the app's own mark
(Theme.swift's AppMark), turned inside out as the owner chose (Nov 2026,
"more like Proton Mail"): a violet server rack on a white tile, with one
mint light that says "running". Made from shapes alone, so it can be
drawn again at any size.

- iPhone and iPad: one 1024 px square, edge to edge (iOS rounds the
  corners), plus the dark and tinted variants iOS 18 shows.
"""
import json
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "Shared", "Assets.xcassets", "AppIcon.appiconset")
SS = 4  # drawn this many times larger, then shrunk, for smooth edges

VIOLET_TOP = (0x7B, 0x62, 0xFF)
VIOLET_BOTTOM = (0x45, 0x2A, 0xBD)
# The white tile, a breath of violet toward its foot, and the rack's violet.
WHITE_TOP = (0xFF, 0xFF, 0xFF)
WHITE_BOTTOM = (0xEE, 0xEB, 0xFB)
RACK_TOP = (0x8F, 0x78, 0xFF)
RACK_BOTTOM = (0x55, 0x37, 0xE0)
DARK_TOP = (0x24, 0x1E, 0x33)
DARK_BOTTOM = (0x11, 0x0E, 0x18)
MINT = (0x3C, 0xC7, 0x9F)


def gradient(size, top, bottom):
    """A diagonal gradient, top-left to bottom-right."""
    small = Image.new("RGB", (256, 256))
    px = small.load()
    for y in range(256):
        for x in range(256):
            t = (x + y) / 510
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
    return small.resize((size, size), Image.BICUBIC)


def glow(size, strength):
    """A soft white light from the top left, as an alpha mask."""
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    r = size * 0.62
    cx, cy = size * 0.22, size * 0.08
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=round(255 * strength))
    return mask.filter(ImageFilter.GaussianBlur(size * 0.18))


# How much of the tile the rack fills: larger than it was on the violet
# tile, as Proton Mail's mark fills its white one.
RACK_SCALE = 1.22


def rack(draw, size, unit, hole, light):
    """The server rack: three units, each with two lights and two vents.

    `unit` is the units' colour, `hole` the colour of what's cut into
    them, `light` the top unit's first light (the running one)."""
    s = size / 1024 * RACK_SCALE
    w, h, gap, radius = 560 * s, 136 * s, 36 * s, 34 * s
    left = (size - w) / 2
    top = (size - (3 * h + 2 * gap)) / 2
    for i in range(3):
        y = top + i * (h + gap)
        draw.rounded_rectangle((left, y, left + w, y + h), radius=radius, fill=unit)
        cy = y + h / 2
        dot = 22 * s
        for j in range(2):
            cx = left + 74 * s + j * 62 * s
            colour = light if (i == 0 and j == 0) else hole
            draw.ellipse((cx - dot, cy - dot, cx + dot, cy + dot), fill=colour)
        vent_h = 18 * s
        for j in range(2):
            vy = cy - 26 * s + j * 52 * s - vent_h / 2
            draw.rounded_rectangle((left + w - 250 * s, vy, left + w - 70 * s, vy + vent_h),
                                   radius=vent_h / 2, fill=hole)


def rack_masks(size):
    """The rack as two masks: its units with what's cut into them taken
    out, and the running light alone."""
    units = Image.new("L", (size, size), 0)
    rack(ImageDraw.Draw(units), size, 255, 0, 0)
    light = Image.new("L", (size, size), 0)
    rack(ImageDraw.Draw(light), size, 0, 0, 255)
    holes = Image.new("L", (size, size), 0)
    rack(ImageDraw.Draw(holes), size, 0, 255, 0)
    return units, light, holes


def ios(variant):
    big = 1024 * SS
    if variant == "light":
        # White outside, violet rack: the rack in a violet gradient with a
        # soft shadow under it, its lights and vents showing the white.
        img = gradient(big, WHITE_TOP, WHITE_BOTTOM).convert("RGBA")
        units, light, holes = rack_masks(big)
        shadow = Image.new("RGBA", (big, big), (0x3A, 0x22, 0xA8, 0))
        offset = Image.new("L", (big, big), 0)
        offset.paste(units, (0, round(big * 0.018)))
        shadow.putalpha(offset.point(lambda a: a * 0.30).filter(ImageFilter.GaussianBlur(big * 0.03)))
        img.alpha_composite(shadow)
        img.paste(gradient(big, RACK_TOP, RACK_BOTTOM).convert("RGBA"), (0, 0), units)
        # The lights and vents in clean white, over the shadow.
        img.paste(WHITE_TOP + (255,), (0, 0), holes)
        img.paste(MINT + (255,), (0, 0), light)
        return img.convert("RGB").resize((1024, 1024), Image.LANCZOS)
    if variant == "dark":
        img = gradient(big, DARK_TOP, DARK_BOTTOM).convert("RGBA")
        unit, hole = (0x9D, 0x8C, 0xFF, 255), DARK_BOTTOM + (255,)
    else:  # tinted: grey on black, which iOS colours in
        img = Image.new("RGBA", (big, big), (0, 0, 0, 255))
        unit, hole = (235, 235, 235, 255), (0, 0, 0, 255)
    light = MINT + (255,) if variant != "tinted" else (255, 255, 255, 255)
    rack(ImageDraw.Draw(img), big, unit, hole, light)
    return img.convert("RGB").resize((1024, 1024), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    images = []
    for variant in ("light", "dark", "tinted"):
        name = f"ios-{variant}-1024.png"
        ios(variant).save(os.path.join(OUT, name), optimize=True)
        entry = {"filename": name, "idiom": "universal", "platform": "ios", "size": "1024x1024"}
        if variant != "light":
            entry["appearances"] = [{"appearance": "luminosity", "value": variant}]
        images.append(entry)

    with open(os.path.join(OUT, "Contents.json"), "w") as f:
        json.dump({"images": images, "info": {"author": "xcode", "version": 1}}, f, indent=2)
        f.write("\n")
    print("Drew the icon in", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
