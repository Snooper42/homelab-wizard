---
version: 0.15.0
---

# Redis and Valkey

In-memory stores used as caches and job queues. They hold nothing that cannot be rebuilt, so none is backed up.

| Service | Stack | Image | Holds |
|---|---|---|---|
| `immich-redis` | `homelab_immich` | `valkey/valkey:9`, pinned by digest | Immich's job queue |
| `paperless-broker` | `homelab_paperless` | `valkey/valkey:9-alpine` | Paperless's task queue |
| `moneymatter-redis` | `homelab_budget_tracker` | `redis:7` | MoneyMatter's cache and sessions |
| `ghostfolio-redis` | `homelab_ghostfolio` | `valkey/valkey:9-alpine` | Ghostfolio's cache and job queue (optional) |
| `docmost-redis` | `homelab_docmost` | `valkey/valkey:9-alpine` | Docmost's background jobs and live editing (optional) |
| `dawarich-redis` | `homelab_dawarich` | `valkey/valkey:9-alpine` | Dawarich's job queue (optional) |
| `nextcloud-redis` | `homelab_nextcloud` | `valkey/valkey:9-alpine` | Nextcloud's file locking and cache (optional) |
| built into `romm` | `homelab_romm` | inside `rommapp/romm`, updated with it | RomM's task queue and cache (optional) |

Valkey is the open-source continuation of Redis and speaks the same protocol.

## Rules

- Each app has its own instance on its stack's private network.
- Left out of the nightly updates: they move with the app's own release notes.

## How it works

- Each keeps its data in memory and answers on port 6379, with no password: only containers on the same stack network can reach it.
- [Paperless-ngx](<../documents/Paperless-ngx.md>) uses `paperless-broker` as Celery's broker: every document to consume or OCR waits there as a task until a worker takes it.
- [Immich](<../cloud and files/Immich.md>) keeps its background job queues (thumbnails, metadata, face detection, smart search) in `immich-redis`.
- [MoneyMatter](<../finance/MoneyMatter.md>) keeps cached data and sessions in `moneymatter-redis`; if it is wiped, you may have to sign in again.
- [Ghostfolio](<../finance/Ghostfolio.md>) caches data and queues its market-data jobs in `ghostfolio-redis`; it refills on its own.
- [RomM](<../media/RomM.md>) runs its own Redis inside its container for scans and caching.
- They save a snapshot (`dump.rdb`) to their data folder from time to time, so a restart keeps most keys where that folder is a named volume.

## Where things live

| What | Where |
|---|---|
| `paperless-broker` | volume `homelab_paperless_paperless-redisdata` → `/data` |
| `moneymatter-redis` | volume `homelab_budget_tracker_moneymatter-redis` → `/data` |
| RomM's built-in Redis | volume `homelab_romm_romm-redis` → `/redis-data` |
| `immich-redis`, `ghostfolio-redis`, `docmost-redis`, `dawarich-redis`, `nextcloud-redis` | no named volume; nothing there needs keeping |

## Connects to

- The data that matters for these apps is in [PostgreSQL](<../system/PostgreSQL.md>); these only hold work in progress and caches.
- The nightly updates skip them; [Duplicati](<../system/Duplicati.md>) does not back them up.

## Tinkering ideas

- See how many Paperless tasks are waiting: `LLEN celery` in `paperless-broker`.
- Check memory use with `INFO memory` and key counts with `INFO keyspace`.
- `valkey-cli --stat` prints a rolling line of keys, memory, and clients; Ctrl+C stops it.
- `valkey-cli --latency` measures how fast it answers.
- Watch commands arrive with `MONITOR` for a few seconds while an upload runs; it slows the server, so stop it with Ctrl+C.

## Useful commands

A ping, key counts, the Paperless queue length, memory, MoneyMatter's key count, a live view, the logs, and the volumes:

```zsh
./homelab compose immich exec immich-redis valkey-cli ping
./homelab compose paperless exec paperless-broker valkey-cli info keyspace
./homelab compose paperless exec paperless-broker valkey-cli llen celery
./homelab compose ghostfolio exec ghostfolio-redis valkey-cli info memory
./homelab compose money exec moneymatter-redis redis-cli dbsize
./homelab compose paperless exec paperless-broker valkey-cli --stat
./homelab logs paperless-broker -f
docker volume ls --filter name=redis
```

## Learn more

- Valkey: https://valkey.io/, source https://github.com/valkey-io/valkey, image https://hub.docker.com/r/valkey/valkey
- Redis: https://redis.io/docs/, image https://hub.docker.com/_/redis

## Troubleshooting

If one is corrupted, stop its stack, remove its volume (for example `docker volume rm homelab_paperless_paperless-redisdata`), and start the stack again. Queued jobs are lost; the app re-creates what it needs.
