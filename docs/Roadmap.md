---
version: 0.1.0-alpha
---

# Roadmap

What comes next, in order. Each version's items are roughly in priority order; open problems live in [Known Issues](<Known Issues.md>).

## 0.1.x: the first real install (in progress)

- [x] Install OrbStack and Go, clone to `~/Homelab`, `./homelab up`
- [x] Move apps from an older setup in with `homelab adopt` (Kavita, Komga, Homepage, Audiobookshelf, Navidrome, Feishin, MoneyMatter, Vaultwarden)
- [x] Reserve the Mac's address in the router
- [x] AdGuard wizard; LAN DNS answers on 192.168.1.10
- [x] `ADGUARD_USER`/`ADGUARD_PASSWORD` and `CLOUDFLARE_API_TOKEN` in `.env`
- [x] `./homelab domain setup --ssl` (wildcard certificate, proxy hosts, LAN DNS)
- [ ] Vaultwarden accounts at `https://passwords.example.com` (the web vault refuses plain http), then sign-ups off, before the tunnel
- [ ] Create the tunnel, add `TUNNEL_TOKEN`, `./homelab up`, `./homelab domain setup`
- [ ] `BACKUP_DESTINATION` on Proton Drive; create the Duplicati jobs ([Automation](<Automation.md>)) and run each once
- [ ] `./homelab notify setup`, subscribe the phone, `./homelab notify test`
- [ ] `./homelab schedule install`
- [ ] Uptime Kuma monitors ([Monitoring](<Monitoring.md>))
- [ ] First restore test
- [ ] Remove the older setup's stopped containers once everything has run for a few days (`homelab cleanup`)
- [ ] Work through every "To verify" item in [Known Issues](<Known Issues.md>)

## 0.2.0: the app does the setup (done)

Bring-up on the Mac showed where the time goes: a 16-step runbook, `.env` edited by hand five times, and steps that only work in a certain order. The app should carry that.

- [x] **Guided setup** on the Setup screen: the bring-up as a checklist with a live check per step (runtime up, AdGuard answering, token valid, certificate issued, tunnel connected, backups configured, jobs installed) and a button for each step the engine can do (`domain setup`, `schedule install`, `notify setup`)
- [x] **Settings screen** for `.env`: masked fields for tokens and passwords (never shown back), checked by the setup step that uses them (the Cloudflare token reads the zone, the AdGuard login works)
- [x] **Move into the homelab** on Status: apps running *elsewhere* get a button that runs `adopt`, with the plan first and a way back
- [x] **Sign-up window** for Vaultwarden: open sign-ups for ten minutes, then close them, instead of editing `.env` twice
- [x] **Doctor checks from bring-up**: a VPN or kill switch blocking the LAN, OrbStack's memory limit against what the selected apps need, the router not handing out AdGuard (ISSUE-0008)
- [x] **Clean up after a move**: list the stopped old containers and their volumes, and remove them on request

## 0.3.0: hardening (done)

- [x] External heartbeat so a stopped OrbStack is noticed (ISSUE-0006): a healthchecks.io ping from the watchdog
- [x] Alerts away from home (ISSUE-0011): token-authenticated publishers, then publish ntfy through the tunnel
- [x] Monthly restore-test reminder through ntfy from the nightly backup job (the restore itself stays a few clicks in Duplicati)
- [x] The watchdog checks every app's health, so alerts no longer depend on Uptime Kuma monitors (which have no API to create them)
- [x] CrowdSec AppSec (virtual patching) in the proxy bouncer

## 0.4.0: more apps, and your own

