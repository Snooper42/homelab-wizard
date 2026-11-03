#!/usr/bin/env python3
"""
TV organizer: shrinks the series library through Tdarr and files new episodes.

  python3 tv_organizer.py status           where things stand (--json for an app)
  python3 tv_organizer.py scan             find the episodes that waste space; changes nothing
  python3 tv_organizer.py run              hand them to Tdarr's queue, collect what's done
  python3 tv_organizer.py collect          put Tdarr's finished copies in place (the homelab runs it)
  python3 tv_organizer.py file <paths>     file new episodes and season packs
  python3 tv_organizer.py genre-counts     how many shows are in each genre (Jellyfin's, or tvshow.nfo's); changes nothing
  python3 tv_organizer.py dedupe           put the extra copies of an episode the scan found in the Trash (it asks)

Episodes are filed as Show/Season 01/Show - S01E01.mkv. A file with two episodes in it
(S01E01-E02, S01E01E02, 1x01-02) keeps both numbers: Show - S01E01-E02.mkv, which Plex,
Jellyfin and Sonarr all read as two episodes. Anime numbered from the first episode of the
series ("[Group] Show - 112 [1080p]") keeps its absolute number: Show/Show - 112.mkv.

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error, 130 stopped.
"""
import re
from pathlib import Path

import media_common as mc
import video_engine as ve

# S01E01, S01E01E02, S01E01-E02, S01E01-02, s01.e01
SXE_RE = re.compile(r"(?i)(?:^|[\s._\-\[(])S(?P<season>\d{1,2})[\s._-]?E(?P<ep>\d{1,4})(?P<more>(?:[\s._-]*-?[\s._-]*E?\d{1,4}(?![\dp]))*)")
# 1x01, 1x01-02, 1x01x02
NX_RE = re.compile(r"(?i)(?:^|[\s._\-\[(])(?P<season>\d{1,2})x(?P<ep>\d{2,3})(?P<more>(?:[-x]\d{2,3})*)(?![\dp])")
# [Group] Show - 112 [1080p], Show - 112v2, Show - 012-013, Show Ep 112
ABS_RE = re.compile(r"(?i)^(?:\[[^\]]+\]\s*)?(?P<show>.+?)\s+(?:-\s+|Ep\.?\s*|Episode\s+)(?P<ep>\d{2,4})(?:v\d)?"
                    r"(?:\s*-\s*(?P<ep2>\d{2,4})(?:v\d)?)?(?=\s|\[|\(|$|\.)")
SEASON_DIR_RE = re.compile(r"(?i)^(?:season|series|staffel|saison|temporada)[\s._-]*(\d{1,2})$|^s(\d{1,2})$")
PACK_RE = re.compile(r"(?i)[\s._-]S(\d{1,2})(?:[\s._-]|$)(?!E\d)")


def episode_numbers(first, more):
    nums = [int(first)]
    for n in re.findall(r"\d{1,4}", more or ""):
        n = int(n)
        if nums and nums[-1] < n <= nums[-1] + 30:
            if n > nums[-1] + 1 and re.search(r"-\s*E?0*%d(?!\d)" % n, more or "", re.I):
                nums += list(range(nums[-1] + 1, n + 1))  # S01E01-E04 is four episodes
            elif n not in nums:
                nums.append(n)
    return nums


def parse_episode(name, folder=""):
    """What episode a file is: {'show', 'season', 'episodes', 'absolute'}; None if it isn't one."""
    stem = re.sub(r"\.(mkv|mp4|m4v|avi|ts|webm|mov|wmv)$", "", name, flags=re.I)
    for rx in (SXE_RE, NX_RE):
        m = rx.search(stem)
        if m:
            show = ve.tidy_title(stem[:m.start()])
            if not show:
                show = show_from_folder(folder)
            return {"show": show, "season": int(m.group("season")),
                    "episodes": episode_numbers(m.group("ep"), m.group("more")), "absolute": False}
    m = ABS_RE.match(re.sub(r"[._]", " ", stem))
    if m and not re.fullmatch(r"(?:19|20)\d{2}", m.group("ep")):
        first = int(m.group("ep"))
        last = int(m.group("ep2")) if m.group("ep2") else first
        if last < first or last - first > 30:
            last = first
        show = ve.tidy_title(m.group("show"))
        return {"show": show or show_from_folder(folder), "season": None,
                "episodes": list(range(first, last + 1)), "absolute": True}
    return None


def show_from_folder(folder):
    """The show's name from a season pack's folder: 'Show.Name.S02.1080p.WEB-GRP' → 'Show Name'."""
    folder = Path(folder) if folder else None
    while folder and folder.name:
        name = folder.name
        if SEASON_DIR_RE.match(name):
            folder = folder.parent
            continue
        m = PACK_RE.search(name)
        base = name[:m.start()] if m else ve.JUNK_RE.sub("", name)
        t = ve.tidy_title(base)
        return t or None
    return None


def show_title(show):
    """'Doctor Who 2005' → 'Doctor Who (2005)', the way Sonarr and Jellyfin name such shows."""
    m = re.match(r"^(.*?)[\s(]+((?:19|20)\d{2})\)?$", show or "")
    return "%s (%s)" % (m.group(1).strip(), m.group(2)) if m and m.group(1).strip() else show


