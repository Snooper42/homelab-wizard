---
version: 0.11.0-beta
---

# Homarr

A dashboard with live container status: one page of links to every app, with which ones are running.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `homarr` in `compose/system.yaml` (project `homelab_system`) |
| Image | `ghcr.io/homarr-labs/homarr:latest` |
| Category | System |
| Starts with `./homelab up` | No: optional, `./homelab install homarr` |
| Address | https://homarr.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:7575 (`HOMARR_PORT`) |
| Depends on | `docker-socket-proxy` |
| Helpers | `docker-socket-proxy` `ghcr.io/tecnativa/docker-socket-proxy:v0.5.0` |
| Data | `data/appdata/homarr` → `/appdata` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/homarr` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

A start page for the family and a quick status view for the administrator.

## Setup

1. `./homelab install homarr` (it brings Docker Socket Proxy with it); with a domain, then `./homelab domain setup`.
2. Open `https://<TAILSCALE_HOST>:7575` in Home mode, or `https://homarr.example.com` with a domain, and create the admin account.
3. Add apps by their public addresses. Container status comes from `docker-socket-proxy` (read-only), already configured.

## How it works

- Homarr 1.x is a TypeScript (Next.js) app. Boards, apps, users, and integrations are in a SQLite database at `/appdata/db/db.sqlite`; the secrets in it (integration API keys and passwords) are encrypted with `SECRET_ENCRYPTION_KEY`.
- A task runner in the same container polls integrations and pings apps on a schedule, so widgets and status dots stay current.
- Container status comes from the Docker engine through `docker-socket-proxy` (`DOCKER_HOSTNAMES` and `DOCKER_PORTS` in the compose file), read-only.
- `./homelab backup` copies the database every day into `recovery-staging/databases/homarr`.

## Where things live

| What | Where |
|---|---|
| Everything Homarr keeps | `data/appdata/homarr` → `/appdata` |
| Database | `data/appdata/homarr/db/db.sqlite` (`/appdata/db/db.sqlite`) |
| Daily copies | `recovery-staging/databases/homarr/homarr-YYYYMMDD-HHMMSS.sqlite.gz` |

## Everyday use

- Open a board and switch to edit mode to add apps and widgets, move and resize them, then save.
- **Management** (from the user menu) holds apps, boards, integrations, users and groups, and settings.
- An app tile can show a status dot from a ping of its address.
- Choose a home board for everyone, or give each person their own board.

## Connects to

- Shares `docker-socket-proxy` with [Dozzle](<../system/Dozzle.md>).
- An alternative to [Homepage](<../system/Homepage.md>); run one or the other.
- Integrations take API keys from apps here, such as [Sonarr](<../media automation/Sonarr.md>), [Radarr](<../media automation/Radarr.md>), [Prowlarr](<../media automation/Prowlarr.md>), [qBittorrent](<../media automation/qBittorrent.md>), [Jellyfin](<../media/Jellyfin.md>), [AdGuard Home](<../network/AdGuard Home.md>), and [Home Assistant](<../household/Home Assistant.md>). Each integration form lists what it needs.
- Sign-in through [Pocket ID](<../security/Pocket ID.md>) works over OIDC (the `AUTH_PROVIDERS` and `AUTH_OIDC_*` environment variables in Homarr's docs).
- `.env`: `HOMARR_PORT`, `HOMARR_SECRET_ENCRYPTION_KEY`.

## Tinkering ideas

- Add the calendar widget with the Sonarr and Radarr integrations to see upcoming episodes and films.
- Add the DNS widget with the AdGuard Home integration for today's queries and blocks.
- Add a media server widget with the Jellyfin integration to see who is watching.
- Show a Home Assistant entity (a temperature, a door) on the family board.
- Make a family board with only the household apps, and an admin board with the system ones.
- Sign in with Pocket ID instead of a Homarr password.

## Useful commands

Its logs, a restart, the socket proxy it reads, a fresh database copy, the saved copies, and whether the page answers:

```zsh
./homelab logs homarr -f
./homelab compose homarr restart homarr
./homelab status docker-socket-proxy
./homelab backup --apply
ls -lh recovery-staging/databases/homarr
curl -sI http://localhost:7575
```

## Learn more

- Docs: https://homarr.dev/
- Source and image: https://github.com/homarr-labs/homarr

## Backup

`data/appdata/homarr` (boards, users, its database) is in the Homelab AppData job. `HOMARR_SECRET_ENCRYPTION_KEY` in `.env` is needed to read it back.

## Troubleshooting

If container status is empty, check `./homelab status docker-socket-proxy`.
