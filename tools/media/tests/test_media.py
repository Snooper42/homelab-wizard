"""Tidy Up's Python engines, with every outside program stubbed: no ffmpeg, ffprobe, Docker, Tdarr,
media server, LRCLIB or Calibre is run, and no real library is touched (everything is in a temporary
folder). Run with: python3 -m unittest discover -s tools/media/tests"""
import ast
import hashlib
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

import media_common as mc  # noqa: E402
import video_engine as ve  # noqa: E402
import movies_organizer  # noqa: E402
import tv_organizer  # noqa: E402
import audiobook_organizer  # noqa: E402
import scrubber  # noqa: E402
import inbox  # noqa: E402
import music_tidy  # noqa: E402
import books_tidy  # noqa: E402
import trash_restore  # noqa: E402

# The two vendored engines are the owner's, unchanged: any edit shows here first.
# The owner's two organizers, as they gave them, with the two Windows fixes they agreed to on
# Nov 3, 2026 (pausing the apps under Docker Desktop, beets on this machine), and N28's pinned beets
# setup they approved on Nov 6 (Python 3.10 or newer, requirements/): change them only so.
VENDORED = {
    "music_organizer.py": "c472548f14921dfa1b51b0335e7447359a64a090ac0313f11bda86316cabc195",
    "books_organizer.py": "6ca72b3a2a411b7099305a3dcfd4e219190718484bc75643536d01292ef6a79e",
}


def facts_info(codec="h264", audio=("aac",), langs=("eng",), subs=(), duration=3600.0, size=4_000_000_000,
               height=1080, audio_bitrate=None, tags=None, chapters=0, art=0):
    streams = [{"codec_type": "video", "codec_name": codec, "width": 1920, "height": height}] if codec else []
    for c, l in zip(audio, list(langs) + ["eng"] * len(audio)):
        s = {"codec_type": "audio", "codec_name": c, "tags": {"language": l}}
        if audio_bitrate:
            s["bit_rate"] = str(audio_bitrate)
        streams.append(s)
    streams += [{"codec_type": "subtitle", "codec_name": "subrip", "tags": {"language": l}} for l in subs]
    streams += [{"codec_type": "video", "codec_name": "mjpeg", "disposition": {"attached_pic": 1}}] * art
    return {"streams": streams, "chapters": [{}] * chapters,
            "format": {"duration": str(duration), "size": str(size), "bit_rate": "8000000", "tags": tags or {}}}


class Base(unittest.TestCase):
    """A temporary home with a settings file, the Trash recorded instead of used, quiet output."""

    def setUp(self):
        # The real path, as the engines see it: a Mac's temp folder is /var behind /private/var,
        # and Windows' can be a short name (RUNNER~1).
        self.tmp = Path(os.path.realpath(tempfile.mkdtemp(prefix="tidy-test-")))
        self.home = self.tmp / "home"
        self.home.mkdir()
        self.env = mock.patch.dict(os.environ, {"HOME": str(self.home), "USERPROFILE": str(self.home),
                                                "XDG_DATA_HOME": str(self.home / ".local" / "share"),
                                                "HOMELAB_MEDIA_ALLOW_BATTERY": "1",
                                                "JELLYFIN_API_KEY": "jf-key"})
        self.env.start()
        self.out = io.StringIO()
        self.stdout = mock.patch.object(sys, "stdout", self.out)
        self.stdout.start()
        mc.ui.use_events()  # results come as JSON lines, as the app reads them
        self.lib = {k: self.tmp / "Hobbies" / k for k in ("music", "movies", "tv", "audiobooks", "books")}
        for p in self.lib.values():
            p.mkdir(parents=True)
        self.settings = {
            "reports_dir": str(self.tmp / "reports"),
            "music": {"library": str(self.lib["music"])},
            "movies": {"library": str(self.lib["movies"])},
            "tv": {"library": str(self.lib["tv"])},
            "audiobooks": {"library": str(self.lib["audiobooks"]), "bitrate": "64k"},
            "books": {"library": str(self.lib["books"])},
            "video": {"keep_languages": ["eng"]},
            "tdarr": {"url": "http://tdarr:8265", "codec": "hevc", "libraries": {"movies": "LIBM", "tv": "LIBT"},
                      "path_map": [[str(self.lib["movies"]), "/media/movies"], [str(self.lib["tv"]), "/media/tv"]]},
            "servers": {"jellyfin": {"url": "http://jf:8096", "kinds": ["movies", "tv"],
                                     "path_map": [[str(self.tmp / "Hobbies"), "/media"]]}},
            "inbox": {"folders": [str(self.tmp / "Downloads")], "settle_minutes": 5},
        }
        (self.tmp / "Downloads").mkdir()
        self.cfg_path = self.tmp / "homelab_media.json"
        self.cfg_path.write_text(json.dumps(self.settings))
        mc.load_settings(str(self.cfg_path))
        self.trashed = []
        self.trash_dir = self.tmp / "Trash"
        self.trash_dir.mkdir()

        def fake_trash(p, dry_run=False):
            p = Path(p)
            if not p.exists() or dry_run:
                return None
            self.trashed.append(str(p))
            dest = self.trash_dir / ("%d-%s" % (len(self.trashed), p.name))
            shutil.move(str(p), str(dest))
            return dest

        self.trash = mock.patch.object(mc, "trash", side_effect=fake_trash)
        self.trash.start()
        self.http = mock.patch.object(mc, "http_json", return_value={})
        self.http_mock = self.http.start()

    def tearDown(self):
        mock.patch.stopall()
        mc.ui.events = False
        self.env.stop()
        shutil.rmtree(str(self.tmp), ignore_errors=True)
        mc.mo.CFG = json.loads(json.dumps(mc.mo.DEFAULT_CONFIG))

    def touch(self, path, size=10, age=0):
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"x" * size)
        if age:
            t = time.time() - age
            os.utime(str(p), (t, t))
            for d in p.parents:  # a finished download's folders stopped changing too
                if d == self.tmp:
                    break
                os.utime(str(d), (t, t))
        return p

    def results(self):
        return [json.loads(l) for l in self.out.getvalue().splitlines() if l.startswith("{") and '"result"' in l]


class Vendored(unittest.TestCase):
    def test_vendored_engines_are_unchanged(self):
        for name, want in VENDORED.items():
            got = hashlib.sha256((HERE / name).read_bytes()).hexdigest()
            self.assertEqual(got, want, "%s changed: it is vendored, wrap it instead" % name)

    def test_fourteen_genres_kept(self):
        self.assertEqual(len(mc.mo.GENRES), 14)
        self.assertEqual(mc.mo.map_genre(["Stoner Rock"]), "Rock & Metal")
        self.assertEqual(mc.mo.map_genre(["Hip Hop/Rap"]), "Hip-Hop & Rap")


class Words(unittest.TestCase):
    # The app's words (app/preview/words.mjs refuses these in web/src): what an engine prints names
    # screens as the app does, so a household never reads "Choose stacks" for Choose apps.
    JARGON = re.compile(r"\b(stacks?|baseline)\b", re.I)

    def test_the_engines_say_no_stacks_or_baseline(self):
        said = []
        for path in sorted(HERE.glob("*.py")):
            if path.name in VENDORED:
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            docs = {id(n.body[0].value) for n in ast.walk(tree)
                    if isinstance(n, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
                    and n.body and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant)}
            for n in ast.walk(tree):  # what an engine can print: its strings, not its comments or docstrings
                if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docs \
                        and self.JARGON.search(n.value):
                    said.append("%s:%d: %s" % (path.name, n.lineno, n.value))
        self.assertEqual(said, [], "say it as the app does (Choose apps, not stacks)")


class DockerDesktopOnWindows(unittest.TestCase):
    """Docker Desktop names M:\\music /run/desktop/mnt/host/m/music; the organizers pause the apps
    whose folders hold the library, so they have to see the two as one."""

    def test_mount_sources_read_as_drive_letters(self):
        import books_organizer as bo
        for mod in (mc.mo, bo):
            self.assertEqual(mod.unhost("/run/desktop/mnt/host/m/music", windows=True), "M:/music")
            self.assertEqual(mod.unhost("/host_mnt/c/Users/you/Music", windows=True), "C:/Users/you/Music")
            self.assertEqual(mod.unhost("/run/desktop/mnt/host/m", windows=True), "M:/")
            self.assertEqual(mod.unhost("/var/lib/docker/volumes/x", windows=True), "/var/lib/docker/volumes/x")
            self.assertEqual(mod.unhost("/host_mnt/Users/you", windows=False), "/Users/you", "a Mac's, as before")
            self.assertEqual(mod.unhost("/mnt/m/music", windows=False), "/mnt/m/music", "Linux's /mnt is its own")

    def test_a_library_and_its_mount_overlap(self):
        import books_organizer as bo
        for mod in (mc.mo, bo):
            self.assertTrue(mod.overlaps("M:/music", "M:\\Music", windows=True))
            self.assertTrue(mod.overlaps(mod.unhost("/run/desktop/mnt/host/m", windows=True), "M:\\music", windows=True))
            self.assertFalse(mod.overlaps("M:/musical", "M:\\music", windows=True))
            self.assertFalse(mod.overlaps("/Volumes/Music", "/Volumes/music", windows=False), "case counts off Windows")

    def test_beets_runs_on_this_machine_on_windows(self):
        with mock.patch.object(mc.mo.os, "name", "nt"), mock.patch.object(mc.mo, "beets_image", return_value="lscr.io/linuxserver/beets"):
            self.assertEqual(mc.mo.choose_engine("auto"), ("local", ""))
            with mock.patch.object(mc.mo.ui, "warn") as warn:
                self.assertEqual(mc.mo.choose_engine("container"), ("local", ""))
                warn.assert_called_once()
        with mock.patch.object(mc.mo, "beets_image", return_value="lscr.io/linuxserver/beets"), \
                mock.patch.dict(os.environ, {"HOMELAB_MEDIA_IN_CONTAINER": ""}):
            if os.name != "nt":
                self.assertEqual(mc.mo.choose_engine("auto"), ("container", "lscr.io/linuxserver/beets"), "elsewhere, as before")


class Names(unittest.TestCase):
    def test_episodes(self):
        cases = [
            ("The.Office.US.S02E03.1080p.WEB.x264-GRP.mkv", "", "The Office US", 2, [3], False),
            ("Show.Name.S01E01E02.720p.mkv", "", "Show Name", 1, [1, 2], False),
            ("Show - S01E01-E02 - Pilot.mkv", "", "Show", 1, [1, 2], False),
            ("Show.S01E01-E04.mkv", "", "Show", 1, [1, 2, 3, 4], False),
            ("show.1x09-10.mkv", "", "Show", 1, [9, 10], False),
            ("[SubsPlease] One Piece - 1112 (1080p) [ABC123].mkv", "", "One Piece", None, [1112], True),
            ("[Erai] Frieren - 012-013 [1080p].mkv", "", "Frieren", None, [12, 13], True),
            ("S01E05.mkv", "/dl/Breaking.Bad.S01.1080p.BluRay-GRP", "Breaking Bad", 1, [5], False),
            ("E05.S01.mkv", "/dl/Breaking Bad/Season 1", None, None, None, None),
        ]
        for name, folder, show, season, eps, absolute in cases:
            got = tv_organizer.parse_episode(name, folder)
            if show is None and eps is None:
                continue
            self.assertIsNotNone(got, name)
            self.assertEqual((got["show"], got["season"], got["episodes"], got["absolute"]), (show, season, eps, absolute), name)

    def test_episode_tags(self):
        self.assertEqual(tv_organizer.episode_tag({"absolute": False, "season": 1, "episodes": [1, 2]}), "S01E01-E02")
        self.assertEqual(tv_organizer.episode_tag({"absolute": True, "season": None, "episodes": [7]}), "007")
        self.assertEqual(tv_organizer.show_title("Doctor Who 2005"), "Doctor Who (2005)")

    def test_movies(self):
        for name, want in [("The.Matrix.1999.1080p.BluRay.x264-GROUP", ("The Matrix", 1999)),
                           ("Blade Runner 2049 (2017) [2160p]", ("Blade Runner 2049", 2017)),
                           ("2001.A.Space.Odyssey.1968.REMUX", ("2001 A Space Odyssey", 1968)),
                           ("1917.2019.1080p", ("1917", 2019)),
                           ("Some Movie 1080p WEB-DL", ("Some Movie", None))]:
            self.assertEqual(movies_organizer.parse_movie(name), want, name)

    def test_safe_names(self):
        self.assertEqual(mc.safe_name('AC/DC: "Live"?'), "AC DC Live")
        self.assertEqual(mc.safe_name("CON"), "_CON")
        self.assertEqual(mc.safe_name("Title."), "Title")

    def test_windows_device_names_with_an_extension(self):
        # Windows can't make nul.mkv, or a folder named CON.Air (1997): the name before the dot counts.
        self.assertEqual(mc.safe_name("CON.Air (1997)"), "_CON.Air (1997)")
        self.assertEqual(mc.safe_name("nul.mkv"), "_nul.mkv")
        self.assertEqual(mc.safe_name("COM1"), "_COM1")
        self.assertEqual(mc.safe_name("Console"), "Console")
        self.assertEqual(mc.safe_name("Aux Cord (2020)"), "Aux Cord (2020)")

    def test_a_long_name_fits_in_bytes(self):
        # ext4 and APFS take 255 bytes a name; a Japanese letter is three of them.
        title = "千と千尋の神隠し" * 20
        name = mc.safe_name(title)
        self.assertLessEqual(len(name.encode("utf-8")), 180)
        self.assertTrue(title.startswith(name), "cut between letters, never inside one")
        self.assertEqual(mc.safe_name("a" * 179 + " b"), "a" * 179, "no space left at the end")
        self.assertEqual(mc.safe_name("a" * 179 + ".b"), "a" * 179, "nor a dot, which Windows drops")
        self.assertEqual(mc.safe_name("a" * 179 + "e\u0301x"), "a" * 179, "an accent goes with its letter")

    def test_one_spelling_for_accents(self):
        # A Mac writes é as e and an accent; the engines write it as one letter.
        self.assertEqual(mc.safe_name("Ame\u0301lie (2001)"), "Am\u00e9lie (2001)")
        self.assertEqual(mc.name_key("AME\u0301LIE"), mc.name_key("Amélie"))


class MoveFile(Base):
    def test_a_new_spelling_of_the_same_name(self):
        # On a Mac's or Windows' drive heat.mkv and Heat.mkv are one file: the rename still happens.
        a = self.touch(self.tmp / "Hobbies" / "movies" / "heat.mkv")
        b = a.with_name("Heat.mkv")
        self.assertEqual(mc.move_file(a, b), b)
        self.assertEqual([p.name for p in b.parent.iterdir()], ["Heat.mkv"])

    def test_another_file_there_is_never_replaced(self):
        a = self.touch(self.tmp / "a.mkv")
        b = self.touch(self.tmp / "b.mkv")
        with self.assertRaises(FileExistsError):
            mc.move_file(a, b)
        self.assertTrue(a.exists())


class Bloat(unittest.TestCase):
    def facts(self, **kw):
        return mc.media_facts(facts_info(**kw))

    def test_reasons(self):
        self.assertEqual(mc.bloat_reasons(self.facts(codec="hevc"), ["eng"]), [])
        r = mc.bloat_reasons(self.facts(codec="h264", audio=("truehd", "ac3"), langs=("eng", "fre"), subs=("eng", "spa", "ger")), ["eng"])
        self.assertEqual(len(r), 4)
        self.assertIn("H264", r[0])
        self.assertIn("lossless", r[1])
        self.assertIn("fre", r[2])
        self.assertIn("2 extra subtitle", r[3])
        self.assertIn("pcm", mc.bloat_reasons(self.facts(codec="hevc", audio=("pcm_s24le",)), ["eng"])[0])

    def test_video_shrink_and_strip(self):
        h264 = self.facts(codec="h264", size=8_000_000_000)
        hevc = self.facts(codec="hevc", size=4_000_000_000)
        av1 = self.facts(codec="av1", size=3_000_000_000)
        self.assertTrue(mc.video_more_efficient(hevc, h264))
        self.assertTrue(mc.video_more_efficient(av1, hevc))
        self.assertFalse(mc.video_more_efficient(h264, hevc))
        self.assertFalse(mc.video_more_efficient(self.facts(codec="hevc", height=720, size=1), hevc), "720p never replaces 1080p")
        self.assertFalse(mc.video_more_efficient(self.facts(codec="av1", duration=60, size=1), hevc), "a sample is not the film")
        self.assertTrue(mc.video_more_efficient(self.facts(codec="hevc", size=3_000_000_000), hevc))

    def test_audio_shrink_and_strip(self):
        flac = self.facts(codec="", audio=("flac",), size=40_000_000, audio_bitrate=1_000_000)
        aac256 = self.facts(codec="", audio=("aac",), size=8_000_000, audio_bitrate=256_000)
        opus160 = self.facts(codec="", audio=("opus",), size=5_000_000, audio_bitrate=160_000)
        mp3128 = self.facts(codec="", audio=("mp3",), size=4_000_000, audio_bitrate=128_000)
        self.assertTrue(mc.audio_more_efficient(aac256, flac))
        self.assertTrue(mc.audio_more_efficient(opus160, flac))
        self.assertFalse(mc.audio_more_efficient(flac, aac256))
        self.assertFalse(mc.audio_more_efficient(mp3128, flac), "a low bitrate never replaces lossless")
        self.assertFalse(mc.audio_more_efficient(mp3128, aac256))


class Trash(Base):
    def test_linux_trash_is_recoverable(self):
        self.trash.stop()
        if mc.IS_MAC or mc.IS_WINDOWS:
            self.skipTest("freedesktop Trash")
        f = self.touch(self.home / "a.mkv")
        g = self.touch(self.home / "sub" / "a.mkv")
        d1 = mc.trash(f)
        d2 = mc.trash(g)
        files = self.home / ".local" / "share" / "Trash" / "files"
        self.assertEqual(d1, files / "a.mkv")
        self.assertEqual(d2.parent, files)
        self.assertNotEqual(d2, d1)
        info = (self.home / ".local" / "share" / "Trash" / "info" / "a.mkv.trashinfo").read_text()
        self.assertIn("Path=", info)
        self.assertFalse(f.exists())
        self.assertIsNone(mc.trash(self.home / "missing"))
        self.trash.start()

    def test_undo_takes_back_only_from_where_things_are_thrown(self):
        film = self.lib["movies"] / "Gone (2001)" / "film.mkv"  # gone, and its folder too
        day = Path(self.tmp.anchor) / ".tidy-trash" / "2026-11-05"
        with mock.patch.object(mc, "IS_WINDOWS", True):  # a USB drive's own trash, a dated folder a day
            self.assertTrue(mc.trashed_from(film, day / "film.mkv"))
            self.assertFalse(mc.trashed_from(film, day / "deeper" / "film.mkv"))
            self.assertFalse(mc.trashed_from(film, self.tmp / "homelab" / "film.mkv"))
        if not mc.IS_WINDOWS and not mc.IS_MAC:  # the freedesktop Trash in this test's home
            files = self.home / ".local" / "share" / "Trash" / "files"
            self.assertTrue(mc.trashed_from(self.home / "film.mkv", files / "film.mkv"))
        self.assertFalse(mc.trashed_from(self.home / "film.mkv", self.home / "film 2.mkv"))
        self.assertFalse(mc.trashed_from("film.mkv", "film 2.mkv"), "a relative path is no one's")

    def test_windows_uses_the_recycle_bin(self):
        f = self.touch(self.tmp / "E" / "film.mkv")
        with mock.patch.object(mc.subprocess, "run") as run:
            run.side_effect = lambda *a, **k: (f.unlink(), mock.Mock(returncode=0, stdout="", stderr=""))[1]
            mc._trash_windows(f)
        cmd, env = run.call_args[0][0], run.call_args[1]["env"]
        self.assertEqual(cmd[0], "powershell.exe")
        self.assertIn("SendToRecycleBin", cmd[-1])
        self.assertEqual(env["TIDY_TRASH"], str(f), "the path travels in the environment, not the command")

    def test_windows_drives_without_a_recycle_bin_keep_what_goes(self):
        # A USB stick or a network share has no Recycle Bin: Explorer's call would delete for
        # good there, so it goes to a hidden .tidy-trash on the same drive instead.
        self.trash.stop()
        drive = self.tmp / "M"
        f = self.touch(drive / "Movies" / "Heat (1995)" / "Heat (1995).en.srt")
        g = self.touch(drive / "Movies" / "Alien (1979)" / "Heat (1995).en.srt")
        for kind in (mc.DRIVE_REMOVABLE, mc.DRIVE_REMOTE):
            with mock.patch.object(mc, "IS_WINDOWS", True), mock.patch.object(mc, "_drive_root", return_value=drive), \
                    mock.patch.object(mc, "_windows_drive_kind", return_value=kind), \
                    mock.patch.object(mc, "_trash_windows") as bin_:
                d = mc.trash(f if kind == mc.DRIVE_REMOVABLE else g)
            bin_.assert_not_called()
            self.assertEqual(d.parent.parent, drive / ".tidy-trash")
            self.assertTrue(d.exists(), "kept, not deleted")
        self.assertFalse(f.exists() or g.exists())
        self.assertEqual(len(list((drive / ".tidy-trash").rglob("*.srt"))), 2, "two files of one name both kept")
        self.assertIn(".tidy-trash", mc.WORK_DIRS, "never scanned or swept itself")
        self.trash.start()

    def test_windows_fixed_drives_use_the_recycle_bin(self):
        self.trash.stop()
        f = self.touch(self.tmp / "D" / "film.mkv")
        with mock.patch.object(mc, "IS_WINDOWS", True), mock.patch.object(mc, "_windows_drive_kind", return_value=3), \
                mock.patch.object(mc, "_trash_windows", return_value=Path("C:/$Recycle.Bin")) as bin_:
            mc.trash(f)
        bin_.assert_called_once_with(f)
        self.trash.start()

    def test_remove_empty_dirs(self):
        root = self.tmp / "r"
        self.touch(root / "a" / "b" / ".DS_Store")
        self.touch(root / "keep" / "x.mkv")
        (root / "c").mkdir()
        gone = mc.remove_empty_dirs(root)
        self.assertFalse((root / "a").exists())
        self.assertFalse((root / "c").exists())
        self.assertTrue((root / "keep").exists())
        self.assertTrue(root.exists())
        self.assertEqual(len(gone), 3)


