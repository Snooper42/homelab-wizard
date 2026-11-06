---
version: 0.17.0
---

# Tidy Up

Tidy Up keeps the libraries on the media drive (`MEDIA_ROOT`) sorted, tagged, and lean: music, books, films, TV, and audiobooks. It has its own screen in the app, and `homelab media` does the same from a terminal. Everything it throws away goes to the Trash (the Recycle Bin on Windows), never straight away.

## The screen

**Overview** is one list, **Needs your OK**: the next thing each library waits on (a scan, a swap, films to shrink, books to look over), what it wins back, and its one button. Beside it, a ring of genres, with a dropdown for whose: your music's in your 14 genres (`homelab media music genre-counts`), your films' and shows' from Jellyfin or the `.nfo` files beside them (`movies genre-counts`, `tv genre-counts`), and your books' from each book's first tag in Calibre (`books genre-counts`, which only reads Calibre's database); the media drive with what each library takes and what is free (measured in the background, at most every six hours, into `~/.homelab-media/sizes.json`), and **Recently done**, with **Undo** on the music swap until the space is freed, on the books' last apply, and on whatever a run put in the Trash: each thing Tidy Up throws away is noted under its run in `data/media-trash.jsonl`, and Undo (`homelab media restore <run>`) puts back what is still in the Trash, never over something now in its place. Two runs don't offer it: Tdarr's collect (the smaller copy has the original's name) and freeing the old music library. On Windows, what went to the Recycle Bin is named instead, to restore from there; a USB or network drive's `.tidy-trash` is put back like a Mac's or Linux's Trash. Each library has its own tab: what could be tidier, its space, and its history.

## The engines

The work is done by Python scripts in `tools/media`, run by the homelab with Python 3.8 or newer:

| Script | What it does |
|---|---|
| `music_organizer.py` | The owner's music organizer, vendored with their two Windows fixes: scan, build a cleaned copy with beets (MusicBrainz, your 14 genres, artwork), swap it in with Navidrome paused and backed up, verify, undo |
| `books_organizer.py` | The owner's books organizer, vendored with their Windows fix: review (titles, series, publishers, genres, covers, misfiled books), apply with Calibre-Web paused, undo |
| `music_tidy.py` | What Tidy Up adds around the organizer: free the space once verify says every song is there, Navidrome's full scan and missing entries, a smart playlist (`.nsp`) a genre, LRCLIB lyrics, and new music from Downloads |
| `movies_organizer.py`, `tv_organizer.py`, `video_engine.py` | Find the videos that waste space, hand them to Tdarr, and swap each checked result in; file new films as `Title (Year)/Title (Year).mkv` and episodes as `Show/Season 01/Show - S01E01.mkv` (`S01E01-E02` for two in one file, `Show - 112` for anime numbered from its first episode) |
| `audiobook_organizer.py` | Merge a book in many files into one `.m4b` with a chapter a file and one cover (m4b-tool, else ffmpeg) |
| `inbox.py` | Watch Downloads and hand each finished download to its engine |
| `scrubber.py` | The nightly sweep of leftovers |
| `tdarr_setup.py` | Tidy Up's two libraries in Tdarr, with the space-saving plugins |

`media_common.py` holds what they share: the Trash on each system, ffprobe, Tdarr's API, and the media servers' refreshes. The vendored scripts are otherwise never edited: `tools/media/tests` fails if either changes. The owner agreed to two fixes on Nov 3, 2026: on Windows, Docker Desktop's names for a mounted folder (`/run/desktop/mnt/host/m/music` for `M:\music`) are read as drive letters, so Navidrome and Calibre-Web are paused while files move; and beets runs on this machine there, since its container can't open Windows folders.

## Settings

`homelab media` writes `data/homelab_media.json` from `.env` before every run (the **Tidy Up** section of Settings): the libraries under `MEDIA_ROOT`, the folders to watch, the languages to keep, Tdarr's codec, where lyrics go, and the address of each media server that is installed. Keys and passwords (`JELLYFIN_API_KEY`, `NAVIDROME_ADMIN_PASSWORD`, `PLEX_TOKEN`, `AUDIOBOOKSHELF_API_KEY`, `TDARR_API_KEY`, `TDARR_USER`, `TDARR_PASSWORD`) reach the engines in their environment, never on a command line or in that file.

