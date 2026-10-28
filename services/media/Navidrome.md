---
version: 0.12.0
---

# Navidrome

The music server. It indexes the music folder and streams it to Feishin and to any Subsonic-compatible app.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `navidrome` in `compose/media.yaml` (project `homelab_media`) |
| Image | `deluan/navidrome:latest` |
| Category | Media |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://navidrome.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this machine | http://localhost:4533 (`NAVIDROME_PORT`) |
| Data | `data/appdata/navidrome` → `/data`<br>`/Volumes/Media/music, read-only` → `${NAVIDROME_MUSIC_PATH:-${MEDIA_ROOT:-/Volumes/Media}/music}` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/navidrome` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

- The household's music library, streamed anywhere.
- Playlists from `.m3u` files in the library are imported automatically. The library is mounted at the same path as on the Mac, so absolute paths in playlists work.

## Setup

1. Open `https://<TAILSCALE_HOST>:4533` in Home mode, or `https://navidrome.example.com` with a domain; the first account becomes the administrator.
2. Create a user per person.
3. Phone apps (for example Amperfy, play:Sub, Substreamer): server: the same address, with the user's login.

The library is rescanned every hour; Settings > Scan library forces one now.

## How it works

- Navidrome is a single Go program that serves its own web player and the Subsonic API (`/rest/...`, with the OpenSubsonic extensions), which almost every third-party music app speaks.
- It reads the tags of your files and keeps what it learns in one SQLite database, `navidrome.db`, along with users, play counts, ratings, and playlists. The music folder is mounted read-only, so it never changes your files.
- A scan runs every hour (`ND_SCANSCHEDULE: 1h`). `.m3u` playlists in the library are imported during scans (`ND_AUTOIMPORTPLAYLISTS`).
- When a player asks for a lower bitrate or another format, ffmpeg in the image transcodes on the fly. Transcoded files and artwork are cached under `/data/cache`.
- Its settings are `ND_*` environment variables in `compose/media.yaml`. Feishin and phone apps reach it over HTTPS at its public address.

## Where things live

| What | Where |
|---|---|
| Music (read-only) | `/Volumes/Media/music`, at the same path inside the container (`ND_MUSICFOLDER`) |
| App data | `data/appdata/navidrome` → `/data` |
| Database | `/data/navidrome.db` |
| Transcoding and artwork cache | `/data/cache` (safe to delete; it is rebuilt) |
| Settings | `ND_*` variables under `navidrome:` in `compose/media.yaml` |
| Logs | Container output only (`./homelab logs navidrome`), at level `warn` (`ND_LOGLEVEL`) |

## Everyday use

- Play in the browser at https://navidrome.example.com, or use [Feishin](<Feishin.md>) at https://music.example.com for a fuller player.
- Star and rate songs, albums, and artists; ratings and play counts follow you to every app.
- The user menu (top right) › Personal: theme, language, and the ListenBrainz link for scrobbling.
- Share an album or playlist with someone without an account: its Share action makes a public link.
- Admins add people under Users and set a maximum bitrate per device under Players.
- Phone apps: Amperfy and play:Sub (iOS), Symfonium and Tempo (Android), Substreamer (both). On a computer: the Feishin desktop app.

## Connects to

- [Feishin](<Feishin.md>) is its web player; you sign in to it with your Navidrome account.
- [Lidarr](<../media automation/Lidarr.md>) files new albums into `/Volumes/Media/music`; they appear after the next hourly scan.
- [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>) publishes it, so phone apps work away from home.
- `.env`: `MEDIA_ROOT` sets the music path, `NAVIDROME_PORT` the port on this Mac (default 4533), `TZ` the time zone.
- It gives out no API key: Subsonic apps sign in with each person's own name and password.

## Tinkering ideas

- Smart playlists: save a `.nsp` file (JSON rules, such as rating 4 or more and played in the last month) in the music folder; the next scan turns it into a self-updating playlist.
- Scrobble to ListenBrainz: paste your ListenBrainz token under the user menu › Personal.
- Lyrics: Navidrome shows lyrics embedded in the tags or from `.lrc` files beside the tracks, in Feishin and in apps that support them.
- Save mobile data: in Players, pick the phone app's player and set a transcoding format (Opus) and a maximum bitrate.
- Download playlists in Amperfy or Symfonium for offline listening before a trip.
- Tidy tags with MusicBrainz Picard on this Mac before albums go in; Navidrome groups albums by album artist and MusicBrainz IDs.

## Useful commands

The Subsonic API takes a username and password in the query string (`u` and `p`); replace `USER` and `PASSWORD`. Starting a scan needs an admin account.

```zsh
./homelab logs navidrome -f
./homelab compose navidrome restart navidrome
./homelab compose navidrome exec navidrome ls -la /data
curl -s http://localhost:4533/ping
curl -s "http://localhost:4533/rest/ping.view?u=USER&p=PASSWORD&v=1.16.1&c=curl&f=json"
curl -s "http://localhost:4533/rest/startScan.view?u=USER&p=PASSWORD&v=1.16.1&c=curl&f=json"
curl -s "http://localhost:4533/rest/getScanStatus.view?u=USER&p=PASSWORD&v=1.16.1&c=curl&f=json"
```

## API

- Base URL: `http://localhost:4533/rest/` on this Mac, or `https://navidrome.example.com/rest/`.
- Authentication: each request carries `u` (user) and either `p` (password) or the safer token pair `t` (MD5 of password plus salt) and `s` (the salt), plus `v` (API version), `c` (client name), and `f=json`.
- Example: `getAlbumList2.view?type=newest&size=10` lists the latest additions (same parameters as the calls above).
- Reference: the Subsonic API at https://www.subsonic.org/pages/api.jsp; Navidrome's docs list which endpoints it supports.

## Learn more

- Documentation: https://www.navidrome.org/docs/
- Source: https://github.com/navidrome/navidrome
- Image: https://hub.docker.com/r/deluan/navidrome

## Backup

`data/appdata/navidrome` (database of users, play counts, ratings, playlists) is in the Homelab AppData job. The music itself is not backed up.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Library empty | The drive was not mounted. `./homelab doctor`, then rescan |
| Playlist missing tracks | Paths in the `.m3u` must match `/Volumes/Media/music/...` |