class ParsersHaveATimeout(Base):
    """The Inbox's beets call decodes and fingerprints a download someone else made, under Tidy Up's lock: one
    that hangs on a crafted file must not hold Tidy Up for good. (books_organizer.py's sips and calibredb calls
    have none either, but it is vendored: item 148 leaves them.)"""

    def test_the_inbox_beets_call_has_a_timeout(self):
        seen = []

        def fake(cmd, *a, **k):
            seen.append(k)
            return mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(music_tidy.subprocess, "run", side_effect=fake):
            music_tidy.Beet(self.tmp)("import", str(self.tmp))
        self.assertTrue(seen and seen[0].get("timeout"), "beet runs with no timeout")

        def hang(cmd, *a, **k):
            raise music_tidy.subprocess.TimeoutExpired(cmd, k.get("timeout"))
        with mock.patch.object(music_tidy.subprocess, "run", side_effect=hang):
            with self.assertRaises(RuntimeError) as e:
                music_tidy.Beet(self.tmp)("import", str(self.tmp))
        self.assertIn("longer than an hour", str(e.exception), "said plainly, as the Inbox's other failures are")


class SavedRecords(Base):
    """A record two jobs can write at once (a film scan, unlocked, and Collect, locked, both keep movies.json):
    each save goes through a temporary file of its own, so one can't rename the other's half-written file
    into place, which the next read would find damaged and start again (pending Tdarr work forgotten)."""

    def test_a_save_leaves_another_writers_temporary_file_alone(self):
        home = Path(os.path.expanduser("~")) / ".homelab-media"
        with mock.patch.object(mc.mo, "state_dir", return_value=home):
            home.mkdir(parents=True, exist_ok=True)
            theirs = home / "movies.tmp"
            theirs.write_text('{"files": {"half')  # another job, mid-write
            mc.save_state("movies", {"files": {}, "pending": {"/x": 1}})
            self.assertEqual(theirs.read_text(), '{"files": {"half', "the other job's file untouched")
            self.assertEqual(mc.load_state("movies")["pending"], {"/x": 1}, "this save whole")
            self.assertEqual(sorted(p.name for p in home.iterdir()), ["movies.json", "movies.tmp"], "no leftovers")


class Which(Base):
    def test_what_install_fetched_is_found_after_path(self):
        name = "ffprobe-fetched-test"  # on no PATH
        self.assertIsNone(mc.which(name))
        bin_dir = self.home / ".homelab-media" / "bin"
        bin_dir.mkdir(parents=True)
        tool = bin_dir / (name + (".exe" if mc.IS_WINDOWS else ""))
        tool.write_text("")
        tool.chmod(0o755)
        self.assertEqual(mc.which(name), str(tool))


class Scrubber(Base):
    def test_orphans(self):
        m, t, mu, b = self.lib["movies"], self.lib["tv"], self.lib["music"], self.lib["books"]
        keep = [self.touch(m / "A (2000)" / "A (2000).mkv"), self.touch(m / "A (2000)" / "poster.jpg"),
                self.touch(m / "A (2000)" / "A (2000).en.forced.srt"), self.touch(m / "A (2000)" / "A (2000)-fanart.jpg"),
                self.touch(m / "B (2003)" / "B (2003).mp4"), self.touch(m / "B (2003)" / "folder.jpg"),
                self.touch(t / "Show" / "tvshow.nfo"), self.touch(t / "Show" / "poster.jpg"),
                self.touch(t / "Show" / "Season 01" / "Show - S01E01.mkv"),
                self.touch(mu / "Artist" / "Album" / "01 Song.mp3"), self.touch(mu / "Artist" / "Album" / "cover.jpg"),
                self.touch(mu / "Artist" / "Album" / "Booklet 01.jpg"),
                self.touch(b / "metadata.db"), self.touch(b / "Author" / "Gone (1)" / "cover.jpg"),
                self.touch(m / ".tdarr-output" / "x.nfo")]
        gone = [self.touch(m / "A (2000)" / "Old Cut (1999).srt"), self.touch(m / "Gone (2001)" / "poster.jpg"),
                self.touch(m / "Gone (2001)" / "movie.nfo"), self.touch(m / "Gone (2001)" / "Subs" / "eng.srt"),
                self.touch(t / "Show" / "Season 01" / "Show - S01E02.en.srt"),
                self.touch(t / "Show" / "Season 01" / "Show - S01E02-thumb.jpg"),
                self.touch(mu / "Old" / "Album" / "cover.jpg"), self.touch(mu / "Artist" / "Album" / "02 Gone.lrc")]
        scrubber.scrub(scrubber.roots_from_settings(), apply=False)
        res = self.results()[-1]
        self.assertEqual(sorted(res["sample"]), sorted(str(p) for p in gone))
        self.assertEqual(self.trashed, [])
        scrubber.scrub(scrubber.roots_from_settings(), apply=True)
        self.assertEqual(sorted(self.trashed), sorted(str(p) for p in gone))
        for p in keep:
            self.assertTrue(p.exists(), p)
        self.assertFalse((m / "Gone (2001)").exists(), "its empty folder goes too")
        self.assertFalse((mu / "Old").exists())
        self.assertTrue((b / "Author" / "Gone (1)").exists(), "Calibre's folders are Calibre's")


    def test_a_films_own_subtitles_stay(self):
        # Subs/2_English.srt beside its film, and a subtitle in other capitals (made on Windows): the film's.
        m = self.lib["movies"]
        self.touch(m / "A (2000)" / "A (2000).mkv")
        keep = [self.touch(m / "A (2000)" / "Subs" / "2_English.srt"), self.touch(m / "A (2000)" / "a (2000).EN.srt"),
                self.touch(m / "A (2000)" / "SUBS" / "3_French.srt")]
        scrubber.scrub(scrubber.roots_from_settings(), apply=True)
        self.assertEqual(self.trashed, [])
        for p in keep:
            self.assertTrue(p.exists(), p)


class VideoGenres(Base):
    """How many films and shows are in each genre: Jellyfin's when it answers, else the .nfo files'."""

    def nfo(self, path, root, *genres):
        self.touch(path)
        Path(path).write_text("<?xml version='1.0'?><%s><title>x</title>%s</%s>" % (root, "".join("<genre>%s</genre>" % g for g in genres), root))

    def test_films_from_their_nfo_files(self):
        m = self.lib["movies"]
        self.touch(m / "Heat (1995)" / "Heat (1995).mkv")
        self.nfo(m / "Heat (1995)" / "movie.nfo", "movie", "Crime", "Thriller")
        self.touch(m / "Up (2009)" / "Up (2009).mp4")
        self.nfo(m / "Up (2009)" / "Up (2009).nfo", "movie", "Animation / Family")  # Kodi's way: two in one
        self.touch(m / "Alien (1979).mkv")  # loose in the library
        self.nfo(m / "Alien (1979).nfo", "movie", "Horror")
        self.touch(m / "Unknown (2020)" / "Unknown (2020).mkv")  # no .nfo
        self.touch(m / "Empty folder" / "poster.jpg")  # no film: not counted
        self.touch(m / ".tdarr-output" / "x.mkv")
        self.http_mock.return_value = {}
        self.assertTrue(movies_organizer.Movies().genre_counts())
        res = self.results()[-1]
        self.assertEqual(res["genres"], {"Animation": 1, "Crime": 1, "Horror": 1})
        self.assertEqual((res["items"], res["unplaced"], res["source"]), (4, 1, "the .nfo files"))

    def test_jellyfin_first_then_the_nfo(self):
        m = self.lib["movies"]
        self.touch(m / "Heat (1995)" / "Heat (1995).mkv")
        self.nfo(m / "Heat (1995)" / "movie.nfo", "movie", "Crime")
        self.touch(m / "Up (2009)" / "Up (2009).mkv")
        with mock.patch.dict(os.environ, {"JELLYFIN_API_KEY": "k"}):
            self.http_mock.return_value = {"Items": [
                {"Path": "/media/movies/Heat (1995)/Heat (1995).mkv", "Genres": ["Action", "Crime"]},
                {"Path": "/media/movies/Elsewhere/Other.mkv", "Genres": ["Drama"]}]}
            movies_organizer.Movies().genre_counts()
        res = self.results()[-1]
        self.assertEqual(res["genres"], {"Action": 1}, "Jellyfin's genre wins; a film it doesn't know has none here")
        self.assertEqual((res["unplaced"], res["source"]), (1, "Jellyfin"))
        self.assertIn("IncludeItemTypes=Movie", self.http_mock.call_args[0][1])

    def test_jellyfin_not_answering_falls_back_to_the_nfo(self):
        m = self.lib["movies"]
        self.touch(m / "Heat (1995)" / "Heat (1995).mkv")
        self.nfo(m / "Heat (1995)" / "movie.nfo", "movie", "Crime")
        self.http_mock.side_effect = RuntimeError("connection refused")
        with mock.patch.dict(os.environ, {"JELLYFIN_API_KEY": "k"}):
            movies_organizer.Movies().genre_counts()
        self.assertEqual(self.results()[-1]["genres"], {"Crime": 1})

    def test_nothing_to_read_a_genre_from_says_why(self):
        m = self.lib["movies"]
        self.touch(m / "Heat (1995)" / "Heat (1995).mkv")
        self.touch(m / "Up (2009)" / "Up (2009).mkv")
        with mock.patch.dict(os.environ, {"JELLYFIN_API_KEY": ""}):
            movies_organizer.Movies().genre_counts()
        res = self.results()[-1]
        self.assertEqual((res["genres"], res["items"]), ({}, 2))
        self.assertIn("Jellyfin's API key isn't set", res["why"])
        self.assertIn("Dashboard › API Keys", res["why"])
        out = self.out.getvalue()
        self.assertIn("No genres for your films", out)
        self.assertNotIn("from nowhere yet", out, "not a cheerful 0 in 0 genres")
        # With the key, Jellyfin answering with nothing for them: said so.
        self.http_mock.return_value = {"Items": []}
        with mock.patch.dict(os.environ, {"JELLYFIN_API_KEY": "k"}):
            movies_organizer.Movies().genre_counts()
        self.assertIn("Jellyfin has no genres for them", self.results()[-1]["why"])

    def test_shows_from_tvshow_nfo(self):
        t = self.lib["tv"]
        self.touch(t / "The Office (US)" / "Season 01" / "The Office (US) - S01E01.mkv")
        self.nfo(t / "The Office (US)" / "tvshow.nfo", "tvshow", "Comedy")
        self.touch(t / "Frieren" / "Frieren - 001.mkv")
        self.nfo(t / "Frieren" / "tvshow.nfo", "tvshow", "Animation", "Fantasy")
        (t / "Broken").mkdir()
        (t / "Broken" / "tvshow.nfo").write_text("<tvshow><genre>Drama")  # cut short: no genre, no crash
        self.touch(t / "Broken" / "Broken - S01E01.mkv")
        tv_organizer.TV().genre_counts()
        res = self.results()[-1]
        self.assertEqual(res["genres"], {"Animation": 1, "Comedy": 1})
        self.assertEqual((res["items"], res["unplaced"]), (3, 1))


class BookGenres(Base):
    def test_each_books_first_tag_from_calibre(self):
        db = self.lib["books"] / "metadata.db"
        con = sqlite3.connect(str(db))
        con.executescript("""
            CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT);
            CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER);
            INSERT INTO books VALUES (1, 'Dune'), (2, 'Emma'), (3, 'Untitled'), (4, 'Foundation');
            INSERT INTO tags VALUES (1, 'Science Fiction'), (2, 'Classics'), (3, 'Romance');
            INSERT INTO books_tags_link VALUES (1, 1, 1), (2, 2, 2), (3, 2, 3), (4, 4, 1);
        """)
        con.commit()
        con.close()
        before = db.read_bytes()
        mc.ui.events = True
        self.assertTrue(books_tidy.genre_counts())
        res = self.results()[-1]
        self.assertEqual(res["genres"], {"Science Fiction": 2, "Classics": 1})
        self.assertEqual((res["items"], res["unplaced"]), (4, 1))
        self.assertEqual(db.read_bytes(), before, "Calibre's database is only read")

    def test_not_a_calibre_library(self):
        with self.assertRaises(SystemExit):
            books_tidy.genre_counts()


class Duplicates(Base):
    """The same film or episode twice: the scan finds it, dedupe puts the extra copy in the Trash."""

    def setUp(self):
        super().setUp()
        self.probe = FakeProbe({})
        mock.patch.object(mc, "ffprobe", side_effect=self.probe).start()
        mock.patch.object(mc.mo, "YES", True).start()

    def films(self):
        m = self.lib["movies"]
        self.probe.table = {
            "Heat (1995).mkv": facts_info(codec="hevc", height=1080, duration=10200),
            "x264": facts_info(codec="h264", height=1080, duration=10230),
            "Director": facts_info(codec="h264", height=1080, duration=10200),
            "Extended": facts_info(codec="hevc", height=1080, duration=12000),
            "Ronin (1998).mkv": facts_info(codec="hevc", height=720, duration=7300),
            "2160p": facts_info(codec="h264", height=2160, duration=7300),
            "Up (2009)": facts_info(codec="hevc", height=1080, duration=5800)}
        return {
            "heat": self.touch(m / "Heat (1995)" / "Heat (1995).mkv", size=3000),
            "heat264": self.touch(m / "Heat (1995)" / "Heat.1995.1080p.BluRay.x264.mkv", size=9000),
            "cut": self.touch(m / "Heat (1995)" / "Heat (1995) - Director's Cut.mkv", size=9000),
            "extended": self.touch(m / "Heat.1995.Extended" / "Heat.1995.Extended.mkv", size=5000),
            "ronin720": self.touch(m / "Ronin (1998)" / "Ronin (1998).mkv", size=4000),
            "ronin4k": self.touch(m / "Ronin (1998)" / "Ronin.1998.2160p.mkv", size=20000),
            "up": self.touch(m / "Up (2009)" / "Up (2009).mkv", size=2000)}

    def test_the_scan_finds_each_film_twice_and_keeps_the_best_picture(self):
        f = self.films()
        movies_organizer.Movies().scan()
        res = self.results()[-1]
        self.assertEqual(res["duplicates"], 2)
        self.assertEqual(res["duplicate_bytes"], 9000 + 4000)
        got = {Path(d["keep"]).name: [Path(x).name for x in d["extra"]] for d in res["duplicate_list"]}
        self.assertEqual(got, {"Heat (1995).mkv": ["Heat.1995.1080p.BluRay.x264.mkv"],
                               "Ronin.1998.2160p.mkv": ["Ronin (1998).mkv"]},
                         "the leaner HEVC at the same height; the taller copy over the leaner; never another cut or a version kept on purpose")
        self.assertEqual(self.trashed, [], "a scan changes nothing")
        self.assertTrue(all(p.exists() for p in f.values()))

    def test_dedupe_trashes_the_extra_copies_only(self):
        f = self.films()
        movies_organizer.Movies().scan()
        self.assertTrue(movies_organizer.Movies().dedupe())
        self.assertEqual(sorted(self.trashed), sorted([str(f["heat264"]), str(f["ronin720"])]))
        res = self.results()[-1]
        self.assertEqual((res["removed"], res["freed"]), (2, 13000))
        for k in ("heat", "cut", "extended", "ronin4k", "up"):
            self.assertTrue(f[k].exists(), k)
        self.assertEqual(mc.load_state("movies")["freed"], 13000)

    def test_a_copy_changed_since_the_scan_is_kept(self):
        f = self.films()
        movies_organizer.Movies().scan()
        f["heat264"].write_bytes(b"x" * 9500)  # re-downloaded, say
        movies_organizer.Movies().dedupe()
        self.assertEqual(self.trashed, [str(f["ronin720"])])
        self.assertTrue(f["heat264"].exists())

    def test_a_kept_copy_that_no_longer_reads_keeps_its_copies(self):
        f = self.films()
        movies_organizer.Movies().scan()
        del self.probe.table["2160p"]
        self.assertFalse(movies_organizer.Movies().dedupe())
        self.assertNotIn(str(f["ronin720"]), self.trashed)

    def test_an_episode_twice(self):
        t = self.lib["tv"]
        self.probe.table = {"S01E01.720p": facts_info(codec="h264", height=720, duration=1500),
                            "S01E01": facts_info(codec="hevc", height=1080, duration=1500),
                            "S01E02": facts_info(codec="hevc", height=1080, duration=1500)}
        keep = self.touch(t / "The Office (US)" / "Season 01" / "The Office (US) - S01E01.mkv", size=1000)
        extra = self.touch(t / "The Office (US)" / "Season 01" / "The.Office.US.S01E01.720p.mkv", size=800)
        other = self.touch(t / "The Office (US)" / "Season 01" / "The Office (US) - S01E02.mkv", size=1000)
        tv_organizer.TV().scan()
        self.assertEqual(self.results()[-1]["duplicates"], 1)
        tv_organizer.TV().dedupe()
        self.assertEqual(self.trashed, [str(extra)])
        self.assertTrue(keep.exists() and other.exists())

    def test_nothing_twice(self):
        self.films()
        for k in ("Heat.1995.1080p.BluRay.x264.mkv",):
            (self.lib["movies"] / "Heat (1995)" / k).unlink()
        (self.lib["movies"] / "Ronin (1998)" / "Ronin (1998).mkv").unlink()
        movies_organizer.Movies().scan()
        self.assertEqual(self.results()[-1]["duplicates"], 0)
        self.assertTrue(movies_organizer.Movies().dedupe())
        self.assertEqual(self.results()[-1]["removed"], 0)


