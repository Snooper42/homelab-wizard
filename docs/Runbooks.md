---
version: 0.1.0-alpha
---

# Runbooks

Step-by-step procedures. Each one ends with a check that it worked.

## First-time bring-up

The same order as the app's Setup screen and `./homelab setup`, which check each step live; [Getting Started](<Getting Started.md>) explains them without commands. Each step depends on the one before.

1. **Mac:** the power settings and login items ([Host](<Host.md>)); the awake job (step 14) keeps it from sleeping.
2. **Software:** `brew install --cask orbstack` (turn on Start at login), `brew install go`.
3. **Repository:** `git clone <repo> ~/Homelab && cd ~/Homelab`. Check `MEDIA_ROOT` and `JELLYFIN_DATA_DIR` after the first start, and run `./homelab doctor`.
4. **Start:** `./homelab up`. It creates `.env` with generated secrets, builds the proxy image, and starts the baseline. Copy the generated secrets into Vaultwarden once it exists.
5. **Address:** reserve the Mac's address (192.168.1.10) in the router.
6. **AdGuard Home:** open http://localhost:3002, finish the wizard (admin interface on port 80, DNS on port 53, as the container already maps them), then put the login in `ADGUARD_USER`/`ADGUARD_PASSWORD`. Set upstream DNS ([Networking](<Networking.md>)).
7. **Cloudflare API token:** one with Zone › Zone › Read, Zone › DNS › Edit, and Account › Cloudflare Tunnel › Edit, in `CLOUDFLARE_API_TOKEN`.
8. **Domain:** `./homelab domain setup --ssl` (try `--dry-run` first). It issues the wildcard certificate, creates every proxy host, and adds the AdGuard rewrite.
9. **Vaultwarden:** `./homelab signups open` opens sign-ups for 10 minutes; create the accounts at https://passwords.example.com (the web vault needs https). They close on their own, or with `./homelab signups close`.
10. **Tunnel:** in Cloudflare Zero Trust › Networks › Tunnels, create a tunnel (Cloudflared type), copy its token into `TUNNEL_TOKEN`, then `./homelab up` (starts cloudflared) and `./homelab domain setup` (writes the public hostnames and CNAME records).
11. **Backups:** `./homelab duplicati destination` points `BACKUP_DESTINATION` at a new *Homelab Backups* folder in Proton Drive (or name another folder). Then `./homelab duplicati setup` creates the jobs ([Automation](<Automation.md>)) and runs the small ones; copy `DUPLICATI_SECRETS_PASSPHRASE` from `.env` into Vaultwarden and the recovery kit.
12. **Alerts:** `./homelab notify setup` (it also makes the phone's login, `phone` with `NTFY_PHONE_PASSWORD`; see [Monitoring](<Monitoring.md>)), sign the phone's ntfy app in and subscribe, add the alert address to Uptime Kuma (Duplicati gets it from `notify setup`), run `./homelab domain setup` again (it publishes ntfy once the token exists), then `./homelab notify test`.
13. **Jobs:** `./homelab schedule install`, then `./homelab schedule status`.
14. **Heartbeat:** a healthchecks.io check (15-minute period and grace) with its ping URL in `HEARTBEAT_URL`.
15. **Devices:** set DNS to 192.168.1.10 on each phone and computer.
16. **Jellyfin:** `brew install --cask jellyfin`, add it to login items, add the libraries from `/Volumes/Media`.
17. **Monitors:** create the Uptime Kuma monitors ([Monitoring](<Monitoring.md>)).

**Check:** `./homelab setup` shows every step done; then `./homelab status`, `./homelab watchdog`, a public app on a phone using mobile data, and every item in the [Disaster Recovery](<Disaster Recovery.md>) post-recovery checklist.

## Add an optional app

1. `./homelab plan <app>` shows what will start and which ports it uses.
2. `./homelab install <app>`.
3. `./homelab domain setup` adds its proxy host (and public hostname, if the app is public).
4. Sign in, set a password, and store it in Vaultwarden.
5. Add an Uptime Kuma monitor.

**Check:** the app loads at its address from a phone on Wi-Fi.

## Add a brand-new service

Follow [Contributing](<Contributing.md>): add the compose block, `./homelab docs`, write the note, `make check`, install, `./homelab domain setup`.

## Make an app public, or private again

1. Set `public: true` (or remove it) in the app's `x-homelab` block, and run `./homelab docs`.
2. `./homelab domain setup`.
3. To make it private again, also delete its public hostname in the tunnel's settings and its CNAME record in Cloudflare (the CLI adds them but never deletes them).

**Check:** `dig +short <host> @1.1.1.1` returns Cloudflare addresses for a public app and nothing for a private one.

## Update Nginx Proxy Manager

1. Read the release notes for the new version.
2. `./homelab backup`, and make sure the AppData job ran recently.
3. Set `NPM_VERSION` in `.env` to the new version.
4. `./homelab update nginx-proxy-manager` (rebuilds the image with the bouncer and recreates the container).
5. Run the ban test below.

**Rollback:** set `NPM_VERSION` back and run step 4 again.

## Test the CrowdSec ban

Use a phone on mobile data, so the request comes through the tunnel with a public address.

1. Find the phone's public address (for example at https://ifconfig.me on the phone).
2. Ban it for five minutes:

   ```bash
   ./homelab compose crowdsec exec crowdsec cscli decisions add --ip <address> --duration 5m --reason "ban test"
   ```

3. Within 10 seconds, any public app on the phone returns 403.
4. Lift it: `./homelab compose crowdsec exec crowdsec cscli decisions delete --ip <address>`.

**Check:** the app loads again on the phone.

## Update a database's major version

Watchtower never does this. One command does the whole runbook, for the PostgreSQL databases with a version setting (Paperless, Ghostfolio, RomM, MoneyMatter):

```zsh
./homelab db upgrade paperless-db
./homelab db upgrade ghostfolio-db --to 18
```

It shows the plan first, then:

1. Downloads the new image (or uses the one already here when the registry says no).
2. Dumps every database in the container into `recovery-staging/databases/<db>`.
3. For a database whose volume is its data folder (Ghostfolio, RomM, MoneyMatter), archives the volume into `recovery-staging/volumes/<db>-before-pg<N>`, to go back to. Paperless's volume keeps one folder per major version, so its old data simply stays.
4. Stops the database and the apps of the same stack.
5. Sets `<APP>_DB_VERSION` in `.env`, starts the new version, waits for it, loads the dump, and checks that the databases are there.
6. Starts the apps again.

If any step after stopping fails, it goes back by itself: the old setting, the volume restored from its archive, the old version started. The dump and the archive stay in `recovery-staging` either way.

**Check:** sign in to the app and look at something you know is there. Immich's database is never upgraded this way; follow Immich's release notes.

## Restart the Mac safely

1. Close nothing; the containers stop with OrbStack.
2. Restart, then log in straight away (FileVault).
3. Within a few minutes the startup job runs `homelab up`.

**Check:** `./homelab status` and `./homelab watchdog`.

## Rotate a secret

1. Change it in the app (or generate a new value).
2. Update `.env` and the Vaultwarden entry.
3. Recreate the containers that read it: `./homelab update <app>` (or `./homelab compose <stack> up -d`).
4. `./homelab backup --apply` so the Secrets job picks up the new `.env`.

Database passwords live inside the database too: change them with `ALTER USER` first, then in `.env`.

## Monthly restore test

In the app, **Backups › Test a restore**; in a terminal, `./homelab restore-test --auto`. Each test goes on record with its result and how long it took: the Backups tile, the weekly summary, and `./homelab report` show it ([Backups](<Backups.md>), Restore testing). A failed test leaves the restored files in `recovery-staging/restore-test`; [Troubleshooting](<Troubleshooting.md>) has the usual causes, and one that repeats belongs in [Known Issues](<Known Issues.md>).