Tdarr asks for a sign-in (its accounts are on since 2.4x). Before a job that talks to it (**Set up Tdarr**, a films' or TV's **Shrink** or **Collect**), a Tdarr with no account yet gets one made for Tidy Up through its own sign-up: user `homelab`, a generated password, both kept in `.env` (`TDARR_USER`, `TDARR_PASSWORD`; Settings › Tidy Up), which also sign you in to Tdarr's own page. If you made an account in Tdarr first, put its user name and password there; the engines sign in with them and send its token (`TDARR_API_KEY` still works where Tdarr gives one). Without either, the job says so, plainly.

A new Tdarr's node has no transcode worker, and a node without one takes nothing from its queue: **Set up Tdarr**, a films' or TV's **Shrink**, and **Collect** give each node with none one worker (`/api/v2/alter-worker-limit`; on the graphics card when there is one, else the processor). More can be given on Tdarr's own page; a node that has any is left as it is. Reports go to `reports/media` in the homelab folder, not Downloads, which the inbox watches.

Tdarr's Tidy Up libraries never scan by themselves: Tidy Up hands Tdarr each film or episode that wastes space. **Shrink** reads the videos that came in since the last scan first (Radarr and Sonarr file straight into the library), then hands every one that wastes space. Only what Tdarr's container mounts can be handed: the media drive's `movies` and `tv` folders (`MEDIA_ROOT`), as `/media/movies` and `/media/tv`; a library elsewhere (`TIDY_MOVIES_LIBRARY`, `TIDY_TV_LIBRARY`) is named, with the folder Tdarr can open, and nothing is handed. A video Tdarr still has no record of 20 minutes after it was handed is handed again; after three tries it waits for the next **Shrink**, said on the card, and a new download waiting for Tdarr is filed as it is. **Shrink** stops, saying to run **Set up Tdarr** again, when Tdarr no longer has the library Tidy Up made (its data was cleared, or it was installed again).

## How it keeps out of the way

- **One job moves files at a time:** `data/homelab.media.lock` holds the job's process, and a job that crashed leaves a lock the next run takes over, carrying on where it stopped. A lock whose process ID another program has since been given (one that started after the lock was written, as after a restart) counts as left behind too. Transcodes aren't under the lock: Tdarr's own queue and its nodes' worker limits pace them; only putting their results in place is.
- **While a job runs,** the nightly update leaves every app that reads a library (Navidrome, beets, Calibre-Web, Komga, Kavita, Audiobookshelf, Jellyfin, the *arr apps, Tdarr) for the next night, `homelab update` refuses them alone, and Duplicati's scheduled backups are paused, then resumed.
- **Lyrics:** each song without time-synced lyrics is looked up on LRCLIB by its exact record (title, artist, album, and length), then, when that has nothing time-synced, by a search on title and artist that takes the same title (without *Remastered*, *Live*, or *feat.*), the same artist, and a length within 3 seconds, time-synced first; the exact record's plain lyrics are kept only when no record has synced ones. Plain lyrics never replace plain ones; instrumentals are skipped. A song's lyrics are read as Navidrome reads them (its `LyricsPriority`: a `.lrc` beside the song, then a `.txt`, then the song's own tags), and written where it will read them: into the song (`TIDY_LYRICS=embed`), or into the `.lrc` beside it when that is set (`lrc`) or when a `.lrc` or `.txt` is already there and would hide the song's own. Lyrics with a translation after a caret on most lines (*¡NUEVAYoL!^NEW YORK!*) keep both languages: each translation goes on a line of its own under its original, with the same time, so a player shows the two together, whether they come from LRCLIB or are already in the song. A song LRCLIB has nothing for is kept in `~/.homelab-media/lyrics-not-found.json` and asked about again after 30 days (or on the next run when the lookup has changed since), and Overview's **Add lyrics** counts only songs not yet asked. **Check lyrics** counts the songs with two languages on one line too, and once every song has lyrics, Overview offers **Tidy lyrics** for them (a check from before it counted them is offered again). The card ends with what came of every song.
- **Power:** building the music library, merging audiobooks, lyrics, and handing videos to Tdarr wait for power and stop at a safe point when a laptop goes on battery; the battery saver pauses Tdarr too.
- **The agent's minute:** the inbox when Downloads changed, Tdarr's finished work every few minutes, and the scrubber daily at 03:00. `TIDY_UP=false` turns all three off; `TIDY_INBOX` and `TIDY_SCRUB` each one.

## Before a run

`homelab media preflight` checks Python (on a Mac, Homebrew's, or Apple's only with its developer tools, so no install prompt appears), the media drive, the container runtime, a graphics card for Tdarr, power, ffmpeg and ffprobe, ffsubsync, m4b-tool, and Calibre's tools, each with its fix. Calibre is found on PATH, as the Mac app, in Program Files, in `/opt/calibre`, in a home folder (where Calibre's installer puts it on SteamOS, whose `/` is read-only), or as the Flatpak from Discover, whose tools it runs through `flatpak run`; `CALIBRE_BIN_DIR` points at another place. ffmpeg from Homebrew or Nix on Linux is found too. Tidy Up's screen shows the same under **This machine**. beets, when no beets image is in Docker, runs from a venv in `~/.music-cleanup/venv` that the first music scan makes; when the Python it was made with is upgraded away (a Homebrew upgrade, say), every run removes the venv whose Python no longer starts, says so, and the engine makes it again, leaving beets' library beside it.