class MissingEpisodes(Base):
    def test_gaps_in_a_seasons_numbering(self):
        mock.patch.object(mc, "ffprobe", return_value=facts_info(codec="hevc")).start()
        t = self.lib["tv"]
        for name in ("The Office (US) - S02E01.mkv", "The Office (US) - S02E02.mkv", "The Office (US) - S02E05-E06.mkv"):
            self.touch(t / "The Office (US)" / "Season 02" / name)
        self.touch(t / "The Office (US)" / "Season 00" / "The Office (US) - S00E07.mkv")  # specials: never counted
        self.touch(t / "Frieren" / "Frieren - 001.mkv")
        self.touch(t / "Frieren" / "Frieren - 003.mkv")
        self.touch(t / "Whole" / "Season 01" / "Whole - S01E01.mkv")
        self.touch(t / "Whole" / "Season 01" / "Whole - S01E02.mkv")
        tv_organizer.TV().scan()
        res = self.results()[-1]
        self.assertEqual(res["missing"], 3)
        self.assertEqual(res["missing_list"], [{"show": "Frieren", "season": None, "episodes": [2]},
                                               {"show": "The Office (US)", "season": 2, "episodes": [3, 4]}])


class Posters(Base):
    """What Jellyfin shows with no poster, in this library only; Fetch posters asks it to look again."""

    ITEMS = {"Items": [
        {"Id": "a1", "Name": "Heat", "Path": "/media/movies/Heat (1995)/Heat (1995).mkv", "ImageTags": {"Primary": "x"}},
        {"Id": "b2", "Name": "Ronin", "Path": "/media/movies/Ronin (1998)/Ronin (1998).mkv", "ImageTags": {}},
        {"Id": "c3", "Name": "Alien", "Path": "/media/movies/Alien (1979).mkv"},
        {"Id": "d4", "Name": "Home video", "Path": "/media/home/Birthday.mkv"}]}  # another library

    def test_the_scan_counts_films_without_a_poster(self):
        mock.patch.object(mc, "ffprobe", return_value=facts_info(codec="hevc")).start()
        self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        self.http_mock.return_value = self.ITEMS
        movies_organizer.Movies().scan()
        res = self.results()[-1]
        self.assertEqual((res["posterless"], res["posterless_list"]), (2, ["Alien", "Ronin"]))

    def test_fetch_asks_jellyfin_for_those_alone_and_replaces_nothing(self):
        self.http_mock.return_value = self.ITEMS
        self.assertTrue(movies_organizer.Movies().posters())
        posts = [c[0][1] for c in self.http_mock.call_args_list if c[0][0] == "POST"]
        self.assertEqual(len(posts), 2)
        self.assertTrue(posts[0].startswith("http://jf:8096/Items/c3/Refresh?") and "replaceAllImages=false" in posts[0], posts[0])
        self.assertIn("/Items/b2/Refresh?", posts[1])
        self.assertEqual(self.results()[-1]["asked"], 2)

    def test_without_jellyfin_the_scan_says_nothing_of_posters(self):
        mock.patch.object(mc, "ffprobe", return_value=facts_info(codec="hevc")).start()
        with mock.patch.dict(os.environ, {"JELLYFIN_API_KEY": ""}):
            movies_organizer.Movies().scan()
            self.assertNotIn("posterless", self.results()[-1])
            with self.assertRaises(SystemExit):
                movies_organizer.Movies().posters()


class UndoTrash(Base):
    """What a run puts in the Trash is noted under its id, and Undo puts it back where it was."""

    def setUp(self):
        super().setUp()
        if mc.IS_WINDOWS:
            self.skipTest("the Recycle Bin doesn't say where a file went; those are named, not put back")
        self.trash.stop()  # the real Trash, in this test's home
        self.log = self.tmp / "data" / "media-trash.jsonl"
        mock.patch.dict(os.environ, {"HOMELAB_MEDIA_RUN": "scrubber-scan-1", "HOMELAB_MEDIA_TRASH_LOG": str(self.log)}).start()
        mock.patch.object(mc.mo, "YES", True).start()

    def test_a_run_put_back(self):
        a = self.touch(self.lib["movies"] / "Gone (2001)" / "poster.jpg")
        b = self.touch(self.lib["movies"] / "Gone (2001)" / "movie.nfo")
        mc.trash(a)
        mc.trash(b)
        self.assertFalse(a.exists() or b.exists())
        notes = [json.loads(l) for l in self.log.read_text().splitlines()]
        self.assertEqual([(n["run"], n["from"]) for n in notes], [("scrubber-scan-1", str(a)), ("scrubber-scan-1", str(b))])
        self.assertTrue(all(Path(n["to"]).exists() for n in notes))
        with mock.patch.dict(os.environ, {"HOMELAB_MEDIA_RUN": "trash-restore-2"}):
            self.assertTrue(trash_restore.restore("scrubber-scan-1", str(self.log)))
        self.assertTrue(a.exists() and b.exists())
        self.assertEqual(self.results()[-1]["restored"], 2)
        self.assertFalse(any(Path(n["to"]).exists() for n in notes), "out of the Trash")
        if not mc.IS_MAC:
            self.assertEqual(list((self.home / ".local" / "share" / "Trash" / "info").glob("*.trashinfo")), [], "nor listed in it")

    def test_only_this_runs_and_never_over_something_new(self):
        a = self.touch(self.lib["movies"] / "A.nfo")
        b = self.touch(self.lib["movies"] / "B.nfo")
        mc.trash(a)
        with mock.patch.dict(os.environ, {"HOMELAB_MEDIA_RUN": "other-run"}):
            mc.trash(b)
        a.write_text("a new one")  # something in its place since
        trash_restore.restore("scrubber-scan-1", str(self.log))
        res = self.results()[-1]
        self.assertEqual(res["restored"], 0)
        self.assertEqual(a.read_text(), "a new one", "the new one stays")
        self.assertIn("A.nfo: something else is in its place", res["stayed"])
        self.assertFalse(b.exists(), "another run's stays in the Trash")

    def test_a_crafted_log_moves_nothing_that_is_not_in_the_trash(self):
        # A homelab moved in from a file someone else made brings its data/ (this log, and the run
        # Undo offers). A line whose "to" is a file it brought, and whose "from" is where a login
        # item goes, would have Undo plant it there. Only what sits where trash() puts things goes back.
        planted = self.touch(self.tmp / "homelab" / "appdata" / "evil.plist")
        nested = self.touch(self.home / ".local" / "share" / "Trash" / "files" / "dir" / "evil.sh")
        agent = self.home / "Library" / "LaunchAgents" / "com.evil.plist"
        rc = self.home / ".config" / "autostart" / "evil.desktop"
        lines = [{"run": "scrubber-scan-1", "from": str(agent), "to": str(planted)},
                 {"run": "scrubber-scan-1", "from": str(rc), "to": str(nested)},
                 {"run": "scrubber-scan-1", "from": "Library/LaunchAgents/rel.plist", "to": "appdata/evil.plist"}]
        self.log.parent.mkdir(parents=True, exist_ok=True)
        self.log.write_text("".join(json.dumps(l) + "\n" for l in lines))
        trash_restore.restore("scrubber-scan-1", str(self.log))
        res = self.results()[-1]
        self.assertEqual(res["restored"], 0)
        self.assertFalse(agent.exists() or rc.exists(), "nothing planted")
        self.assertTrue(planted.exists() and nested.exists(), "nothing moved")
        self.assertIn("com.evil.plist: not where Tidy Up puts what it throws away", res["stayed"])

    def test_a_crafted_log_puts_back_only_into_a_folder_tidy_up_looks_after(self):
        # A line can name a real thing in the Trash (the household's own, or one a crafted homelab
        # brought there) and an old place anywhere: a login item, the shell's start file. Undo puts
        # back only into a library, an inbox folder, a scrubber root or the reports folder.
        trash = (self.home / ".Trash") if mc.IS_MAC else (self.home / ".local" / "share" / "Trash" / "files")
        outside = self.touch(trash / "evil.desktop")
        dotdot = self.touch(trash / "profile")
        linked = self.touch(trash / "via-link.sh")
        (self.lib["movies"] / "Elsewhere").symlink_to(self.home)
        rc = self.home / ".config" / "autostart" / "evil.desktop"
        profile = self.lib["movies"] / ".." / ".." / "home" / ".profile"
        through = self.lib["movies"] / "Elsewhere" / "via-link.sh"
        lines = [{"run": "scrubber-scan-1", "from": str(rc), "to": str(outside)},
                 {"run": "scrubber-scan-1", "from": str(profile), "to": str(dotdot)},
                 {"run": "scrubber-scan-1", "from": str(through), "to": str(linked)}]
        self.log.parent.mkdir(parents=True, exist_ok=True)
        self.log.write_text("".join(json.dumps(l) + "\n" for l in lines))
        trash_restore.restore("scrubber-scan-1", str(self.log))
        res = self.results()[-1]
        self.assertEqual(res["restored"], 0)
        self.assertFalse(rc.exists() or (self.home / ".profile").exists() or (self.home / "via-link.sh").exists(),
                         "nothing put back outside the libraries")
        self.assertTrue(outside.exists() and dotdot.exists() and linked.exists(), "each stays in the Trash")
        self.assertIn("evil.desktop: not in a folder Tidy Up looks after", res["stayed"])

    def test_the_inbox_and_the_reports_folder_are_put_back_too(self):
        # A download thrown away from the inbox, and the duplicates a music cleanup set aside in
        # the reports folder, are Tidy Up's own: Undo still puts them back.
        dl = self.touch(self.tmp / "Downloads" / "Album" / "01.flac")
        dupe = self.touch(self.tmp / "reports" / "Music - Needs Attention" / "duplicates" / "02.flac")
        mc.trash(dl)
        mc.trash(dupe)
        trash_restore.restore("scrubber-scan-1", str(self.log))
        self.assertEqual(self.results()[-1]["restored"], 2)
        self.assertTrue(dl.exists() and dupe.exists())

    def test_without_a_run_nothing_is_noted(self):
        with mock.patch.dict(os.environ, {"HOMELAB_MEDIA_RUN": ""}):
            mc.trash(self.touch(self.lib["movies"] / "A.nfo"))
        self.assertFalse(self.log.exists())


class FakeProbe:
    """ffprobe answers by file name."""

    def __init__(self, table):
        self.table = table

    def __call__(self, path):
        for key, info in self.table.items():
            if key in Path(path).name:
                return info
        raise RuntimeError("ffprobe can't read %s" % Path(path).name)


