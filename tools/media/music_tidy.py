#!/usr/bin/env python3
"""
Music, after and around music_organizer.py: what Tidy Up adds to the vendored engine without
changing it. Its genre map, tag helpers and APE handling are the organizer's own, imported.

  python3 music_tidy.py free-space          verify, then put the originals' backup and the duplicates
                                            set aside in the Trash, and let the organizer close the cleanup
  python3 music_tidy.py navidrome-cleanup   full scan, wait for it, remove the missing entries
  python3 music_tidy.py playlists           a Navidrome smart playlist (.nsp) for each of your genres
  python3 music_tidy.py lyrics [--check]    time-synced lyrics from LRCLIB (--check only counts)
  python3 music_tidy.py genre-counts        how many songs are in each of your genres (changes nothing)
  python3 music_tidy.py file <paths>        file new music: shrink, compare, match with beets, genre, lyrics

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error, 2 verify found
missing songs, 130 stopped.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

import media_common as mc

mo = mc.mo
ui = mc.ui
LRCLIB = "https://lrclib.net"
USER_AGENT = "Homelab Wizard Tidy Up (https://github.com/Snooper42/homelab-wizard)"
SYNCED_RE = re.compile(r"^\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]", re.M)
INSTRUMENTAL_RE = re.compile(r"(?i)[\(\[\-–\s]instrumental[\)\]\s]*$|^instrumental$")
LOSSLESS_EXT = {".flac", ".wav", ".aiff", ".aif", ".alac", ".ape", ".wv"}


# ============================================================== engine: mutagen and beets
def venv_python():
    venv = Path.home() / ".music-cleanup" / "venv"
    return venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def need(modules):
    """Run under an interpreter that has these modules: this one, or the organizer's beets venv
    (~/.music-cleanup/venv, which music_organizer.py installs on its first scan)."""
    try:
        for m in modules:
            __import__(m)
        return
    except ImportError:
        pass
    if os.environ.get("MUSIC_TIDY_CHILD") == "1":
        mc.die("%s isn't installed for this Python." % ", ".join(modules),
               "Run a music scan once (it installs beets and its helpers), then try again.")
    py = venv_python()
    if not py.exists():
        # The organizer's own one-time setup: a venv with beets, mutagen and the rest.
        real = mo.relaunch
        mo.relaunch = lambda _py: None  # install, but don't restart as the organizer
        try:
            mo.bootstrap()
        finally:
            mo.relaunch = real
    env = dict(os.environ, MUSIC_TIDY_CHILD="1")
    sys.exit(subprocess.call([str(py), os.path.abspath(__file__)] + sys.argv[1:], env=env))


def music_lib(args=None):
    lib = mc.expand((args and args.library) or mc.cfg("music", "library"))
    if not lib or not lib.is_dir():
        mc.die("Music folder not found: %s" % (lib or "not set"), "Is the drive plugged in?")
    return lib


def organizer(*argv):
    """Run the vendored organizer as itself (its own process, its own checks) and read its result."""
    cmd = [sys.executable, str(mc.HERE / "music_organizer.py")] + list(argv) + ["--events", "json"]
    if mo.CFG_PATH:
        cmd += ["--config", str(mo.CFG_PATH)]
    result, rc = None, 0
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    for line in p.stdout:
        line = line.rstrip("\n")
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        if ev.get("type") == "result":
            result = ev
        elif ui.events:  # pass its progress through to the app untouched
            sys.stdout.write(line + "\n")
            sys.stdout.flush()
        elif ev.get("text"):
            ui.say(ev["text"])
    rc = p.wait()
    return rc, result or {}


# ============================================================== free-space (verify → Trash)
def free_space(args):
    lib = music_lib(args)
    ui.title("Music library", "free the space")
    rc, res = organizer("verify", "--library", str(lib))
    if rc == 2 or not res.get("ok"):
        ui.warn(mc.trash_words("Not every song is accounted for, so nothing went to %TRASH%."))
        ui.result(action="free-space", ok=False, missing=res.get("missing"), verify=res)
        sys.exit(2 if rc == 2 else 1)
    sp = mo.state_paths(lib)
    backup, dupes = sp["backup"], sp["needs"] / "duplicates"
    size = mc.folder_size(backup) if backup.is_dir() else 0
    dsize = mc.folder_size(dupes) if dupes.is_dir() else 0
    ui.step(1, 2, mc.trash_words("Putting the old library and the duplicates in %TRASH%"))
    if backup.is_dir() and any(backup.iterdir()):
        with ui.spinner(mc.trash_words("Moving the old library to %TRASH%")) as s:
            mc.trash(backup)
            backup.mkdir()  # the organizer's delete-backup closes the cleanup's records with it
            s.summary = mc.trash_words("Old library in %TRASH% (%s)") % human(size)
    if dupes.is_dir():
        mc.trash(dupes)
        ui.ok(mc.trash_words("Duplicates set aside in %TRASH% (%s)") % human(dsize))
    ui.step(2, 2, "Closing the cleanup")
    rc, res = organizer("delete-backup", "--library", str(lib), "--yes")
    if rc:
        ui.result(action="free-space", ok=False)
        sys.exit(rc)
    mc.remove_empty_dirs(sp["needs"], keep_root=False)
    told = mc.Servers().ping(lib, "music")
    ui.result(action="free-space", ok=True, freed=size + dsize, backup=size, duplicates=dsize, told=told)


# ============================================================== Navidrome: the guided cleanup, done for you
class Navidrome:
    def __init__(self, url):
        self.url = url.rstrip("/")
        self.user, self.pw = mc.secret("NAVIDROME_ADMIN_USER"), mc.secret("NAVIDROME_ADMIN_PASSWORD")
        if not (self.user and self.pw):
            mc.die("Navidrome's admin login isn't set.", "Add NAVIDROME_ADMIN_USER and NAVIDROME_ADMIN_PASSWORD in Settings.")
        self.token = None

    def subsonic(self, method, **params):
        q = mc.navidrome_auth(self.user, self.pw) + ("&" + urllib.parse.urlencode(params) if params else "")
        r = mc.http_json("GET", "%s/rest/%s?%s" % (self.url, method, q), timeout=60) or {}
        body = r.get("subsonic-response") or {}
        if body.get("status") != "ok":
            raise RuntimeError((body.get("error") or {}).get("message") or "Navidrome said no")
        return body

    def native(self, method, path, body=None):
        if not self.token:
            r = mc.http_json("POST", self.url + "/auth/login", {"username": self.user, "password": self.pw})
            self.token = (r or {}).get("token")
            if not self.token:
                raise RuntimeError("Navidrome refused the admin login")
        return mc.http_json(method, self.url + path, body, {"x-nd-authorization": "Bearer " + self.token}, timeout=120)


def navidrome_cleanup(args):
    url = ((mc.cfg("servers") or {}).get("navidrome") or {}).get("url")
    if not url:
        mc.die("Navidrome isn't running in the homelab.")
    nd = Navidrome(url)
    ui.title("Navidrome", "tidy up after the swap")
    ui.step(1, 3, "Full scan")
    nd.subsonic("startScan", fullScan="true")
    count, started = 0, time.time()
    with ui.spinner("Navidrome is reading the library") as s:
        while time.time() - started < 6 * 3600:
            time.sleep(3)
            st = nd.subsonic("getScanStatus").get("scanStatus") or {}
            count = int(st.get("count") or 0)
            if not st.get("scanning"):
                break
        s.summary = "Scan done · %s songs found" % mc.fmt_n(count)
    ui.step(2, 3, "Missing entries")
    try:
        missing = nd.native("GET", "/api/missing?_start=0&_end=100000") or []
    except RuntimeError as e:
        if "404" in str(e):
            ui.warn("This Navidrome has no Missing Files list (it came in 0.55); update it, then run this again.")
            missing = None
        else:
            raise
    removed = 0
    if missing:
        ids = [m["id"] for m in missing if m.get("id")]
        for i in range(0, len(ids), 200):
            nd.native("DELETE", "/api/missing?" + urllib.parse.urlencode([("id", x) for x in ids[i:i + 200]]))
            removed += len(ids[i:i + 200])
        ui.ok("Removed %s missing entries: old paths, not lost songs" % mc.fmt_n(removed))
    elif missing is not None:
        ui.ok("No missing entries")
    ui.step(3, 3, "Artwork")
    ui.say("Covers refresh on their own; a browser that shows a blank record needs a hard refresh.")
    ui.result(action="navidrome-cleanup", ok=True, songs=count, removed=removed)


# ============================================================== smart playlists (.nsp)
def playlists(args):
    lib = music_lib(args)
    ui.title("Playlists", "one for each of your genres")
    folder = lib / (mc.cfg("music", "playlists_folder") or "Playlists")
    folder.mkdir(parents=True, exist_ok=True)
    written = []
    for name, _ in mo.GENRES:
        nsp = {
            "name": name,
            "comment": "Every song in %s. Made by Homelab Wizard; it fills itself as music is added." % name,
            "all": [{"is": {"genre": name}}],
            "sort": "albumartist",
            "order": "asc",
            "limit": 100000,
        }
        p = folder / (mc.safe_name(name.replace("&", "and")) + ".nsp")
        text = json.dumps(nsp, indent=2, ensure_ascii=False) + "\n"
        if not p.exists() or p.read_text(encoding="utf-8") != text:
            p.write_text(text, encoding="utf-8")
        written.append(p.name)
    for old in folder.glob("*.m3u"):  # the .m3u files these replace, if the homelab wrote them before
        if old.read_text(encoding="utf-8", errors="replace").startswith("#EXTM3U\n#HOMELAB"):
            mc.trash(old)
    ui.ok("%d smart playlists in %s" % (len(written), mc.pretty_path(folder)))
    told = mc.Servers().ping(folder, "music")
    ui.result(action="playlists", ok=True, folder=str(folder), playlists=written, told=told)


# ============================================================== genre counts (for Tidy Up's chart)
def genre_counts(args):
    """How many songs are in each of your genres, read from the songs' own tags (what Navidrome
    shows), each folded into one of yours as the organizer would. Changes nothing."""
    need(["mutagen"])
    lib = music_lib(args)
    files = mc.walk_files(lib, mo.AUDIO_EXT)
    ui.title("Genres", "how many songs are in each of yours")
    counts = {name: 0 for name, _ in mo.GENRES}
    other = 0
    with ui.progress(len(files), "Reading genres") as bar:
        for f in files:
            bar.update(note=f.name)
            g = genre_of(f)
            if g in counts:
                counts[g] += 1
            else:
                other += 1
    shown = {g: n for g, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])) if n}
    ui.ok("%s songs in %d of your genres" % (mc.fmt_n(len(files) - other), len(shown)))
    if other:
        ui.say("%s songs have no genre the organizer can place" % mc.fmt_n(other))
    ui.result(action="genre-counts", ok=True, songs=len(files), genres=shown, unplaced=other)


def genre_of(path):
    """A song's genre, folded into one of yours; None when its tags name none."""
    try:
        vals = mo.read_genre_fields(str(path)) or []
    except Exception:
        return None
    return mo.map_genre(vals)


