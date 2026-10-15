---
version: 0.1.0-alpha
---

# Calibre-Web

A web front end for the Calibre e-book library: browse, read in the browser, and send books to e-readers.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `calibre-web` in `compose/media.yaml` (project `homelab_media`) |
| Image | `lscr.io/linuxserver/calibre-web:latest` |
| Category | Media |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://books.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this Mac | http://localhost:8083 (`CALIBRE_WEB_PORT`) |
| Data | `data/appdata/calibre-web` → `/config`<br>`/Volumes/Media/Books` → `/books` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/calibre-web` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

The household's e-books from the Calibre library in `/Volumes/Media/Books`, reachable from anywhere.

## Setup

1. Open https://books.example.com and sign in with the default `admin` / `admin123`. **Change the password immediately**: this app is public.
2. Database location: `/books` (the folder that contains `metadata.db`).
3. Create a user per person. Turn on uploads only if needed.

Calibre (the desktop app) remains the tool that adds and edits books; Calibre-Web reads the same library.

## How it works

- A Python (Flask) web app. It reads the Calibre library directly: book records from `metadata.db` and the files in `/books/<Author>/<Title>/`.
- Its own users, settings, shelves, and read status live in a separate SQLite database, `/config/app.db`.
- Edits and uploads made in Calibre-Web are written straight into `metadata.db`, which is why Calibre and Calibre-Web should not edit at the same time.
- Converting between formats needs Calibre's `ebook-convert`, which this image does not include (the linuxserver add-on that provides it is x86-64 only, and this Mac is Apple Silicon).
- The linuxserver image runs as `PUID`/`PGID` (your Mac user), so files it writes belong to you.

## Where things live

| What | Where |
|---|---|
| Calibre library | `/Volumes/Media/Books` → `/books` |
| Calibre's database | `/books/metadata.db` |
| Users, shelves, settings | `data/appdata/calibre-web/app.db` → `/config/app.db` |
| Log | `/config/calibre-web.log` (also Admin › Logfile viewer) |

## Everyday use

- Browse and search by author, series, tag, or language, and read EPUB, PDF, and comic files in the built-in reader.
- Shelves: make your own lists (private or shared) from a book's page.
- Send to eReader: once mail is set up, the book page sends a file to the address in your profile.
- OPDS catalog at `https://books.example.com/opds`, with your Calibre-Web login, for e-reader apps such as KOReader, Moon+ Reader, and Librera.
- Admin › Add New User, and per-user rights such as download, upload, and edit.

## Connects to

- Calibre, the desktop app on this Mac, edits the same library.
- [LazyLibrarian](<../media automation/LazyLibrarian.md>) adds books to `/Volumes/Media/Books`; with its calibredb import on, they land in `metadata.db` and show up here.
- [Kavita](<Kavita.md>) and [Komga](<Komga.md>) can read the same `Books` folder, read-only.
- [Duplicati](<../system/Duplicati.md>): the Calibre job copies the library, the AppData job copies `app.db`.
- [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>) publishes it.
- `.env`: `CALIBRE_WEB_PORT` (default 8083), `MEDIA_ROOT`, `PUID`, `PGID`, `TZ`.

## Tinkering ideas

- Kobo sync: Admin › Edit Basic Configuration › Feature Configuration › Enable Kobo sync; each user then finds a Kobo sync URL in their profile to put on the Kobo.
- Send to Kindle: add an SMTP account under Admin › Edit Email Server Settings, put the Kindle address in your profile, and add the sender to Amazon's approved list.
- Magic-link sign-in for e-reader browsers: Feature Configuration › Enable Remote Login.
- Admin › Edit UI Configuration: the dark caliBlur theme, books per page, and which sidebar sections show.
- Limit what a person sees by tag or custom column in their user settings, for example a children's account.
- Allow uploads: Feature Configuration › Enable Uploads, then give the person the upload right.

## Useful commands

```zsh
./homelab logs calibre-web -f
./homelab compose calibre-web restart calibre-web
./homelab compose calibre-web exec calibre-web ls -la /books/metadata.db /config/app.db
./homelab compose calibre-web exec calibre-web tail -n 50 /config/calibre-web.log
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8083/login
curl -s -u USER:PASSWORD http://localhost:8083/opds | head -20
```

## Learn more

- Source and wiki: https://github.com/janeczku/calibre-web
- Image: https://github.com/linuxserver/docker-calibre-web
- Calibre: https://calibre-ebook.com

## Backup

`data/appdata/calibre-web` (users and settings) is in the Homelab AppData job. The library itself (`Books`, including `metadata.db`) is in the Homelab Calibre job.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "DB location is not valid" | The drive is not mounted, or `metadata.db` is not directly in `Books` |
| Changes in Calibre not shown | Restart Calibre-Web, or avoid editing in both at once |
