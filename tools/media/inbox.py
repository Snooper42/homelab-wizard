#!/usr/bin/env python3
"""
The inbox: watches Downloads, and files every finished download into the right library.

  python3 inbox.py scan              what's in the inbox and where each would go; changes nothing
  python3 inbox.py scan --apply      file what's ready (the homelab runs this every minute)
  python3 inbox.py undo <id>         put what one entry of What I did today filed back where it came
                                     from; the sweep then leaves it there until it changes
  python3 inbox.py name <path> movie "<title>" [<year>]
  python3 inbox.py name <path> episode "<show>" <season> [<episode>]
                                     a download Tidy Up couldn't place (Needs a look): rename it as you
                                     say, and file it
  python3 inbox.py leave <path>      Needs a look's Leave it: the sweep never touches it again

A download is ready once nothing in it has changed for 5 minutes and no partial file (.part,
.crdownload, .!qB...) is left; macOS's ._ files are ignored. A .zip is unpacked into a hidden
temporary folder, filed from there, and the temporary folder removed.

Where things go:
  episodes and season packs (S01E04, 1x04, [Group] Show - 112)  → tv_organizer.py
  other videos                                                  → movies_organizer.py
  books: .epub, and .pdf books, anywhere in a download           → the Calibre library
  spoken word (an .m4b, or many long tracks, or "audiobook")     → audiobook_organizer.py
  other audio                                                   → music_tidy.py (beets)

Every engine applies Shrink & Strip: a duplicate is kept only if it's leaner than the copy in the
library, and a bloated video goes through Tdarr before it's filed. Whatever a download leaves
behind once its media is filed (.nfo, .txt, samples, its empty folder) goes to the Trash.

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
import zipfile
from pathlib import Path

import media_common as mc
from tv_organizer import parse_episode, PACK_RE, SEASON_DIR_RE
from video_engine import SAMPLE_RE

mo = mc.mo
ui = mc.ui
SKIP_NAMES = {"music - needs attention", "incomplete", ".incomplete", "temp", "tmp", "torrents", "watch",
              "reports", "$recycle.bin"}
SKIP_PREFIX = ("music_cleanup_", "books_organizer", "calibre_cleanup", "navidrome-backup-", "cleanup_online_cache")
SPOKEN_GENRES = {"audiobook", "audiobooks", "audio book", "speech", "spoken", "spoken word", "books & spoken",
                 "podcast", "hörbuch", "audiolibro"}
NOT_BOOK_RE = re.compile(r"(?i)invoice|receipt|statement|ticket|boarding|order|bill|payslip|tax|form|contract|"
                         r"resume|cv[\W_]|letter|scan_|screenshot|manual|warranty|quote|policy")


# ============================================================== what's in a download
def settled(item, minutes):
    """Finished: nothing changed for N minutes, no partial files."""
    newest = item.stat().st_mtime
    if item.is_dir():
        for dirpath, dirnames, filenames in os.walk(str(item)):
            for fn in filenames:
                if Path(fn).suffix.lower() in mc.PARTIAL_EXT:
                    return False, "still downloading"
                if fn.startswith("._"):
                    continue
                try:
                    newest = max(newest, os.stat(os.path.join(dirpath, fn)).st_mtime)
                except OSError:
                    return False, "changing"
    elif item.suffix.lower() in mc.PARTIAL_EXT:
        return False, "still downloading"
    elif item.stat().st_size == 0 or any(item.with_name(item.name + e).exists() for e in mc.PARTIAL_EXT):
        # Firefox keeps an empty Movie.mkv beside Movie.mkv.part, aria2 a Movie.mkv.aria2 beside the
        # file it fills; neither file's own time changes while it downloads.
        return False, "still downloading"
    age = time.time() - newest
    if age < minutes * 60:
        return False, "waiting (%d min without changes needed)" % minutes
    return True, ""


def pdf_pages(p):
    tool = mc.which("pdfinfo")
    if tool:
        r = mc.run([tool, str(p)], timeout=30)
        m = re.search(r"(?m)^Pages:\s+(\d+)", r.stdout)
        if m:
            return int(m.group(1))
    try:
        data = p.read_bytes()[:50 * 1024 * 1024]
    except OSError:
        return 0
    m = re.findall(rb"/Count\s+(\d+)", data)
    if m:
        return max(int(x) for x in m)
    return len(re.findall(rb"/Type\s*/Page[^s]", data))


def is_book(p):
    """An .epub is a book; a .pdf only when it reads like one: long, and not an invoice or a form."""
    ext = p.suffix.lower()
    if ext in (".epub", ".mobi", ".azw3", ".azw"):
        return True
    if ext != ".pdf" or NOT_BOOK_RE.search(p.stem):
        return False
    return p.stat().st_size >= 512 * 1024 and pdf_pages(p) >= int(mc.cfg("inbox", "pdf_min_pages") or 50)


def spoken_word(files, item):
    if any(f.suffix.lower() == ".m4b" for f in files):
        return True
    if re.search(r"(?i)audio[\s_.-]?books?|unabridged|narrated|h[öo]rbuch", str(item)):
        return True
    try:
        facts = [mc.media_facts(mc.ffprobe(f)) for f in files[:12]]
    except RuntimeError:
        return False
    genres = {(f["tags"].get("genre") or "").strip().lower() for f in facts}
    if genres & SPOKEN_GENRES:
        return True
    durs = [f["duration"] for f in facts if f["duration"]]
    # A book in many long parts: tracks of 15 minutes and more, hours in all.
    return len(files) >= 3 and durs and sum(durs) / len(durs) >= 900 and sum(durs) * len(files) / len(durs) >= 3 * 3600


def classify(item):
    """{kind: [paths]} for one download (a file or a folder)."""
    files = [item] if item.is_file() else mc.walk_files(item)
    out = {}
    books = [f for f in files if f.suffix.lower() in mc.BOOK_EXT and is_book(f)]
    if books:
        out["books"] = books
    videos = [f for f in files if f.suffix.lower() in mc.VIDEO_EXT]
    if videos:
        episodic = any(parse_episode(v.name, v.parent) for v in videos) or \
            bool(PACK_RE.search(item.name)) or any(SEASON_DIR_RE.match(v.parent.name) for v in videos)
        out["tv" if episodic else "movies"] = [item] if item.is_dir() else videos
    audio = [f for f in files if f.suffix.lower() in mc.MUSIC_EXT | mc.AUDIOBOOK_EXT]
    if audio:
        if spoken_word(audio, item):
            out["audiobooks"] = [item] if item.is_dir() else audio
        else:
            out["music"] = [item] if item.is_dir() else audio
    return out


def leftovers_only(item):
    """True when what's left of a download is nothing worth keeping."""
    if not item.exists():
        return False
    files = [item] if item.is_file() else [p for p in item.rglob("*") if p.is_file()]
    keep = mc.VIDEO_EXT | mc.MUSIC_EXT | mc.AUDIOBOOK_EXT | {".epub", ".mobi", ".azw3", ".zip", ".rar", ".7z", ".dmg",
                                                              ".exe", ".msi", ".pkg", ".iso", ".docx", ".xlsx"}
    return all(f.suffix.lower() not in keep and (f.suffix.lower() != ".pdf") for f in files)


