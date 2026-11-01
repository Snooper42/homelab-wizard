---
version: 0.16.0
---

# beets

Tags, renames, and sorts music into the library.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `beets` in `compose/media.yaml` (project `homelab_media`) |
| Image | `lscr.io/linuxserver/beets:latest` |
| Category | Media |
| Starts with `./homelab up` | No: optional, `./homelab install beets` |
| Address | this computer only: it has no sign-in of its own, so it gets no tailnet or domain address |
| On this machine | http://localhost:8337 (`BEETS_PORT`) |
| Data | `data/appdata/beets` → `/config`<br>`/Volumes/Media/music` → `/music`<br>`/Volumes/Media/downloads` → `/downloads` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/beets` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

- Keeps the music library tidy: it matches each album you add against MusicBrainz, fixes its tags, adds the cover and a genre, and files it as `Album Artist/Album (Year)/01 Title` in `/Volumes/Media/music`.
- For music that arrives by hand (CD rips, purchases, a friend's drive). [Navidrome](<Navidrome.md>) and every music app then group albums, artists, and covers properly.
- Its web page at http://localhost:8337 browses and searches the library on this computer. It is read-only, and it has no sign-in, so it gets no tailnet or domain address.

## Setup

1. `./homelab install beets`. Its settings, `data/appdata/beets/config.yaml`, are copied from `config/beets` the first time and are yours to change after.
2. Put new music in a folder under the downloads folder, for example `/Volumes/Media/downloads/music/Some Album`.
3. Import it. beets shows each match and asks when it is unsure (**A** applies, **S** skips, **U** imports as is, **E** enters a MusicBrainz ID):

   ```zsh
   ./homelab compose beets exec -u abc beets beet import /downloads/music
   ```

4. The files move into the library. Navidrome picks them up at its next hourly scan, or now with Settings › Scan library.

To bring music already in the library under beets without moving anything, import it in place once: `beet import -C -W /music` lists it in beets' database (`-C` no copy or move, `-W` no tag writes). Drop `-W` to let it fix the tags too.

## How it works

- beets is a command-line music organizer. The container keeps one running program, `beet web`, which serves the library page; imports and every other command run with `exec` inside it.
- `library.db` is beets' SQLite database of every track it has imported: its tags, its path, and the MusicBrainz IDs it matched. The files are the truth: tags are written into them (`write: yes`), so Navidrome reads the same.
- `move: yes` moves files out of `/downloads` instead of copying them, so nothing is left twice. `fetchart` and `embedart` save a `cover.jpg` beside each album and in each file; `lastgenre` fills in a genre from Last.fm; `scrub` strips old, conflicting tags before the new ones are written.
- File names avoid characters exFAT and NTFS refuse (`replace:` in the settings), so the library can sit on any drive.

## Where things live

| What | Where |
|---|---|
| Settings | `data/appdata/beets/config.yaml` (the starter copy is `config/beets/config.yaml`) |
| Database | `data/appdata/beets/library.db` |
| Import log (what was skipped, and why) | `data/appdata/beets/import.log` |
| Library | `/Volumes/Media/music` → `/music` |
| New music | `/Volumes/Media/downloads` → `/downloads` |

## Everyday use

- Search the library: `beet ls artist:Radiohead`, `beet ls -a year:1990..1999` for albums, `beet stats` for a count.
- Fix one album that matched wrongly: `beet import -L album:"Album name"` re-matches it from the library.
- Change a tag by hand: `beet modify album:"Album name" genre=Jazz`, then it writes the files.
- Import without questions (an overnight batch): `beet import -q /downloads/music` skips anything it is unsure of, and `import.log` lists those to do by hand later.

Prefix each with `./homelab compose beets exec -u abc beets` (`-u abc` runs it as the user the files belong to, not as root).

## Connects to

- [Navidrome](<Navidrome.md>) plays what beets files: the same `/Volumes/Media/music`, read-only there.
- [Lidarr](<../media automation/Lidarr.md>), if you run it, already renames and files what it downloads. Leave its albums out of beets' imports, so the two do not move the same files.
- `.env`: `MEDIA_ROOT` sets the music path, `DOWNLOADS_ROOT` the downloads folder, `BEETS_PORT` the page's port on this computer (default 8337), `PUID` and `PGID` the owner of the files it writes.

## Tinkering ideas

- Acoustic fingerprints for files with no tags at all: add `chroma` to `plugins:` (the image has `fpcalc`).
- ReplayGain so every album plays at the same loudness: add `replaygain` with `backend: ffmpeg`.
- Lyrics into the tags, which Navidrome and Feishin show: add `lyrics` with `auto: yes`.
- A playlist of everything added this month: the `smartplaylist` plugin writes `.m3u` files into the library, which Navidrome imports.

## Useful commands

```zsh
./homelab logs beets -f
./homelab compose beets exec -u abc beets beet import /downloads/music
./homelab compose beets exec -u abc beets beet stats
./homelab compose beets exec -u abc beets beet config
curl -s http://localhost:8337/stats
```

## API

- `beet web` answers JSON at http://localhost:8337: `/stats`, `/item/`, `/album/`, `/item/query/<query>`, `/album/<id>/art`.
- Read-only in this setup (`readonly: yes`), and only on this computer.
- Reference: https://beets.readthedocs.io/en/stable/plugins/web.html

## Learn more

- Documentation: https://beets.readthedocs.io/
- Source: https://github.com/beetbox/beets
- Image: https://docs.linuxserver.io/images/docker-beets/

## Backup

`data/appdata/beets` (the settings and `library.db`) is in the Homelab AppData job, and `./homelab backup` takes a consistent copy of `library.db` daily. The music itself is not backed up; the tags beets wrote are in the files, so a lost database is rebuilt with `beet import -C -W /music`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| The page does not open | It starts after beets has read its settings; a mistake in `config.yaml` stops it. `./homelab logs beets` names the line. `beet config` shows what it read |
| "Permission denied" moving or writing files | The music and downloads folders belong to someone other than `PUID`/`PGID` in `.env`. Set them to the owner (`id -u`, `id -g`) and `./homelab compose beets up -d` |
| An album was skipped | `import.log` has why. Import that folder again without `-q` and answer, or enter its MusicBrainz release ID with **E** |
| An `.m3u` playlist lost its tracks | beets moved and renamed them. Point the playlist at the new paths, or let `smartplaylist` write playlists for you |
| An album shows twice in Navidrome | Two copies were kept (**K** at a duplicate). `beet ls -a album:"Album name" -p` shows both paths; `beet rm -d` removes one with its files |