# ============================================================== lyrics (LRCLIB)
def read_lyrics(path):
    """(text, synced) from the file's tags, or a .lrc beside it."""
    lrc = Path(path).with_suffix(".lrc")
    if lrc.is_file():
        t = lrc.read_text(encoding="utf-8", errors="replace")
        return t, bool(SYNCED_RE.search(t))
    import mutagen
    try:
        f = mutagen.File(path)
    except Exception:
        return "", False
    if f is None or f.tags is None:
        return "", False
    tags, text = f.tags, ""
    if hasattr(tags, "getall"):
        for fr in tags.getall("USLT"):
            text = text or str(fr.text)
        if not text and tags.getall("SYLT"):
            return "[synced]", True
    elif type(tags).__name__ == "MP4Tags":
        text = "".join(tags.get("\xa9lyr", []) or [])
    else:
        for k in ("lyrics", "LYRICS", "unsyncedlyrics", "UNSYNCEDLYRICS"):
            try:
                v = tags.get(k)
            except Exception:
                v = None
            if v:
                text = v[0] if isinstance(v, list) else str(v)
                break
    return text, bool(SYNCED_RE.search(text or ""))


def write_lyrics(path, text, where):
    """Into the file (every player reads it) or a .lrc beside it. The APE safety pass runs first:
    an old APE tag on an MP3 would otherwise keep its stale lyrics in front of Navidrome."""
    if where == "lrc":
        Path(path).with_suffix(".lrc").write_text(text, encoding="utf-8")
        return
    if mo.has_ape(path):
        mo.strip_ape(path)
    import mutagen
    f = mutagen.File(path)
    if f is None:
        raise RuntimeError("can't read this file")
    if f.tags is None:
        f.add_tags()
    tags = f.tags
    if hasattr(tags, "getall"):
        from mutagen.id3 import USLT
        tags.delall("USLT")
        tags.add(USLT(encoding=3, lang="eng", desc="", text=text))
        try:
            f.save(v2_version=3)
        except TypeError:
            f.save()
    elif type(tags).__name__ == "MP4Tags":
        tags["\xa9lyr"] = [text]
        f.save()
    else:
        for k in [k for k in list(tags.keys()) if str(k).lower() in ("lyrics", "unsyncedlyrics")]:
            del tags[k]
        tags["LYRICS"] = [text]
        f.save()


