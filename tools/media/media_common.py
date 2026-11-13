#!/usr/bin/env python3
"""
What the Tidy Up engines share: the screen and app events, the settings file, the Trash, ffprobe,
Tdarr's API, the media servers' targeted refreshes, and subtitle alignment.

The screen/event code, the settings file and the confirmation prompt are the vendored music
organizer's own (imported, not copied), so every engine speaks the same --events json as
music_organizer.py and books_organizer.py:
  {"type": "title"|"step"|"progress"|"working"|"ok"|"warn"|"fail"|"info"|"kv"|"cmd"|"result", ...}

Everything here uses pathlib and runs the same on macOS, Linux and Windows (E:\\ drives too).
Python 3.8 or newer, standard library only.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

HERE = Path(os.path.abspath(__file__)).parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import music_organizer as mo  # noqa: E402  (vendored; only its screen, settings and helpers are used)

ui = mo.ui
die = mo.die


class Expected(RuntimeError):
    """A stop that isn't a fault (Tdarr wants a sign-in): said as it is, without "Something unexpected
    went wrong" or a traceback."""


def run_main(main):
    """The organizers' run_main, with an Expected stop said plainly."""
    def guarded():
        try:
            main()
        except Expected as e:
            die(str(e))
    mo.run_main(guarded)
fmt_n = mo.fmt_n
fmt_time = mo.fmt_time
pretty_path = mo.pretty_path

IS_WINDOWS = os.name == "nt"
IS_MAC = sys.platform == "darwin"

VIDEO_EXT = {".mkv", ".mp4", ".m4v", ".avi", ".mov", ".wmv", ".ts", ".m2ts", ".webm", ".mpg", ".mpeg", ".flv"}
MUSIC_EXT = {".flac", ".mp3", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wav", ".aiff", ".aif", ".alac",
             ".wma", ".ape", ".wv", ".dsf"}
AUDIOBOOK_EXT = {".m4b"}
BOOK_EXT = {".epub", ".pdf", ".mobi", ".azw3", ".azw", ".cbz", ".cbr"}
SUB_EXT = {".srt", ".ass", ".ssa", ".sub", ".idx", ".vtt", ".sup"}
# Files a download is still writing; an item with one of these isn't finished.
PARTIAL_EXT = {".part", ".crdownload", ".download", ".!qb", ".partial", ".tmp", ".aria2", ".opdownload"}

# Folders the engines keep their own working files in; never scanned, never scrubbed.
WORK_DIRS = {".music-cleanup", ".tdarr-output", ".tidy-staging", ".tidy-unzip", ".tidy-trash", ".Trashes", ".Trash",
             "$RECYCLE.BIN", "System Volume Information", "@eaDir", "lost+found", ".stfolder"}


# ============================================================== settings
def load_settings(path=None, yes=False, events=None):
    """Load homelab_media.json (the homelab writes it before each run) and the --yes/--events flags."""
    if events == "json":
        ui.use_events()
    mo.YES = bool(yes)
    mo.load_config(path)
    return mo.CFG


def cfg(section, key=None, default=None):
    sec = mo.CFG.get(section) or {}
    if key is None:
        return sec
    v = sec.get(key)
    return default if v in (None, "") else v


def expand(p):
    """A settings path: ~ and environment variables expanded, resolved where it exists."""
    if not p:
        return None
    path = Path(os.path.expandvars(os.path.expanduser(str(p))))
    try:
        return path.resolve() if path.exists() else path
    except OSError:
        return path


def library_dir(section):
    lib = expand(cfg(section, "library"))
    if not lib:
        die("Which %s folder?" % section, "Set it in Tidy Up › Settings, or pass --library.")
    if not lib.is_dir():
        die("Folder not found: %s" % lib, "Is the drive plugged in? Check the path and try again.")
    return lib


def state_file(name):
    """A small JSON record an engine keeps between runs (~/.homelab-media/<name>.json)."""
    return mo.state_dir() / ("%s.json" % name)


def load_state(name, default=None):
    p = state_file(name)
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except ValueError:
            ui.warn("%s was damaged; starting a fresh record (the old one is kept beside it)." % pretty_path(p))
            p.replace(p.with_suffix(".damaged.json"))
    return json.loads(json.dumps(default if default is not None else {}))


def save_state(name, data):
    """Saved whole or not at all: through a temporary file of this save's own (two jobs can keep the same
    record: a film scan and Collect both keep movies.json), then renamed into place."""
    import tempfile
    p = state_file(name)
    fd, tmp = tempfile.mkstemp(dir=str(p.parent), prefix=p.stem + ".", suffix=".saving")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(data, indent=1, ensure_ascii=False, default=str))
        os.replace(tmp, str(p))
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# ============================================================== files
def _real(p):
    """A path with its links, and Windows' short names, resolved: how the engines compare folders."""
    try:
        return os.path.realpath(str(p))
    except (OSError, ValueError):
        return str(p)


def is_hidden(p):
    return p.name.startswith(".") or p.name.startswith("._") or p.name in WORK_DIRS


def walk_files(root, exts=None, skip_hidden=True):
    """Every file under root (sorted, so runs are repeatable), skipping working folders and ._ files."""
    root = Path(root)
    out = []
    for dirpath, dirnames, filenames in os.walk(str(root)):
        dirnames[:] = sorted(d for d in dirnames if not (skip_hidden and (d.startswith(".") or d in WORK_DIRS)))
        for fn in sorted(filenames):
            if fn.startswith("._") or (skip_hidden and fn.startswith(".")):
                continue
            p = Path(dirpath) / fn
            if exts is None or p.suffix.lower() in exts:
                out.append(p)
    return out


# Windows' device names: a file named one of them, with any extension after it (nul.mkv,
# CON.Air (1997)), can't be made or opened there.
_RESERVED = re.compile(r"(?i)(CON|PRN|AUX|NUL|COM[0-9\u00b9\u00b2\u00b3]|LPT[0-9\u00b9\u00b2\u00b3])\s*(\..*)?")


def nfc(s):
    """One spelling for a name: a Mac writes é as e + accent (NFD), most else as one letter (NFC).
    Linux's file systems and Windows keep both, as two different names, so the engines write NFC."""
    return unicodedata.normalize("NFC", str(s))