# ============================================================== zip files
def unzip(zp, into):
    """Unpack safely: nothing may land outside the folder (no '../', no absolute paths)."""
    into.mkdir(parents=True, exist_ok=True)
    root = into.resolve()
    with zipfile.ZipFile(str(zp)) as z:
        for info in z.infolist():
            name = info.filename.replace("\\", "/")
            if name.startswith("/") or re.match(r"^[A-Za-z]:", name):
                raise RuntimeError("%s holds an absolute path; not unpacked" % zp.name)
            target = (into / name).resolve()
            if not (target == root or str(target).startswith(str(root) + os.sep)):
                raise RuntimeError("%s tries to write outside its folder; not unpacked" % zp.name)
            if Path(name).name.startswith("._") or "__MACOSX" in name:
                continue
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(str(target), "wb") as dst:
                shutil.copyfileobj(src, dst)
    return into


# ============================================================== handing over to the engines
ENGINES = {"movies": "movies_organizer.py", "tv": "tv_organizer.py", "audiobooks": "audiobook_organizer.py",
           "music": "music_tidy.py"}


def engine(kind, paths, apply):
    """Run one engine's file action in its own process, passing its progress through."""
    cmd = [sys.executable, str(mc.HERE / ENGINES[kind]), "file"] + [str(p) for p in paths] + ["--events", "json"]
    if apply:
        cmd.append("--apply")
    if mo.CFG_PATH:
        cmd += ["--config", str(mo.CFG_PATH)]
    result, why = {}, ""
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    for line in p.stdout:
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        if ev.get("type") in ("warn", "fail") and ev.get("text"):
            why = ev["text"]  # the last one says why a download was left
        if ev.get("type") == "result":
            result = ev
        elif ui.events:
            sys.stdout.write(line)
            sys.stdout.flush()
        elif ev.get("text"):
            ui.say(ev["text"])
    rc = p.wait()
    result.setdefault("why", why)
    return rc == 0 and result.get("ok", True), result