def song_info(path):
    import mutagen
    f = mutagen.File(path, easy=True)
    if f is None:
        return None
    g = lambda k: ((f.tags or {}).get(k) or [""])[0] if f.tags else ""
    return {"title": g("title"), "artist": g("artist") or g("albumartist"), "album": g("album"),
            "duration": int(round(getattr(f.info, "length", 0) or 0))}


def lrclib(info):
    q = {"track_name": info["title"], "artist_name": info["artist"]}
    if info["album"]:
        q["album_name"] = info["album"]
    if info["duration"]:
        q["duration"] = info["duration"]
    try:
        return mc.http_json("GET", LRCLIB + "/api/get?" + urllib.parse.urlencode(q), headers={"User-Agent": USER_AGENT},
                            timeout=20)
    except RuntimeError as e:
        if "404" in str(e):
            return None
        raise


def lyrics(args, files=None):
    need(["mutagen"])
    lib = music_lib(args)
    where = mc.cfg("lyrics", "where") or "embed"
    prefer_synced = mc.cfg("lyrics", "prefer_synced", True) is not False
    skip_instr = mc.cfg("lyrics", "skip_instrumentals", True) is not False
    check = getattr(args, "check", False)
    files = files if files is not None else [p for p in mc.walk_files(lib, mo.AUDIO_EXT)]
    ui.title("Lyrics", "coverage" if check else "time-synced from LRCLIB")
    counts = {"synced": 0, "plain": 0, "none": 0, "instrumental": 0}
    added = upgraded = failed = 0
    with ui.progress(len(files), "Checking" if check else "Lyrics") as bar:
        for p in files:
            bar.update(note=p.name)
            info = song_info(p)
            if not info or not info["title"]:
                counts["none"] += 1
                continue
            if skip_instr and INSTRUMENTAL_RE.search(info["title"]):
                counts["instrumental"] += 1
                continue
            text, synced = read_lyrics(p)
            if synced:
                counts["synced"] += 1
                continue
            if check:
                counts["plain" if text.strip() else "none"] += 1
                continue
            try:
                found = lrclib(info)
            except RuntimeError as e:
                ui.to_log("NOTE   LRCLIB: %s" % e)
                failed += 1
                counts["plain" if text.strip() else "none"] += 1
                continue
            time.sleep(0.2)  # LRCLIB is free: one question at a time
            if found and found.get("instrumental"):
                counts["instrumental"] += 1
                continue
            new = (found or {}).get("syncedLyrics") if prefer_synced else None
            new = new or (None if text.strip() else (found or {}).get("plainLyrics"))
            if not new:
                counts["plain" if text.strip() else "none"] += 1
                continue
            try:
                write_lyrics(p, new, where)
            except Exception as e:
                ui.to_log("NOTE   couldn't write lyrics to %s: %s" % (p, e))
                failed += 1
                continue
            is_synced = bool(SYNCED_RE.search(new))
            counts["synced" if is_synced else "plain"] += 1
            if text.strip():
                upgraded += 1  # plain lyrics replaced by time-synced ones
            else:
                added += 1
    if not check:
        ui.ok("Lyrics added to %s songs; %s plain ones replaced by time-synced" % (mc.fmt_n(added), mc.fmt_n(upgraded)))
    if not check and (added or upgraded):
        mc.Servers().ping(lib, "music")
    ui.result(action="lyrics", ok=True, check=check, songs=len(files), added=added, upgraded=upgraded,
              failed=failed, **counts)


