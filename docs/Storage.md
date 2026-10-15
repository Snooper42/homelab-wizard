---
version: 0.1.0-alpha
---

# Storage

## Repository layout

```text
~/Homelab/
├── compose.yaml                 the catalog: categories, presets, native apps
├── compose/<category>.yaml      homelab_<category>: the single-container apps, one project each
├── stacks/
│   ├── cloudflare/compose.yaml  homelab_cloudflare
│   ├── immich/compose.yaml      homelab_immich
│   ├── paperless/compose.yaml   homelab_paperless
│   └── budget-tracker/compose.yaml  homelab_budget_tracker (MoneyMatter)
├── dockerfiles/npm-crowdsec/    the custom proxy image
├── config/crowdsec/             CrowdSec log acquisition
├── cmd/, internal/              the CLI's Go source
├── homelab                      runs the CLI, building it when the source changed
├── docs/, services/             this knowledge base
│
├── .env                         settings and secrets (not in git)
├── bin/                         the built CLI (not in git)
├── data/appdata/<service>/      core service data (not in git)
├── appdata/<stack>/             stack data, e.g. Paperless documents (not in git)
├── recovery-staging/            dumps, archives, .env copy, restores (not in git)
├── backups/                     default Duplicati destination until set to Proton Drive (not in git)
└── scripts/logs/                launchd job logs and watchdog state (not in git)
```

Keep the repository at `~/Homelab`. Inside `~/Desktop`, `~/Documents`, `~/Downloads`, or a cloud-synced folder, macOS privacy controls and file syncing interfere with containers (`./homelab doctor` warns).

## recovery-staging

| Folder | Written by | Read by |
|---|---|---|
| `databases/<service>/` | `homelab backup` (gzipped `pg_dumpall`, newest 7) | Homelab Databases job (`/staging/databases`) |
| `volumes/<volume>/` | `homelab backup` (tar.gz, newest 7) | Homelab Databases job (`/staging/volumes`) |
| `secrets/homelab.env` | `homelab backup` (copy of `.env`, mode 0600) | Homelab Secrets job (`/staging/secrets`) |
| `restore/`, `restore-test/` | Duplicati restores | You, and `homelab restore-test` |

## Named volumes

Databases and caches use named volumes inside OrbStack's VM: faster than bind mounts on macOS, and safe from Finder and Spotlight. Their contents reach backups only through `homelab backup`.

| Volume | Holds | Backed up |
|---|---|---|
| `homelab_immich_immich-pgdata` | Immich database | Daily dump |
| `homelab_immich_immich-model-cache` | Machine-learning models | No (downloaded again) |
| `homelab_paperless_paperless-pgdata` | Paperless database | Daily dump |
| `homelab_paperless_paperless-redisdata` | Paperless task queue | No |
| `homelab_budget_tracker_moneymatter-db` | MoneyMatter database | Daily dump |
| `homelab_budget_tracker_moneymatter-attachments` | MoneyMatter attachments | Daily archive |
| `homelab_budget_tracker_moneymatter-redis`, `-rates` | Cache, exchange rates | No (rebuilt) |
| `homelab_core_npm-logs` | Proxy logs, shared with CrowdSec | No |
| `homelab_core_adguard-work` | AdGuard query log and statistics | No |

Never run `docker volume prune` or `docker system prune --volumes`.

## Media drive

`/Volumes/Media`, an external drive.

| Folder | Used by |
|---|---|
| `music` | Navidrome (read-only, same path inside the container), Lidarr |
| `audiobooks`, `podcasts` | Audiobookshelf |
| `Books` | Calibre-Web (the Calibre library), Kavita, LazyLibrarian |
| `comics` | Komga, Kavita (read-only) |
| `movies`, `tv` | Jellyfin, Radarr, Sonarr, Bazarr |
| `photos` | Immich (`IMMICH_UPLOAD_LOCATION`) |
| `downloads` | qBittorrent and the *arr apps |

The startup job waits up to 15 minutes for the drive. Photos and the Calibre library are backed up by their own Duplicati jobs; other media is not (see [Backups](<Backups.md>)).

## Duplicati paths

Jobs always use container paths. The full mapping is in [Backups](<Backups.md>).

## Native app data

| App | Folder | Backed up |
|---|---|---|
| Jellyfin | `JELLYFIN_DATA_DIR` (default `~/.local/share/jellyfin`) | Homelab Jellyfin job |