class Movies(Base):
    def setUp(self):
        super().setUp()
        self.probe = FakeProbe({})
        mock.patch.object(mc, "ffprobe", side_effect=self.probe).start()

    def test_files_a_lean_download_and_pings_jellyfin(self):
        self.probe.table["Heat"] = facts_info(codec="hevc", size=3_000_000_000)
        dl = self.touch(self.tmp / "Downloads" / "Heat.1995.2160p.WEB.x265-GRP" / "Heat.1995.2160p.WEB.x265-GRP.mkv")
        self.touch(dl.with_name("Heat.1995.2160p.WEB.x265-GRP.en.srt"))
        self.assertTrue(movies_organizer.Movies().file([dl.parent]))
        final = self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv"
        self.assertTrue(final.exists())
        self.assertTrue((final.parent / "Heat (1995).en.srt").exists())
        method, url, body = self.http_mock.call_args[0][:3]
        self.assertEqual((method, url), ("POST", "http://jf:8096/Library/Media/Updated"))
        self.assertEqual(body["Updates"][0]["Path"], "/media/movies/Heat (1995)/Heat (1995).mkv")

    def test_a_film_already_there_with_its_accent_spelled_the_mac_way(self):
        # Copied from a Mac: Ame + accent + lie. On Linux or Windows a second folder would sit beside it.
        self.probe.table["Amelie"] = facts_info(codec="hevc", size=3_000_000_000)
        self.probe.table["Am\u00e9lie"] = facts_info(codec="hevc", size=3_000_000_000)
        (self.lib["movies"] / "Ame\u0301lie (2001)").mkdir()
        dl = self.touch(self.tmp / "Downloads" / "Am\u00e9lie.2001.1080p.mkv")
        self.assertTrue(movies_organizer.Movies().file([dl]))
        self.assertEqual([d.name for d in self.lib["movies"].iterdir() if not d.name.startswith(".")], ["Ame\u0301lie (2001)"])

    def test_a_duplicate_that_is_no_leaner_goes_to_the_trash(self):
        have = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        self.probe.table = {"Heat (1995).mkv": facts_info(codec="hevc", size=3_000_000_000),
                            "Heat.1995": facts_info(codec="h264", size=9_000_000_000)}
        dl = self.touch(self.tmp / "Downloads" / "Heat.1995.1080p.BluRay.x264.mkv")
        movies_organizer.Movies().file([dl])
        self.assertEqual(self.trashed, [str(dl)])
        self.assertTrue(have.exists())

    def test_a_library_copy_that_cannot_be_read_is_not_replaced(self):
        have = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        self.probe.table = {"Heat.1995": facts_info(codec="hevc", size=3_000_000_000)}  # the library's: unreadable
        dl = self.touch(self.tmp / "Downloads" / "Heat.1995.1080p.x265.mkv")
        self.assertFalse(movies_organizer.Movies().file([dl]), "it says there's something to look at")
        self.assertEqual(self.trashed, [])
        self.assertTrue(have.exists())
        self.assertTrue(dl.exists(), "the download stays where it is")

    def test_another_cut_is_neither_a_duplicate_nor_a_replacement(self):
        have = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        self.probe.table = {"Heat (1995).mkv": facts_info(codec="h264", duration=10200, size=9_000_000_000),
                            "Heat.1995": facts_info(codec="hevc", duration=12000, size=3_000_000_000)}
        dl = self.touch(self.tmp / "Downloads" / "Heat.1995.Extended.x265.mkv")
        self.assertFalse(movies_organizer.Movies().file([dl]))
        self.assertEqual(self.trashed, [], "neither the library's copy nor the download goes")
        self.assertTrue(have.exists())
        self.assertTrue(dl.exists())

    def test_a_second_version_kept_on_purpose_stays(self):
        # Jellyfin's and Plex's way of keeping two: Heat (1995) - Director's Cut.mkv beside Heat (1995).mkv.
        have = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        cut = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995) - Director's Cut.mkv")
        self.probe.table = {"Heat (1995).mkv": facts_info(codec="h264", size=9_000_000_000),
                            "Director": facts_info(codec="h264", size=9_000_000_000),
                            "Heat.1995": facts_info(codec="hevc", size=3_000_000_000)}
        dl = self.touch(self.tmp / "Downloads" / "Heat.1995.1080p.x265.mkv")
        self.assertTrue(movies_organizer.Movies().file([dl]))
        self.assertEqual(self.trashed, [str(have)], "the leaner download replaces its own version only")
        self.assertTrue(cut.exists())

    def test_a_leaner_duplicate_replaces_the_library_copy(self):
        have = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        self.probe.table = {"Heat (1995).mkv": facts_info(codec="h264", size=9_000_000_000),
                            "Heat.1995": facts_info(codec="av1", size=3_000_000_000)}
        dl = self.touch(self.tmp / "Downloads" / "Heat.1995.1080p.AV1.mkv")
        movies_organizer.Movies().file([dl])
        self.assertEqual(self.trashed, [str(have)])
        self.assertTrue((self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv").exists())

    def test_a_bloated_download_goes_through_tdarr_first(self):
        self.probe.table["Heat"] = facts_info(codec="h264", audio=("truehd",), size=30_000_000_000)
        dl = self.touch(self.tmp / "Downloads" / "Heat.1995.1080p.BluRay.REMUX.mkv")
        movies_organizer.Movies().file([dl])
        stage = self.lib["movies"] / ".tidy-staging" / "Heat (1995)" / "Heat (1995).mkv"
        self.assertTrue(stage.exists())
        self.assertFalse((self.lib["movies"] / "Heat (1995)").exists(), "not in the library until it's shrunk")
        call = [c for c in self.http_mock.call_args_list if c[0][1].endswith("/api/v2/scan-files")][0]
        cfg = call[0][2]["data"]["scanConfig"]
        self.assertEqual(cfg["dbID"], "LIBM")
        self.assertEqual(cfg["arrayOrPath"], ["/media/movies/.tidy-staging/Heat (1995)/Heat (1995).mkv"])
        # Tdarr finishes: its copy is checked, filed, and the staged original trashed.
        out = self.touch(self.lib["movies"] / ".tdarr-output" / ".tidy-staging" / "Heat (1995)" / "Heat (1995).mkv")
        self.probe.table = {"Heat (1995).mkv": None}

        def probe(p):
            return facts_info(codec="hevc", size=8_000_000_000) if ".tdarr-output" in str(p) else \
                facts_info(codec="h264", size=30_000_000_000)
        mc.ffprobe.side_effect = probe
        eng = movies_organizer.Movies()
        eng.load()
        eng.lib = self.lib["movies"]
        # Tdarr's output mirrors the staged path under its output folder.
        self.http_mock.return_value = {"TranscodeDecisionMaker": "Transcode success"}
        with mock.patch.object(mc, "which", return_value=None):
            eng.collect()
        final = self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv"
        self.assertTrue(final.exists())
        self.assertFalse(out.exists())
        self.assertIn(str(stage), self.trashed)
        self.assertEqual(eng.state["pending"], {})


class Collect(Base):
    def test_tdarr_copy_replaces_the_original_and_subs_are_aligned(self):
        orig = self.touch(self.lib["tv"] / "Show" / "Season 01" / "Show - S01E01.mkv")
        srt = self.touch(orig.with_name("Show - S01E01.en.srt"))
        out = self.touch(self.lib["tv"] / ".tdarr-output" / "Show" / "Season 01" / "Show - S01E01.mkv")
        mc.save_state("tv", {"files": {str(orig): {"status": "queued", "size": 10}}, "pending": {}, "freed": 0, "history": []})
        sizes = {True: 1_000_000_000, False: 3_000_000_000}
        mock.patch.object(mc, "ffprobe", side_effect=lambda p: facts_info(
            codec="hevc" if ".tdarr-output" in str(p) or "tidy-new" in str(p) else "h264",
            size=sizes[".tdarr-output" in str(p)])).start()
        self.http_mock.return_value = {"TranscodeDecisionMaker": "Transcode success"}
        ran = []

        def fake_run(cmd, **kw):
            ran.append(cmd)
            Path(cmd[cmd.index("-o") + 1]).write_text("synced")
            return mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(mc, "which", return_value="ffsubsync"), mock.patch.object(mc, "run", side_effect=fake_run):
            tv_organizer.TV().collect()
        self.assertEqual(self.trashed, [str(orig)])
        self.assertTrue(orig.exists(), "the new copy took its place")
        self.assertFalse(out.exists())
        self.assertEqual(srt.read_text(), "synced")
        self.assertEqual(ran[0][:2], ["ffsubsync", str(orig)])
        res = self.results()[-1]
        self.assertEqual((res["replaced"], res["freed"]), (1, 2_000_000_000))

    def test_a_copy_that_runs_short_is_refused(self):
        orig = self.touch(self.lib["movies"] / "X (2001)" / "X (2001).mkv")
        out = self.touch(self.lib["movies"] / ".tdarr-output" / "X (2001)" / "X (2001).mkv")
        mc.save_state("movies", {"files": {str(orig): {"status": "queued", "size": 10}}, "pending": {}})
        mock.patch.object(mc, "ffprobe", side_effect=lambda p: facts_info(
            codec="hevc", duration=1800 if ".tdarr-output" in str(p) else 3600, size=1)).start()
        self.http_mock.return_value = {"TranscodeDecisionMaker": "Transcode success"}
        movies_organizer.Movies().collect()
        self.assertTrue(orig.exists())
        self.assertEqual(self.trashed, [str(out)], "only Tdarr's bad copy goes")
        self.assertEqual(mc.load_state("movies")["files"][str(orig)]["status"], "failed")


class TVFiling(Base):
    def test_multi_episode_and_anime(self):
        mock.patch.object(mc, "ffprobe", return_value=facts_info(codec="hevc")).start()
        self.touch(self.lib["tv"] / "The Office (US)" / "Season 02" / ".keep")
        a = self.touch(self.tmp / "Downloads" / "The.Office.US.S02E01E02.1080p.mkv")
        b = self.touch(self.tmp / "Downloads" / "[SubsPlease] Frieren - 012-013 (1080p).mkv")
        tv_organizer.TV().file([a, b])
        self.assertTrue((self.lib["tv"] / "The Office (US)" / "Season 02" / "The Office (US) - S02E01-E02.mkv").exists())
        self.assertTrue((self.lib["tv"] / "Frieren" / "Frieren - 012-013.mkv").exists())


class Audiobooks(Base):
    def test_merges_parts_into_one_m4b_with_chapters(self):
        src = self.tmp / "Downloads" / "Frank Herbert - Dune"
        parts = [self.touch(src / ("%02d.mp3" % i), size=1000) for i in range(1, 4)]
        self.touch(src / "cover.jpg")
        meta = {}

        def probe(p):
            if p.name == "book.m4b":
                return facts_info(codec="", audio=("aac",), duration=3 * 600, size=1500, chapters=3)
            return facts_info(codec="", audio=("mp3",), duration=600, size=1000, art=1,
                              tags={"artist": "Frank Herbert", "album": "Dune (Unabridged)", "title": "Dune"})

        def run(cmd, **kw):
            if Path(cmd[0]).name == "ffmpeg":
                meta["cmd"] = cmd
                meta["text"] = Path(cmd[cmd.index("-i", cmd.index("-i") + 1) + 1]).read_text()
                Path(cmd[-1]).write_bytes(b"m" * 1500)
            return mock.Mock(returncode=0, stdout="", stderr="")
        mock.patch.object(mc, "ffprobe", side_effect=probe).start()
        mock.patch.object(mc, "run", side_effect=run).start()
        mock.patch.object(mc, "which", side_effect=lambda n, s=None: "/usr/bin/ffmpeg" if n == "ffmpeg" else None).start()
        audiobook_organizer.Audiobooks().file([src])
        final = self.lib["audiobooks"] / "Frank Herbert" / "Dune" / "Dune.m4b"
        self.assertTrue(final.exists())
        self.assertEqual(meta["text"].count("[CHAPTER]"), 3)
        self.assertIn("title=Chapter 2", meta["text"], "titles that repeat the book's name become Chapter N")
        cmd = meta["cmd"]
        self.assertIn("0:a", cmd, "only the audio from the parts: their embedded covers are dropped")
        self.assertIn("attached_pic", cmd, "one cover for the book")
        self.assertEqual(cmd[cmd.index("-b:a") + 1], "64k")
        for p in parts:
            self.assertIn(str(p), self.trashed)

    def test_a_short_merge_keeps_the_parts(self):
        src = self.lib["audiobooks"] / "Author" / "Book"
        parts = [self.touch(src / ("%02d.mp3" % i)) for i in range(1, 3)]
        mock.patch.object(mc, "ffprobe", side_effect=lambda p: facts_info(
            codec="", audio=("mp3",), duration=100 if p.name == "book.m4b" else 600)).start()
        mock.patch.object(mc, "run", side_effect=lambda cmd, **k: (Path(cmd[-1]).write_bytes(b"x") if "-f" in cmd else None,
                                                                    mock.Mock(returncode=0, stdout="", stderr=""))[1]).start()
        mock.patch.object(mc, "which", side_effect=lambda n, s=None: "/usr/bin/ffmpeg" if n == "ffmpeg" else None).start()
        audiobook_organizer.Audiobooks().run()
        self.assertEqual(self.trashed, [])
        for p in parts:
            self.assertTrue(p.exists())
        self.assertIn(str(src), mc.load_state("audiobooks")["failed"])

    def test_fragmented(self):
        self.touch(self.lib["audiobooks"] / "A" / "Split" / "CD1" / "01.mp3")
        self.touch(self.lib["audiobooks"] / "A" / "Split" / "CD2" / "01.mp3")
        self.touch(self.lib["audiobooks"] / "A" / "Whole" / "Whole.m4b")
        self.assertEqual(audiobook_organizer.fragmented(self.lib["audiobooks"]), [self.lib["audiobooks"] / "A" / "Split"])


class Inbox(Base):
    def test_routing(self):
        d = self.tmp / "Downloads"
        old = 600
        self.touch(d / "Show.S03.1080p.WEB-GRP" / "Show.S03E01.mkv", age=old)
        self.touch(d / "Heat.1995.mkv", age=old)
        self.touch(d / "Fresh.2024.mkv")  # still settling
        self.touch(d / "Album" / "01.flac.part", age=old)  # still downloading
        self.touch(d / "Artist - Album" / "01 Song.mp3", age=old)
        self.touch(d / "Some Audiobook (Unabridged)" / "01.mp3", age=old)
        self.touch(d / "._Heat.1995.mkv", age=old)
        self.touch(d / "Music - Needs Attention" / "x.mp3", age=old)
        self.touch(d / "setup.dmg", age=old)
        mock.patch.object(mc, "ffprobe", return_value=facts_info(codec="", audio=("mp3",), duration=200)).start()
        calls = []
        mock.patch.object(inbox, "engine", side_effect=lambda k, p, a: (calls.append((k, [x.name for x in p])), (True, {"filed": ["x"]}))[1]).start()
        inbox.sweep(apply=True)
        kinds = sorted(calls)
        self.assertEqual(kinds, [("audiobooks", ["Some Audiobook (Unabridged)"]), ("movies", ["Heat.1995.mkv"]),
                                 ("music", ["Artist - Album"]), ("tv", ["Show.S03.1080p.WEB-GRP"])])
        res = self.results()[-1]
        waiting = sorted(Path(w["path"]).name for w in res["waiting"])
        self.assertEqual(waiting, ["Album", "Fresh.2024.mkv"])
        self.assertTrue((d / "setup.dmg").exists(), "not media: left alone")

    def test_a_download_still_being_written_beside_its_placeholder_waits(self):
        # Firefox makes an empty Heat.1995.mkv as it starts, then fills Heat.1995.mkv.part; aria2 fills
        # the file itself beside a .aria2. Neither's own time moves, so only the sibling says so.
        d = self.tmp / "Downloads"
        self.touch(d / "Heat.1995.mkv", size=0, age=600)
        self.touch(d / "Heat.1995.mkv.part", age=600)
        self.touch(d / "Ronin.1998.mkv", age=600)
        self.touch(d / "Ronin.1998.mkv.aria2", age=600)
        calls = []
        mock.patch.object(inbox, "engine", side_effect=lambda k, p, a: (calls.append(k), (True, {"filed": ["x"]}))[1]).start()
        inbox.sweep(apply=True)
        self.assertEqual(calls, [])
        waiting = sorted(Path(w["path"]).name for w in self.results()[-1]["waiting"])
        self.assertEqual(waiting, ["Heat.1995.mkv", "Heat.1995.mkv.part", "Ronin.1998.mkv", "Ronin.1998.mkv.aria2"])

    def test_zip_is_unpacked_filed_and_removed(self):
        d = self.tmp / "Downloads"
        zp = d / "Heat.1995.zip"
        with zipfile.ZipFile(str(zp), "w") as z:
            z.writestr("Heat.1995/Heat.1995.mkv", "x")
            z.writestr("__MACOSX/._Heat.1995.mkv", "x")
        os.utime(str(zp), (time.time() - 600, time.time() - 600))
        seen = []
        mock.patch.object(mc, "ffprobe", return_value=facts_info()).start()
        mock.patch.object(inbox, "engine", side_effect=lambda k, p, a: (seen.append((k, [str(x) for x in p])), (True, {}))[1]).start()
        inbox.sweep(apply=True)
        self.assertEqual(seen[0][0], "movies")
        self.assertIn(".tidy-unzip", seen[0][1][0])
        self.assertFalse((d / ".tidy-unzip").exists(), "the temporary folder is removed")
        self.assertEqual(self.trashed, [str(zp)])

    def test_zip_slip_is_refused(self):
        zp = self.tmp / "evil.zip"
        with zipfile.ZipFile(str(zp), "w") as z:
            z.writestr("../../escape.txt", "x")
        with self.assertRaises(RuntimeError):
            inbox.unzip(zp, self.tmp / "into")
        self.assertFalse((self.tmp / "escape.txt").exists())

    def test_a_zip_too_big_for_the_drive_is_not_unpacked(self):
        # A download built to swell (a few KB that say gigabytes) would fill the drive it lands on. Python's
        # zipfile reads each file only to its listed size, so the listed sizes are added up first.
        zp = self.tmp / "swell.zip"
        with zipfile.ZipFile(str(zp), "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("film.mkv", b"\0" * (20 * 1024 * 1024))
        self.assertLess(zp.stat().st_size, 1024 * 1024, "small in the file")
        GiB = 1024 ** 3
        tight = shutil._ntuple_diskusage(100 * GiB, 99 * GiB - 10 * 1024 * 1024, GiB + 10 * 1024 * 1024)
        with mock.patch.object(inbox.shutil, "disk_usage", return_value=tight):
            with self.assertRaises(RuntimeError) as e:
                inbox.unzip(zp, self.tmp / "into")
        self.assertIn("free", str(e.exception))
        self.assertFalse((self.tmp / "into" / "film.mkv").exists(), "nothing written")
        roomy = shutil._ntuple_diskusage(100 * GiB, 50 * GiB, 50 * GiB)
        with mock.patch.object(inbox.shutil, "disk_usage", return_value=roomy):
            inbox.unzip(zp, self.tmp / "into2")
        self.assertEqual((self.tmp / "into2" / "film.mkv").stat().st_size, 20 * 1024 * 1024)

    def test_books_and_stragglers(self):
        d = self.tmp / "Downloads"
        (self.lib["books"] / "metadata.db").write_text("")
        ep = self.touch(d / "LazyLibrarian" / "deep" / "Dune.epub", age=600)
        inv = self.touch(d / "invoice-2026.pdf", age=600)
        calls = []

        def run(cmd, **kw):
            calls.append(cmd)
            return mock.Mock(returncode=0, stdout="Added book ids: 7", stderr="")
        mock.patch.object(mc, "run", side_effect=run).start()
        mock.patch.object(mc.mo, "docker_ok", return_value=False).start()
        import books_organizer
        mock.patch.object(books_organizer, "find_bin", return_value="calibredb").start()
        inbox.sweep(apply=True)
        self.assertEqual([c[:2] for c in calls], [["calibredb", "add"]])
        self.assertIn(str(ep), calls[0])
        self.assertIn(str(ep), self.trashed)
        self.assertTrue(inv.exists(), "an invoice is not a book")

    def test_a_duplicate_book_goes_to_the_trash(self):
        (self.lib["books"] / "metadata.db").write_text("")
        ep = self.touch(self.tmp / "Downloads" / "Dune.epub", age=600)
        mock.patch.object(mc, "run", return_value=mock.Mock(returncode=0, stdout="The following books were not added as they already exist in the database", stderr="")).start()
        mock.patch.object(mc.mo, "docker_ok", return_value=False).start()
        import books_organizer
        mock.patch.object(books_organizer, "find_bin", return_value="calibredb").start()
        inbox.sweep(apply=True)
        self.assertEqual(self.trashed, [str(ep)])

    def test_failed_downloads_wait_until_they_change(self):
        d = self.tmp / "Downloads"
        self.touch(d / "Heat.1995.mkv", age=600)
        mock.patch.object(mc, "ffprobe", return_value=facts_info()).start()
        eng = mock.patch.object(inbox, "engine", return_value=(False, {})).start()
        with self.assertRaises(SystemExit):
            inbox.sweep(apply=True)
        inbox.sweep(apply=True)
        self.assertEqual(eng.call_count, 1)


class Playlists(Base):
    def test_one_smart_playlist_per_genre(self):
        args = mock.Mock(library=None)
        music_tidy.playlists(args)
        folder = self.lib["music"] / "Playlists"
        files = sorted(folder.glob("*.nsp"))
        self.assertEqual(len(files), 14)
        rock = json.loads((folder / "Rock and Metal.nsp").read_text())
        self.assertEqual(rock["all"], [{"is": {"genre": "Rock & Metal"}}])
        self.assertEqual(rock["name"], "Rock & Metal")


class NeedVenv(Base):
    """A beets venv whose Python is gone (upgraded away) is made again before music_tidy relaunches."""

    def test_a_broken_venv_is_made_again(self):
        if os.name == "nt":
            self.skipTest("a venv's Python is a link only off Windows")
        py = music_tidy.venv_python()
        py.parent.mkdir(parents=True)
        os.symlink(str(self.tmp / "gone" / "python3.13"), str(py))
        keep = self.home / ".music-cleanup" / "library.db"
        keep.write_text("beets")
        made = []

        def bootstrap():
            made.append(os.path.lexists(str(py)))
            py.parent.mkdir(parents=True, exist_ok=True)
            py.write_text("#!/bin/sh\nexit 0\n")
            py.chmod(0o755)

        with mock.patch.object(music_tidy.mo, "bootstrap", side_effect=bootstrap), \
                mock.patch.dict(sys.modules, {"no_such_module_here": None}), \
                mock.patch.object(music_tidy.subprocess, "call", return_value=0) as call, \
                mock.patch.dict(os.environ, {"MUSIC_TIDY_CHILD": ""}):
            with self.assertRaises(SystemExit) as done:
                music_tidy.need(["no_such_module_here"])
        self.assertEqual(done.exception.code, 0)
        self.assertEqual(made, [False], "the broken venv went before the setup ran")
        self.assertEqual(call.call_args[0][0][0], str(py))
        self.assertTrue(keep.exists(), "beets' own files stay")

    def test_a_working_venv_is_kept(self):
        if os.name == "nt":
            self.skipTest("a shell script stands in for Python only off Windows")
        py = music_tidy.venv_python()
        py.parent.mkdir(parents=True)
        py.write_text("#!/bin/sh\nexit 0\n")
        py.chmod(0o755)
        with mock.patch.object(music_tidy.mo, "bootstrap") as bootstrap, \
                mock.patch.dict(sys.modules, {"no_such_module_here": None}), \
                mock.patch.object(music_tidy.subprocess, "call", return_value=0), \
                mock.patch.dict(os.environ, {"MUSIC_TIDY_CHILD": ""}):
            with self.assertRaises(SystemExit):
                music_tidy.need(["no_such_module_here"])
        bootstrap.assert_not_called()
        self.assertTrue(py.exists())


class PinnedBeets(Base):
    """N28: the music jobs' venv installs only the versions pinned, with their hashes, for its Python."""

    PINS = HERE / "requirements"

    def venv_py(self):
        return self.home / ".music-cleanup" / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")

    def bootstrap(self, version=(3, 12, 4), imports_ok=lambda calls: len(calls) > 1):
        """Run the one-time setup with nothing real installed: returns every command it ran."""
        self.calls = calls = []
        py = self.venv_py()

        def run(cmd, **kw):
            cmd = [str(c) for c in cmd]
            calls.append(cmd)
            if cmd[1:3] == ["-m", "venv"]:
                py.parent.mkdir(parents=True, exist_ok=True)
                py.write_text("")
                (py.parent.parent / "pyvenv.cfg").write_text("home = /usr/bin\nversion = %d.%d.%d\n" % version)
            ok = "-c" not in cmd or imports_ok(calls)
            return mock.Mock(returncode=0 if ok else 1, stdout="", stderr="")

        with mock.patch.object(sys, "version_info", version), \
                mock.patch.object(mc.mo.subprocess, "run", side_effect=run), \
                mock.patch.object(mc.mo, "relaunch") as relaunch, \
                mock.patch.object(mc.mo.shutil, "which", return_value=None), \
                mock.patch.dict(os.environ, {"MUSIC_CLEANUP_CHILD": "", "HOMELAB_MEDIA_IN_CONTAINER": ""}), \
                mock.patch.dict(sys.modules, {"beets": None}):
            mc.mo.bootstrap()
        relaunch.assert_called_once_with(str(py))
        return calls

    def installs(self, calls):
        return [c for c in calls if c[1:4] == ["-m", "pip", "install"]]

    def test_each_supported_python_has_its_pins_with_hashes(self):
        for v in ("3.10", "3.11", "3.12", "3.13", "3.14"):
            f = self.PINS / ("music-%s.txt" % v)
            self.assertTrue(f.exists(), "no pins for Python %s" % v)
            reqs = [r for r in re.sub(r"\\\n", " ", f.read_text()).splitlines()
                    if r.strip() and not r.lstrip().startswith("#")]
            names = set()
            for r in reqs:
                name, sep, rest = r.partition("==")
                self.assertTrue(sep, "%s: %s is not pinned to one version" % (f.name, r[:60]))
                self.assertIn("--hash=sha256:", rest, "%s: %s has no hash" % (f.name, name))
                names.add(name.strip().lower())
            self.assertLessEqual({"beets", "mediafile", "requests", "pylast", "pillow", "pyacoustid"}, names, f.name)

    def test_the_setup_installs_only_the_pins_for_its_python(self):
        calls = self.bootstrap()
        installs = self.installs(calls)
        self.assertTrue(installs, "beets was installed")
        for c in installs:
            self.assertIn("--require-hashes", c, "every install is checked against the pinned hashes")
            args = c[4:]
            self.assertEqual(args[args.index("-r") + 1], str(self.PINS / "music-3.12.txt"))
            self.assertEqual([a for a in args if not a.startswith("-") and a != args[args.index("-r") + 1]], [],
                             "nothing is named outside the pinned file (pip itself included)")

    def test_a_venv_from_before_the_pins_is_brought_to_them_once(self):
        py = self.venv_py()
        py.parent.mkdir(parents=True)
        py.write_text("")
        (py.parent.parent / "pyvenv.cfg").write_text("home = /usr/bin\nversion = 3.11.9\n")
        calls = self.bootstrap(imports_ok=lambda calls: True)
        installs = self.installs(calls)
        self.assertEqual(len(installs), 1, "an unpinned venv is brought to the pins")
        self.assertIn(str(self.PINS / "music-3.11.txt"), installs[0], "the pins of the venv's own Python")
        self.assertEqual(self.installs(self.bootstrap(imports_ok=lambda calls: True)), [], "and only once")

    def test_python_older_than_3_10_is_told_plainly(self):
        with self.assertRaises(SystemExit):
            self.bootstrap(version=(3, 9, 6))
        self.assertIn("3.10", self.out.getvalue())

    def test_a_python_without_pins_installs_nothing(self):
        with self.assertRaises(SystemExit):
            self.bootstrap(version=(3, 15, 0))
        self.assertEqual(self.installs(self.calls), [])
        self.assertIn("3.10 to 3.14", self.out.getvalue())


class GenreCounts(Base):
    def test_counts_each_song_under_one_of_your_genres(self):
        lib = self.tmp / "Music"
        songs = {"a.flac": ["Rock"], "b.mp3": ["Alt-Rock"], "c.m4a": ["Hip Hop"], "d.flac": [], "e.ogg": ["Rock"]}
        for name in songs:
            self.touch(lib / "Artist" / "Album" / name)
        self.touch(lib / "Artist" / "Album" / "cover.jpg")
        with mock.patch.object(music_tidy, "need"), mock.patch.object(music_tidy, "music_lib", return_value=lib), \
                mock.patch.object(music_tidy.mo, "read_genre_fields", side_effect=lambda p: songs[Path(p).name]), \
                mock.patch.object(music_tidy.ui, "result") as result:
            music_tidy.genre_counts(mock.Mock(library=None))
        r = result.call_args[1]
        self.assertEqual(r["action"], "genre-counts")
        self.assertEqual(r["songs"], 5, "songs only, not the cover")
        rock = music_tidy.mo.map_genre(["Rock"])
        self.assertEqual(r["genres"][rock], 3 if music_tidy.mo.map_genre(["Alt-Rock"]) == rock else 2)
        self.assertEqual(r["unplaced"], 1, "a song with no genre is counted apart")
        self.assertNotIn(0, r["genres"].values(), "genres with no songs are left out")
        self.assertEqual(list(r["genres"].values()), sorted(r["genres"].values(), reverse=True), "biggest first")


class Lyrics(Base):
    def run_lyrics(self, have, found, title="Song"):
        song = self.touch(self.lib["music"] / "A" / "B" / "01 Song.mp3")
        writes = []
        mock.patch.object(music_tidy, "need").start()
        mock.patch.object(music_tidy, "song_info", return_value={"title": title, "artist": "A", "album": "B", "duration": 200}).start()
        mock.patch.object(music_tidy, "read_lyrics", return_value=have).start()
        mock.patch.object(music_tidy, "lrclib", return_value=found).start()
        mock.patch.object(music_tidy, "write_lyrics", side_effect=lambda p, t, w: writes.append((p, t, w))).start()
        mock.patch.object(music_tidy.time, "sleep").start()
        music_tidy.lyrics(mock.Mock(library=None, check=False), files=[song])
        return writes, self.results()[-1]

    def test_plain_lyrics_are_replaced_by_synced(self):
        writes, res = self.run_lyrics(("la la", False), {"syncedLyrics": "[00:01.00] la la", "plainLyrics": "la la"})
        self.assertEqual(writes[0][1], "[00:01.00] la la")
        self.assertEqual((res["upgraded"], res["synced"]), (1, 1))

    def test_synced_lyrics_are_kept(self):
        writes, res = self.run_lyrics(("[00:01.00] mine", True), {"syncedLyrics": "[00:01.00] theirs"})
        self.assertEqual(writes, [])

    def test_instrumentals_are_skipped(self):
        writes, res = self.run_lyrics(("", False), {"syncedLyrics": "x"}, title="Black Samson (Instrumental)")
        self.assertEqual(writes, [])
        self.assertEqual(res["instrumental"], 1)
        writes, res = self.run_lyrics(("", False), {"instrumental": True})
        self.assertEqual(writes, [])

    def test_plain_only_when_there_is_nothing(self):
        writes, _ = self.run_lyrics(("", False), {"syncedLyrics": None, "plainLyrics": "words"})
        self.assertEqual(writes[0][1], "words")
        writes2, _ = self.run_lyrics(("old words", False), {"syncedLyrics": None, "plainLyrics": "new words"})
        self.assertEqual(len(writes2), 0, "plain never replaces plain")

    def test_songs_lrclib_has_nothing_for_are_asked_again_only_after_a_month(self):
        asked = []
        def run():
            song = self.lib["music"] / "A" / "B" / "01 Song.mp3"
            if not song.exists():
                self.touch(song)
            mock.patch.object(music_tidy, "need").start()
            mock.patch.object(music_tidy, "song_info", return_value={"title": "Song", "artist": "A", "album": "B", "duration": 200}).start()
            mock.patch.object(music_tidy, "read_lyrics", return_value=("", False)).start()
            mock.patch.object(music_tidy, "lrclib", side_effect=lambda info: asked.append(info) or None).start()
            mock.patch.object(music_tidy.time, "sleep").start()
            music_tidy.lyrics(mock.Mock(library=None, check=False), files=[song])
            return self.results()[-1]
        res = run()
        self.assertEqual((res["not_found"], res["none"], len(asked)), (1, 0, 1), "asked once, and it is not counted as still to ask")
        self.assertIn("aren't on LRCLIB yet: asked again in a month", self.out.getvalue())
        res = run()
        self.assertEqual((res["not_found"], len(asked)), (1, 1), "a second run doesn't ask again")
        later = music_tidy.time.time() + 31 * 86400
        with mock.patch.object(music_tidy.time, "time", return_value=later):
            run()
        self.assertEqual(len(asked), 2, "after a month it is asked again")

    def test_untagged_songs_are_counted_apart(self):
        song = self.touch(self.lib["music"] / "x.mp3")
        mock.patch.object(music_tidy, "need").start()
        mock.patch.object(music_tidy, "song_info", return_value=None).start()
        music_tidy.lyrics(mock.Mock(library=None, check=False), files=[song])
        res = self.results()[-1]
        self.assertEqual((res["untagged"], res["none"]), (1, 0), "no title to ask with: not a song that could get lyrics")


    def test_ape_pass_before_writing(self):
        song = self.touch(self.lib["music"] / "x.mp3")
        order = []
        mock.patch.object(mc.mo, "has_ape", return_value=True).start()
        mock.patch.object(mc.mo, "strip_ape", side_effect=lambda p: order.append("ape")).start()
        fake = mock.MagicMock()
        fake.File.side_effect = lambda p: order.append("write") or None
        with mock.patch.dict(sys.modules, {"mutagen": fake}):
            with self.assertRaises(RuntimeError):
                music_tidy.write_lyrics(song, "[00:01.00] x", "embed")
        self.assertEqual(order, ["ape", "write"])

    def test_a_translation_after_each_caret_gets_a_line_of_its_own(self):
        have = "[ar:Bad Bunny]\n[00:01.00]¡NUEVAYoL!^NEW YORK!\n[00:04.50]Si te quieres divertir^If you want to have fun\n[00:08.00]\n"
        writes, res = self.run_lyrics((have, True), None)
        self.assertEqual(len(writes), 1, "rewritten without asking LRCLIB")
        self.assertEqual((res["cleaned"], res["synced"], res["added"]), (1, 1, 0))
        self.assertIn("each is on its own line under its original now", self.out.getvalue())

    def test_the_check_counts_songs_with_two_languages_on_a_line(self):
        # The check changes nothing, but says how many songs a run would set apart, so Tidy Up's Overview
        # can offer it even when every song has lyrics already.
        have = "[00:01.00]¡NUEVAYoL!^NEW YORK!\n[00:04.50]Si te quieres divertir^If you want to have fun\n"
        song = self.touch(self.lib["music"] / "A" / "B" / "01 Song.mp3")
        writes = []
        mock.patch.object(music_tidy, "need").start()
        mock.patch.object(music_tidy, "song_info", return_value={"title": "Song", "artist": "A", "album": "B", "duration": 200}).start()
        mock.patch.object(music_tidy, "read_lyrics", return_value=(have, True)).start()
        mock.patch.object(music_tidy, "write_lyrics", side_effect=lambda p, t, w: writes.append(p)).start()
        music_tidy.lyrics(mock.Mock(library=None, check=True), files=[song])
        res = self.results()[-1]
        self.assertEqual(writes, [], "a check writes nothing")
        self.assertEqual((res["synced"], res["to_clean"], res["cleaned"]), (1, 1, 0))
        self.assertIn("translation after a caret", self.out.getvalue())

    def test_lyrics_without_carets_are_left_alone(self):
        writes, res = self.run_lyrics(("[00:01.00] one ^ two\n[00:02.00] three\n[00:03.00] four", True), None)
        self.assertEqual((writes, res["cleaned"]), ([], 0), "one caret in a song is a word, not a translation")

    def test_plain_lyrics_with_carets_get_synced_ones(self):
        writes, res = self.run_lyrics(("¡NUEVAYoL!^NEW YORK!\nSi te quieres divertir^If you want to have fun", False),
                                      {"syncedLyrics": "[00:01.00]¡NUEVAYoL!\n[00:04.50]Si te quieres divertir"})
        self.assertEqual(writes[-1][1], "[00:01.00]¡NUEVAYoL!\n[00:04.50]Si te quieres divertir")
        self.assertEqual((res["upgraded"], res["synced"]), (1, 1))

    def test_lyrics_are_tidied_when_lrclib_does_not_answer(self):
        # Nov 6, the owner: thousands of songs kept two languages on one line. Each was asked about first, and
        # when LRCLIB didn't answer (blocked, slow, down) the song was skipped and never set apart.
        song = self.touch(self.lib["music"] / "A" / "B" / "01 Song.mp3")
        writes = []
        mock.patch.object(music_tidy, "need").start()
        mock.patch.object(music_tidy, "song_info", return_value={"title": "Song", "artist": "A", "album": "B", "duration": 200}).start()
        mock.patch.object(music_tidy, "read_lyrics", return_value=("¡NUEVAYoL!^NEW YORK!\nSi te quieres divertir^If you want to have fun", False)).start()
        mock.patch.object(music_tidy, "lrclib", side_effect=RuntimeError("GET https://lrclib.net/api/get: timed out")).start()
        mock.patch.object(music_tidy, "write_lyrics", side_effect=lambda p, t, w: writes.append(t)).start()
        mock.patch.object(music_tidy.time, "sleep").start()
        music_tidy.lyrics(mock.Mock(library=None, check=False, tidy=False), files=[song])
        res = self.results()[-1]
        self.assertEqual(len(writes), 1, "set apart though LRCLIB didn't answer")
        self.assertEqual((res["cleaned"], res["failed"]), (1, 1))

    def test_tidying_alone_asks_lrclib_nothing(self):
        # lyrics --tidy: the songs' own lyrics set right on this computer, every one, in minutes, with no
        # question to LRCLIB, so thousands of songs never wait on the network.
        songs = [self.touch(self.lib["music"] / "A" / "B" / ("%02d Song.mp3" % i)) for i in (1, 2)]
        have = {str(songs[0]): ("¡NUEVAYoL!^NEW YORK!\nSi te quieres divertir^If you want to have fun", False), str(songs[1]): ("", False)}
        writes, asked = [], []
        mock.patch.object(music_tidy, "need").start()
        mock.patch.object(music_tidy, "song_info", return_value={"title": "Song", "artist": "A", "album": "B", "duration": 200}).start()
        mock.patch.object(music_tidy, "read_lyrics", side_effect=lambda p: have[str(p)]).start()
        mock.patch.object(music_tidy, "lrclib", side_effect=lambda info: asked.append(info) or None).start()
        mock.patch.object(music_tidy, "write_lyrics", side_effect=lambda p, t, w: writes.append(p)).start()
        music_tidy.lyrics(mock.Mock(library=None, check=False, tidy=True), files=songs)
        res = self.results()[-1]
        self.assertEqual((asked, writes), ([], [songs[0]]))
        self.assertEqual((res["cleaned"], res["none"], res["tidy"]), (1, 1, True))
        self.assertIn("languages on one line set apart in 1 songs", self.out.getvalue())

    def test_songs_remembered_by_the_older_lookup_are_asked_again(self):
        song = self.touch(self.lib["music"] / "A" / "B" / "01 Song.mp3")
        mc.mo.state_dir().mkdir(parents=True, exist_ok=True)
        music_tidy._not_found_path().write_text(json.dumps({str(song): time.time()}), encoding="utf-8")
        asked = []
        mock.patch.object(music_tidy, "need").start()
        mock.patch.object(music_tidy, "song_info", return_value={"title": "Song", "artist": "A", "album": "B", "duration": 200}).start()
        mock.patch.object(music_tidy, "read_lyrics", return_value=("words", False)).start()
        mock.patch.object(music_tidy, "lrclib", side_effect=lambda info: asked.append(info) or None).start()
        mock.patch.object(music_tidy.time, "sleep").start()
        music_tidy.lyrics(mock.Mock(library=None, check=False), files=[song])
        self.assertEqual(len(asked), 1)
        saved = json.loads(music_tidy._not_found_path().read_text(encoding="utf-8"))
        self.assertEqual((saved["version"], list(saved["songs"])), (music_tidy.NOT_FOUND_VERSION, [str(song)]))


class LyricsText(Base):
    def test_lyrics_from_outside_are_plain_text_of_a_sensible_size(self):
        # LRCLIB's text goes into every song's tags, which Navidrome, Jellyfin and each player show: no control
        # characters (a NUL ends some players' reading, an escape sequence drives a terminal), and nothing huge.
        got = music_tidy.normalize_lyrics("[00:01.00]one\x00\x1b[31m red\x07\n\ttwo\x7f")
        self.assertEqual(got, "[00:01.00]one[31m red\n\ttwo")
        song = self.touch(self.lib["music"] / "A" / "01.mp3")
        with self.assertRaises(RuntimeError):
            music_tidy.write_lyrics(song, "la " * 50000, "lrc")
        self.assertFalse(song.with_suffix(".lrc").exists(), "nothing written")

    def test_synced_is_read_through_a_byte_order_mark_and_old_line_endings(self):
        self.assertTrue(music_tidy.is_synced("\ufeff[00:01.00]one"))
        self.assertTrue(music_tidy.is_synced("[ti:x]\r[00:01.00]one\r[00:02.00]two"))
        self.assertTrue(music_tidy.is_synced("[00:01,50]one"))
        self.assertFalse(music_tidy.is_synced("one\ntwo [00:01] three"))

    def test_normalize_keeps_times_and_tags(self):
        got = music_tidy.normalize_lyrics("\ufeff[ar:A]\r\n[00:01.00]Hola^Hello\r\n[00:02.00]\r\n[00:03.00]Adiós^Bye")
        self.assertEqual(got, "[ar:A]\n[00:01.00]Hola\n[00:01.00]Hello\n[00:02.00]\n[00:03.00]Adiós\n[00:03.00]Bye",
                         "both languages, the translation under its original at the same time")
        self.assertEqual(music_tidy.normalize_lyrics("Hola^Hello\nAdiós^Bye"), "Hola\nHello\nAdiós\nBye")
        self.assertEqual(music_tidy.normalize_lyrics("[00:01.00][00:09.00]Hola^Hello\n[00:02.00]Sí^"),
                         "[00:01.00][00:09.00]Hola\n[00:01.00][00:09.00]Hello\n[00:02.00]Sí", "a line's every time; no empty translation")

    def test_a_lyrics_file_beside_the_song_comes_first_as_in_navidrome(self):
        song = self.touch(self.lib["music"] / "A" / "B" / "01 NUEVAYoL.m4a")
        song.with_suffix(".txt").write_text("¡NUEVAYoL!^NEW YORK!\n", encoding="utf-8")
        self.assertEqual(music_tidy.read_lyrics(song), ("¡NUEVAYoL!^NEW YORK!\n", False))
        song.with_suffix(".lrc").write_text("[00:01.00]¡NUEVAYoL!\n", encoding="utf-8")
        self.assertEqual(music_tidy.read_lyrics(song)[1], True, ".lrc before .txt")

    def test_lyrics_go_beside_the_song_when_a_file_there_would_hide_the_tags(self):
        song = self.touch(self.lib["music"] / "A" / "B" / "01 NUEVAYoL.m4a")
        song.with_suffix(".txt").write_text("¡NUEVAYoL!^NEW YORK!\n", encoding="utf-8")
        fake = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"mutagen": fake}):
            music_tidy.write_lyrics(song, "[00:01.00]¡NUEVAYoL!^NEW YORK!\r\n[00:02.00]Si^If", "embed")
        fake.File.assert_not_called()
        self.assertEqual(song.with_suffix(".lrc").read_text(encoding="utf-8"), "[00:01.00]¡NUEVAYoL!\n[00:01.00]NEW YORK!\n[00:02.00]Si\n[00:02.00]If")
        self.assertTrue(music_tidy.read_lyrics(song)[1])



class LrclibLookup(unittest.TestCase):
    def answer(self, routes):
        calls = []
        def http_json(method, url, **kw):
            calls.append(url)
            for path, ans in routes.items():
                if "/api/" + path + "?" in url:
                    if isinstance(ans, tuple):  # one answer after another
                        ans, routes[path] = ans[0], ans[1:]
                    if isinstance(ans, Exception):
                        raise ans
                    return ans
            raise AssertionError(url)
        mock.patch.object(mc, "http_json", side_effect=http_json).start()
        mock.patch.object(music_tidy.time, "sleep").start()
        self.addCleanup(mock.patch.stopall)
        return calls

    def test_exact_record_first(self):
        calls = self.answer({"get": {"syncedLyrics": "[00:01.00] x"}})
        got = music_tidy.lrclib({"title": "Song", "artist": "A", "album": "B", "duration": 200})
        self.assertEqual(got["syncedLyrics"], "[00:01.00] x")
        self.assertEqual(len(calls), 1)

    def test_search_when_the_exact_record_isnt_there(self):
        hits = [
            {"trackName": "Paranoid Android", "artistName": "Radiohead", "duration": 500, "syncedLyrics": "[00:01.00] far"},
            {"trackName": "Paranoid Android (Remastered 2017)", "artistName": "Radiohead", "duration": 384, "plainLyrics": "plain"},
            {"trackName": "Paranoid Android - 2009 Remaster", "artistName": "Radiohead", "duration": 385, "syncedLyrics": "[00:01.00] near"},
            {"trackName": "Paranoid Android", "artistName": "Someone Else", "duration": 383, "syncedLyrics": "[00:01.00] cover"},
        ]
        calls = self.answer({"get": RuntimeError("GET https://lrclib.net/api/get answered 404"), "search": hits})
        got = music_tidy.lrclib({"title": "Paranoid Android", "artist": "Radiohead", "album": "OK Computer OKNOTOK", "duration": 383})
        self.assertEqual(got["syncedLyrics"], "[00:01.00] near", "the same title and artist, within 3 seconds, time-synced first")
        self.assertEqual(len(calls), 2)

    def test_no_album_or_length_goes_straight_to_search(self):
        calls = self.answer({"search": [{"trackName": "Hey Jude", "artistName": "The Beatles", "duration": 431, "plainLyrics": "Hey Jude"}]})
        got = music_tidy.lrclib({"title": "Hey Jude", "artist": "The Beatles", "album": "", "duration": 0})
        self.assertEqual(got["plainLyrics"], "Hey Jude")
        self.assertTrue(all("/api/search?" in c for c in calls), "/api/get needs all four: never asked without them")

    def test_an_exact_record_with_plain_lyrics_alone_looks_for_synced_ones(self):
        exact = {"trackName": "NUEVAYoL", "artistName": "Bad Bunny", "plainLyrics": "¡NUEVAYoL!^NEW YORK!", "syncedLyrics": None}
        hits = [{"trackName": "NUEVAYoL", "artistName": "Bad Bunny", "duration": 183, "syncedLyrics": "[00:01.00]¡NUEVAYoL!^NEW YORK!"},
                {"trackName": "NUEVAYoL", "artistName": "Bad Bunny", "duration": 184, "syncedLyrics": "[00:01.00]¡NUEVAYoL!"}]
        calls = self.answer({"get": exact, "search": hits})
        got = music_tidy.lrclib({"title": "NUEVAYoL", "artist": "Bad Bunny", "album": "DeBÍ TiRAR MáS FOToS", "duration": 183})
        self.assertEqual(got["syncedLyrics"], "[00:01.00]¡NUEVAYoL!^NEW YORK!", "synced, the closest length; a translation is kept")
        self.assertEqual(len(calls), 2)

    def test_an_exact_record_with_plain_lyrics_is_kept_when_none_are_synced(self):
        exact = {"plainLyrics": "words", "syncedLyrics": None}
        self.answer({"get": exact, "search": [{"trackName": "Song", "artistName": "A", "duration": 200, "plainLyrics": "other"}]})
        self.assertEqual(music_tidy.lrclib({"title": "Song", "artist": "A", "album": "B", "duration": 200}), exact)

    def test_nothing_close_is_nothing(self):
        self.answer({"get": RuntimeError("GET https://lrclib.net/api/get answered 404"),
                     "search": [{"trackName": "Song", "artistName": "A", "duration": 290, "syncedLyrics": "x"}]})
        self.assertIsNone(music_tidy.lrclib({"title": "Song", "artist": "A", "album": "B", "duration": 200}))

    def test_slow_down_is_answered_once(self):
        calls = self.answer({"get": (RuntimeError("GET https://lrclib.net/api/get answered 429"), {"syncedLyrics": "[00:01.00] x"})})
        self.assertEqual(music_tidy.lrclib({"title": "Song", "artist": "A", "album": "B", "duration": 200})["syncedLyrics"], "[00:01.00] x")
        self.assertEqual(len(calls), 2)


class LinkedLibrary(Base):
    """A library set in the settings through a link (~/Media → the drive): the engines work with
    real paths, so the path a server sees, and Tdarr's finished copy, are still found."""

    def setUp(self):
        super().setUp()
        if mc.IS_WINDOWS:
            self.skipTest("symlinks need an administrator or developer mode on Windows")
        self.link = self.tmp / "Media"
        os.symlink(str(self.tmp / "Hobbies"), str(self.link))

    def test_server_path_through_a_link(self):
        real = self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv"
        via = [[str(self.link / "movies"), "/media/movies"]]
        self.assertEqual(mc.Servers.server_path(real, via), "/media/movies/Heat (1995)/Heat (1995).mkv")
        self.assertEqual(mc.Servers.server_path(self.link / "movies" / "a.mkv", [[str(self.lib["movies"]), "/media/movies"]]),
                         "/media/movies/a.mkv", "and the other way round")

    def test_tdarr_output_found_for_a_path_recorded_through_a_link(self):
        eng = movies_organizer.Movies()
        eng.lib = self.lib["movies"]
        self.touch(self.lib["movies"] / ve.OUTPUT_DIR / "X (2001)" / "X (2001).mkv")
        out = eng.output_for(str(self.link / "movies" / "X (2001)" / "X (2001).mkv"))
        self.assertIsNotNone(out)
        self.assertEqual(out.name, "X (2001).mkv")


class Servers(Base):
    def test_path_map(self):
        m = [["/Volumes/Hobbies", "/media"], ["/Volumes/Hobbies/music", "/music"]]
        self.assertEqual(mc.Servers.server_path("/Volumes/Hobbies/music/A/1.flac", m), "/music/A/1.flac")
        self.assertEqual(mc.Servers.server_path("/Volumes/Hobbies/tv/S", m), "/media/tv/S")
        with mock.patch.object(mc, "IS_WINDOWS", True):
            self.assertEqual(mc.Servers.server_path(r"e:\Hobbies\movies\X (2001)\X.mkv", [["E:\\Hobbies", "/media"]]),
                             "/media/movies/X (2001)/X.mkv")

    def test_plex_refreshes_the_one_folder(self):
        os.environ["PLEX_TOKEN"] = "tok"
        conf = {"plex": {"url": "http://plex:32400", "kinds": ["movies"], "path_map": [[str(self.tmp / "Hobbies"), "/data"]]}}
        self.http_mock.side_effect = [{"MediaContainer": {"Directory": [{"key": "3", "Location": [{"path": "/data/movies"}]}]}}, None]
        told = mc.Servers(conf).ping(self.lib["movies"] / "X (2001)" / "X (2001).mkv", "movies")
        self.assertEqual(told, ["plex"])
        url = self.http_mock.call_args_list[1][0][1]
        self.assertEqual(url, "http://plex:32400/library/sections/3/refresh?path=/data/movies/X%20%282001%29")
        del os.environ["PLEX_TOKEN"]

    def test_kinds_route_the_pings(self):
        told = mc.Servers().ping(self.lib["music"] / "x.flac", "music")
        self.assertEqual(told, [], "Jellyfin here is set for films and TV only")


class KeysOnARedirect(unittest.TestCase):
    """A server answering 302 to another host must not be handed the key Tidy Up sent it: Python's urlopen
    keeps every header but the body's on a redirect, X-Emby-Token and x-api-key included."""

    def serve(self, handler):
        import http.server
        import threading
        srv = http.server.HTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        return "http://127.0.0.1:%d" % srv.server_port

    def redirect_to(self, target):
        import http.server
        seen = []

        class Answer(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                seen.append({k.lower(): v for k, v in self.headers.items()})
                if self.path.startswith("/go"):
                    self.send_response(302)
                    self.send_header("Location", (target or "") + "/landed")
                    self.end_headers()
                    return
                body = b'{"ok": true}'
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *a):
                pass
        return Answer, seen

    def test_a_key_stays_with_its_own_host(self):
        other, at_other = self.redirect_to(None)
        far = self.serve(other)
        near_h, at_near = self.redirect_to(far)
        near = self.serve(near_h)
        keys = {"X-Emby-Token": "jf-secret", "x-api-key": "td-secret", "Authorization": "Bearer ab-secret",
                "X-Plex-Token": "px-secret", "x-nd-authorization": "Bearer nd-secret"}
        self.assertEqual(mc.http_json("GET", near + "/go", headers=keys), {"ok": True}, "the redirect is still followed")
        self.assertEqual(at_near[0].get("x-emby-token"), "jf-secret", "its own host gets it")
        sent = at_other[0]
        self.assertFalse([k for k in (h.lower() for h in keys) if k in sent], "another host gets none: %s" % sent)

    def big_answer(self, size):
        import http.server

        class Big(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()  # no length: read until it closes, as a server can
                chunk = b" " * 65536
                try:
                    for _ in range(size // len(chunk)):
                        self.wfile.write(chunk)
                    self.wfile.write(b"{}")
                except OSError:
                    pass

            def log_message(self, *a):
                pass
        return self.serve(Big)

    def test_an_answer_is_read_only_up_to_its_cap(self):
        # lrclib.net, MusicBrainz, or a server at home could answer without end; the job reads only so much.
        url = self.big_answer(5 * 1024 * 1024)
        with self.assertRaises(RuntimeError) as e:
            mc.http_json("GET", url + "/x", max_bytes=1024 * 1024)
        self.assertIn("too large", str(e.exception))
        self.assertEqual(mc.http_json("GET", url + "/x", max_bytes=8 * 1024 * 1024), {}, "under its cap, read whole")
        self.assertTrue(0 < mc.MAX_ANSWER <= 256 * 1024 * 1024, "every call has a cap")
        for name in ("_lrclib_get", "mb_release"):
            src = __import__("inspect").getsource(getattr(music_tidy, name))
            self.assertIn("max_bytes=", src, "%s, an outside service, asks for a small cap" % name)

    def test_a_redirect_within_the_same_host_keeps_the_key(self):
        same_h, seen = self.redirect_to("")
        base = self.serve(same_h)
        mc.http_json("GET", base + "/go", headers={"X-Emby-Token": "jf-secret"})
        self.assertEqual([s.get("x-emby-token") for s in seen], ["jf-secret", "jf-secret"])


class Tdarr(Base):
    def test_stack_and_calls(self):
        stack = mc.plugin_stack(gpu=True, keep_langs=["eng", "jpn"])
        ids = [p["id"] for p in stack]
        self.assertIn("Tdarr_Plugin_MC93_Migz1FFMPEG", ids)
        self.assertEqual(stack[1]["InputsDB"]["language"], "eng,jpn")
        self.assertIn("Tdarr_Plugin_MC93_Migz1FFMPEG_CPU", [p["id"] for p in mc.plugin_stack(False, None)])
        self.http_mock.return_value = {"TranscodeDecisionMaker": "Queued"}
        t = mc.Tdarr("http://tdarr:8265/", "k")
        self.assertEqual(t.status("/media/x.mkv"), "Queued")
        body = self.http_mock.call_args[0][2]
        self.assertEqual(body["data"]["docID"], "/media/x.mkv")
        self.assertEqual(self.http_mock.call_args[0][3], {"x-api-key": "k"})



class TdarrHanding(Base):
    """Films reach Tdarr: the ones that came in since the last scan, the ones it never took (handed
    again), and none it can't open."""

    def setUp(self):
        super().setUp()
        self.libs = [{"_id": "LIBM"}, {"_id": "LIBT"}]
        self.known = {}  # Tdarr's own record of each file, by its path there
        self.handed = []
        self.tdarr_takes = True
        mock.patch.object(ve, "TAKE_WAIT", 0).start()

        def http(method, url, body=None, headers=None, timeout=None):
            data = (body or {}).get("data") or {}
            if url.endswith("/api/v2/scan-files"):
                cfg = data["scanConfig"]
                self.handed += cfg["arrayOrPath"]
                # As Tdarr 3 does (tried, Nov 6): a list of files is read only as its folder watcher
                # sends them; scanFindNew with a list reads none of them, and says nothing.
                if self.tdarr_takes and cfg.get("mode") == "scanFolderWatcher":
                    for p in cfg["arrayOrPath"]:
                        self.known.setdefault(p, {"TranscodeDecisionMaker": "Queued"})
                return {}
            if url.endswith("/api/v2/cruddb") and data.get("mode") == "getAll":
                return self.libs
            if url.endswith("/api/v2/cruddb") and data.get("mode") == "getById":
                return self.known.get(data["docID"]) or {}
            return {}
        self.http_mock.side_effect = http
        mock.patch.object(mc, "ffprobe", side_effect=lambda p: facts_info(codec="h264", size=9_000_000_000)).start()

    def test_shrink_reads_the_films_added_since_the_scan(self):
        old = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        mc.save_state("movies", {"files": {str(old): {"status": "bloated", "size": 10}}, "pending": {}})
        # Radarr filed this one straight into the library after the scan.
        new = self.touch(self.lib["movies"] / "Dune (2021)" / "Dune (2021).mkv")
        movies_organizer.Movies().run()
        self.assertEqual(sorted(self.handed), ["/media/movies/Dune (2021)/Dune (2021).mkv", "/media/movies/Heat (1995)/Heat (1995).mkv"])
        files = mc.load_state("movies")["files"]
        self.assertEqual((files[str(old)]["status"], files[str(new)]["status"]), ("queued", "queued"))
        self.assertEqual(mc.ffprobe.call_count, 1, "a film read before isn't read again")

    def test_the_films_handed_are_the_ones_tdarr_has(self):
        # Nov 6, the owner: Shrink said "Tdarr has 4 videos in its queue", and Tdarr had none. Each film
        # handed is in Tdarr's own record after, as its folder watcher hands them.
        films = [self.touch(self.lib["movies"] / n / (n + ".mkv")) for n in ("Heat (1995)", "Dune (2021)")]
        movies_organizer.Movies().run()
        self.assertEqual(sorted(self.known), sorted("/media/movies/%s/%s.mkv" % (f.parent.name, f.parent.name) for f in films))
        self.assertIn("Tdarr has 2 videos in its queue", self.out.getvalue())

    def test_shrink_says_only_what_tdarr_took(self):
        # A Tdarr that records none of them is said, not counted as having them.
        self.tdarr_takes = False
        for n in ("Heat (1995)", "Dune (2021)"):
            self.touch(self.lib["movies"] / n / (n + ".mkv"))
        movies_organizer.Movies().run()
        out = self.out.getvalue()
        self.assertNotIn("videos in its queue", out)
        self.assertIn("Tdarr hasn't taken 2 of the videos handed to it", out)

    def test_shrink_says_when_tdarrs_library_is_gone(self):
        self.libs = [{"_id": "someone-elses"}]
        self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        with self.assertRaises(SystemExit):
            movies_organizer.Movies().run()
        self.assertEqual(self.handed, [])
        self.assertIn("Set up Tdarr again", self.out.getvalue())

    def test_a_film_tdarr_never_recorded_is_handed_again_then_left_for_shrink(self):
        self.tdarr_takes = False  # a Tdarr that never records it, however it's handed
        film = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        long_ago = time.time() - 3600
        mc.save_state("movies", {"files": {str(film): {"status": "queued", "size": 10, "queued_at": long_ago}}, "pending": {}})
        movies_organizer.Movies().collect()
        self.assertEqual(self.handed, ["/media/movies/Heat (1995)/Heat (1995).mkv"])
        rec = mc.load_state("movies")["files"][str(film)]
        self.assertEqual((rec["status"], rec["tries"]), ("queued", 2))
        self.assertEqual(self.results()[-1]["handed_again"], 1)
        movies_organizer.Movies().collect()
        self.assertEqual(len(self.handed), 1, "handed again only once it has had time to take it")
        st = mc.load_state("movies")
        st["files"][str(film)].update(queued_at=long_ago, tries=3)
        mc.save_state("movies", st)
        movies_organizer.Movies().collect()
        self.assertEqual(mc.load_state("movies")["files"][str(film)]["status"], "bloated", "Shrink hands it again")
        self.assertEqual(self.results()[-1]["not_taken"], 1)
        self.assertIn("Tdarr never took 1", self.out.getvalue())

    def test_a_film_tdarr_has_is_not_handed_again(self):
        film = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        self.known["/media/movies/Heat (1995)/Heat (1995).mkv"] = {"TranscodeDecisionMaker": "Queued"}
        mc.save_state("movies", {"files": {str(film): {"status": "queued", "size": 10, "queued_at": 0}}, "pending": {}})
        movies_organizer.Movies().collect()
        self.assertEqual(self.handed, [])

    def test_a_download_tdarr_never_took_is_filed_as_it_is(self):
        self.tdarr_takes = False  # a Tdarr that never records it, however it's handed
        stage = self.touch(self.lib["movies"] / ".tidy-staging" / "Heat (1995)" / "Heat (1995).mkv")
        dest = self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv"
        mc.save_state("movies", {"files": {}, "pending": {str(stage): {"dest": str(dest), "replaces": [], "since": time.time() - 3600}}})
        with mock.patch.object(mc, "which", return_value=None):
            movies_organizer.Movies().collect()
            self.assertEqual(self.handed, ["/media/movies/.tidy-staging/Heat (1995)/Heat (1995).mkv"])
            self.assertFalse(dest.exists())
            st = mc.load_state("movies")
            st["pending"][str(stage)].update(since=time.time() - 3600, tries=3)
            mc.save_state("movies", st)
            movies_organizer.Movies().collect()
        self.assertTrue(dest.exists(), "it doesn't stay hidden in the staging folder")
        self.assertEqual(mc.load_state("movies")["pending"], {})

    def test_a_library_tdarr_cannot_open_is_said_not_handed(self):
        other = self.tmp / "Elsewhere" / "Films"
        film = self.touch(other / "Heat (1995)" / "Heat (1995).mkv")
        self.settings["movies"]["library"] = str(other)
        self.cfg_path.write_text(json.dumps(self.settings))
        mc.load_settings(str(self.cfg_path))
        movies_organizer.Movies().run()
        self.assertEqual(self.handed, [])
        self.assertEqual(mc.load_state("movies")["files"][str(film)]["status"], "bloated")
        self.assertIn("Tdarr can't open 1 video", self.out.getvalue())


class TdarrSignIn(unittest.TestCase):
    """Tdarr's accounts: a 401 signs in with the homelab's login and asks again; without one, it says
    where the login goes, plainly."""

    def tdarr(self, answers, user="homelab", password="pw"):
        calls = []
        def http_json(method, url, body=None, headers=None, timeout=30, **kw):
            calls.append((method, url.split("8265")[1], dict(headers or {}), body))
            ans = answers.pop(0)
            if isinstance(ans, Exception):
                raise ans
            return ans
        mock.patch.object(mc, "http_json", side_effect=http_json).start()
        self.addCleanup(mock.patch.stopall)
        return mc.Tdarr("http://localhost:8265", "", user, password), calls

    def test_signs_in_and_asks_again(self):
        td, calls = self.tdarr([RuntimeError("POST http://localhost:8265/api/v2/cruddb answered 401"), {"token": "tok"}, [{"name": "Films"}]])
        self.assertEqual(td.libraries(), [{"name": "Films"}])
        self.assertEqual([c[1] for c in calls], ["/api/v2/cruddb", "/api/v2/public/auth/login", "/api/v2/cruddb"])
        self.assertEqual(calls[1][3], {"username": "homelab", "password": "pw"})
        self.assertEqual(calls[2][2].get("Authorization"), "Bearer tok")

    def test_without_a_login_it_says_where_it_goes(self):
        td, calls = self.tdarr([RuntimeError("POST http://localhost:8265/api/v2/cruddb answered 401")], user="", password="")
        with self.assertRaises(mc.Expected) as e:
            td.libraries()
        self.assertIn("TDARR_USER and TDARR_PASSWORD", str(e.exception))
        self.assertEqual(len(calls), 1)

    def test_a_refused_login_is_said(self):
        td, _ = self.tdarr([RuntimeError("POST http://localhost:8265/api/v2/cruddb answered 401"),
                            RuntimeError("POST http://localhost:8265/api/v2/public/auth/login answered 401")])
        with self.assertRaises(mc.Expected) as e:
            td.libraries()
        self.assertIn("refused TDARR_USER", str(e.exception))

    def test_asking_for_a_sign_in_is_answering(self):
        td, _ = self.tdarr([RuntimeError("GET http://localhost:8265/api/v2/status answered 401")])
        self.assertTrue(td.ok())
        td, _ = self.tdarr([RuntimeError("can't reach http://localhost:8265/api/v2/status (refused)")])
        self.assertFalse(td.ok())

    def test_an_idle_node_gets_a_worker(self):
        nodes = {"n1": {"nodeName": "homelab", "workerLimits": {"transcodecpu": 0, "transcodegpu": 0, "healthcheckcpu": 1}},
                 "n2": {"nodeName": "busy", "workerLimits": {"transcodecpu": 2}}}
        td, calls = self.tdarr([nodes, None], user="", password="")
        self.assertEqual(td.give_workers(gpu=False), ["homelab"])
        self.assertEqual(calls[1][1], "/api/v2/alter-worker-limit")
        self.assertEqual(calls[1][3], {"data": {"nodeID": "n1", "process": "increase", "workerType": "transcodecpu"}})
        td, calls = self.tdarr([nodes, None], user="", password="")
        td.give_workers(gpu=True)
        self.assertEqual(calls[1][3]["data"]["workerType"], "transcodegpu", "on the graphics card when there is one")
        td, calls = self.tdarr([nodes], user="", password="")
        self.assertEqual(td.give_workers(gpu=False, apply=False), ["homelab"])
        self.assertEqual(len(calls), 1, "a preview changes nothing")

    def test_tdarr_not_running_is_said_plainly(self):
        td, _ = self.tdarr([RuntimeError("can't reach http://localhost:8265/api/v2/cruddb ([Errno 61] Connection refused)")], user="", password="")
        with self.assertRaises(mc.Expected) as e:
            td.status("/media/tv/x.mkv")
        self.assertIn("Tdarr isn't answering at http://localhost:8265: start it from Status", str(e.exception))

    def test_an_expected_stop_is_said_plainly(self):
        out = io.StringIO()
        with mock.patch.object(sys, "stdout", out), self.assertRaises(SystemExit):
            mc.run_main(lambda: (_ for _ in ()).throw(mc.Expected(mc.Tdarr.SIGN_IN)))
        self.assertIn("Tdarr asks for a sign-in", out.getvalue())
        self.assertNotIn("Something unexpected", out.getvalue())

if __name__ == "__main__":
    unittest.main()


class TdarrLeftovers(Base):
    """Nov 8, the owner: 81 GB in Tdarr's cache, 33 work folders from jobs that never finished (Tdarr
    was stopped mid-video, each time leaving its copy). Tidy Up clears Tdarr's own work folders that
    nothing has touched for a while, and only when Tdarr isn't working on anything; nothing else in
    the cache, and nothing through a link."""

    def setUp(self):
        super().setUp()
        self.cache = self.tmp / "Hobbies" / "tdarr-cache"
        self.cache.mkdir()
        self.settings["tdarr"]["cache"] = str(self.cache)
        self.cfg_path.write_text(json.dumps(self.settings))
        mc.load_settings(str(self.cfg_path))
        self.workers = {}  # what Tdarr's node is doing now, by worker
        self.answers = True

        def http(method, url, body=None, headers=None, timeout=None):
            if not self.answers:
                raise RuntimeError("can't reach %s" % url)
            if url.endswith("/api/v2/get-nodes"):
                return {"n1": {"nodeName": "homelab", "workerLimits": {"transcodecpu": 1}, "workers": self.workers}}
            if url.endswith("/api/v2/cruddb") and ((body or {}).get("data") or {}).get("mode") == "getAll":
                return [{"_id": "LIBM"}, {"_id": "LIBT"}]
            return {}
        self.http_mock.side_effect = http
        mock.patch.object(mc, "ffprobe", side_effect=lambda p: facts_info(codec="hevc", size=1_000)).start()
        hours = 3600
        self.old = [self.touch(self.cache / ("tdarr-workDir2-%s" % n) / "S01E01-TdarrCacheFile.mkv", size=5000, age=6 * hours)
                    for n in ("KW12VoA", "qnxfeK9")]
        # One a worker is writing now: its folder is old, its file isn't.
        self.fresh = self.touch(self.cache / "tdarr-workDir2-T3kVYTM" / "S01E04-TdarrCacheFile.mkv", size=700)
        os.utime(str(self.fresh.parent), (time.time() - 6 * hours,) * 2)
        self.other = self.touch(self.cache / "not-tdarrs" / "keep.mkv", size=10, age=6 * hours)
        self.loose = self.touch(self.cache / "tdarr-workDir2-loose.txt", size=10, age=6 * hours)
        elsewhere = self.touch(self.tmp / "elsewhere" / "keep.mkv", size=10, age=6 * hours)
        self.link = self.cache / "tdarr-workDir2-link"
        try:
            self.link.symlink_to(elsewhere.parent, target_is_directory=True)
        except OSError:
            self.link = None  # Windows without the right to make links
        self.elsewhere = elsewhere

    def left(self):
        return sorted(p.name for p in self.cache.iterdir())

    def kept_safe(self):
        self.assertTrue(self.fresh.exists(), "a work folder still being written was removed")
        self.assertTrue(self.other.exists() and self.loose.exists(), "something not Tdarr's work folder was removed")
        self.assertTrue(self.elsewhere.exists(), "a link was followed")

    def test_old_leftovers_are_cleared_when_tdarr_is_idle(self):
        movies_organizer.Movies().collect()
        for p in self.old:
            self.assertFalse(p.parent.exists(), "%s was left" % p.parent.name)
        self.kept_safe()
        self.assertIn("Cleared 2 of Tdarr's unfinished work folders", self.out.getvalue())

    def test_shrink_clears_them_first(self):
        movies_organizer.Movies().run()
        self.assertFalse(any(p.parent.exists() for p in self.old))
        self.kept_safe()

    def test_nothing_is_cleared_while_a_worker_is_busy(self):
        self.workers = {"w1": {"file": "/media/tv/Show/S01E04.mkv", "percentage": 40}}
        before = self.left()
        movies_organizer.Movies().collect()
        self.assertEqual(self.left(), before)
        self.assertNotIn("Cleared", self.out.getvalue())

    def test_a_tdarr_that_is_not_running_still_has_its_old_leftovers_cleared(self):
        self.answers = False
        n, freed = mc.clear_tdarr_leftovers(mc.Tdarr("http://tdarr:8265"))
        self.assertEqual((n, freed), (2, 10000))
        self.assertFalse(any(p.parent.exists() for p in self.old))
        self.kept_safe()

    def test_nothing_without_a_cache_or_with_a_missing_one(self):
        self.assertEqual(mc.clear_tdarr_leftovers(mc.Tdarr("http://tdarr:8265"), cache=""), (0, 0))
        self.assertEqual(mc.clear_tdarr_leftovers(mc.Tdarr("http://tdarr:8265"), cache=str(self.tmp / "unplugged")), (0, 0))
        self.assertTrue(all(p.exists() for p in self.old))


class TdarrOnBattery(Base):
    """On battery the homelab holds Tdarr's workers at nought so it finishes its video and starts no
    other: collecting its work every few minutes doesn't give it a worker back then, only on power."""

    def setUp(self):
        super().setUp()
        self.raised = []

        def http(method, url, body=None, headers=None, timeout=None):
            if url.endswith("/api/v2/get-nodes"):
                return {"n1": {"nodeName": "homelab", "workerLimits": {"transcodecpu": 0}, "workers": {}}}
            if url.endswith("/api/v2/alter-worker-limit"):
                self.raised.append(body["data"])
            return {}
        self.http_mock.side_effect = http
        film = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        mc.save_state("movies", {"files": {str(film): {"status": "queued", "size": 10, "queued_at": time.time()}}, "pending": {}})

    def test_no_worker_given_on_battery(self):
        with mock.patch.dict(os.environ, {"HOMELAB_MEDIA_ALLOW_BATTERY": ""}), mock.patch.object(mc, "on_battery", return_value=True):
            movies_organizer.Movies().collect()
        self.assertEqual(self.raised, [])

    def test_a_worker_given_on_power(self):
        with mock.patch.dict(os.environ, {"HOMELAB_MEDIA_ALLOW_BATTERY": ""}), mock.patch.object(mc, "on_battery", return_value=False):
            movies_organizer.Movies().collect()
        self.assertEqual([r["process"] for r in self.raised], ["increase"])


class BooksIntoCalibre(Base):
    """Nov 8, the owner: Books said the folder "isn't a Calibre library (no metadata.db)": it holds each
    book as Calibre exports them (Author/Title/Title.epub, .azw3, metadata.opf, cover.jpg) with no
    library database. Make a Calibre library moves those aside on the same drive, adds each folder as
    one book (its formats together, its metadata.opf read), checks every one came in, and keeps the
    copy aside. It only looks until it's confirmed; what isn't a book's stays where it was."""

    def setUp(self):
        super().setUp()
        self.books = self.lib["books"]
        self.made = []
        for author, title in (("Ann Author", "First Book"), ("Ann Author", "Second Book"), ("Bob Writer", "Third Book")):
            d = self.books / author / title
            self.touch(d / (title + ".epub"))
            self.touch(d / "metadata.opf")
            self.touch(d / "cover.jpg")
        self.touch(self.books / "Bob Writer" / "Third Book" / "Third Book.azw3")
        self.touch(self.books / ".calnotes" / "notes.db")
        self.touch(self.books / "my_script.py")
        self.touch(self.books / "Read me.txt")
        self.touch(self.books / "Loose One.epub")
        self.touch(self.books / "_Kindle_Ready_Sync" / "system" / "collections.json")
        mock.patch.object(books_tidy.mo, "docker_ok", return_value=False).start()
        mock.patch("books_organizer.find_bin", return_value="calibredb").start()
        self.loses = 0  # books Calibre leaves out

        def run(cmd, timeout=None, check=False, env=None):
            cmd = [str(c) for c in cmd]
            lib = Path(cmd[cmd.index("--library-path") + 1])
            db = lib / "metadata.db"
            if cmd[1] == "add":
                src = Path(cmd[-1])
                assert "--recurse" in cmd and "--one-book-per-directory" in cmd, cmd
                dirs = sorted({p.parent for p in src.rglob("*") if p.suffix in (".epub", ".azw3")})
                dirs = dirs[:len(dirs) - self.loses]
                con = sqlite3.connect(str(db))
                con.execute("CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, path TEXT)")
                for i, d in enumerate(dirs, 1):
                    path = "%s/%s (%d)" % (d.parent.name, d.name, i)
                    (lib / path).mkdir(parents=True)
                    con.execute("INSERT INTO books (path) VALUES (?)", (path,))
                    self.made.append(path)
                con.commit()
                con.close()
                return mock.Mock(returncode=0, stdout="Added book ids: %s" % ", ".join(str(i) for i in range(1, len(dirs) + 1)), stderr="")
            if cmd[1] == "list":
                con = sqlite3.connect(str(db))
                ids = [r[0] for r in con.execute("SELECT id FROM books")]
                con.close()
                return mock.Mock(returncode=0, stdout=json.dumps([{"id": i} for i in ids]), stderr="")
            raise AssertionError(cmd)
        self.run = mock.patch.object(mc, "run", side_effect=run).start()

    def build(self, yes):
        mc.mo.YES = yes
        try:
            books_tidy.build()
        finally:
            mc.mo.YES = False
        return self.results()[-1]

    def test_it_only_looks_until_asked(self):
        r = self.build(False)
        self.assertEqual((r["books"], r["applied"]), (3, False))
        self.assertFalse((self.books / "metadata.db").exists())
        self.assertTrue((self.books / "Ann Author" / "First Book" / "First Book.epub").exists())
        self.assertEqual(self.run.call_count, 0)

    def test_a_library_is_made_and_the_old_copy_kept(self):
        r = self.build(True)
        self.assertTrue(r["ok"] and r["applied"])
        self.assertEqual((r["books"], r["added"]), (3, 3))
        self.assertTrue((self.books / "metadata.db").is_file())
        aside = self.books.parent / (self.books.name + " (before Calibre)")
        self.assertEqual(r["aside"], str(aside))
        # Every book's folder, and Calibre's old notes, went aside whole; what isn't a book's stayed.
        self.assertTrue((aside / "Ann Author" / "Second Book" / "metadata.opf").exists())
        self.assertTrue((aside / "Bob Writer" / "Third Book" / "Third Book.azw3").exists())
        self.assertTrue((aside / ".calnotes" / "notes.db").exists())
        self.assertTrue((self.books / "my_script.py").exists())
        self.assertTrue((self.books / "Read me.txt").exists() and (self.books / "Loose One.epub").exists())
        self.assertTrue((self.books / "_Kindle_Ready_Sync" / "system" / "collections.json").exists())
        self.assertFalse((self.books / "Ann Author" / "First Book" / "First Book.epub").exists())
        self.assertEqual(len(self.made), 3)

    def test_one_left_out_is_said(self):
        self.loses = 1
        r = self.build(True)
        self.assertFalse(r["ok"])
        self.assertEqual((r["books"], r["added"]), (3, 2))
        self.assertIn("2 of 3 books came in", self.out.getvalue())
        self.assertTrue((self.books.parent / (self.books.name + " (before Calibre)") / "Bob Writer" / "Third Book").exists())

    def test_a_library_already_is_left_alone(self):
        sqlite3.connect(str(self.books / "metadata.db")).close()
        r = self.build(True)
        self.assertTrue(r["ok"] and r.get("already"))
        self.assertEqual(self.run.call_count, 0)
        self.assertTrue((self.books / "Ann Author" / "First Book" / "First Book.epub").exists())

    def test_an_earlier_try_left_aside_stops_it(self):
        (self.books.parent / (self.books.name + " (before Calibre)")).mkdir()
        with self.assertRaises(SystemExit):
            self.build(True)
        self.assertIn("from an earlier try", self.out.getvalue())
        self.assertTrue((self.books / "Ann Author" / "First Book" / "First Book.epub").exists())


class AudiobooksAlreadyWhole(Base):
    """Nov 8, the owner: Audiobooks "doesn't really work": its scan said 0 books, of 177 that are one
    .m4b each already (Author/Title/Title.m4b, as Audiobookshelf keeps them). The scan counts those as
    whole, so the screen can say there's nothing to merge rather than a bare 0."""

    def test_whole_books_are_counted(self):
        lib = self.lib["audiobooks"]
        for author, title in (("Ann Author", "One"), ("Ann Author", "Two"), ("Bob Writer", "Three")):
            self.touch(lib / author / title / (title + ".m4b"))
            self.touch(lib / author / title / "metadata.json")
        self.touch(lib / "Cat Reader" / "Split" / "01.mp3")
        self.touch(lib / "Cat Reader" / "Split" / "02.mp3")
        audiobook_organizer.Audiobooks().scan()
        r = self.results()[-1]
        self.assertEqual((r["books"], r["whole"]), (1, 3))


class InboxToday(Base):
    """Nov 8, the owner: "What I did today", a plain line for each thing the inbox filed, with Undo. Each
    download filed leaves one record: what it is, where it went, what was done; Undo puts its files back
    where they came from (a folder as a folder), and the sweep leaves them there until they change."""

    def setUp(self):
        super().setUp()
        self.log = self.tmp / "media-filed.jsonl"
        mock.patch.dict(os.environ, {"HOMELAB_MEDIA_FILED_LOG": str(self.log), "HOMELAB_MEDIA_RUN": "run-1"}).start()
        self.d = self.tmp / "Downloads"
        movies, tv = self.lib["movies"], self.lib["tv"]

        def engine(kind, paths, apply):
            out = []
            for p in paths:
                if kind == "movies":
                    dest = movies / "Heat (1995)" / "Heat (1995).mkv"
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(p), str(dest))
                    out.append(str(dest))
                elif kind == "tv":
                    for i, ep in enumerate(sorted(p.rglob("*.mkv")), 1):
                        dest = tv / "Show" / "Season 03" / ("Show - S03E%02d.mkv" % i)
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(ep), str(dest))
                        out.append(str(dest))
            return True, {"filed": out, "replaced": 0, "discarded": 0, "shrinking": 1 if kind == "movies" else 0}
        mock.patch.object(inbox, "engine", side_effect=engine).start()
        self.touch(self.d / "Heat.1995.1080p.mkv", age=600)
        self.touch(self.d / "Show.S03.WEB" / "Show.S03E01.mkv", age=600)
        self.touch(self.d / "Show.S03.WEB" / "Show.S03E02.mkv", age=600)
        mock.patch.object(mc, "ffprobe", return_value=facts_info(codec="h264", size=9_000_000_000)).start()

    def entries(self):
        return [json.loads(l) for l in self.log.read_text().splitlines()]

    def test_each_download_filed_leaves_a_plain_record(self):
        inbox.sweep(apply=True)
        got = {e["kind"]: e for e in self.entries()}
        film, show = got["movies"], got["tv"]
        self.assertEqual((film["title"], film["where"]), ("Heat (1995)", "Movies › Heat (1995)"))
        self.assertIn("too big, so Tdarr is shrinking it first", film["did"])
        self.assertEqual(film["from"], str(self.d / "Heat.1995.1080p.mkv"))
        self.assertEqual((show["title"], show["where"]), ("Show · 2 episodes", "TV › Show › Season 03"))
        self.assertTrue(film["id"] and film["run"] == "run-1" and film["at"] and film["undo"])

    def test_undo_puts_them_back_and_the_sweep_leaves_them(self):
        inbox.sweep(apply=True)
        show = [e for e in self.entries() if e["kind"] == "tv"][0]
        film = [e for e in self.entries() if e["kind"] == "movies"][0]
        inbox.undo(show["id"])
        inbox.undo(film["id"])
        self.assertTrue((self.d / "Show.S03.WEB" / "Show - S03E01.mkv").exists())
        self.assertTrue((self.d / "Show.S03.WEB" / "Show - S03E02.mkv").exists())
        self.assertTrue((self.d / "Heat.1995.1080p.mkv").exists())
        self.assertFalse((self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv").exists())
        undone = [e["undone"] for e in self.entries() if "undone" in e]
        self.assertEqual(sorted(undone), sorted([show["id"], film["id"]]))
        inbox.engine.reset_mock()
        inbox.sweep(apply=True)
        self.assertEqual(inbox.engine.call_count, 0, "put back by Undo, then filed again")

    def test_undo_of_one_already_undone_or_unknown_says_so(self):
        inbox.sweep(apply=True)
        film = [e for e in self.entries() if e["kind"] == "movies"][0]
        inbox.undo(film["id"])
        with self.assertRaises(SystemExit):
            inbox.undo(film["id"])
        with self.assertRaises(SystemExit):
            inbox.undo("nope")

    def test_a_crafted_record_moves_only_library_files_into_an_inbox_folder(self):
        # The record is under data/, which a homelab moved in from someone else's file brings. A line
        # naming any file of the account, or any place to put one, must move nothing: Undo takes only
        # files in a library and puts them only into an inbox folder (links and .. resolved).
        key = self.touch(self.home / ".ssh" / "id_ed25519")
        film = self.touch(self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv")
        autostart = self.home / ".config" / "autostart" / "evil.mkv"
        lines = [{"id": "a", "title": "A", "undo": True, "files": [str(key)], "from": str(self.d / "key")},
                 {"id": "b", "title": "B", "undo": True, "files": [str(film)], "from": str(autostart)},
                 {"id": "c", "title": "C", "undo": True, "files": [str(film)],
                  "from": str(self.d / ".." / "home" / ".profile.mkv")}]
        self.log.write_text("".join(json.dumps(l) + "\n" for l in lines))
        for i in ("a", "b", "c"):
            with self.assertRaises(SystemExit):
                inbox.undo(i)
        self.assertTrue(key.exists() and film.exists(), "nothing moved")
        self.assertFalse(autostart.exists() or (self.d / "key").exists() or (self.home / ".profile.mkv").exists())

    def test_no_log_no_record(self):
        os.environ.pop("HOMELAB_MEDIA_FILED_LOG")
        inbox.sweep(apply=True)
        self.assertFalse(self.log.exists())


class InboxNeeds(Base):
    """Nov 8, the owner: downloads Tidy Up couldn't place wait in Needs a look, with why, until a person says
    what each one is (a film, an episode) or leaves it; what Undo put back shows there too."""

    def setUp(self):
        super().setUp()
        self.needs = self.tmp / "media-needs.json"
        self.log = self.tmp / "media-filed.jsonl"
        mock.patch.dict(os.environ, {"HOMELAB_MEDIA_NEEDS": str(self.needs), "HOMELAB_MEDIA_FILED_LOG": str(self.log),
                                     "HOMELAB_MEDIA_RUN": "run-1"}).start()
        self.d = self.tmp / "Downloads"
        self.calls = []
        movies, tv = self.lib["movies"], self.lib["tv"]

        def engine(kind, paths, apply):
            self.calls.append((kind, [Path(p) for p in paths]))
            p = Path(paths[0])
            if kind == "movies" and p.stem == "Heat (1995)":
                dest = movies / "Heat (1995)" / "Heat (1995).mkv"
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(p), str(dest))
                return True, {"filed": [str(dest)]}
            if kind == "tv" and p.name == "Show S03":
                out = []
                for ep in sorted(p.glob("*S03E*.mkv")):  # the engine trashes the sample
                    dest = tv / "Show" / "Season 03" / ep.name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(ep), str(dest))
                    out.append(str(dest))
                return True, {"filed": out}
            return False, {"filed": [], "why": "Can't tell what %s is from its name; left where it is" % p.name}
        mock.patch.object(inbox, "engine", side_effect=engine).start()
        mock.patch.object(mc, "ffprobe", return_value=facts_info(codec="h264", size=9_000_000_000)).start()
        self.touch(self.d / "vid_0042.mkv", age=600)

    def sweep(self):
        try:
            inbox.sweep(apply=True)
        except SystemExit:
            pass  # a download it couldn't place: exit 1

    def listed(self):
        return json.loads(self.needs.read_text())

    def test_a_download_no_engine_could_place_waits_with_why(self):
        self.sweep()
        got = self.listed()
        self.assertEqual([(n["name"], n["kind"]) for n in got], [("vid_0042.mkv", "movies")])
        self.assertEqual(got[0]["why"], "Couldn't tell which film it is from its name.")
        self.calls.clear()
        self.sweep()
        self.assertEqual(self.calls, [], "tried again every minute")

    def test_named_as_a_film_it_is_renamed_and_filed(self):
        self.sweep()
        inbox.name_as(str(self.d / "vid_0042.mkv"), "movie", ["Heat", "1995"])
        self.assertEqual(self.calls[-1], ("movies", [self.d / "Heat (1995).mkv"]))
        self.assertTrue((self.lib["movies"] / "Heat (1995)" / "Heat (1995).mkv").exists())
        self.assertEqual(self.listed(), [])
        entry = json.loads(self.log.read_text().splitlines()[-1])
        self.assertEqual(entry["from"], str(self.d / "vid_0042.mkv"))
        self.assertIn("named by you, then filed", entry["did"])

    def test_a_folder_of_episodes_keeps_each_ones_number(self):
        self.touch(self.d / "stuff" / "a.S03E01.mkv", age=600)
        self.touch(self.d / "stuff" / "b.S03E02.mkv", age=600)
        self.touch(self.d / "stuff" / "sample.mkv", age=600)
        inbox.name_as(str(self.d / "stuff"), "episode", ["Show", "3"])
        kind, paths = self.calls[-1]
        self.assertEqual((kind, paths), ("tv", [self.d / "Show S03"]))
        tv = self.lib["tv"] / "Show" / "Season 03"
        self.assertEqual(sorted(p.name for p in tv.iterdir()), ["Show S03E01.mkv", "Show S03E02.mkv"])

    def test_one_that_still_cant_be_placed_says_so(self):
        self.sweep()
        with self.assertRaises(SystemExit):
            inbox.name_as(str(self.d / "vid_0042.mkv"), "movie", ["Nonesuch"])
        got = self.listed()
        self.assertEqual([n["name"] for n in got], ["Nonesuch.mkv"])
        self.assertTrue(got[0]["why"].startswith("Still couldn't place it"))

    def test_leave_it_is_never_filed_and_not_asked_again(self):
        self.sweep()
        inbox.leave(str(self.d / "vid_0042.mkv"))
        self.assertEqual(self.listed(), [])
        self.touch(self.d / "vid_0042.mkv", size=20, age=600)  # changed since
        self.calls.clear()
        self.sweep()
        self.assertEqual(self.calls, [])

    def test_what_undo_put_back_shows_there(self):
        self.sweep()
        inbox.name_as(str(self.d / "vid_0042.mkv"), "movie", ["Heat", "1995"])
        entry = json.loads(self.log.read_text().splitlines()[-1])
        inbox.undo(entry["id"])
        got = self.listed()
        self.assertEqual([(n["name"], n["kind"]) for n in got], [("vid_0042.mkv", "movies")])
        self.assertIn("You put it back", got[0]["why"])

    def test_only_what_is_in_an_inbox_folder_is_named_and_filed(self):
        # Needs a look lists what the needs record says, and the record is under data/, which a homelab
        # moved in from someone else's file brings. Naming one must never move a video or songs from
        # anywhere else in the account into a library.
        private = self.touch(self.home / "Videos" / "private.mkv", age=600)
        songs = self.touch(self.home / "Music Projects" / "demo" / "01.flac", age=600).parent
        escape = self.d / ".." / "home" / "Videos" / "private.mkv"
        for path, words in ((private, ["movie", "Heat", "1995"]), (escape, ["movie", "Heat", "1995"]),
                            (songs, ["album", RUMOURS])):
            with self.assertRaises(SystemExit):
                inbox.name_as(str(path), words[0], words[1:])
        self.assertEqual(self.calls, [], "no engine was asked to file it")
        self.assertTrue(private.exists() and (songs / "01.flac").exists(), "nothing moved")

    def test_asks_for_what_it_needs(self):
        for words in (["movie"], ["film", "Heat"], ["episode", "Show"], ["movie", "Heat", "soon"]):
            with self.assertRaises(SystemExit):
                inbox.name_as(str(self.d / "vid_0042.mkv"), words[0], words[1:])


RUMOURS = "0e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d"


def rumours(tracks=(("Second Hand News", 163000), ("Dreams", 257000), ("Never Going Back Again", 134000)), discs=1):
    """A MusicBrainz release as /ws/2/release/<id>?inc=recordings+artist-credits answers it."""
    per = [tracks] * discs
    return {"id": RUMOURS, "title": "Rumours", "date": "1977-02-04",
            "artist-credit": [{"name": "Fleetwood Mac", "joinphrase": ""}],
            "media": [{"position": d, "format": "CD", "tracks": [
                {"id": "t%d-%d" % (d, i), "position": i, "title": t, "length": ms,
                 "recording": {"id": "r%d-%d" % (d, i), "title": t, "length": ms}}
                for i, (t, ms) in enumerate(ts, 1)]} for d, ts in enumerate(per, 1)]}


class NameTheseSongs(Base):
    """Nov 8, the owner's Inbox plan, item 5: music with no names waits in Needs a look; a person says the
    artist and album, picks the album MusicBrainz finds, and the songs are named as it and filed."""

    def setUp(self):
        super().setUp()
        self.needs = self.tmp / "media-needs.json"
        self.log = self.tmp / "media-filed.jsonl"
        mock.patch.dict(os.environ, {"HOMELAB_MEDIA_NEEDS": str(self.needs), "HOMELAB_MEDIA_FILED_LOG": str(self.log),
                                     "HOMELAB_MEDIA_RUN": "run-1"}).start()
        self.d = self.tmp / "Downloads"
        self.album = self.d / "new stuff"
        for n in ("01 track.mp3", "02 track.mp3", "03 track.mp3"):
            self.touch(self.album / n, age=600)

    def test_place_on_album_reads_the_number_and_disc(self):
        root = self.album
        self.assertEqual(music_tidy.place_on_album(root / "03 Song.mp3", root), (1, 3))
        self.assertEqual(music_tidy.place_on_album(root / "1-07 Song.flac", root), (1, 7))
        self.assertEqual(music_tidy.place_on_album(root / "CD2" / "03 Song.mp3", root), (2, 3))
        self.assertEqual(music_tidy.place_on_album(root / "Track 7.m4a", root), (1, 7))
        self.assertIsNone(music_tidy.place_on_album(root / "Dreams.mp3", root))
        self.assertIsNone(music_tidy.place_on_album(root / "1977 Dreams.mp3", root), "a year isn't a track number")

    def test_the_albums_songs_in_order(self):
        got = music_tidy.album_tracks(rumours(discs=2))
        self.assertEqual([(t["disc"], t["number"], t["title"]) for t in got][:4],
                         [(1, 1, "Second Hand News"), (1, 2, "Dreams"), (1, 3, "Never Going Back Again"), (2, 1, "Second Hand News")])
        self.assertEqual(got[1]["artist"], "Fleetwood Mac", "a song without its own credit is the album's artist's")
        self.assertEqual((got[1]["length"], got[1]["of"], got[1]["recording_id"]), (257.0, 3, "r1-2"))

    def test_matched_by_number_then_by_order(self):
        tracks = music_tidy.album_tracks(rumours())
        files = [self.album / "03 track.mp3", self.album / "01 track.mp3"]
        got = music_tidy.match_tracks(files, tracks, self.album, lambda f: None)
        self.assertEqual([(f.name, t["title"]) for f, t in got], [("03 track.mp3", "Never Going Back Again"), ("01 track.mp3", "Second Hand News")])
        files = [self.album / "a.mp3", self.album / "b.mp3", self.album / "c.mp3"]
        got = music_tidy.match_tracks(files, tracks, self.album, lambda f: None)
        self.assertEqual([t["number"] for _, t in got], [1, 2, 3], "no numbers, the same count: in order")

    def test_a_count_that_doesnt_agree_says_so(self):
        tracks = music_tidy.album_tracks(rumours())
        with self.assertRaises(RuntimeError) as e:
            music_tidy.match_tracks([self.album / "a.mp3", self.album / "b.mp3"], tracks, self.album, lambda f: None)
        self.assertIn("That album has 3 songs and this has 2", str(e.exception))

    def test_another_edition_is_caught_by_the_songs_lengths(self):
        tracks = music_tidy.album_tracks(rumours())
        files = sorted(self.album.iterdir())
        lengths = {files[0]: 163.5, files[1]: 400.0, files[2]: 134.0}
        with self.assertRaises(RuntimeError) as e:
            music_tidy.match_tracks(files, tracks, self.album, lengths.get)
        self.assertIn("02 track.mp3 is 6:40 long, but that album's song 2, “Dreams”, is 4:17", str(e.exception))

    def test_musicbrainz_is_asked_once_more_when_busy(self):
        self.http_mock.side_effect = [RuntimeError("GET https://musicbrainz.org/ws/2/release/x answered 503"), rumours()]
        mock.patch.object(music_tidy.time, "sleep").start()
        self.assertEqual(music_tidy.mb_release(RUMOURS)["title"], "Rumours")
        url = self.http_mock.call_args[0][1]
        self.assertIn("/release/%s?inc=recordings+artist-credits" % RUMOURS, url)
        self.assertIn("Homelab Wizard", self.http_mock.call_args[1]["headers"]["User-Agent"])

    def test_an_album_musicbrainz_doesnt_have_says_so(self):
        self.http_mock.side_effect = RuntimeError("GET https://musicbrainz.org/ws/2/release/x answered 404")
        with self.assertRaises(SystemExit):
            music_tidy.mb_release(RUMOURS)

    def beets(self):
        """music_tidy's file with beets stubbed: what it was asked, and nothing imported."""
        calls = []

        class FakeBeet:
            def __init__(self, d):
                pass

            def __call__(self, *a):
                calls.append(a)
                return []
        mock.patch.object(music_tidy, "need").start()
        mock.patch.object(music_tidy, "write_inbox_beets_config", return_value=self.tmp).start()
        mock.patch.object(music_tidy, "Beet", FakeBeet).start()
        mock.patch.object(music_tidy, "shrink_lossless", side_effect=lambda f: f).start()
        mock.patch.object(mc, "ffprobe", return_value={}).start()
        return calls

    def file(self, album=None):
        import argparse
        args = argparse.Namespace(apply=True, yes=False, library=None, paths=[str(self.album)], album=album)
        music_tidy.file_music(args)
        return self.results()[-1]

    def test_a_replaced_album_is_found_and_removed_by_its_exact_names(self):
        # A download's tags come from whoever made it. beets reads "albumartist:Queen" as "contains Queen"
        # (Queen + Adam Lambert too), and a tag starting with ":" as a pattern: "albumartist::." is every
        # album. Tried on beets 2.14.1 (the pinned one): "field:=~value" matches that one album alone.
        calls = self.beets()
        old = self.touch(self.lib["music"] / "x" / "01.flac")

        class FakeBeet:
            def __init__(self, d):
                pass

            def __call__(self, *a):
                calls.append(a)
                return [":.\t:.\t%s" % old] if a[0] == "ls" else []
        mock.patch.object(music_tidy, "Beet", FakeBeet).start()
        mock.patch.object(music_tidy, "album_key", return_value=(":.", ":.")).start()
        mock.patch.object(mc, "media_facts", return_value={"codec": "flac"}).start()
        mock.patch.object(mc, "audio_more_efficient", return_value=True).start()
        mock.patch.object(music_tidy, "lyrics").start()
        mock.patch.object(music_tidy.mo, "read_genre_fields", return_value=[]).start()
        self.file()
        queries = [c for c in calls if c[0] in ("ls", "rm") and any(t.startswith("albumartist:") for t in c)]
        self.assertEqual([c[0] for c in queries], ["ls", "rm"], "found, then taken out of beets")
        for c in queries:
            self.assertEqual([t for t in c if t.startswith(("albumartist:", "album:"))],
                             ["albumartist:=~:.", "album:=~:."], c)

    def test_songs_with_no_names_are_not_filed_as_they_are(self):
        calls = self.beets()
        mock.patch.object(music_tidy, "can_fingerprint", return_value=False).start()
        mock.patch.object(music_tidy, "album_key", return_value=("", "")).start()
        res = self.file()
        self.assertFalse(res["ok"])
        self.assertEqual(res["why"], music_tidy.UNNAMED)
        self.assertFalse([c for c in calls if c[0] == "import"], "imported as they are, into a folder with no name")
        self.assertTrue(self.album.exists())

    def by_sound(self, matched):
        """beets with AcoustID: an import that matched moves the songs into the library; one that didn't leaves them."""
        calls = self.beets()
        lib = self.lib["music"] / "Fleetwood Mac" / "Rumours"

        class FakeBeet:
            def __init__(self, d):
                pass

            def __call__(self, *a):
                calls.append(a)
                if "import" in a and matched:
                    lib.mkdir(parents=True, exist_ok=True)
                    for f in sorted(Path(a[-1]).iterdir()):
                        shutil.move(str(f), str(lib / f.name))
                if a[0] == "ls" and matched:
                    return ["%d\t%s" % (i, p) for i, p in enumerate(sorted(lib.iterdir()))]
                return []
        mock.patch.object(music_tidy, "Beet", FakeBeet).start()
        mock.patch.object(music_tidy, "can_fingerprint", return_value=True).start()
        mock.patch.object(music_tidy, "album_key", return_value=("", "")).start()
        mock.patch.object(music_tidy, "lyrics").start()
        mock.patch.object(music_tidy.mo, "read_genre_fields", return_value=[]).start()
        shrunk = mock.patch.object(music_tidy, "shrink_lossless", side_effect=lambda f: f).start()
        return calls, shrunk

    def test_with_acoustid_songs_with_no_names_go_to_beets_first(self):
        # The owner, Nov 9: "yes": with AcoustID, beets tries them by their sound before Needs a look asks.
        calls, shrunk = self.by_sound(matched=True)
        res = self.file()
        imports = [c for c in calls if "import" in c]
        self.assertEqual(len(imports), 1)
        self.assertEqual(imports[0][0], "-c", "beets is told to skip what it can't match, not file it as it is")
        self.assertIn("quiet_fallback: skip", Path(imports[0][1]).read_text())
        self.assertTrue(res["ok"])
        self.assertEqual(res["songs"], 3)
        shrunk.assert_not_called()

    def test_with_acoustid_songs_it_cant_match_still_wait_in_needs_a_look(self):
        self.by_sound(matched=False)
        res = self.file()
        self.assertFalse(res["ok"])
        self.assertEqual(res["why"], music_tidy.UNNAMED)
        self.assertEqual(len(list(self.album.iterdir())), 3, "left where they were")

    def test_named_songs_are_filed_as_the_album_picked(self):
        calls = self.beets()
        named = []
        mock.patch.object(music_tidy, "name_album", side_effect=lambda *a: named.append(a)).start()
        mock.patch.object(music_tidy, "album_key", return_value=("", "")).start()
        self.file(album=RUMOURS)
        self.assertEqual(named[0][2:], (RUMOURS, True))
        self.assertIn(("import", "--search-id", RUMOURS, str(self.album)), calls)

    def test_an_album_id_that_isnt_one_is_refused(self):
        self.beets()
        with self.assertRaises(SystemExit):
            self.file(album="--library")

    def test_the_names_are_written_onto_the_songs(self):
        written = {}

        class Song(dict):
            tags = None

            def __init__(self, path):
                super().__init__()
                self.path = path

            def add_tags(self):
                self.tags = {}

            def __setitem__(self, k, v):
                if k == "musicbrainz_releasetrackid":
                    raise KeyError(k)  # a format with no place for it
                super().__setitem__(k, v)

            def save(self):
                written[Path(self.path).name] = dict(self)
        fake = mock.MagicMock()
        fake.File.side_effect = lambda p, easy=False: Song(p)
        mock.patch.dict(sys.modules, {"mutagen": fake}).start()
        tracks = music_tidy.album_tracks(rumours())
        pairs = list(zip(sorted(self.album.iterdir()), tracks))
        music_tidy.tag_as_album(pairs, rumours())
        self.assertEqual(written["02 track.mp3"], {
            "title": "Dreams", "artist": "Fleetwood Mac", "album": "Rumours", "albumartist": "Fleetwood Mac",
            "tracknumber": "2/3", "discnumber": "1/1", "date": "1977", "musicbrainz_albumid": RUMOURS,
            "musicbrainz_trackid": "r1-2"})

    def inbox_engine(self, ok=True):
        calls = []
        lib = self.lib["music"] / "Fleetwood Mac" / "Rumours"

        def engine(kind, paths, apply, extra=()):
            calls.append((kind, [Path(p) for p in paths], list(extra)))
            if not ok:
                return False, {"filed": [], "why": "That album has 11 songs and this has 3, with no track numbers to match them by."}
            out = []
            for f in sorted(Path(paths[0]).iterdir()):
                lib.mkdir(parents=True, exist_ok=True)
                shutil.move(str(f), str(lib / f.name))
                out.append(str(lib / f.name))
            return True, {"filed": [str(lib)], "songs_filed": out}
        mock.patch.object(inbox, "engine", side_effect=engine).start()
        return calls

    def test_the_sweep_leaves_them_in_needs_a_look_with_why(self):
        mock.patch.object(inbox, "engine", return_value=(False, {"filed": [], "why": music_tidy.UNNAMED})).start()
        mock.patch.object(mc, "ffprobe", return_value=facts_info(codec=None, audio=("mp3",), duration=200)).start()
        try:
            inbox.sweep(apply=True)
        except SystemExit:
            pass
        got = json.loads(self.needs.read_text())
        self.assertEqual([(n["name"], n["kind"], n["why"]) for n in got], [("new stuff", "music", music_tidy.UNNAMED)])

    def test_name_these_songs_files_them_as_the_album(self):
        calls = self.inbox_engine()
        inbox.name_as(str(self.album), "album", [RUMOURS.upper()])
        self.assertEqual(calls, [("music", [self.album], ["--album", RUMOURS])])
        entry = json.loads(self.log.read_text().splitlines()[-1])
        self.assertEqual(entry["title"], "Rumours · Fleetwood Mac")
        self.assertEqual(entry["did"][0], "named by you, then filed")
        self.assertEqual(len(entry["files"]), 3, "Undo moves back exactly these songs")
        self.assertEqual(json.loads(self.needs.read_text()), [])

    def test_an_album_that_doesnt_fit_stays_in_needs_a_look_saying_why(self):
        self.inbox_engine(ok=False)
        with self.assertRaises(SystemExit):
            inbox.name_as(str(self.album), "album", [RUMOURS])
        got = json.loads(self.needs.read_text())
        self.assertEqual([n["name"] for n in got], ["new stuff"])
        self.assertTrue(got[0]["why"].startswith("Still couldn't file it: That album has 11 songs"))

    def test_name_needs_an_album_id(self):
        self.inbox_engine()
        for words in ([], ["Rumours"], [RUMOURS, "extra"], ["--library"]):
            with self.assertRaises(SystemExit):
                inbox.name_as(str(self.album), "album", words)


class InboxArchives(Base):
    """Nov 8, the owner's Inbox plan, item 7: a .rar or .7z in a watched folder isn't passed over in silence: Needs a
    look says it's packed and what to do (open it; what's inside is filed next time), once, until it changes."""

    def setUp(self):
        super().setUp()
        self.needs = self.tmp / "media-needs.json"
        mock.patch.dict(os.environ, {"HOMELAB_MEDIA_NEEDS": str(self.needs)}).start()
        self.d = self.tmp / "Downloads"
        self.calls = []
        mock.patch.object(inbox, "engine", side_effect=lambda *a, **k: self.calls.append(a) or (True, {"filed": []})).start()

    def sweep(self):
        try:
            inbox.sweep(apply=True)
        except SystemExit:
            pass
        return json.loads(self.needs.read_text()) if self.needs.exists() else []

    def test_a_rar_and_a_scene_folder_of_rar_parts_wait_with_why(self):
        self.touch(self.d / "Heat.1995.rar", age=600)
        self.touch(self.d / "Show.S01.WEB" / "show.s01.rar", age=600)
        self.touch(self.d / "Show.S01.WEB" / "show.s01.r00", age=600)
        self.touch(self.d / "Show.S01.WEB" / "show.s01.nfo", age=600)
        self.touch(self.d / "Album.7z.001", age=600)
        got = {n["name"]: n for n in self.sweep()}
        self.assertEqual(sorted(got), ["Album.7z.001", "Heat.1995.rar", "Show.S01.WEB"])
        self.assertTrue(got["Heat.1995.rar"]["why"].startswith("It's packed in a .rar file"))
        self.assertIn("a .7z file", got["Album.7z.001"]["why"])
        self.assertEqual(got["Heat.1995.rar"]["kind"], "", "no film or episode buttons: it isn't one yet")
        self.assertEqual(self.calls, [])
        self.assertTrue((self.d / "Heat.1995.rar").exists(), "left where it is")

    def test_said_once_and_left_be_until_it_changes(self):
        self.touch(self.d / "Heat.1995.rar", age=600)
        self.sweep()
        with mock.patch.object(inbox, "note_why", wraps=inbox.note_why) as noted:
            self.sweep()
        noted.assert_not_called()
        inbox.leave(str(self.d / "Heat.1995.rar"))
        self.assertEqual(self.sweep(), [])

    def test_a_download_with_its_film_and_a_rar_of_extras_is_filed_as_usual(self):
        self.touch(self.d / "Heat.1995" / "Heat.1995.mkv", size=2000, age=600)
        self.touch(self.d / "Heat.1995" / "Subs.rar", age=600)
        mock.patch.object(mc, "ffprobe", return_value=facts_info()).start()
        self.assertEqual(self.sweep(), [])
        self.assertEqual([c[0] for c in self.calls], ["movies"])

    def test_the_preview_says_so_and_changes_nothing(self):
        self.touch(self.d / "Heat.1995.rar", age=600)
        inbox.sweep(apply=False)
        self.assertIn("packed (.rar)", self.out.getvalue())
        self.assertFalse(self.needs.exists())