# ============================================================== file: new music from the inbox
def beets_dir():
    d = mo.state_dir() / "beets"
    d.mkdir(parents=True, exist_ok=True)
    return d


def write_inbox_beets_config(lib):
    """The organizer's own beets settings (same layout, same matching rules), kept in one persistent
    library.blb so every import knows what's already in the library."""
    import yaml
    d = beets_dir()
    log = mo.reports_dir() / "music_inbox_import.log"
    mo.write_beets_config(d, lib, False, log)
    conf = yaml.safe_load((d / "config.yaml").read_text())
    conf["library"] = str(d / "library.blb")
    conf["import"].update({"duplicate_action": "keep", "move": True, "quiet": True, "quiet_fallback": "asis"})
    (d / "config.yaml").write_text(yaml.safe_dump(conf, allow_unicode=True, sort_keys=False))
    return d


class Beet:
    def __init__(self, d):
        self.env = dict(os.environ, BEETSDIR=str(d))
        self.cmd = [sys.executable, "-c", "import sys; from beets.ui import main; sys.exit(main())"]

    def __call__(self, *args):
        r = subprocess.run(self.cmd + list(args), env=self.env, stdin=subprocess.DEVNULL, capture_output=True,
                           text=True, encoding="utf-8", errors="replace")
        ui.to_log("       $ beet %s\n%s" % (" ".join(args), (r.stdout + r.stderr)[-2000:]))
        if r.returncode != 0:
            raise RuntimeError("beet %s failed: %s" % (args[0], (r.stderr or r.stdout).strip()[-300:]))
        return [l for l in r.stdout.splitlines() if l.strip()]


