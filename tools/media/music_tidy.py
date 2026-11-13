#!/usr/bin/env python3
"""
Music, after and around music_organizer.py: what Tidy Up adds to the vendored engine without
changing it. Its genre map, tag helpers and APE handling are the organizer's own, imported.

  python3 music_tidy.py free-space          verify, then put the originals' backup and the duplicates
                                            set aside in the Trash, and let the organizer close the cleanup
  python3 music_tidy.py navidrome-cleanup   full scan, wait for it, remove the missing entries
  python3 music_tidy.py playlists           a Navidrome smart playlist (.nsp) for each of your genres
  python3 music_tidy.py lyrics [--check]    time-synced lyrics from LRCLIB (--check only counts)
  python3 music_tidy.py lyrics --tidy       the songs' own lyrics set right, asking LRCLIB nothing
  python3 music_tidy.py genre-counts        how many songs are in each of your genres (changes nothing)
  python3 music_tidy.py file <paths>        file new music: shrink, compare, match with beets, genre, lyrics
  python3 music_tidy.py file <path> --album <MusicBrainz release id>
                                            songs with no names: the album's names written onto them, then filed

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error, 2 verify found
missing songs, 130 stopped.
"""
import json
import os
import re
import shutil
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
# A time-synced line: [mm:ss], [mm:ss.xx] or [mm:ss,xx] at its start (a byte-order mark or a
# carriage return before it is the file's, not the line's).
SYNCED_RE = re.compile(r"^[\s\ufeff]*\[\d{1,3}:\d{2}(?:[.:,]\d{1,3})?\]", re.M)
# Lyrics that carry a translation on each line, after a caret ("¡NUEVAYoL!^NEW YORK!"): players show
# the caret and both languages run together on one line. A line's times, before its words.
TIMES_RE = re.compile(r"^((?:\s*\[\d{1,3}:\d{2}(?:[.:,]\d{1,3})?\])*)(.*)$")
INSTRUMENTAL_RE = re.compile(r"(?i)[\(\[\-–\s]instrumental[\)\]\s]*$|^instrumental$")
LOSSLESS_EXT = {".flac", ".wav", ".aiff", ".aif", ".alac", ".ape", ".wv"}


# ============================================================== engine: mutagen and beets
def venv_python():
    venv = Path.home() / ".music-cleanup" / "venv"
    return venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def starts(py):
    """Whether a Python runs at all (a venv's is a link to the one it was made with)."""
    try:
        return subprocess.run([str(py), "-c", "import sys"], capture_output=True, timeout=30).returncode == 0
    except subprocess.TimeoutExpired:
        return True  # slow says nothing about the venv: keep it
    except OSError:
        return False


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
    # A venv whose Python was upgraded away (Homebrew) can't be made again over itself: it goes,
    # and the organizer's setup makes it anew. homelab media does the same before each run.
    venv = py.parent.parent
    if venv.is_dir() and not starts(py):
        shutil.rmtree(str(venv), ignore_errors=True)
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
def normalize_lyrics(text):
    """Lyrics as players read them best: one kind of line ending, no byte-order mark, and, when most lines
    carry a translation after a caret, each translation on a line of its own under its original, with
    the same time, so a player shows the two together as the song reaches them."""
    text = (text or "").replace("\ufeff", "").replace("\r\n", "\n").replace("\r", "\n")
    # Plain text only: they come from outside and every player shows them (a NUL ends some players' reading).
    text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", text)
    # The words of each line: not its times, and not the file's own tags ([ar:...], [offset:...]).
    words = [re.sub(r"\[\d{1,3}:\d{2}(?:[.:,]\d{1,3})?\]|<\d{1,3}:\d{2}(?:[.:,]\d{1,3})?>", "", l).strip()
             for l in text.split("\n") if not re.match(r"^\s*\[[a-z#]+:", l, re.I)]
    lines = [w for w in words if w]
    if lines and sum("^" in l for l in lines) * 2 >= len(lines):
        out = []
        for l in text.split("\n"):
            times, words = TIMES_RE.match(l).groups()
            if "^" not in words:
                out.append(l)
                continue
            first, _, second = words.partition("^")
            out.append(times + first.strip())
            if second.strip():
                out.append(times + second.strip())
        text = "\n".join(out)
    return text


def has_translation(text):
    """Lyrics with a translation after a caret on most lines: normalize_lyrics puts each on its own line."""
    return bool(text) and normalize_lyrics(text) != (text or "").replace("\ufeff", "").replace("\r\n", "\n").replace("\r", "\n")


