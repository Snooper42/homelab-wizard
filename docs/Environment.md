---
version: 0.13.0
---

# Environment

Every setting lives in `~/Homelab/.env`, read by every Compose project. `.env.example` in the repository is the template.

## How .env is managed

- `./homelab up` (or `install`) creates `.env` from `.env.example` with mode 0600. It sets `PUID`, `PGID`, and `TZ` from this machine, and replaces every `__REPLACE_ME__` with a generated secret.
- Later runs add keys that are new in `.env.example` and never change values you already have.
- Copy each generated secret into Vaultwarden as `homelab - <service> <credential>`.
- `.env` is never committed (`.gitignore`), never printed by the CLI, and never pasted into notes or chats. `./homelab backup` copies it into `recovery-staging/secrets` for the encrypted Homelab Secrets job.
- Never add `COMPOSE_PROJECT_NAME` or `COMPOSE_PROFILES`: they would override each stack's own project name and the optional profile.

## This machine

| Variable | Default | Purpose |
|---|---|---|
| `TZ` | this machine's timezone | Timezone for every container |
| `PUID`, `PGID` | your user and group (501, 20 on a Mac) | File ownership for linuxserver.io images and Paperless |
| `BIND_IP` | `127.0.0.1` | Where app ports listen. Keep it: other devices go through the proxy |
| `LAN_BIND_IP` | `0.0.0.0` | Where the proxy (80/443) and DNS (53) listen; follows the machine's address |
| `ADGUARD_DNS_BIND_IP` | empty | Where AdGuard Home's DNS (53) listens when not `LAN_BIND_IP`. On Linux, where systemd-resolved holds `127.0.0.53:53` (Ubuntu, Fedora), a new `.env` sets it to this machine's address, since a `0.0.0.0` bind would collide; `homelab doctor` warns when the address has changed |
| `DOCKER_SOCKET` | empty | Docker's socket for the apps that talk to Docker (Watchtower, the socket proxy); empty is `/var/run/docker.sock`. With Docker run as you (SteamOS, `homelab runtime install`), a new `.env` sets your own, `/run/user/<id>/docker.sock`, and `PUID`/`PGID` to 0: a container's root is your account then, so what the apps write is yours |
| `HOST_GATEWAY` | empty | How containers reach this machine's own apps (Jellyfin, the phone companion, Ollama) as `host.docker.internal`; empty is Docker's `host-gateway`. With Docker run as you, a new `.env` sets this machine's address, since `host-gateway` is then Docker's own namespace, not this machine; `homelab doctor` warns when the address has changed |
| `KEEP_AWAKE` | `true` | The awake job keeps this machine from sleeping while plugged in (the screen still sleeps). `false`: it sleeps as set |
| `BATTERY_SAVER` | `true` | On a laptop running on battery, the watchdog pauses the heavy background apps (`internal/battery` lists them) and starts them again on power; `false` keeps them running |
| `PHONE_COMPANION` | `true` | The serve job runs the phone companion on port 8099 (home network and tailnet only; phones pair with `homelab phone pair`). `false`: off |
| `HOMELAB_BASELINE` | empty | `small`: `up` starts only updates, backups, and alerts, and you pick the rest (folders the desktop app makes). Empty or `full`: every app without a profile |

## Storage

| Variable | Default | Purpose |
|---|---|---|
| `MEDIA_ROOT` | `/Volumes/Media` | The media drive: music, tv, movies, Books, comics, audiobooks, podcasts |
| `DOWNLOADS_ROOT` | `/Volumes/Media/downloads` | Download folder shared by qBittorrent and the *arr apps |
| `IMMICH_UPLOAD_LOCATION` | `/Volumes/Media/photos` | Immich's photo library |
| `BACKUP_DESTINATION` | `./backups` | Duplicati's destination: a *Homelab Backups* folder in a cloud drive's synced folder or on an external drive, which Setup › **Backups leave this machine** offers ([Backups](<Backups.md>)) |
| `JELLYFIN_DATA_DIR` | `~/.local/share/jellyfin` | Native Jellyfin's data folder, backed up by Duplicati |
| `SYNC_ROOT` | `./data/sync` | Syncthing's shared folders (backed up only if you add them to a Duplicati job) |

