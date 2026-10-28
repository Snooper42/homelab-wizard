---
version: 0.11.0-beta
---

# Karakeep

Saved links and read-later, with full-page archives and search

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `karakeep` in `stacks/karakeep/compose.yaml` (project `homelab_karakeep`) |
| Image | `ghcr.io/karakeep-app/karakeep:release` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install karakeep` |
| Address | https://links.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3010 (`KARAKEEP_PORT`) |
| Depends on | `karakeep-chrome`, `karakeep-meilisearch` |
| Helpers | `karakeep-chrome` `ghcr.io/karakeep-app/karakeep-chrome:release`<br>`karakeep-meilisearch` `getmeili/meilisearch:v1.41.0` |
| Data | `appdata/karakeep` → `/data` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/karakeep` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | hoarder |
<!-- END homelab:generated -->

## Purpose

Saves links, articles, notes, and images with a full-page archive (so pages survive going offline), full-text search, and tags, automatically or by hand. Read-later and bookmarks in one place, with browser extensions and phone apps.

## Setup

1. `./homelab install karakeep` (it brings its headless Chrome and Meilisearch).
2. Open it and create the first account, the admin. Then turn off sign-ups for others under Admin > Settings if you do not want more accounts.
3. Install the Karakeep browser extension and phone app, with the server address you open it at (`https://<TAILSCALE_HOST>:3010` in Home mode, or `https://links.example.com` with a domain).

## How it works

- A TypeScript app (Next.js web app plus background workers) in one container, with its database in SQLite at `/data/db.db`.
- When you save a link, a crawler worker opens it in the headless Chrome of `karakeep-chrome` (`BROWSER_WEB_URL`, port 9222), takes a screenshot, and keeps a readable copy of the text. Full-page archives of every link are off by default (`CRAWLER_FULL_PAGE_ARCHIVE`).
- A search worker feeds every item into Meilisearch (`karakeep-meilisearch`, port 7700) with `KARAKEEP_MEILI_MASTER_KEY`. The index can always be rebuilt from the database, which is why it is not backed up.
- AI tagging and summaries run only when an OpenAI key or an Ollama address is set; neither is set here, so tags are yours.
- Sign-in is handled by NextAuth; `NEXTAUTH_URL` (`https://links.example.com`) must match the address you open.
- The stack has its own network for the three containers; only `karakeep` also joins the shared `homelab` network that the proxy uses.

## Where things live

| What | Where |
|---|---|
| Database (bookmarks, tags, lists, users) | `appdata/karakeep/db.db` → `/data/db.db` |
| Screenshots, archives, images, and uploaded files | `appdata/karakeep/assets/` → `/data/assets` |
| Search index | Docker volume `homelab_karakeep_karakeep-meilisearch` → `/meili_data` in `karakeep-meilisearch` |
| Secrets | `KARAKEEP_NEXTAUTH_SECRET` and `KARAKEEP_MEILI_MASTER_KEY` in `.env` |

## Everyday use

- **Save:** the browser extension's button, the phone app's share sheet, or paste a link, a note, or an image on the home page.
- **Find:** the search box searches titles, page text, and notes; qualifiers such as `#tag` and `is:fav` narrow it.
- **Organise:** tags, lists (including smart lists that fill themselves from a search), favourites, and archive for things you are done with.
- **Read later:** open a bookmark to read the saved text without the site's clutter, and highlight passages.
- **Bring old bookmarks in:** User Settings › Import / Export takes a browser bookmarks HTML file and exports from Pocket and other read-later services.
- **Apps:** Karakeep for iOS and Android, and extensions for Chrome and Firefox; all ask for the server address `https://links.example.com`.

## Connects to

- [Open WebUI](<Open WebUI.md>) uses Ollama on this Mac; Karakeep can use the same Ollama for automatic tags (see Tinkering ideas).
- [Pocket ID](<../security/Pocket ID.md>) is its sign-in once `./homelab sso setup` has run: it writes `OAUTH_WELLKNOWN_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, and `OAUTH_PROVIDER_NAME` to `data/sso/karakeep.env`, and an existing account with the same email is linked.
- [FreshRSS](<FreshRSS.md>): read feeds there, keep the articles worth keeping here.
- [Duplicati](<../system/Duplicati.md>) backs up `appdata/karakeep` in the Homelab Stack Data job, and `./homelab backup` takes a daily copy of `db.db` (see [Backups](<../../docs/Backups.md>)).
- `.env`: `KARAKEEP_PORT` (default `3010`), `KARAKEEP_NEXTAUTH_SECRET`, `KARAKEEP_MEILI_MASTER_KEY`. Meilisearch is pinned and left out of Watchtower, because its data format changes between versions.

## Tinkering ideas

- Local AI tags: add `OLLAMA_BASE_URL: http://host.docker.internal:11434` and `INFERENCE_TEXT_MODEL` / `INFERENCE_IMAGE_MODEL` (models you have pulled) to the `karakeep` service in `stacks/karakeep/compose.yaml`, then `./homelab compose karakeep up -d`.
- Full-page archives for every link: add `CRAWLER_FULL_PAGE_ARCHIVE: "true"` the same way; it uses more disk in `appdata/karakeep/assets`.
- Turn off sign-ups for good with `DISABLE_SIGNUPS: "true"` once everyone has an account.
- Rules: User Settings › Rule Engine can tag a bookmark or add it to a list automatically when it is saved.
- RSS: User Settings › RSS Subscriptions saves new items from a feed into Karakeep on their own.
- Webhooks: User Settings › Webhooks calls a URL when a bookmark is created or crawled, for example a Home Assistant webhook automation.
- Smart lists: make a list from a search (for example `#recipe`) so it stays up to date.

## Useful commands

Follow the app and browser logs, check the three containers, restart, look at the data folder, and use the API with a key from User Settings › API Keys:

```zsh
./homelab logs karakeep -f
./homelab logs karakeep-chrome -f
./homelab compose karakeep ps
./homelab compose karakeep restart karakeep
./homelab compose karakeep exec karakeep ls -la /data
curl -s -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3010/api/v1/bookmarks
```

## API

- **Key:** User Settings › API Keys.
- **Base URL:** `http://localhost:3010/api/v1` on this Mac, `https://links.example.com/api/v1` on the LAN, with `Authorization: Bearer <key>`.
- **Save a link:** `curl -s -X POST -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" -d '{"type":"link","url":"https://example.com"}' http://localhost:3010/api/v1/bookmarks`
- The API reference is in the [documentation](https://docs.karakeep.app).

## Learn more

- [karakeep.app](https://karakeep.app) and the [documentation](https://docs.karakeep.app)
- [GitHub: karakeep-app/karakeep](https://github.com/karakeep-app/karakeep) (source of both `ghcr.io/karakeep-app` images)
- [Meilisearch](https://github.com/meilisearch/meilisearch), the search engine

## Backup

Saved items and archives live in `appdata/karakeep`. Add that folder to the Homelab Stack Data job in Duplicati (like `appdata/paperless`). The Meilisearch index is rebuilt from it and is not backed up.

## Troubleshooting

- **Pages are not archived:** the `karakeep-chrome` container is not running (`./homelab status --all`).
- **Search finds nothing:** re-index under Admin > Background jobs.
