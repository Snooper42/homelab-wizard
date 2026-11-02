---
version: 0.16.0
---

# Service Organization

## Categories

Every app belongs to one category, declared in `x-homelab-categories` in `compose.yaml`. The category decides the folder its note lives in.

| Category | Folder | What belongs here |
|---|---|---|
| Network | `services/network` | Proxy, DNS, ad blocking on the tailnet, the tunnel, Tailscale, connection checks |
| Security | `services/security` | Passwords, sign-in (Pocket ID), threat blocking, monitoring, alerts |
| System | `services/system` | Backups, updates, logs, start pages, the phone companion, and the helpers (databases, caches) other apps need |
| Cloud & Files | `services/cloud and files` | Photos, file sync and sharing, calendars and contacts, location history |
| Documents | `services/documents` | Paperwork, PDFs, saved links, feeds, notes, the wiki, page watching, the AI assistant |
| Finance | `services/finance` | Budgets, investments, subscriptions (the app's own **Finances** screen is part of Homelab Wizard, not an app in the catalog) |
| Media | `services/media` | Video, music, audiobooks, books, comics, games |
| Media Automation | `services/media automation` | Indexers, the *arr apps, requests, downloads |
| Household | `services/household` | The smart home, groceries and chores, recipes, to-dos, home inventory |

Network and System apps manage the homelab, so `validate` refuses to publish them. Categories from before 0.9.0 (`infrastructure`, `productivity`, `home`) still work for your own apps: they count as System, Documents, and Household.

## Baseline and optional

| | Baseline | Optional |
|---|---|---|
| In compose | No `profiles` | `profiles: [optional]` |
| Started by | `./homelab up`, and the startup job after every login | `./homelab install <app>` or Choose stacks; after that its restart policy brings it back with OrbStack |
| Purpose | What the household needs every day | Ready to slot in, fully configured and documented |

Baseline today: Nginx Proxy Manager, AdGuard Home, CrowdSec, Duplicati, Cloudflare Tunnel, Vaultwarden, Uptime Kuma, ntfy, Immich, Paperless-ngx, MoneyMatter, Navidrome, Feishin, Audiobookshelf, Calibre-Web, and Komga, plus Jellyfin and the phone companion natively.

Small baseline: a folder the desktop app makes (or any with `HOMELAB_BASELINE=small`) starts only Duplicati, ntfy, and Uptime Kuma (`x-homelab-small-baseline` in `compose.yaml`); the household picks every other app, the baseline ones included, in Choose stacks.

Optional: every other app. `./homelab apps` lists each one as baseline, optional, or native, and [Inventory](<Inventory.md>) has their addresses.

Moving an app between the two is one line: add or remove `profiles: [optional]`.

## Projects

| Where | When to use it |
|---|---|
| `compose/<category>.yaml` (`homelab_<category>`: `homelab_network`, `homelab_media`, …) | A single container, or a small app whose helpers are not shared. Each category is its own Compose project, run from the homelab folder, so OrbStack groups the containers by category. Services that depend on each other share a file (Gluetun sits with qBittorrent, the Docker socket proxy with Homarr and Dozzle) |
| `stacks/<name>/compose.yaml` (`homelab_<name>`) | Several containers, especially with a database; can be stopped, updated, and restored on its own. Today: `beszel`, `budget-tracker` (MoneyMatter), `cloudflare`, `dawarich`, `docmost`, `firefly-iii`, `frigate`, `ghostfolio`, `immich`, `karakeep`, `linkwarden`, `nextcloud`, `paperless`, `romm`, `tandoor`, and `custom` once you add your own app |

## Bundles and selection

Bundles name a set of apps, declared in `x-homelab-bundles`. The ones marked `starter: true` are the **Start here** cards in Choose stacks.

| Bundle | Apps | Select with |
|---|---|---|
| `photos` (starter) | Immich | `@photos` |
| `passwords` (starter) | Vaultwarden | `@passwords` |
| `movies` (starter) | Jellyfin | `@movies` |
| `music` (starter) | Navidrome, Feishin, beets | `@music` |
| `files` (starter) | File Browser, Syncthing | `@files` |
| `arr` | Prowlarr, Sonarr, Radarr, Lidarr, Bazarr, FlareSolverr, qBittorrent (with Gluetun), Seerr | `@arr`, `'*-arr'`, `arrs` |
| `household` | Home Assistant, Grocy, Vikunja, Karakeep, Homepage | `@household` |
| `adblock` | AdGuard Home, `tailnet-dns` | `@adblock` |
| `remote` | Tailscale | `@remote` |

Each stack folder is a preset too (`stack:<name>`).

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
