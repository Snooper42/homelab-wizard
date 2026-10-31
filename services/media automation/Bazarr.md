---
version: 0.16.0
---

# Bazarr

Subtitles for everything Sonarr and Radarr manage: finds, downloads, and keeps them in sync.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `bazarr` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `lscr.io/linuxserver/bazarr:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install bazarr` |
| Address | https://bazarr.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:6767 (`BAZARR_PORT`) |
| Data | `data/appdata/bazarr` → `/config`<br>`/Volumes/Media/tv` → `/tv`<br>`/Volumes/Media/movies` → `/movies` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Subtitles in the household's languages next to every episode and film.

## Setup

1. Open `https://<TAILSCALE_HOST>:6767` in Home mode, or `https://bazarr.example.com` with a domain, and set up authentication (Settings › General).
2. Settings › Sonarr: address `sonarr`, port `8989`, API key. Settings › Radarr: address `radarr`, port `7878`, API key. The paths are the same in all three apps, so no path mapping is needed.
3. Settings › Languages: create a language profile and make it the default.
4. Settings › Providers: add subtitle providers.

`./homelab wire --apply` (or Status › More… › **Connect apps**) does step 2 for you once Bazarr, Sonarr, and Radarr run, and corrects a key that changed. Steps 3 and 4 are choices of yours: which languages, and which providers.

## How it works

- Bazarr is a Python web app with a React UI. It keeps its list of series, films, and subtitles in a SQLite database and its settings in `config.yaml`.
- It does not scan folders on its own: it reads the series and films from Sonarr's and Radarr's APIs, keeps in step with them on a schedule and through their live update feeds, and then looks at the files on disk.
- For each file missing a subtitle in the language profile, it asks the enabled providers, scores each result against the release (name, group, resolution, hash), and downloads the best one above the minimum score.
- Subtitles are saved next to the video, for example `Episode.en.srt`, where [Jellyfin](<../media/Jellyfin.md>) picks them up as external subtitles.
- It sees the libraries at the same `/tv` and `/movies` paths as Sonarr and Radarr, which is why no path mapping is needed. It has no `/downloads` mount: it only works on files already in the library.

## Where things live

| What | Where |
|---|---|
| Settings and API key | `data/appdata/bazarr/config/config.yaml` (`/config/config/config.yaml`) |
| Database | `data/appdata/bazarr/db/bazarr.db` (`/config/db/bazarr.db`) |
| Logs | `data/appdata/bazarr/log/` (`/config/log/bazarr.log`) |
| App backups | `data/appdata/bazarr/backup/` (`/config/backup`) |
| TV library | `${MEDIA_ROOT}/tv`, default `/Volumes/Media/tv` → `/tv` |
| Film library | `${MEDIA_ROOT}/movies`, default `/Volumes/Media/movies` → `/movies` |

## Everyday use

- Series and Movies: subtitle status per episode or film; open one to search, upload, or delete a subtitle by hand.
- Wanted › Series and Wanted › Movies: everything still missing a subtitle, with a button to search them all.
- History: what was downloaded, from which provider, and with what score.
- System › Providers: which providers are throttled or failing right now.
- System › Tasks: run a sync with Sonarr or Radarr, or a disk scan, immediately.

## Connects to

- [Sonarr](<Sonarr.md>) at `sonarr`, port `8989`, and [Radarr](<Radarr.md>) at `radarr`, port `7878`, each with its API key (Settings › General › Security in that app).
- [Jellyfin](<../media/Jellyfin.md>) shows the `.srt` files Bazarr writes next to the media.
- `./homelab wire` does not connect Bazarr; it prints these steps as a reminder.
- `.env`: `BAZARR_PORT`, `MEDIA_ROOT`, `PUID`, `PGID`, `TZ`.

## Tinkering ideas

- Settings › Subtitles: turn on automatic synchronisation, which shifts downloaded subtitles to match the audio.
- Settings › Providers: add the Embedded Subtitles provider, so subtitles already inside the video file count and are not downloaded again.
- Settings › Languages: allow hearing-impaired or forced subtitles per language, and set a cutoff so Bazarr stops after the first good match.
- Settings › Providers: add a free OpenSubtitles.com account for better limits than anonymous use.
- Settings › Sonarr and Settings › Radarr: raise the minimum score if wrong subtitles get through, or lower it if nothing is found.
- Settings › Notifications: send download notices to [ntfy](<../security/ntfy.md>) (Bazarr's notifications go through Apprise, which supports ntfy).

## Useful commands

Follow the log, restart, check that Bazarr can reach Sonarr and Radarr, and look at the libraries as Bazarr sees them.

```zsh
./homelab logs bazarr -f
./homelab compose bazarr restart bazarr
./homelab compose bazarr exec bazarr curl -s http://sonarr:8989/ping
./homelab compose bazarr exec bazarr curl -s http://radarr:7878/ping
./homelab compose bazarr exec bazarr ls /tv /movies
```

## Learn more

- [Bazarr](https://www.bazarr.media)
- [Bazarr wiki](https://wiki.bazarr.media)
- [Bazarr on GitHub](https://github.com/morpheus65535/bazarr)
- [LinuxServer image](https://github.com/linuxserver/docker-bazarr)

## Backup

`data/appdata/bazarr` (database, settings) is in the Homelab AppData job.

## Troubleshooting

If nothing is found, check the providers' status (System › Providers); free providers throttle heavily.