- [x] Tailscale as a subnet router: the home network from anywhere, no open ports
- [x] Home Assistant (container; device discovery needs a VM, documented)
- [x] Karakeep (saved links and read-later), its own stack with headless Chrome and Meilisearch
- [x] Grocy (groceries, household stock, chores)
- [x] Speedtest Tracker, Dozzle (through the read-only socket proxy), Syncthing
- [x] Open WebUI with native Ollama for the Mac's GPU
- [x] *Household* and *Away from home* presets
- [x] `homelab custom add|remove`: your own apps, with the catalog's metadata, validated and rolled back on any problem
- [x] **Add your own app** on the app's Choose stacks screen
- [x] Savings rows for the new apps, with checked prices (Karakeep, Grocy; the rest are listed as not counted)
- [x] Doctor: Ollama answering when Open WebUI is installed
- [x] Doctor: Tailscale logged in and its route approved (read from `tailscale status` inside the container, no API key)
- [x] Home Assistant's `trusted_proxies` written on first install (`seed`: starter files that never overwrite)
- [x] Wiring: Open WebUI reaches Ollama through `OLLAMA_BASE_URL`; Karakeep's extension address is in its note

## 0.5.0: the first release

- [x] Run the release workflow unsigned and fix what it finds (ISSUE-0014): the macOS universal build, the menu bar helper's first compile, the Windows installer build and the Linux packages all pass; build provenance is skipped while the repository is private
- [x] An app icon (`app/build/appicon.png`, from `assets/logo.svg`) and the bundle's name and version in its Info.plist
- [ ] `VERSION` and every doc's front matter to 0.5.0; release notes from the CHANGELOG
- [ ] Tag `v0.5.0-alpha` and publish the draft release
- [ ] Apple Developer ID: certificate, notarization, and the secrets in GitHub
- [ ] Windows: cloud signing, or an MSIX for the Microsoft Store
- [x] The app opens on Setup until the checklist is done, with the steps left on its tab
- [x] The homelab checks GitHub for new changes and applies them, fast-forward only: `homelab upgrade` and Setup › Update
- [x] The app shows its own build against the homelab folder: release builds carry their commit, and Setup says when the folder has newer app changes (no public repository or release feed needed)
- [x] `homelab report`: a diagnostics file to share, with every secret removed, also on the app's Setup screen; [Testing](<Testing.md>) is the script for each test session

## 0.6.0: remote access and security

