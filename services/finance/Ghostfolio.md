---
version: 0.9.0-beta
---

# Ghostfolio

Investments and net worth across every account, with performance and dividends

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `ghostfolio` in `stacks/ghostfolio/compose.yaml` (project `homelab_ghostfolio`) |
| Image | `docker.io/ghostfolio/ghostfolio:latest` |
| Category | Finance |
| Starts with `./homelab up` | No: optional, `./homelab install ghostfolio` |
| Address | https://invest.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3333 (`GHOSTFOLIO_PORT`) |
| Depends on | `ghostfolio-db`, `ghostfolio-redis` |
| Helpers | `ghostfolio-db` `docker.io/library/postgres:17`, dumped daily by `./homelab backup`<br>`ghostfolio-redis` `docker.io/valkey/valkey:9-alpine` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | investments, portfolio, net-worth |
<!-- END homelab:generated -->

## Purpose

Investments and net worth across every brokerage, retirement, and savings account: holdings, performance over time, allocation, and dividends, without handing your account logins to a third party. Prices come from public market data.

## Setup

1. `./homelab install ghostfolio` and open `https://<TAILSCALE_HOST>:3333` in Home mode, or `https://invest.example.com` with a domain.
2. **Get started** creates the first account, which becomes the admin. Save the security token it shows in Vaultwarden (`homelab - ghostfolio token`): it is how you sign in.
3. Add accounts, then import activities from each brokerage's CSV export (Portfolio › Activities › Import) or add them by hand.

`GHOSTFOLIO_ACCESS_TOKEN_SALT` and `GHOSTFOLIO_JWT_SECRET_KEY` in `.env` must never change: a new salt makes every security token stop working.

## Away from home

In Home mode (the default), Ghostfolio is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere.

## How it works

- A TypeScript app: a NestJS API and an Angular web app, served together on port 3333.
- Three containers: `ghostfolio`, `ghostfolio-db` (PostgreSQL 17, through the Prisma ORM), and `ghostfolio-redis` (Valkey, its cache). The helpers are only on the stack's own network; `ghostfolio` also joins the shared `homelab` network for the proxy.
- You record activities (buys, sells, dividends, fees) per account. Ghostfolio fetches prices for each symbol from public data sources (Yahoo Finance by default, CoinGecko for crypto) on a schedule and works out values, performance, and allocation from them.
- There is no user name or password: each user signs in with a security token. `GHOSTFOLIO_ACCESS_TOKEN_SALT` hashes those tokens and `GHOSTFOLIO_JWT_SECRET_KEY` signs sessions, which is why neither may change.
- Nothing is kept in files; everything is in the database.

## Where things live

| What | Where |
|---|---|
| Database (accounts, activities, market data, users) | Docker volume `homelab_ghostfolio_ghostfolio-pgdata` → `/var/lib/postgresql/data` in `ghostfolio-db` |
| Cache | `ghostfolio-redis`, in memory only (rebuilt on its own) |
| Secrets | `GHOSTFOLIO_DB_PASSWORD`, `GHOSTFOLIO_ACCESS_TOKEN_SALT`, `GHOSTFOLIO_JWT_SECRET_KEY` in `.env` |

## Everyday use

- **Record:** Portfolio › Activities › add one by hand, or import a CSV or JSON file; the same page exports everything.
- **See where you stand:** Overview for the total and the chart, Holdings for each position, Summary for the figures.
- **Dig in:** Portfolio › Analysis (performance and dividends by period), Allocations (by account, asset class, currency, region), and X-ray (rule checks for risks such as too much in one fund).
- **Plan:** Portfolio › FIRE projects when your savings could cover your spending.
- **Hide the numbers:** the eye icon switches to a view without amounts, useful when showing someone the screen.
- **Phone:** it is a Progressive Web App: open `https://invest.example.com` and add it to the home screen.

## Connects to

- [Vaultwarden](<../security/Vaultwarden.md>) holds each user's security token (`homelab - ghostfolio token`).
- [MoneyMatter](<MoneyMatter.md>) tracks day-to-day spending and budgets; Ghostfolio tracks what you invest. [Wallos](<Wallos.md>) covers subscriptions.
- [PostgreSQL](<../system/PostgreSQL.md>) and [Redis and Valkey](<../system/Redis and Valkey.md>) describe its helpers; `./homelab backup` dumps the database daily (see [Backups](<../../docs/Backups.md>)).
- `.env`: `GHOSTFOLIO_PORT` (default `3333`) and the three secrets above.

## Tinkering ideas

- Benchmarks: as admin, add an index fund under Admin Control › Market Data and mark it as a benchmark, then compare against it in Analysis.
- Cash and savings accounts: give each account its cash balance so net worth includes it, not only investments.
- A read-only share: My Ghostfolio › Access › grant a public access, and the public portfolio page shows allocation without amounts.
- Tags on activities to group them your own way (for example by goal).
- Crypto prices with a CoinGecko demo key: add `API_KEY_COINGECKO_DEMO` to the `ghostfolio` service, then `./homelab compose ghostfolio up -d`.
- An AI assistant over your portfolio: Ghostfolio has an experimental MCP server (`ENABLE_FEATURE_MCP=true`, then an MCP access under My Ghostfolio › Access).

## Useful commands

Follow the log, check the three containers, restart, open the database, check health, and get an API token from your security token:

```zsh
./homelab logs ghostfolio -f
./homelab compose ghostfolio ps
./homelab compose ghostfolio restart ghostfolio
./homelab compose ghostfolio exec ghostfolio-db psql -U ghostfolio ghostfolio
curl -s http://localhost:3333/api/v1/health
curl -s -X POST -H "Content-Type: application/json" -d '{"accessToken":"YOUR_SECURITY_TOKEN"}' http://localhost:3333/api/v1/auth/anonymous
```

## API

- **Token:** POST your security token to `/api/v1/auth/anonymous` (above); the `authToken` it returns goes in `Authorization: Bearer <token>`.
- **Base URL:** `http://localhost:3333/api/v1` on this Mac, or `https://invest.example.com/api/v1`.
- **Export everything:** `curl -s -H "Authorization: Bearer YOUR_AUTH_TOKEN" http://localhost:3333/api/v1/export`
- **Import:** `POST /api/v1/import` with the same JSON format the export produces. The endpoints are listed in the README on GitHub.

## Learn more

- [ghostfol.io](https://ghostfol.io)
- [GitHub: ghostfolio/ghostfolio](https://github.com/ghostfolio/ghostfolio) (source of the `ghostfolio/ghostfolio` image, with the API in its README)

## Backup

The nightly backup dumps Ghostfolio's database. The cache rebuilds on its own.

## Troubleshooting

- **Prices are missing for a fund:** set its data source to Yahoo Finance in the admin's Market Data, or add prices by hand.
- **Everyone is signed out and tokens fail:** `GHOSTFOLIO_ACCESS_TOKEN_SALT` changed; restore `.env` from the Secrets backup.
