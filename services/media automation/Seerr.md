---
version: 0.1.0-alpha
---

# Seerr

Media requests for Jellyfin: family members ask for a film or show, and once approved it goes to Radarr or Sonarr. Seerr is the merged successor to Overseerr and Jellyseerr.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `seerr` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `ghcr.io/seerr-team/seerr:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install seerr` |
| Address | https://seerr.example.com (LAN, through Nginx Proxy Manager) |
| On this Mac | http://localhost:5055 (`SEERR_PORT`) |
| Data | `data/appdata/seerr` → `/app/config` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/seerr` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | overseerr, jellyseerr |
<!-- END homelab:generated -->

## Purpose

A friendly request page, so nobody has to use the *arr apps directly.

## Setup

1. `./homelab install seerr`, then `./homelab domain setup`.
2. Open https://seerr.example.com and choose Jellyfin. Server: `host.docker.internal`, port `8096`, with a Jellyfin admin login.
3. Services: Radarr `radarr:7878` and Sonarr `sonarr:8989` with their API keys, quality profiles, and root folders (`/movies`, `/tv`).
4. Import Jellyfin users; set who may request and who must be approved.

## How it works

- Seerr is a Node.js app written in TypeScript (a Next.js front end and an API server in one process). It keeps users, requests, and media status in a SQLite database and its settings in `settings.json`.
- Film and show information, posters, and the Discover pages come from TMDB through Seerr itself; you do not need your own TMDB key.
- People sign in with their Jellyfin accounts. Seerr checks the login against [Jellyfin](<../media/Jellyfin.md>), which runs as a native app on this Mac and is reached from the container at `host.docker.internal:8096`.
- An approved request goes to [Radarr](<Radarr.md>) or [Sonarr](<Sonarr.md>) through their APIs, with the quality profile and root folder chosen under Settings › Services.
- Background jobs (Settings › Jobs & Cache) scan Jellyfin's libraries and the Sonarr and Radarr queues, so a request moves from Requested to Processing to Available on its own.

## Where things live

| What | Where |
|---|---|
| Settings (Jellyfin, services, notifications, API key) | `data/appdata/seerr/settings.json` (`/app/config/settings.json`) |
| Database | `data/appdata/seerr/db/db.sqlite3` (`/app/config/db/db.sqlite3`) |
| Logs | `data/appdata/seerr/logs/` (`/app/config/logs`) |
| Daily database dump | `recovery-staging/databases/seerr` (by `./homelab backup`) |

## Everyday use

- Discover: trending, popular, and upcoming films and shows; the search bar finds any title.
- A title's page: Request (a show lets you choose seasons), or see whether it is already available.
- Requests: approve or decline pending requests, and see what is processing.
- Settings › Users: each person's permissions, auto-approve, and request limits.
- Issues: household members report a problem with a film or episode (wrong audio, bad subtitles), and you see it in one list.
- On phones, open https://seerr.example.com and add it to the home screen; it works as a web app.

## Connects to

- [Jellyfin](<../media/Jellyfin.md>) at `host.docker.internal`, port `8096`: sign-in, users, and library scans.
- [Radarr](<Radarr.md>) at `radarr:7878` and [Sonarr](<Sonarr.md>) at `sonarr:8989`, each with its API key (Settings › General › Security in that app).
- `./homelab wire` does not connect Seerr, because it needs your Jellyfin sign-in; it prints the steps instead.
- `.env`: `SEERR_PORT`, `TZ`.

## Tinkering ideas

- Settings › Users: give trusted people auto-approve and set request limits (so many requests per number of days) for everyone else.
- Settings › Notifications: tell people when their request is available, by email or through a webhook or chat service.
- Settings › General: change the Discover region and the original language filter to suit the household.
- Discover: add, remove, or reorder the sliders on the home page.
- Settings › Jellyfin: choose which Jellyfin libraries Seerr scans for availability.

## Useful commands

Follow the log, restart, list its data, check its status, and check that it can reach Sonarr.

```zsh
./homelab logs seerr -f
./homelab compose seerr restart seerr
./homelab compose seerr exec seerr ls /app/config /app/config/db
./homelab compose seerr exec seerr wget -qO- http://sonarr:8989/ping
curl -s http://localhost:5055/api/v1/status
```

## API

The key is under Settings › General (API Key). The base URL is `http://localhost:5055/api/v1/`, with the key in the `X-Api-Key` header. The interactive API reference is served by Seerr itself at http://localhost:5055/api-docs. This lists the latest requests:

```zsh
curl -s -H "X-Api-Key: YOUR_KEY" 'http://localhost:5055/api/v1/request?take=10'
```

## Learn more

- [Seerr on GitHub](https://github.com/seerr-team/seerr) (code, image, and links to the documentation)

## Backup

`data/appdata/seerr` (settings, users, requests) is in the Homelab AppData job.

## Troubleshooting

If availability is not updated, Settings > Jobs: run the Jellyfin library scan.