- [ ] Tailscale set up and verified from the phone on mobile data, with split DNS
- [x] No admin app published without Cloudflare Access: `validate` refuses `public: true` on infrastructure apps and on any marked `admin: true` ([Security](<Security.md>))
- [ ] Two-factor sign-in for Vaultwarden accounts and the Nginx Proxy Manager admin (a Setup step since 0.7.0; ticked once done on the Mac)
- [ ] CrowdSec console enrollment (`CROWDSEC_ENROLL_KEY`) for its dashboard and blocklists
- [x] The proxy's CrowdSec bouncer watched: `doctor` says when it last pulled the ban decisions, and the watchdog alerts when it stops
- [x] What CrowdSec caught, on Status (Protection) and in the weekly summary
- [x] A reminder to export the Vaultwarden vault (encrypted) alongside the backups: monthly from the nightly backup, an alert for a plain export, and its state on the Backups screen
- [x] Review which images Watchtower updates and which are pinned, with a reason for each pin: generated into [Automation](<Automation.md#who-updates-what>), with `validate` warning about a pin without a reason

## 0.7.0: everyday polish in the app

- [x] Status: start or stop, restart, update, and the latest log for each app, with Open Dozzle to follow logs live
- [x] Alerts: the latest ntfy messages on Status and the newest in the menu bar (a read-only `homelab-reader` token from `notify setup`)
- [x] Backups: last backup, each app's newest dump (fresh or stale), the destination, the last restore test, and Back up now
- [x] Backups: each Duplicati job's last run, size, and error, read from Duplicati's API with `DUPLICATI_PASSWORD`
- [x] Savings: the yearly total over time (recorded nightly in `data/savings-history.json`, a sparkline and the change on Status)
- [x] Settings: a Test button for each login, token, ping URL, and folder, checking the saved value with the real service
- [x] Settings: Copy a saved password for Vaultwarden without it reaching the page; Choose… for folder settings
- [x] Backups: Test a restore (Duplicati restores a sample, checked against the live files); Create the backup jobs through Duplicati's API, with a repair for a rebuilt machine
- [x] Setup: Use Proton Drive; Update (fast-forward from GitHub, then `up`); a newer app build noticed
- [x] The phone's ntfy login made by `notify setup`; a weekly summary on Sundays; Homepage kept as the household's start page
- [x] The watchdog's last run on Status (each failing check and since when), in the menu bar, in the report, and in the weekly summary
- [x] Disk space on every disk the homelab writes to, in doctor, the watchdog, Setup, and the weekly summary
- [x] Each restore test on record with how long it took, and each Duplicati job's next run (Backups)

## 0.8.0: other machines

- [x] The desktop app for every platform, each with the CLI for Setup's buttons: the macOS DMG, the Windows installer for x64 and ARM64 PCs and portable zips, .deb, .rpm, and Arch packages, and an AppImage for SteamOS that carries WebKitGTK (checked on every release run without the system's copy)
- [x] Windows: no console windows from the app or its scheduled jobs (`homelab-run.exe`, the sign-in job from the Run key)
- [x] The menu bar item or tray icon starts at login on every platform (Setup)
- [x] Each platform's look and conventions: on the Mac a translucent sidebar with the window buttons in it and View and Help menus (Settings… on ⌘,); on Windows 11 the navigation pane on Mica with Segoe UI Variable and the accent pill; on Linux GNOME's and KDE's neutral look; each with its own greys and accent, arrow cursors, and labels that do not select
- [ ] Linux profile on the Steam Machine with the AppImage (ISSUE-0012, ISSUE-0014)
- [ ] Windows profile on a Windows machine when one is available (ISSUE-0013)
- [ ] A second machine (or a NAS) as a cold standby with the same repository ([the takeover runbook](<Disaster Recovery.md#scenario-another-machine-takes-over>) is written; a practice takeover is not done yet)

## 0.9.0: organised stacks and more apps

Productivity has become a catch-all, and one `compose.yaml` holds 40 apps. Regroup first, then split, then add.

- [x] **Categories** (catalog, `services/` folders, the app, README, Savings sections; nothing running changes):
  - Network: Nginx Proxy Manager, AdGuard Home, Cloudflare Tunnel, Tailscale, Gluetun, Speedtest Tracker, Docker Socket Proxy
  - Security: Vaultwarden, CrowdSec, Uptime Kuma, ntfy (ntfy is published, so it stays out of System, whose apps never are)
  - System: Duplicati, Watchtower, Dozzle, Homepage, Homarr, and the helpers
  - Cloud & Files: Immich, Syncthing, File Browser
  - Documents: Paperless-ngx, Stirling PDF, Karakeep, FreshRSS, Open WebUI
  - Finance: MoneyMatter
  - Media: Jellyfin, Navidrome, Feishin, Audiobookshelf, Calibre-Web, Komga, Kavita
  - Media Automation: Prowlarr, Sonarr, Radarr, Lidarr, Bazarr, Seerr, LazyLibrarian, qBittorrent, FlareSolverr
  - Household: Home Assistant, Grocy, Mealie, Vikunja
- [x] **One Compose project per category**: `compose/<category>.yaml`, each its own project (`homelab_media`, `homelab_network`, …), so OrbStack groups the containers by category; `homelab migrate` (run by `upgrade`) moves the containers from `homelab_core` with a backup first. A group starts or stops with `./homelab start cat:media` or `stop cat:media-automation`
- [ ] **New apps**, each with its note, catalog entry, savings row where a paid service is replaced, and a Testing line:
  - [x] Baikal (calendars and contacts, chosen over Radicale for its web admin), Wallos (subscriptions), Pocket ID (one sign-in with passkeys), PairDrop (AirDrop across every device), Changedetection.io, Homebox, Memos, PsiTransfer
  - [x] RomM (game library, for the Steam Machine) and Ghostfolio (investments), each its own stack with PostgreSQL
  - [x] Drive health: Scrutiny cannot read a Mac's disks from a container, so `doctor`, the watchdog, and the weekly summary read SMART with `smartctl` (Homebrew) instead
  - [x] Docmost (the household wiki; chosen over BookStack because backups dump PostgreSQL, not MariaDB) and Dawarich (location history), each its own stack
  - Beszel left out: its agent in a container reports OrbStack's Linux machine, not the Mac; `doctor`, the watchdog, and Status already cover the Mac
  - Maybe: Frigate (only with cameras), Excalidraw, IT-Tools
- [x] Choose stacks: when the plan has nothing left to start, say so instead of only greying out Install

## 0.10.0: hands-off setup

The goal: someone who is not technical installs and runs the homelab on their own Mac with no Terminal, router, or Cloudflare. Then hand it over and watch without helping; each place they stop becomes the next fix.

- [x] The app makes the homelab folder itself on first run (**Set it up for me**, from the files each build carries: no `git clone`), and updates it from newer builds (`homelab upgrade` keeps settings, data, and your own apps, and saves a changed file as `.local`)
- [x] The app checks for OrbStack and walks through installing it: **Download OrbStack** when it is missing, **Open OrbStack** when it is installed but stopped, and Setup moves on by itself once it answers
- [x] A *Starter* pick (Photos, Passwords, Movies and TV, Music, Files) with the full list behind **Add more** (bundles with `starter: true` in `compose.yaml`; `homelab install @photos` works too)
- [x] A smaller baseline for folders the app makes: `up` starts only updates, backups, and alerts (`HOMELAB_BASELINE=small`, `x-homelab-small-baseline`), and the household picks the rest
- [x] **Home mode** without a domain: every app at `https://homelab.<tailnet>.ts.net:<port>` through Tailscale Serve (`homelab tailnet setup`, rerun by every install); Setup swaps the AdGuard, Cloudflare, domain, and tunnel steps for one Tailscale step, and folders the app makes start this way
- [x] Ad blocking optional, or through Tailscale DNS, so no router change is needed: an *Ad blocking* pick (`@adblock`: AdGuard Home and `tailnet-dns`, which carries DNS on the tailnet address to it); `homelab adguard setup` answers AdGuard's first-run wizard with a generated login and shows the nameserver to put in Tailscale's DNS settings
- [x] Backups to an external drive or a cloud drive, chosen in plain words: Setup offers a button for each one found (Proton Drive, iCloud Drive, Google Drive, OneDrive, Dropbox, and external drives other than the media drive)
- [x] Alerts on the machine's screen by default (Notification Center, notify-send, or a Windows toast; `DESKTOP_ALERTS`), phone alerts on top once set up
- [x] Keep the Mac awake while plugged in (the awake job: `caffeinate -s`, `systemd-inhibit`, or Windows' power request; `KEEP_AWAKE`), and `doctor` warns when it would sleep
- [x] **Fix it** for common problems (`homelab fix`, and a button on Status): starts the runtime, the baseline apps that are down, restarts then recreates unwell apps, frees space from unused images, installs missing jobs
- [x] New apps get their `https://<name>.<domain>` addresses by themselves after each install, in Nginx Proxy Manager (`AUTO_DOMAIN`, LAN only: tunnel hostnames stay a deliberate Set up the domain), once Set up the domain has run
- [x] Sending a report to a helper: **Email it to my helper** (`HELPER_EMAIL`) after Make a diagnostics report
- [ ] Signed and notarized builds (needs the Apple Developer ID above)

## 0.11.0: the phone companion

The homelab stays on the Mac; the phone gets a dashboard and a remote control. A web app first (it reuses the desktop app's screens), a native iOS app later.

- [x] `homelab serve`: a small HTTP API on the Mac for Status, alerts, backups, and app actions, reusing `internal/api`; home network and Tailscale only, never published through the tunnel (the serve job, port 8099; requests from public addresses or through Cloudflare are refused)
- [x] Pairing: the desktop app shows a QR code with a one-time code; the phone gets its own revocable token (listed and removable in Settings). Settings › **Phones** in the app; `homelab phone pair` prints the code, the links, and the QR code in Terminal; `phone list|allow|read-only|remove`
- [x] Read-only by default; start, stop, restart, and Back up now need a paired device marked *can make changes*
- [x] The phone web app (installable from Safari's Share › Add to Home Screen): Status tiles, each app with its dot and a link, alerts, backups and the restore test, savings. It is the desktop app's own frontend (now in `web/`, shared by the app and the CLI) at phone width
- [x] Served by the proxy at `https://homelab.<domain>` (or the Tailscale address in Home mode), with the same CrowdSec protection as every other app (a native app in the catalog, *Phone companion*)
- [x] Send a diagnostics report from the phone to a helper (**Send a report** on the phone's Status: the share sheet with the file, or a download and a mail to `HELPER_EMAIL`)
- [ ] Later: a native iOS app (SwiftUI) with widgets and Lock Screen status, through TestFlight, once signing is in place

## 0.12.0: updates without surprises

Nightly updates are convenient until one breaks an app. Make every change reversible.

- [x] Before Watchtower updates an app, record the image it ran; `homelab rollback <app>` (and a button on Status) goes back to it (kept a week as `homelab-rollback/<app>:previous`; the app's updates are then held until `homelab updates release`)
- [x] After a nightly update, the watchdog checks the updated apps' health; one that stays unwell is rolled back and an alert says so (unhealthy or restarting 20 minutes to 6 hours after the update; `AUTO_ROLLBACK`)
- [x] A database dump just before any update of an app with a database (the nightly backup moves to 03:30, before Watchtower; `homelab update` dumps first)
- [x] Database major-version upgrades as a guided command (dump, start the new version, restore, check), instead of a runbook (`homelab db upgrade <db> [--to N]`, back by itself if a step fails; `x-homelab` `version`)
- [x] `homelab upgrade` shows the CHANGELOG lines since the last upgrade, and can go back to the previous version (`homelab upgrade --back`, and *go back to* beside the version on Setup)
- [x] Release channels for the app and CLI: *stable* (tagged releases) and *testing* (main). `UPDATE_CHANNEL` in Settings: `homelab upgrade` moves a git checkout to the newest `v*` tag on stable, or along `main` on testing (the default until the first release); the app's *newer build* button opens GitHub Releases on stable and the latest Release run on testing
- [x] One-click update: Setup › **Update** moves the homelab files forward, then replaces the Mac app with the *Nightly* build of main and reopens it; the sidebar says **Update ready** on every screen
- [ ] The stable channel's app update from the newest `v*` release instead of Nightly (after the first release)

## 0.13.0: the household

- [x] Pocket ID as the household's sign-in: Immich, Paperless-ngx, Karakeep, Vikunja, Grocy, and Open WebUI set up for single sign-on (OIDC) where they support it, with passkeys. `homelab sso setup`: Karakeep, Open WebUI, Paperless-ngx, Mealie, and Vikunja by themselves; Immich's client made with the steps to paste it. Needs a domain
- [x] Vikunja's sign-in through Pocket ID (its `VIKUNJA_AUTH_OPENID_PROVIDERS_*` variables, from 1.0); Grocy has no OpenID Connect
- [x] Add a person: one form makes their accounts in the apps that need one and gives them a welcome page (addresses, the phone apps to install, their first sign-in). `homelab person add "<name>" --email …`: a Pocket ID account (the apps on single sign-on make theirs at first sign-in), a one-time link to add a passkey, and `data/people/<username>.html` with their apps and the phone apps (`x-homelab` `phone`). In the app: Settings › People
- [x] A family start page (Homepage) that shows each person only the apps they use (a tab each, at `#<first name>`, linked from their welcome page; `homelab person apps` chooses)
- [x] Per-person storage use for Immich and the media drive, on Status (Photos per person, read nightly from Immich; the media drive is shared, so it has no per-person share)
- [x] Remove a person: their accounts disabled, their data kept until you delete it (`homelab person remove`: their Pocket ID sign-in turned off; apps with their own passwords are listed to disable by hand)

## 0.14.0: leaving and moving

Owning the data means being able to take it anywhere.

- [x] `homelab export`: every app's data in open formats (photos with their albums, documents with their tags, passwords as an encrypted export, budgets as CSV) into one folder (every database table as CSV; `--photos` copies the originals too; each person exports their own vault, which the export picks up)
- [x] `homelab uninstall`: stop everything, remove the containers, scheduled jobs, menu bar item, and LaunchAgents, and keep the data unless asked (`--data` deletes it; the backups and the media drive always stay)
- [x] Move to another machine with the app: back up on the old one, restore on the new one, with a checklist (the [takeover runbook](<Disaster Recovery.md#scenario-another-machine-takes-over>) as a guided flow) Done as `homelab move out` and `homelab move in`, and Backups › Moving to a new machine in the app
- [x] A printable recovery kit from the app: where the backups are, the passphrases' locations (never the secrets themselves), and the steps to restore (Backups › Recovery kit, or `homelab recovery-kit`)

## 1.0.0: stable

- [ ] Every Known Issue verified or accepted with a reason
- [ ] Signed releases for macOS, Windows, and Linux
- [x] A guide for a new household starting from zero, without reading the code ([Getting Started](<Getting Started.md>))
- [ ] Upgrade notes between versions, and a timed restore drill on record (the app records and times each test; the first one on the Mac is still to come)
- [ ] Hands-off setup proven: someone who is not technical sets it up on their own Mac without help, and every place they stopped is fixed
- [ ] A month on the Mac with no unexplained alert, a monthly restore test passed each time, and a rollback of a bad update exercised
- [ ] Security review of everything reachable from outside (the tunnel, the phone API, Cloudflare Access, CrowdSec), written up in [Security](<Security.md>)
- [x] The app usable with the keyboard alone and with VoiceOver; text that scales (links that act are buttons to the keyboard, landmarks and live regions for logs and results, focus moves to each screen's heading, ⌘+ and ⌘− scale the app; a pass with VoiceOver on the Mac is still to do)
- [ ] Every screen of the app and every page of the docs checked against the 1.0 behaviour; no step that needs Terminal for the common path
- [x] A stable `--json` contract for the CLI (versioned, documented), since the app and the phone depend on it (`schema` in every line; `TestJSONContract`)

## 1.1.0: no Terminal, no guesswork

What a household still has to look up or type after 1.0, done in the app instead.

- [x] Home mode is the default for every new homelab, git clones included
- [x] Settings › **People**: add someone (their apps ticked), open or remake their welcome page, remove them; offers to install Pocket ID first
- [x] Status: sign-in details for the apps the homelab set up a login for (`x-homelab` `login`)
- [x] Open any app on a phone: a QR code beside each address on Status, for the phone's camera
- [x] Move to a new machine as a guided screen (`homelab move out` and `move in` behind buttons, with the checklist)
- [x] The stable channel's app update from the newest `v*` release
- [x] A versioned `--json` contract (`"schema": 1` in every reply) with a test that fails when a field disappears
- [x] Setup explains each step in one sentence of what you get from it, before how it works
- [x] Backups: warn when the destination is running out of room (the watchdog's disk check covers the destination's disk; a cloud drive's own quota cannot be read from the Mac)
- Uptime Kuma monitors made by the homelab: left out, since the watchdog already checks every app, address, and backup every 15 minutes and alerts; Uptime Kuma stays for checks of your own

## 1.2.0: knowing what is going on

- [x] Status › What the apps keep: each app's folder size, measured nightly, so a filling disk has a name
- [ ] Each app's last 7 days on Status: how long it was up, from the watchdog's checks
- [ ] A plain-language weekly summary in the app (what was updated, backed up, and caught), not only by alert
- [ ] Security review of everything reachable from outside, written up in Security.md (the 1.0 item)

## Later

- [x] Automated restore test through Duplicati's API: `restore-test --auto` and Backups › Test a restore
- [ ] A router that can hand out the AdGuard DNS server (ISSUE-0008)
- [ ] Move MoneyMatter to native arm64 images when upstream publishes them (ISSUE-0009)