def episode_tag(ep):
    if ep["absolute"]:
        nums = ["%03d" % n for n in ep["episodes"]]
        return nums[0] if len(nums) == 1 else "%s-%s" % (nums[0], nums[-1])
    tag = "S%02dE%02d" % (ep["season"], ep["episodes"][0])
    if len(ep["episodes"]) > 1:
        tag += "-E%02d" % ep["episodes"][-1]
    return tag


class TV(ve.VideoEngine):
    kind = "tv"
    section = "tv"

    def destination(self, path, lib):
        path = Path(path)
        ep = parse_episode(path.name, path.parent)
        if not ep or not ep["show"]:
            return None
        show = mc.safe_name(show_title(ep["show"]))
        folder = self.existing_show(lib, show)
        name = mc.safe_name("%s - %s" % (folder, episode_tag(ep)))
        if ep["absolute"]:
            return lib / folder / (name + path.suffix.lower())
        return lib / folder / ("Season %02d" % ep["season"]) / (name + path.suffix.lower())

    @staticmethod
    def existing_show(lib, show):
        """A show already in the library keeps its folder's name ('The Office (US)'), matched
        without punctuation, case, or a year the download left out."""
        key = mc.name_key(show)
        bare = mc.name_key(re.sub(r"\s*\((?:19|20)\d{2}\)$", "", show))
        try:
            dirs = [d.name for d in lib.iterdir() if d.is_dir() and not d.name.startswith(".")]
        except OSError:
            return show
        for d in dirs:
            if mc.name_key(d) == key:
                return d
        for d in dirs:
            if mc.name_key(re.sub(r"\s*\((?:19|20)\d{2}\)$", "", d)) == bare:
                return d
        return show

    noun = ("show", "shows")

    def scan_more(self, files):
        """Episodes missing from a season: a gap in its numbering (S02E01, E02, E05: E03 and E04),
        read from the files alone. One missing after a season's last is past what files can tell."""
        have = {}
        for p in files:
            ep = parse_episode(p.name, p.parent)
            if not ep or not ep["episodes"] or ep["season"] == 0:
                continue
            show = p.relative_to(self.lib).parts[0]
            have.setdefault((show, ep["season"]), set()).update(ep["episodes"])
        gaps = []
        for (show, season), eps in sorted(have.items(), key=lambda kv: (mc.name_key(kv[0][0]), kv[0][1] or 0)):
            missing = sorted(set(range(1, max(eps) + 1)) - eps)
            if missing:
                gaps.append({"show": show, "season": season, "episodes": missing})
        n = sum(len(g["episodes"]) for g in gaps)
        if n:
            shows = len({g["show"] for g in gaps})
            mc.ui.kv("Episodes missing", "%s, in %s show%s" % (mc.fmt_n(n), mc.fmt_n(shows), "" if shows == 1 else "s"))
        return {"missing": n, "missing_list": gaps[:50]}

    def dup_key(self, path):
        ep = parse_episode(path.name, path.parent)
        if not ep or not ep["episodes"]:
            return None
        show = path.relative_to(self.lib).parts[0]
        return (mc.name_key(show), ep.get("season"), tuple(sorted(ep["episodes"])), bool(ep["absolute"]))

    def items(self):
        return [p for p in sorted(self.lib.iterdir()) if p.is_dir() and not mc.is_hidden(p) and mc.walk_files(p, mc.VIDEO_EXT)]

    def nfo_genre(self, item):
        g = ve.nfo_genres(item / "tvshow.nfo")
        return g[0] if g else None

    def same_item(self, dest):
        want = parse_episode(dest.name, dest.parent)
        if not want or not dest.parent.is_dir():
            return []
        out = []
        for p in dest.parent.iterdir():
            if p.is_file() and p.suffix.lower() in mc.VIDEO_EXT:
                got = parse_episode(p.name, p.parent)
                if got and got["absolute"] == want["absolute"] and got.get("season") == want.get("season") \
                        and set(got["episodes"]) & set(want["episodes"]):
                    out.append(p)
        return out


def main():
    ap = mc.base_parser("tv_organizer.py", __doc__, ["status", "scan", "run", "collect", "file", "genre-counts", "dedupe"])
    args = ap.parse_args()
    eng = TV()
    if args.action == "status":
        mc.load_settings(args.config, events=args.events)
        if args.library:
            mc.mo.CFG.setdefault("tv", {})["library"] = args.library
        return eng.status(args.json)
    mc.begin(args, "tv", "tv %s" % args.action)
    if args.action == "scan":
        return eng.scan()
    if args.action == "run":
        return eng.run()
    if args.action == "collect":
        return eng.collect()
    if args.action == "genre-counts":
        return eng.genre_counts()
    if args.action == "dedupe":
        return eng.dedupe()
    if not args.paths:
        mc.die("Which files?", "tv_organizer.py file <file or folder>...")
    if not eng.file(args.paths, apply=args.apply or args.yes):
        raise SystemExit(1)


if __name__ == "__main__":
    mc.run_main(main)
