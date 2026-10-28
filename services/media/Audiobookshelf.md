---
version: 0.12.0
---

# Audiobookshelf

Audiobooks and podcasts, with progress synced between devices.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `audiobookshelf` in `compose/media.yaml` (project `homelab_media`) |
| Image | `ghcr.io/advplyr/audiobookshelf:latest` |
| Category | Media |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://audiobooks.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this machine | http://localhost:13378 (`AUDIOBOOKSHELF_PORT`) |
| Data | `data/appdata/audiobookshelf/config` → `/config`<br>`data/appdata/audiobookshelf/metadata` → `/metadata`<br>`/Volumes/Media/audiobooks` → `/audiobooks`<br>`/Volumes/Media/podcasts` → `/podcasts` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/audiobookshelf` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

- The audiobook library from `/Volumes/Media/audiobooks`.
- Podcast subscriptions, downloaded to `/Volumes/Media/podcasts`.

## Setup

1. Open `https://<TAILSCALE_HOST>:13378` in Home mode, or `https://audiobooks.example.com` with a domain, and create the root user.
2. Add libraries: Audiobooks → `/audiobooks`, Podcasts → `/podcasts`.
3. Create a user per person.
4. Phone app (Audiobookshelf for iOS/Android): server: the same address.

## How it works

- A Node.js server with a Vue web app. The official iOS and Android apps use the same REST API, plus a live socket connection that keeps progress in sync.
- Everything it knows (libraries, books, users, progress, bookmarks, podcast subscriptions) is in one SQLite database, `/config/absdatabase.sqlite`.
- Covers, author photos, its own backups, logs, and caches go in `/metadata`.
- Scans read folder names, audio tags, and sidecar files such as `.opf`; Match fills in the rest from online sources such as Audible, Google Books, or iTunes.
- ffmpeg in the image streams formats a browser cannot play directly and powers the tools that merge files into one `.m4b`.
- Podcasts: a scheduler checks each feed on its own schedule and downloads new episodes into `/podcasts`.

## Where things live

| What | Where |
|---|---|
| Audiobooks | `/Volumes/Media/audiobooks` → `/audiobooks` |
| Podcasts | `/Volumes/Media/podcasts` → `/podcasts` |
| Database | `data/appdata/audiobookshelf/config/absdatabase.sqlite` → `/config/absdatabase.sqlite` |
| Covers and author photos | `data/appdata/audiobookshelf/metadata/items` and `.../metadata/authors` → `/metadata/...` |
| Built-in backups | `/metadata/backups` |
| Logs | `/metadata/logs` (one file per day, plus crash logs) |
| Cache | `/metadata/cache` |

## Everyday use

- Listen in the browser or the phone app; progress, bookmarks, and finished books sync between them. The phone app downloads books for offline listening.
- Fix a book's details: open it › Edit (pencil) › Match, and pick the right result.
- Podcasts: in the podcast library, search for a show or add its RSS feed, then turn on automatic downloads under the podcast's Edit › Schedule.
- Settings › Users: which libraries each person sees, and whether they may download, edit, or delete.
- Settings › Backups: when the built-in backups run and how many to keep; download one from there.
- Your stats page shows listening time per day and per book.
- Other apps that work with it: ShelfPlayer and Plappa on iOS.

## Connects to

- [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>) publishes it, so the phone app syncs from anywhere.
- [Pocket ID](<../security/Pocket ID.md>) can be its sign-in through OpenID Connect (Settings › Authentication). Pocket ID is on the home network only, so keep password sign-in on for use away from home.
- [Duplicati](<../system/Duplicati.md>) copies `data/appdata/audiobookshelf` (AppData job); `./homelab backup` dumps the database daily.
- `.env`: `AUDIOBOOKSHELF_PORT` (default 13378), `MEDIA_ROOT` for the two media folders, `TZ`.
- It gives out API keys (Settings › API Keys) for scripts and dashboards.

## Tinkering ideas

- Merge a book that is many MP3 files into one chaptered `.m4b`: open the book › Edit › Tools › Make M4B (writes into the library folder).
- Check chapters: the chapter editor (book › Edit › Chapters) can look up chapter times by ASIN.
- Open an RSS feed for a book or podcast from its menu, to listen in any podcast app.
- Collections and playlists: group a series or a reading list for the whole household.
- Settings › Authentication: try OpenID Connect with Pocket ID for one-tap sign-in at home.
- Settings › Notifications: send "new episode" alerts through an Apprise server.

## Useful commands

The last command needs an API key from Settings › API Keys in `ABS_TOKEN` first.

```zsh
./homelab logs audiobookshelf -f
./homelab compose audiobookshelf restart audiobookshelf
./homelab compose audiobookshelf exec audiobookshelf ls -la /config /metadata/backups /metadata/logs
curl -s http://localhost:13378/ping
curl -s -H "Authorization: Bearer $ABS_TOKEN" http://localhost:13378/api/libraries
```

## API

- Key: Settings › API Keys › Add API Key (choose the user it acts as).
- Base URL: `http://localhost:13378/api`, or `https://audiobooks.example.com/api`; send the key as `Authorization: Bearer <key>`.
- Example: `/api/libraries` lists libraries; `/api/libraries/<id>/items` lists a library's books.
- Docs: https://api.audiobookshelf.org

## Learn more

- Documentation: https://www.audiobookshelf.org/docs
- Source and image: https://github.com/advplyr/audiobookshelf

## Backup

`data/appdata/audiobookshelf` (config: users, progress, settings; metadata: covers and cache) is in the Homelab AppData job. Audiobookshelf also makes its own daily backups (Settings > Backups) into its metadata folder.

## Troubleshooting

If new books do not appear, scan the library (Library > Scan) and check the folder layout: one folder per book, or `Author/Book`.
