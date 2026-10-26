---
version: 0.9.0-beta
---

# Immich

Photo and video backup for the family's phones, with face recognition, maps, and search by what is in the picture.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `immich-server` in `stacks/immich/compose.yaml` (project `homelab_immich`) |
| Image | `ghcr.io/immich-app/immich-server:v3` |
| Category | Cloud & Files |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://photos.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this machine | http://localhost:8013 (`IMMICH_PORT`) |
| Depends on | `immich-redis`, `immich-database` |
| Helpers | `immich-redis` `docker.io/valkey/valkey:9@sha256:c123e3715db63d06d4ad6964884037aa0d5d4d703939b9929954112889708e1d`<br>`immich-database` `ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0@sha256:bcf63357191b76a916ae5eb93464d65c07511da41e3bf7a8416db519b40b1c23`, dumped daily by `./homelab backup` |
| Data | `/Volumes/Media/photos` → `/data` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | immich |
<!-- END homelab:generated -->

## Purpose

- Automatic backup of every phone's camera roll, at home and away.
- Shared albums and partner sharing within the family.
- The photo library itself lives on the media drive (`IMMICH_UPLOAD_LOCATION`).

The stack follows Immich's own release compose file; the database and Redis images are pinned to what that release specifies.

## Setup

1. Open `https://<TAILSCALE_HOST>:8013` in Home mode, or `https://photos.example.com` with a domain; the first account becomes the administrator.
2. Administration > Users: create an account per person, with a storage quota if wanted.
3. In the Immich phone app, server URL: the same address, then turn on backup for the camera roll.
4. Machine learning runs on the CPU. The first indexing of a large library takes hours (Administration > Jobs shows progress).

**Updating:** `IMMICH_VERSION` is the major tag (`v3`), and Watchtower applies minor updates. Before a new major version, read Immich's release notes: it may change the database image, which must be updated in `stacks/immich/compose.yaml` exactly as the release says.

## How it works

- `immich-server` is a TypeScript (NestJS) app. It serves the web app and the API on port 2283 and also runs the background workers: thumbnails, metadata extraction, and video transcoding.
- Work waits in job queues in Valkey (`immich-redis`). Everything about the library (assets, albums, people, users) is in PostgreSQL (`immich-database`), which stores the face and smart-search vectors with the VectorChord extension.
- `immich-machine-learning` is a Python service that runs the CLIP model for smart search and the face detection and recognition models. Here it runs on the CPU; models download on first use into the `immich-model-cache` volume. The server reaches it at `http://immich-machine-learning:3003`.
- Only `immich-server` joins the shared `homelab` network (for the proxy and tunnel); the database, Valkey, and machine learning stay on the stack's own network.
- Originals are never changed. Immich writes thumbnails and transcoded videos beside them under `/data`.

## Where things live

| What | Where |
|---|---|
| Library root | `IMMICH_UPLOAD_LOCATION` (`/Volumes/Media/photos`) → `/data` |
| Uploads, as sent by phones | `/data/upload/<user id>/` |
| Files arranged by the storage template (when on) | `/data/library/` |
| Thumbnails and previews | `/data/thumbs/` |
| Transcoded videos | `/data/encoded-video/` |
| Profile pictures | `/data/profile/` |
| Immich's own database dumps | `/data/backups/` |
| Database | volume `homelab_immich_immich-pgdata` → `/var/lib/postgresql/data` in `immich-database` |
| Machine-learning models | volume `homelab_immich_immich-model-cache` → `/cache` in `immich-machine-learning` |
| The homelab's daily dumps | `recovery-staging/databases/immich-database` |

## Everyday use

- Phone app: the backup screen (cloud icon) chooses albums and turns on background backup. On an iPhone, keep Background App Refresh on for Immich.
- Search for what is in a picture ("dog on the beach"), a person, or a place; **Explore** shows People, Places, and Things.
- Sharing: shared albums with other users, public links with an expiry and optional password, and partner sharing to see a partner's whole library.
- Memories ("on this day") above the timeline, the **Map**, **Favorites**, **Archive**, and the **Locked Folder** for private items.
- Administration › **Jobs** runs or re-runs work; Administration › **Settings** holds everything server-wide; **Utilities** reviews duplicates.
- Apps: Immich for iPhone and Android, and any browser.

