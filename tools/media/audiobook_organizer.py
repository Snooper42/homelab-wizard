#!/usr/bin/env python3
"""
Audiobook organizer: turns a book that came as dozens of MP3s into one .m4b with chapters.

  python3 audiobook_organizer.py status           where things stand (--json for an app)
  python3 audiobook_organizer.py scan             find books split into many files; changes nothing
  python3 audiobook_organizer.py run              merge each into one .m4b (resumes where it stopped)
  python3 audiobook_organizer.py file <paths>     file new audiobooks as Author/Title/Title.m4b

Each book becomes one file: a chapter per original file (named from its title tag, or Chapter 1,
2...), one cover (the folder's cover.jpg, else the first file's) instead of a copy in every file,
and AAC at the bitrate in the settings (64k by default: plenty for a voice). m4b-tool does the
merge when it's installed, else ffmpeg. The merged book is checked to run as long as its parts
before the parts go to the Trash, then Audiobookshelf is told about that folder.

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error, 130 stopped.
"""
import json
import os
import re
import tempfile
import time
from pathlib import Path

import media_common as mc

ui = mc.ui
PARTS_EXT = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".wma", ".m4b"}
COVER_NAMES = ("cover", "folder", "front", "poster")


def natural(s):
    return [int(t) if t.isdigit() else t.casefold() for t in re.split(r"(\d+)", str(s))]


def parts_of(folder):
    """The audio files that make up one book (subfolders like CD1/CD2 included), in order."""
    files = [p for p in mc.walk_files(folder, PARTS_EXT)]
    return sorted(files, key=lambda p: natural(p.relative_to(folder)))


def fragmented(lib):
    """Book folders still split into several files: the deepest folder holding a book's parts."""
    books = {}
    for p in mc.walk_files(lib, PARTS_EXT):
        top = p.parent
        if re.match(r"(?i)^(cd|disc|disk|part)\s*\d+$", top.name):
            top = top.parent  # CD1, CD2... belong to the book above them
        books.setdefault(top, []).append(p)
    out = []
    for folder, files in sorted(books.items()):
        if len(files) >= 2 and not any(f.suffix.lower() == ".m4b" for f in files):
            out.append(folder)
    return out


def book_tags(files, folder):
    facts = mc.media_facts(mc.ffprobe(files[0]))
    t = facts["tags"]
    author = t.get("album_artist") or t.get("artist") or t.get("author") or ""
    title = t.get("album") or ""
    if not title or not author:
        # Author/Title folders, or "Author - Title"
        if " - " in folder.name and not author:
            author, _, title2 = folder.name.partition(" - ")
            title = title or title2
        else:
            title = title or folder.name
            author = author or (folder.parent.name if folder.parent else "")
    title = re.sub(r"(?i)\s*[\(\[]?\s*(?:unabridged|abridged|audiobook|mp3|m4b|\d+k(?:bps)?)\s*[\)\]]?", "", title).strip(" -")
    return {"author": author.strip() or "Unknown Author", "title": title or folder.name,
            "year": (t.get("date") or t.get("year") or "")[:4], "narrator": t.get("composer") or "",
            "genre": "Audiobook"}


def find_cover(folder, first):
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.stem.lower() in COVER_NAMES and p.suffix.lower() in (".jpg", ".jpeg", ".png"):
            return p, False
    ffmpeg = mc.which("ffmpeg", mc.cfg("tools", "ffmpeg"))
    out = Path(tempfile.mkdtemp(prefix="tidy-cover-")) / "cover.jpg"
    r = mc.run([ffmpeg, "-y", "-v", "error", "-i", str(first), "-an", "-frames:v", "1", str(out)], timeout=60)
    if r.returncode == 0 and out.is_file() and out.stat().st_size > 0:
        return out, True
    return None, False


def ffmeta_escape(s):
    return re.sub(r"([=;#\\\n])", r"\\\1", str(s))


