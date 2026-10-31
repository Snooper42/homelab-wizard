---
version: 0.16.0
---

# Sonarr

TV automation: follows series, picks releases from the indexers, sends them to qBittorrent, and files finished episodes into the TV library.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `sonarr` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `lscr.io/linuxserver/sonarr:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install sonarr` |
| Address | https://sonarr.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8989 (`SONARR_PORT`) |
| Data | `data/appdata/sonarr` → `/config`<br>`/Volumes/Media/tv` → `/tv`<br>`/Volumes/Media/downloads` → `/downloads` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

New episodes of followed shows arrive in `/Volumes/Media/tv`, named and organised for Jellyfin.

## Setup

1. Open `https://<TAILSCALE_HOST>:8989` in Home mode, or `https://sonarr.example.com` with a domain, and set up authentication.
2. Settings › Media Management: root folder `/tv`.
3. Settings › Download Clients: qBittorrent, host `gluetun`, port `8082`, with qBittorrent's login. Category `tv`.
4. Indexers come from Prowlarr.

`./homelab wire --apply` (or Status › More… › **Connect apps**) does steps 3 and 4 for you once Prowlarr and qBittorrent run ([Prowlarr](<Prowlarr.md#connects-to>)).

## How it works

- Sonarr is a .NET (C#) server with a React web UI. Series, episodes, history, and most settings live in a SQLite database (`sonarr.db`); the port, authentication, and API key live in `config.xml`.
- Series and air dates come from Sonarr's own metadata service, which is based on TheTVDB.
- An RSS sync (every 15 minutes by default, Settings › Indexers) asks each indexer for new releases and grabs those that match a monitored episode and its quality profile. Searches for missing episodes go to every indexer.
- Indexers are created and kept up to date by [Prowlarr](<Prowlarr.md>); Sonarr's searches go through Prowlarr's address, `http://prowlarr:9696`.
- Grabs go to [qBittorrent](<qBittorrent.md>) with a category. Completed Download Handling watches qBittorrent's queue and, when a torrent finishes, imports the file from `/downloads` into `/tv/<Series>/Season NN/`.
- It reaches the other containers by service name on the shared `homelab` Docker network.

## Where things live

| What | Where |
|---|---|
| Settings and API key | `data/appdata/sonarr/config.xml` (`/config/config.xml`) |
| Database | `data/appdata/sonarr/sonarr.db` (`/config/sonarr.db`) |
| Logs | `data/appdata/sonarr/logs/` (`/config/logs/sonarr.txt`) |
| Scheduled app backups | `data/appdata/sonarr/Backups/` (`/config/Backups`) |
| Poster and fan-art cache | `data/appdata/sonarr/MediaCover/` (`/config/MediaCover`) |
| TV library | `${MEDIA_ROOT}/tv`, default `/Volumes/Media/tv` → `/tv` |
| Downloads | `DOWNLOADS_ROOT`, default `/Volumes/Media/downloads` → `/downloads` |

The download and library folders for the whole *arr set, from `compose/media-automation.yaml`:

| In the container | On this machine (defaults from `.env`) | Mounted in |
|---|---|---|
| `/downloads` | `DOWNLOADS_ROOT` = `/Volumes/Media/downloads` | qBittorrent, Sonarr, Radarr, Lidarr, LazyLibrarian |
| `/tv` | `${MEDIA_ROOT}/tv` = `/Volumes/Media/tv` | Sonarr, Bazarr |
| `/movies` | `${MEDIA_ROOT}/movies` = `/Volumes/Media/movies` | Radarr, Bazarr |
| `/music` | `${MEDIA_ROOT}/music` = `/Volumes/Media/music` | Lidarr |
| `/books` | `${MEDIA_ROOT}/Books` = `/Volumes/Media/Books` | LazyLibrarian |

Every app that imports from qBittorrent sees the downloads at the same path, `/downloads`, so the path qBittorrent reports is the path Sonarr opens and no remote path mapping is needed.

The layout is not hardlink-friendly. `/downloads` and `/tv` are two separate bind mounts, and a hard link or instant move cannot cross from one mount to another inside a container, even though both folders are on the same drive by default. Sonarr therefore copies each finished file into `/tv` while the torrent keeps seeding from `/downloads`, so an episode takes twice the space until the torrent is removed. The Remove Completed option in Sonarr's qBittorrent download client deletes the torrent and its files once qBittorrent has stopped seeding it.

## Everyday use

- Series › Add New: search for a show, choose root folder `/tv`, a quality profile, and what to monitor, and tick the box to start the search for missing episodes.
- Calendar: what airs this week. Activity › Queue: what is downloading or waiting to import.
- Wanted › Missing and Wanted › Cutoff Unmet: episodes still to get, or still below the profile's target quality.
- On a series page, the search buttons look for a whole season or one episode automatically; Interactive Search lists every release so you pick one.
- Activity › Queue: removing an item with its release blocklisted means it is never grabbed again (Activity › Blocklist).
- System › Status shows health warnings; System › Tasks shows and runs the scheduled jobs; System › Logs has the log files.
- On phones, nzb360 (Android) and Ruddarr (iOS) work with Sonarr through its API key.

## Connects to

- [Prowlarr](<Prowlarr.md>) adds and updates the indexers, using Sonarr's API key.
- [qBittorrent](<qBittorrent.md>) is the download client: host `gluetun`, port `8082`, with qBittorrent's Web UI login. qBittorrent shares [Gluetun](<Gluetun.md>)'s network, so `qbittorrent` is not a valid host.
- [Bazarr](<Bazarr.md>) and [Seerr](<Seerr.md>) use Sonarr's API key (Settings › General › Security) with the address `http://sonarr:8989`.
- [Jellyfin](<../media/Jellyfin.md>) reads the same library at `/Volumes/Media/tv`.
- `./homelab wire` adds Sonarr to Prowlarr and qBittorrent to Sonarr, reading Sonarr's key from `data/appdata/sonarr/config.xml`. The download client gets the category `tv`. See [Prowlarr](<Prowlarr.md#connects-to>) for everything it does.
- `.env`: `SONARR_PORT`, `MEDIA_ROOT`, `DOWNLOADS_ROOT`, `PUID` and `PGID` (owner of the files it writes), `TZ`.

## Tinkering ideas

- Settings › Profiles and Settings › Custom Formats: decide which releases win; the TRaSH Guides have tested profiles to copy.
- Settings › Import Lists: add shows automatically from a Trakt or IMDb list.
- Settings › Connect › Emby / Jellyfin: refresh Jellyfin as soon as an episode is imported (host `host.docker.internal`, port `8096`, an API key from Jellyfin's dashboard). Jellyfin sees the library at `/Volumes/Media/tv`, not `/tv`.
- Settings › Connect › ntfy: import and health notifications to [ntfy](<../security/ntfy.md>) at `http://ntfy`.
- Calendar › iCal Link: subscribe to the airing calendar in Apple Calendar.
- Settings › Media Management: turn on Rename Episodes and adjust the naming format (Show Advanced reveals more options).
- Hardlinks: mounting the drive once as `/data` in qBittorrent and every *arr (downloads in `/data/downloads`, the library in `/data/tv`) would make imports instant and free. It means editing `compose/media-automation.yaml` and every app's paths, and the drive must support hard links (APFS does, exFAT does not); it is untested here.

## Useful commands

Follow the log, restart, check both mounts from inside the container, read the API key, and connect the apps again.

```zsh
./homelab logs sonarr -f
./homelab compose sonarr restart sonarr
./homelab compose sonarr exec sonarr df -h /tv /downloads
./homelab compose sonarr exec sonarr ls /downloads
grep -o '<ApiKey>[^<]*' data/appdata/sonarr/config.xml | cut -d'>' -f2
./homelab wire --apply
```

## API

The key is in Settings › General › Security, or `<ApiKey>` in `data/appdata/sonarr/config.xml`. The base URL is `http://localhost:8989/api/v3/` from this Mac and `http://sonarr:8989/api/v3/` from other containers; send the key in the `X-Api-Key` header. This lists the download queue:

```zsh
curl -s -H "X-Api-Key: $(grep -o '<ApiKey>[^<]*' data/appdata/sonarr/config.xml | cut -d'>' -f2)" http://localhost:8989/api/v3/queue
```

Reference: [Sonarr API docs](https://sonarr.tv/docs/api/).

## Learn more

- [Sonarr](https://sonarr.tv)
- [Servarr wiki: Sonarr](https://wiki.servarr.com/sonarr)
- [Sonarr on GitHub](https://github.com/Sonarr/Sonarr)
- [LinuxServer image](https://github.com/linuxserver/docker-sonarr) and its [docs](https://docs.linuxserver.io/images/docker-sonarr/)
- [TRaSH Guides](https://trash-guides.info)

## Backup

`data/appdata/sonarr` (database, settings, history) is in the Homelab AppData job. The app also writes its own scheduled backups into `data/appdata/sonarr/Backups` (System › Backup).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Download client unreachable | qBittorrent is reached through Gluetun: host `gluetun`, not `qbittorrent` |
| Imports are slow copies | `/tv` and `/downloads` are separate mounts, so files are copied rather than moved. Acceptable for this library's size |
| "Path does not exist" on import | qBittorrent and Sonarr must both see downloads at `/downloads` |
