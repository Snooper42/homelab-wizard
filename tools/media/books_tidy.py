#!/usr/bin/env python3
"""
Books, around books_organizer.py: what Tidy Up adds to the vendored engine without changing it.

  python3 books_tidy.py genre-counts    how many books are in each genre (each book's first tag in
                                        Calibre); changes nothing, and reads Calibre's database only

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error.
"""
import sqlite3
from pathlib import Path

import media_common as mc

ui = mc.ui


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


def main():
    ap = mc.base_parser("books_tidy.py", __doc__, ["genre-counts"])
    args = ap.parse_args()
    mc.begin(args, "books", "books %s" % args.action)
    return genre_counts()


if __name__ == "__main__":
    mc.run_main(main)
