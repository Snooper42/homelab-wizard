---
version: 0.1.0-alpha
---

# To-do

After the first install: the steps that only you can do, in order. For each testing session, follow [Testing](<Testing.md>); when something does not work, `./homelab report` makes a file to share with every secret removed. What the code will do next is in the [Roadmap](<Roadmap.md>); problems to check are in [Known Issues](<Known Issues.md>).

## First: finish the setup

- [ ] A VPN app on the Mac that carries all traffic (with a kill switch) blocks the homelab's own addresses: turn on *Allow LAN connections* and turn the kill switch off. `./homelab doctor` warns while one does.
- [ ] Open the app's **Setup** screen (or run `./homelab setup`) and work down the checklist. In order, the steps left are:
  - [ ] AdGuard login in **Settings** (`ADGUARD_USER`, `ADGUARD_PASSWORD`).
  - [ ] Cloudflare API token in **Settings** (Zone › Zone › Read, Zone › DNS › Edit, Account › Cloudflare Tunnel › Edit).
  - [ ] **Set up the domain**: the certificate and every `https://…example.com` address.
  - [ ] **Open sign-ups for 10 minutes** and create the Vaultwarden accounts; save the passwords from `.env` in the vault (Settings › **Copy** beside each one).
  - [ ] **Two-step sign-in**: each Vaultwarden account, and a personal Nginx Proxy Manager administrator (not the `NPM_API_EMAIL` account).
  - [ ] Cloudflare tunnel: create it in Zero Trust, put its token in **Settings**, **Start the tunnel**.
  - [ ] Backups: `BACKUP_DESTINATION` on Proton Drive, then **Create the backup jobs**; keep `DUPLICATI_SECRETS_PASSPHRASE` in Vaultwarden and on the recovery kit.
  - [ ] Alerts: **Set up the alert token**, subscribe the ntfy app on the phone, add the token to Uptime Kuma (Duplicati gets it from the step).
  - [ ] **Install the jobs** (startup, nightly backup, watchdog).
  - [ ] A healthchecks.io check (15-minute period and grace), its ping URL in `HEARTBEAT_URL`.
  - [ ] Each phone and computer: the Mac's address as its DNS server, or Tailscale's DNS setting for every Tailscale device (Choose stacks › **Ad blocking**).
- [ ] Rebuild the proxy once so it uses CrowdSec AppSec: `./homelab update nginx-proxy-manager`.
- [ ] After a few days of everything working: Status › More… › **Clean up old containers** (or `./homelab cleanup`, then `--volumes`), and delete the older setup's folders when you are sure.

## Soon: try the new apps

- [ ] **Tailscale**: an auth key in Settings, install it, approve the route, and add `192.168.1.10` as the split-DNS nameserver for `example.com` ([its note](<../services/network/Tailscale.md>)).
- [ ] **Home Assistant**: install it; its starter configuration already trusts the proxy ([its note](<../services/household/Home Assistant.md>)).
- [ ] The *Household* preset: **Grocy**, **Karakeep**, **Vikunja**, and **Homepage** (the start page). The Stack Data job already covers `appdata/karakeep`.
- [ ] **Open WebUI**: `brew install ollama`, `brew services start ollama`, `ollama pull llama3.2`, then install it.
- [ ] **Speedtest Tracker**, **Dozzle**, and **Syncthing** if you want them.
- [ ] The first restore test: Backups › **Test a restore** in the app (or `./homelab restore-test --auto`).

## This month

- [ ] Download the latest release build (Actions › Release › Artifacts › macos), drag the app from the DMG to Applications, run `xattr -dr com.apple.quarantine "/Applications/Homelab Wizard.app"` once (it is unsigned), then check the app and the menu bar item start (ISSUE-0014).
- [ ] Decide on signing: the Apple Developer Program for the Mac, and the Windows route ([Releasing](<Releasing.md>)).
- [ ] Work through the "To verify" items in [Known Issues](<Known Issues.md>) and close each one that holds.

## After the Mac testing

- [ ] Print the recovery kit (Backups › **Recovery kit**) and write the Secrets passphrase on it.
- [ ] Add the household (`./homelab person add`), then `./homelab sso setup` once Pocket ID has its admin.
- [ ] Pair your phone (Settings › **Phones**).
- [ ] Ad blocking on every device: Choose stacks › **Ad blocking**, then the nameserver it shows in Tailscale's DNS settings.

## Someday

- [ ] Try the Linux profile on the Steam Machine (ISSUE-0012), with the AppImage from the release run (ISSUE-0014).
- [ ] Try the Windows profile when a Windows machine is around (ISSUE-0013).
- [ ] Hand the homelab to someone who is not technical, once the [hands-off setup](<Roadmap.md#0100-hands-off-setup>) is done, and note where they get stuck.
- [ ] Home Assistant OS in a VM, if device discovery or Zigbee/Thread radios become important.