KIND_TITLE = {"movies": "Movies", "tv": "TV", "music": "Music", "audiobooks": "Audiobooks", "books": "Books"}


def describe(kind, item, files, res):
    """What I did today's line for one download: what it is, where it went, what was done, and what Undo
    needs (where it came from, and the files it became)."""
    first = Path(files[0])
    lib = mc.expand(mc.cfg(kind, "library"))
    try:
        rel = first.parent.relative_to(lib).parts if lib else ()
    except ValueError:
        rel = ()
    where = " › ".join((KIND_TITLE.get(kind, kind.title()),) + tuple(rel))
    if kind == "tv":
        show = rel[0] if rel else first.parent.parent.name
        title = "%s · %s" % (show, plural(len(files), "episode"))
    elif kind == "music":
        title = "%s · %s" % (first.parent.name, first.parent.parent.name)
    elif kind == "audiobooks":
        title = "%s · %s" % (first.stem, first.parent.parent.name)
    else:
        title = first.stem
    did = []
    if kind == "music":
        did.append("%s, tags cleaned" % plural(len(files), "song"))
        if res.get("genres_fixed"):
            did.append("genre set")
        if mc.cfg("lyrics", "on_new_music", True) is not False:
            did.append("lyrics added where found")
    if res.get("shrinking"):
        did.append("too big, so Tdarr is shrinking it first")
    if res.get("replaced"):
        did.append("better than the copy you had, so it took its place")
    if res.get("discarded"):
        did.append("you already had a better copy, so this one went to the Trash")
    if not did:
        did.append("renamed and filed")
    return {"id": uuid.uuid4().hex[:12], "kind": kind, "title": title, "where": where, "did": did,
            "from": str(item), "files": [str(f) for f in files], "undo": True}


def plural(n, word):
    return "%d %s%s" % (n, word, "" if n == 1 else "s")


def undo(entry_id):
    """Put what one entry filed back where it came from: a single file to its own name, a folder's files into
    that folder again; then the sweep leaves it until it changes."""
    entries = mc.filed_entries()
    entry = next((e for e in entries if e.get("id") == entry_id), None)
    if not entry:
        mc.die("Nothing filed today has that id: it may be older than the record keeps")
    if any(e.get("undone") == entry_id for e in entries):
        mc.die("%s was put back already" % entry["title"])
    if not entry.get("undo"):
        mc.die("%s can't be put back from here" % entry["title"])
    files = [Path(f) for f in entry.get("files") or [] if Path(f).exists()]
    if not files:
        mc.die("%s isn't in the library any more: nothing to put back" % entry["title"])
    src = Path(entry["from"])
    ui.title("Inbox", "putting %s back" % entry["title"])
    if len(files) == 1 and not src.is_dir() and src.suffix.lower() == files[0].suffix.lower():
        dest = mc.unique_path(src)
        dest.parent.mkdir(parents=True, exist_ok=True)
        mc.move_file(files[0], dest)
    else:
        src.mkdir(parents=True, exist_ok=True)
        for f in files:
            mc.move_file(f, mc.unique_path(src / f.name))
        dest = src
    for f in files:
        mc.remove_empty_dirs(f.parent, keep_root=False) if f.parent.exists() else None
    tried = mc.load_state("inbox", {"failed": {}})
    tried.setdefault("kept", {})[str(dest)] = dest.stat().st_mtime
    # In Needs a look, in case it went to the wrong place: say what it is, or leave it.
    note_why(tried, dest, entry.get("kind") or "", "You put it back. Say what it is, or leave it.")
    save(tried)
    mc.note_filed({"undone": entry_id, "title": entry["title"]})
    ui.ok("Put %s back in %s" % (entry["title"], mc.pretty_path(dest.parent)))
    ui.result(action="undo", ok=True, id=entry_id, to=str(dest))


# ============================================================== Needs a look
VIDEO_KINDS = ("movies", "tv")


def note_why(tried, path, kind, why):
    tried.setdefault("why", {})[str(path)] = {"kind": kind, "why": why, "at": time.strftime("%Y-%m-%dT%H:%M:%S")}


