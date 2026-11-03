#!/usr/bin/env python3
"""
Movies organizer: shrinks the film library through Tdarr and files new films.

  python3 movies_organizer.py status           where things stand (--json for an app)
  python3 movies_organizer.py scan             find the films that waste space; changes nothing
  python3 movies_organizer.py run              hand them to Tdarr's queue, collect what's done
  python3 movies_organizer.py collect          put Tdarr's finished copies in place (the homelab runs it)
  python3 movies_organizer.py file <paths>     file new downloads as Title (Year)/Title (Year).mkv
  python3 movies_organizer.py genre-counts     how many films are in each genre (Jellyfin's, or the .nfo files'); changes nothing

A film wastes space when its video is H.264 or older (HEVC or AV1 is about half the size), its
audio is uncompressed or lossless, or it carries audio and subtitle tracks in languages you don't
keep. Tdarr writes its smaller copy to a hidden folder; this checks it plays as long as the
original, swaps it in, aligns the subtitles (ffsubsync), tells Plex/Jellyfin about that folder
alone, and puts the original in the Trash.

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error, 130 stopped.
"""
import re
from pathlib import Path

import media_common as mc
import video_engine as ve

YEAR_RE = re.compile(r"(?<![\d])((?:19|20)\d{2})(?![\d])")
GENERIC_STEMS = re.compile(r"(?i)^(movie|film|video|main|feature|[a-z]{2,6}-[\w.]+)$")


def parse_movie(name):
    """'The.Matrix.1999.1080p.BluRay.x264-GRP' → ('The Matrix', 1999); no year → (title, None)."""
    s = re.sub(r"^\[[^\]]*\]\s*", "", name)
    years = [m for m in YEAR_RE.finditer(s) if m.start() > 0]
    if years:
        m = years[-1] if len(years) > 1 and years[-1].start() > 3 else years[0]
        title = ve.tidy_title(s[:m.start()])
        if title:
            return title, int(m.group(1))
    title = ve.tidy_title(ve.JUNK_RE.sub("", s))
    return (title, None) if title else (None, None)


class Movies(ve.VideoEngine):
    kind = "movies"
    section = "movies"

    def destination(self, path, lib):
        path = Path(path)
        title, year = parse_movie(path.stem)
        if (not year or not title or GENERIC_STEMS.match(path.stem)) and path.parent != lib:
            t2, y2 = parse_movie(path.parent.name)
            if y2 or not title:
                title, year = t2, y2
        if not title:
            return None
        name = mc.safe_name("%s (%d)" % (title, year) if year else title)
        existing = self.existing_folder(lib, name)
        return lib / existing / (name + path.suffix.lower())

    @staticmethod
    def existing_folder(lib, name):
        key = mc.name_key(name)
        try:
            for d in lib.iterdir():
                if d.is_dir() and mc.name_key(d.name) == key:
                    return d.name
        except OSError:
            pass
        return name

    noun = ("film", "films")

    def items(self):
        out = []
        for p in sorted(self.lib.iterdir()):
            if mc.is_hidden(p):
                continue
            if p.is_dir() and mc.walk_files(p, mc.VIDEO_EXT):
                out.append(p)
            elif p.is_file() and p.suffix.lower() in mc.VIDEO_EXT and not ve.SAMPLE_RE.search(p.stem):
                out.append(p)
        return out

    def nfo_genre(self, item):
        if item.is_file():
            nfos = [item.with_suffix(".nfo")]
        else:
            nfos = [item / "movie.nfo"] + [v.with_suffix(".nfo") for v in mc.walk_files(item, mc.VIDEO_EXT)]
        for n in nfos:
            g = ve.nfo_genres(n)
            if g:
                return g[0]
        return None

    def same_item(self, dest):
        folder = dest.parent
        if not folder.is_dir():
            return []
        return [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in mc.VIDEO_EXT
                and not ve.SAMPLE_RE.search(p.stem)]


def main():
    ap = mc.base_parser("movies_organizer.py", __doc__, ["status", "scan", "run", "collect", "file", "genre-counts"])
    args = ap.parse_args()
    eng = Movies()
    if args.action == "status":
        mc.load_settings(args.config, events=args.events)
        if args.library:
            mc.mo.CFG.setdefault("movies", {})["library"] = args.library
        return eng.status(args.json)
    mc.begin(args, "movies", "movies %s" % args.action)
    if args.action == "scan":
        return eng.scan()
    if args.action == "run":
        return eng.run()
    if args.action == "collect":
        return eng.collect()
    if args.action == "genre-counts":
        return eng.genre_counts()
    if not args.paths:
        mc.die("Which files?", "movies_organizer.py file <file or folder>...")
    if not eng.file(args.paths, apply=args.apply or args.yes):
        raise SystemExit(1)


if __name__ == "__main__":
    mc.run_main(main)
