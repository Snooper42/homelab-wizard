---
version: 0.13.0
---

# Kavita

A reader for books, comics, and manga in one place. An optional alternative to Komga and Calibre-Web.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `kavita` in `compose/media.yaml` (project `homelab_media`) |
| Image | `jvmilazz0/kavita:latest` |
| Category | Media |
| Starts with `./homelab up` | No: optional, `./homelab install kavita` |
| Address | https://kavita.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:5500 (`KAVITA_PORT`) |
| Data | `data/appdata/kavita` → `/kavita/config`<br>`/Volumes/Media/Books, read-only` → `/books`<br>`/Volumes/Media/comics, read-only` → `/comics` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/kavita` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

One reading app for both `Books` and `comics`, read-only.

## Setup

1. `./homelab install kavita`; with a domain, then `./homelab domain setup`.
2. Open `https://<TAILSCALE_HOST>:5500` in Home mode, or `https://kavita.example.com` with a domain, and create the administrator.
3. Add libraries for `/books` and `/comics`.

It listens on 5500 on the Mac because macOS's AirPlay Receiver holds port 5000.

## How it works

- A .NET (C#) server with an Angular web app, and readers for images (comics and manga), EPUB, and PDF.
- Libraries, users, progress, and reading lists are in SQLite, `/kavita/config/kavita.db`; `appsettings.json` beside it holds the port and the key that signs logins.
- Scans expect `Library/Series/files`, read `ComicInfo.xml` and EPUB metadata, and store cover images in `/kavita/config/covers`.
- Background tasks (scans, its own database backups, cleanup) run on schedules set in the server settings.
- Inside the container it listens on 5000; this Mac maps it to 5500 (`KAVITA_PORT`).

## Where things live

| What | Where |
|---|---|
| Books (read-only) | `/Volumes/Media/Books` → `/books` |
| Comics (read-only) | `/Volumes/Media/comics` → `/comics` |
| Database | `data/appdata/kavita/kavita.db` → `/kavita/config/kavita.db` |
| Server settings file | `/kavita/config/appsettings.json` |
| Covers | `/kavita/config/covers` |
| Built-in backups | `/kavita/config/backups` |
| Logs | `/kavita/config/logs/kavita.log` |

## Everyday use

- The home page shows On Deck, recently added series, and your Want to Read list.
- Collections and reading lists group series and put issues in order; smart filters save a search for reuse.
- Admins open the server settings from the user menu: libraries, users, tasks (scan now, backups, schedules), and email.
- Your account settings show your personal API key and OPDS URL, for apps such as Panels, Paperback, KOReader, and Chunky.
- On Android, Mihon has a Kavita extension that uses the same API key.

## Connects to

- [Komga](<Komga.md>) and [Calibre-Web](<Calibre-Web.md>) use the same `Books` and `comics` folders; Kavita only reads them.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves https://kavita.example.com on the home network; [Tailscale](<../network/Tailscale.md>) reaches it from elsewhere.
- `.env`: `KAVITA_PORT` (default 5500), `MEDIA_ROOT`, `TZ`.
- It gives out a per-user API key, used by OPDS and the Mihon extension.

## Tinkering ideas

- Send to e-reader: set up email in the server settings, then add your Kindle or Kobo address as a device in your account settings.
- Import a ComicRack `.cbl` reading list from the reading lists page.
- Turn on folder watching in a library's settings so new files appear without a manual scan.
- Pin your favourite smart filters to the home page and sidebar in your account settings.
- Try the EPUB reader's layout and font options, and a different theme in your account settings.
- Kavita+ (a paid subscription) adds online metadata and scrobbling to AniList; everything else works without it.

## Useful commands

```zsh
./homelab logs kavita -f
./homelab compose kavita restart kavita
./homelab compose kavita exec kavita tail -n 50 /kavita/config/logs/kavita.log
./homelab compose kavita exec kavita ls -la /kavita/config/backups
curl -s http://localhost:5500/api/health
```

## Learn more

- Documentation: https://wiki.kavitareader.com
- Source: https://github.com/Kareadita/Kavita
- Image: https://hub.docker.com/r/jvmilazz0/kavita

## Backup

`data/appdata/kavita` (database, users, progress) is in the Homelab AppData job.

## Troubleshooting

If a library scan finds nothing, check the folder layout Kavita expects (one folder per series).
