#!/usr/bin/env python3
"""
The nightly scrubber: sweeps the libraries for leftovers whose film, song or book is gone.

  python3 scrubber.py scan              list what would go; changes nothing
  python3 scrubber.py scan --apply      put it in the Trash (the homelab runs this daily at 03:00)

A leftover is a .nfo, a poster or other image, a subtitle (.srt, .ass...), or a .lrc lyrics file
in a folder where no film, episode, song, audiobook or book is left (none in that folder or below
it), or one named after a file that's gone ("Movie (2001).en.srt" with no "Movie (2001).mkv"
beside it). Folders left empty go too. Everything goes to the Trash, never straight away.

What anchors a folder: every video (.mkv, .mp4, ...), audio (.flac, .mp3, .m4a, ...), audiobook
(.m4b) and book (.epub, .pdf, ...) format the engines handle, not .mkv/.flac/.epub alone, so a
.mp4 film's poster or an .mp3 album's cover is never mistaken for a leftover.

A Calibre library (it has metadata.db) only loses empty folders here: Calibre's database points at
its covers and metadata.opf files, so those are Calibre's to remove.

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error.
"""
import os
import re
from pathlib import Path

import media_common as mc

ui = mc.ui
ANCHOR_EXT = mc.VIDEO_EXT | mc.MUSIC_EXT | mc.AUDIOBOOK_EXT | mc.BOOK_EXT
SIDECAR_EXT = {".nfo", ".jpg", ".jpeg", ".png", ".webp", ".tbn", ".lrc"} | mc.SUB_EXT
# Pictures and notes that belong to a folder (a film, a show, a season, an album), not to one file.
GENERIC_RE = re.compile(r"(?i)^(poster|folder|cover|front|back|fanart|banner|logo|clearart|clearlogo|landscape|"
                        r"thumb|backdrop\d*|disc|discart|keyart|tvshow|movie|album|artist|season[\s-]?\d*(-poster|-banner|"
                        r"-fanart|-landscape)?|season-specials(-poster)?|show|series|extrafanart|characterart|"
                        r"booklet.*|scan.*|inlay.*|cd\d*|metadata)$")
PER_FILE_RE = re.compile(r"(?i)(-thumb|-poster|-fanart|-landscape|-banner|-clearlogo)$|S\d{1,2}E\d{1,3}")
LANG_TAIL_RE = re.compile(r"(?i)(\.(forced|sdh|cc|default|hi|\d+|[a-z]{2,3}(-[a-z]{2,4})?))+$")


def anchored_stem(sidecar, stems):
    """Is this sidecar named after one of the folder's media files?"""
    base = sidecar.stem
    for s in stems:
        if base == s or base.startswith(s + ".") or base.startswith(s + "-") or base.startswith(s + " -"):
            return True
    bare = LANG_TAIL_RE.sub("", base)
    return bare in stems


def orphans(root):
    """(files, folders) that would go."""
    root = Path(root)
    calibre = (root / "metadata.db").is_file()
    has_anchor = {}
    found = []
    for dirpath, dirnames, filenames in os.walk(str(root), topdown=False):
        d = Path(dirpath)
        rel = d.relative_to(root).parts
        if any(p in mc.WORK_DIRS or p.startswith(".") for p in rel):
            has_anchor[d] = True  # working folders are never touched
            continue
        files = [d / f for f in filenames if not f.startswith("._")]
        anchors = [f for f in files if f.suffix.lower() in ANCHOR_EXT]
        here = bool(anchors) or any(has_anchor.get(d / sub, False) for sub in dirnames)
        has_anchor[d] = here
        if calibre:
            continue
        stems = {f.stem for f in anchors}
        for f in files:
            if f.suffix.lower() not in SIDECAR_EXT:
                continue
            if not here:
                found.append(f)  # nothing left in this folder or under it
            elif not anchored_stem(f, stems) and not GENERIC_RE.match(f.stem) and \
                    (f.suffix.lower() in mc.SUB_EXT | {".lrc", ".nfo"} or PER_FILE_RE.search(f.stem)):
                found.append(f)  # named after a film or episode that's gone
    return found


def scrub(roots, apply):
    ui.title("Nightly scrubber", "leftovers in the libraries" + ("" if apply else " (preview)"))
    total_files, total_bytes, total_dirs, listing = 0, 0, 0, []
    for name, root in roots:
        if not root or not root.is_dir():
            ui.say("%s: not found (drive unplugged?), skipped" % name)
            continue
        found = orphans(root)
        size = sum(f.stat().st_size for f in found if f.exists())
        for f in found:
            listing.append(str(f))
            if apply:
                try:
                    mc.trash(f)
                except OSError as e:
                    ui.warn(mc.trash_words("Couldn't move %s to %TRASH%: %s") % (f, e))
        dirs = []
        if apply:
            dirs = mc.remove_empty_dirs(root, keep_root=True)
        else:
            dirs = [d for d in empty_after(root, set(found))]
        total_files += len(found)
        total_bytes += size
        total_dirs += len(dirs)
        ui.kv(name, "%s leftovers (%s), %s empty folders" % (mc.fmt_n(len(found)), human(size), mc.fmt_n(len(dirs))))
    if apply:
        ui.ok(mc.trash_words("Swept: %s leftovers and %s empty folders went to %TRASH%") % (mc.fmt_n(total_files), mc.fmt_n(total_dirs)))
    ui.result(action="scrub", ok=True, applied=apply, files=total_files, bytes=total_bytes, folders=total_dirs,
              sample=listing[:100])


def empty_after(root, gone):
    """Folders that would be empty once the leftovers go (for the preview)."""
    out = []
    left = {}
    for dirpath, dirnames, filenames in os.walk(str(root), topdown=False):
        d = Path(dirpath)
        if d == root or any(p in mc.WORK_DIRS or p.startswith(".") for p in d.relative_to(root).parts):
            left[d] = True
            continue
        keep = [f for f in filenames if (d / f) not in gone and f not in (".DS_Store", "Thumbs.db") and not f.startswith("._")]
        left[d] = bool(keep) or any(left.get(d / s, True) for s in dirnames)
        if not left[d]:
            out.append(d)
    return out


def human(n):
    from video_engine import human as h
    return h(n)


def roots_from_settings():
    out = []
    for sec, name in (("music", "Music"), ("movies", "Movies"), ("tv", "TV"), ("audiobooks", "Audiobooks"),
                      ("books", "Books")):
        lib = mc.expand(mc.cfg(sec, "library"))
        if lib:
            out.append((name, lib))
    for extra in mc.cfg("scrubber", "roots") or []:
        out.append((Path(extra).name, mc.expand(extra)))
    return out


def main():
    ap = mc.base_parser("scrubber.py", __doc__, ["scan"])
    args = ap.parse_args()
    mc.begin(args, "scrubber", "scrubber %s" % ("apply" if args.apply else "preview"))
    roots = [("Library", mc.expand(args.library))] if args.library else roots_from_settings()
    scrub(roots, args.apply)


if __name__ == "__main__":
    mc.run_main(main)