def name_key(s):
    """How two names are compared as one: the same letters, whatever the case, punctuation, or spelling."""
    return re.sub(r"\W+", "", nfc(s)).casefold()


def safe_name(s, limit=180):
    """A file or folder name every file system takes (exFAT, NTFS, APFS, ext4): no characters any of
    them refuse, no Windows device name, no dot or space at the end, and at most limit bytes (ext4
    and APFS count a name's bytes, 255 at most, and one Chinese or Japanese letter is three)."""
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", nfc(s))
    s = re.sub(r"\s+", " ", s).strip().rstrip(".").strip()
    if _RESERVED.fullmatch(s):
        s = "_" + s
    s = s or "Unknown"
    if len(s.encode("utf-8")) > limit:
        s = s.encode("utf-8")[:limit].decode("utf-8", "ignore")
        # A letter's accent cut from it is dropped with it.
        while s and unicodedata.combining(s[-1]):
            s = s[:-1]
    return s.rstrip(" .") or "Unknown"


def same_volume(a, b):
    try:
        return os.stat(str(a)).st_dev == os.stat(str(b)).st_dev
    except OSError:
        return False


def move_file(src, dst):
    """Move a file, making the folders; a rename on the same drive, a verified copy across drives."""
    src, dst = Path(src), Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        if str(src) != str(dst) and _same_file(src, dst):
            # A new spelling of the same name (heat → Heat, or é spelled another way) on a drive that
            # treats them as one (a Mac's, Windows'): through a name of its own, so the new one shows.
            step = unique_path(dst.with_name(dst.name + ".tidy-rename"))
            os.rename(str(src), str(step))
            os.rename(str(step), str(dst))
            return dst
        raise FileExistsError(str(dst))
    try:
        os.rename(str(src), str(dst))
        return dst
    except OSError:
        pass
    tmp = dst.with_name(dst.name + ".tidy-copy")
    shutil.copy2(str(src), str(tmp))
    if tmp.stat().st_size != src.stat().st_size:
        tmp.unlink()
        raise IOError("copy of %s came out a different size" % src)
    os.replace(str(tmp), str(dst))
    src.unlink()
    return dst


def _same_file(a, b):
    try:
        return os.path.samefile(str(a), str(b))
    except OSError:
        return False


def unique_path(p):
    p = Path(p)
    if not p.exists():
        return p
    for i in range(2, 10000):
        cand = p.with_name("%s (%d)%s" % (p.stem, i, p.suffix))
        if not cand.exists():
            return cand
    raise FileExistsError(str(p))


def remove_empty_dirs(root, keep_root=True):
    """Remove folders with nothing in them (or only .DS_Store/Thumbs.db/._ files), deepest first."""
    root = Path(root)
    removed = []
    if not root.is_dir():
        return removed
    junk = {".DS_Store", "Thumbs.db", "desktop.ini"}
    for dirpath, dirnames, filenames in sorted(os.walk(str(root)), key=lambda t: -t[0].count(os.sep)):
        d = Path(dirpath)
        if any(part in WORK_DIRS for part in d.relative_to(root).parts):
            continue
        if keep_root and d == root:
            continue
        try:
            entries = list(d.iterdir())
        except OSError:
            continue
        if all(e.is_file() and (e.name in junk or e.name.startswith("._")) for e in entries):
            for e in entries:
                try:
                    e.unlink()
                except OSError:
                    pass
            try:
                d.rmdir()
                removed.append(d)
            except OSError:
                pass
    return removed


def folder_size(p):
    p = Path(p)
    if p.is_file():
        return p.stat().st_size
    return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())


# ============================================================== the Trash
TRASH = "the Recycle Bin" if IS_WINDOWS else "the Trash"


def trash_words(text):
    """A message in this system's own word for the Trash."""
    return text.replace("%TRASH%", TRASH)


def _volume_root(p):
    p = Path(p).resolve()
    dev = os.stat(str(p)).st_dev
    cur = p
    while cur.parent != cur:
        try:
            if os.stat(str(cur.parent)).st_dev != dev:
                return cur
        except OSError:
            return cur
        cur = cur.parent
    return cur


def _trash_dir(p):
    """Where the system keeps the Trash for p's drive, so trashing is a rename, never a copy."""
    p = Path(p).resolve()
    home = Path.home()
    uid = os.getuid() if hasattr(os, "getuid") else 0
    if IS_MAC:
        if same_volume(p, home):
            return home / ".Trash", None
        return _volume_root(p) / ".Trashes" / str(uid), None
    # Linux and the rest: the freedesktop.org Trash (what Files, Dolphin and the desktop's Trash show).
    data = Path(os.environ.get("XDG_DATA_HOME") or home / ".local" / "share")
    if same_volume(p, home):
        return data / "Trash" / "files", data / "Trash" / "info"
    top = _volume_root(p) / (".Trash-%d" % uid)
    return top / "files", top / "info"


def trashed_from(src, at):
    """Whether at is where trash() would have put src: directly in the Trash of src's drive (on
    Windows, a dated folder of that drive's .tidy-trash). Undo moves only such a thing back, so a
    trash log that came with a homelab made elsewhere can't have it place any other file anywhere."""
    src, at = Path(src), Path(at)
    if not src.is_absolute() or not at.is_absolute():
        return False
    near = src.parent  # src is gone, and its folder may be: the nearest folder still there
    while not near.exists() and near.parent != near:
        near = near.parent
    try:
        if IS_WINDOWS:
            return os.path.realpath(str(at.parent.parent)) == os.path.realpath(str(_drive_root(near) / ".tidy-trash"))
        files, _ = _trash_dir(near)
    except OSError:
        return False
    return os.path.realpath(str(at.parent)) == os.path.realpath(str(files))


def library_roots():
    """Each library Tidy Up files into."""
    return [expand(r) for r in (cfg(sec, "library") for sec in ("music", "movies", "tv", "audiobooks", "books")) if r]


def inbox_roots():
    """The inbox folders the sweep files downloads from."""
    return [expand(r) for r in (cfg("inbox", "folders") or ["~/Downloads"]) if r]


