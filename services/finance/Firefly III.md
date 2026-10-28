---
version: 0.11.0-beta
---

# Firefly III

A full household ledger, with budgets, bills, rules, and reports

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `firefly-iii` in `stacks/firefly-iii/compose.yaml` (project `homelab_firefly_iii`) |
| Image | `docker.io/fireflyiii/core:latest` |
| Category | Finance |
| Starts with `./homelab up` | No: optional, `./homelab install firefly-iii` |
| Address | https://firefly.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8094 (`FIREFLY_PORT`) |
| Depends on | `firefly-iii-db`, `firefly-iii-cron` |
| Helpers | `firefly-iii-db` `docker.io/library/postgres:18`, dumped daily by `./homelab backup`<br>`firefly-iii-cron` `docker.io/library/alpine:3` |
| Data | `firefly-iii-upload (volume)` → `/var/www/html/storage/upload` |
| Volume archive | `firefly-iii-upload` daily by `./homelab backup` into `recovery-staging/volumes/firefly-iii-upload` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | firefly |
<!-- END homelab:generated -->
## Purpose

A full ledger for the household's money: every account, what came in and went out, budgets, bills, and rules that sort transactions as they arrive, with reports over months and years. It is the detailed one of the homelab's money apps: [Actual Budget](<Actual Budget.md>) and [MoneyMatter](<MoneyMatter.md>) are for an envelope budget, Firefly III for keeping the books. Bank files come in through its data importer.

## Setup

1. `./homelab install firefly-iii` (it brings its PostgreSQL and its daily jobs); `./homelab install firefly-iii-importer` too for bank files.
2. Open it and register the first account: it is the administrator. Registration closes itself after that unless you allow more under Administration.
3. A fresh install has no client for personal access tokens, so Profile › OAuth cannot make one yet. Make it once: `./homelab compose firefly-iii exec firefly-iii php artisan passport:client --personal --name="Firefly III Personal Access Client" --provider=users --no-interaction`
4. For the importer: Profile › OAuth › Personal access tokens › Create new token, then put it in Settings as `FIREFLY_IMPORTER_TOKEN` and `./homelab up`. Open the importer (`http://localhost:8097`) and bring in a bank's CSV or CAMT file.

## How it works

- A PHP (Laravel) app with its own web server in one container, on port 8080 inside the stack; its data is in PostgreSQL (`firefly-iii-db`), and attachments in the volume `firefly-iii-upload`.
- `APP_KEY` (`FIREFLY_APP_KEY`, 32 characters) encrypts what it keeps; it must stay the same, or the data cannot be read.
- Recurring transactions, bill reminders, and auto-budgets run when its cron address is called: `firefly-iii-cron`, a small Alpine container, calls it daily at 03:00 with `FIREFLY_CRON_TOKEN`.
- The data importer (`firefly-iii-importer`) is a separate app that reads files (or a bank connection you set up in it) and sends the transactions to Firefly III's API with the personal access token.
- The stack has its own network; only Firefly III and the importer also join the shared `homelab` network that the proxy uses.

## Where things live

| What | Where |
|---|---|
| Accounts, transactions, budgets, rules, users | PostgreSQL in the Docker volume `homelab_firefly_iii_firefly-iii-pgdata` |
| Attachments (receipts, statements) | Docker volume `homelab_firefly_iii_firefly-iii-upload` → `/var/www/html/storage/upload` |
| Secrets | `FIREFLY_APP_KEY`, `FIREFLY_DB_PASSWORD`, `FIREFLY_CRON_TOKEN`, and `FIREFLY_IMPORTER_TOKEN` in `.env` |

## Everyday use

- **Add a transaction:** the + button, or the importer for a month's bank file at once.
- **Sort them:** Automation › Rules files transactions into categories and budgets as they arrive (for example, everything from the supermarket under Groceries).
- **Budgets:** Budgets sets an amount a month per budget, and shows what is left.
- **Bills:** Bills says which regular payments are due and which were paid.
- **Reports:** Reports compares months and years by category, budget, and account.
- **Apps:** there is no official phone app; the web pages work on a phone, and third-party apps use its API.

## Connects to

- [Paperless-ngx](<../documents/Paperless-ngx.md>) keeps the statements and receipts as documents; Firefly III can hold a copy as an attachment.
- [Duplicati](<../system/Duplicati.md>) takes what `./homelab backup` makes off-site: its database dump and its attachments' archive (see [Backups](<../../docs/Backups.md>)).
- `.env`: `FIREFLY_PORT` (default `8094`), `FIREFLY_IMPORTER_PORT` (default `8097`), `FIREFLY_URL`, `FIREFLY_IMPORTER_URL`, and the secrets above.

## Tinkering ideas

- Webhooks (Automation › Webhooks) call an address when a transaction is stored, for example a Home Assistant automation or an ntfy topic.
- Piggy banks track saving towards something (a holiday, a new laptop).
- The importer's configuration can be saved and reused, so each month's file goes in the same way.

## Useful commands

```sh
./homelab logs firefly-iii -f
./homelab compose firefly-iii ps
./homelab compose firefly-iii exec firefly-iii php artisan firefly-iii:verify
curl -s -H "Authorization: Bearer YOUR_TOKEN" -H "Accept: application/vnd.api+json" http://localhost:8094/api/v1/accounts?type=asset
```

## API

- **Token:** Profile › OAuth › Personal access tokens (after the one-time step in Setup).
- **Base URL:** `http://localhost:8094/api/v1` on this machine, `https://firefly.example.com/api/v1` on the LAN, with `Authorization: Bearer <token>` and `Accept: application/vnd.api+json`.
- The API reference is at [api-docs.firefly-iii.org](https://api-docs.firefly-iii.org).

## Learn more

- [firefly-iii.org](https://www.firefly-iii.org) and the [documentation](https://docs.firefly-iii.org)
- [GitHub: firefly-iii/firefly-iii](https://github.com/firefly-iii/firefly-iii) and the [data importer](https://github.com/firefly-iii/data-importer)

## Backup

`./homelab backup` dumps the PostgreSQL database nightly into `recovery-staging/databases/firefly-iii-db`, and Duplicati takes it off-site with the rest. Its attachments' volume is archived the same night (`recovery-staging/volumes`). `FIREFLY_APP_KEY` must come back with it: it is in `.env`, which the nightly backup copies into the encrypted Homelab Secrets job (see the recovery kit). Without it the restored data cannot be read.

## Troubleshooting

- **"Personal access client not found" when making a token:** the one-time step in Setup has not run yet.
- **The importer says it cannot reach Firefly III:** `FIREFLY_IMPORTER_TOKEN` is empty or was revoked; make a new one and `./homelab up`.
- **Signed out right after signing in, or links point elsewhere:** the address you opened is not `FIREFLY_URL`; set it in Settings and `./homelab up`.
- **It does not start where IPv6 is turned off in the kernel:** its web server also listens on `[::]:8080` and stops when that fails (as Tandoor's does). Turn IPv6 back on, which every desktop system has by default.
