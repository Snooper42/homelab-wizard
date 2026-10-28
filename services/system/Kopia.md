---
version: 0.11.0-beta
---

# Kopia

A second, independent backup beside Duplicati, to another drive

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `kopia` in `compose/system.yaml` (project `homelab_system`) |
| Image | `kopia/kopia:0.23.1` |
| Category | System |
| Starts with `./homelab up` | No: optional, `./homelab install kopia` |
| Address | https://kopia.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:51515 (`KOPIA_PORT`) |
| Data | `config/kopia/start.sh, read-only` → `/homelab/start.sh`<br>`data/appdata/kopia/config` → `/app/config`<br>`data/kopia/cache` → `/app/cache`<br>`data/kopia/logs` → `/app/logs`<br>`data/appdata, read-only` → `/source/appdata`<br>`appdata, read-only` → `/source/homelab-appdata`<br>`stacks, read-only` → `/source/stacks`<br>`~/.local/share/jellyfin, read-only` → `/source/jellyfin`<br>`/Volumes/Media/photos, read-only` → `/source/immich`<br>`/Volumes/Media/Books, read-only` → `/source/calibre`<br>`recovery-staging` → `/staging`<br>`backups-kopia` → `/repository` |
| Updates | By hand. A backup engine reads and writes every copy you keep; set KOPIA_VERSION to a newer release after reading its notes, then ./homelab update kopia |
<!-- END homelab:generated -->

## Purpose

