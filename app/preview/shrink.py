"""Shrinks the docs' pictures to 256 colours (UI pictures look the same at
about a third of the size): python3 -I app/preview/shrink.py a.png b.png …

Median cut picks most of the palette. On its own it drops colours that are
used little, so a small green dot or an amber badge comes out grey: the
colours it leaves far from all of its own take the last places, the most
used first. Pictures already in 256 colours are left as they are."""
import sys
from PIL import Image

KEEP = 32  # places kept for the colours median cut misses
FAR = 30 ** 2  # how far (squared, in RGB) counts as missed


def shrink(path):
    im = Image.open(path)
    if im.mode == 'P':
        return
    im = im.convert('RGB')
    pal = im.quantize(colors=256 - KEEP, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).getpalette()[:(256 - KEEP) * 3]
    near = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]

    def missed(c):
        return min((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2 for p in near) > FAR

    extra = [c for n, c in sorted(im.getcolors(1 << 24) or [], reverse=True) if n >= 4 and missed(c)][:KEEP]
    palette = Image.new('P', (1, 1))
    palette.putpalette(pal + [v for c in extra for v in c] + [0] * 3 * (256 - len(near) - len(extra)))
    im.quantize(palette=palette, dither=Image.Dither.NONE).save(path, optimize=True)


for p in sys.argv[1:]:
    shrink(p)