def media_roots():
    """The folders Tidy Up throws things away from: each library, the inbox folders, the scrubber's
    own roots, and the reports folder (where a music cleanup sets duplicates aside)."""
    roots = list(cfg("scrubber", "roots") or [])
    roots.append(os.environ.get("HOMELAB_MEDIA_REPORTS") or mo.CFG.get("reports_dir") or "~/Downloads")
    return library_roots() + inbox_roots() + [expand(r) for r in roots if r]


def inside(p, roots):
    """Whether p, with its links and any .. resolved, is inside one of roots (never one itself)."""
    p = Path(p)
    if not p.is_absolute():
        return False
    real = os.path.normcase(os.path.realpath(str(p)))
    for r in roots:
        root = os.path.normcase(os.path.realpath(str(r)))
        try:
            if real != root and os.path.commonpath([real, root]) == root:
                return True
        except ValueError:  # another drive on Windows
            continue
    return False


def in_media_root(p):
    """Whether p is inside one of media_roots(). Undo puts a thing back only there, so a line in the
    trash log can't name any other place."""
    return inside(p, media_roots())


def _trash_windows(p):
    """The Recycle Bin, through the same call Explorer uses (recoverable with Restore)."""
    is_dir = Path(p).is_dir()
    ps = ("Add-Type -AssemblyName Microsoft.VisualBasic; "
          "[Microsoft.VisualBasic.FileIO.FileSystem]::%s($env:TIDY_TRASH, 'OnlyErrorDialogs', 'SendToRecycleBin')"
          % ("DeleteDirectory" if is_dir else "DeleteFile"))
    env = dict(os.environ, TIDY_TRASH=str(p))  # the path travels in the environment: no quoting to get wrong
    r = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", ps], env=env,
                       capture_output=True, text=True)
    if r.returncode != 0 or Path(p).exists():
        raise OSError("the Recycle Bin refused %s: %s" % (p, (r.stderr or r.stdout).strip()[-300:]))
    return Path(os.environ.get("SystemDrive", "C:") + "\\$Recycle.Bin")


# What Windows' GetDriveTypeW says a drive is: a USB stick or SD card (removable) and a network
# share keep no Recycle Bin, so sending a file there deletes it for good, without a word.
DRIVE_REMOVABLE, DRIVE_REMOTE = 2, 4


def _drive_root(p):
    """The drive (M:\\) or network share (\\\\server\\share\\) p is on."""
    return Path(Path(p).resolve().anchor)


def _windows_drive_kind(p):
    root = str(_drive_root(p))
    if root.startswith("\\\\"):
        return DRIVE_REMOTE
    try:
        import ctypes
        return ctypes.windll.kernel32.GetDriveTypeW(root)
    except (ImportError, AttributeError, OSError):
        return 0


def _trash_beside(p):
    """A drive with no Recycle Bin: Tidy Up's own hidden trash at the top of that drive, a dated
    folder a day, so nothing is ever deleted outright. (Still a rename: nothing is copied.)"""
    top = _drive_root(p) / ".tidy-trash"
    day = top / datetime.now().strftime("%Y-%m-%d")
    day.mkdir(parents=True, exist_ok=True)
    if IS_WINDOWS:
        try:
            import ctypes
            ctypes.windll.kernel32.SetFileAttributesW(str(top), 0x2)  # hidden, as $RECYCLE.BIN is
        except (ImportError, AttributeError, OSError):
            pass
    dest = day / p.name
    n = 1
    while dest.exists():
        n += 1
        dest = day / ("%s %d%s" % (p.stem if p.is_file() else p.name, n, p.suffix if p.is_file() else ""))
    os.rename(str(p), str(dest))
    return dest