def is_synced(text):
    return bool(SYNCED_RE.search((text or "").replace("\r", "\n")))


def sidecars(path):
    """The lyrics files beside a song, in the order Navidrome reads them before the song's own tags
    (its LyricsPriority: .lrc, .txt, embedded): any of them hides lyrics written into the file."""
    return [q for q in (Path(path).with_suffix(".lrc"), Path(path).with_suffix(".txt")) if q.is_file()]


def read_lyrics(path):
    """(text, synced): the lyrics a player shows for this song: a .lrc beside it, else a .txt beside it,
    else the file's own tags."""
    for side in sidecars(path):
        t = side.read_text(encoding="utf-8", errors="replace")
        if t.strip():
            return t, is_synced(t)
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
    return text, is_synced(text)


# Longer than any song's lyrics, time-synced ones included (a few tens of thousands of characters at most).
MAX_LYRICS = 100000


def write_lyrics(path, text, where):
    """Into the file (every player reads it) or a .lrc beside it. The APE safety pass runs first:
    an old APE tag on an MP3 would otherwise keep its stale lyrics in front of Navidrome. A .lrc or .txt
    already beside the song is read before the file's tags, so lyrics written into the file would never
    show: the .lrc beside it gets them then (it comes first), and the file's tags are left as they are."""
    text = normalize_lyrics(text)
    if len(text) > MAX_LYRICS:
        raise RuntimeError("these lyrics are longer than any song's (%d characters)" % len(text))
    if where == "lrc" or sidecars(path):
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


def _lrclib_get(path, q):
    """One question to LRCLIB: its answer, None when it has nothing (404), and once more after a pause
    when it asks to slow down (429)."""
    url = LRCLIB + path + "?" + urllib.parse.urlencode(q)
    for attempt in (0, 1):
        try:
            return mc.http_json("GET", url, headers={"User-Agent": USER_AGENT}, timeout=20, max_bytes=2 * 1024 * 1024)
        except RuntimeError as e:
            if "answered 404" in str(e):
                return None
            if "answered 429" in str(e) and attempt == 0:
                time.sleep(5)
                continue
            raise


