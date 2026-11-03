"""Tidy Up's Python engines, with every outside program stubbed: no ffmpeg, ffprobe, Docker, Tdarr,
media server, LRCLIB or Calibre is run, and no real library is touched (everything is in a temporary
folder). Run with: python3 -m unittest discover -s tools/media/tests"""
import hashlib
import io
import json
import os
import shutil
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

# The two vendored engines are the owner's, unchanged: any edit shows here first.
VENDORED = {
    "music_organizer.py": "aede95cb1c6e19f101c2c951f13e6fad1340b0998e20a20ed142951260bbb3a0",
    "books_organizer.py": "3d9af447cce3fcf047710a6cb70ce863dffa2b81f17a2b30a4102a0809ea6c58",
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


if __name__ == "__main__":
    unittest.main()