def note_thrown(src, dest):
    """Note what went to the Trash under this run (the app's HOMELAB_MEDIA_RUN), for Undo: where it
    was, and where it is now (none for the Recycle Bin, which doesn't say)."""
    run, log = os.environ.get("HOMELAB_MEDIA_RUN"), os.environ.get("HOMELAB_MEDIA_TRASH_LOG")
    if not run or not log:
        return
    try:
        Path(log).parent.mkdir(parents=True, exist_ok=True)
        with open(log, "a", encoding="utf-8") as f:
            f.write(json.dumps({"run": run, "from": str(src), "to": str(dest) if dest else "",
                                "at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}) + "\n")
    except OSError as e:
        ui.to_log("NOTE   couldn't note %s for Undo: %s" % (src, e))


def trash(p, dry_run=False):
    """Move a file or folder to the system Trash (Recycle Bin on Windows). Never deletes outright.
    Returns where it went. Everything the engines throw away goes through here."""
    p = Path(p)
    if not p.exists() and not p.is_symlink():
        return None
    if dry_run:
        return p
    src = Path(os.path.abspath(str(p)))
    dest = _trash(p)
    note_thrown(src, None if IS_WINDOWS and dest and dest.name == "$Recycle.Bin" else dest)
    return dest


def _trash(p):
    if IS_WINDOWS:
        if _windows_drive_kind(p) in (DRIVE_REMOVABLE, DRIVE_REMOTE):
            return _trash_beside(p)
        return _trash_windows(p)
    files, info = _trash_dir(p)
    files.mkdir(parents=True, exist_ok=True)
    if IS_MAC and files.parent.name == ".Trashes":
        try:
            os.chmod(str(files), 0o700)
        except OSError:
            pass
    dest = files / p.name
    n = 1
    while dest.exists() or (info and (info / (dest.name + ".trashinfo")).exists()):
        n += 1
        dest = files / ("%s %d%s" % (p.stem if p.is_file() else p.name, n, p.suffix if p.is_file() else ""))
    if info:
        info.mkdir(parents=True, exist_ok=True)
        (info / (dest.name + ".trashinfo")).write_text(
            "[Trash Info]\nPath=%s\nDeletionDate=%s\n" % (urllib.parse.quote(str(p.resolve())),
                                                         datetime.now().strftime("%Y-%m-%dT%H:%M:%S")),
            encoding="utf-8")
    try:
        os.rename(str(p), str(dest))
    except OSError:
        # A Trash on another drive (a read-only volume root, say): the home Trash, by copy.
        shutil.move(str(p), str(dest))
    return dest


# ============================================================== commands
def run(cmd, timeout=None, check=False, env=None):
    """Run a command quietly; its output goes to the log. Tests replace subprocess.run."""
    ui.to_log("       $ " + " ".join(str(c) for c in cmd))
    try:
        r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=timeout, env=env, stdin=subprocess.DEVNULL)
    except FileNotFoundError:
        raise RuntimeError("%s isn't installed" % cmd[0])
    except subprocess.TimeoutExpired:
        raise RuntimeError("%s took longer than %ds" % (Path(str(cmd[0])).name, timeout))
    if check and r.returncode != 0:
        raise RuntimeError("%s failed: %s" % (Path(str(cmd[0])).name, (r.stderr or r.stdout).strip()[-400:]))
    return r


def which(name, setting=None):
    """A tool from the settings, from PATH, or from the usual install places (Homebrew, winget, Tidy Up's Install)."""
    if setting and Path(os.path.expanduser(setting)).exists():
        return str(Path(os.path.expanduser(setting)))
    found = shutil.which(name)
    if found:
        return found
    extra = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", str(Path.home() / ".local" / "bin"),
             # What Tidy Up's Install fetched (ffmpeg, ffprobe): after PATH, so one installed another way comes first.
             str(Path.home() / ".homelab-media" / "bin"),
             # Homebrew and Nix on Linux: how a SteamOS Deck, whose / is read-only, gets ffmpeg.
             str(Path.home() / ".nix-profile" / "bin"), "/nix/var/nix/profiles/default/bin", "/home/linuxbrew/.linuxbrew/bin"]
    if IS_WINDOWS:
        extra += [r"C:\ffmpeg\bin", str(Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links")]
    for d in extra:
        for cand in (Path(d) / name, Path(d) / (name + ".exe")):
            if cand.is_file():
                return str(cand)
    return None


# ============================================================== ffprobe
VIDEO_RANK = {"av1": 4, "hevc": 3, "h265": 3, "vp9": 3, "h264": 2, "avc": 2, "vc1": 1, "mpeg4": 1,
              "msmpeg4v3": 1, "mpeg2video": 1, "wmv3": 1, "mpeg1video": 0}
AUDIO_RANK = {"opus": 4, "aac": 3, "vorbis": 3, "eac3": 3, "ac3": 2, "mp3": 2, "dts": 1, "truehd": 0,
              "flac": 0, "alac": 0, "mlp": 0, "wmalossless": 0}
LOSSLESS_AUDIO = {"flac", "alac", "truehd", "mlp", "wmalossless", "ape", "wavpack", "tta"}


def ffprobe(path):
    tool = which("ffprobe", cfg("tools", "ffprobe"))
    if not tool:
        raise RuntimeError("ffprobe isn't installed (it comes with ffmpeg)")
    r = run([tool, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)], timeout=120)
    if r.returncode != 0:
        raise RuntimeError("ffprobe can't read %s: %s" % (Path(path).name, r.stderr.strip()[-200:]))
    return json.loads(r.stdout or "{}")


def _lang(s):
    return ((s.get("tags") or {}).get("language") or "und").lower()


def media_facts(info):
    """The parts of ffprobe's answer the engines decide with."""
    streams = info.get("streams") or []
    fmt = info.get("format") or {}
    video = [s for s in streams if s.get("codec_type") == "video" and not (s.get("disposition") or {}).get("attached_pic")]
    audio = [s for s in streams if s.get("codec_type") == "audio"]
    subs = [s for s in streams if s.get("codec_type") == "subtitle"]
    v = video[0] if video else {}
    codec = (v.get("codec_name") or "").lower()
    if codec == "pcm" or codec.startswith("pcm_"):
        codec = "pcm"
    a_codecs = []
    for s in audio:
        c = (s.get("codec_name") or "").lower()
        if c.startswith("pcm_"):
            c = "pcm"
        if c == "dts" and "MA" in (s.get("profile") or ""):
            c = "dts-hd ma"
        a_codecs.append(c)
    try:
        duration = float(fmt.get("duration") or v.get("duration") or 0)
    except ValueError:
        duration = 0.0
    try:
        size = int(fmt.get("size") or 0)
    except ValueError:
        size = 0
    try:
        bitrate = int(fmt.get("bit_rate") or 0)
    except ValueError:
        bitrate = 0
    a0 = audio[0] if audio else {}
    try:
        a_bitrate = int(a0.get("bit_rate") or 0) or (bitrate if not video else 0)
    except ValueError:
        a_bitrate = 0
    return {
        "video_codec": codec, "width": int(v.get("width") or 0), "height": int(v.get("height") or 0),
        "audio_codecs": a_codecs, "audio_langs": [_lang(s) for s in audio],
        "sub_langs": [_lang(s) for s in subs], "duration": duration, "size": size, "bitrate": bitrate,
        "audio_bitrate": a_bitrate, "audio_codec": a_codecs[0] if a_codecs else "",
        "embedded_art": sum(1 for s in streams if (s.get("disposition") or {}).get("attached_pic")),
        "tags": {k.lower(): v for k, v in (fmt.get("tags") or {}).items()},
        "chapters": len(info.get("chapters") or []),
    }


def bloat_reasons(facts, keep_langs=None, target="hevc"):
    """Why a video wastes space (empty: it's already lean). keep_langs: audio/subtitle languages to keep."""
    keep = {l.lower() for l in (keep_langs or ["eng"])} | {"und", "zxx", "mul"}
    reasons = []
    vr = VIDEO_RANK.get(facts["video_codec"], 0)
    if facts["video_codec"] and vr < VIDEO_RANK.get(target, 3):
        reasons.append("video is %s (%s is about half the size)" % (facts["video_codec"].upper(), target.upper()))
    heavy = [c for c in facts["audio_codecs"] if c in LOSSLESS_AUDIO or c in ("pcm", "dts-hd ma")]
    if heavy:
        reasons.append("uncompressed or lossless audio (%s)" % ", ".join(sorted(set(heavy))))
    foreign = [l for l in facts["audio_langs"] if l not in keep]
    if foreign and len(facts["audio_langs"]) > 1:
        reasons.append("%d extra audio track%s (%s)" % (len(foreign), "" if len(foreign) == 1 else "s",
                                                     ", ".join(sorted(set(foreign)))))
    extra_subs = [l for l in facts["sub_langs"] if l not in keep]
    if extra_subs:
        reasons.append("%d extra subtitle track%s" % (len(extra_subs), "" if len(extra_subs) == 1 else "s"))
    return reasons


def same_cut(new, old):
    """The same film or episode by its length: within two minutes, or 5% (not another cut, or a sample)."""
    return not (old["duration"] and new["duration"] and abs(new["duration"] - old["duration"]) > max(120, 0.05 * old["duration"]))


def video_more_efficient(new, old):
    """Shrink & Strip: True when the inbound copy of the same film/episode costs less space for at
    least the same picture: a newer codec (AV1 > HEVC > H.264), or the same codec and smaller."""
    if not same_cut(new, old):
        return False  # a different cut, or a sample: not the same thing
    if new["height"] and old["height"] and new["height"] < old["height"] * 0.7:
        return False  # 720p is smaller than 2160p, but it isn't better
    nr, orank = VIDEO_RANK.get(new["video_codec"], 0), VIDEO_RANK.get(old["video_codec"], 0)
    if nr != orank:
        return nr > orank and (not old["size"] or new["size"] <= old["size"] * 1.1)
    return bool(new["size"] and old["size"] and new["size"] < old["size"] * 0.95)


def audio_more_efficient(new, old, min_lossy_kbps=192):
    """Shrink & Strip for songs: high-quality Opus/AAC beats a massive FLAC; otherwise smaller wins
    at the same codec. A low-bitrate file never replaces a better one."""
    nc, oc = new["audio_codec"], old["audio_codec"]
    nk, ok_ = (new["audio_bitrate"] or 0) // 1000, (old["audio_bitrate"] or 0) // 1000
    if nc in LOSSLESS_AUDIO and oc in LOSSLESS_AUDIO:
        return bool(new["size"] and old["size"] and new["size"] < old["size"] * 0.95)
    if nc in LOSSLESS_AUDIO:
        return False  # lossless in, lossy already here: the library copy is the lean one
    good = nk >= (min_lossy_kbps if nc != "opus" else min(min_lossy_kbps, 128))
    if oc in LOSSLESS_AUDIO:
        return good
    if not good or nk < ok_ * 0.8:
        return False
    nr, orank = AUDIO_RANK.get(nc, 1), AUDIO_RANK.get(oc, 1)
    if nr != orank:
        return nr > orank
    return bool(new["size"] and old["size"] and new["size"] < old["size"] * 0.95)


def same_length(a, b, tolerance=2.0):
    return abs(a - b) <= max(tolerance, 0.005 * max(a, b))


# ============================================================== HTTP
def _origin(url):
    u = urllib.parse.urlsplit(url)
    return (u.scheme.lower(), (u.hostname or "").lower(), u.port or {"http": 80, "https": 443}.get(u.scheme.lower()))


class _KeysStayHome(urllib.request.HTTPRedirectHandler):
    """A redirect is followed, but to another host (or scheme, or port) only Accept and User-Agent go along:
    urlopen would carry every header, a server's key (X-Emby-Token, x-api-key, Authorization) included."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and _origin(newurl) != _origin(req.full_url):
            keep = {"accept", "user-agent"}
            new.headers = {k: v for k, v in new.headers.items() if k.lower() in keep}
        return new


_opener = urllib.request.build_opener(_KeysStayHome)


# The most any answer is read to: room for a large library's list from Jellyfin, never without end. A call to an
# outside service (lrclib.net, MusicBrainz) asks for far less with max_bytes.
MAX_ANSWER = 64 * 1024 * 1024


def http_json(method, url, body=None, headers=None, timeout=30, form=False, max_bytes=MAX_ANSWER):
    data = None
    h = {"Accept": "application/json"}
    if body is not None:
        if form:
            data = urllib.parse.urlencode(body).encode()
            h["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with _opener.open(req, timeout=timeout) as r:
            raw = r.read(max_bytes + 1)
        if len(raw) > max_bytes:
            raise RuntimeError("%s %s answered too large a reply (over %d MB)" % (method, re.sub(r"[?].*", "", url),
                                                                               max_bytes // (1024 * 1024)))
    except urllib.error.HTTPError as e:
        raise RuntimeError("%s %s answered %d" % (method, re.sub(r"[?].*", "", url), e.code))
    except (urllib.error.URLError, OSError) as e:
        raise RuntimeError("can't reach %s (%s)" % (re.sub(r"[?].*", "", url), getattr(e, "reason", e)))
    if not raw.strip():
        return None
    try:
        return json.loads(raw.decode("utf-8", "replace"))
    except ValueError:
        return raw.decode("utf-8", "replace")


def secret(name):
    """A key or password: from the environment the homelab passes (never on a command line)."""
    return os.environ.get(name) or ""


# ============================================================== what the inbox filed
def note_filed(entry):
    """One line in the record of what was filed from a watched folder (HOMELAB_MEDIA_FILED_LOG, the app's
    data/media-filed.jsonl), for What I did today and its Undo: the run, the time, and the entry's own
    fields. None without the record (a run from Terminal)."""
    log = os.environ.get("HOMELAB_MEDIA_FILED_LOG")
    if not log:
        return None
    entry = dict(entry, run=os.environ.get("HOMELAB_MEDIA_RUN", ""), at=datetime.now().isoformat(timespec="seconds"))
    Path(log).parent.mkdir(parents=True, exist_ok=True)
    with open(log, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def filed_entries():
    """Every line of the record, oldest first; [] without one."""
    log = os.environ.get("HOMELAB_MEDIA_FILED_LOG")
    out = []
    if log and Path(log).is_file():
        for line in Path(log).read_text(encoding="utf-8").splitlines():
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
    return out


# ============================================================== Tdarr
def tdarr(url):
    """Tdarr at url, with the homelab's key or login for it (from the environment, never a command line)."""
    return Tdarr(url, secret("TDARR_API_KEY"), secret("TDARR_USER"), secret("TDARR_PASSWORD"))


class Tdarr:
    """Tdarr's server API. The engines hand it files and read back its verdicts; Tdarr's own queue
    and its nodes' worker limits decide how many transcode at once."""
    DONE = {"Transcode success"}
    FAILED = {"Transcode error", "Error"}
    SKIPPED = {"Not required"}

    # Tdarr asks for a sign-in (its accounts, on since 2.4x): said plainly, with where the login goes.
    SIGN_IN = ("Tdarr asks for a sign-in: put your Tdarr user name and password in Settings › Tidy Up "
               "(TDARR_USER and TDARR_PASSWORD), then try again")

    def __init__(self, url, api_key="", user="", password=""):
        self.url = (url or "").rstrip("/")
        self.headers = {"x-api-key": api_key} if api_key else {}
        self.user, self.password = user, password

    def _sign_in(self):
        """Signs in with the homelab's Tdarr login; its token goes with every call after."""
        try:
            got = http_json("POST", self.url + "/api/v2/public/auth/login",
                            {"username": self.user, "password": self.password}, timeout=15)
        except RuntimeError as e:
            if "answered 4" in str(e):
                raise Expected("Tdarr refused TDARR_USER and TDARR_PASSWORD: check them in Settings › Tidy Up")
            raise
        token = got.get("token") if isinstance(got, dict) else None
        if not token:
            raise Expected("Tdarr's sign-in gave no token: check TDARR_USER and TDARR_PASSWORD in Settings › Tidy Up")
        self.headers["Authorization"] = "Bearer " + token

    def _call(self, method, path, body=None, timeout=60):
        """One call to Tdarr, signed in first when it asks and the homelab has a login for it."""
        for attempt in (0, 1):
            try:
                return http_json(method, self.url + path, body, self.headers, timeout=timeout)
            except RuntimeError as e:
                if str(e).startswith("can't reach"):
                    # Tdarr isn't running (stopped, paused on battery, or out of memory): said plainly.
                    raise Expected("Tdarr isn't answering at %s: start it from Status (Tdarr), then try again. "
                                   "What's with it stays in its queue" % self.url)
                if "answered 401" not in str(e):
                    raise
                if attempt == 0 and self.user and self.password and "Authorization" not in self.headers:
                    self._sign_in()
                    continue
                raise Expected(self.SIGN_IN)

    def _post(self, path, data, timeout=60):
        return self._call("POST", path, {"data": data}, timeout=timeout)

    def ok(self):
        """Whether Tdarr answers at all: one asking for a sign-in is there."""
        try:
            http_json("GET", self.url + "/api/v2/status", headers=self.headers, timeout=10)
            return True
        except RuntimeError as e:
            return "answered 401" in str(e) or "answered 403" in str(e)

    def libraries(self):
        return self._post("/api/v2/cruddb", {"collection": "LibrarySettingsJSONDB", "mode": "getAll"}) or []

    def nodes(self):
        try:
            return self._call("GET", "/api/v2/get-nodes", timeout=15) or {}
        except Expected:
            raise
        except RuntimeError:
            return {}

    def busy(self):
        """Whether any of Tdarr's nodes is working on a file now; None when Tdarr doesn't answer (stopped,
        paused on battery) and so can't say."""
        try:
            nodes = self._call("GET", "/api/v2/get-nodes", timeout=15)
        except (Expected, RuntimeError):
            return None
        for node in (nodes.values() if isinstance(nodes, dict) else ()):
            if isinstance(node, dict) and node.get("workers"):
                return True
        return False

    def give_workers(self, gpu, apply=True):
        """A node with no transcode worker does nothing, and a new Tdarr's node starts with none: each
        such node gets one (on the graphics card when there is one, else the processor), which
        Tdarr's own page can raise. The names of the nodes that had none."""
        kind = "transcodegpu" if gpu else "transcodecpu"
        idle = []
        nodes = self.nodes()
        for nid, node in (nodes.items() if isinstance(nodes, dict) else ()):
            if not isinstance(node, dict):
                continue
            limits = node.get("workerLimits") or {}
            if not isinstance(limits, dict):
                continue
            if int(limits.get("transcodecpu") or 0) + int(limits.get("transcodegpu") or 0) > 0:
                continue
            idle.append(node.get("nodeName") or nid)
            if apply:
                self._post("/api/v2/alter-worker-limit", {"nodeID": nid, "process": "increase", "workerType": kind})
        return idle

    def queue(self, library_id, paths):
        """Add files to a library's queue (Tdarr runs its plugin stack on each, in its own order). A list
        of files is handed as Tdarr's own folder watcher hands them: Tdarr 3 reads none of a list sent
        as scanFindNew, and still answers OK (tried against 3.06, Nov 6)."""
        return self._post("/api/v2/scan-files", {"scanConfig": {"dbID": library_id, "arrayOrPath": list(paths),
                                                               "mode": "scanFolderWatcher"}})

    def requeue(self, path):
        return self._post("/api/v2/cruddb", {"collection": "FileJSONDB", "mode": "update", "docID": path,
                                            "obj": {"TranscodeDecisionMaker": "Queued"}})

    def status(self, path):
        """Tdarr's verdict for one file: Queued, Transcode success, Transcode error, Not required, or None."""
        doc = self._post("/api/v2/cruddb", {"collection": "FileJSONDB", "mode": "getById", "docID": path})
        if not isinstance(doc, dict):
            return None
        return doc.get("TranscodeDecisionMaker") or None


# Tdarr's own work folders in its cache: one a job, holding the copy being made. Tdarr removes one when
# its job ends, but not when Tdarr is stopped mid-video (by the battery saver, an update, a restart): each
# such job leaves a copy as large as the video behind (Nov 8, the owner: 33 of them, 81 GB).
TDARR_WORKDIR = "tdarr-workDir"
# A work folder nothing has written to for this long belongs to no running job: a transcode writes its
# copy all the time.
LEFTOVER_AFTER = 2 * 3600


def _newest(folder):
    """When anything in folder was last written, the folder itself included; links aren't followed."""
    newest = folder.lstat().st_mtime
    for dirpath, dirs, files in os.walk(str(folder)):
        for name in dirs + files:
            try:
                newest = max(newest, os.lstat(os.path.join(dirpath, name)).st_mtime)
            except OSError:
                pass
    return newest


def _size(folder):
    total = 0
    for dirpath, _, files in os.walk(str(folder)):
        for name in files:
            try:
                total += os.lstat(os.path.join(dirpath, name)).st_size
            except OSError:
                pass
    return total


def clear_tdarr_leftovers(td, cache=None, now=None):
    """Removes Tdarr's work folders (tdarr-workDir*) in its cache that nothing has written to for
    LEFTOVER_AFTER, unless one of Tdarr's nodes is working on a file now. Only those folders: nothing
    else in the cache, nothing through a link. A Tdarr that doesn't answer can't be working, so its old
    folders go too. How many were removed, and the bytes they held."""
    cache = cfg("tdarr", "cache") if cache is None else cache
    root = Path(cache) if cache else None
    if not root or not root.is_dir():
        return 0, 0
    if td is not None and td.busy():
        return 0, 0
    now = time.time() if now is None else now
    count, freed = 0, 0
    for d in sorted(root.iterdir()):
        if not d.name.startswith(TDARR_WORKDIR) or d.is_symlink() or not d.is_dir():
            continue
        try:
            if now - _newest(d) < LEFTOVER_AFTER:
                continue
            size = _size(d)
            shutil.rmtree(str(d))
        except OSError:
            continue
        count, freed = count + 1, freed + size
    return count, freed


def plugin_stack(gpu, keep_langs, target="hevc"):
    """The space-saving plugin stack the homelab gives its Tdarr libraries: HEVC (or AV1) video on the
    GPU when there is one, foreign audio and subtitles stripped, streams in a tidy order."""
    langs = ",".join(keep_langs or ["eng"])
    transcode = {
        ("hevc", True): ("Tdarr_Plugin_MC93_Migz1FFMPEG", {"container": "mkv", "bitrate_cutoff": "",
                                                          "enable_10bit": "true", "force_conform": "true"}),
        ("hevc", False): ("Tdarr_Plugin_MC93_Migz1FFMPEG_CPU", {"container": "mkv", "bitrate_cutoff": "",
                                                               "enable_10bit": "true", "force_conform": "true"}),
        ("av1", True): ("Tdarr_Plugin_00td_action_transcode", {"target_codec": "av1", "container": "mkv"}),
        ("av1", False): ("Tdarr_Plugin_00td_action_transcode", {"target_codec": "av1", "container": "mkv"}),
    }[(target, bool(gpu))]
    return [
        {"id": "Tdarr_Plugin_MC93_Migz6OrderStreams", "InputsDB": {}},
        {"id": "Tdarr_Plugin_MC93_Migz3CleanAudio", "InputsDB": {"language": langs, "commentary": "true",
                                                                 "tag_language": "eng"}},
        {"id": "Tdarr_Plugin_MC93_Migz4CleanSubs", "InputsDB": {"language": langs, "commentary": "true"}},
        {"id": "Tdarr_Plugin_MC93_Migz5ConvertAudio", "InputsDB": {"aac_stereo": "true", "downmix": "false"}},
        {"id": transcode[0], "InputsDB": transcode[1]},
    ]


# ============================================================== media servers
class Servers:
    """Tells Plex, Jellyfin, Navidrome and Audiobookshelf about one changed path, so each refreshes
    that folder alone instead of scanning the whole library."""

    def __init__(self, conf=None):
        self.conf = conf if conf is not None else (mo.CFG.get("servers") or {})
        self.sent = []

    @staticmethod
    def server_path(path, path_map):
        """This machine's path as the server sees it (its container's mounts), longest prefix first.
        A folder in the settings may be written through a link (~/Media for /Volumes/Hobbies, a
        Windows short name like RUNNER~1) while the engines work with real paths: each is tried
        both as written and as it resolves, on both sides."""
        s = str(path)
        forms = [s.replace("\\", "/")]
        real = _real(path).replace("\\", "/")
        if real != forms[0]:
            forms.append(real)
        pairs = []
        for host, inside in path_map or []:
            for h in {str(host).replace("\\", "/").rstrip("/"), _real(host).replace("\\", "/").rstrip("/")}:
                pairs.append((h, inside))
        for h, inside in sorted(pairs, key=lambda m: -len(m[0])):
            for norm in forms:
                a, b = (norm.lower(), h.lower()) if IS_WINDOWS else (norm, h)  # E:\ and e:\ are one drive
                if a == b or a.startswith(b + "/"):
                    return inside.rstrip("/") + norm[len(h):]
        return forms[0] if not IS_WINDOWS else s

    def ping(self, path, kind):
        """kind: music, movies, tv, audiobooks, books. Returns the servers told."""
        told = []
        for name in ("jellyfin", "plex", "navidrome", "audiobookshelf"):
            c = self.conf.get(name) or {}
            if not c.get("url") or kind not in (c.get("kinds") or []):
                continue
            try:
                getattr(self, "_" + name)(c, path, kind)
                told.append(name)
            except RuntimeError as e:
                ui.warn("Couldn't tell %s about %s: %s" % (name.title(), Path(path).name, e))
        self.sent.append({"path": str(path), "kind": kind, "told": told})
        return told

    def _jellyfin(self, c, path, kind):
        key = secret(c.get("key_env") or "JELLYFIN_API_KEY")
        if not key:
            raise RuntimeError("no API key: make one in Jellyfin › Dashboard › API Keys, and put it in Settings › Jellyfin")
        p = self.server_path(path, c.get("path_map"))
        http_json("POST", c["url"].rstrip("/") + "/Library/Media/Updated",
                  {"Updates": [{"Path": p, "UpdateType": "Modified"}]},
                  {"Authorization": 'MediaBrowser Token="%s"' % key, "X-Emby-Token": key})

    def _plex(self, c, path, kind):
        token = secret(c.get("token_env") or "PLEX_TOKEN")
        if not token:
            raise RuntimeError("no token (PLEX_TOKEN)")
        base = c["url"].rstrip("/")
        p = self.server_path(path, c.get("path_map"))
        folder = p if Path(str(path)).is_dir() else p.rsplit("/", 1)[0]
        secs = http_json("GET", base + "/library/sections", headers={"X-Plex-Token": token})
        dirs = ((secs or {}).get("MediaContainer") or {}).get("Directory") or []
        for d in dirs:
            for loc in d.get("Location") or []:
                root = (loc.get("path") or "").rstrip("/")
                if root and (folder == root or folder.startswith(root + "/")):
                    http_json("GET", "%s/library/sections/%s/refresh?path=%s" % (base, d["key"], urllib.parse.quote(folder)),
                              headers={"X-Plex-Token": token})
                    return
        raise RuntimeError("no Plex library holds %s" % folder)

    def _navidrome(self, c, path, kind):
        # Subsonic's startScan without fullScan is Navidrome's quick scan: it reads only folders
        # whose contents changed, which is the path we just touched.
        user, pw = secret("NAVIDROME_ADMIN_USER"), secret("NAVIDROME_ADMIN_PASSWORD")
        if not (user and pw):
            raise RuntimeError("no admin login: put a Navidrome administrator's user name and password in Settings › Navidrome")
        q = navidrome_auth(user, pw)
        r = http_json("GET", c["url"].rstrip("/") + "/rest/startScan?" + q)
        st = ((r or {}).get("subsonic-response") or {}).get("status") if isinstance(r, dict) else None
        if st != "ok":
            raise RuntimeError("Navidrome didn't start the scan")

    def _audiobookshelf(self, c, path, kind):
        token = secret(c.get("token_env") or "AUDIOBOOKSHELF_API_KEY")
        if not token:
            raise RuntimeError("no API key (AUDIOBOOKSHELF_API_KEY)")
        base, h = c["url"].rstrip("/"), {"Authorization": "Bearer " + token}
        p = self.server_path(path, c.get("path_map"))
        libs = (http_json("GET", base + "/api/libraries", headers=h) or {}).get("libraries") or []
        for lib in libs:
            for f in lib.get("folders") or []:
                root = (f.get("fullPath") or "").rstrip("/")
                if root and (p == root or p.startswith(root + "/")):
                    http_json("POST", base + "/api/libraries/%s/scan" % lib["id"], {}, h)
                    return
        raise RuntimeError("no Audiobookshelf library holds %s" % p)


def navidrome_auth(user, password, client="homelab-tidy"):
    import hashlib
    salt = "%x" % int(time.time() * 1000)
    tok = hashlib.md5((password + salt).encode()).hexdigest()
    return urllib.parse.urlencode({"u": user, "t": tok, "s": salt, "v": "1.16.1", "c": client, "f": "json"})


# ============================================================== subtitles
def sync_subtitles(video, subs=None):
    """Align sidecar subtitles to the (new) audio with ffsubsync, or alass when that's what's
    installed, so a transcode never leaves them drifting. Returns how many were aligned."""
    video = Path(video)
    if subs is None:
        subs = sorted(p for p in video.parent.iterdir()
                      if p.suffix.lower() in (".srt", ".ass", ".ssa") and p.name.startswith(video.stem))
    fss = which("ffsubsync", cfg("tools", "ffsubsync"))
    alass = None if fss else (which("alass-cli", cfg("tools", "alass")) or which("alass"))
    if not (fss or alass):
        if subs:
            ui.warn("ffsubsync isn't installed, so %d subtitle file%s kept their old timing" % (len(subs), "" if len(subs) == 1 else "s"))
        return 0
    done = 0
    for s in subs:
        out = s.with_name(s.stem + ".tidy-sync" + s.suffix)
        cmd = [fss, str(video), "-i", str(s), "-o", str(out)] if fss else [alass, str(video), str(s), str(out)]
        try:
            r = run(cmd, timeout=1800)
        except RuntimeError as e:
            ui.warn("Couldn't align %s: %s" % (s.name, e))
            continue
        if r.returncode == 0 and out.is_file() and out.stat().st_size > 0:
            os.replace(str(out), str(s))
            done += 1
        else:
            if out.exists():
                out.unlink()
            ui.to_log("NOTE   subtitle alignment failed for %s: %s" % (s, (r.stderr or r.stdout)[-300:]))
    return done


# ============================================================== power
def on_battery():
    """True when a laptop runs on battery now (the homelab checks too; this guards a run started by hand)."""
    try:
        if IS_MAC:
            r = run(["pmset", "-g", "batt"], timeout=10)
            return "Battery Power" in r.stdout
        if IS_WINDOWS:
            r = run(["powershell.exe", "-NoProfile", "-Command",
                     "(Get-CimInstance -ClassName BatteryStatus -Namespace root/wmi -ErrorAction SilentlyContinue).PowerOnline"],
                    timeout=20)
            return r.stdout.strip().lower() == "false"
        for ps in Path("/sys/class/power_supply").glob("*"):
            t = (ps / "type").read_text().strip() if (ps / "type").exists() else ""
            if t == "Mains" and (ps / "online").exists():
                return (ps / "online").read_text().strip() == "0"
    except (OSError, RuntimeError):
        pass
    return False


def stop_if_on_battery():
    if os.environ.get("HOMELAB_MEDIA_ALLOW_BATTERY") != "1" and on_battery():
        ui.warn("On battery: paused. It carries on where it stopped once this computer is plugged in.")
        ui.result(ok=False, paused="battery")
        sys.exit(130)


# ============================================================== shared CLI bits
def base_parser(prog, doc, actions):
    import argparse
    ap = argparse.ArgumentParser(prog=prog, description=doc, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", choices=actions)
    ap.add_argument("paths", nargs="*", help="file: the files or folders to file into the library")
    ap.add_argument("--config", help="settings file (homelab_media.json)")
    ap.add_argument("--library", help="the library folder (overrides the settings file)")
    ap.add_argument("--yes", action="store_true", help="don't ask for confirmation")
    ap.add_argument("--apply", action="store_true", help="make the changes (without it: a preview)")
    ap.add_argument("--events", choices=["text", "json"], help="json: one JSON object per line, for apps")
    ap.add_argument("--json", action="store_true", help="status: print it as JSON")
    return ap


def begin(args, section, banner):
    load_settings(args.config, yes=args.yes, events=args.events)
    if args.library:
        mo.CFG.setdefault(section, {})["library"] = args.library
    log = mo.reports_dir() / ("%s_tidy_log.txt" % section)
    ui.open_log(log, banner)
    return log
