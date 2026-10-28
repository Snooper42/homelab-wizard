---
version: 0.11.0
---

# Nextcloud

The family's shared files, synced to every phone and computer

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `nextcloud` in `stacks/nextcloud/compose.yaml` (project `homelab_nextcloud`) |
| Image | `docker.io/library/nextcloud:35-apache` |
| Category | Cloud & Files |
| Starts with `./homelab up` | No: optional, `./homelab install nextcloud` |
| Address | https://cloud.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this machine | http://localhost:8099 (`NEXTCLOUD_PORT`) |
| Depends on | `nextcloud-db`, `nextcloud-redis` |
| Helpers | `nextcloud-db` `docker.io/library/postgres:18`, dumped daily by `./homelab backup`<br>`nextcloud-redis` `docker.io/valkey/valkey:9-alpine` |
| Data | `appdata/nextcloud/html` → `/var/www/html`<br>`appdata/nextcloud/data` → `/var/www/data`<br>`config/nextcloud/post-installation, read-only` → `/docker-entrypoint-hooks.d/post-installation`<br>`config/nextcloud/before-starting, read-only` → `/docker-entrypoint-hooks.d/before-starting` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

The family's shared files in one place, synced to every phone and computer the way Dropbox or OneDrive does it: a folder on each computer that stays in step, phone apps that upload and open files, and links to share a file with someone outside the family. It can also hold calendars, contacts, and notes, and edit documents in the browser with add-ons.

It is heavy and optional, in no starter. The homelab already covers its parts with lighter apps: [File Browser](<File Browser.md>) for sharing from the media drive, [Syncthing](<Syncthing.md>) for keeping folders in step, [Immich](<Immich.md>) for photos, and [Baikal](<Baikal.md>) for calendars and contacts. Choose Nextcloud when the family wants all of it in one app with one account each.

## Setup

1. `./homelab install nextcloud` (it brings its PostgreSQL, its cache, and its jobs container). The first start installs it, which takes a minute or two.
2. Sign in as `NEXTCLOUD_ADMIN_USER` (`admin`) with `NEXTCLOUD_ADMIN_PASSWORD` from Settings (Show), or **Sign in** on Status.
3. **Accounts › New account** for each person in the family. Give each a quota if the disk is small.
4. On each computer, install the Nextcloud desktop app and sign in with `https://cloud.example.com` (with a domain) or `https://<TAILSCALE_HOST>:8099` (Home mode); on each phone, the Nextcloud app with the same address.
5. **Administration settings › Overview** lists anything left to set up; the homelab has already set the background jobs (cron, every 5 minutes), the night maintenance window, the proxy, and the addresses it answers on.

The addresses it answers on are set at each start from `HOMELAB_DOMAIN` and `TAILSCALE_HOST`, so after changing either, `./homelab up` is enough.

## How it works

- `nextcloud`: the official image with Apache and PHP, on port 80 inside, 8099 on this machine. Before it starts, its `www-data` account takes your user's ID (`PUID`, `PGID`), so the files it writes are yours: they move with `homelab move`, and the backup can read them on every system.
- `nextcloud-cron`: the same image running Nextcloud's background jobs every 5 minutes (previews, clean-up, notifications).
- `nextcloud-db`: PostgreSQL with accounts, shares, and the list of files; `nextcloud-redis`: Valkey for file locking and caching.
- Two scripts in `config/nextcloud` run inside the image: after installing (cron and the maintenance window) and at each start (the trusted addresses).
- The program lives in `appdata/nextcloud/html` (with its settings in `config/config.php`); the files themselves in `appdata/nextcloud/data`, or `NEXTCLOUD_DATA`.

## Where things live

| What | Where |
|---|---|
| Everyone's files | `appdata/nextcloud/data/<account>/files`, or `NEXTCLOUD_DATA` |
| Settings (`config.php`) and installed apps | `appdata/nextcloud/html` |
| Accounts, shares, file list, calendars, contacts | PostgreSQL in the Docker volume `homelab_nextcloud_nextcloud-pgdata` |
| Secrets | `NEXTCLOUD_ADMIN_PASSWORD` and `NEXTCLOUD_DB_PASSWORD` in `.env` |

