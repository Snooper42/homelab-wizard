---
version: 0.12.0
---

# Radarr

Movie automation: like Sonarr, for films.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `radarr` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `lscr.io/linuxserver/radarr:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install radarr` |
| Address | https://radarr.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:7878 (`RADARR_PORT`) |
| Data | `data/appdata/radarr` → `/config`<br>`/Volumes/Media/movies` → `/movies`<br>`/Volumes/Media/downloads` → `/downloads` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Wanted movies arrive in `/Volumes/Media/movies`, named and organised for Jellyfin.

## Setup

1. Open `https://<TAILSCALE_HOST>:7878` in Home mode, or `https://radarr.example.com` with a domain, and set up authentication.
2. Settings > Media Management: root folder `/movies`.
3. Settings > Download Clients: qBittorrent, host `gluetun`, port `8082`. Category `movies`.
4. Indexers come from Prowlarr.

## How it works

- Radarr is a fork of Sonarr and works the same way: a .NET (C#) server with a React web UI, a SQLite database (`radarr.db`), and `config.xml` for the port, authentication, and API key.
- Film metadata comes from Radarr's own metadata service, which is based on TMDb.
- An RSS sync (every 15 minutes by default) grabs new releases for monitored films that are not yet in the library or below the profile's target quality.
- Indexers come from [Prowlarr](<Prowlarr.md>); grabs go to [qBittorrent](<qBittorrent.md>) at `gluetun:8082`. When a torrent finishes, Radarr imports the file from `/downloads` into `/movies/<Title (Year)>/`.
- It reaches the other containers by service name on the shared `homelab` Docker network.

## Where things live

| What | Where |
|---|---|
| Settings and API key | `data/appdata/radarr/config.xml` (`/config/config.xml`) |
| Database | `data/appdata/radarr/radarr.db` (`/config/radarr.db`) |
| Logs | `data/appdata/radarr/logs/` (`/config/logs/radarr.txt`) |
| Scheduled app backups | `data/appdata/radarr/Backups/` (`/config/Backups`) |
| Poster and fan-art cache | `data/appdata/radarr/MediaCover/` (`/config/MediaCover`) |
| Film library | `${MEDIA_ROOT}/movies`, default `/Volumes/Media/movies` → `/movies` |
| Downloads | `DOWNLOADS_ROOT`, default `/Volumes/Media/downloads` → `/downloads` |

`/movies` and `/downloads` are separate mounts, so imports are copies, not hard links; [Sonarr](<Sonarr.md#where-things-live>) explains the folder layout for the whole set.

## Everyday use

- Movies › Add New: search for a film, choose root folder `/movies`, a quality profile, and whether to search straight away.
- Movies › Discover: popular and upcoming films, and recommendations based on the library.
- Collections: film series (all the films in a franchise), with one switch to monitor the whole collection.
- Calendar: cinema, digital, and physical release dates. Activity › Queue: what is downloading or waiting to import.
- Wanted › Missing and Wanted › Cutoff Unmet: films still to get or to upgrade.
- On a film's page, Search Movie looks automatically; Interactive Search lists every release so you pick one.
- On phones, nzb360 (Android) and Ruddarr (iOS) work with Radarr through its API key.

## Connects to

- [Prowlarr](<Prowlarr.md>) adds and updates the indexers, using Radarr's API key.
- [qBittorrent](<qBittorrent.md>) is the download client: host `gluetun`, port `8082`.
- [Seerr](<Seerr.md>) sends approved film requests here; [Bazarr](<Bazarr.md>) adds subtitles. Both use Radarr's API key (Settings › General › Security) with the address `http://radarr:7878`.
- [Jellyfin](<../media/Jellyfin.md>) reads the same library at `/Volumes/Media/movies`.
- `./homelab wire` adds Radarr to Prowlarr and qBittorrent to Radarr (category `movies`). See [Prowlarr](<Prowlarr.md#connects-to>).
- `.env`: `RADARR_PORT`, `MEDIA_ROOT`, `DOWNLOADS_ROOT`, `PUID`, `PGID`, `TZ`.

## Tinkering ideas

- Settings › Import Lists: add films automatically from TMDb, Trakt, or IMDb lists.
- Collections: monitor a whole franchise so new entries are added when announced.
- Settings › Custom Formats and Settings › Profiles: prefer the releases you want; the TRaSH Guides have tested profiles.
- Settings › Connect › Emby / Jellyfin: refresh Jellyfin as soon as a film is imported (host `host.docker.internal`, port `8096`).
- Settings › Connect › ntfy: notifications to [ntfy](<../security/ntfy.md>) at `http://ntfy`.
- Settings › Media Management: turn on Rename Movies and choose a folder and file format Jellyfin matches well.
- Calendar › iCal Link: release dates in Apple Calendar.

## Useful commands

Follow the log, restart, check the mounts, and read the API key.

```zsh
./homelab logs radarr -f
./homelab compose radarr restart radarr
./homelab compose radarr exec radarr df -h /movies /downloads
grep -o '<ApiKey>[^<]*' data/appdata/radarr/config.xml | cut -d'>' -f2
```

## API

The key is in Settings › General › Security, or `<ApiKey>` in `data/appdata/radarr/config.xml`. The base URL is `http://localhost:7878/api/v3/` (`http://radarr:7878/api/v3/` from other containers), with the key in the `X-Api-Key` header. This lists the films in the library:

```zsh
curl -s -H "X-Api-Key: $(grep -o '<ApiKey>[^<]*' data/appdata/radarr/config.xml | cut -d'>' -f2)" http://localhost:7878/api/v3/movie
```

Reference: [Radarr API docs](https://radarr.video/docs/api/).

## Learn more

- [Radarr](https://radarr.video)
- [Servarr wiki: Radarr](https://wiki.servarr.com/radarr)
- [Radarr on GitHub](https://github.com/Radarr/Radarr)
- [LinuxServer image](https://github.com/linuxserver/docker-radarr)
- [TRaSH Guides](https://trash-guides.info)

## Backup

`data/appdata/radarr` (database, settings, history) is in the Homelab AppData job. The app also writes its own scheduled backups into `data/appdata/radarr/Backups` (System > Backup).

## Troubleshooting

See [Sonarr](<Sonarr.md>); the same fixes apply with `/movies`.
