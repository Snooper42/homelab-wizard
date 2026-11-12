#!/usr/bin/env python3
"""
Undo: put back what one run put in the Trash, each thing where it was.

  python3 trash_restore.py restore <run>   the run's id, as the app's record names it (it asks)

Only what is still in the Trash, with nothing in its old place now, goes back; the rest is said.
A line naming something that isn't directly in the Trash of its old place's drive is never moved,
nor one whose old place isn't inside a library, an inbox folder, a scrubber root or the reports folder.
Things in Windows' Recycle Bin are said by name: restore them from there (Restore).

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error.
"""
import json
import os
import shutil
from pathlib import Path

import media_common as mc

ui = mc.ui


def thrown(log, run):
    """What the run put in the Trash, oldest first: [{from, to}]."""
    out = []
    try:
        with open(log, encoding="utf-8") as f:
            for line in f:
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                if e.get("run") == run and e.get("from"):
                    out.append(e)
    except OSError:
        pass
    return out


def restore(run, log):
    ui.title("Undo", "putting back what was put in %s" % mc.trash_words("%TRASH%"))
    items = thrown(log, run)
    if not items:
        mc.die("Nothing from that run is noted in the Trash.")
    if not mc.mo.confirm("Put %s back where they were?" % mc.fmt_n(len(items))):
        raise SystemExit(1)
    restored, stayed, recycle = 0, [], []
    for e in reversed(items):  # newest first: a folder thrown after its files comes back first
        src, at = Path(e["from"]), Path(e["to"]) if e.get("to") else None
        if at is None:
            recycle.append(src.name)
            continue
        if not mc.trashed_from(src, at):
            stayed.append("%s: not where Tidy Up puts what it throws away" % src.name)
            continue
        if not mc.in_media_root(src):
            stayed.append("%s: not in a folder Tidy Up looks after" % src.name)
            continue
        if not at.exists() and not at.is_symlink():
            stayed.append("%s: no longer in the Trash" % src.name)
            continue
        if src.exists():
            stayed.append("%s: something else is in its place" % src.name)
            continue
        src.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.rename(str(at), str(src))
        except OSError:
            shutil.move(str(at), str(src))
        info = at.parent.parent / "info" / (at.name + ".trashinfo")  # Linux's note of where it came from
        if at.parent.name == "files" and info.is_file():
            info.unlink()
        restored += 1
        ui.to_log("       put back %s" % src)
    ui.ok("Put %s back" % mc.fmt_n(restored))
    for s in stayed[:10]:
        ui.warn(s)
    if recycle:
        ui.warn("%s are in the Recycle Bin: open it and choose Restore (%s)" % (mc.fmt_n(len(recycle)), ", ".join(recycle[:5])))
    ui.result(action="restore", ok=True, run=run, restored=restored, stayed=stayed[:50], recycle=recycle[:50])
    return True


def main():
    ap = mc.base_parser("trash_restore.py", __doc__, ["restore"])
    args = ap.parse_args()
    mc.begin(args, "trash", "trash restore")
    log = os.environ.get("HOMELAB_MEDIA_TRASH_LOG")
    if not args.paths or not log:
        mc.die("Which run?", "trash_restore.py restore <run>  (the app passes where the log is)")
    # This run's own moves aren't noted as thrown: nothing here goes to the Trash.
    return restore(args.paths[0], log)


if __name__ == "__main__":
    mc.run_main(main)
