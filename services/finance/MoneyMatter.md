---
version: 0.16.0
---

# MoneyMatter

The household budget tracker: accounts, transactions, budgets, and reports, with exchange rates for foreign currencies.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `moneymatter-frontend` in `stacks/budget-tracker/compose.yaml` (project `homelab_budget_tracker`) |
| Image | `letehaha/budget-tracker-fe:sha-f862f3d` |
| Category | Finance |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://money.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:13480 (`MONEYMATTER_PORT`) |
| Depends on | `moneymatter-backend` |
| Helpers | `moneymatter-backend` `letehaha/budget-tracker-be:sha-f862f3d`, volume `moneymatter-attachments` archived daily by `./homelab backup`<br>`moneymatter-db` `postgres:16`, dumped daily by `./homelab backup`<br>`moneymatter-redis` `redis:7`<br>`moneymatter-rates` `letehaha/currency-rates-api:latest` |
| Updates | By hand. Pinned to the tested v0.30.2 build; read the release notes, then bump the frontend and backend tags together (its note) |
| Also known as | moneymatter, budget-tracker, money |
<!-- END homelab:generated -->

## Purpose

Track spending and budgets on our own hardware instead of a third-party service.

The stack mirrors MoneyMatter's own self-hosting compose file. Its images are Intel-only, so they run through Rosetta (or natively, built from source: see below), and they are pinned to one tested build.

## Setup

1. Open the address in `MONEYMATTER_URL`: `https://<TAILSCALE_HOST>:13480` in Home mode, or `https://money.example.com` with a domain (sign-in does not work at localhost).
2. Create your account. Demo mode is off.
3. The first start is slow under Rosetta; the health checks allow 5 minutes.

**Updating:** read the release notes, change the two `letehaha/budget-tracker-*:sha-...` tags in `stacks/budget-tracker/compose.yaml`, run `./homelab backup --apply`, then `./homelab compose money pull` and `./homelab compose money up -d`.

## Running natively on Apple Silicon (optional)

MoneyMatter only publishes Intel images, but its Dockerfiles build for any CPU (Node on Alpine for the backend, static files served by nginx for the frontend), and its own release workflow notes that adding `linux/arm64` is all multi-arch images need. Built natively, the frontend and backend start in seconds instead of minutes and skip Rosetta. The exchange-rate service stays on Intel: its source is not public.

1. Back up first: `./homelab backup --apply`.
2. Build both images from the same v0.30.2 commit the pinned images come from (a few minutes each; OrbStack includes `docker buildx`):

   ```sh
   docker buildx build --platform linux/arm64 --load -t homelab/moneymatter-frontend:v0.30.2 -f self-hosting/frontend/Dockerfile "https://github.com/letehaha/budget-tracker.git#f862f3d3c5c008ce10bcf7e5af31429b35b486a7"
   docker buildx build --platform linux/arm64 --load -t homelab/moneymatter-backend:v0.30.2 -f self-hosting/backend/Dockerfile "https://github.com/letehaha/budget-tracker.git#f862f3d3c5c008ce10bcf7e5af31429b35b486a7"
   ```

3. In Settings (or `.env`): `MONEYMATTER_FRONTEND_IMAGE=homelab/moneymatter-frontend:v0.30.2`, `MONEYMATTER_BACKEND_IMAGE=homelab/moneymatter-backend:v0.30.2`, `MONEYMATTER_PLATFORM=linux/arm64`.
4. `./homelab up`: the frontend and backend are recreated from the new images. The database, attachments, and accounts are untouched, since it is the same version.

**Check:** `docker image inspect homelab/moneymatter-backend:v0.30.2 --format '{{.Architecture}}'` says `arm64`, and the app opens and signs in at `MONEYMATTER_URL`.

**Updating a native build:** build the new commit with a new tag (for example `v0.31.0`), change the two settings, and run `./homelab up`. `homelab update moneymatter` cannot pull images built here. **Going back:** empty the three settings and run `./homelab up`; the pinned Intel images return.

## How it works

This is what the stack file (`stacks/budget-tracker/compose.yaml`) sets up, mirroring MoneyMatter's own `self-hosting/docker-compose.yml`:

