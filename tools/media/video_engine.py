#!/usr/bin/env python3
"""
The engine movies_organizer.py and tv_organizer.py share: find the videos that waste space, hand
them to Tdarr's queue, and when Tdarr is done, check its copy, put it in place of the original,
align the subtitles to it, tell the media servers about that one folder, and put the original in
the Trash. New downloads are filed the same way ("Shrink & Strip"): a copy that's leaner than the
one in the library replaces it, a bloated one goes through Tdarr before it enters the library, and
a duplicate that's no better goes to the Trash.

Tdarr is set up with an output folder (<library>/.tdarr-output), so it never overwrites anything:
this engine moves the result into place only after checking it plays as long as the original and
is smaller. Tdarr's own queue and its nodes' worker limits decide how many transcode at once.
"""
import os
import re
import time
import urllib.parse
from pathlib import Path

import media_common as mc

ui = mc.ui
SAMPLE_RE = re.compile(r"(?i)(^|[\W_])(sample|trailer|featurette|behind[\W_]the[\W_]scenes)([\W_]|$)")
OUTPUT_DIR = ".tdarr-output"
STAGING_DIR = ".tidy-staging"
# Tdarr records a file it was handed within seconds (it reads it first). One it still has no record of
# after this long never reached it (Tdarr was restarting, or its scan dropped it): it's handed again, up
# to HAND_TRIES times in all.
REHAND_AFTER = 20 * 60
HAND_TRIES = 3


