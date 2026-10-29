---
version: 0.14.0
---

# Backups

Every night the homelab copies its databases, then Duplicati encrypts and versions everything into the backup folder you picked in Setup (a cloud drive such as Proton Drive or iCloud Drive, or an external drive). Databases are dumped first, because copying a live database's files can produce a backup that will not restore.

In the app, **Backups** shows all of it: the last backup, each app's newest copy, the off-site jobs, and the last restore test, with **Back up now**, **Test a restore**, **Recovery kit**, and **Moving to a new machine**. You rarely need anything below unless something is red.

## How it fits together

```text
03:30  homelab backup   → recovery-staging/databases/<db>/<db>-YYYYMMDD-HHMMSS.sql.gz
                        → recovery-staging/volumes/<volume>/<volume>-YYYYMMDD-HHMMSS.tar.gz
                        → recovery-staging/databases/images/images-YYYYMMDD-HHMMSS.json
                        → recovery-staging/secrets/homelab.env, and data/'s records in secrets/data
01:00–06:00 Duplicati → encrypted, deduplicated versions in BACKUP_DESTINATION
```

| Property | Value |
|---|---|
| Software | Duplicati (`duplicati`, http://localhost:8200) |
| Destination | `BACKUP_DESTINATION` in `.env`: a *Homelab Backups* folder Setup makes in a cloud drive's synced folder or on an external drive other than the media drive. Setup offers each one it finds: on a Mac Proton Drive, iCloud Drive, Google Drive, OneDrive, and Dropbox (in `~/Library/CloudStorage`) and the drives in `/Volumes`; on Windows OneDrive, iCloud Drive, and Dropbox in your user folder and every drive letter but the system's (not Google Drive's own drive, which Docker Desktop does not see); on Linux `~/Dropbox`, `~/OneDrive`, and the drives mounted in `/run/media/<you>` or `/media/<you>`. The watchdog checks the free space on its disk; a cloud drive's own quota cannot be read from this machine, so keep an eye on it in the drive's app |
| Encryption | Duplicati AES-256. `DUPLICATI_SECRETS_PASSPHRASE` opens Homelab Secrets: keep it in Vaultwarden and on the recovery kit (Backups › **Recovery kit**, or `./homelab recovery-kit`, prints a page with a line for it). `DUPLICATI_PASSPHRASE` opens the other jobs; it is in `.env`, which the Secrets job holds |
| Database dumps and volume archives | `./homelab backup`, daily at 03:30 (a scheduled job), newest 7 kept |
| The versions that wrote them | The same run notes each running app's image and the digest that pulls it again (`recovery-staging/databases/images`, newest 7 kept, off-site with the dumps). `move in` starts those versions, not the newest, then names them so `homelab update` can move them on |
| Storage measured | The same nightly run measures each app's folder in `data/appdata` and each person's photos in Immich (`data/storage.json`): Status › **What the apps keep** and **Photos per person** |

## Duplicati mount mappings

| Mac path | Container path | Mode |
|---|---|---|
| `~/Homelab/data/appdata` | `/source/appdata` | read-only |
| `~/Homelab/appdata` | `/source/homelab-appdata` | read-only |
| `~/Homelab/stacks` | `/source/stacks` | read-only |
| `JELLYFIN_DATA_DIR` | `/source/jellyfin` | read-only |
| `IMMICH_UPLOAD_LOCATION` | `/source/immich` | read-only |
| `MEDIA_ROOT/Books` | `/source/calibre` | read-only |
| `~/Homelab/recovery-staging` | `/staging` | read-write |
| `BACKUP_DESTINATION` | `/destination` | read-write |

Job settings always use the container paths on the right. Sources are read-only, so a restore goes into `/staging/...` and is copied back by hand. This makes it impossible to overwrite live data by accident.

## What is covered

| Data | How |
|---|---|
| Core service settings (proxy, CrowdSec, Vaultwarden, Uptime Kuma, ntfy, media apps) | Homelab AppData job (`/source/appdata`) |
| The stacks' files (`appdata/`: Paperless documents, Karakeep's and Linkwarden's saved pages, Nextcloud's files, and the rest) | Homelab Stack Data job (`/source/homelab-appdata`) |
| Every PostgreSQL database (Immich, Paperless, MoneyMatter, and each optional stack's), and consistent copies of the SQLite apps | `homelab backup` dumps → Homelab Databases job |
| `.env` (every secret) | `homelab backup` copy → Homelab Secrets job |
| Compose files and local edits | Git, plus the Homelab Infrastructure job |
| Photos and videos | Homelab Photos job (`/source/immich`) |
| Jellyfin settings and metadata | Homelab Jellyfin job (`/source/jellyfin`) |
| Calibre library (`metadata.db` and books) | Homelab Calibre job (`/source/calibre`) |
| MoneyMatter attachments | `homelab backup` archives the `moneymatter-attachments` volume → Homelab Databases job (`/staging/volumes`) |
| Music, movies, TV, audiobooks, comics | **Not backed up** (re-obtainable, and too large for most cloud drives) |
| The homelab's own records in `data/` (the household, paired phones, single sign-on settings, update history) | `homelab backup` copies them into `recovery-staging/secrets/data` → Homelab Secrets job |

## Database dumps

`homelab backup` runs `pg_dumpall --clean --if-exists` inside each database container, using the container's own `POSTGRES_USER` (so no password leaves the container). It gzips the output and keeps the file only if it ends with Postgres's completion marker. Databases are marked in the compose files with `dump: postgres`; a new database with that line is included automatically.

Apps that keep their data in SQLite (Vaultwarden, Nginx Proxy Manager, Uptime Kuma, ntfy's accounts, Navidrome, Audiobookshelf, Calibre-Web, Komga, Kavita, Seerr, Mealie, Grocy, Homarr, Karakeep) are marked `dump: sqlite:/path/in/the/container`. Their files are copied by Duplicati too, but a copy of a database file taken while the app writes can be torn. So `homelab backup` also takes a consistent copy with SQLite's online backup, through a small helper image it builds once (`dockerfiles/sqlite`), as the file's owner, checks it with `PRAGMA integrity_check`, and keeps it gzipped as `<app>-<stamp>.sqlite.gz`. An app with no database at that path yet (Uptime Kuma set up on MariaDB, say) is skipped.

An app that is installed but stopped, or runs outside the homelab, makes the backup fail with an alert, rather than leaving last night's dump as the newest. Each dump has two hours to finish.

Named volumes that hold files rather than a database (MoneyMatter's attachments) are listed under `archive:` in the owning service. `homelab backup` tars each one through a throwaway Alpine container and keeps the archive only if it reads back completely.

Restore one into a fresh, empty database container:

```bash
gunzip -c recovery-staging/databases/paperless-db/paperless-db-<stamp>.sql.gz \
  | ./homelab compose paperless exec -T paperless-db psql -U paperless -d postgres
```

Restore a SQLite copy with the app stopped, over its database file:

```bash
./homelab stop vaultwarden
gunzip -c recovery-staging/databases/vaultwarden/vaultwarden-<stamp>.sqlite.gz > data/appdata/vaultwarden/db.sqlite3
rm -f data/appdata/vaultwarden/db.sqlite3-wal data/appdata/vaultwarden/db.sqlite3-shm
./homelab start vaultwarden
```

Immich has extra rules (its own Postgres image, and a search-path fix). See [Disaster Recovery](<Disaster Recovery.md>).

## Restore testing

A backup counts only once a restore has been proven. Monthly, click **Test a restore** on the app's Backups screen, or:

```bash
./homelab restore-test --auto
```

It signs in to Duplicati with `DUPLICATI_PASSWORD`, picks a dozen files from `data/appdata` (spread across apps, unchanged for over a day so last night's backup holds them as they are, leaving out caches, logs, and live database side files), and asks Duplicati to restore them from the newest version of the Homelab AppData job into `recovery-staging/restore-test`. When the restore finishes it hashes each file against the live one, and removes the restore when they match. On a difference it fails and leaves the files there for a look. `--job "<name>"` tests another job whose source is `/source/appdata`.

With [Kopia](<../services/system/Kopia.md>) installed as the second engine, `./homelab restore-test --auto --engine kopia` does the same from Kopia's newest snapshot of `/source/appdata`, signed in with `KOPIA_SERVER_PASSWORD`. Each engine's test is on record on its own, and each has its own monthly reminder. The Backups screen shows Kopia's line beside Duplicati's jobs (*Second copy (Kopia)*: where its repository is and its last test), with **Test Kopia's restore**.

The manual way, for any job or a whole-job restore:

1. In Duplicati, restore a job to `/staging/restore-test`, with restoring permissions turned off in the metadata step (the files only need their contents).
2. Read the error and warning counts, not just the icon.
3. Compare against the live files, then delete `recovery-staging/restore-test`:

   ```bash
   ./homelab restore-test recovery-staging/restore-test data/appdata
   ```

   It hashes a sample of the restored files against the originals and fails on any difference. Files changed since the backup are listed, not failed.

Either way the test goes on record in `scripts/logs/restore-test.json` (the last 24, passed or failed): the restore drills. `--auto` times each one from asking Duplicati to the last file checked, so you know how long getting files back takes before you need it. The Backups screen shows the last pass and how long it took, a failure since in red, and the record when you hover the tile; the weekly summary and `homelab report` include them too. When the last pass is more than 30 days old, the nightly backup job sends a reminder to the `duplicati-alerts` topic, at most once a week until the next test.

## Password vault export

The Vaultwarden database dump restores the server, but it needs a working server to read. Once a month, also keep an export that opens anywhere:

1. In the Bitwarden web vault: **Tools › Export vault**, format **.json (Encrypted)**, type **Password protected**. Keep that password outside the vault (on paper, with the recovery kit). An *account restricted* export only opens in the same account, which is lost with the server.
2. Save the file in `recovery-staging/secrets` in the homelab folder. The nightly Homelab Secrets job takes it off-site with `.env`.

The nightly backup looks there: when the newest `bitwarden_encrypted_export_*.json` is over 30 days old it sends a reminder to `duplicati-alerts` (at most weekly), and when a plain export (`bitwarden_export_*`, readable) is there it alerts every night until it is deleted. The app's Backups screen shows the same.

## Moving to a new machine

When the old machine still works, nothing needs restoring from Duplicati. Backups › **Moving to a new machine**: **Move out…** on the old machine asks where to save one file, takes a fresh backup, stops the apps, and packs the settings, the apps' data, and the newest database dumps into it (click twice to confirm). On the new machine, install Homelab Wizard, choose **Set it up for me**, plug in the drive with the photos and media, and **Move in…** with that file. Moving between kinds of computer (a Mac, Windows, Linux) works too: **Move in** sets this machine's account and network settings itself, and stops for any folder from the old machine (`/Volumes/…`, `D:\…`) until you pick its place here in Settings › Storage, then carries on. In Terminal: `./homelab move out --to <file>` and `./homelab move in <file>`. [Disaster Recovery](<Disaster Recovery.md#scenario-moving-to-a-new-machine>) has the details.

## Recovery order

1. Vaultwarden (every other credential is in it)
2. `.env` from the Secrets job
3. Addresses: Tailscale in Home mode; with a domain, Nginx Proxy Manager and CrowdSec
4. Databases, then their apps
5. Everything else, then monitoring
