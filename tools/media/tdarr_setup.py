#!/usr/bin/env python3
"""
Sets up Tdarr for Tidy Up: a "Tidy Up · Movies" and a "Tidy Up · TV" library with the space-saving
plugin stack, and an output folder, so Tdarr never overwrites a file itself.

  python3 tdarr_setup.py scan            what it would set up; changes nothing
  python3 tdarr_setup.py scan --apply    set it up (the libraries are found again by name next time)

Each library: the films (or series) folder as Tdarr's container sees it, no scanning on its own
(Tidy Up hands it files one by one), its results written under <library>/.tdarr-output, and the
plugins: streams in order, audio and subtitles in other languages removed (commentary too), lossless
audio to AAC, video to HEVC (or AV1) on the graphics card when there is one, else the processor.
Tdarr's queue, and each node's worker limits, pace the transcodes.

For apps: --events json prints one JSON object per line; exit codes 0 ok, 1 error.
"""
import time

import media_common as mc

ui = mc.ui
NAMES = {"movies": "Tidy Up · Movies", "tv": "Tidy Up · TV"}
INSIDE = {"movies": "/media/movies", "tv": "/media/tv"}


def library_doc(kind, gpu, langs, codec):
    lid = "tidyup-%s" % kind
    plugins = [dict(p, _id="%s-%d" % (p["id"], i), checked=True, source="Community", priority=i)
               for i, p in enumerate(mc.plugin_stack(gpu, langs, codec))]
    return {
        "_id": lid, "name": NAMES[kind], "priority": 0, "folder": INSIDE[kind], "foldersToIgnore": ".tdarr-output",
        "cache": "/temp", "output": INSIDE[kind] + "/.tdarr-output", "folderToFolderConversion": True,
        "folderToFolderConversionDeleteSource": False, "copyIfConditionsMet": False,
        "processLibrary": True, "scanOnStart": False, "folderWatching": False, "scheduledScanFindNew": False,
        "holdNewFiles": False, "pluginIDs": plugins, "pluginCommunity": True, "decisionMaker": {
            "videoFilter": False, "audioFilter": False, "settingsPlugin": True, "settingsVideo": False,
            "settingsAudio": False},
        "containerFilter": "mkv,mp4,m4v,avi,mov,wmv,ts,m2ts,webm,mpg,mpeg,flv",
        "createdAt": int(time.time() * 1000),
    }


def setup(apply):
    td_conf = mc.cfg("tdarr") or {}
    url = td_conf.get("url")
    if not url:
        mc.die("Tdarr isn't installed.", "Install it from Choose stacks (Media automation), then run this again.")
    td = mc.Tdarr(url, mc.secret("TDARR_API_KEY"))
    ui.title("Tdarr", "Tidy Up's libraries" + ("" if apply else " (preview)"))
    if not td.ok():
        mc.die("Tdarr isn't answering at %s." % url, "Start it from Status, then run this again.")
    langs = mc.cfg("video", "keep_languages") or ["eng"]
    codec = (td_conf.get("codec") or "hevc").lower()
    gpu = bool(td_conf.get("gpu"))
    existing = {l.get("name"): l for l in td.libraries() if isinstance(l, dict)}
    ids = {}
    for kind in ("movies", "tv"):
        doc = library_doc(kind, gpu, langs, codec)
        have = existing.get(NAMES[kind])
        ui.kv(NAMES[kind], "%s → %s · %s on the %s" % (doc["folder"], doc["output"], codec.upper(), "graphics card" if gpu else "processor"))
        if not apply:
            ids[kind] = (have or {}).get("_id", "")
            continue
        if have:
            doc["_id"] = have["_id"]
            td._post("/api/v2/cruddb", {"collection": "LibrarySettingsJSONDB", "mode": "update", "docID": have["_id"],
                                        "obj": {k: v for k, v in doc.items() if k not in ("_id", "createdAt")}})
            ui.ok("%s updated" % NAMES[kind])
        else:
            td._post("/api/v2/cruddb", {"collection": "LibrarySettingsJSONDB", "mode": "insert", "docID": doc["_id"],
                                        "obj": doc})
            ui.ok("%s made" % NAMES[kind])
        ids[kind] = doc["_id"]
    ui.result(action="tdarr-setup", ok=True, applied=apply, libraries=ids, codec=codec, gpu=gpu)


def main():
    ap = mc.base_parser("tdarr_setup.py", __doc__, ["scan"])
    args = ap.parse_args()
    mc.begin(args, "tdarr", "tdarr setup")
    setup(args.apply)


if __name__ == "__main__":
    mc.run_main(main)
