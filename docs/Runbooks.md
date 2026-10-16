---
version: 0.1.0-alpha
---

# Runbooks

Step-by-step procedures. Each one ends with a check that it worked.

## First-time bring-up

The same order as the app's Setup screen and `./homelab setup`, which check each step live and have a button for most of them (**Do the steps I can** runs every ready step in turn); [Getting Started](<Getting Started.md>) explains them without commands. Each step depends on the one before. Home mode (no domain) is the default; the steps for a domain follow below.

1. **Mac:** the power settings and login items ([Host](<Host.md>)); the awake job (scheduled jobs, below) keeps it from sleeping.
2. **Runtime:** `brew install --cask orbstack` and turn on Start at login (Setup offers **Download OrbStack** or **Open OrbStack**).
3. **Homelab folder:** Setup › **Set it up for me** makes `~/Homelab` from the files inside the app. Or `git clone <repo> ~/Homelab && cd ~/Homelab` (needs `brew install go`). Then `./homelab doctor`.
4. **Start:** **Start the homelab** (`./homelab up`). It creates `.env` with generated secrets and starts the baseline. Copy the generated secrets into Vaultwarden once it exists.
5. **Address:** reserve the machine's address (192.168.1.10) in the router.
6. **Addresses on your tailnet:** **Set up the addresses** installs Tailscale and opens its sign-in page in the browser (no auth key needed; `./homelab tailnet login` does the same), then writes every app's https address (`./homelab tailnet setup`). In the Tailscale admin console › DNS, turn on HTTPS Certificates.
7. **Password manager:** once Vaultwarden is installed, **Open sign-ups for 10 minutes** (`./homelab signups open`), create the accounts at its address from Status, and they close on their own (or `./homelab signups close`). Then **Two-step sign-in** for each account.
8. **Backups:** pick where they go (a cloud drive's folder or an external drive; `./homelab duplicati destination`), then **Create the backup jobs** (`./homelab duplicati setup`, [Automation](<Automation.md>)). Copy `DUPLICATI_SECRETS_PASSPHRASE` (Settings › **Copy**) into Vaultwarden and onto the recovery kit (Backups › **Recovery kit**).
9. **Alerts:** **Set up the alert token** (`./homelab notify setup`; it also makes the phone's login, `phone` with `NTFY_PHONE_PASSWORD`; see [Monitoring](<Monitoring.md>)), sign the phone's ntfy app in and subscribe, then `./homelab notify test`.
10. **Jobs:** **Install the jobs** (`./homelab schedule install`), then `./homelab schedule status`.
11. **Heartbeat:** a healthchecks.io check (15-minute period and grace) with its ping URL in `HEARTBEAT_URL`.
12. **Devices:** install Tailscale on each phone and computer and sign in with the same account. With ad blocking installed, **Set up ad blocking** and add the nameserver it shows in the Tailscale admin console.
13. **Jellyfin** (if installed): `brew install --cask jellyfin`, add it to login items, add the libraries from `/Volumes/Media`.
14. **Monitors** (optional): Uptime Kuma monitors for the installed apps ([Monitoring](<Monitoring.md>)).

**With a domain** (`HOMELAB_DOMAIN` set), steps 6 and 12 are replaced by:

- **AdGuard Home:** **Set up AdGuard** (`./homelab adguard setup`) answers its first-run wizard with a generated login. Set upstream DNS ([Networking](<Networking.md>)).
- **Cloudflare API token:** one with Zone › Zone › Read, Zone › DNS › Edit, and Account › Cloudflare Tunnel › Edit, in `CLOUDFLARE_API_TOKEN`.
- **Domain:** **Set up the domain** (`./homelab domain setup --ssl`; try `--dry-run` first). It issues the wildcard certificate, creates every proxy host, and adds the AdGuard rewrite.
- **This Mac finds its apps by name** (macOS): `./homelab domain resolver --apply` writes `/etc/resolver/<domain>`, so the Mac looks up every app name in AdGuard Home, also with a VPN on. It asks for the Mac's password once.
- **Tunnel** (after the password manager): in Cloudflare Zero Trust › Networks › Tunnels, create a tunnel (Cloudflared type), copy its token into `TUNNEL_TOKEN`, then **Start the tunnel** (`./homelab up` and `./homelab domain setup`). After **Set up the alert token**, run `./homelab domain setup` again: it publishes ntfy once the token exists.
- **Devices:** set DNS to 192.168.1.10 on each phone and computer.

**Check:** Setup shows every step done (`./homelab setup`); then `./homelab status`, `./homelab watchdog`, an app on a phone using mobile data, and every item in the [Disaster Recovery](<Disaster Recovery.md>) post-recovery checklist.

## Add an optional app

1. In the app, **Choose stacks**, tick the app, and install; the plan shows what will start. In Terminal, `./homelab plan <app>`, then `./homelab install <app>`.
2. Its address comes by itself: on the tailnet in Home mode; *with a domain*, a proxy host once **Set up the domain** has run once (a public app's hostname still needs `./homelab domain setup`).
3. Sign in, set a password, and store it in Vaultwarden.
4. Optionally, add an Uptime Kuma monitor.

**Check:** the app loads at its address from a phone on Wi-Fi.

## Add a brand-new service

Follow [Contributing](<Contributing.md>): add the compose block, `./homelab docs`, write the note, `make check`, install, `./homelab domain setup`.

## Make an app public, or private again

*With a domain* only; in Home mode nothing is published to the internet.

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

*With a domain* and the tunnel. Use a phone on mobile data, so the request comes through the tunnel with a public address. First check Status › Protection says bans are enforced; if not, click **Fix** (`./homelab fix`).

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

## Move to a new machine

1. On the old machine: Backups › **Moving to a new machine** › **Move out…**, and save the file on a drive (`./homelab move out --to /Volumes/Drive/homelab-move.tar`).
2. Move the drive with the photos and media over.
3. On the new machine: install the runtime and Homelab Wizard, Setup › **Set it up for me**, then Backups › **Move in…** with the file (`./homelab move in <file>`).
4. Follow the steps it lists, then `./homelab uninstall` on the old machine.

**Check:** Status shows every app green, and a photo, a password, and a document open. [Disaster Recovery](<Disaster Recovery.md#scenario-moving-to-a-new-machine>) has the details.

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
