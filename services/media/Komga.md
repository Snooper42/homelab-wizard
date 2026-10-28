---
version: 0.11.0-beta
---

# Komga

A reader for comics and manga, in the browser or through compatible apps.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `komga` in `compose/media.yaml` (project `homelab_media`) |
| Image | `gotson/komga:latest` |
| Category | Media |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://comics.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this machine | http://localhost:25600 (`KOMGA_PORT`) |
| Data | `data/appdata/komga` → `/config`<br>`/Volumes/Media/Books, read-only` → `/books`<br>`/Volumes/Media/comics, read-only` → `/comics` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/komga` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

The comics library from `/Volumes/Media/comics` (CBZ, CBR, PDF, EPUB), read-only.

## Setup

1. Open `https://<TAILSCALE_HOST>:25600` in Home mode, or `https://comics.example.com` with a domain, and create the administrator.
2. Add a library pointing at `/comics` (and one at `/books` for books from the media drive's `Books` folder).
3. Create a user per person, with access to the libraries they should see.
4. Apps such as Panels or Paperback connect with the same address and login (OPDS is at `/opds/v1.2/catalog`).

## How it works

- A Kotlin and Spring Boot server on the Java runtime, with a Vue web app and a built-in reader.
- Its library, users, and read progress are in SQLite, `/config/database.sqlite`; background jobs are queued in `/config/tasks.sqlite`, and search uses a Lucene index in `/config/lucene`.
- Scans walk each library folder (one folder per series), read `ComicInfo.xml` inside CBZ files and the metadata of EPUBs, and make thumbnails.
- Both media folders are mounted read-only, so Komga never changes or deletes your files.
- Apps connect through its REST API (`/api/v1`) or the OPDS feeds; extra settings, such as OAuth2 sign-in, go in an optional `/config/application.yml`.

## Where things live

| What | Where |
|---|---|
| Comics (read-only) | `/Volumes/Media/comics` → `/comics` |
| Books (read-only) | `/Volumes/Media/Books` → `/books` |
| Database | `data/appdata/komga/database.sqlite` → `/config/database.sqlite` |
| Task queue | `/config/tasks.sqlite` |
| Search index | `/config/lucene` (rebuilt if deleted) |
| Log | `/config/logs/komga.log` |
| Optional settings file | `/config/application.yml` |

## Everyday use

- The home page shows Keep Reading, On Deck (the next issue of series you follow), and recent additions.
- Read in the browser: paged, double-page, or continuous vertical (webtoon) mode, chosen in the reader's settings.
- Collections group series; read lists put issues from several series in reading order.
- A library's menu (the three dots beside its name) scans it or edits its options.
- Server settings › Users: which libraries each person can see, and content restrictions by age rating or label.
- Apps: Panels and Paperback (iOS), Mihon with the Komga extension (Android), or any OPDS reader such as KOReader.

## Connects to

- [Kavita](<Kavita.md>) reads the same `comics` and `Books` folders; you can run either or both.
- [Calibre-Web](<Calibre-Web.md>) manages `Books`; Komga only reads it.
- [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>) publishes it, so reading apps work away from home.
- `.env`: `KOMGA_PORT` (default 25600), `MEDIA_ROOT`, `TZ`.
- It gives out per-user API keys (sent as the `X-API-Key` header) for apps and scripts.

## Tinkering ideas

- Import a ComicRack `.cbl` reading list from the Import page to get a crossover event in reading order.
- In a library's options, choose which metadata sources it trusts (ComicInfo, EPUB, local artwork) and whether it scans on startup and on a schedule.
- Try Komf, a separate tool that fetches series metadata from online databases into Komga: https://github.com/Snd-R/komf
- Use the webtoon mode for vertical-scroll comics on a phone.
- Sign in with Pocket ID through OAuth2 settings in `/config/application.yml` (see Komga's docs on OAuth2).
- Add the OPDS feed `https://comics.example.com/opds/v1.2/catalog` to KOReader on an e-ink reader.

## Useful commands

Replace `EMAIL` and `PASSWORD` with your Komga login; the health check needs none.

```zsh
./homelab logs komga -f
./homelab compose komga restart komga
./homelab compose komga exec komga tail -n 50 /config/logs/komga.log
curl -s http://localhost:25600/actuator/health
curl -s -u EMAIL:PASSWORD http://localhost:25600/api/v1/libraries
curl -s -u EMAIL:PASSWORD "http://localhost:25600/api/v1/series?size=5"
```

## API

- Auth: your email and password (HTTP basic), or an API key sent as `X-API-Key: <key>`; create keys in your account settings.
- Base URL: `http://localhost:25600/api/v1/`, or `https://comics.example.com/api/v1/`.
- Example: `curl -X POST -u EMAIL:PASSWORD http://localhost:25600/api/v1/libraries/<id>/scan` scans one library.
- Docs: the interactive API reference at `http://localhost:25600/swagger-ui.html`.

## Learn more

- Documentation: https://komga.org
- Source: https://github.com/gotson/komga
- Image: https://hub.docker.com/r/gotson/komga

## Backup

`data/appdata/komga` (database, users, read progress) is in the Homelab AppData job. The comics themselves are not backed up.

## Troubleshooting

If a series is missing, scan the library and check that each series has its own folder.
