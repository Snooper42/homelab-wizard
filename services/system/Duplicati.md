---
version: 0.10.0-beta
---

# Duplicati

Encrypted, versioned, deduplicated backups of everything that matters, written to the Proton Drive folder on the Mac.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `duplicati` in `compose/system.yaml` (project `homelab_system`) |
| Image | `lscr.io/linuxserver/duplicati:latest` |
| Category | System |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://backups.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8200 (`DUPLICATI_PORT`) |
| Data | `data/appdata/duplicati` → `/config`<br>`data/appdata, read-only` → `/source/appdata`<br>`appdata, read-only` → `/source/homelab-appdata`<br>`stacks, read-only` → `/source/stacks`<br>`~/.local/share/jellyfin, read-only` → `/source/jellyfin`<br>`/Volumes/Media/photos, read-only` → `/source/immich`<br>`/Volumes/Media/Books, read-only` → `/source/calibre`<br>`recovery-staging` → `/staging`<br>`backups` → `/destination` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

- Off-site copies of settings, documents, photos, database dumps, and `.env`.
- Versions, so a mistake from last week can still be undone.

Sources are mounted read-only; restores go to `/staging/...` and are copied back by hand.

## Setup

1. Set `BACKUP_DESTINATION` in `.env` to a folder inside Proton Drive, and run `./homelab up` so Duplicati sees it at `/destination`.
2. Sign in at http://localhost:8200 with `DUPLICATI_PASSWORD`: the key button on its row in Status copies it.
3. Create the jobs listed in [Automation](<../../docs/Automation.md>). For each:
   - Destination: Local folder, `/destination/<job name>`.
   - Encryption: AES-256 with its own passphrase, saved in Vaultwarden.
   - Source: the container paths from [Backups](<../../docs/Backups.md>).
   - Schedule: as listed. Retention: Smart backup retention.
   - Advanced options: `send-http-url` = `http://ntfy:80/duplicati-alerts`, `send-http-level` = `Warning,Error,Fatal`.
4. Run each job once and read its log.
5. Export each job (Export > To file, with passwords encrypted) and attach the files to the Vaultwarden entry, so the jobs can be recreated quickly.

## How it works

- Duplicati 2 is a .NET app with a web UI and its own scheduler; this image is LinuxServer's build of it.
- A job splits its sources into blocks, stores each block once (deduplication), packs them into compressed volumes, encrypts each with AES-256, and writes three kinds of files: `dblock` (data), `dindex` (index), and `dlist` (one per version).
- Each job keeps a local SQLite database in `/config` that describes what is at the destination. It makes backups fast and can be rebuilt from the destination (Database › Repair or Recreate).
- The server's settings and job definitions are in `Duplicati-server.sqlite`; the secrets in it are encrypted with `SETTINGS_ENCRYPTION_KEY` (`DUPLICATI_SETTINGS_KEY`).
- Live databases are never copied directly: `./homelab backup` dumps them at 03:30 into `recovery-staging`, and the Homelab Databases job reads them from `/staging` at 05:00.
- The destination is a plain folder (`/destination`); the Proton Drive app on this Mac uploads it.

## Where things live

| What | Where |
|---|---|
| Server settings and job definitions | `data/appdata/duplicati/Duplicati-server.sqlite` (`/config`) |
| Each job's local database | `data/appdata/duplicati/<random name>.sqlite` |
| Backup files | `BACKUP_DESTINATION/<job folder>` (`/destination/...`): `photos`, `databases`, `secrets`, `appdata`, `stack-data`, `infrastructure`, `jellyfin`, `calibre` |
| Database dumps and volume archives | `recovery-staging/databases/`, `recovery-staging/volumes/` (`/staging/...`) |
| Copy of `.env` for the Secrets job | `recovery-staging/secrets/` |
| Sources, read-only | `/source/appdata`, `/source/homelab-appdata`, `/source/stacks`, `/source/jellyfin`, `/source/immich`, `/source/calibre` |

## Everyday use

- The home page lists each job with its last and next run; **Run now** starts one at once.
- Restore: **Restore** › pick the job › pick a version (date) › tick files › restore to a folder under `/staging`, never to the original location.
- A job's menu has **Show log** (each run's result and warnings), **Verify files** (checks the destination against the local database), and **Export**.
- From the terminal, `./homelab duplicati jobs` shows every job's last run, next run, size, and last error.

## Connects to

- Warnings and errors go to [ntfy](<../security/ntfy.md>) on the `duplicati-alerts` topic; `./homelab duplicati setup` sets that for every job.
- The passphrases (`DUPLICATI_PASSPHRASE`, `DUPLICATI_SECRETS_PASSPHRASE`) and exported job files belong in [Vaultwarden](<../security/Vaultwarden.md>).
- Backs up [Immich](<../cloud and files/Immich.md>)'s library (`IMMICH_UPLOAD_LOCATION`), native [Jellyfin](<../media/Jellyfin.md>)'s data (`JELLYFIN_DATA_DIR`), and the `Books` folder under `MEDIA_ROOT` that [Calibre-Web](<../media/Calibre-Web.md>) uses.
- The dumps come from the [PostgreSQL](<../system/PostgreSQL.md>) containers and the SQLite apps marked `dump:` in their compose files.
- `.env`: `DUPLICATI_PORT`, `DUPLICATI_PASSWORD` (sign-in), `DUPLICATI_SETTINGS_KEY`, `BACKUP_DESTINATION`.

## Tinkering ideas

- Add a second destination for the small, critical jobs (Secrets, Databases): an external drive, or a cloud backend such as Backblaze B2 or S3, so one copy does not depend on Proton Drive.
- Tune retention: in a job's options, a custom retention such as `1W:1D,4W:1W,12M:1M` keeps dailies for a week, weeklies for a month, and monthlies for a year.
- Add filters (job › Edit › Source data › Filters) to skip caches and logs that bloat the AppData job.
- Raise the advanced option `backup-test-samples` so each run checks more files at the destination.
- Run `./homelab restore-test --auto` once a month: it restores a sample and compares it with the live files.
- Back up Syncthing's `SYNC_ROOT`: it is not mounted here, so add a read-only volume to the service first.

## Useful commands

Job status, the first-time job setup, the database dumps (preview, then for real), a restore test, an alert test, the logs, and the latest dumps:

```zsh
./homelab duplicati jobs
./homelab duplicati setup
./homelab backup
./homelab backup --apply
./homelab restore-test --auto
./homelab notify test duplicati-alerts
./homelab logs duplicati -f
./homelab compose duplicati restart duplicati
ls -lh recovery-staging/databases/*
```

## Learn more

- Docs: https://docs.duplicati.com/
- Source: https://github.com/duplicati/duplicati
- Image: https://docs.linuxserver.io/images/docker-duplicati/ and https://github.com/linuxserver/docker-duplicati

## Backup

Its own settings (`data/appdata/duplicati`) are in the Homelab AppData job, and the exported job files are in Vaultwarden. If both are lost, any job can be rebuilt from Proton Drive with its passphrase (Restore > Direct restore from backup files).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Destination not found | Proton Drive is not running, or `BACKUP_DESTINATION` is wrong. `./homelab doctor` |
| Restore fails on permissions | In the restore wizard, turn off restoring permissions |
| "Local database is out of sync" | Database > Repair. If that fails, Recreate |
| Job never alerts | `./homelab notify setup` grants the `duplicati-alerts` topic |
