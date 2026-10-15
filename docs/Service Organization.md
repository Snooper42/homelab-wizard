---
version: 0.1.0-alpha
---

# Service Organization

## Categories

Every app belongs to one category, declared in `x-homelab-categories` in `compose.yaml`. The category decides the folder its note lives in.

| Category | Folder | What belongs here |
|---|---|---|
| Network | `services/network` | Proxy, DNS, the tunnel, Tailscale, the VPN, connection checks |
| Security | `services/security` | Passwords, threat blocking, monitoring, alerts |
| System | `services/system` | Backups, updates, logs, start pages, and the helpers (databases, caches) other apps need |
| Cloud & Files | `services/cloud and files` | Photos, file sync, and sharing |
| Documents | `services/documents` | Paperwork, PDFs, saved links, feeds, the AI assistant |
| Finance | `services/finance` | Budgets and money |
| Media | `services/media` | Video, music, audiobooks, books, comics |
| Media Automation | `services/media automation` | Indexers, the *arr apps, requests, downloads |
| Household | `services/household` | The smart home, groceries and chores, recipes, to-dos |

Network and System apps manage the homelab, so `validate` refuses to publish them. Categories from before 0.9.0 (`infrastructure`, `productivity`, `home`) still work for your own apps: they count as System, Documents, and Household.

## Baseline and optional

| | Baseline | Optional |
|---|---|---|
| In compose | No `profiles` | `profiles: [optional]` |
| Started by | `./homelab up`, and the startup job after every login | `./homelab install <app>`; after that its restart policy brings it back with OrbStack |
| Purpose | What the household needs every day | Ready to slot in, fully configured and documented |

Baseline today: Nginx Proxy Manager, AdGuard Home, CrowdSec, Watchtower, Duplicati, Cloudflare Tunnel, Vaultwarden, Uptime Kuma, ntfy, Immich, Paperless-ngx, MoneyMatter, Navidrome, Feishin, Audiobookshelf, Calibre-Web, and Komga, plus Jellyfin natively.

Optional: the *arr set (Prowlarr, Sonarr, Radarr, Lidarr, Bazarr, FlareSolverr), Seerr, LazyLibrarian, qBittorrent with Gluetun, FreshRSS, Mealie, File Browser, Stirling PDF, Homarr, Homepage, and Kavita.

Moving an app between the two is one line: add or remove `profiles: [optional]`.

## Projects

| Where | When to use it |
|---|---|
| `compose/<category>.yaml` (`homelab_<category>`: `homelab_network`, `homelab_media`, …) | A single container, or a small app whose helpers are not shared. Each category is its own Compose project, run from the homelab folder, so OrbStack groups the containers by category. Services that depend on each other share a file (Gluetun sits with qBittorrent, the Docker socket proxy with Homarr and Dozzle) |
| `stacks/<name>/compose.yaml` (`homelab_<name>`) | Several containers, especially with a database; can be stopped, updated, and restored on its own |

## Bundles and selection

Bundles name a set of apps, declared in `x-homelab-bundles`:

| Bundle | Apps | Select with |
|---|---|---|
| `arr` | Prowlarr, Sonarr, Radarr, Lidarr, Bazarr, FlareSolverr | `@arr`, `'*-arr'`, `arrs` |

Apps can also be selected by alias (`overseerr` → Seerr, `money` → MoneyMatter) or by category (`cat:media`), so `./homelab stop cat:media-automation` or `./homelab start cat:media` acts on a whole group.

## Naming

| Thing | Rule | Example |
|---|---|---|
| Service name | Lowercase, hyphenated, unique across all files | `uptime-kuma`, `immich-server` |
| Display name | The product's own name | Uptime Kuma |
| Note | `services/<category folder>/<Display name>.md` | `services/security/Uptime Kuma.md` |
| Hostname | `<subdomain>.example.com`; short and obvious to family | `photos`, `docs`, `passwords` |
| Helper services | `<app>-db`, `<app>-redis`, `<app>-broker` | `paperless-db` |
| Data folder | `data/appdata/<service>` (core) or `appdata/<stack>` (stacks) | `data/appdata/navidrome` |
| Named volume | `<app>-<purpose>` | `immich-pgdata` |
| Vaultwarden entry | `homelab - <service> <credential>` | `homelab - paperless db password` |
