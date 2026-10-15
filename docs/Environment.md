---
version: 0.1.0-alpha
---

# Environment

Every setting lives in `~/Homelab/.env`, read by every Compose project. `.env.example` in the repository is the template.

## How .env is managed

- `./homelab up` (or `install`) creates `.env` from `.env.example` with mode 0600. It sets `PUID`, `PGID`, and `TZ` from this Mac, and replaces every `__REPLACE_ME__` with a generated secret.
- Later runs add keys that are new in `.env.example` and never change values you already have.
- Copy each generated secret into Vaultwarden as `homelab - <service> <credential>`.
- `.env` is never committed (`.gitignore`), never printed by the CLI, and never pasted into notes or chats. `./homelab backup` copies it into `recovery-staging/secrets` for the encrypted Homelab Secrets job.
- Never add `COMPOSE_PROJECT_NAME` or `COMPOSE_PROFILES`: they would override each stack's own project name and the optional profile.

## This Mac

| Variable | Default | Purpose |
|---|---|---|
| `TZ` | Mac's timezone | Timezone for every container |
| `PUID`, `PGID` | Mac's user and group (501, 20) | File ownership for linuxserver.io images and Paperless |
| `BIND_IP` | `127.0.0.1` | Where app ports listen. Keep it: other devices go through the proxy |
| `LAN_BIND_IP` | `0.0.0.0` | Where the proxy (80/443) and DNS (53) listen; follows the Mac's address |

## Storage

| Variable | Default | Purpose |
|---|---|---|
| `MEDIA_ROOT` | `/Volumes/Media` | The media drive: music, tv, movies, Books, comics, audiobooks, podcasts |
| `DOWNLOADS_ROOT` | `/Volumes/Media/downloads` | Download folder shared by qBittorrent and the *arr apps |
| `IMMICH_UPLOAD_LOCATION` | `/Volumes/Media/photos` | Immich's photo library |
| `BACKUP_DESTINATION` | `./backups` | Duplicati's destination; set it to the Proton Drive folder (`~/Library/CloudStorage/ProtonDrive-.../homelab-backups`) |
| `JELLYFIN_DATA_DIR` | `~/.local/share/jellyfin` | Native Jellyfin's data folder, backed up by Duplicati |

## Domain and Cloudflare