## Connects to

- Its database and queue are covered in [PostgreSQL](<../system/PostgreSQL.md>) and [Redis and Valkey](<../system/Redis and Valkey.md>).
- Public at `photos.example.com` through [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>), and on the LAN through [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>).
- [Duplicati](<../system/Duplicati.md>)'s Homelab Photos job backs up the library; the database goes through `./homelab backup` and the Homelab Databases job.
- Sign-in with [Pocket ID](<../security/Pocket ID.md>): `./homelab sso setup` makes its client (kept in `data/sso/immich-server.env`) and says what to paste in Administration › Settings › Authentication Settings › OAuth.
- [Homepage](<../system/Homepage.md>) has an Immich widget (needs an API key); [Uptime Kuma](<../security/Uptime Kuma.md>) can watch `/api/server/ping`.
- `.env`: `IMMICH_VERSION`, `IMMICH_DB_PASSWORD`, `IMMICH_UPLOAD_LOCATION`, `IMMICH_PORT`.

## Tinkering ideas

- Turn on the storage template (Administration › Settings › Storage Template) to file photos on the drive by year and month.
- Add an existing photo folder as an external library (Administration › External Libraries); mount it read-only into `immich-server` in `stacks/immich/compose.yaml` first.
- Import an old archive from the Mac with the Immich CLI (`@immich/cli` from npm: `immich login`, then `immich upload --recursive <folder>`).
- Try another smart-search model (Administration › Settings › Machine Learning Settings), then rerun Smart Search in Jobs; a multilingual model helps if the family searches in more than one language.
- Review duplicates under Utilities after a big import.
- Share an event album as a link with an expiry for guests.
- Sign in with Pocket ID passkeys instead of passwords.

## Useful commands

Whether the server answers and its version, the containers, the logs, Immich's admin tool inside the server (list users, reset the admin password), and a restart:

```zsh
curl -s http://localhost:8013/api/server/ping
curl -s http://localhost:8013/api/server/version
./homelab compose immich ps
./homelab logs immich-server -f
./homelab logs immich-machine-learning -f
./homelab compose immich exec immich-server immich-admin list-users
./homelab compose immich exec immich-server immich-admin reset-admin-password
./homelab compose immich restart immich-server
```

## API

- Key: your profile picture › Account Settings › API Keys › New API Key. Send it as the `x-api-key` header.
- Base URL: `https://photos.example.com/api`, or `http://localhost:8013/api` on this Mac.
- Example, your own account:

```zsh
curl -s -H "x-api-key: $IMMICH_API_KEY" http://localhost:8013/api/users/me
```

- The API reference is linked from the docs.

## Learn more

- Docs: https://docs.immich.app/
- Source and images: https://github.com/immich-app/immich

## Backup

| Data | How |
|---|---|
| Photos and videos (`IMMICH_UPLOAD_LOCATION`) | Homelab Photos job |
| Database | Dumped daily by `./homelab backup`, then the Homelab Databases job; Immich also keeps its own dumps in `IMMICH_UPLOAD_LOCATION/backups` |
| Machine-learning models | Not backed up (downloaded again) |

The restore needs Immich's Postgres image and a search-path fix: see [Disaster Recovery](<../../docs/Disaster Recovery.md>).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Server unhealthy after an update | The release changed the database image. Check the release notes and `./homelab logs immich-server` |
| Uploads fail from outside | Cloudflare limits uploads to 100 MB per request through the tunnel. Long videos sync when the phone is home |
| Faces or search missing | Administration > Jobs: run Face Detection and Smart Search for missing items |
| "Upload location not found" | The media drive was not mounted when Immich started. `./homelab compose immich restart` |
