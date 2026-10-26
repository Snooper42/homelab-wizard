---
version: 0.9.0-beta
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
│   ├── budget-tracker/compose.yaml  homelab_budget_tracker (MoneyMatter)
│   ├── karakeep/, romm/, ghostfolio/, docmost/, dawarich/   one project each
│   └── custom/compose.yaml      your own apps (homelab custom add; not in git)
├── dockerfiles/npm-crowdsec/    the custom proxy image
├── config/crowdsec/             CrowdSec log acquisition
├── cmd/, internal/              the CLI's Go source
├── homelab                      runs the CLI, building it when the source changed
├── docs/, services/             this knowledge base
│
├── .env                         settings and secrets (not in git)
├── bin/                         the built CLI (not in git)
├── data/appdata/<service>/      core service data (not in git)
├── data/                        the homelab's own records (below; not in git)
├── appdata/<stack>/             stack data, e.g. Paperless documents (not in git)
├── recovery-staging/            dumps, archives, .env copy, restores (not in git)
├── backups/                     default Duplicati destination until set to Proton Drive (not in git)
├── recovery-kit.html            homelab recovery-kit: the printable page (no secrets)
├── export-<date>/               homelab export: the data in open formats
└── scripts/logs/                the jobs' logs and state files (not in git)
```

## The homelab's own records

| File | Written by | Holds |
|---|---|---|
| `data/storage.json` | the nightly backup | Photos per person (Immich, read from its database) and the size of each app folder in `data/appdata` and `appdata`, largest first; Status shows them |
| `data/updates.json` | the watchdog, `homelab rollback` | The image each app ran before its update, kept a week (`homelab-rollback/<app>:previous`) |
| `data/people.json`, `data/people/<name>.html` | `homelab person` | The household, and each person's welcome page |
| `data/sso/<app>.env` | `homelab sso setup` | An app's Pocket ID sign-in settings |
| `data/phones.json` | `homelab phone` | Paired phones |
| `data/setup.json` | Setup | Steps marked done by hand |
| `data/savings-history.json` | the nightly backup | The yearly savings over time |
| `data/upgrade/` | `homelab upgrade` | Where the folder was before the last upgrade (`previous.json`; for a folder the app made, a copy of its files), for `upgrade --back` |
| `data/homelab-move.json` | `homelab move in` | Where the bundle came from and what ran there, until the move is done |
| `data/appdata/tailscale/serve.json` | `homelab tailnet setup` | Home mode: the app addresses Tailscale Serve answers |
| `scripts/logs/watchdog-state.json` | the watchdog | Its last run, failing checks, and per-check pass and run counts for each of the last 7 days (`days`) |
| `scripts/logs/restore-test.json` | `homelab restore-test` | The last 24 restore tests |
| `scripts/logs/digest.json` | the nightly backup | When the weekly summary was last sent |
| `scripts/logs/<part>.log`, `<part>.1.log` | the background agent | Each part's output (the watchdog, the backup, startup, …); at 5 MB the older half moves to `<part>.1.log`, replacing the one before |


Keep the repository at `~/Homelab`. Inside `~/Desktop`, `~/Documents`, `~/Downloads`, or a cloud-synced folder, macOS privacy controls and file syncing interfere with containers (`./homelab doctor` warns).

## recovery-staging

| Folder | Written by | Read by |
|---|---|---|
| `databases/<service>/` | `homelab backup` (gzipped `pg_dumpall`, newest 7) | Homelab Databases job (`/staging/databases`) |
| `volumes/<volume>/` | `homelab backup` (tar.gz, newest 7) | Homelab Databases job (`/staging/volumes`) |
| `secrets/homelab.env` | `homelab backup` (copy of `.env`, mode 0600) | Homelab Secrets job (`/staging/secrets`) |
| `restore/`, `restore-test/` | Duplicati restores | You, and `homelab restore-test` |

## Named volumes

Databases and caches use named volumes inside the container runtime (OrbStack's VM on a Mac): faster than bind mounts on macOS, and safe from Finder and Spotlight. Their contents reach backups only through `homelab backup`.

| Volume | Holds | Backed up |
|---|---|---|
| `homelab_immich_immich-pgdata` | Immich database | Daily dump |
| `homelab_immich_immich-model-cache` | Machine-learning models | No (downloaded again) |
| `homelab_paperless_paperless-pgdata` | Paperless database | Daily dump |
| `homelab_paperless_paperless-redisdata` | Paperless task queue | No |
| `homelab_budget_tracker_moneymatter-db` | MoneyMatter database | Daily dump |
| `homelab_budget_tracker_moneymatter-attachments` | MoneyMatter attachments | Daily archive |
| `homelab_budget_tracker_moneymatter-redis`, `-rates` | Cache, exchange rates | No (rebuilt) |
| `homelab_karakeep_karakeep-meilisearch` | Karakeep's search index | No (rebuilds itself) |
| `homelab_romm_romm-pgdata`, `homelab_ghostfolio_ghostfolio-pgdata`, `homelab_docmost_docmost-pgdata`, `homelab_dawarich_dawarich-pgdata` | Each optional stack's database | Daily dump |
| `homelab_romm_romm-redis`, `homelab_dawarich_dawarich-public` | Cache, generated files | No |
| `homelab_core_npm-logs` | Proxy logs, shared with CrowdSec (kept its `homelab_core` name after the category split) | No |
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