A second backup of the homelab, made by different software into a different place. Duplicati stays the main backup and the one that goes off-site; Kopia keeps another copy, usually on a second drive. If Duplicati's copy or its own database breaks, Kopia's is still there ([ADR-0019](<../../docs/Decisions.md#adr-0019-kopia-as-an-optional-second-backup-engine-beside-duplicati>)).

## Setup

1. `./homelab install kopia`. On its first start it makes the repository at `KOPIA_REPOSITORY`, encrypted with `KOPIA_PASSWORD`, and schedules each folder for 3:45 every night. Left as it is, that is `backups-kopia` in the homelab folder, on the same drive as everything else.
2. Choose where its copies go: Setup's step *A second copy with Kopia* offers one button per drive plugged in (then the cloud drives), each making a `Homelab Kopia` folder there. It never offers the drive with Duplicati's backups or the media. Or `./homelab kopia repository /Volumes/Spare/Homelab\ Kopia`, or any folder in Settings › `KOPIA_REPOSITORY`. Kopia starts again on the new folder. Once done, the step also says how Kopia's last restore test went (`homelab restore-test --auto --engine kopia`), or that none has run yet.
3. Keep `KOPIA_PASSWORD` outside this machine, with `DUPLICATI_SECRETS_PASSPHRASE` (Vaultwarden and the recovery kit): without it, nothing in the repository can be read.
4. Open it (Status's **Sign in** gives the user `admin` and `KOPIA_SERVER_PASSWORD`) to see the snapshots.

## How it works

- `config/kopia/start.sh` runs at each start: it connects to the repository at `KOPIA_REPOSITORY` (making it the first time), and when `KOPIA_REPOSITORY` now points at another folder, it disconnects first and connects to the repository there, or makes one. It knows which by the ID in the repository's own file, kept in `data/appdata/kopia/config/homelab-repository.id`. It sets the 3:45 schedule and zstd compression for each folder that is there, then starts Kopia's server with its web page. The snapshots belong to `homelab@homelab` on every machine, so a moved homelab finds its own.
- It runs as your account (`PUID`, `PGID`), like Duplicati, so what it restores is yours to read and copy back. It starts as root only to hand its own folders (settings, cache, logs, the repository) to that account, including anything a command run as root left in them.
- It reads the same folders Duplicati does, read-only: the apps' data, the homelab's own app data, the stacks, Immich's photos, Jellyfin's data, the books, and the nightly database dumps and secrets copy in `recovery-staging`. Each folder is its own snapshot, so one app's folder can be brought back alone.
- A snapshot stores only what changed since the last one (content-addressed, deduplicated), so each night after the first is small. A missed night runs at the next start.
- It runs at a lower CPU share than the apps, like Duplicati.

## Where things live

| What | Where |
|---|---|
| The repository (every snapshot, encrypted) | `KOPIA_REPOSITORY` → `/repository` |
| Its connection and settings | `data/appdata/kopia/config` |
| Cache and logs (not backed up, rebuilt as needed) | `data/kopia/cache`, `data/kopia/logs` |
| Restores | `recovery-staging/restore-test`, or a folder you choose in `recovery-staging` |
| Settings | `KOPIA_REPOSITORY`, `KOPIA_PASSWORD`, `KOPIA_SERVER_PASSWORD`, `KOPIA_PORT`, `KOPIA_VERSION` in `.env` |

## Everyday use

- **Snapshots:** each folder with its last snapshot, its size, and when the next runs. **Snapshot now** makes one at once.
- **Restore:** open a snapshot, pick a folder or file, and restore it into `/staging/...` (that is `recovery-staging` in the homelab folder), then copy it back where it belongs. It never writes into the folders it backs up. Running as you, it cannot give files their original owners, so untick **Restore File Ownership**; they come back as yours. A folder restored by itself comes back read-only: `chmod -R u+w` it before deleting it (the restore test does this for its own folder).
- **The restore test:** `./homelab restore-test --auto --engine kopia` picks a dozen files in `data/appdata` that haven't changed for a day, restores each from Kopia's newest snapshot into `recovery-staging/restore-test`, and compares them with the live files, as Duplicati's test does. It is on record beside Duplicati's in `scripts/logs/restore-test.json`, and the nightly backup reminds you once a month until one passes.
- **Policies:** how many snapshots to keep. By default: the latest 10, one a day for 7 days, one a week for 4 weeks, one a month for 24 months, and one a year for 3 years.

## Connects to

- [Duplicati](<Duplicati.md>), the main backup: the same folders, a different engine and destination.
- [ntfy](<../security/ntfy.md>): a failed snapshot can alert through Kopia's notifications (Settings › Notifications in its page).

## Tinkering ideas

- Point `KOPIA_REPOSITORY` at a USB drive you keep in another room, for a copy that survives this machine's drive failing.
- Keep more monthly snapshots for the photos folder than for the rest.

## Useful commands

```sh
./homelab logs kopia -f
./homelab kopia repository <folder>   # where its copies go, then Kopia starts again there
# Run as you (-u), as Kopia does; as root, its files are no longer yours until it restarts
./homelab compose kopia exec -u "$(id -u):$(id -g)" kopia kopia snapshot list --all
./homelab compose kopia exec -u "$(id -u):$(id -g)" kopia kopia snapshot create /source/appdata
./homelab compose kopia exec -u "$(id -u):$(id -g)" kopia kopia repository status
```

## API

The server's REST API, with HTTP basic sign-in (`admin` and `KOPIA_SERVER_PASSWORD`): `GET /api/v1/sources`, `POST /api/v1/sources/upload?userName=homelab&host=homelab&path=/source/appdata` for a snapshot now, `GET /api/v1/snapshots?userName=homelab&host=homelab&path=...`, and `POST /api/v1/restore` with the snapshot's `rootID`, a target under `/staging`, and `skipOwners`. See [Kopia's documentation](https://kopia.io/docs/).

## Learn more

- [kopia.io](https://kopia.io)
- [GitHub: kopia/kopia](https://github.com/kopia/kopia)

## Backup

Kopia is the backup here, so what matters is its repository and password. The repository is wherever `KOPIA_REPOSITORY` points, never in the folders it backs up. `KOPIA_PASSWORD` is in `.env`, which Duplicati's Secrets job keeps (opened with `DUPLICATI_SECRETS_PASSPHRASE`). Its settings in `data/appdata/kopia` are not needed to restore: on a new machine, `./homelab install kopia` with the same `KOPIA_REPOSITORY` and `KOPIA_PASSWORD` connects to the repository and lists every snapshot again.

## Troubleshooting

- **It keeps restarting, and its log says the password is wrong:** `KOPIA_PASSWORD` is not the one the repository was made with. Put the old one back; a repository cannot be opened without it.
- **No snapshots of a folder:** the folder was not there when Kopia started (the media drive was not mounted). Restart it once the drive is there: `./homelab restart kopia`.
- **It keeps restarting, and its log says it cannot write to its repository folder:** Kopia runs as you, and the folder is not yours. A drive formatted exFAT or FAT has no owners of its own: it takes one from how it was mounted. Plugged in on the desktop it is yours; mounted another way (by `/etc/fstab`, as root), add `uid=` and `gid=` with your numbers (`id -u`, `id -g`), or choose a folder on another drive.
- **The drive with the repository is gone:** Kopia stops answering. Plug the drive back in, then `./homelab restart kopia`.
