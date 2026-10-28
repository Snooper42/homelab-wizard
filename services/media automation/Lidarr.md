---
version: 0.14.0
---

# Lidarr

Music automation: follows artists and files new albums into the music library, where Navidrome picks them up.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `lidarr` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `lscr.io/linuxserver/lidarr:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install lidarr` |
| Address | https://lidarr.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8686 (`LIDARR_PORT`) |
| Data | `data/appdata/lidarr` → `/config`<br>`/Volumes/Media/music` → `/music`<br>`/Volumes/Media/downloads` → `/downloads` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

New albums by followed artists arrive in `/Volumes/Media/music`.

## Setup

1. Open `https://<TAILSCALE_HOST>:8686` in Home mode, or `https://lidarr.example.com` with a domain, and set up authentication.
2. Settings > Media Management: root folder `/music`.
3. Settings > Download Clients: qBittorrent, host `gluetun`, port `8082`. Category `music`.
4. Indexers come from Prowlarr.

Navidrome sees new albums at its next hourly scan.

## How it works

- Lidarr comes from the same code base as Sonarr: a .NET (C#) server with a React web UI, a SQLite database (`lidarr.db`), and `config.xml` for the port, authentication, and API key.
- Artist and album data comes from Lidarr's metadata service, which is built on MusicBrainz, so artists and releases match MusicBrainz entries.
- Two kinds of profile decide what it wants: quality profiles (lossless or lossy formats) and metadata profiles (which release types count: albums, EPs, singles, live, compilations).
- Indexers come from [Prowlarr](<Prowlarr.md>); grabs go to [qBittorrent](<qBittorrent.md>) at `gluetun:8082`. Finished albums are imported from `/downloads` into `/music/<Artist>/<Album>/`.
- Its API is version 1 (`/api/v1`), unlike Sonarr's and Radarr's `/api/v3`.

## Where things live

| What | Where |
|---|---|
| Settings and API key | `data/appdata/lidarr/config.xml` (`/config/config.xml`) |
| Database | `data/appdata/lidarr/lidarr.db` (`/config/lidarr.db`) |
| Logs | `data/appdata/lidarr/logs/` (`/config/logs/lidarr.txt`) |
| Scheduled app backups | `data/appdata/lidarr/Backups/` (`/config/Backups`) |
| Music library | `${MEDIA_ROOT}/music`, default `/Volumes/Media/music` → `/music` |
| Downloads | `DOWNLOADS_ROOT`, default `/Volumes/Media/downloads` → `/downloads` |

`/music` and `/downloads` are separate mounts, so imports are copies, not hard links; [Sonarr](<Sonarr.md#where-things-live>) explains the folder layout for the whole set.

## Everyday use

- Library › Add New: search for an artist, choose root folder `/music`, a quality profile, a metadata profile, and which albums to monitor.
- An artist's page lists their albums; monitor or search one album at a time, or use Interactive Search to pick a release.
- Calendar: upcoming releases by followed artists. Activity › Queue: downloads and imports.
- Wanted › Missing and Wanted › Cutoff Unmet: albums still to get or to upgrade.
- Library › Unmapped Files: files Lidarr found in `/music` but could not match to an album.
- On Android, nzb360 works with Lidarr through its API key.

## Connects to

- [Prowlarr](<Prowlarr.md>) adds and updates the indexers, using Lidarr's API key.
- [qBittorrent](<qBittorrent.md>) is the download client: host `gluetun`, port `8082`.
- [Navidrome](<../media/Navidrome.md>) reads the same folder, read-only, at `/Volumes/Media/music` and scans it every hour; [Feishin](<../media/Feishin.md>) plays it from Navidrome.
- `./homelab wire` adds Lidarr to Prowlarr and qBittorrent to Lidarr (category `music`). See [Prowlarr](<Prowlarr.md#connects-to>).
- `.env`: `LIDARR_PORT`, `MEDIA_ROOT`, `DOWNLOADS_ROOT`, `PUID`, `PGID`, `TZ`.

## Tinkering ideas

- Settings › Profiles: trim the metadata profile to studio albums only, so artists do not pull in every single and live bootleg.
- Settings › Import Lists: follow artists from Last.fm or Spotify playlists automatically.
- Settings › Metadata: have Lidarr write tags into the files, so Navidrome shows the same artist and album names.
- Settings › Media Management: turn on Rename Tracks and pick a track naming format.
- Settings › Connect › ntfy: import notifications to [ntfy](<../security/ntfy.md>) at `http://ntfy`.

## Useful commands

Follow the log, restart, check the mounts, and read the API key.

```zsh
./homelab logs lidarr -f
./homelab compose lidarr restart lidarr
./homelab compose lidarr exec lidarr df -h /music /downloads
grep -o '<ApiKey>[^<]*' data/appdata/lidarr/config.xml | cut -d'>' -f2
```

## API

The key is in Settings › General › Security, or `<ApiKey>` in `data/appdata/lidarr/config.xml`. The base URL is `http://localhost:8686/api/v1/` (`http://lidarr:8686/api/v1/` from other containers), with the key in the `X-Api-Key` header. This lists the followed artists:

```zsh
curl -s -H "X-Api-Key: $(grep -o '<ApiKey>[^<]*' data/appdata/lidarr/config.xml | cut -d'>' -f2)" http://localhost:8686/api/v1/artist
```

Reference: [Lidarr API docs](https://lidarr.audio/docs/api/).

## Learn more

- [Lidarr](https://lidarr.audio)
- [Servarr wiki: Lidarr](https://wiki.servarr.com/lidarr)
- [Lidarr on GitHub](https://github.com/Lidarr/Lidarr)
- [LinuxServer image](https://github.com/linuxserver/docker-lidarr)

## Backup

`data/appdata/lidarr` (database, settings, history) is in the Homelab AppData job. The app also writes its own scheduled backups into `data/appdata/lidarr/Backups` (System > Backup).

## Troubleshooting

See [Sonarr](<Sonarr.md>); the same fixes apply with `/music`.
