---
version: 0.9.0-beta
---

# Paperless-ngx

The household's document archive. Scan or drop a file in, and Paperless reads it (OCR), tags it, and makes it searchable.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `paperless` in `stacks/paperless/compose.yaml` (project `homelab_paperless`) |
| Image | `ghcr.io/paperless-ngx/paperless-ngx:latest` |
| Category | Documents |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://docs.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this Mac | http://localhost:8010 (`PAPERLESS_PORT`) |
| Depends on | `paperless-db`, `paperless-broker` |
| Helpers | `paperless-db` `docker.io/library/postgres:18`, dumped daily by `./homelab backup`<br>`paperless-broker` `docker.io/valkey/valkey:9-alpine` |
| Data | `appdata/paperless/data` → `/usr/src/paperless/data`<br>`appdata/paperless/media` → `/usr/src/paperless/media`<br>`appdata/paperless/export` → `/usr/src/paperless/export`<br>`appdata/paperless/consume` → `/usr/src/paperless/consume` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | paperless-ngx |
<!-- END homelab:generated -->

## Purpose

- Every letter, bill, contract, and receipt in one searchable place, reachable from anywhere.
- Original files are kept untouched; Paperless adds an archived PDF with a text layer.

## Setup

1. Create the admin account:

   ```bash
   ./homelab compose paperless exec paperless python3 manage.py createsuperuser
   ```

2. Sign in at `https://<TAILSCALE_HOST>:8010` in Home mode, or `https://docs.example.com` with a domain, turn on two-factor authentication (Profile), and create accounts for the family.
3. Add correspondents, document types, and tags as documents arrive; let matching learn from them.
4. Drop files into `appdata/paperless/consume` (or upload in the web UI or the mobile apps) to import.

## How it works

- A Python (Django) web app on port 8000, with Celery workers in the same container that do the slow work: importing, OCR, and training the matching model.
- Three containers: `paperless` (web app and workers), `paperless-db` (PostgreSQL 18, the database), and `paperless-broker` (Valkey, the task queue between the web app and the workers). The database and broker are only on the stack's own network; `paperless` also joins the shared `homelab` network for the proxy.
- The consumer watches `consume`. Each new file is OCRed with OCRmyPDF and Tesseract in `PAPERLESS_OCR_LANGUAGE`, gets a searchable PDF/A copy and a thumbnail, and is filed in `media`. The original is kept unchanged next to it.
- A full-text index (Whoosh) in `data/index` powers search. A classifier learns from your past choices to suggest the correspondent, document type, tags, and storage path for new documents.
- `PAPERLESS_URL` must match the address you open, or sign-in fails with a CSRF error. Files are written as `USERMAP_UID`/`USERMAP_GID` (`PUID`/`PGID`), so you own them on this Mac.
- It is the one app in this group that is also public, through the [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>).

## Where things live

| What | Where |
|---|---|
| Originals, as you gave them | `appdata/paperless/media/documents/originals/` → `/usr/src/paperless/media/documents/originals` |
| Searchable PDF copies | `appdata/paperless/media/documents/archive/` |
| Thumbnails | `appdata/paperless/media/documents/thumbnails/` |
| Search index | `appdata/paperless/data/index/` → `/usr/src/paperless/data/index` |
| Matching model | `appdata/paperless/data/classification_model.pickle` |
| Logs (`paperless.log`, `mail.log`) | `appdata/paperless/data/log/` |
| Inbox folder | `appdata/paperless/consume/` → `/usr/src/paperless/consume` |
| Exports | `appdata/paperless/export/` → `/usr/src/paperless/export` |
| Database | Docker volume `homelab_paperless_paperless-pgdata` → `/var/lib/postgresql` in `paperless-db` |
| Task queue | Docker volume `homelab_paperless_paperless-redisdata` (not backed up) |

## Everyday use

- **Add documents:** drag files onto the web page, drop them in `consume`, or upload from a phone app (Swift Paperless on iOS, Paperless Mobile on Android).
- **Inbox:** give a tag the inbox setting (Tags › edit › **Inbox tag**) and every new document gets it; review, correct, and remove the tag.
- **Find:** the search box searches the text of every page. Filter the document list by tag, correspondent, type, or date, then save the filter as a view and show it on the dashboard.
- **Teach it:** correct the suggestions on a few documents of each kind; matching set to **Auto** learns from them.
- **Share:** a document's **Share** button makes a link that expires, for sending one bill to someone without an account.
- **Notes and history:** each document has notes and a history of changes.

## Connects to