## Domain, Tailscale, and Cloudflare

Every new homelab starts in Home mode: `HOMELAB_DOMAIN` is empty, and a domain is optional.

| Variable | Default | Purpose |
|---|---|---|
| `HOMELAB_DOMAIN` | empty | Empty: Home mode, every app at `https://<TAILSCALE_HOST>:<port>` ([Tailscale](<../services/network/Tailscale.md#home-mode-no-domain>)). A domain such as `example.com` gives every app `https://<subdomain>.<domain>` through the proxy instead. An existing `.env` keeps its domain |
| `AUTO_DOMAIN` | `true` | With a domain, each new app gets its proxy host (and tunnel hostname, if public) as soon as it is installed, once Set up the domain has run. `false`: only when you run Set up the domain |
| `TAILSCALE_AUTHKEY` | empty | Optional secret. A reusable auth key signs Tailscale in without the browser; without one, `homelab tailnet login` opens Tailscale's sign-in page |
| `TAILSCALE_ROUTES` | this machine's network (`192.168.1.0/24` in the template) | The home network Tailscale makes reachable (approve the route in Tailscale's admin) |
| `TAILSCALE_EXTRA_ARGS` | empty | Extra flags for `tailscale up`: `--login-server=https://headscale.example.com` signs in to a tailnet on your own [Headscale](https://headscale.net) server instead of Tailscale's. The nightly test uses it for a fake tailnet |
| `TAILSCALE_HOST` | empty | Home mode only: this machine's tailnet name, written by `homelab tailnet setup` |
| `TAILNET_ADMIN_APPS` | `true` | Home mode: `false` keeps the admin apps (the proxy, AdGuard Home, Duplicati, Dozzle) off the tailnet, so only this machine opens them; the household's apps stay on it |
| `POCKET_ID_API_KEY` | generated | Pocket ID's static API key (`STATIC_API_KEY`), which `homelab sso setup` uses to make the apps' sign-in clients. A secret |
| `SSO_HOST` | empty | Pocket ID's name (`id.<domain>`), written by `homelab sso setup`; the apps that sign in with it map it to this machine, so they reach it through the proxy |
| `VAULTWARDEN_URL`, `PAPERLESS_URL`, `KARAKEEP_URL`, `MONEYMATTER_URL`, `POCKET_ID_URL`, `NTFY_URL`, and the other `*_URL` settings | empty | The address an app is opened at, for the apps that need to know it (sign-in, links). Empty: `https://<subdomain>.<domain>`. Home mode writes the tailnet address, and Set up the domain clears it again (x-homelab `url`) |
| `CLOUDFLARE_API_TOKEN` | empty | Secret. For the wildcard certificate and the tunnel's public hostnames. Permissions: Zone:Read, DNS:Edit, Cloudflare Tunnel:Edit |
| `TUNNEL_TOKEN` | empty | Secret. The tunnel's token; cloudflared stays off until it is set |

## Nginx Proxy Manager and CrowdSec

| Variable | Default | Purpose |
|---|---|---|
| `NPM_VERSION` | `2.16.0` | Upstream version the custom image is built from |
| `NPM_HTTP_PORT`, `NPM_HTTPS_PORT` | 80, 443 | Proxy ports on the LAN |
| `NPM_ADMIN_PORT` | 8181 | Proxy admin UI on this machine |
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
| `NTFY_PORT` | 9293 | ntfy on this machine |
| `NTFY_PUBLISH_TOKEN`, `NTFY_PUBLISH_AUTH` | empty | Secrets, filled in by `homelab notify setup`: the publishers' access token, and the same as an `?auth=` parameter for publishers that only take a URL |
| `NTFY_READ_TOKEN` | empty | Secret, made by `notify setup`: read-only access for the app's list of recent alerts |
| `DESKTOP_ALERTS` | `true` | Alerts also show on this machine's screen (Notification Center on a Mac). `false`: the phone only |
| `HELPER_EMAIL` | empty | Who helps you with the homelab: **Email it to my helper** writes to them with the diagnostics report |
| `HEARTBEAT_URL` | empty | An external heartbeat (such as a healthchecks.io ping URL, period and grace 15 minutes). The watchdog pings it every run and pings `/fail` when something is down |
| `WATCHTOWER_SCHEDULE` | `0 0 4 * * *` | Watchtower's cron (with seconds): 4:00 AM daily, after the 03:30 backup's dumps |
| `WATCHTOWER_VERSION` | `1.23.2` | Watchtower's version, chosen by hand: it controls Docker, so it does not update itself ([Security](<Security.md#threat-review-of-the-app-october-2026>), M6) |
| `SOCKET_PROXY_VERSION` | `v0.5.0` | `docker-socket-proxy`'s version, chosen by hand for the same reason |
| `UPDATE_CHANNEL` | `testing` | What `homelab upgrade` and the app's update get: `testing` (every build of `main`, numbered `v0.9.4-beta` and on) or `stable` (only a new minor or major version, `vX.Y.0`). Before the first such version, stable has nothing to move to |
| `UPDATES_PAUSED` | not in the template | Written by `homelab updates pause` (removed by `resume`): Watchtower stays stopped, also across `up` |
| `UPDATE_COPY_LIMIT` | `2GB` | The largest folder or volume `homelab update` copies before an app's update, for its rollback (`500MB`, `10GB`; `0` copies any size). A larger one is left out and named in the update's output; databases are dumped whatever their size |
| `AUTO_ROLLBACK` | `true` | The watchdog rolls back an app that stays unhealthy, keeps restarting, or does not answer 20 minutes to 6 hours after its update, and holds its updates; with its data from before the update only if it was never well after it. `false`: it only alerts |
| `AUTO_HEAL` | `true` | The watchdog restarts an app that is unhealthy or not answering on two checks in a row, and makes one whose container is gone again (once in 6 hours at most). `false`: it only alerts |
| `OLLAMA_MODEL` | empty | The Ollama model that explains logs (**Explain this log**, `homelab logs <app> --explain`), such as `llama3.2`. Empty: the first of Llama, Qwen, Gemma, Mistral, or Phi that Ollama has. Ollama's own `OLLAMA_HOST` says where it runs (this machine by default) |
| `UPDATES_HELD`, `UPDATES_HELD_CONTAINERS` | empty | Apps left out of nightly updates (after a rollback, or `homelab updates hold`), and their container names for Watchtower. Written by the CLI; `homelab updates release <app>` takes one off |

## App ports

Each app's port on this machine is a variable named `<APP>_PORT` (for example `VAULTWARDEN_PORT=8087`). The installer moves a port if something else already holds it and writes the new value back. [Inventory](<Inventory.md>) shows the current addresses.

## App settings and secrets

| Variable | Purpose |
|---|---|
| `VAULTWARDEN_SIGNUPS_ALLOWED` | `false`. Turn on only while creating accounts; `./homelab doctor` warns while it is on |
| `DUPLICATI_SETTINGS_KEY`, `DUPLICATI_PASSWORD` | Secrets. Encrypts Duplicati's settings database; the web UI password |
| `NTFY_PHONE_PASSWORD` | Secret, made by `notify setup`. The phone's ntfy login (user `phone`, read-only on the alert topics) |
| `DUPLICATI_SECRETS_PASSPHRASE`, `DUPLICATI_PASSPHRASE` | Secrets. The backup jobs' encryption: the first for Homelab Secrets (keep it outside this machine too, in Vaultwarden and on the recovery kit), the second for the rest |
| `IMMICH_VERSION` | `v3`. Immich image tag; a major upgrade means reading Immich's release notes first |
| `IMMICH_DB_PASSWORD` | Secret |
| `PAPERLESS_DB_PASSWORD`, `PAPERLESS_SECRET_KEY` | Secrets |
| `PAPERLESS_OCR_LANGUAGE` | `eng` |
| `PAPERLESS_DB_VERSION`, `ROMM_DB_VERSION`, `GHOSTFOLIO_DB_VERSION`, `DOCMOST_DB_VERSION`, `MONEYMATTER_DB_VERSION` | Each database's PostgreSQL major version (18, 17, 17, 17, 16). Change them only with `homelab db upgrade` |
| `VIKUNJA_SECRET` | Secret |
| `POCKET_ID_ENCRYPTION_KEY` | Secret. Pocket ID encrypts its keys with it; losing it means registering the passkeys again |
| `PSITRANSFER_ADMIN_PASSWORD`, `PSITRANSFER_UPLOAD_PASSWORD` | Secrets. The admin page's password, and the one needed to upload (keep it set so only the household can send files) |
| `HOMEBOX_ALLOW_REGISTRATION` | `true`. Turn it off once everyone has an account |
| `ROMM_DB_PASSWORD`, `ROMM_AUTH_SECRET_KEY` | Secrets |
| `ROMM_IGDB_CLIENT_ID`, `ROMM_IGDB_CLIENT_SECRET`, `ROMM_SCREENSCRAPER_USER`, `ROMM_SCREENSCRAPER_PASSWORD` | Optional: artwork and game details for RomM |
| `GHOSTFOLIO_DB_PASSWORD`, `GHOSTFOLIO_ACCESS_TOKEN_SALT`, `GHOSTFOLIO_JWT_SECRET_KEY` | Secrets. Changing the last two later signs everyone out of Ghostfolio for good |
| `DOCMOST_DB_PASSWORD`, `DOCMOST_APP_SECRET` | Secrets. Changing the app secret later signs everyone out of Docmost |
| `DAWARICH_DB_PASSWORD` | Secret |
| `MONEYMATTER_URL` | Empty: `https://money.<domain>`. MoneyMatter only signs in at exactly this address |
| `MONEYMATTER_DB_PASSWORD`, `MONEYMATTER_JWT_SECRET`, `MONEYMATTER_SESSION_SECRET`, `MONEYMATTER_AUTH_SECRET` | Secrets |
| `MONEYMATTER_FRONTEND_IMAGE`, `MONEYMATTER_BACKEND_IMAGE`, `MONEYMATTER_PLATFORM` | Empty: MoneyMatter's Intel images under Rosetta. Set them to images built from source to run natively ([MoneyMatter](<../services/finance/MoneyMatter.md>)) |
| `HOMARR_SECRET_ENCRYPTION_KEY` | Secret (only used if Homarr is installed) |
| `SPEEDTEST_APP_KEY` | Secret |
| `SPEEDTEST_SCHEDULE` | `0 */6 * * *`: how often the speed test runs |
| `OPEN_WEBUI_SECRET_KEY` | Secret |
| `KARAKEEP_NEXTAUTH_SECRET`, `KARAKEEP_MEILI_MASTER_KEY` | Secrets |
| `PROTONVPN_WIREGUARD_PRIVATE_KEY` | Secret. Gluetun and qBittorrent stay off until it is set |
| `PROTONVPN_SERVER_COUNTRIES` | Optional, for example `Netherlands` |

## Adding a variable

1. Add it to `.env.example` (secrets as `__REPLACE_ME__`, with a comment saying what it is for).
2. Add it to this page.
3. `./homelab up` adds it to `.env`. `./homelab validate` fails if a `requires` entry, or a port variable without a default, is missing from `.env.example`.