def _plain_title(s):
    """A title as LRCLIB and a tag can both write it: lower case, accents off, without (Remastered 2011),
    [Live], - 2009 Remaster, or feat. someone."""
    import unicodedata
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\s*[\(\[][^\)\]]*[\)\]]", "", s)
    s = re.sub(r"\s+-\s+.*(remaster|live|version|edit|mono|stereo|mix).*$", "", s)
    s = re.sub(r"\s+(feat|ft)\.?\s.*$", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def lrclib(info):
    """LRCLIB's lyrics for a song: first its exact record (title, artist, album, and length, all four as
    /api/get asks), then, when that has nothing or the tags lack the album or length, a search by title
    and artist, taking the closest record: the same title, the artist named, and a length within 3
    seconds when the song's is known, time-synced ones first."""
    exact = None
    if info["title"] and info["artist"] and info["album"] and info["duration"]:
        exact = _lrclib_get("/api/get", {"track_name": info["title"], "artist_name": info["artist"],
                                         "album_name": info["album"], "duration": info["duration"]})
        # An exact record with time-synced lyrics (or one saying it's an instrumental) is the answer. One
        # with plain lyrics alone isn't the end: another record of the same song often has them synced.
        if exact and (exact.get("syncedLyrics") or exact.get("instrumental")):
            return exact
    hits = _lrclib_get("/api/search", {"track_name": info["title"], "artist_name": info["artist"]}) or []
    want, artist = _plain_title(info["title"]), _plain_title(info["artist"])
    best = None
    for h in hits if isinstance(hits, list) else []:
        if _plain_title(h.get("trackName")) != want:
            continue
        theirs = _plain_title(h.get("artistName"))
        if artist and artist not in theirs and theirs not in artist:
            continue
        if info["duration"] and h.get("duration") and abs(float(h["duration"]) - info["duration"]) > 3:
            continue
        rank = (bool(h.get("syncedLyrics")), bool(h.get("plainLyrics") or h.get("instrumental")),
                -abs(float(h.get("duration") or 0) - (info["duration"] or 0)))
        if best is None or rank > best[0]:
            best = (rank, h)
    if exact and (best is None or not best[1].get("syncedLyrics")):
        return exact
    return best[1] if best else None


# Songs LRCLIB had nothing for, by path, with when it was asked: not asked again for a month (its
# library grows), so a second run is quick, and Overview counts only the songs still worth asking about.
NOT_FOUND_DAYS = 30


def _not_found_path():
    return mo.state_dir() / "lyrics-not-found.json"


# Raised when the lookup learns to find more: songs remembered by an older one are asked again now.
NOT_FOUND_VERSION = 2


def _load_not_found():
    try:
        data = json.loads(_not_found_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(data, dict) or data.get("version") != NOT_FOUND_VERSION:
        return {}
    songs = data.get("songs")
    return songs if isinstance(songs, dict) else {}


def _save_not_found(seen):
    try:
        body = {"version": NOT_FOUND_VERSION, "songs": seen}
        _not_found_path().write_text(json.dumps(body, indent=0, sort_keys=True) + "\n", encoding="utf-8")
    except OSError as e:
        ui.to_log("NOTE   couldn't keep the songs LRCLIB has no lyrics for: %s" % e)


def lyrics(args, files=None):
    need(["mutagen"])
    lib = music_lib(args)
    where = mc.cfg("lyrics", "where") or "embed"
    prefer_synced = mc.cfg("lyrics", "prefer_synced", True) is not False
    skip_instr = mc.cfg("lyrics", "skip_instrumentals", True) is not False
    check = getattr(args, "check", False)
    # --tidy: only the songs' own lyrics set right (two languages on one line set apart), on this computer,
    # asking LRCLIB nothing, so thousands of songs never wait on the network.
    tidy_only = getattr(args, "tidy", False) is True and not check
    files = files if files is not None else [p for p in mc.walk_files(lib, mo.AUDIO_EXT)]
    ui.title("Lyrics", "coverage" if check else "two languages set apart" if tidy_only else "time-synced from LRCLIB")
    # none: songs still worth asking LRCLIB about. not_found: asked, and it had nothing (asked again after
    # a month). plain: plain lyrics LRCLIB has no time-synced ones for. untagged: no title to ask with.
    counts = {"synced": 0, "plain": 0, "none": 0, "instrumental": 0, "not_found": 0, "untagged": 0}
    # to_clean: songs a check found with a translation after a caret on each line, which a run sets apart.
    added = upgraded = failed = already = cleaned = to_clean = 0
    seen = _load_not_found()

    def tidy(p, text):
        """The song's own lyrics, each translation after a caret on a line of its own. Whether it was."""
        nonlocal cleaned, failed, to_clean
        if not has_translation(text):
            return False
        if check:
            to_clean += 1
            return False
        try:
            write_lyrics(p, text, where)
        except Exception as e:
            ui.to_log("NOTE   couldn't write lyrics to %s: %s" % (p, e))
            failed += 1
            return False
        cleaned += 1
        return True

    now = time.time()
    fresh = lambda p: now - float(seen.get(str(p), 0)) < NOT_FOUND_DAYS * 86400
    with ui.progress(len(files), "Checking" if check else "Lyrics") as bar:
        for p in files:
            bar.update(note=p.name)
            info = song_info(p)
            if not info or not info["title"]:
                counts["untagged"] += 1
                continue
            if skip_instr and INSTRUMENTAL_RE.search(info["title"]):
                counts["instrumental"] += 1
                continue
            text, synced = read_lyrics(p)
            # The song's own lyrics are set right first, whatever LRCLIB answers, or if it doesn't (a check
            # only counts them).
            if tidy(p, text):
                text = normalize_lyrics(text)
            if synced:
                counts["synced"] += 1
                already += 1
                continue
            if fresh(p):
                counts["plain" if text.strip() else "not_found"] += 1
                continue
            if check or tidy_only:
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
                seen[str(p)] = now
                counts["plain" if text.strip() else "not_found"] += 1
                continue
            try:
                write_lyrics(p, new, where)
            except Exception as e:
                ui.to_log("NOTE   couldn't write lyrics to %s: %s" % (p, e))
                failed += 1
                continue
            seen.pop(str(p), None)
            counts["synced" if is_synced(new) else "plain"] += 1
            if text.strip():
                upgraded += 1  # plain lyrics replaced by time-synced ones
            else:
                added += 1
    if tidy_only:
        ui.ok("Two languages on one line set apart in %s songs" % mc.fmt_n(cleaned))
        if failed:
            ui.warn("Couldn't write the lyrics of %s songs: the log says which" % mc.fmt_n(failed))
    elif not check:
        _save_not_found(seen)
        ui.ok("Lyrics added to %s songs; %s plain ones replaced by time-synced" % (mc.fmt_n(added), mc.fmt_n(upgraded)))
        # Every other song, said: why it has none, or why it kept what it had.
        for n, words in ((already, "already had time-synced lyrics"),
                         (cleaned, "had a translation after a caret on each line: each is on its own line under its original now"),
                         (counts["plain"], "keep plain lyrics: LRCLIB has no time-synced ones for them"),
                         (counts["instrumental"], "are instrumentals"),
                         (counts["not_found"], "aren't on LRCLIB yet: asked again in a month"),
                         (counts["untagged"], "have no title tag to look them up by")):
            if n > 0:
                text = "%s %s" % (mc.fmt_n(n), words)
                ui.line("  " + text, "NOTE   " + text, kind="note", text=text)
        if failed:
            ui.warn("LRCLIB didn't answer for %s songs: run it again later" % mc.fmt_n(failed))
    if check and to_clean:
        text = "%s songs have a translation after a caret on each line: adding lyrics puts each on a line of its own" % mc.fmt_n(to_clean)
        ui.line("  " + text, "NOTE   " + text, kind="note", text=text)
    if not check and (added or upgraded or cleaned):
        mc.Servers().ping(lib, "music")
    ui.result(action="lyrics", ok=True, check=check, tidy=tidy_only, songs=len(files), added=added, upgraded=upgraded,
              cleaned=cleaned, to_clean=to_clean, failed=failed, **counts)


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


def can_fingerprint():
    """Whether beets can tell songs by their sound (its chroma plugin: AcoustID's fpcalc and the acoustid module)."""
    return bool(shutil.which("fpcalc")) and mo.has_module("acoustid")


def skip_unmatched():
    """A beets settings layer (beet -c, on top of the inbox's own) that leaves songs it can't match where they are,
    rather than filing them as they are: for songs with no names, tried by their sound."""
    p = beets_dir() / "skip-unmatched.yaml"
    p.write_text("import:\n  quiet_fallback: skip\n", encoding="utf-8")
    return p


class Beet:
    def __init__(self, d):
        self.env = dict(os.environ, BEETSDIR=str(d))
        self.cmd = [sys.executable, "-c", "import sys; from beets.ui import main; sys.exit(main())"]

    def __call__(self, *args):
        try:  # an hour: a big album with every lookup, and never for good on a file built to hang a decoder
            r = subprocess.run(self.cmd + list(args), env=self.env, stdin=subprocess.DEVNULL, capture_output=True,
                               text=True, encoding="utf-8", errors="replace", timeout=3600)
        except subprocess.TimeoutExpired:
            raise RuntimeError("beet %s took longer than an hour" % args[0])
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


# ============================================================== Name these songs: an album from MusicBrainz
MUSICBRAINZ = "https://musicbrainz.org/ws/2"
MBID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
UNNAMED = "These songs don't say which artist or album they are."
# A song's place on the album from its file's name: "01 Song", "1-03 Song", "Track 7", "07. Song".
TRACK_NO_RE = re.compile(r"(?i)^\s*(?:track\s*)?(?:(\d{1,2})\s*-\s*)?(\d{1,3})(?!\d)")
DISC_DIR_RE = re.compile(r"(?i)^\s*(?:cd|dis[ck])\s*(\d{1,2})\b")


def mb_release(mbid):
    """One release from MusicBrainz, with its songs; asked again once after a pause when it's busy (503)."""
    url = "%s/release/%s?inc=recordings+artist-credits&fmt=json" % (MUSICBRAINZ, mbid)
    for attempt in (0, 1):
        try:
            rel = mc.http_json("GET", url, headers={"User-Agent": USER_AGENT}, timeout=30, max_bytes=8 * 1024 * 1024)
            break
        except RuntimeError as e:
            if "answered 404" in str(e):
                mc.die("MusicBrainz has no album %s" % mbid, "Look the album up again, and pick one it found.")
            if ("answered 503" in str(e) or "answered 429" in str(e)) and attempt == 0:
                time.sleep(2)
                continue
            mc.die("Couldn't ask MusicBrainz about that album: %s" % e, "Is this computer online? Then try again.")
    if not isinstance(rel, dict) or not rel.get("media"):
        mc.die("MusicBrainz didn't say which songs that album has", "Pick another of the albums it found.")
    return rel


def credit(ac):
    return "".join((c.get("name") or (c.get("artist") or {}).get("name") or "") + (c.get("joinphrase") or "")
                   for c in ac or []).strip()


def album_tracks(rel):
    """The album's songs in order: disc, number, title, artist, length in seconds (or None), and their ids."""
    album_artist = credit(rel.get("artist-credit"))
    out = []
    for disc, m in enumerate(rel.get("media") or [], 1):
        for i, t in enumerate(m.get("tracks") or [], 1):
            rec = t.get("recording") or {}
            ms = t.get("length") or rec.get("length")
            out.append({"disc": int(m.get("position") or disc), "number": int(t.get("position") or i),
                        "title": t.get("title") or rec.get("title") or "", "length": ms / 1000.0 if ms else None,
                        "artist": credit(t.get("artist-credit") or rec.get("artist-credit")) or album_artist,
                        "track_id": t.get("id") or "", "recording_id": rec.get("id") or "",
                        "of": len(m.get("tracks") or [])})
    return out


def place_on_album(path, root):
    """(disc, number) a file's name and folder say, or None: "CD2/03 Song" is (2, 3), "1-07 Song" is (1, 7)."""
    m = TRACK_NO_RE.match(Path(path).stem)
    if not m:
        return None
    disc = int(m.group(1)) if m.group(1) else None
    if disc is None:
        for part in Path(path).relative_to(root).parts[:-1] if root != Path(path) else ():
            d = DISC_DIR_RE.match(part)
            if d:
                disc = int(d.group(1))
    return disc or 1, int(m.group(2))


def mmss(sec):
    return "%d:%02d" % (int(sec) // 60, int(round(sec)) % 60)


def match_tracks(files, tracks, root, length):
    """Pair each file with its song on the album: by the track numbers in their names when every file has
    one, else in order when the counts agree. A file whose length is far from its song's says so: it's
    likely another edition of the album, and filing it under the wrong names is worse than asking."""
    discs = {t["disc"] for t in tracks}
    by_place = {(t["disc"], t["number"]): t for t in tracks}
    places = [place_on_album(f, root) for f in files]
    if len(discs) == 1:
        places = [(min(discs), p[1]) if p else None for p in places]
    pairs = None
    if all(places) and len(set(places)) == len(places) and all(p in by_place for p in places):
        pairs = [(f, by_place[p]) for f, p in zip(files, places)]
    elif len(files) == len(tracks):
        pairs = list(zip(files, tracks))
    if pairs is None:
        raise RuntimeError("That album has %d songs and this has %d, with no track numbers to match them by. "
                           "Try another edition, or Leave it." % (len(tracks), len(files)))
    for f, t in pairs:
        have = length(f)
        if have and t["length"] and abs(have - t["length"]) > 30:
            raise RuntimeError("%s is %s long, but that album's song %d, “%s”, is %s: probably another edition. "
                               "Try another." % (f.name, mmss(have), t["number"], t["title"], mmss(t["length"])))
    return pairs


def song_length(p):
    import mutagen
    try:
        f = mutagen.File(str(p))
    except Exception:
        return None
    return getattr(getattr(f, "info", None), "length", None) or None


def tag_as_album(pairs, rel):
    """Write the album's names onto its songs (title, artist, album, year, track and disc), and its
    MusicBrainz ids so beets matches it at once. A format that can't hold an id just goes without it."""
    import mutagen
    album, year = rel.get("title") or "", (rel.get("date") or "")[:4]
    album_artist = credit(rel.get("artist-credit"))
    discs = len({t["disc"] for _, t in pairs})
    for f, t in pairs:
        song = mutagen.File(str(f), easy=True)
        if song is None:
            raise RuntimeError("Can't write names onto %s" % f.name)
        if song.tags is None:
            song.add_tags()
        tags = {"title": t["title"], "artist": t["artist"], "album": album, "albumartist": album_artist,
                "tracknumber": "%d/%d" % (t["number"], t["of"]), "discnumber": "%d/%d" % (t["disc"], max(discs, 1))}
        if year:
            tags["date"] = year
        for k, v in tags.items():
            song[k] = v
        for k, v in (("musicbrainz_albumid", rel.get("id")), ("musicbrainz_releasetrackid", t["track_id"]),
                     ("musicbrainz_trackid", t["recording_id"])):
            if v:
                try:
                    song[k] = v
                except (KeyError, ValueError):
                    pass  # not every format has a place for it
        song.save()


def name_album(item, files, mbid, apply):
    """Name these songs: the album the person picked, its songs paired with the files and written onto them."""
    rel = mb_release(mbid)
    tracks = album_tracks(rel)
    root = item if item.is_dir() else item.parent
    try:
        pairs = match_tracks(sorted(files, key=lambda p: [int(s) if s.isdigit() else s.casefold()
                                                          for s in re.split(r"(\d+)", str(p.relative_to(root)))]),
                             tracks, root, song_length)
    except RuntimeError as e:
        mc.die(str(e))
    what = "%s · %s" % (rel.get("title") or "", credit(rel.get("artist-credit")))
    if not apply:
        for f, t in pairs:
            ui.kv(f.name, "→ %d. %s" % (t["number"], t["title"]))
        return what
    try:
        tag_as_album(pairs, rel)
    except Exception as e:
        mc.die("Couldn't write the album's names onto the songs: %s" % e)
    ui.ok("Named %s as %s" % (mc.fmt_n(len(pairs)) + (" song" if len(pairs) == 1 else " songs"), what))
    return what


def file_music(args):
    need(["beets", "mutagen", "yaml"])
    lib = music_lib(args)
    apply = args.apply or args.yes
    ui.title("New music", "filing into %s" % mc.pretty_path(lib))
    beet = Beet(write_inbox_beets_config(lib))
    filed, replaced, discarded, unnamed = [], 0, 0, []
    started = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() - 2))
    shrink = mc.cfg("music", "shrink_lossless", True) is not False
    album_id = getattr(args, "album", None)
    if album_id and not MBID_RE.match(album_id):
        mc.die("That isn't a MusicBrainz album: %s" % album_id)
    for item in [Path(p) for p in args.paths]:
        files = [item] if item.is_file() else mc.walk_files(item, mo.AUDIO_EXT)
        files = [f for f in files if f.suffix.lower() in mo.AUDIO_EXT]
        if not files:
            continue
        if album_id:
            name_album(item, files, album_id, apply)
        artist, album = album_key(files)
        by_sound = False
        if not (artist and album) and not album_id:
            # Filed as they are, they'd land in a folder with no name. With AcoustID, beets tries them by their
            # sound first (and leaves what it can't match where it is); otherwise, or if it can't, Needs a look asks.
            if not (apply and can_fingerprint()):
                ui.warn(UNNAMED)
                unnamed.append(str(item))
                continue
            by_sound = True
        existing = []
        # A download's tags are whoever made it's: beets reads "albumartist:X" as "contains X", and an X starting
        # with ":" as a pattern (":." is every album), so ask for exactly these names (=~, any case).
        exact = ["albumartist:=~" + artist, "album:=~" + album]
        if artist and album:
            for line in beet("ls", "-f", "$albumartist\t$album\t$path", *exact):
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
        if shrink and not by_sound:  # a download that may stay where it is isn't changed
            files = shrink_lossless(files)
        if existing:
            for e in existing:
                mc.trash(e)
            beet("rm", "-f", *exact)
            replaced += 1
        if by_sound:
            beet("-c", str(skip_unmatched()), "import", str(item))
            if all(f.exists() for f in files):
                ui.warn(UNNAMED)
                unnamed.append(str(item))
                continue
        else:
            # The album the person picked: beets takes that one, not a guess of its own.
            beet(*(["import"] + (["--search-id", album_id] if album_id else []) + [str(item)]))
        if item.is_dir():
            mc.remove_empty_dirs(item, keep_root=False)
    if not apply:
        ui.result(action="file", ok=not unnamed, media="music", preview=True, unnamed=unnamed)
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
    if filed or not unnamed:
        ui.ok("Filed %s songs (%s albums)" % (mc.fmt_n(len(filed)), mc.fmt_n(len(folders))))
    # The songs themselves too: Undo (What I did today) moves exactly those back, never an album folder that
    # holds songs that were there before.
    # Songs with no names, and nothing else filed: not done, and Needs a look says why.
    ui.result(action="file", ok=not (unnamed and not filed), media="music", filed=folders, songs=len(filed),
              songs_filed=filed, replaced=replaced, discarded=discarded, genres_fixed=regenred, told=servers.sent,
              unnamed=unnamed, why=UNNAMED if unnamed else "")


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
    ap.add_argument("--tidy", action="store_true", help="lyrics: set the songs' own lyrics right, asking LRCLIB nothing")
    ap.add_argument("--album", help="file: the MusicBrainz album these songs are (Name these songs), written onto them first")
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
