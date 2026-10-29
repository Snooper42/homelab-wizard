---
version: 0.14.0
---

# RomM

The game library, with artwork, saves, and play in the browser.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `romm` in `stacks/romm/compose.yaml` (project `homelab_romm`) |
| Image | `rommapp/romm:latest` |
| Category | Media |
| Starts with `./homelab up` | No: optional, `./homelab install romm` |
| Address | https://games.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:7676 (`ROMM_PORT`) |
| Depends on | `romm-db` |
| Helpers | `romm-db` `docker.io/library/postgres:17`, dumped daily by `./homelab backup` |
| Data | `/Volumes/Media/games` → `/romm/library`<br>`appdata/romm/resources` → `/romm/resources`<br>`appdata/romm/assets` → `/romm/assets`<br>`appdata/romm/config` → `/romm/config`<br>`romm-redis (volume)` → `/redis-data` |
| Updates | Nightly at 4 AM, with a copy of its data first |
| Also known as | roms, retro, games |
<!-- END homelab:generated -->

## Purpose

The household's game library in one place: ROMs and their saves for every console, with box art, descriptions, and play in the browser for the older systems (through EmulatorJS). It pairs with the Steam Machine: browse the library on the TV, or point an emulator at it.

## Setup

1. Put games on the media drive under `games/roms/<platform>`, using RomM's platform folder names (`snes`, `n64`, `gba`, `psx`, and so on); BIOS files go in `games/bios/<platform>`.
2. `./homelab install romm` and open `https://<TAILSCALE_HOST>:7676` in Home mode, or `https://games.example.com` with a domain; create the admin account.
3. **Scan** the library. For artwork and details, add a metadata source first: IGDB (a free Twitch developer app: its client ID and secret in Settings › `ROMM_IGDB_CLIENT_ID` and `ROMM_IGDB_CLIENT_SECRET`) or ScreenScraper (`ROMM_SCREENSCRAPER_USER` and `_PASSWORD`), then `./homelab install romm` again.
4. Add each person as a user under Administration.

Only play games you own; the homelab does not fetch ROMs.

## Away from home

In Home mode (the default), RomM is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere.

## How it works

- A Python (FastAPI) back end with a Vue web app, served by nginx inside the `romm` container on port 8080 (7676 on this Mac).
- PostgreSQL in `romm-db` holds platforms, games, users, collections, and fetched details. It sits in the `romm-pgdata` volume, on the stack's private network only.
- A Redis-compatible store runs inside the `romm` container (data in the `romm-redis` volume) and queues the background workers that scan and run scheduled tasks.
- A scan walks `roms/<platform>` in the library, identifies each game by file name and hash, and fetches details and artwork from the metadata sources you have set (IGDB, ScreenScraper).
- In-browser play uses EmulatorJS (and Ruffle for Flash); saves and save states made in the browser are kept as assets.
- `ROMM_AUTH_SECRET_KEY` signs sign-in sessions; `ROMM_DB_PASSWORD` is shared by both containers.

## Where things live

| What | Where |
|---|---|
| Games | `/Volumes/Media/games` → `/romm/library` (`roms/<platform>`, `bios/<platform>`) |
| Fetched artwork and details | `appdata/romm/resources` → `/romm/resources` |
| Saves, states, screenshots | `appdata/romm/assets` → `/romm/assets` |
| Optional config file | `appdata/romm/config/config.yml` → `/romm/config/config.yml` |
| Database | `romm-pgdata` volume (`romm-db`, `/var/lib/postgresql/data`) |
| Task queue | `romm-redis` volume → `/redis-data` |

## Everyday use

- Browse by platform or collection, search and filter, and open a game for its details, files, and the Play button (for systems EmulatorJS supports).
- Add games by uploading them in the browser, or copy them into `roms/<platform>` and scan.
- The scan page offers a quick scan of new files or a complete rescan, for all platforms or only the ones you pick.
- Favourites and your own collections, per user.
- Download a game to copy it to a handheld or to the Steam Machine's emulator folders.
- Administration › Users: each person gets a role (viewer, editor, or admin).

## Connects to

- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves https://games.example.com on the home network; [Tailscale](<../network/Tailscale.md>) reaches it from elsewhere.
- [Duplicati](<../system/Duplicati.md>) copies `appdata/romm` (Stack Data job); `./homelab backup` dumps `romm-db` daily.
- `.env`: `ROMM_PORT` (default 7676), `ROMM_DB_PASSWORD`, `ROMM_AUTH_SECRET_KEY`, `ROMM_IGDB_CLIENT_ID`, `ROMM_IGDB_CLIENT_SECRET`, `ROMM_SCREENSCRAPER_USER`, `ROMM_SCREENSCRAPER_PASSWORD`, `MEDIA_ROOT`, `TZ`.
- It needs API keys from IGDB (through Twitch) or ScreenScraper for artwork, and gives out none of its own to other apps here.

## Tinkering ideas

- Map your own folder names to RomM's platforms in `config.yml` (`system: platforms:`, for example `ps1: psx`), or exclude folders and file types under `exclude:`.
- Put BIOS files in `bios/<platform>` so EmulatorJS can run systems that need them, such as the PlayStation.
- Set both IGDB and ScreenScraper: RomM tries IGDB first and fills gaps from ScreenScraper; change the order under `scan: priority:` in `config.yml`.
- Plug a gamepad into the computer; the in-browser player picks it up through the browser.
- Make a collection per person or per theme (party games, couch co-op) for quick browsing on the TV.
- Script imports or reports with the API (see below).

## Useful commands

Replace `USER` and `PASSWORD` with a RomM login; the heartbeat needs none.

```zsh
./homelab logs romm -f
./homelab compose romm ps
./homelab compose romm restart romm
./homelab compose romm exec romm ls -la /romm/config /romm/library
./homelab compose romm exec romm-db psql -U romm -d romm
curl -s http://localhost:7676/api/heartbeat
curl -s -u USER:PASSWORD http://localhost:7676/api/platforms
```

## API

- Base URL: `http://localhost:7676/api`, or `https://games.example.com/api`.
- Auth: HTTP basic with a RomM login (the API also issues OAuth tokens).
- Example: `/api/platforms` lists platforms with game counts; `/api/heartbeat` shows the version and which metadata sources are set.
- Docs: the interactive reference at `http://localhost:7676/api/docs`.

## Learn more

- Documentation: https://docs.romm.app
- Source: https://github.com/rommapp/romm
- Image: https://hub.docker.com/r/rommapp/romm

## Backup

The nightly backup dumps RomM's database; its artwork and settings in `appdata/romm` are covered by the Stack Data job. The games themselves are on the media drive, which the backups do not copy: keep your own copy of anything you cannot get again.

## Troubleshooting

- **The scan finds nothing:** check the folders are `games/roms/<platform>` on the media drive, with RomM's platform names.
- **No artwork:** no metadata source is set; see Setup, step 3.
