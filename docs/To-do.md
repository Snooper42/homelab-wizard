---
version: 0.16.0
---

# To-do

After the first install: the steps that only you can do, in order. For each testing session, follow [Testing](<Testing.md>); when something does not work, `./homelab report` makes a file to share with every secret removed. What the code will do next is in the [Roadmap](<Roadmap.md>); problems to check are in [Known Issues](<Known Issues.md>).

## First: finish the setup

- [ ] A VPN app on the Mac that carries all traffic (with a kill switch) blocks the homelab's own addresses: turn on *Allow LAN connections* and turn the kill switch off. `./homelab doctor` warns while one does.
- [ ] Open the app's **Setup** screen (or run `./homelab setup`) and work down the checklist; **Do the N I can do for you** runs every step that is ready and stops at the first that needs you. The steps that need a person:
  - [ ] Home mode (the default): sign in to Tailscale when **Addresses on your tailnet** opens its page, then install Tailscale on each phone and computer.
  - [ ] With a domain instead: the AdGuard login and the Cloudflare API token in **Settings** (Zone › Zone › Read, Zone › DNS › Edit, Account › Cloudflare Tunnel › Edit), **Set up the domain**, then the Cloudflare tunnel (create it in Zero Trust, put its token in **Settings**, **Start the tunnel**), and each phone and computer using the Mac's address as its DNS server.
  - [ ] **Open sign-ups for 10 minutes** and create the Vaultwarden accounts; save the passwords from `.env` in the vault (Settings › **Copy** beside each one).
  - [ ] **Two-step sign-in**: each Vaultwarden account, and a personal Nginx Proxy Manager administrator (not the `NPM_API_EMAIL` account).
  - [ ] Backups: pick where they go (a cloud drive folder or an external drive), then **Create the backup jobs**; keep `DUPLICATI_SECRETS_PASSPHRASE` in Vaultwarden and on the recovery kit.
  - [ ] Alerts: **Set up the alert token**, subscribe the ntfy app on the phone (Duplicati gets the token from the step).
  - [ ] **Install the jobs** (startup, nightly backup, watchdog, keep awake, phone companion).
  - [ ] A healthchecks.io check (15-minute period and grace), its ping URL in `HEARTBEAT_URL`.
- [ ] Rebuild the proxy once so it uses CrowdSec AppSec: `./homelab update nginx-proxy-manager`.
- [ ] After a few days of everything working: Status › More… › **Clean up old containers** (or `./homelab cleanup`, then `--volumes`), and delete the older setup's folders when you are sure.

## Soon: try the new apps

- [ ] **Tailscale** with a domain: approve the route, and add `192.168.1.10` as the split-DNS nameserver for `example.com` ([its note](<../services/network/Tailscale.md>)).
- [ ] **Home Assistant**: install it; its starter configuration already trusts the proxy ([its note](<../services/household/Home Assistant.md>)).
- [ ] The *Household* preset: **Grocy**, **Karakeep**, **Vikunja**, and **Homepage** (the start page). The Stack Data job already covers `appdata/karakeep`.
- [ ] **Open WebUI**: `brew install ollama`, `brew services start ollama`, `ollama pull llama3.2`, then install it.
- [ ] **Speedtest Tracker**, **Dozzle**, and **Syncthing** if you want them.
- [ ] The first restore test: Backups › **Test a restore** in the app (or `./homelab restore-test --auto`).

## This month

- [ ] Install the app with the one line in the [README](<../README.md#get-started>) (`install.sh`; it checks the download and needs no `xattr`), then check the app and the menu bar item start. Later builds come through **Update now** on the line at the top of the window.
- [ ] Decide on signing: the Apple Developer Program for the Mac, and the Windows route ([Releasing](<Releasing.md>)).
- [ ] Work through the "To verify" items in [Known Issues](<Known Issues.md>) and close each one that holds.

## After the Mac testing

- [ ] Print the recovery kit (Backups › **Recovery kit**) and write the Secrets passphrase on it.
- [ ] Add the household (Settings › **People**, or `./homelab person add`), then `./homelab sso setup` once Pocket ID has its admin (single sign-on needs a domain).
- [ ] Pair your phone (Settings › **Phones**).
- [ ] Ad blocking on every device: Choose stacks › **Ad blocking**, then the nameserver it shows in Tailscale's DNS settings.
- [ ] Read the app with VoiceOver on the Mac, and have a second person read the [security review](<Security.md#review-october-2026>).

## Someday

- [ ] Try the Linux profile on the Steam Machine (ISSUE-0012), with the AppImage from the release run (ISSUE-0014).
- [ ] Try the Windows profile when a Windows machine is around (ISSUE-0013).
- [ ] Hand the homelab to someone who is not technical, as the [roadmap](<Roadmap.md#still-open-from-the-first-months>) says, and note where they get stuck.
- [ ] Home Assistant OS in a VM, if device discovery or Zigbee/Thread radios become important.