class VideoEngine:
    kind = "video"  # movies or tv
    section = "video"

    # ------------------------------------------------------------------ what subclasses provide
    def destination(self, path, lib):
        """Where a new video belongs in the library, or None when its name can't be read."""
        raise NotImplementedError

    def same_item(self, dest):
        """Videos already in the library that are the same film or episode as dest."""
        raise NotImplementedError

    # ------------------------------------------------------------------ settings and state
    def __init__(self):
        self.state = None
        self.lib = None

    @property
    def keep_langs(self):
        return [l.lower() for l in (mc.cfg(self.section, "keep_languages") or mc.cfg("video", "keep_languages") or ["eng"])]

    @property
    def target(self):
        return (mc.cfg("tdarr", "codec") or "hevc").lower()

    def tdarr(self):
        url = mc.cfg("tdarr", "url")
        if not url:
            return None
        return mc.tdarr(url)

    def tdarr_library(self):
        return (mc.cfg("tdarr", "libraries") or {}).get(self.kind) or ""

    def tdarr_path(self, p):
        return mc.Servers.server_path(p, mc.cfg("tdarr", "path_map") or [])

    def tdarr_sees(self, p):
        """Whether Tdarr's container can open p: its path there is under a folder Tdarr mounts. A path
        that isn't (a library outside the media drive's films or TV folder) would be handed to Tdarr
        and never found by it, so it is said instead."""
        inside = [str(i).rstrip("/") for _, i in (mc.cfg("tdarr", "path_map") or [])]
        if not inside:
            return True
        tp = self.tdarr_path(p)
        return any(tp == i or tp.startswith(i + "/") for i in inside)

    def tdarr_unseen(self, paths):
        if not paths:
            return
        mounts = [mc.pretty_path(h) for h, inside in (mc.cfg("tdarr", "path_map") or [])
                  if str(inside).rstrip("/").endswith("/" + self.kind)]
        ui.warn("Tdarr can't open %s %s: its container sees %s alone, and this library is %s. Keep the %s "
                "library in that folder (MEDIA_ROOT in Settings is the drive it's on), then run this again"
                % (mc.fmt_n(len(paths)), "video" if len(paths) == 1 else "videos",
                   " and ".join(mounts) or "the media drive", mc.pretty_path(self.lib), self.kind))

    def load(self):
        self.lib = mc.library_dir(self.section)
        self.state = mc.load_state(self.kind, {"files": {}, "pending": {}, "freed": 0, "history": []})
        return self.state

    def save(self):
        mc.save_state(self.kind, self.state)

    def note(self, what, **data):
        h = self.state.setdefault("history", [])
        h.append(dict(when=time.strftime("%Y-%m-%dT%H:%M:%S"), what=what, **data))
        del h[:-200]

    # ------------------------------------------------------------------ genres
    noun = ("item", "items")

    def items(self):
        """What the library holds, one entry per film or show (its folder, or a film's loose file)."""
        raise NotImplementedError

    def nfo_genre(self, item):
        """The first genre in the item's .nfo (what Radarr, Sonarr, Jellyfin, and Kodi write), or None."""
        raise NotImplementedError

    def genre_counts(self):
        """How many films or shows are in each genre: from Jellyfin when it's set up here (it has every
        genre TMDB gives), else from the .nfo files beside them. One genre each, its first. Changes nothing."""
        self.load()
        ui.title("Genres", "how many %s are in each" % self.noun[1])
        items = self.items()
        from_jf = self.jellyfin_genres()  # None: Jellyfin can't be asked (or didn't answer)
        jf = from_jf or {}
        counts, unplaced, used = {}, 0, set()
        conf = mc.Servers().conf.get("jellyfin") or {}
        with ui.progress(len(items), "Reading genres") as bar:
            for it in items:
                bar.update(note=it.name)
                g = jf.get(_path_key(mc.Servers.server_path(it, conf.get("path_map"))))
                if g:
                    used.add("Jellyfin")
                else:
                    g = self.nfo_genre(it)
                    if g:
                        used.add("the .nfo files")
                if g:
                    counts[g] = counts.get(g, 0) + 1
                else:
                    unplaced += 1
        shown = dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))
        where = " and ".join(w for w in ("Jellyfin", "the .nfo files") if w in used) or "nowhere yet"
        why = ""
        if not items:
            ui.warn("No %s in the library yet to count" % self.noun[1])
        elif not shown:
            # Nothing to read a genre from: said, with what would give them one.
            jf_why = (self.jellyfin_why() or "Jellyfin didn't answer") if from_jf is None else "Jellyfin has no genres for them"
            why = "%s; and none has an .nfo file beside it" % jf_why
            ui.warn("No genres for your %s: %s" % (self.noun[1], why))
        else:
            ui.ok("%s %s in %d genres, from %s" % (mc.fmt_n(len(items) - unplaced), self.noun[1], len(shown), where))
        if unplaced and shown:
            ui.say("%s %s have no genre yet" % (mc.fmt_n(unplaced), self.noun[1]))
        ui.result(action="genre-counts", ok=True, items=len(items), genres=shown, unplaced=unplaced, source=where, why=why)
        return True

    def jellyfin_why(self):
        """Why Tidy Up can't ask Jellyfin about this library, in words with the fix; "" when it can."""
        c = mc.Servers().conf.get("jellyfin") or {}
        if not c.get("url"):
            return "Jellyfin isn't installed here (it reads genres from the internet for every film and show)"
        if not mc.secret(c.get("key_env") or "JELLYFIN_API_KEY"):
            return ("Jellyfin's API key isn't set: make one in Jellyfin › Dashboard › API Keys, "
                    "and put it in Settings › Jellyfin (Jellyfin API key)")
        if self.kind not in (c.get("kinds") or []):
            return "Jellyfin has no library on this folder"
        return ""

    def jellyfin(self):
        """(url, headers) for Jellyfin when it serves this library and has its key, else None."""
        c = mc.Servers().conf.get("jellyfin") or {}
        key = mc.secret(c.get("key_env") or "JELLYFIN_API_KEY")
        if not c.get("url") or self.kind not in (c.get("kinds") or []) or not key:
            return None
        return c["url"].rstrip("/"), {"Authorization": 'MediaBrowser Token="%s"' % key, "X-Emby-Token": key}

    def without_posters(self):
        """The films or shows in this library Jellyfin shows with no poster: [{id, name}], or None
        without Jellyfin. Only those under this library's folder, as Jellyfin sees it."""
        jf = self.jellyfin()
        if not jf:
            return None
        c = mc.Servers().conf.get("jellyfin") or {}
        root = _path_key(mc.Servers.server_path(self.lib, c.get("path_map")))
        kind = "Movie" if self.kind == "movies" else "Series"
        try:
            got = mc.http_json("GET", jf[0] + "/Items?Recursive=true&IncludeItemTypes=%s&Fields=Path" % kind, headers=jf[1], timeout=60)
        except RuntimeError as e:
            ui.warn("Jellyfin didn't answer (%s); posters not checked" % e)
            return None
        out = []
        for i in (got or {}).get("Items") or []:
            p = _path_key(i.get("Path") or "")
            if i.get("Id") and not (i.get("ImageTags") or {}).get("Primary") and (p == root or p.startswith(root + "/")):
                out.append({"id": i["Id"], "name": i.get("Name") or Path(p).name})
        return sorted(out, key=lambda x: x["name"].casefold())

    def scan_posters(self):
        """For the scan: how many have no poster in Jellyfin (nothing when it isn't set up)."""
        bare = self.without_posters()
        if bare is None:
            return {}
        if bare:
            ui.kv("No poster in Jellyfin", mc.fmt_n(len(bare)))
        return {"posterless": len(bare), "posterless_list": [b["name"] for b in bare[:50]]}

    def posters(self):
        """Ask Jellyfin to look again for the posters it's missing: images only added, never replaced."""
        self.load()
        ui.title("%s library" % self.kind.title(), "posters Jellyfin is missing")
        bare = self.without_posters()
        if bare is None:
            mc.die("Jellyfin isn't set up for %s here (its address and JELLYFIN_API_KEY)." % self.kind)
        jf = self.jellyfin()
        asked, failed = 0, []
        with ui.progress(len(bare), "Asking Jellyfin") as bar:
            for b in bare:
                bar.update(note=b["name"])
                try:
                    mc.http_json("POST", jf[0] + "/Items/%s/Refresh?metadataRefreshMode=Default&imageRefreshMode=FullRefresh"
                                 "&replaceAllMetadata=false&replaceAllImages=false" % urllib.parse.quote(b["id"]), headers=jf[1])
                    asked += 1
                except RuntimeError as e:
                    failed.append(b["name"])
                    ui.to_log("NOTE   %s: %s" % (b["name"], e))
        ui.ok("Jellyfin is looking for %s posters; they show in a few minutes" % mc.fmt_n(asked))
        if failed:
            ui.warn("Jellyfin didn't take %s of them" % mc.fmt_n(len(failed)))
        ui.result(action="posters", ok=not failed, asked=asked, failed=failed[:20])
        return not failed

    def jellyfin_genres(self):
        """{the item's folder as Jellyfin sees it: its first genre}, or None without Jellyfin."""
        jf = self.jellyfin()
        if not jf:
            return None
        kind = "Movie" if self.kind == "movies" else "Series"
        try:
            got = mc.http_json("GET", jf[0] + "/Items?Recursive=true&IncludeItemTypes=%s&Fields=Genres,Path" % kind, headers=jf[1], timeout=60)
        except RuntimeError as e:
            ui.warn("Jellyfin didn't answer (%s): reading the .nfo files instead" % e)
            return None
        out = {}
        for i in (got or {}).get("Items") or []:
            p, g = i.get("Path") or "", [x for x in (i.get("Genres") or []) if x]
            if not p or not g:
                continue
            p = p.replace("\\", "/")
            # A film's path is its file; its folder is what's counted, unless it sits loose in the library.
            for k in {p, p.rsplit("/", 1)[0]} if kind == "Movie" else {p}:
                out.setdefault(_path_key(k), g[0])
        return out

    # ------------------------------------------------------------------ scan
    def probe(self, p):
        return mc.media_facts(mc.ffprobe(p))

    def scan(self):
        self.load()
        ui.title("%s library" % self.kind.title(), "scan only, nothing will be changed")
        ui.kv("Library", self.lib)
        files = self.videos()
        ui.step(1, 2, "Reading %s videos" % mc.fmt_n(len(files)))
        known = self.state["files"]
        bloated, total, saving, unreadable = self.read(files, ("queued", "failed"))
        ui.step(2, 2, "What I found")
        ui.kv("Videos", "%s  (%s)" % (mc.fmt_n(len(files)), human(total)))
        ui.kv("Wasting space", mc.fmt_n(len(bloated)))
        ui.kv("Could free", "about %s" % human(saving))
        if unreadable:
            ui.kv("Unreadable", mc.fmt_n(unreadable))
        why = {}
        for k in bloated:
            for r in known[k].get("reasons") or []:
                key = r.split(" (")[0]
                why[key] = why.get(key, 0) + 1
        for r, n in sorted(why.items(), key=lambda kv: -kv[1]):
            ui.kv("  " + r, mc.fmt_n(n))
        dupes = self.duplicates(files, known)
        if dupes:
            ui.kv("Twice in the library", "%s (%s in the extra copies)" % (mc.fmt_n(len(dupes)), human(sum(d["bytes"] for d in dupes))))
        ui.result(action="scan", ok=True, media=self.kind, files=len(files), bytes=total, bloated=len(bloated),
                  saving=saving, unreadable=unreadable, reasons=why, duplicates=len(dupes),
                  duplicate_bytes=sum(d["bytes"] for d in dupes), duplicate_list=dupes[:50], **self.scan_more(files))

    def videos(self):
        return [p for p in mc.walk_files(self.lib, mc.VIDEO_EXT) if not SAMPLE_RE.search(p.stem)]

    def read(self, files, trusted):
        """Each video's record: read again with ffprobe, unless its record has a status in trusted and
        the file is the size it was then. (bloated paths, bytes, bytes it could free, unreadable)."""
        known = self.state["files"]
        bloated, total, saving, unreadable = [], 0, 0, 0
        with ui.progress(len(files), "Reading") as bar:
            for p in files:
                key = str(p)
                rec = known.get(key) or {}
                size = p.stat().st_size
                if rec.get("status") in trusted and rec.get("size") == size:
                    bar.update(note=p.name)
                    total += size
                    if rec.get("status") in ("queued", "bloated"):
                        bloated.append(key)
                    continue
                try:
                    facts = self.probe(p)
                except RuntimeError as e:
                    unreadable += 1
                    ui.to_log("NOTE   %s" % e)
                    bar.update(note=p.name)
                    continue
                reasons = mc.bloat_reasons(facts, self.keep_langs, self.target)
                rec = {"status": "bloated" if reasons else "lean", "reasons": reasons, "size": size,
                       "codec": facts["video_codec"], "height": facts["height"], "duration": facts["duration"]}
                known[key] = rec
                total += size
                if reasons:
                    bloated.append(key)
                    saving += estimate_saving(facts, size, self.target)
                bar.update(note=p.name)
        for gone in [k for k in known if not Path(k).exists()]:
            del known[gone]
        self.save()
        return bloated, total, saving, unreadable

    def scan_more(self, files):
        """More a scan says: the posters Jellyfin is missing, and what a kind adds (TV: the episodes missing)."""
        return self.scan_posters()

    # ------------------------------------------------------------------ the same film or episode twice
    def dup_key(self, path):
        """What makes two videos the same film or episode; None when that can't be told."""
        raise NotImplementedError

    def duplicates(self, files, known):
        """Each film or episode the library has more than once, as read by the last scan: the copy kept
        (the best picture: tallest, then the newer codec, then the smaller) and the copies of the same
        length that could go. A copy of another length (another cut) or a taller one is never one."""
        groups = {}
        for p in files:
            k = self.dup_key(p)
            rec = known.get(str(p))
            if k and rec and rec.get("duration") and rec.get("size"):
                groups.setdefault(k, []).append((p, rec))
        out = []
        for k in sorted(groups, key=str):
            recs = groups[k]
            if len(recs) < 2:
                continue
            recs.sort(key=lambda pr: (-(pr[1].get("height") or 0), -mc.VIDEO_RANK.get(pr[1].get("codec") or "", 0), pr[1]["size"], str(pr[0])))
            keep, kr = recs[0]
            extra = [(p, r) for p, r in recs[1:] if mc.same_cut(_facts(r), _facts(kr))]
            if extra:
                out.append({"keep": str(keep), "extra": [str(p) for p, _ in extra], "bytes": sum(r["size"] for _, r in extra)})
        return out

    def dedupe(self):
        """Put the extra copies the last scan found in the Trash, each checked again first."""
        self.load()
        ui.title("%s library" % self.kind.title(), "the extra copies, to %s" % mc.trash_words("%TRASH%"))
        known = self.state["files"]
        files = [Path(k) for k in known if Path(k).exists()]
        dupes = self.duplicates(files, known)
        if not dupes:
            ui.ok("Nothing is in the library twice")
            ui.result(action="dedupe", ok=True, removed=0, freed=0)
            return True
        if not mc.mo.confirm("Put %s extra copies in %s?" % (mc.fmt_n(sum(len(d["extra"]) for d in dupes)), mc.trash_words("%TRASH%"))):
            raise SystemExit(1)
        servers = mc.Servers()
        removed, freed, kept = 0, 0, []
        for d in dupes:
            keep = Path(d["keep"])
            try:
                kf = self.probe(keep)  # the copy kept still plays, as long as before
            except RuntimeError as e:
                ui.warn("%s: %s; its copies are kept" % (keep.name, e))
                kept.append(d["keep"])
                continue
            for x in d["extra"]:
                xp = Path(x)
                rec = known.get(x) or {}
                if not xp.exists() or xp.stat().st_size != rec.get("size") or not mc.same_cut(kf, _facts(rec)):
                    ui.warn("%s changed since the scan; kept" % xp.name)
                    continue
                mc.trash(xp)
                known.pop(x, None)
                removed += 1
                freed += rec["size"]
                self.note("duplicate", path=x, kept=d["keep"])
            servers.ping(keep, self.kind)
        self.state["freed"] = self.state.get("freed", 0) + freed
        self.save()
        ui.ok(mc.trash_words("%s extra copies went to %TRASH% · %s freed") % (mc.fmt_n(removed), human(freed)))
        ui.result(action="dedupe", ok=not kept, removed=removed, freed=freed, kept=kept, told=servers.sent)
        return not kept

    # ------------------------------------------------------------------ run: hand the bloated ones to Tdarr
    def run(self):
        self.load()
        mc.stop_if_on_battery()
        ui.title("%s library" % self.kind.title(), "shrinking through Tdarr")
        td = self.tdarr()
        lib_id = self.tdarr_library()
        if not td or not lib_id:
            mc.die("Tdarr isn't set up for %s yet." % self.kind, "Run: homelab media tdarr setup --apply")
        if not td.ok():
            mc.die("Tdarr isn't answering at %s." % td.url, "Start it from Status, then run this again.")
        libs = td.libraries()
        if isinstance(libs, list) and lib_id not in {l.get("_id") for l in libs if isinstance(l, dict)}:
            # Tdarr's data was cleared, or it was installed again: the library Tidy Up made is gone, and
            # files handed to it would go nowhere.
            mc.die("Tdarr has no Tidy Up library for %s any more." % self.kind,
                   "Run Set up Tdarr again (homelab media tdarr setup --apply), then Shrink.")
        # A node with no worker would leave everything in Tdarr's queue: given one first.
        for name in td.give_workers(bool((mc.cfg("tdarr") or {}).get("gpu"))):
            ui.ok("Tdarr's node %s had no worker: it has one now (raise it on Tdarr's page)" % name)
        # Films and episodes that came in since the last scan (Radarr and Sonarr file straight into the
        # library) are read first, so they are handed too; the ones read before aren't read again.
        files = self.videos()
        fresh = [p for p in files if (self.state["files"].get(str(p)) or {}).get("size") != p.stat().st_size]
        ui.step(1, 3, "Reading %s new videos" % mc.fmt_n(len(fresh)))
        self.read(files, ("queued", "failed", "bloated", "lean"))
        todo = [k for k, r in self.state["files"].items() if r.get("status") == "bloated" and Path(k).exists()]
        unseen = [k for k in todo if not self.tdarr_sees(k)]
        todo = [k for k in todo if k not in unseen]
        if not todo and not unseen:
            ui.ok("Nothing waiting: every video is already lean, or with Tdarr.")
        ui.step(2, 3, "Handing %s videos to Tdarr" % mc.fmt_n(len(todo)))
        for i in range(0, len(todo), 50):
            batch = todo[i:i + 50]
            td.queue(lib_id, [self.tdarr_path(p) for p in batch])
            for k in batch:
                self.state["files"][k].update(status="queued", queued_at=time.time(), tries=1)
            self.save()
        if todo:
            ui.ok("Tdarr has %s videos in its queue; its nodes take them one by one" % mc.fmt_n(len(todo)))
        self.tdarr_unseen(unseen)
        ui.step(3, 3, "Collecting what Tdarr finished")
        self.collect(inner=True)

    # ------------------------------------------------------------------ collect: put Tdarr's results in place
    def output_for(self, original):
        # The record may hold the path as written then (through a link, or a Windows short name).
        rel = Path(mc._real(original)).relative_to(Path(mc._real(self.lib)))
        folder = self.lib / OUTPUT_DIR / rel.parent
        if not folder.is_dir():
            return None
        cands = [p for p in folder.iterdir() if p.is_file() and p.stem == rel.stem and p.suffix.lower() in mc.VIDEO_EXT]
        return max(cands, key=lambda p: p.stat().st_mtime) if cands else None

    def collect(self, inner=False):
        if not inner:
            self.load()
            ui.title("%s library" % self.kind.title(), "collecting Tdarr's work")
        td = self.tdarr()
        files = self.state["files"]
        queued = [k for k, r in files.items() if r.get("status") == "queued"]
        if td and queued and not inner:
            for name in td.give_workers(bool((mc.cfg("tdarr") or {}).get("gpu"))):
                ui.ok("Tdarr's node %s had no worker, so nothing was being shrunk: it has one now" % name)
        replaced, failed, waiting, freed, handed, lost = 0, 0, 0, 0, 0, []
        servers = mc.Servers()
        lib_id = self.tdarr_library()
        for k in queued:
            verdict = td.status(self.tdarr_path(k)) if td else None
            rec = files[k]
            if verdict is None and td and lib_id and Path(k).exists() and not self.output_for(k) and \
                    time.time() - float(rec.get("queued_at") or 0) >= REHAND_AFTER:
                # Tdarr has no record of it: it never took it. Handed again, or, after a few tries, left
                # for the next Shrink and said.
                if int(rec.get("tries") or 1) >= HAND_TRIES:
                    rec["status"] = "bloated"
                    lost.append(k)
                else:
                    td.queue(lib_id, [self.tdarr_path(k)])
                    rec.update(queued_at=time.time(), tries=int(rec.get("tries") or 1) + 1)
                    handed += 1
                    waiting += 1
                self.save()
                continue
            if verdict in mc.Tdarr.SKIPPED:
                rec["status"] = "lean"
                continue
            if verdict in mc.Tdarr.FAILED:
                rec["status"] = "failed"
                failed += 1
                ui.warn("Tdarr couldn't shrink %s; the original stays" % Path(k).name)
                self.note("failed", path=k)
                continue
            out = self.output_for(k) if verdict in mc.Tdarr.DONE or verdict is None else None
            if not out:
                waiting += 1
                continue
            if not Path(k).exists():
                mc.trash(out)
                del files[k]
                continue
            gained = self.replace(Path(k), out, servers)
            if gained is None:
                rec["status"] = "failed"
                failed += 1
            else:
                freed += gained
                replaced += 1
                files.pop(k, None)
            self.save()
        staged_done = self.collect_staged(td, servers)
        self.state["freed"] = self.state.get("freed", 0) + freed
        self.save()
        for d in (self.lib / OUTPUT_DIR, self.lib / STAGING_DIR):
            mc.remove_empty_dirs(d, keep_root=True)
        if replaced:
            ui.ok("Replaced %s videos with their smaller copies, %s freed" % (mc.fmt_n(replaced), human(freed)))
        if handed:
            ui.say("Tdarr had no record of %s it was given: handed to it again" % mc.fmt_n(handed))
        if lost:
            ui.warn("Tdarr never took %s after %d tries (%s): they stay as they are, and Shrink hands them "
                    "again. Check Tdarr's page for its Tidy Up library and that its node is running"
                    % (mc.fmt_n(len(lost)), HAND_TRIES, ", ".join(Path(k).name for k in lost[:3]) + (", …" if len(lost) > 3 else "")))
        if waiting:
            ui.say("%s still with Tdarr; they're collected on the next run (the homelab checks every few minutes)" % mc.fmt_n(waiting))
        ui.result(action="collect", ok=True, media=self.kind, replaced=replaced, failed=failed, waiting=waiting,
                  freed=freed, filed=staged_done, told=servers.sent, handed_again=handed, not_taken=len(lost))

    def replace(self, original, out, servers):
        """Check Tdarr's copy, then swap it in and trash the original. Returns the bytes freed, or None."""
        try:
            new, old = self.probe(out), self.probe(original)
        except RuntimeError as e:
            ui.warn("Can't read Tdarr's copy of %s (%s); the original stays" % (original.name, e))
            mc.trash(out)
            return None
        if not mc.same_length(new["duration"], old["duration"]):
            ui.warn("Tdarr's copy of %s is %s long instead of %s; the original stays"
                    % (original.name, mc.fmt_time(new["duration"]), mc.fmt_time(old["duration"])))
            mc.trash(out)
            return None
        if not new["video_codec"] or (old["size"] and new["size"] >= old["size"]):
            ui.warn("Tdarr's copy of %s came out no smaller; the original stays" % original.name)
            mc.trash(out)
            self.note("kept", path=str(original))
            return 0
        final = original.with_suffix(out.suffix)
        if final != original and final.exists():
            final = mc.unique_path(final)
        incoming = final.with_name(final.stem + ".tidy-new" + final.suffix)
        mc.move_file(out, incoming)
        mc.trash(original)
        os.replace(str(incoming), str(final))
        synced = mc.sync_subtitles(final)
        servers.ping(final, self.kind)
        gained = old["size"] - new["size"]
        self.note("replaced", path=str(final), freed=gained, subtitles=synced)
        ui.ok("%s: %s → %s%s" % (final.name, human(old["size"]), human(new["size"]),
                                 ", %d subtitle%s aligned" % (synced, "" if synced == 1 else "s") if synced else ""))
        return gained

    # ------------------------------------------------------------------ file: new downloads (Shrink & Strip)
    def file(self, paths, apply=True):
        self.load()
        ui.title("New %s" % self.kind, "filing into %s" % mc.pretty_path(self.lib))
        servers = mc.Servers()
        videos = []
        for p in paths:
            p = Path(p)
            videos += [p] if p.is_file() else mc.walk_files(p, mc.VIDEO_EXT)
        filed, replaced, discarded, staged, unknown = [], 0, 0, 0, []
        td, lib_id = self.tdarr(), self.tdarr_library()
        stage_seen, unseen = self.tdarr_sees(self.lib / STAGING_DIR), []
        for v in videos:
            if v.suffix.lower() not in mc.VIDEO_EXT:
                continue
            if SAMPLE_RE.search(v.stem) or v.stat().st_size < 50 * 1024 * 1024 and "sample" in str(v).lower():
                mc.trash(v, dry_run=not apply)
                discarded += 1
                continue
            dest = self.destination(v, self.lib)
            if dest is None:
                unknown.append(str(v))
                ui.warn("Can't tell what %s is from its name; left where it is" % v.name)
                continue
            try:
                facts = self.probe(v)
            except RuntimeError as e:
                unknown.append(str(v))
                ui.warn(str(e))
                continue
            existing = self.same_item(dest)
            if existing:
                try:
                    best = max(existing, key=lambda e: e.stat().st_size)
                    old = self.probe(best)
                except (RuntimeError, OSError):
                    old = None
                # Nothing is replaced on a guess: a copy that can't be read, or a download of another
                # length (another cut), is left for a person to look at.
                if old is None:
                    unknown.append(str(v))
                    ui.warn("%s: the library's copy can't be read, so it isn't replaced; the download is left where it is" % dest.name)
                    continue
                if not mc.same_cut(facts, old):
                    unknown.append(str(v))
                    ui.warn("%s: the download is %s long and the library's copy %s (another cut?); the download is left where it is"
                            % (dest.name, minutes(facts["duration"]), minutes(old["duration"])))
                    continue
                if not mc.video_more_efficient(facts, old):
                    ui.ok(mc.trash_words("%s: the library's copy is leaner; the download went to %TRASH%") % dest.name)
                    mc.trash(v, dry_run=not apply)
                    discarded += 1
                    self.note("discarded", path=str(v), kept=str(best))
                    continue
            reasons = mc.bloat_reasons(facts, self.keep_langs, self.target)
            if not apply:
                ui.kv(v.name, "→ %s%s" % (mc.pretty_path(dest), "  (through Tdarr first)" if reasons else ""))
                continue
            if reasons and td and lib_id and not stage_seen:
                unseen.append(str(v))  # filed as it is: Tdarr couldn't open it in the staging folder
            if reasons and td and lib_id and stage_seen:
                # Bloated: it waits in the hidden staging folder until Tdarr's copy is ready.
                stage = mc.unique_path(self.lib / STAGING_DIR / dest.relative_to(self.lib).parent / (dest.stem + v.suffix))
                mc.move_file(v, stage)
                td.queue(lib_id, [self.tdarr_path(stage)])
                self.state["pending"][str(stage)] = {"dest": str(dest), "replaces": [str(e) for e in existing],
                                                     "since": time.time(), "reasons": reasons}
                staged += 1
                ui.ok("%s: shrinking through Tdarr before it's filed (%s)" % (dest.name, "; ".join(reasons)))
                continue
            final = dest.with_suffix(v.suffix.lower())
            for e in existing:
                mc.trash(e)
            if existing:
                replaced += 1
            final = mc.unique_path(final)
            mc.move_file(v, final)
            self.move_sidecars(v, final)
            servers.ping(final, self.kind)
            filed.append(str(final))
            self.note("filed", path=str(final))
            ui.ok("Filed %s" % mc.pretty_path(final))
        self.tdarr_unseen(unseen)
        self.save()
        ui.result(action="file", ok=not unknown, media=self.kind, filed=filed, replaced=replaced, discarded=discarded,
                  shrinking=staged, unknown=unknown, told=servers.sent)
        return not unknown

    def move_sidecars(self, src, final):
        """Subtitles that came with a download keep its name, with their language: Movie.en.srt."""
        for s in sorted(src.parent.glob(glob_escape(src.stem) + "*")):
            if s.suffix.lower() in mc.SUB_EXT and s.is_file():
                tail = s.name[len(src.stem):]
                mc.move_file(s, mc.unique_path(final.with_name(final.stem + tail)))
        subs = src.parent / "Subs"
        if subs.is_dir():
            for s in sorted(subs.rglob("*")):
                if s.suffix.lower() in mc.SUB_EXT:
                    lang = re.sub(r"^\d+_", "", s.stem)
                    mc.move_file(s, mc.unique_path(final.with_name("%s.%s%s" % (final.stem, safe_lang(lang), s.suffix))))

    def collect_staged(self, td, servers):
        filed = []
        for stage, rec in list(self.state.get("pending", {}).items()):
            sp = Path(stage)
            if not sp.exists():
                self.state["pending"].pop(stage)
                continue
            verdict = td.status(self.tdarr_path(sp)) if td else None
            rel = sp.relative_to(self.lib)
            out_dir = self.lib / OUTPUT_DIR / rel.parent
            outs = [p for p in out_dir.glob(glob_escape(sp.stem) + ".*")] if out_dir.is_dir() else []
            if verdict in mc.Tdarr.FAILED or verdict in mc.Tdarr.SKIPPED:
                outs = [sp]  # Tdarr couldn't (or needn't) shrink it: file it as it is
            if not outs and verdict is None and td and time.time() - float(rec.get("since") or 0) >= REHAND_AFTER:
                # Tdarr has no record of it: handed again; after a few tries, filed as it is, so a new
                # film doesn't stay hidden in the staging folder (Shrink can take it later).
                lib_id = self.tdarr_library()
                if lib_id and int(rec.get("tries") or 1) < HAND_TRIES:
                    td.queue(lib_id, [self.tdarr_path(sp)])
                    rec.update(since=time.time(), tries=int(rec.get("tries") or 1) + 1)
                    self.save()
                    continue
                ui.warn("Tdarr never took %s: filed as it is" % sp.name)
                outs = [sp]
            if not outs:
                continue
            out = outs[0]
            if out != sp:
                try:
                    new, old = self.probe(out), self.probe(sp)
                    if not mc.same_length(new["duration"], old["duration"]) or new["size"] >= old["size"]:
                        mc.trash(out)
                        out = sp
                except RuntimeError:
                    mc.trash(out)
                    out = sp
            dest = Path(rec["dest"])
            for e in rec.get("replaces") or []:
                mc.trash(e)
            final = mc.unique_path(dest.with_suffix(out.suffix.lower()))
            mc.move_file(out, final)
            if out != sp:
                mc.trash(sp)
            mc.sync_subtitles(final)
            servers.ping(final, self.kind)
            self.state["pending"].pop(stage)
            self.note("filed", path=str(final), shrunk=out != sp)
            filed.append(str(final))
            ui.ok("Filed %s" % mc.pretty_path(final))
        return filed

    # ------------------------------------------------------------------ status
    def status(self, as_json):
        lib = mc.expand(mc.cfg(self.section, "library"))
        st = mc.load_state(self.kind, {"files": {}, "pending": {}, "freed": 0, "history": []})
        counts = {}
        for r in st["files"].values():
            counts[r.get("status")] = counts.get(r.get("status"), 0) + 1
        td = self.tdarr()
        info = {"kind": self.kind, "library": str(lib) if lib else None, "found": bool(lib and lib.is_dir()),
                "counts": counts, "pending": len(st.get("pending") or {}), "freed": st.get("freed", 0),
                "tdarr": {"url": td.url if td else None, "library": self.tdarr_library() or None,
                          "up": bool(td and td.ok())},
                "history": (st.get("history") or [])[-20:]}
        if as_json or ui.events:
            print(__import__("json").dumps(info))
            return
        ui.title("%s library" % self.kind.title(), "status")
        ui.kv("Library", lib or "not set")
        for k, v in sorted(counts.items()):
            ui.kv(k or "?", mc.fmt_n(v))
        ui.kv("Freed so far", human(info["freed"]))
        ui.kv("Tdarr", ("%s (up)" if info["tdarr"]["up"] else "%s (not answering)") % info["tdarr"]["url"]
              if td else "not set up")


