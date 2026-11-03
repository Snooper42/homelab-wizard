---
version: 0.17.0
---

# Tidy Up

Tidy Up keeps the libraries on the media drive (`MEDIA_ROOT`) sorted, tagged, and lean: music, books, films, TV, and audiobooks. It has its own screen in the app, and `homelab media` does the same from a terminal. Everything it throws away goes to the Trash (the Recycle Bin on Windows), never straight away.

## The screen

**Overview** is one list, **Needs your OK**: the next thing each library waits on (a scan, a swap, films to shrink, books to look over), what it wins back, and its one button. Beside it, a ring of your music's genres (`homelab media music genre-counts`), the media drive with what each library takes and what is free (measured in the background, at most every six hours, into `~/.homelab-media/sizes.json`), and **Recently done**, with **Undo** on the music swap until the space is freed, and on the books' last apply. Each library has its own tab: what could be tidier, its space, and its history.

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

`homelab media` writes `data/homelab_media.json` from `.env` before every run (the **Tidy Up** section of Settings): the libraries under `MEDIA_ROOT`, the folders to watch, the languages to keep, Tdarr's codec, where lyrics go, and the address of each media server that is installed. Keys and passwords (`JELLYFIN_API_KEY`, `NAVIDROME_ADMIN_PASSWORD`, `PLEX_TOKEN`, `AUDIOBOOKSHELF_API_KEY`, `TDARR_API_KEY`) reach the engines in their environment, never on a command line or in that file. Reports go to `reports/media` in the homelab folder, not Downloads, which the inbox watches.

## How it keeps out of the way

- **One job moves files at a time:** `data/homelab.media.lock` holds the job's process, and a job that crashed leaves a lock the next run takes over, carrying on where it stopped. Transcodes aren't under the lock: Tdarr's own queue and its nodes' worker limits pace them; only putting their results in place is.
- **While a job runs,** the nightly update leaves every app that reads a library (Navidrome, beets, Calibre-Web, Komga, Kavita, Audiobookshelf, Jellyfin, the *arr apps, Tdarr) for the next night, `homelab update` refuses them alone, and Duplicati's scheduled backups are paused, then resumed.
- **Power:** building the music library, merging audiobooks, lyrics, and handing videos to Tdarr wait for power and stop at a safe point when a laptop goes on battery; the battery saver pauses Tdarr too.
- **The agent's minute:** the inbox when Downloads changed, Tdarr's finished work every few minutes, and the scrubber daily at 03:00. `TIDY_UP=false` turns all three off; `TIDY_INBOX` and `TIDY_SCRUB` each one.

## Before a run

`homelab media preflight` checks Python (on a Mac, Homebrew's, or Apple's only with its developer tools, so no install prompt appears), the media drive, the container runtime, a graphics card for Tdarr, power, ffmpeg and ffprobe, ffsubsync, m4b-tool, and Calibre's tools, each with its fix. Calibre is found on PATH, as the Mac app, in Program Files, in `/opt/calibre`, in a home folder (where Calibre's installer puts it on SteamOS, whose `/` is read-only), or as the Flatpak from Discover, whose tools it runs through `flatpak run`; `CALIBRE_BIN_DIR` points at another place. ffmpeg from Homebrew or Nix on Linux is found too. Tidy Up's screen shows the same under **This machine**.

## Shrink & Strip

New downloads are compared with what the library has. A duplicate replaces the library's copy only when it is leaner for the same picture or sound: AV1 over HEVC over H.264 at the same resolution and length, high-quality AAC or Opus over a huge FLAC; otherwise it goes to the Trash. A download that can't be weighed against the library's copy (that copy can't be read, or the two differ in length, as another cut does) is left where it is, and nothing is replaced; a second version kept on purpose (*Heat (1995) - Director's Cut.mkv*) is never taken for a duplicate. A bloated film or episode waits in a hidden folder in its library until Tdarr's copy is ready, and is filed then. New lossless music is stored as 256k AAC (`TIDY_SHRINK_LOSSLESS=false` keeps it lossless).

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
