---
version: 0.1.0-alpha
---

# PostgreSQL

How the databases are run. Each app that needs PostgreSQL has its own database container in its own stack; none is shared and none is reachable from outside its stack.

| Database service | Stack | Image | Used by |
|---|---|---|---|
| `immich-database` | `homelab_immich` | `ghcr.io/immich-app/postgres` (14, vectorchord, pgvecto.rs), pinned by digest | Immich |
| `paperless-db` | `homelab_paperless` | `postgres:18` | Paperless-ngx |
| `moneymatter-db` | `homelab_budget_tracker` | `postgres:16` | MoneyMatter |
| `ghostfolio-db` | `homelab_ghostfolio` | `postgres:17` | Ghostfolio (optional) |
| `romm-db` | `homelab_romm` | `postgres:17` | RomM (optional) |

## Rules

- Data lives in named volumes, never in bind mounts.
- Watchtower never updates a database. A major version upgrade is `./homelab db upgrade <database>`: it dumps, starts the new version, loads the dump, checks it, and goes back by itself if a step fails ([Runbooks](<../../docs/Runbooks.md>)). Each database's major version is a setting (`PAPERLESS_DB_VERSION`, `GHOSTFOLIO_DB_VERSION`, `ROMM_DB_VERSION`, `MONEYMATTER_DB_VERSION`); change it only through that command.
- Immich's database only ever uses the image Immich's release specifies. Upgrade it only as Immich's release notes say.
- `./homelab backup` dumps every service marked `dump: postgres` at 03:30 with `pg_dumpall --clean --if-exists`.

## Connect

```bash
./homelab compose paperless exec paperless-db psql -U paperless
./homelab compose immich exec immich-database psql -U postgres -d immich
./homelab compose money exec moneymatter-db psql -U budget_tracker
./homelab compose ghostfolio exec ghostfolio-db psql -U ghostfolio
./homelab compose romm exec romm-db psql -U romm
```

## How it works

- Each container runs the official PostgreSQL image; Immich's is a build of it with vector extensions. On its first start it creates the user, password, and database from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. After that those settings are ignored, so changing a `*_DB_PASSWORD` in `.env` later does not change the password inside the database.
- The app reaches its database by service name on port 5432 over its stack's own network (`homelab_<stack>_default`). No database port is published on this Mac.
- Immich keeps the vectors for faces and smart search in its database with the VectorChord extension, which is why only Immich's image works for it.
- `./homelab backup` runs `pg_dumpall` inside each running database container at 03:30, gzips it, and keeps the newest 7 dumps of each. The Homelab Databases job in [Duplicati](<../system/Duplicati.md>) takes them off the Mac at 05:00.

## Where things live

| What | Where |
|---|---|
| Immich's data | volume `homelab_immich_immich-pgdata` → `/var/lib/postgresql/data` |
| Paperless's data | volume `homelab_paperless_paperless-pgdata` → `/var/lib/postgresql` (PostgreSQL 18 keeps its files in `18/docker` below it) |
| MoneyMatter's data | volume `homelab_budget_tracker_moneymatter-db` → `/var/lib/postgresql/data` |
| Ghostfolio's data | volume `homelab_ghostfolio_ghostfolio-pgdata` → `/var/lib/postgresql/data` |
| RomM's data | volume `homelab_romm_romm-pgdata` → `/var/lib/postgresql/data` |
| Daily dumps | `recovery-staging/databases/<service>/<service>-YYYYMMDD-HHMMSS.sql.gz` |
| Passwords | `.env`: `IMMICH_DB_PASSWORD`, `PAPERLESS_DB_PASSWORD`, `MONEYMATTER_DB_PASSWORD`, `GHOSTFOLIO_DB_PASSWORD`, `ROMM_DB_PASSWORD` |

## Connects to

- Each database has one client: [Immich](<../cloud and files/Immich.md>), [Paperless-ngx](<../documents/Paperless-ngx.md>), [MoneyMatter](<../finance/MoneyMatter.md>), [Ghostfolio](<../finance/Ghostfolio.md>), or [RomM](<../media/RomM.md>).
- Their queues and caches are in [Redis and Valkey](<../system/Redis and Valkey.md>).
- [Duplicati](<../system/Duplicati.md>) carries the dumps off the Mac; [Watchtower](<../system/Watchtower.md>) skips every database (`com.centurylinklabs.watchtower.enable=false`).

## Tinkering ideas

- See how big each database is (`\l+` in `psql`) and which tables are largest (`\dt+`).
- Watch what an app is doing with `SELECT * FROM pg_stat_activity;`.
- Browse a database in a throwaway Adminer bound to this Mac only: `docker run --rm --network homelab_paperless_default -p 127.0.0.1:8099:8080 adminer`, server `paperless-db`, then Ctrl+C to remove it.
- Read a dump to see what a restore would replay: `gunzip -c` one from `recovery-staging/databases` into `less`.
- Move MoneyMatter's database from 16 to 17: `./homelab db upgrade moneymatter-db` (read the app's release notes first).

## Useful commands

The version, databases with sizes, open connections, a readiness check, Immich's extensions, the logs, a preview of the nightly dump, the dumps on disk, and the data volumes. Paperless is the example; swap in the stack, service, and user from the table above:

```zsh
./homelab compose paperless exec paperless-db psql -U paperless -c 'SELECT version();'
./homelab compose paperless exec paperless-db psql -U paperless -c '\l+'
./homelab compose paperless exec paperless-db psql -U paperless -c 'SELECT datname, state, query_start FROM pg_stat_activity;'
./homelab compose paperless exec paperless-db pg_isready
./homelab compose immich exec immich-database psql -U postgres -d immich -c '\dx'
./homelab logs paperless-db -f
./homelab backup
ls -lh recovery-staging/databases/*
docker volume ls --filter name=pgdata
```

## Learn more

- Docs: https://www.postgresql.org/docs/
- Image: https://hub.docker.com/_/postgres and https://github.com/docker-library/postgres

## Restore

See [Disaster Recovery](<../../docs/Disaster Recovery.md>). In short: stop the app, pipe the gunzipped dump into `psql -d postgres` in the database container, and start the app.
