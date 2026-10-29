---
version: 0.15.0
---

# LazyLibrarian

E-book and audiobook automation: follows authors and fetches their books into the library.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `lazylibrarian` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `lscr.io/linuxserver/lazylibrarian:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install lazylibrarian` |
| Address | https://lazylibrarian.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:5299 (`LAZYLIBRARIAN_PORT`) |
| Data | `data/appdata/lazylibrarian` → `/config`<br>`/Volumes/Media/Books` → `/books`<br>`/Volumes/Media/downloads` → `/downloads` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

New books by followed authors arrive in `/Volumes/Media/Books`.

## Setup

1. `./homelab install lazylibrarian`; with a domain, then `./homelab domain setup`.
2. Open `https://<TAILSCALE_HOST>:5299` in Home mode, or `https://lazylibrarian.example.com` with a domain. Config › Interface: set a username and password.
3. Config › Downloaders: qBittorrent, host `gluetun`, port `8082`; download directory `/downloads`.
4. Config › Processing: eBook library folder `/books`. If Calibre-Web manages the library, turn on Calibredb import so `metadata.db` stays correct.
5. Add it in Prowlarr (Settings › Apps) to receive indexers.

## How it works

- LazyLibrarian is a Python web app. It keeps authors, books, and history in a SQLite database (`lazylibrarian.db`) and its settings in `config.ini`.
- It looks authors and books up in online book databases, then follows the authors you add and marks new books as wanted.
- Searches go to the providers under Config › Providers; with Prowlarr, those are Torznab entries that point back at `http://prowlarr:9696`.
- Torrents go to [qBittorrent](<qBittorrent.md>) at `gluetun:8082`. When a download finishes, post-processing finds it in `/downloads`, renames it, and files it under `/books/<Author>/<Title>/`.
- With Calibredb import turned on, it adds books through Calibre's `calibredb` tool instead, so a Calibre library's `metadata.db` stays correct. That needs the `calibredb` program inside the container, which this image does not include by default.

## Where things live

| What | Where |
|---|---|
| Settings | `data/appdata/lazylibrarian/config.ini` (`/config/config.ini`) |
| Database | `data/appdata/lazylibrarian/lazylibrarian.db` (`/config/lazylibrarian.db`) |
| Book library | `${MEDIA_ROOT}/Books`, default `/Volumes/Media/Books` → `/books` |
| Downloads | `DOWNLOADS_ROOT`, default `/Volumes/Media/downloads` → `/downloads` |

There is no audiobook mount: [Audiobookshelf](<../media/Audiobookshelf.md>) reads `${MEDIA_ROOT}/audiobooks`, which LazyLibrarian cannot see. `/books` and `/downloads` are separate mounts, so imports are copies; [Sonarr](<Sonarr.md#where-things-live>) has the whole download layout.

## Everyday use

- Authors: add an author by name, then choose which of their books you want.
- Books: search for a single title and mark it wanted.
- Manage: everything wanted, snatched, or failed, with a button to search again.
- Logs: why a search, download, or import did not work.

## Connects to

- [Prowlarr](<Prowlarr.md>) sends it indexers: add LazyLibrarian under Prowlarr's Settings › Apps at `http://lazylibrarian:5299` with LazyLibrarian's API key (Config › Interface). `./homelab wire` does not do this one.
- [qBittorrent](<qBittorrent.md>) is the download client: host `gluetun`, port `8082`.
- [Calibre-Web](<../media/Calibre-Web.md>) serves the same `/Volumes/Media/Books` folder; [Kavita](<../media/Kavita.md>) and [Komga](<../media/Komga.md>) read it read-only.
- `.env`: `LAZYLIBRARIAN_PORT`, `MEDIA_ROOT`, `DOWNLOADS_ROOT`, `PUID`, `PGID`, `TZ`.

## Tinkering ideas

- Config › Notifications: tell you when a book arrives.
- Magazines: follow a magazine and have new issues fetched like books.
- Calibre: the LinuxServer image documents a Calibre mod (`DOCKER_MODS`, a compose change) that adds `calibredb` and e-book conversion.
- Audiobooks: add a volume for `${MEDIA_ROOT}/audiobooks` in `compose/media-automation.yaml` and point LazyLibrarian's audiobook folder at it, so Audiobookshelf picks them up.
- Config › Processing: adjust the folder and file name patterns to match how Calibre-Web or Kavita expect them.

## Useful commands

Follow the log, restart, and check both mounts from inside the container.

```zsh
./homelab logs lazylibrarian -f
./homelab compose lazylibrarian restart lazylibrarian
./homelab compose lazylibrarian exec lazylibrarian ls /books /downloads
```

## Learn more

- [LazyLibrarian documentation](https://lazylibrarian.gitlab.io)
- [LazyLibrarian on GitLab](https://gitlab.com/LazyLibrarian/LazyLibrarian)
- [LinuxServer image](https://github.com/linuxserver/docker-lazylibrarian) and its [docs](https://docs.linuxserver.io/images/docker-lazylibrarian/)

## Backup

`data/appdata/lazylibrarian` (database, settings) is in the Homelab AppData job.

## Troubleshooting

If books are downloaded but not imported, check Logs and that the download directory is `/downloads` in both LazyLibrarian and qBittorrent.