## Everyday use

- **Sync a folder:** the desktop app keeps the Nextcloud folder on each computer in step; files can stay online-only until opened.
- **Phone photos:** the phone app can upload the camera roll (Immich does this better if photos are the main need).
- **Share:** a file's share menu makes a link, with a password and an expiry date if you like, for someone without an account.
- **Family folders:** make a folder and share it with the other accounts, or install **Team folders** from Apps for folders that belong to everyone.

## Connects to

- [Duplicati](<../system/Duplicati.md>): the Homelab Stack Data job covers `appdata/nextcloud` (files and settings), and `./homelab backup` dumps the database.
- [Pocket ID](<../security/Pocket ID.md>): sign-in with passkeys through Nextcloud's OpenID Connect app (Tinkering ideas).
- `.env`: `NEXTCLOUD_PORT` (default `8099`), `NEXTCLOUD_URL`, `NEXTCLOUD_VERSION`, `NEXTCLOUD_DATA`, and the secrets above.

## Tinkering ideas

- **Files on the media drive:** set `NEXTCLOUD_DATA` to a folder there before the first install (moving it later needs `occ`); add that folder to a Duplicati job, since it is then outside the Stack Data job.
- **Office documents in the browser:** install Nextcloud Office from Apps with its built-in server (CODE), or run Collabora as a container of its own.
- **Calendars and contacts:** the Calendar and Contacts apps, synced to phones with DAVx⁵ (Android) or the system's own accounts (iPhone).
- **Sign-in with Pocket ID:** install **OpenID Connect user backend** from Apps and add Pocket ID as a provider.

## Useful commands

```sh
./homelab logs nextcloud -f
./homelab compose nextcloud exec -u www-data nextcloud php occ status
./homelab compose nextcloud exec -u www-data nextcloud php occ files:scan --all     # after copying files in by hand
./homelab compose nextcloud exec -u www-data nextcloud php occ maintenance:mode --off
```

## API

- **WebDAV** (what the apps use): `https://cloud.example.com/remote.php/dav/files/<account>/`, signed in with the account's password or an app password (Personal settings › Security).
- **Upload a file:** `curl -u admin:PASSWORD -T notes.txt http://localhost:8099/remote.php/dav/files/admin/notes.txt`
- The OCS API (shares, accounts) is described in Nextcloud's [developer manual](https://docs.nextcloud.com/server/latest/developer_manual/).

## Learn more

- [nextcloud.com](https://nextcloud.com) and the [administration manual](https://docs.nextcloud.com/server/latest/admin_manual/)
- [The official image](https://github.com/nextcloud/docker), whose PostgreSQL example this stack follows

## Updates

Watchtower brings fixes for the major version in `NEXTCLOUD_VERSION` (35) every night. A new major version is a deliberate step: take a backup (`./homelab backup --apply`), raise `NEXTCLOUD_VERSION` by one (never skip one), then `./homelab update nextcloud`; the image upgrades itself on start. Check **Administration settings › Overview** afterwards.

## Backup

`./homelab backup` dumps the database nightly into `recovery-staging/databases/nextcloud-db`. The files and settings are in `appdata/nextcloud`, which the Homelab Stack Data job in Duplicati takes off-site with the rest. With `NEXTCLOUD_DATA` elsewhere, add that folder to a job of its own.

## Troubleshooting

- **It keeps restarting, and the log says *Nextcloud did not install*:** its first install failed (the lines above in `./homelab logs nextcloud` say why, often a files folder it cannot write). Fix that, delete `appdata/nextcloud/html`, and `./homelab up`; it installs again.
- **Access through untrusted domain:** the address you opened is not `localhost`, `cloud.<HOMELAB_DOMAIN>`, or `TAILSCALE_HOST`; set the one you use in Settings, then `./homelab up`.
- **Slow, or *file is locked*:** check that `nextcloud-redis` is running (`./homelab compose nextcloud ps`).
- **Stuck in maintenance mode** after an update: read `./homelab logs nextcloud`, then `occ maintenance:mode --off` (Useful commands).
- **Files copied into the data folder by hand do not show:** `occ files:scan --all`.