def friendly_why(kind, text):
    """The engine's warning, said for Needs a look."""
    if not text or "from its name" in text:
        return {"movies": "Couldn't tell which film it is from its name.",
                "tv": "Couldn't tell which show and episode it is from its name."}.get(kind, "Couldn't file it.")
    return text


def needs_list(tried):
    """What's waiting for a person: downloads an engine couldn't place, and what Undo put back; not what
    Leave it left, nor what's gone."""
    out, left, why = [], tried.get("left") or {}, tried.get("why") or {}
    for p in dict.fromkeys(list(tried.get("failed") or {}) + list(tried.get("kept") or {})):
        path = Path(p)
        if p in left or not path.exists():
            continue
        w = why.get(p) or {}
        out.append({"path": p, "name": path.name, "kind": w.get("kind") or "", "why": w.get("why") or "Couldn't file it.",
                    "since": w.get("at") or ""})
    return out


def save(tried):
    """The inbox's record, and Needs a look's copy of it for the app (HOMELAB_MEDIA_NEEDS)."""
    for key in ("failed", "kept", "why", "left"):
        tried[key] = {k: v for k, v in (tried.get(key) or {}).items() if Path(k).exists()}
    mc.save_state("inbox", tried)
    target = os.environ.get("HOMELAB_MEDIA_NEEDS")
    if target:
        t = Path(target)
        t.parent.mkdir(parents=True, exist_ok=True)
        tmp = t.with_suffix(".tmp")
        tmp.write_text(json.dumps(needs_list(tried), ensure_ascii=False), encoding="utf-8")
        os.replace(str(tmp), str(t))


def forget(tried, path):
    for key in ("failed", "kept", "why", "left"):
        (tried.get(key) or {}).pop(str(path), None)


def leave(path):
    """Leave it: the sweep never files it, and Needs a look stops asking."""
    item = Path(path)
    if not item.exists():
        mc.die("%s isn't there any more" % item.name)
    tried = mc.load_state("inbox", {"failed": {}})
    forget(tried, item)
    tried.setdefault("kept", {})[str(item)] = item.stat().st_mtime
    tried.setdefault("left", {})[str(item)] = True
    save(tried)
    ui.ok("Left %s where it is" % item.name)
    ui.result(action="leave", ok=True, path=str(item))


def episode_name(show, season, ep):
    return "%s S%02dE%s" % (show, season, "E".join("%02d" % e for e in ep))


def name_as(path, what, words):
    """Rename a download as the person says (a film's title and year, a show's season and episode) so the
    engine can place it, and file it. A folder of episodes keeps each file's own episode number."""
    item = Path(path)
    if not item.exists():
        mc.die("%s isn't there any more" % item.name)
    kind = {"movie": "movies", "episode": "tv"}.get(what)
    if not kind or not words or not mc.safe_name(words[0]).strip():
        mc.die('Say what it is: name <path> movie "<title>" [<year>], or episode "<show>" <season> [<episode>]')
    title = mc.safe_name(words[0]).strip()
    try:
        nums = [int(w) for w in words[1:3]]
    except ValueError:
        mc.die("The year, season and episode are numbers")
    if kind == "tv" and not nums:
        mc.die("Which season?")
    ui.title("Inbox", "filing %s as you named it" % item.name)
    videos = [item] if item.is_file() else [v for v in mc.walk_files(item, mc.VIDEO_EXT)
                                             if not SAMPLE_RE.search(v.stem)]
    if not videos:
        mc.die("There's no video in %s" % item.name)
    if kind == "movies":
        base = "%s (%d)" % (title, nums[0]) if nums else title
        renames = {max(videos, key=lambda v: v.stat().st_size): base}
    else:
        season = nums[0]
        if len(videos) == 1:
            ep = [nums[1]] if len(nums) > 1 else (parse_episode(videos[0].name, videos[0].parent) or {}).get("episodes")
            if not ep:
                mc.die("Which episode?")
            renames = {videos[0]: episode_name(title, season, ep)}
        else:
            renames = {}
            for v in videos:
                ep = (parse_episode(v.name, v.parent) or {}).get("episodes")
                if ep:
                    renames[v] = episode_name(title, season, ep)
            if not renames:
                mc.die("None of its videos says which episode it is")
        base = "%s S%02d" % (title, season)
    tried = mc.load_state("inbox", {"failed": {}})
    forget(tried, item)
    moved = {}
    for v, stem in renames.items():
        to = v.with_name(stem + v.suffix.lower())
        if to != v:
            to = mc.unique_path(to)
            os.rename(str(v), str(to))
        moved[v] = to
    work = moved.get(item, item)
    if item.is_dir():
        work = item.with_name(mc.safe_name(base)) if item.name != mc.safe_name(base) else item
        if work != item:
            work = mc.unique_path(work)
            os.rename(str(item), str(work))
    ok, res = engine(kind, [work], True)
    files = res.get("filed") or []
    if ok and files:
        entry = describe(kind, item, files, res)
        entry["did"] = ["named by you, then filed"] + [d for d in entry["did"] if d != "renamed and filed"]
        mc.note_filed(entry)
        if work.is_dir() and leftovers_only(work):
            mc.trash(work)
        elif work.is_dir():
            mc.remove_empty_dirs(work, keep_root=False)
    elif work.exists():
        tried.setdefault("failed", {})[str(work)] = work.stat().st_mtime
        note_why(tried, work, kind, "Still couldn't place it: " + friendly_why(kind, res.get("why")))
    save(tried)
    if ok and files:
        ui.ok("Filed %s as %s" % (item.name, base))
    ui.result(action="name", ok=bool(ok and files), filed=files, path=str(work), why=res.get("why") or "")
    if not (ok and files):
        sys.exit(1)