def estimate_saving(facts, size, target):
    """What a transcode usually saves: H.264 to HEVC about half, to AV1 about 60%; lossless audio
    and extra tracks a little more."""
    share = 0.0
    rank = mc.VIDEO_RANK.get(facts["video_codec"], 0)
    if rank < mc.VIDEO_RANK.get(target, 3):
        share = 0.6 if target == "av1" else 0.5
        if rank <= 1:
            share += 0.1
    if any(c in mc.LOSSLESS_AUDIO or c in ("pcm", "dts-hd ma") for c in facts["audio_codecs"]):
        share += 0.1
    if len(facts["audio_codecs"]) > 1:
        share += 0.03
    return int(size * min(share, 0.75))


def minutes(seconds):
    return "%d min" % round((seconds or 0) / 60)


def _facts(rec):
    """A scan's record of a video, as media_facts gives it."""
    return {"duration": rec.get("duration") or 0, "height": rec.get("height") or 0,
            "video_codec": rec.get("codec") or "", "size": rec.get("size") or 0}


def _path_key(p):
    import unicodedata
    s = unicodedata.normalize("NFC", str(p).replace("\\", "/").rstrip("/"))
    return s.casefold() if mc.IS_WINDOWS else s


def nfo_genres(path):
    """The genres an .nfo lists, in order; a Kodi-style "Action / Adventure" is two."""
    import xml.etree.ElementTree as ET
    try:
        root = ET.parse(str(path)).getroot()
    except (ET.ParseError, OSError):
        return []
    out = []
    for g in root.findall("genre"):
        for part in re.split(r"\s*/\s*", (g.text or "").strip()):
            if part and part not in out:
                out.append(part)
    return out