def shrink_lossless(files):
    """A massive lossless file becomes high-quality AAC (256k) before it enters the library."""
    ffmpeg = mc.which("ffmpeg", mc.cfg("tools", "ffmpeg"))
    if not ffmpeg:
        return files
    enc = "aac_at" if mc.IS_MAC else "aac"
    kbps = str(mc.cfg("music", "shrink_bitrate") or "256k")
    out = []
    for p in files:
        if p.suffix.lower() not in LOSSLESS_EXT:
            out.append(p)
            continue
        dst = mc.unique_path(p.with_suffix(".m4a"))
        cmd = [ffmpeg, "-y", "-v", "error", "-i", str(p), "-map", "0:a:0", "-map", "0:v?", "-c:a", enc, "-b:a", kbps,
               "-c:v", "copy", "-disposition:v", "attached_pic", "-map_metadata", "0", "-movflags", "+faststart", str(dst)]
        r = mc.run(cmd, timeout=1800)
        if r.returncode != 0 and enc != "aac":
            cmd[cmd.index(enc)] = "aac"
            r = mc.run(cmd, timeout=1800)
        try:
            ok = r.returncode == 0 and mc.same_length(mc.media_facts(mc.ffprobe(dst))["duration"],
                                                      mc.media_facts(mc.ffprobe(p))["duration"])
        except RuntimeError:
            ok = False
        if ok and dst.stat().st_size < p.stat().st_size:
            mc.trash(p)
            out.append(dst)
        else:
            if dst.exists():
                dst.unlink()
            out.append(p)
    return out


def album_key(files):
    t = mc.media_facts(mc.ffprobe(files[0]))["tags"]
    return (t.get("album_artist") or t.get("albumartist") or t.get("artist") or "").strip(), (t.get("album") or "").strip()