def add_books(books, apply):
    """Into the Calibre library with calibredb (Calibre-Web paused meanwhile). A book that's already
    there is a rejected duplicate: it goes to the Trash."""
    import books_organizer as bo
    lib = mc.expand(mc.cfg("books", "library"))
    if not lib or not (lib / "metadata.db").is_file():
        ui.warn("No Calibre library set, so %d books stay in Downloads" % len(books))
        return [], []
    calibredb = bo.find_bin("calibredb", mc.cfg("books", "calibre_bin_dir"), required=False)
    if not calibredb:
        ui.warn("Calibre's tools aren't installed, so %d books stay in Downloads" % len(books))
        return [], []
    if not apply:
        for b in books:
            ui.kv(b.name, "→ Calibre library")
        return [], []
    added, dupes = [], []
    conts = mo.containers_using(lib, mc.cfg("books", "pause_containers", "auto")) if mo.docker_ok() else []
    with mo.Paused(conts):
        for b in books:
            r = mc.run([calibredb, "add", "--library-path", str(lib), str(b)], timeout=300)
            text = r.stdout + r.stderr
            if r.returncode != 0:
                ui.warn("Calibre couldn't add %s: %s" % (b.name, text.strip()[-200:]))
                continue
            if re.search(r"(?i)already exist|not added", text) and not re.search(r"(?i)Added book ids", text):
                mc.trash(b)
                dupes.append(str(b))
                ui.ok(mc.trash_words("%s is in the library already; the download went to %TRASH%") % b.name)
                continue
            mc.trash(b)
            added.append(str(b))
            ui.ok("Added %s to Calibre" % b.name)
    return added, dupes


# ============================================================== the sweep
def inbox_folders():
    out = []
    for f in mc.cfg("inbox", "folders") or ["~/Downloads"]:
        p = mc.expand(f)
        if p and p.is_dir() and p not in out:
            out.append(p)
    return out


def skip(p):
    n = p.name.lower()
    return (p.name.startswith(".") or p.name.startswith("._") or n in SKIP_NAMES or n.startswith(SKIP_PREFIX)
            or n.endswith("_tidy_log.txt") or n == "desktop.ini" or n == "thumbs.db")


def stragglers(folder, minutes):
    """Loose books anywhere in an inbox folder, however deep (a manual download, LazyLibrarian's
    leftovers), that aren't inside a download still being written."""
    out = []
    for p in mc.walk_files(folder, {".epub", ".pdf", ".mobi", ".azw3"}):
        if any(skip(Path(part)) for part in p.relative_to(folder).parts[:-1]):
            continue
        top = folder / p.relative_to(folder).parts[0]
        if p.parent != folder and settled(top, minutes)[0] and is_book(p):
            out.append(p)
    return out


