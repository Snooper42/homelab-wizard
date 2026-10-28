---
version: 0.11.0
---

# File Browser

A web file manager for the media drive: browse, upload, download, and share files from a browser.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `filebrowser` in `compose/cloud.yaml` (project `homelab_cloud`) |
| Image | `filebrowser/filebrowser:latest` |
| Category | Cloud & Files |
| Starts with `./homelab up` | No: optional, `./homelab install filebrowser` |
| Address | https://files.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8086 (`FILEBROWSER_PORT`) |
| Data | `/Volumes/Media` → `/srv`<br>`data/appdata/filebrowser/database` → `/database`<br>`data/appdata/filebrowser/config` → `/config` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Reach files on `/Volumes/Media` from any device on the LAN without file sharing set up on each one.

## Setup

1. `./homelab install filebrowser`; with a domain, then `./homelab domain setup`.
2. The first start prints a random admin password: `./homelab logs filebrowser`. Sign in at `https://<TAILSCALE_HOST>:8086` in Home mode, or `https://files.example.com` with a domain, and change it.
3. Create a user per person, limited to the folders they need.

It has read-write access to the whole media drive, so keep it LAN-only and give accounts the narrowest scope.

## How it works

- A single Go program with a Vue web page, serving the media drive mounted at `/srv`.
- Users, their scopes and permissions, share links, and settings are in one BoltDB file, `/database/filebrowser.db`; start-up options are in `/config/settings.json`.
- A share is a `/share/...` link with an optional expiry and password; anyone with the link can download without an account.
- It can read and write everything the container can, so a user's scope is the only fence.

## Where things live

| What | Where |
|---|---|
| Files | `MEDIA_ROOT` (`/Volumes/Media`) → `/srv` |
| Users, shares, settings | `data/appdata/filebrowser/database/filebrowser.db` (`/database`) |
| Start-up options | `data/appdata/filebrowser/config/settings.json` (`/config`) |

## Everyday use

- Drag files onto the page to upload; select files to download them (several at once come as one archive).
- Select a file or folder and use the share button to make a link with an expiry and an optional password; the settings pages list current shares.
- Settings › **User Management**: add a user, set their scope (for example `/games/roms`) and what they may do.
- F1 lists the keyboard shortcuts; F2 renames and Delete deletes the selection.

## Connects to

- Sees the whole media drive: [Jellyfin](<../media/Jellyfin.md>)'s libraries, [qBittorrent](<../media automation/qBittorrent.md>)'s downloads, the `Books` folder for [Calibre-Web](<../media/Calibre-Web.md>), `games` for [RomM](<../media/RomM.md>), and [Immich](<../cloud and files/Immich.md>)'s `photos`. Change Immich's files only through Immich.
- Behind [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) at `files.example.com`, LAN only (with a domain); in Home mode Tailscale serves it on the tailnet.
- `.env`: `FILEBROWSER_PORT`, `MEDIA_ROOT`.

## Tinkering ideas

- A user scoped to `/games/roms` for dropping ROMs into RomM's library, followed by a scan in RomM.
- A user scoped to `/Books` that can only upload, for adding books.
- Hide clutter with a rule: Settings › Global Settings › Rules, regular expression `\.DS_Store`.
- Rename the page and pick the dark theme under Settings › Global Settings › Branding.
- Script uploads or listings from the Mac with the API below.

## Useful commands

The first-start admin password, the logs, a restart, and the health check:

```zsh
./homelab logs filebrowser | grep -i password
./homelab logs filebrowser -f
./homelab compose filebrowser restart filebrowser
curl -s http://localhost:8086/health
```

## API

- Sign in with `POST /api/login` and a JSON body with `username` and `password`; the reply is a token to send as the `X-Auth` header.
- Base URL on this Mac: `http://localhost:8086/api`.
- Example, listing the top folder of the drive:

```zsh
TOKEN=$(curl -s -X POST http://localhost:8086/api/login -d '{"username":"admin","password":"your-password"}')
curl -s -H "X-Auth: $TOKEN" http://localhost:8086/api/resources/
```

## Learn more

- Docs: https://filebrowser.org/
- Source and image: https://github.com/filebrowser/filebrowser

## Backup

`data/appdata/filebrowser` (users, shares, settings) is in the Homelab AppData job. The files themselves are on the media drive.

## Troubleshooting

If uploads fail, check that the drive is mounted (`./homelab doctor`) and that OrbStack may access `/Volumes`.
