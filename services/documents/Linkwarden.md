---
version: 0.14.0
---

# Linkwarden

Bookmarks for the household, each page kept as a screenshot, a PDF, and text

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `linkwarden` in `stacks/linkwarden/compose.yaml` (project `homelab_linkwarden`) |
| Image | `ghcr.io/linkwarden/linkwarden:latest` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install linkwarden` |
| Address | https://bookmarks.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3060 (`LINKWARDEN_PORT`) |
| Depends on | `linkwarden-db`, `linkwarden-meilisearch` |
| Helpers | `linkwarden-db` `docker.io/library/postgres:18`, dumped daily by `./homelab backup`<br>`linkwarden-meilisearch` `getmeili/meilisearch:v1.41.0` |
| Data | `appdata/linkwarden` → `/data/data` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Bookmarks the household shares: each saved page is kept as a screenshot, a PDF, and its readable text, so it survives the site changing or going away. Links go into collections, which can be shared with other people's accounts, with tags and full-text search. Like [Karakeep](<Karakeep.md>), it stands in for Raindrop.io; Linkwarden leans to shared collections and keeping every page, Karakeep to a personal read-later list.

## Setup

1. `./homelab install linkwarden` (it brings its PostgreSQL and Meilisearch).
2. Open it and create the first account: it is the administrator.
3. Make the household's accounts (each person signs up, or the administrator adds them under Administration), then set `LINKWARDEN_DISABLE_REGISTRATION=true` in Settings and `./homelab up` so no one else can sign up.
4. Install the Linkwarden browser extension or phone app with the address you open it at (`https://<TAILSCALE_HOST>:3060` in Home mode, or `https://bookmarks.example.com` with a domain).

## How it works

- A Next.js app with a background worker in one container. The worker opens each new link in its own headless browser and saves a screenshot, a PDF, and a readable copy of the text.
- Links, collections, tags, and accounts live in PostgreSQL (`linkwarden-db`); the saved pages are files under `appdata/linkwarden`.
- Meilisearch (`linkwarden-meilisearch`, port 7700 inside the stack) indexes the text for search, with `LINKWARDEN_MEILI_MASTER_KEY`. The index can be rebuilt from the database, so it is not backed up.
- Sign-in is handled by NextAuth; `NEXTAUTH_URL` comes from `LINKWARDEN_URL` (`https://bookmarks.example.com` by default) and must match the address you open.
- The stack has its own network for the three containers; only `linkwarden` also joins the shared `homelab` network that the proxy uses.

## Where things live

| What | Where |
|---|---|
| Links, collections, tags, accounts | PostgreSQL in the Docker volume `homelab_linkwarden_linkwarden-pgdata` |
| Saved pages (screenshots, PDFs, text) and uploads | `appdata/linkwarden` → `/data/data` |
| Search index | Docker volume `homelab_linkwarden_linkwarden-meilisearch` |
| Secrets | `LINKWARDEN_DB_PASSWORD`, `LINKWARDEN_NEXTAUTH_SECRET`, and `LINKWARDEN_MEILI_MASTER_KEY` in `.env` |

## Everyday use

- **Save:** the browser extension's button, the phone app's share sheet, or **New Link** on the dashboard.
- **Share:** make a collection and add people's accounts to it, to look or to add links too; a collection can also be made public with its own link.
- **Find:** search looks through titles, tags, and the saved text of every page.
- **Read the saved copy:** open a link and pick the readable view, the screenshot, or the PDF; it works after the site is gone.
- **Bring old bookmarks in:** Settings › Import takes a browser's bookmarks file and exports from other bookmark services.

## Connects to

- [Karakeep](<Karakeep.md>) does much the same for one person's read-later; most households keep one of the two.
- [Open WebUI](<Open WebUI.md>)'s Ollama on this machine can tag links (see Tinkering ideas).
- [Duplicati](<../system/Duplicati.md>) backs up `appdata/linkwarden`, and `./homelab backup` dumps its database daily (see [Backups](<../../docs/Backups.md>)).
- `.env`: `LINKWARDEN_PORT` (default `3060`), `LINKWARDEN_URL`, `LINKWARDEN_DISABLE_REGISTRATION`, and the secrets above. Meilisearch is pinned and left out of the nightly updates, because its data format changes between versions.

## Tinkering ideas

- Local AI tags: add `NEXT_PUBLIC_OLLAMA_ENDPOINT_URL: http://host.docker.internal:11434` and `OLLAMA_MODEL` (a model you have pulled) to the `linkwarden` service in `stacks/linkwarden/compose.yaml`, then `./homelab compose linkwarden up -d`.
- RSS: Settings › RSS Subscriptions saves new items from a feed into a collection.
- A public collection of the family's recipes or school links, shared with its own address.

## Useful commands

```sh
./homelab logs linkwarden -f
./homelab compose linkwarden ps
./homelab compose linkwarden restart linkwarden
./homelab compose linkwarden exec linkwarden-db psql -U linkwarden -c 'select count(*) from "Link"'
curl -s -H "Authorization: Bearer YOUR_TOKEN" "http://localhost:3060/api/v1/links?sort=0"
```

## API

- **Token:** Settings › Access Tokens, or `POST /api/v1/session` with `{"username":…,"password":…}` (its `response.token`).
- **Base URL:** `http://localhost:3060/api/v1` on this machine, `https://bookmarks.example.com/api/v1` on the LAN, with `Authorization: Bearer <token>`.
- **Save a link:** `curl -s -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{"url":"https://example.com","name":"Example"}' http://localhost:3060/api/v1/links`
- The API reference is in the [documentation](https://docs.linkwarden.app).

## Learn more

- [linkwarden.app](https://linkwarden.app) and the [documentation](https://docs.linkwarden.app)
- [GitHub: linkwarden/linkwarden](https://github.com/linkwarden/linkwarden)
- [Meilisearch](https://github.com/meilisearch/meilisearch), the search engine

## Backup

`./homelab backup` dumps the PostgreSQL database nightly into `recovery-staging/databases/linkwarden-db`, and Duplicati takes it off-site with the rest. The saved pages are in `appdata/linkwarden`: add that folder to the Homelab Stack Data job in Duplicati. The Meilisearch index is rebuilt from the database and is not backed up.

## Troubleshooting

- **Every page fails to save:** the worker's browser needs memory; check `./homelab logs linkwarden` for out-of-memory errors and give the machine more room, or save fewer pages at once.
- **Search finds nothing:** `./homelab compose linkwarden restart linkwarden-meilisearch linkwarden`; the index fills again from the database.
- **Signed out right after signing in:** the address you opened is not `LINKWARDEN_URL`; set it in Settings and `./homelab up`.