def file_music(args):
    need(["beets", "mutagen", "yaml"])
    lib = music_lib(args)
    apply = args.apply or args.yes
    ui.title("New music", "filing into %s" % mc.pretty_path(lib))
    beet = Beet(write_inbox_beets_config(lib))
    filed, replaced, discarded = [], 0, 0
    started = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() - 2))
    shrink = mc.cfg("music", "shrink_lossless", True) is not False
    for item in [Path(p) for p in args.paths]:
        files = [item] if item.is_file() else mc.walk_files(item, mo.AUDIO_EXT)
        files = [f for f in files if f.suffix.lower() in mo.AUDIO_EXT]
        if not files:
            continue
        artist, album = album_key(files)
        existing = []
        if artist and album:
            for line in beet("ls", "-f", "$albumartist\t$album\t$path", "albumartist:" + artist, "album:" + album):
                aa, al, path = (line.split("\t") + ["", "", ""])[:3]
                if aa.casefold() == artist.casefold() and al.casefold() == album.casefold() and Path(path).exists():
                    existing.append(Path(path))
        if existing:
            try:
                new = mc.media_facts(mc.ffprobe(files[0]))
                old = mc.media_facts(mc.ffprobe(existing[0]))
            except RuntimeError:
                new = old = None
            if not new or not mc.audio_more_efficient(new, old):
                ui.ok(mc.trash_words("%s — %s: the library's copy is leaner or as good; the download went to %TRASH%") % (artist, album))
                if apply:
                    mc.trash(item)
                discarded += 1
                continue
        if not apply:
            ui.kv(item.name, "→ beets%s" % (" (replaces the library's copy)" if existing else ""))
            continue
        if shrink:
            files = shrink_lossless(files)
        if existing:
            for e in existing:
                mc.trash(e)
            beet("rm", "-f", "albumartist:" + artist, "album:" + album)
            replaced += 1
        beet("import", str(item))
        if item.is_dir():
            mc.remove_empty_dirs(item, keep_root=False)
    if not apply:
        ui.result(action="file", ok=True, media="music", preview=True)
        return
    new_paths = [Path(l.split("\t", 1)[1]) for l in beet("ls", "-f", "$id\t$path", "added:%s.." % started)
                 if "\t" in l]
    regenred = 0
    for p in new_paths:
        vals = mo.read_genre_fields(str(p)) or []
        target = mo.map_genre(vals) or None
        if target and vals != [target]:
            try:
                write_genre_fields(p, target)
                regenred += 1
            except Exception as e:
                ui.to_log("NOTE   genre of %s: %s" % (p, e))
        filed.append(str(p))
    if mc.cfg("lyrics", "on_new_music", True) is not False and new_paths:
        lyrics(args, files=new_paths)
    folders = sorted({str(Path(p).parent) for p in filed})
    servers = mc.Servers()
    for f in folders:
        servers.ping(f, "music")
    ui.ok("Filed %s songs (%s albums)" % (mc.fmt_n(len(filed)), mc.fmt_n(len(folders))))
    ui.result(action="file", ok=True, media="music", filed=folders, songs=len(filed), replaced=replaced,
              discarded=discarded, genres_fixed=regenred, told=servers.sent)


def write_genre_fields(p, target):
    if mo.has_ape(str(p)):
        mo.strip_ape(str(p))
    mo.write_genre_fields(str(p), target)


def human(n):
    from video_engine import human as h
    return h(n)


def main():
    ap = mc.base_parser("music_tidy.py", __doc__, ["free-space", "navidrome-cleanup", "playlists", "lyrics",
                                                   "genre-counts", "file"])
    ap.add_argument("--check", action="store_true", help="lyrics: count only, change nothing")
    args = ap.parse_args()
    mc.begin(args, "music", "music %s" % args.action)
    if args.library:
        mo.CFG["music"]["library"] = args.library
    if args.action == "free-space":
        return free_space(args)
    if args.action == "navidrome-cleanup":
        return navidrome_cleanup(args)
    if args.action == "playlists":
        return playlists(args)
    if args.action == "lyrics":
        return lyrics(args)
    if args.action == "genre-counts":
        return genre_counts(args)
    if not args.paths:
        mc.die("Which files?", "music_tidy.py file <file or folder>...")
    return file_music(args)


if __name__ == "__main__":
    mc.run_main(main)
