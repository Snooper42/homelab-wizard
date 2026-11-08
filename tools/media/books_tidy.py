#!/usr/bin/env python3
"""
Books, around books_organizer.py: what Tidy Up adds to the vendored engine without changing it.

  python3 books_tidy.py genre-counts    how many books are in each genre (each book's first tag in
                                        Calibre); changes nothing, and reads Calibre's database only
  python3 books_tidy.py build [--yes]   a Calibre library from a folder of books with none (each book
                                        in a folder of its own, as Calibre exports them): the folders
                                        go aside on the same drive, Calibre adds each as one book with
                                        its metadata.opf and cover, and the copy aside is kept

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error.
"""
import json
import os
import sqlite3
from pathlib import Path

import media_common as mc

ui = mc.ui
mo = mc.mo

# What Calibre takes as a book's file.
BOOK_EXT = {".epub", ".azw3", ".azw", ".mobi", ".kepub", ".pdf", ".fb2", ".lit", ".djvu"}


def first_tags(db):
    """{book id: its first tag (as Calibre lists it), or None}, read without writing a thing."""
    uri = Path(db).resolve().as_uri() + "?mode=ro"
    con = sqlite3.connect(uri, uri=True, timeout=10)
    try:
        rows = con.execute("SELECT b.id, t.name FROM books b LEFT JOIN books_tags_link l ON l.book = b.id "
                           "LEFT JOIN tags t ON t.id = l.tag ORDER BY b.id, l.id").fetchall()
    finally:
        con.close()
    out = {}
    for book, tag in rows:
        if book not in out or (out[book] is None and tag):
            out[book] = (tag or "").strip() or None
    return out


def genre_counts():
    lib = mc.library_dir("books")
    db = lib / "metadata.db"
    ui.title("Genres", "how many books are in each")
    if not db.is_file():
        mc.die("%s isn't a Calibre library (no metadata.db)" % mc.pretty_path(lib))
    try:
        tags = first_tags(db)
    except sqlite3.Error as e:
        mc.die("Couldn't read Calibre's database: %s" % e)
    counts, unplaced = {}, 0
    for t in tags.values():
        if t:
            counts[t] = counts.get(t, 0) + 1
        else:
            unplaced += 1
    shown = dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))
    ui.ok("%s books in %d genres" % (mc.fmt_n(len(tags) - unplaced), len(shown)))
    if unplaced:
        ui.say("%s books have no tag yet" % mc.fmt_n(unplaced))
    ui.result(action="genre-counts", ok=True, items=len(tags), genres=shown, unplaced=unplaced, source="Calibre")
    return True


def book_folders(lib):
    """The folders under lib that hold a book's files (one book each, as Calibre exports them), skipping
    hidden and working folders."""
    out = set()
    for p in mc.walk_files(lib, BOOK_EXT):
        if p.parent != lib:  # a book loose at the top has no folder of its own: left where it is
            out.add(p.parent)
    return sorted(out)


def aside_for(lib):
    """Where a library's book folders go while Calibre adds them: beside it, on the same drive."""
    return lib.parent / (lib.name + " (before Calibre)")


def build():
    """A Calibre library from a folder of books with no metadata.db (Nov 8, the owner's: Books said
    "isn't a Calibre library"). The folders holding books, and Calibre's old notes, move aside on the
    same drive (no copy); Calibre adds each as one book, its formats together and its metadata.opf and
    cover read; then every book is counted in. The copy aside is kept, for the person to look over."""
    lib = mc.library_dir("books")
    ui.title("Books", "a Calibre library from your book files")
    ui.kv("Library", mc.pretty_path(lib))
    if (lib / "metadata.db").is_file():
        ui.ok("It's a Calibre library already")
        ui.result(action="build", ok=True, already=True, applied=False, books=0)
        return True
    folders = book_folders(lib)
    if not folders:
        mc.die("No books in %s: nothing for Calibre to add" % mc.pretty_path(lib))
    aside = aside_for(lib)
    if aside.exists():
        mc.die("%s is there from an earlier try" % mc.pretty_path(aside),
               "Put its folders back in %s (or move it somewhere else), then try again." % lib.name)
    import books_organizer as bo
    calibredb = bo.find_bin("calibredb", mc.cfg("books", "calibre_bin_dir"), required=False)
    if not calibredb:
        mc.die("Calibre's tools aren't installed", "Install Calibre (calibre-ebook.com), then try again.")
    # What moves aside: each top-level item holding a book's folder, and Calibre's old notes.
    tops = sorted({lib / f.relative_to(lib).parts[0] for f in folders})
    notes = lib / ".calnotes"
    moving = tops + ([notes] if notes.exists() else [])
    ui.kv("Books", mc.fmt_n(len(folders)))
    if not mo.YES:
        ui.say("Asks first. Then %s go to %s (on the same drive, so nothing is copied), Calibre adds each "
               "book with its metadata.opf and cover, and every one is counted in. The copy aside stays."
               % (mc.fmt_n(len(moving)) + " folders", mc.pretty_path(aside)))
        ui.result(action="build", ok=True, applied=False, books=len(folders), aside=str(aside))
        return True
    aside.mkdir()
    for p in moving:
        os.rename(str(p), str(aside / p.name))
    ui.ok("Moved your books aside to %s" % mc.pretty_path(aside))
    conts = mo.containers_using(lib, mc.cfg("books", "pause_containers", "auto")) if mo.docker_ok() else []
    with mo.Paused(conts):
        r = mc.run([calibredb, "add", "--library-path", str(lib), "--recurse", "--one-book-per-directory",
                    str(aside)], timeout=6 * 3600)
        if r.returncode != 0:
            mc.die("Calibre couldn't add the books: %s" % (r.stderr or r.stdout).strip()[-300:],
                   "Every book is still in %s, untouched." % mc.pretty_path(aside))
        listed = mc.run([calibredb, "list", "--for-machine", "--library-path", str(lib), "--fields", "id"],
                        timeout=600)
    try:
        added = len(json.loads(listed.stdout or "[]"))
    except ValueError:
        added = 0
    ok = added >= len(folders)
    if ok:
        ui.ok("All %s books are in your Calibre library" % mc.fmt_n(len(folders)))
    else:
        ui.warn("%s of %s books came in: the rest are still in %s" % (mc.fmt_n(added), mc.fmt_n(len(folders)),
                                                                       mc.pretty_path(aside)))
    ui.say("The copy in %s stays until you've looked: delete it once you're happy." % mc.pretty_path(aside))
    ui.result(action="build", ok=ok, applied=True, books=len(folders), added=added, aside=str(aside))
    return ok


def main():
    ap = mc.base_parser("books_tidy.py", __doc__, ["genre-counts", "build"])
    args = ap.parse_args()
    mc.begin(args, "books", "books %s" % args.action)
    return build() if args.action == "build" else genre_counts()


if __name__ == "__main__":
    mc.run_main(main)