def chapter_titles(files, durations):
    titles = []
    for f in files:
        try:
            titles.append((mc.media_facts(mc.ffprobe(f))["tags"].get("title") or "").strip())
        except RuntimeError:
            titles.append("")
    # Titles that just repeat the book's name ("Dune", "Dune"...) say nothing: Chapter 1, 2...
    if len(set(titles)) <= 1 or sum(1 for t in titles if t) < len(titles) / 2:
        return ["Chapter %d" % (i + 1) for i in range(len(files))]
    return [t or "Chapter %d" % (i + 1) for i, t in enumerate(titles)]


def merge(folder, dest, bitrate):
    """Merge one book into dest (an .m4b). Returns (bytes before, bytes after)."""
    files = parts_of(folder)
    if not files:
        raise RuntimeError("no audio in %s" % folder)
    facts = [mc.media_facts(mc.ffprobe(f)) for f in files]
    durations = [f["duration"] for f in facts]
    total = sum(durations)
    tags = book_tags(files, folder)
    before = sum(f.stat().st_size for f in files)
    work = Path(tempfile.mkdtemp(prefix="tidy-m4b-", dir=str(dest.parent) if dest.parent.exists() else None))
    out = work / "book.m4b"
    tool = mc.which("m4b-tool", mc.cfg("tools", "m4b_tool"))
    try:
        if tool:
            cmd = [tool, "merge", str(folder), "--output-file=%s" % out, "--audio-bitrate=%s" % bitrate,
                   "--jobs=2", "--name=%s" % tags["title"], "--artist=%s" % tags["author"],
                   "--albumartist=%s" % tags["author"], "--album=%s" % tags["title"], "--genre=Audiobook",
                   "--no-interaction"]
            if tags["year"]:
                cmd.append("--year=%s" % tags["year"])
            if tags["narrator"]:
                cmd.append("--writer=%s" % tags["narrator"])
            mc.run(cmd, timeout=6 * 3600, check=True)
        else:
            ffmpeg = mc.which("ffmpeg", mc.cfg("tools", "ffmpeg"))
            if not ffmpeg:
                raise RuntimeError("ffmpeg isn't installed (or m4b-tool)")
            listing = work / "parts.txt"
            listing.write_text("ffconcat version 1.0\n" + "".join(
                "file '%s'\n" % str(f).replace("'", "'\\''") for f in files), encoding="utf-8")
            meta = [";FFMETADATA1", "title=" + ffmeta_escape(tags["title"]), "album=" + ffmeta_escape(tags["title"]),
                    "artist=" + ffmeta_escape(tags["author"]), "album_artist=" + ffmeta_escape(tags["author"]),
                    "genre=Audiobook", "media_type=2"]
            if tags["year"]:
                meta.append("date=" + tags["year"])
            if tags["narrator"]:
                meta.append("composer=" + ffmeta_escape(tags["narrator"]))
            start = 0
            for title, d in zip(chapter_titles(files, durations), durations):
                end = start + int(round(d * 1000))
                meta += ["[CHAPTER]", "TIMEBASE=1/1000", "START=%d" % start, "END=%d" % end,
                         "title=" + ffmeta_escape(title)]
                start = end
            (work / "meta.txt").write_text("\n".join(meta) + "\n", encoding="utf-8")
            cover, temp_cover = find_cover(folder, files[0])
            copy_ok = all(f["audio_codec"] == "aac" for f in facts) and \
                all((f["audio_bitrate"] or 0) <= int(re.sub(r"\D", "", bitrate) or 64) * 1100 for f in facts)
            cmd = [ffmpeg, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
                   "-i", str(work / "meta.txt")]
            if cover:
                cmd += ["-i", str(cover)]
            # Only the audio from the parts: the cover each MP3 carried is dropped here...
            cmd += ["-map", "0:a", "-map_metadata", "1", "-map_chapters", "1"]
            if cover:
                # ...and the book gets one cover instead.
                cmd += ["-map", "2:v", "-c:v", "mjpeg" if cover.suffix.lower() == ".png" else "copy",
                        "-disposition:v", "attached_pic"]
            cmd += ["-c:a", "copy"] if copy_ok else ["-c:a", "aac", "-b:a", bitrate]
            cmd += ["-movflags", "+faststart", "-f", "mp4", str(out)]
            try:
                mc.run(cmd, timeout=6 * 3600, check=True)
            finally:
                if temp_cover and cover:
                    cover.unlink()
                    try:
                        cover.parent.rmdir()
                    except OSError:
                        pass
        got = mc.media_facts(mc.ffprobe(out))
        if not mc.same_length(got["duration"], total, tolerance=max(3.0, 0.002 * total)):
            raise RuntimeError("the merged book is %s long, its parts %s" % (mc.fmt_time(got["duration"]), mc.fmt_time(total)))
        if got["chapters"] and got["chapters"] < len(files) and not tool:
            raise RuntimeError("only %d of %d chapters made it" % (got["chapters"], len(files)))
        dest.parent.mkdir(parents=True, exist_ok=True)
        final = mc.unique_path(dest)
        mc.move_file(out, final)
        after = final.stat().st_size
    finally:
        for f in work.glob("*"):
            f.unlink()
        work.rmdir()
    for f in files:
        mc.trash(f)
    return before, after, final, len(files)