def human(n):
    n = float(n or 0)
    for unit in ("bytes", "KB", "MB", "GB", "TB"):
        if abs(n) < 1000 or unit == "TB":
            return ("%d %s" % (n, unit)) if unit == "bytes" else ("%.1f %s" % (n, unit))
        n /= 1000.0


def glob_escape(s):
    return re.sub(r"([\[\]*?])", r"[\1]", s)


def safe_lang(s):
    s = re.sub(r"[^A-Za-z]", "", s).lower()
    return {"english": "en", "spanish": "es", "french": "fr", "german": "de", "italian": "it", "japanese": "ja",
            "portuguese": "pt", "russian": "ru", "chinese": "zh", "korean": "ko"}.get(s, s[:3] or "und")


# ------------------------------------------------------------------ release names
JUNK_RE = re.compile(r"(?i)[\s.\-_\[(]+(?:(?:19|20)\d{2}[\s.\-_\])]+)?(?:2160p|1080p|720p|576p|480p|4k|uhd|hdr10?\+?|dv|"
                     r"dolby[\s.]?vision|bluray|blu-ray|bdrip|brrip|web[\s.\-]?dl|webrip|web|hdtv|dvdrip|remux|x26[45]|"
                     r"h\.?26[45]|hevc|avc|av1|aac\d?(?:\.\d)?|ac3|eac3|ddp?\d?(?:\.\d)?|dts(?:-hd)?|truehd|atmos|"
                     r"10bit|8bit|proper|repack|extended|unrated|imax|multi|subbed|dubbed|hybrid|amzn|nf|dsnp|hmax|atvp)\b.*$")


def tidy_title(s):
    s = re.sub(r"^\[[^\]]*\]\s*", "", s)  # [Group] at the front
    s = re.sub(r"[._]+", " ", s)
    s = re.sub(r"\s*[\[(][^\])]*[\])]\s*$", "", s).strip()
    s = re.sub(r"\s+-\s*$", "", s)
    s = re.sub(r"\s+", " ", s).strip(" -([")
    if s and (s.islower() or s.isupper()):
        small = {"a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "by", "vs"}
        words = s.lower().split(" ")
        s = " ".join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words))
    return s