- **`moneymatter-frontend`:** the web app, static files served by nginx on port 80. It skips the landing page (`SKIP_LANDING`) and passes API calls (`/api/v1`) to the backend at `http://moneymatter-backend:8081`. It waits until the backend reports healthy.
- **`moneymatter-backend`:** the API, a Node app on port 8081 with a `/health` check. It runs in self-host mode with demo mode off (`SYSTEM_DEMO_DISABLED`), signs people in only at `MONEYMATTER_URL` (`BETTER_AUTH_URL`, `AUTH_ORIGIN`), and stores attachments in `/app/packages/backend/data/attachments`.
- **`moneymatter-db`:** PostgreSQL 16 with the `budget_tracker` database and user.
- **`moneymatter-redis`:** Redis 7 for cache and sessions.
- **`moneymatter-rates`:** the exchange-rate service on port 8080. It keeps its rates in SQLite (`currency_rates.db`), with USD as the base, fills them on first start, and syncs four times a day (`SYNC_CRON`).
- Only the frontend joins the shared `homelab` network for the proxy; the other four are on the stack's own network. All five are left out of the nightly updates.

## Where things live

| What | Where |
|---|---|
| Database | Docker volume `homelab_budget_tracker_moneymatter-db` → `/var/lib/postgresql/data` in `moneymatter-db` |
| Attachments | Docker volume `homelab_budget_tracker_moneymatter-attachments` → `/app/packages/backend/data/attachments` in `moneymatter-backend` |
| Exchange rates | Docker volume `homelab_budget_tracker_moneymatter-rates` → `/app/data/currency_rates.db` in `moneymatter-rates` |
| Cache and sessions | Docker volume `homelab_budget_tracker_moneymatter-redis` → `/data` in `moneymatter-redis` |
| Image tags and platform | `MONEYMATTER_FRONTEND_IMAGE`, `MONEYMATTER_BACKEND_IMAGE`, `MONEYMATTER_PLATFORM` in `.env` (empty: the pinned Intel images) |

## Everyday use

- Open it at `https://money.example.com` (exactly `MONEYMATTER_URL`) and keep accounts, transactions, budgets, and reports there.
- Accounts in other currencies are converted with the rates from `moneymatter-rates`, refreshed four times a day.
- On a phone, open the same address and add it to the home screen.

## Connects to

- [Ghostfolio](<Ghostfolio.md>) tracks investments and net worth; [Wallos](<Wallos.md>) tracks subscriptions. MoneyMatter is the day-to-day budget. [Savings](<../../docs/Savings.md>) counts it against YNAB.
- [PostgreSQL](<../system/PostgreSQL.md>) and [Redis and Valkey](<../system/Redis and Valkey.md>) list its database and cache; the nightly updates leave its pinned images alone.
- [Known Issues](<../../docs/Known Issues.md>) ISSUE-0009 covers the Rosetta images and the native build.
- `.env`: `MONEYMATTER_PORT` (default `13480`), `MONEYMATTER_URL`, `MONEYMATTER_DB_PASSWORD`, `MONEYMATTER_JWT_SECRET`, `MONEYMATTER_SESSION_SECRET`, `MONEYMATTER_AUTH_SECRET`, and the three image settings above.

## Tinkering ideas

- Run the frontend and backend natively on Apple Silicon with the steps above, and compare start times.
- Read the release notes on GitHub before each bump, and keep the frontend and backend on the same commit.
- Watch it in [Uptime Kuma](<../security/Uptime Kuma.md>) with an HTTP monitor on `https://money.example.com`, so you hear when a slow Rosetta start does not finish.
- Browse your own data with `psql` (below), using only `SELECT`, to see how accounts and transactions are stored.

## Useful commands

Check the five containers, follow the backend and exchange-rate logs, restart the backend, check both health endpoints from inside their containers, and open the database:

```zsh
./homelab compose money ps
./homelab logs moneymatter-backend -f
./homelab logs moneymatter-rates -f
./homelab compose money restart moneymatter-backend
./homelab compose money exec moneymatter-backend wget -qO- http://localhost:8081/health
./homelab compose money exec moneymatter-rates wget -qO- http://localhost:8080/health
./homelab compose money exec moneymatter-db psql -U budget_tracker budget_tracker
```

## Learn more

- [GitHub: letehaha/budget-tracker](https://github.com/letehaha/budget-tracker) (source, release notes, and the Dockerfiles the native build uses)

## Backup

| Data | How |
|---|---|
| Database | Dumped daily by `./homelab backup`, then the Homelab Databases job |
| Attachments (`moneymatter-attachments` volume) | Archived daily by `./homelab backup`, then the Homelab Databases job |
| Exchange rates, cache | Not backed up (rebuilt automatically) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sign-in loops or fails | Open it at exactly `MONEYMATTER_URL` |
| Frontend waits forever | The backend is still starting (Rosetta). `./homelab compose money ps` until it is healthy |
| Exchange rates missing | `./homelab logs moneymatter-rates`; it syncs four times a day |