def destination(lib, folder):
    files = parts_of(folder)
    tags = book_tags(files, folder)
    title = mc.safe_name(tags["title"])
    return lib / mc.safe_name(tags["author"]) / title / (title + ".m4b")


class Audiobooks:
    def __init__(self):
        self.state = None

    def load(self):
        self.lib = mc.library_dir("audiobooks")
        self.state = mc.load_state("audiobooks", {"done": {}, "failed": {}, "freed": 0, "history": []})

    def save(self):
        mc.save_state("audiobooks", self.state)

    @property
    def bitrate(self):
        return str(mc.cfg("audiobooks", "bitrate") or "64k")

    def scan(self):
        self.load()
        ui.title("Audiobooks", "scan only, nothing will be changed")
        ui.kv("Library", self.lib)
        books = fragmented(self.lib)
        size = sum(mc.folder_size(b) for b in books)
        parts = sum(len(parts_of(b)) for b in books)
        ui.kv("Split books", mc.fmt_n(len(books)))
        ui.kv("Their files", "%s  (%s)" % (mc.fmt_n(parts), human(size)))
        for b in books[:20]:
            ui.say("  %s" % mc.pretty_path(b))
        ui.result(action="scan", ok=True, media="audiobooks", books=len(books), files=parts, bytes=size,
                  saving=int(size * 0.35))

    def run(self):
        self.load()
        mc.stop_if_on_battery()
        ui.title("Audiobooks", "merging into one file a book")
        books = [b for b in fragmented(self.lib) if str(b) not in self.state["failed"]]
        servers = mc.Servers()
        merged, freed = 0, 0
        with ui.progress(len(books), "Merging") as bar:
            for b in books:
                bar.update(note=b.name)
                try:
                    dest = destination(self.lib, b)
                    before, after, final, n = merge(b, dest, self.bitrate)
                except RuntimeError as e:
                    self.state["failed"][str(b)] = str(e)
                    ui.warn("%s: %s; its files stay as they are" % (b.name, e))
                    self.save()
                    continue
                mc.remove_empty_dirs(b, keep_root=False) if b.exists() else None
                self.clear_leftovers(b)
                servers.ping(final, "audiobooks")
                merged += 1
                freed += max(0, before - after)
                self.state["done"][str(final)] = {"parts": n, "before": before, "after": after, "when": time.time()}
                self.state["freed"] = self.state.get("freed", 0) + max(0, before - after)
                self.save()
                bar.update(done=merged)
        ui.ok("Merged %s books, %s freed" % (mc.fmt_n(merged), human(freed)))
        ui.result(action="run", ok=True, media="audiobooks", merged=merged, freed=freed,
                  failed=len(self.state["failed"]), told=servers.sent)

    def clear_leftovers(self, folder):
        """A merged book's old folder: its cover and playlist files go too, then the empty folder."""
        if not folder.is_dir():
            return
        rest = [p for p in folder.rglob("*") if p.is_file()]
        if all(p.suffix.lower() in (".jpg", ".jpeg", ".png", ".m3u", ".m3u8", ".nfo", ".txt", ".cue", ".sfv", ".url")
               or p.name.startswith("._") for p in rest):
            mc.trash(folder)

    def file(self, paths, apply=True):
        self.load()
        ui.title("New audiobooks", "filing into %s" % mc.pretty_path(self.lib))
        servers = mc.Servers()
        filed = []
        for p in paths:
            p = Path(p)
            folder = p if p.is_dir() else p.parent
            single = p.is_file()
            files = [p] if single else parts_of(folder)
            if not files:
                continue
            if not apply:
                ui.kv(p.name, "→ %s" % mc.pretty_path(destination(self.lib, folder)))
                continue
            if len(files) == 1 and files[0].suffix.lower() in (".m4b", ".m4a"):
                tags = book_tags(files, folder)
                title = mc.safe_name(tags["title"] if not single else Path(files[0]).stem)
                final = mc.unique_path(self.lib / mc.safe_name(tags["author"]) / title / (title + ".m4b"))
                mc.move_file(files[0], final)
            else:
                try:
                    _, _, final, _ = merge(folder, destination(self.lib, folder), self.bitrate)
                except RuntimeError as e:
                    ui.warn("%s: %s; left where it is" % (folder.name, e))
                    continue
                self.clear_leftovers(folder)
            servers.ping(final, "audiobooks")
            filed.append(str(final))
            ui.ok("Filed %s" % mc.pretty_path(final))
        self.state["history"] = (self.state.get("history") or [])[-180:] + [
            {"when": time.strftime("%Y-%m-%dT%H:%M:%S"), "what": "filed", "path": f} for f in filed]
        self.save()
        ui.result(action="file", ok=True, media="audiobooks", filed=filed, told=servers.sent)
        return True

    def status(self, as_json):
        lib = mc.expand(mc.cfg("audiobooks", "library"))
        st = mc.load_state("audiobooks", {"done": {}, "failed": {}, "freed": 0, "history": []})
        info = {"kind": "audiobooks", "library": str(lib) if lib else None, "found": bool(lib and lib.is_dir()),
                "merged": len(st["done"]), "failed": st["failed"], "freed": st.get("freed", 0),
                "m4b_tool": bool(mc.which("m4b-tool")), "ffmpeg": bool(mc.which("ffmpeg")),
                "history": (st.get("history") or [])[-20:]}
        if as_json or ui.events:
            print(json.dumps(info))
            return
        ui.title("Audiobooks", "status")
        ui.kv("Library", lib or "not set")
        ui.kv("Merged", mc.fmt_n(info["merged"]))
        ui.kv("Freed", human(info["freed"]))
        ui.kv("Merges with", "m4b-tool" if info["m4b_tool"] else "ffmpeg" if info["ffmpeg"] else "nothing installed")


def human(n):
    from video_engine import human as h
    return h(n)


def main():
    ap = mc.base_parser("audiobook_organizer.py", __doc__, ["status", "scan", "run", "file"])
    args = ap.parse_args()
    eng = Audiobooks()
    if args.action == "status":
        mc.load_settings(args.config, events=args.events)
        if args.library:
            mc.mo.CFG.setdefault("audiobooks", {})["library"] = args.library
        return eng.status(args.json)
    mc.begin(args, "audiobooks", "audiobooks %s" % args.action)
    if args.action == "scan":
        return eng.scan()
    if args.action == "run":
        return eng.run()
    if not args.paths:
        mc.die("Which files?", "audiobook_organizer.py file <file or folder>...")
    eng.file(args.paths, apply=args.apply or args.yes)


if __name__ == "__main__":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    mc.run_main(main)