def sweep(apply):
    minutes = float(mc.cfg("inbox", "settle_minutes") or 5)
    ui.title("Inbox", ", ".join(mc.pretty_path(f) for f in inbox_folders()) + ("" if apply else " (preview)"))
    if apply and os.environ.get("HOMELAB_MEDIA_ALLOW_BATTERY") != "1" and mc.on_battery():
        ui.say("On battery: new downloads wait until this computer is plugged in.")
        ui.result(action="inbox", ok=True, paused="battery", filed={}, waiting=[])
        return
    filed, waiting, failed, trashed = {}, [], [], []
    # A download that failed once waits until it changes, rather than failing every minute.
    tried = mc.load_state("inbox", {"failed": {}})
    for folder in inbox_folders():
        temp_root = folder / ".tidy-unzip"
        for item in sorted(folder.iterdir()):
            if skip(item):
                continue
            ok, why = settled(item, minutes)
            if not ok:
                waiting.append({"path": str(item), "why": why})
                continue
            if tried["failed"].get(str(item)) == item.stat().st_mtime:
                continue
            # Put back by Undo: left alone until it changes.
            if (tried.get("kept") or {}).get(str(item)) == item.stat().st_mtime or str(item) in (tried.get("left") or {}):
                continue
            work, zipped = item, False
            if item.is_file() and item.suffix.lower() == ".zip":
                if not apply:
                    ui.kv(item.name, "→ unpacked, then filed")
                    continue
                try:
                    work = unzip(item, temp_root / item.stem)
                    zipped = True
                except (RuntimeError, zipfile.BadZipFile, OSError) as e:
                    ui.warn("%s: %s" % (item.name, e))
                    failed.append(str(item))
                    continue
            kinds = classify(work)
            if not kinds:
                if zipped:
                    shutil.rmtree(str(work), ignore_errors=True)
                continue  # not media: an installer, a document. Left alone.
            all_ok = True
            for kind, paths in kinds.items():
                if kind == "books":
                    added, dupes = add_books(paths, apply)
                    if apply and len(added) + len(dupes) < len(paths):
                        all_ok = False
                    filed.setdefault("books", []).extend(added)
                    continue
                if not apply:
                    ui.kv(item.name, "→ %s" % kind)
                    continue
                ok, res = engine(kind, paths, apply)
                all_ok = all_ok and ok
                filed.setdefault(kind, []).extend(res.get("filed") or [])
                files = res.get("songs_filed") or res.get("filed") or []
                if ok and files and not zipped:
                    mc.note_filed(describe(kind, item, files, res))
                if not ok:
                    failed.append(str(item))
                    tried["failed"][str(item)] = item.stat().st_mtime
                    note_why(tried, item, kind, friendly_why(kind, res.get("why")))
            if not apply:
                continue
            if zipped:
                shutil.rmtree(str(work), ignore_errors=True)  # our own temporary folder
                if all_ok:
                    mc.trash(item)
                    trashed.append(str(item))
            elif all_ok and leftovers_only(item):
                mc.trash(item)  # the .nfo, samples, and folder a download leaves behind
                trashed.append(str(item))
        if apply and temp_root.is_dir():
            shutil.rmtree(str(temp_root), ignore_errors=True)
        loose = stragglers(folder, minutes)
        if loose:
            added, _ = add_books(loose, apply)
            filed.setdefault("books", []).extend(added)
        if apply:
            for d in mc.remove_empty_dirs(folder, keep_root=True):
                ui.to_log("       removed empty folder %s" % d)
    if apply:
        save(tried)
    n = sum(len(v) for v in filed.values())
    if apply:
        ui.ok("Filed %s from the inbox%s" % (mc.fmt_n(n), "; %d waiting" % len(waiting) if waiting else ""))
    ui.result(action="inbox", ok=not failed, applied=apply, filed=filed, waiting=waiting, failed=failed,
              trashed=trashed)
    if failed:
        sys.exit(1)


def main():
    ap = mc.base_parser("inbox.py", __doc__, ["scan", "undo", "name", "leave"])
    args = ap.parse_args()
    mc.begin(args, "inbox", "inbox %s" % (args.action if args.action != "scan" else "apply" if args.apply else "preview"))
    if args.action == "undo":
        if not args.paths:
            mc.die("Which one? inbox.py undo <id>")
        undo(args.paths[0])
        return
    if args.action == "leave":
        if not args.paths:
            mc.die("Which one? inbox.py leave <path>")
        leave(args.paths[0])
        return
    if args.action == "name":
        if len(args.paths) < 3:
            mc.die('inbox.py name <path> movie "<title>" [<year>], or episode "<show>" <season> [<episode>]')
        name_as(args.paths[0], args.paths[1], args.paths[2:])
        return
    sweep(args.apply)


if __name__ == "__main__":
    mc.run_main(main)
