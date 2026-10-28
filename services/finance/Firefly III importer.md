---
version: 0.11.0-beta
---

# Firefly III importer

Brings bank files (CSV, CAMT) into Firefly III

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `firefly-iii-importer` in `stacks/firefly-iii/compose.yaml` (project `homelab_firefly_iii`) |
| Image | `docker.io/fireflyiii/data-importer:latest` |
| Category | Finance |
| Starts with `./homelab up` | No: optional, `./homelab install firefly-iii-importer` |
| Address | https://firefly-import.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8097 (`FIREFLY_IMPORTER_PORT`) |
| Depends on | `firefly-iii` |
| Helpers | `firefly-iii-db` `docker.io/library/postgres:18`, dumped daily by `./homelab backup`<br>`firefly-iii-cron` `docker.io/library/alpine:3` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Brings bank files into [Firefly III](<Firefly III.md>): a CSV or CAMT export from the bank's website, or a bank connection you set up in it, turned into transactions with Firefly III's rules applied.

## Setup

1. Make a personal access token in Firefly III (its note's Setup, steps 3 and 4) and put it in Settings as `FIREFLY_IMPORTER_TOKEN`, then `./homelab up`.
2. Open the importer (`http://localhost:8097`, or `https://firefly-import.example.com` with a domain). It finds Firefly III inside the stack and signs in with the token.

## How it works

- A PHP app of its own, made by Firefly III's author, in its own container. It talks to Firefly III at `http://firefly-iii:8080` inside the stack (`FIREFLY_III_URL`) and sends people to Firefly III's own address (`VANITY_URL`, from `FIREFLY_URL`).
- It keeps nothing of its own: each import's settings can be downloaded as a file and loaded again next time.

## Where things live

| What | Where |
|---|---|
| The token it signs in with | `FIREFLY_IMPORTER_TOKEN` in `.env` |
| Import settings you save | A JSON file you download from it; nothing stays in the container |

## Everyday use

- **A month's statement:** upload the bank's CSV, map its columns once (date, amount, description), save that configuration, and next month load it with the new file.
- **CAMT:** European banks' XML statements need no mapping.

## Connects to

- [Firefly III](<Firefly III.md>), whose API it writes to; its rules and categories apply to what comes in.

## Tinkering ideas

- Keep each bank's saved configuration file next to its statements in [Paperless-ngx](<../documents/Paperless-ngx.md>).

## Useful commands

```sh
./homelab logs firefly-iii-importer -f
./homelab compose firefly-iii restart firefly-iii-importer
```

## Learn more

- [The data importer's documentation](https://docs.firefly-iii.org/how-to/data-importer/about/)
- [GitHub: firefly-iii/data-importer](https://github.com/firefly-iii/data-importer)

## Backup

Nothing to back up of its own: what it imports is in Firefly III's database, which `./homelab backup` dumps nightly. Keep the configuration files you download.

## Troubleshooting

- **"No access token" or 401 errors:** `FIREFLY_IMPORTER_TOKEN` is empty, expired, or was revoked; make a new one in Firefly III and `./homelab up`.
- **Dates or amounts come in wrong:** the column mapping or the date format in its configuration does not match the bank's file; adjust it and save the configuration again.
