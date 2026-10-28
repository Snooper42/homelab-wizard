---
version: 0.12.0
---

# Prowlarr

The indexer manager for the *arr apps: add each indexer once here, and Prowlarr keeps Sonarr, Radarr, Lidarr, and LazyLibrarian in sync.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `prowlarr` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `lscr.io/linuxserver/prowlarr:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install prowlarr` |
| Address | https://prowlarr.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:9696 (`PROWLARR_PORT`) |
| Data | `data/appdata/prowlarr` → `/config` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

One place to manage indexers, their credentials, and their health.

## Setup

1. `./homelab install @arr` (Choose stacks › **Media automation**) installs Prowlarr with Sonarr, Radarr, Lidarr, Bazarr, FlareSolverr, qBittorrent with [Gluetun](<Gluetun.md>) (once `PROTONVPN_WIREGUARD_PRIVATE_KEY` is set), and Seerr.
2. Open `https://<TAILSCALE_HOST>:9696` in Home mode, or `https://prowlarr.example.com` with a domain, and set up authentication (Forms, with a username and password).
3. Settings > Apps: add each app by service name and its API key (from the app's Settings > General):
   - Sonarr `http://sonarr:8989`, Radarr `http://radarr:7878`, Lidarr `http://lidarr:8686`, LazyLibrarian `http://lazylibrarian:5299`
   - Prowlarr server: `http://prowlarr:9696`
4. Settings > Indexers: add FlareSolverr ([FlareSolverr](<FlareSolverr.md>)).
5. Add indexers; they appear in the apps automatically.

## How it works

- Prowlarr comes from the same code base as Sonarr: a .NET (C#) server with a React web UI, a SQLite database (`prowlarr.db`), and `config.xml` for the port, authentication, and API key.
- Most indexers are described by definition files (Cardigann YAML) that Prowlarr downloads and keeps up to date in `/config/Definitions`; a few have built-in code.
- For each app under Settings › Apps, Prowlarr uses that app's API key to create one indexer entry per Prowlarr indexer. Each entry points back at Prowlarr (`http://prowlarr:9696/<indexer id>/`), so the app's searches run through Prowlarr, which translates them for the site.
- With sync level Full Sync, adding, changing, or removing an indexer here does the same in every app.
- Indexers tagged `flaresolverr` send their requests through [FlareSolverr](<FlareSolverr.md>) at `http://flaresolverr:8191`, which opens the page in a headless browser.
- It checks each indexer's health, backs off from failing ones for a while, and records every query and grab under History.

## Where things live

| What | Where |
|---|---|
| Settings and API key | `data/appdata/prowlarr/config.xml` (`/config/config.xml`) |
| Database (indexers, apps, history) | `data/appdata/prowlarr/prowlarr.db` (`/config/prowlarr.db`) |
| Indexer definitions | `data/appdata/prowlarr/Definitions/` (`/config/Definitions`) |
| Logs | `data/appdata/prowlarr/logs/` (`/config/logs/prowlarr.txt`) |
| Scheduled app backups | `data/appdata/prowlarr/Backups/` (`/config/Backups`) |

Prowlarr has no media or download folders.

## Everyday use

- Indexers › Add Indexer: search the list, fill in the site's credentials, Test, Save. Add the `flaresolverr` tag for sites behind Cloudflare.
- Indexers: the status column shows failing indexers; Indexers › Stats compares their response times and grabs.
- Search: a manual search across every indexer. With a download client set under Settings › Download Clients, you can grab straight from here.
- History: every query the apps made and what came back.
- Settings › Apps › Sync App Indexers: push all indexers to the apps now instead of waiting.
- System › Status: health warnings, such as an app that cannot be reached.

## Connects to

- [Sonarr](<Sonarr.md>), [Radarr](<Radarr.md>), [Lidarr](<Lidarr.md>), and [LazyLibrarian](<LazyLibrarian.md>) receive the indexers. Prowlarr needs each app's API key; the apps never need Prowlarr's.
- [FlareSolverr](<FlareSolverr.md>) is an indexer proxy, used only by indexers that share its tag.
- [qBittorrent](<qBittorrent.md>) is optional here (host `gluetun`, port `8082`), for grabbing from Prowlarr's own Search page.
- `.env`: `PROWLARR_PORT`, `PUID`, `PGID`, `TZ`.

`./homelab wire` (or Connect apps in the desktop app) makes these links through the apps' APIs. It lists the links for the apps that are running and asks before making them (without a terminal it only previews); `./homelab wire --apply` makes them without asking:

- It reads each *arr's API key from `data/appdata/<app>/config.xml` and waits up to three minutes for the app's API to answer.
- In Prowlarr › Settings › Apps it adds Sonarr, Radarr, and Lidarr, each with Prowlarr server `http://prowlarr:9696`, the app's address (`http://sonarr:8989`, `http://radarr:7878`, `http://lidarr:8686`), its API key, and Full Sync. LazyLibrarian is not added; add it by hand.
- When FlareSolverr runs, it creates the `flaresolverr` tag and adds the FlareSolverr indexer proxy at `http://flaresolverr:8191/` with that tag. You still tag the indexers yourself.
- When qBittorrent runs, it adds qBittorrent as the download client in Sonarr, Radarr, and Lidarr: host `gluetun`, port `8082`, user `QBITTORRENT_USER` (default `admin`), password `QBITTORRENT_PASSWORD`. Without that password in `.env` it stops with a next step instead. It files each app's downloads under its own category: `tv`, `movies`, and `music`. A download client that already exists keeps its category.
- If an entry already exists with a different address, it corrects the address and keeps everything else. Running it again only adds what is missing.
- For Seerr and Bazarr, which need a sign-in or choices, it prints the next step instead.

## Tinkering ideas

- Tags on an app and on indexers: send some indexers only to some apps (for example, music-only sites only to Lidarr).
- Settings › Apps: change an app's sync level to Add and Remove Only if you want to tune indexer settings inside that app.
- Settings › Notifications › ntfy: indexer health alerts to [ntfy](<../security/ntfy.md>) at `http://ntfy`.
- Settings › Download Clients: add qBittorrent (`gluetun`, `8082`) to grab from Prowlarr's Search page.
- Indexers › Stats: find slow or failing indexers worth removing.
- An indexer's settings: raise or lower its priority so the apps prefer it when releases tie.

## Useful commands

Follow the log, restart, check that Prowlarr can reach FlareSolverr and Sonarr over the Docker network, and preview or make the links.

```zsh
./homelab logs prowlarr -f
./homelab compose prowlarr restart prowlarr
./homelab compose prowlarr exec prowlarr curl -s http://flaresolverr:8191/
./homelab compose prowlarr exec prowlarr curl -s http://sonarr:8989/ping
./homelab wire
./homelab wire --apply
```

## API

The key is in Settings › General › Security, or `<ApiKey>` in `data/appdata/prowlarr/config.xml`. The base URL is `http://localhost:9696/api/v1/`, with the key in the `X-Api-Key` header. This shows the health warnings:

```zsh
curl -s -H "X-Api-Key: $(grep -o '<ApiKey>[^<]*' data/appdata/prowlarr/config.xml | cut -d'>' -f2)" http://localhost:9696/api/v1/health
```

Reference: [Prowlarr API docs](https://prowlarr.com/docs/api/).

## Learn more

- [Prowlarr](https://prowlarr.com)
- [Servarr wiki: Prowlarr](https://wiki.servarr.com/prowlarr)
- [Prowlarr on GitHub](https://github.com/Prowlarr/Prowlarr)
- [LinuxServer image](https://github.com/linuxserver/docker-prowlarr)

## Backup

`data/appdata/prowlarr` (database, settings, history) is in the Homelab AppData job. The app also writes its own scheduled backups into `data/appdata/prowlarr/Backups` (System > Backup).

## Troubleshooting

If an app shows no indexers, check Settings > Apps > Test, and that the address uses the service name, not `localhost`.