- [Stirling PDF](<Stirling PDF.md>) for clean-up before import: merge, split, rotate, or remove blank pages.
- [Pocket ID](<../security/Pocket ID.md>) is its sign-in once `./homelab sso setup` has run (`PAPERLESS_APPS` and `PAPERLESS_SOCIALACCOUNT_PROVIDERS` in `data/sso/paperless.env`). An existing user links it under My Profile › Connect new social account.
- [PostgreSQL](<../system/PostgreSQL.md>) and [Redis and Valkey](<../system/Redis and Valkey.md>) describe its two helpers; [Duplicati](<../system/Duplicati.md>) backs up the folders and the daily dump (see [Backups](<../../docs/Backups.md>)).
- [Memos](<Memos.md>) is for quick notes; [Homebox](<../household/Homebox.md>) can hold a copy of a receipt next to the thing you bought.
- `.env`: `PAPERLESS_PORT` (default `8010`), `PAPERLESS_DB_PASSWORD`, `PAPERLESS_SECRET_KEY`, `PAPERLESS_OCR_LANGUAGE` (default `eng`), `TZ`, `PUID`, `PGID`. `PAPERLESS_URL` comes from `HOMELAB_DOMAIN`.

## Tinkering ideas

- Email import: Mail › add the account, then a mail rule that takes PDF attachments from bills and assigns a correspondent.
- Workflows: Workflows › add one that sets tags, a type, or an owner when a document arrives from a given source or matches a file name.
- Folders as tags: `PAPERLESS_CONSUMER_RECURSIVE=true` and `PAPERLESS_CONSUMER_SUBDIRS_AS_TAGS=true` make subfolders of `consume` into tags.
- Tidy file names on disk: Storage paths › add one (for example by year and correspondent) and assign it, so `media/documents/originals` reads like a filing cabinet.
- Custom fields: Custom Fields › add an amount or a due date, then filter or sort by it.
- Split stacks of scans: `PAPERLESS_CONSUMER_ENABLE_BARCODES=true` splits a batch at pages with a separator barcode.
- Office files: Paperless can read Word and email files when two helper containers (Tika and Gotenberg) are added and `PAPERLESS_TIKA_ENABLED=true` is set; see its docs.

## Useful commands

Follow the log, check the three containers, restart, and run its management commands (export, rebuild the search index, retrain the matching model, check files against the database, reset a password):

```zsh
./homelab logs paperless -f
./homelab compose paperless ps
./homelab compose paperless restart paperless
./homelab compose paperless exec paperless document_exporter ../export
./homelab compose paperless exec paperless document_index reindex
./homelab compose paperless exec paperless document_create_classifier
./homelab compose paperless exec paperless document_sanity_checker
./homelab compose paperless exec paperless python3 manage.py changepassword <user>
curl -s -H "Authorization: Token YOUR_TOKEN" 'http://localhost:8010/api/documents/?query=invoice'
```

## API

- **Token:** user menu › My Profile › API Auth Token (generate it there).
- **Base URL:** `http://localhost:8010/api/` on this Mac, or `https://docs.example.com/api/`, with `Authorization: Token <token>`. The API is browsable in a signed-in browser.
- **Upload:** `curl -s -H "Authorization: Token YOUR_TOKEN" -F document=@scan.pdf http://localhost:8010/api/documents/post_document/`
- Reference: [REST API](https://docs.paperless-ngx.com/api/).

## Learn more

- [Paperless-ngx documentation](https://docs.paperless-ngx.com)
- [GitHub: paperless-ngx/paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) (source of the `ghcr.io/paperless-ngx/paperless-ngx` image)

## Backup

| Data | How |
|---|---|
| Documents and thumbnails (`appdata/paperless/media`) | Homelab Stack Data job |
| Search index and settings (`appdata/paperless/data`) | Homelab Stack Data job |
| Database | Dumped daily by `./homelab backup`, then the Homelab Databases job |

For a portable copy independent of the database, run the exporter now and then:

```bash
./homelab compose paperless exec paperless document_exporter ../export
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| CSRF error on sign-in | It must be opened at exactly the address in `PAPERLESS_URL` (`https://docs.example.com`, or the tailnet address in Home mode) |
| Files sit in `consume` | `./homelab logs paperless`; the consumer reports why (permissions, unsupported type) |
| OCR in the wrong language | Set `PAPERLESS_OCR_LANGUAGE` (for example `eng+deu`) and `./homelab compose paperless up -d` |
| Slow imports | OCR is CPU-heavy; give OrbStack more CPU or memory |