| Variable | Purpose |
|---|---|
| `HOMELAB_DOMAIN` | `example.com`; every hostname is `<subdomain>.<domain>`. Empty: Home mode, every app at `https://<TAILSCALE_HOST>:<port>` ([Tailscale](<../services/network/Tailscale.md#home-mode-no-domain>)) |
| `TAILSCALE_HOST` | Home mode only: this machine's tailnet name, written by `homelab tailnet setup` |
| `POCKET_ID_API_KEY` | generated | Pocket ID's static API key (`STATIC_API_KEY`), which `homelab sso setup` uses to make the apps' sign-in clients. A secret |
| `SSO_HOST` | empty | Pocket ID's name (`id.<domain>`), written by `homelab sso setup`; the apps that sign in with it map it to this machine, so they reach it through the proxy |
| `VAULTWARDEN_URL`, `PAPERLESS_URL`, `KARAKEEP_URL`, `MONEYMATTER_URL`, `POCKET_ID_URL`, `NTFY_URL`, and the other `*_URL` settings | The address an app is opened at, for the apps that need to know it (sign-in, links). Empty: `https://<subdomain>.<domain>`. Home mode writes the tailnet address, and Set up the domain clears it again (x-homelab `url`) |
| `HOMELAB_BASELINE` | `small`: `up` starts only updates, backups, and alerts, and you pick the rest (folders the desktop app makes). Empty or `full`: every app without a profile |
| `PHONE_COMPANION` | `true`: the serve job runs the phone companion on port 8099 (home network and tailnet only; phones pair with `homelab phone pair`). `false`: off |
| `CLOUDFLARE_API_TOKEN` | Secret. For the wildcard certificate and the tunnel's public hostnames. Permissions: Zone:Read, DNS:Edit, Cloudflare Tunnel:Edit |
| `TUNNEL_TOKEN` | Secret. The tunnel's token; cloudflared stays off until it is set |

## Nginx Proxy Manager and CrowdSec

| Variable | Default | Purpose |
|---|---|---|
| `NPM_VERSION` | `2.16.0` | Upstream version the custom image is built from |
| `NPM_HTTP_PORT`, `NPM_HTTPS_PORT` | 80, 443 | Proxy ports on the LAN |
| `NPM_ADMIN_PORT` | 8181 | Proxy admin UI on this Mac |
| `NPM_API_EMAIL` | `homelab@<domain>` | The automation account, created on first start; also the Let's Encrypt account email |
| `NPM_API_PASSWORD` | generated | Secret. Keep 2FA off for this account; use a separate personal admin with 2FA |
| `CROWDSEC_BOUNCER_KEY` | generated | Secret. Shared by CrowdSec (registers the bouncer) and the proxy (uses it) |
| `CROWDSEC_ENROLL_KEY` | empty | Optional. Enrolls the engine in the CrowdSec console |

## AdGuard Home

| Variable | Default | Purpose |
|---|---|---|
| `ADGUARD_PORT` | 3003 | Admin UI after setup |
| `ADGUARD_SETUP_PORT` | 3002 | First-run wizard |
| `ADGUARD_USER`, `ADGUARD_PASSWORD` | `admin`, empty | AdGuard's login: `homelab adguard setup` makes it in the first-run wizard, or put in the one you made there. The CLI uses it to add the `*.domain` rewrite. The password is a secret |

## Notifications and updates

| Variable | Default | Purpose |
|---|---|---|
| `NTFY_PORT` | 9293 | ntfy on this Mac |
| `WATCHTOWER_SCHEDULE` | `0 0 4 * * *` | Watchtower's cron (with seconds): 4:00 AM daily, after the 03:30 backup's dumps |
| `UPDATE_CHANNEL` | `testing` | What `homelab upgrade` gets: `stable` (the newest release tag, `v*`) or `testing` (every change on `main`). Before the first release, stable has nothing to move to |
| `AUTO_ROLLBACK` | `true` | The watchdog rolls back an app that stays unhealthy or keeps restarting 20 minutes to 6 hours after its update, and holds its updates. `false`: it only alerts |
| `UPDATES_HELD`, `UPDATES_HELD_CONTAINERS` | empty | Apps left out of nightly updates (after a rollback, or `homelab updates hold`), and their container names for Watchtower. Written by the CLI; `homelab updates release <app>` takes one off |

## App ports

Each app's port on this Mac is a variable named `<APP>_PORT` (for example `VAULTWARDEN_PORT=8087`). The installer moves a port if something else already holds it and writes the new value back. [Inventory](<Inventory.md>) shows the current addresses.

## App settings and secrets

| Variable | Purpose |
|---|---|
| `VAULTWARDEN_SIGNUPS_ALLOWED` | `false`. Turn on only while creating accounts; `./homelab doctor` warns while it is on |
| `DUPLICATI_SETTINGS_KEY`, `DUPLICATI_PASSWORD` | Secrets. Encrypts Duplicati's settings database; the web UI password |
| `NTFY_PHONE_PASSWORD` | Secret, made by `notify setup`. The phone's ntfy login (user `phone`, read-only on the alert topics) |
| `DUPLICATI_SECRETS_PASSPHRASE`, `DUPLICATI_PASSPHRASE` | Secrets. The backup jobs' encryption: the first for Homelab Secrets (keep it outside this machine too), the second for the rest |
| `IMMICH_VERSION` | `v3`. Immich image tag; a major upgrade means reading Immich's release notes first |
| `IMMICH_DB_PASSWORD` | Secret |
| `PAPERLESS_DB_PASSWORD`, `PAPERLESS_SECRET_KEY` | Secrets |
| `PAPERLESS_OCR_LANGUAGE` | `eng` |
| `MONEYMATTER_URL` | Empty: `https://money.<domain>`. MoneyMatter only signs in at exactly this address |
| `MONEYMATTER_DB_PASSWORD`, `MONEYMATTER_JWT_SECRET`, `MONEYMATTER_SESSION_SECRET`, `MONEYMATTER_AUTH_SECRET` | Secrets |
| `HOMARR_SECRET_ENCRYPTION_KEY` | Secret (only used if Homarr is installed) |
| `PROTONVPN_WIREGUARD_PRIVATE_KEY` | Secret. Gluetun and qBittorrent stay off until it is set |
| `PROTONVPN_SERVER_COUNTRIES` | Optional, for example `Netherlands` |

## Adding a variable

1. Add it to `.env.example` (secrets as `__REPLACE_ME__`, with a comment saying what it is for).
2. Add it to this page.
3. `./homelab up` adds it to `.env`. `./homelab validate` fails if a `requires` entry, or a port variable without a default, is missing from `.env.example`.