Without ffmpeg, **Install** (`homelab media install ffmpeg --yes`) gets it with no Terminal and no password. With Homebrew (a Mac, or Linux) or winget (Windows) already there, it runs `brew install ffmpeg` or `winget install Gyan.FFmpeg` itself, each line shown on the card, so ffmpeg is updated with everything else. Without either, it fetches ffmpeg for Tidy Up alone: one pinned build per system (Martin Riedl's for macOS and Linux, Gyan Doshi's for Windows, both GPL), downloaded over HTTPS and checked against its SHA-256 in `internal/media/ffmpeg-pins.json` before anything is unpacked, then run once (`ffmpeg -version`) before it is kept in `~/.homelab-media/bin`. A download that doesn't match is thrown away and never run, and what was there stays. An ffmpeg installed another way (Homebrew, winget, apt) comes first. The pins are written by `go run ./internal/tools/ffmpegpins`, which follows each publisher's latest link to its versioned file and downloads it once; run it to move to a newer ffmpeg.

## Shrink & Strip

New downloads are compared with what the library has. A duplicate replaces the library's copy only when it is leaner for the same picture or sound: AV1 over HEVC over H.264 at the same resolution and length, high-quality AAC or Opus over a huge FLAC; otherwise it goes to the Trash. A download that can't be weighed against the library's copy (that copy can't be read, or the two differ in length, as another cut does) is left where it is, and nothing is replaced; a second version kept on purpose (*Heat (1995) - Director's Cut.mkv*) is never taken for a duplicate. A bloated film or episode waits in a hidden folder in its library until Tdarr's copy is ready, and is filed then. New lossless music is stored as 256k AAC (`TIDY_SHRINK_LOSSLESS=false` keeps it lossless).

A film or episode already in the library twice (the same title and year, or the same episode of a show, and the same length) is found by the films' and TV's scan. `homelab media movies dedupe` (and `tv dedupe`) puts the extra copies in the Trash, after asking: the copy with the best picture stays (the tallest, then the newer codec, then the smaller file), each extra is checked again first (one changed since the scan stays, and so do its copies if the kept one no longer reads), and a version kept on purpose is never one.

TV's scan also says which episodes are missing: a gap in a season's numbering (*S02E01, E02, E05*: E03 and E04), read from the files alone, specials (season 0) left out. One missing after a season's last episode is past what the files can tell.

With Jellyfin set up here (its address and `JELLYFIN_API_KEY`), the films' and TV's scan also asks it which films or shows in that library it shows with no poster. **Fetch posters** (`homelab media movies posters`, `tv posters`) asks Jellyfin to look for those alone again; images are only added, never replaced.

## The download apps

`homelab media arr --apply` (or **Hand over** on the screen) turns Sonarr's, Radarr's, and Lidarr's renaming off, and their Completed Download Handling, which is what moves finished downloads into the libraries. They keep finding and downloading; the downloads stay in their folder, where the inbox files them. LazyLibrarian is told how by hand: turn its post-processing off.

## Commands

```bash
homelab media
```

```bash
homelab media preflight
```

```bash
homelab media music scan
```

```bash
homelab media movies run
```

```bash
homelab media inbox --apply
```

```bash
homelab media scrub
```

`homelab media help` lists every library's actions. A step that changes a library asks first in a terminal; from a script, `--yes` answers. `--background` runs a job detached, its log in `scripts/logs/media`.
