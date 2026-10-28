---
version: 0.11.0
---

# Disaster Recovery

What to do when the machine or an app is lost. Home mode (no domain, apps on your tailnet) is the default; steps marked *with a domain* apply only when `HOMELAB_DOMAIN` is set. If the old machine still works, use [moving to a new machine](#scenario-moving-to-a-new-machine) instead of a restore.

## Recovery priorities

1. The machine, its container runtime (OrbStack on a Mac), and the homelab folder
2. Secrets: Vaultwarden and `.env`
3. Addresses: Tailscale in Home mode; *with a domain*, AdGuard Home, Nginx Proxy Manager, and CrowdSec
4. Databases, then the apps that use them
5. Monitoring, and *with a domain* public access (the tunnel)

## Prerequisites

- The backup folder (the cloud drive account, or the external drive) and `DUPLICATI_SECRETS_PASSPHRASE` (in Vaultwarden, with an offline copy of it and of the Vaultwarden master password on the recovery kit: Backups › **Recovery kit**). It opens Homelab Secrets, whose `homelab.env` holds `DUPLICATI_PASSPHRASE` for every other job
- Homelab Wizard (it carries the homelab files), or the GitHub repository
- This documentation

---

## Scenario: full Mac rebuild

1. Install OrbStack (`brew install --cask orbstack`) and turn on Start at login.
2. Install Homelab Wizard and choose Setup › **Set it up for me** (it makes `~/Homelab`), or `git clone` the repository to `~/Homelab` (that way needs Go: `brew install go`).
3. Install Duplicati temporarily (or start only the `duplicati` service). In its UI: Restore › *Direct restore from backup files*, the folder `secrets` in the backup folder, and `DUPLICATI_SECRETS_PASSPHRASE` from Vaultwarden or the recovery kit. That gives `homelab.env`: copy it to `~/Homelab/.env` and `chmod 600 .env`. It holds `DUPLICATI_PASSPHRASE` for every other job.
4. The same way (*Direct restore from backup files*, with `DUPLICATI_PASSPHRASE`), restore the `appdata` folder to `data/appdata`, `stack-data` to `appdata`, and `databases` to `recovery-staging`.
5. `./homelab up` and watch it start the baseline (databases start empty).
6. Restore each database from its dump (see below), then restart its app.
7. Install Jellyfin (`brew install --cask jellyfin`), quit it, restore **Homelab Jellyfin** to its data folder, and start it.
8. Addresses: in Home mode, Setup › **Addresses on your tailnet** (`./homelab tailnet setup`; it opens Tailscale's sign-in page when needed, no auth key required). *With a domain*, `./homelab domain setup`. Then `./homelab notify setup` and `./homelab schedule install`.
9. `./homelab duplicati setup` (Setup › **Create the backup jobs**) makes the jobs again with the passphrases from the restored `.env`. Each job whose folder already holds its backup gets its database rebuilt from it (a repair) instead of a first run. Without that, Duplicati refuses to back up into the folder.
10. Check everything: `./homelab status`, `./homelab watchdog`, `./homelab doctor`, and open a few apps from a phone on mobile data (with Tailscale on in Home mode; *with a domain*, every public app).

## Scenario: moving to a new machine

When the old machine still works (a new Mac, say), there is nothing to restore from Duplicati. In the app: Backups › **Moving to a new machine** › **Move out…** on the old machine, and **Move in…** with that file on the new one. In Terminal, on the old machine:

```sh
cd ~/Homelab
./homelab move out --to /Volumes/Drive/homelab-move.tar
```

It backs up, stops the apps, packs `.env`, the apps' data, your own apps, and the newest database dumps into that one file, and removes the scheduled jobs, so the old machine stays stopped. Move the drive with the photos and media over. On the new machine, install the runtime and Homelab Wizard, make the homelab folder (Setup › **Set it up for me**, or `git clone`), then:

```sh
./homelab move in /Volumes/Drive/homelab-move.tar
```

It unpacks everything, stops if a folder in `.env` (the media drive, the photos) is not on this machine yet (fix it in Settings, then run `./homelab move in` again to carry on), starts each app on the image it ran when the backup was made (by its digest, from `recovery-staging/databases/images`), loads each database from its dump, starts the apps that ran before, and installs the jobs. Its list of what is left names the apps on an older version than the newest: `./homelab update <app>` moves each on once all is well, with a copy of its data first. Then check Status, and run Setup › **Create the backup jobs** so Duplicati finds the backup folder here. In Tailscale's admin console, remove the old machine if the new one shows up as a new device. *With a domain*, also move the router's reservation to the new machine and run **Set up the domain**. Once all is well, `./homelab uninstall` on the old one.

## Scenario: another machine takes over

When the Mac is gone for a while, the Steam Machine or a Windows PC can run the homelab from the same repository and backups. The steps follow the full rebuild above; this is what differs. [Host](<Host.md#linux-and-windows-hosts>) has each platform's runtime and jobs, and ISSUE-0012 and ISSUE-0013 in [Known Issues](<Known Issues.md>) what has not been tried there yet.

1. **One homelab at a time.** If the Mac still runs, stop it first: `./homelab schedule remove`, then quit OrbStack and turn off its Start at login. Two tunnels with the same token split public visitors between the machines, and two Duplicatis writing to the same backup folders damage each other's databases.
2. **The runtime and the app:** Docker Engine with the compose plugin on Linux (`loginctl enable-linger $USER` so the jobs run without a login), Docker Desktop with WSL 2 on Windows. Then the app for that machine from the release run: the AppImage on the Steam Machine (Setup › **Add to the app menu**), the installer on Windows. Each carries the CLI.
3. **The files:** `git clone` the repository (on Windows, outside OneDrive), and restore `.env` and the data with Duplicati as in steps 3 and 4 above. Before `up`, change the folder settings in **Settings** to this machine's folders: `MEDIA_ROOT`, `DOWNLOADS_ROOT`, and `IMMICH_UPLOAD_LOCATION` to where the media drive mounts (on the Steam Machine under `/run/media/`, on Windows a drive letter), and `JELLYFIN_DATA_DIR` to the new Jellyfin's data folder. Setup › Disk space then lists the drive with its free space.
4. **Backups:** `BACKUP_DESTINATION` to this machine's synced copy of the same cloud drive folder (Setup › Backups leave this machine offers the ones it finds). On Linux, Setup finds `~/Dropbox`, `~/OneDrive`, and mounted external drives; for a cloud drive with no Linux app, use an rclone mount, and until then a local folder (the backups then stay on the machine).
5. **The address** (*with a domain*): move the router's reservation for 192.168.1.10 to the new machine, so every device's DNS setting and the AdGuard rewrite keep working. (`./homelab domain setup` finds the address itself, but each phone and computer has 192.168.1.10 typed in.)
6. **Start it:** `./homelab up`, restore the databases (below), install Jellyfin the way `./homelab install jellyfin` says for this platform and restore **Homelab Jellyfin** into it, then `./homelab tailnet setup` (Home mode) or `./homelab domain setup` (*with a domain*), `./homelab notify setup`, `./homelab schedule install`, and `./homelab duplicati setup` (it repairs each job from its existing backup).
7. **Check:** `./homelab doctor`, `./homelab watchdog`, the app's Status and Setup screens, and a few apps from a phone on mobile data.

To go back, do the same in reverse: stop the standby (`./homelab schedule remove`, then stop Docker and its start at login), restore its newest backups onto the Mac (or let the Mac's jobs repair from them), and move the reservation back.

**Keeping a standby ready** takes a few minutes a month: `git pull` on it, its runtime installed but the homelab stopped, and the newest app build. Once a year, a timed takeover on a quiet weekend, with the restore test's timing (Backups) as the first number on record, shows how long the household would wait.

## Scenario: Nginx Proxy Manager

Only when the proxy is installed (always *with a domain*). Never pull `jc21/nginx-proxy-manager`; it lacks the bouncer.

1. `./homelab update nginx-proxy-manager` (rebuilds the image and recreates the container). Its data and certificates come back from `data/appdata/nginx-proxy-manager`.
2. Check the bouncer: `./homelab compose crowdsec exec crowdsec cscli bouncers list` shows `nginx_proxy_manager` with a recent pull.
3. Test a ban (see [Runbooks](<Runbooks.md>)).

## Scenario: a database (Paperless example)

1. Stop the app, keep the database running: `./homelab stop paperless`.
2. Restore the latest dump:

   ```bash
   gunzip -c recovery-staging/databases/paperless-db/paperless-db-<stamp>.sql.gz \
     | ./homelab compose paperless exec -T paperless-db psql -U paperless -d postgres
   ```

3. `./homelab start paperless`, then open https://docs.example.com and search for a known document.

MoneyMatter is the same with `moneymatter-db` and user `budget_tracker`; restore the attachments archive into its volume:

```bash
./homelab stop moneymatter-backend
docker run --rm -i -v homelab_budget_tracker_moneymatter-attachments:/data alpine:3 \
  tar xzf - -C /data < recovery-staging/volumes/moneymatter-attachments/moneymatter-attachments-<stamp>.tar.gz
./homelab start moneymatter-backend
```

## Scenario: Immich

Immich's database must use `ghcr.io/immich-app/postgres` with the same vectorchord/pgvecto.rs tag that is pinned in `stacks/immich/compose.yaml`. A stock Postgres image cannot restore it.

1. `./homelab compose immich stop immich-server immich-machine-learning`
2. Make sure `immich-database` is running and empty (a fresh volume), then restore, fixing the search path the way Immich's own instructions do:

   ```bash
   gunzip -c recovery-staging/databases/immich-database/immich-database-<stamp>.sql.gz \
     | sed "s/SELECT pg_catalog.set_config('search_path', '', false);/SELECT pg_catalog.set_config('search_path', 'public, pg_catalog', true);/g" \
     | ./homelab compose immich exec -T immich-database psql -U postgres -d postgres
   ```

3. Photos come back from the **Homelab Photos** job into `IMMICH_UPLOAD_LOCATION` if the drive was lost.
4. `./homelab compose immich up -d`, then open https://photos.example.com.

Immich also keeps its own nightly database backups in `IMMICH_UPLOAD_LOCATION/backups`.

## Scenario: Vaultwarden

1. `./homelab stop vaultwarden`
2. Restore `data/appdata/vaultwarden` from **Homelab AppData** (into `/staging/restore`, then copy).
3. `./homelab start vaultwarden`; sign in on the web vault before trusting the phone apps.

## Scenario: Cloudflare Tunnel

*With a domain* only.

1. `./homelab status` and `./homelab logs cloudflared`.
2. Check `TUNNEL_TOKEN` in `.env`, then `./homelab restart cloudflared`.
3. If the token is lost: in Cloudflare Zero Trust > Networks > Tunnels, open the tunnel and copy its token again (or create a new tunnel), update `.env`, `./homelab up`, and run `./homelab domain setup` to rewrite the public hostnames.

## Post-recovery checklist

- [ ] `./homelab status` shows every baseline app running and healthy
- [ ] Setup shows every step done (or `./homelab setup`)
- [ ] Home mode: the apps open at their tailnet addresses on a phone with Tailscale on
- [ ] *With a domain:* `*.example.com` resolves to 192.168.1.10 on the Mac and on a phone; Status › Protection says bans are enforced (otherwise **Fix**) and a test ban returns 403
- [ ] `./homelab watchdog` passes; an app loads from a phone on mobile data
- [ ] `./homelab schedule status` shows the agent installed
- [ ] Duplicati jobs complete without errors
- [ ] ntfy test messages arrive (`./homelab notify test`)
