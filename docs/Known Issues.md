---
version: 0.16.0
---

# Known Issues

Open issues, risks, and items to verify on the Mac. Close an issue by moving it to Resolved with the date and what fixed it.

| ID | Title | Severity | Status |
|---|---|---|---|
| ISSUE-0001 | Custom proxy image not yet built on the Mac | High | Verified on Linux, to verify on the Mac |
| ISSUE-0002 | Client addresses for LAN requests through OrbStack | Low | To verify |
| ISSUE-0003 | Duplicati writing into the Proton Drive folder | High | To verify |
| ISSUE-0004 | Domain automation not yet run against the live services | Medium | Partly verified, to verify |
| ISSUE-0005 | Scheduled jobs not yet run under launchd | Medium | To verify |
| ISSUE-0006 | No alert when OrbStack itself is down | Medium | Fixed, to verify |
| ISSUE-0007 | Nothing starts after a restart until someone logs in | Medium | Accepted |
| ISSUE-0008 | With a domain, each device's DNS is set by hand | Low | Accepted |
| ISSUE-0009 | MoneyMatter runs Intel-only images under Rosetta | Low | Accepted |
| ISSUE-0010 | Immich machine learning runs on the CPU | Low | Accepted |
| ISSUE-0011 | Alerts reach the phone only on the home network | Medium | Fixed, to verify |
| ISSUE-0012 | Linux host profile not yet run on the Steam Machine | Medium | To verify |
| ISSUE-0013 | Windows host profile not yet run on the Windows PC | Medium | To verify |
| ISSUE-0014 | Release builds not yet opened on a Mac, a Windows PC, or SteamOS | Medium | Partly verified, to verify |
| ISSUE-0015 | App wiring and the menu bar item not yet run against real apps | Medium | Partly verified, to verify |
| ISSUE-0016 | Duplicati jobs, restores, and repairs through its API not yet run against the real image | High | Partly verified, to verify |
| ISSUE-0017 | Updates from the app not yet run on the Mac | Medium | To verify |
| ISSUE-0018 | Disk space readings not yet compared on the Mac | Low | To verify |
| ISSUE-0019 | A cloud drive's own quota cannot be read | Low | Accepted |
| ISSUE-0020 | Vaultwarden web vault shows a black screen in LibreWolf | Low | Accepted |
| ISSUE-0021 | Installing and updating the app on Windows and Linux not yet run everywhere | Medium | To verify |
| ISSUE-0022 | A rollback brings back the image, not the data the newer version changed | Medium | Resolved |
| ISSUE-0023 | Nextcloud's default port is the phone companion's | Low | Resolved |
| ISSUE-0024 | The homelab's own records in `data/` were not in the off-site backup | Medium | Resolved |

---

## ISSUE-0001: Custom proxy image not yet built on the Mac

The image in `dockerfiles/npm-crowdsec` follows CrowdSec's OpenResty reference build, but has not been built and run on Apple Silicon yet.

**Verify:**

1. `./homelab up` builds it; `./homelab logs nginx-proxy-manager` shows no Lua errors.
2. `./homelab compose crowdsec exec crowdsec cscli bouncers list` shows `nginx_proxy_manager` with a recent last pull.
3. Status › Protection says bans are enforced, and the ban test in [Runbooks](<Runbooks.md>) returns 403.

**Progress (October 2026):** on Linux, the nightly workflow's `proxy` job builds this image and runs it with CrowdSec: the bouncer is registered and pulling (`cscli bouncers list`, and the watchdog's check), and a banned address gets 403 through the proxy until the ban is lifted. Still to verify: the build and run on Apple Silicon.

**If it fails:** the proxy still serves traffic with the bouncer off (empty `CROWDSEC_BOUNCER_KEY`). Detection keeps working; only enforcement is missing. A bouncer that worked and then stopped (stale or revoked, often after CrowdSec restarted) is a different case: Protection's **Fix** (`./homelab fix`) reconnects it.

## ISSUE-0002: Client addresses for LAN requests through OrbStack

Requests from other LAN devices reach the proxy through OrbStack's port forwarding. Whether the proxy logs the device's real address or OrbStack's gateway address is to be confirmed.

**Impact:** low. CrowdSec never bans private addresses (its default whitelist), so LAN devices cannot be locked out either way. Tunnel traffic carries the visitor's address in `CF-Connecting-IP`, which the proxy uses.

**Verify:** open any app from a phone on Wi-Fi, then look at the address in the newest access log line:

```bash
./homelab compose nginx-proxy-manager exec nginx-proxy-manager sh -c 'tail -n 1 /data/logs/proxy-host-*_access.log'
```

## ISSUE-0003: Duplicati writing into the Proton Drive folder

Proton Drive on macOS stores its folder under `~/Library/CloudStorage` (a File Provider folder). Duplicati writes there through OrbStack's file sharing. This combination is to be verified.

**Verify:** run the Homelab Secrets job, confirm the files appear in the Proton Drive web app, then restore one file to `/staging/restore`.

**If it fails:** point `BACKUP_DESTINATION` at a plain local folder and use the Proton Drive app's folder sync, or use Duplicati's own remote destination.

## ISSUE-0004: Domain automation not yet run against the live services

Only with a domain; Home mode does not use it. `./homelab domain setup` is tested against fakes of the Nginx Proxy Manager, AdGuard Home, and Cloudflare APIs.

**Verify:** run `./homelab domain setup --dry-run`, then for real, and check each proxy host, the AdGuard rewrite, the tunnel's public hostnames, and the CNAME records in Cloudflare.

**Progress (October 2026):** the nightly workflow's `domain` job runs `domain setup example.test --dns adguard --ip 127.0.0.1 --no-tunnel` against the real Nginx Proxy Manager (the homelab's own image) and AdGuard Home. It reads each proxy host and the `*.example.test` rewrite back through their APIs, asks AdGuard's DNS for ntfy's name, and gets ntfy's health through the proxy by that name. Still to verify: everything through Cloudflare (the certificate, the tunnel's public hostnames, the CNAME records), which needs a real account.

## ISSUE-0005: Scheduled jobs not yet run under launchd

**Verify:** after `./homelab schedule install`, log out and back in, then check `./homelab schedule status` and the logs in `scripts/logs`. The next morning, confirm a new dump in `recovery-staging/databases`.

## ISSUE-0006: No alert when OrbStack itself is down

The watchdog notices that OrbStack is down, but ntfy runs inside OrbStack, so the alert cannot be delivered. The failure is written to `scripts/logs/watchdog.log`.

**Fix (0.3.0):** the watchdog pings `HEARTBEAT_URL` (healthchecks.io) every run, and `/fail` when something is down; the outside monitor alerts when the pings stop ([Monitoring](<Monitoring.md>)). **Verify:** set it up, then quit OrbStack and wait for the alert.

## ISSUE-0007: Nothing starts after a restart until someone logs in

FileVault prevents automatic login. OrbStack and the jobs run in the login session.

**Mitigation:** install macOS updates by hand, then log in straight away. The startup job brings the baseline back.

## ISSUE-0008: With a domain, each device's DNS is set by hand

Home mode (the default) is not affected: devices find the apps through Tailscale. With a domain, many ISP gateways cannot hand out a custom DNS server, so devices that do not use 192.168.1.10 cannot resolve `*.example.com` on the LAN; public apps still work through Cloudflare. On the Mac itself, Setup › **This Mac finds its apps by name** (`./homelab domain resolver --apply`) covers it, also with a VPN on.

## ISSUE-0009: MoneyMatter runs Intel-only images under Rosetta

The first start takes several minutes (the health checks allow 300 seconds). The images are pinned and left out of the nightly updates.

**Native option:** the frontend and backend build for arm64 from MoneyMatter's own Dockerfiles at the pinned commit; [its note](<../services/finance/MoneyMatter.md>) has the two build commands and the three settings that switch to them (and back). The exchange-rate service stays on Intel because its source is not public. Not yet tried on the Mac. The lasting fix is upstream publishing multi-arch images, which its release workflow already anticipates.

## ISSUE-0010: Immich machine learning runs on the CPU

Containers on macOS have no GPU. The first face and smart-search indexing of a large library takes hours; afterwards new photos are processed quickly.

## ISSUE-0011: Alerts reach the phone only on the home network

Applies with a domain; in Home mode the phone reaches ntfy over Tailscale. ntfy was LAN-only: its publishers (Duplicati, Uptime Kuma, the watchdog) use anonymous write grants, which must not be reachable from the internet. Away from home the phone cannot fetch messages.

**Fix (0.3.0):** `./homelab notify setup` gives the publishers an access token and removes the anonymous grants; ntfy is marked public, and `domain setup` publishes it only once the token exists. **Verify:** after `notify setup`, the token in Uptime Kuma and Duplicati, and `domain setup`, send `./homelab notify test` with the phone on mobile data.

---

## ISSUE-0012: Linux host profile not yet run on the Steam Machine

The Linux profile (Docker Engine, systemd user units) is tested only with fakes in CI. On SteamOS, whose root filesystem is read-only, Docker runs in the home folder as the user (`homelab runtime install`, [Host](<Host.md#steamos>)). That route was run on a Linux machine in October 2026: the downloads and their checksums, the administrator's script, Docker 29.9.2 started as an ordinary user, and Compose publishing port 80 without root; Docker's setup tool making the user service was not (no systemd for the user there).

**Verify:** on the Steam Machine, Setup › **Set up Docker for me** (or `homelab runtime install --apply`), a reboot, and `docker info` shows *rootless*; then `./homelab doctor`, `./homelab up`, then `./homelab schedule install`, `loginctl enable-linger $USER`, a reboot, and `./homelab schedule status`. MoneyMatter's Intel-only images run natively on x86, so ISSUE-0009 does not apply there.

**Also check, from the October 2026 changes that could not be run here:** as a normal user (not root), `./homelab plan adguard-home nginx-proxy-manager` keeps ports 53, 80, and 443 (only a real holder moves them); on a desktop with systemd-resolved, a new `.env` sets `ADGUARD_DNS_BIND_IP` to the machine's address and AdGuard Home starts; `doctor` reads GNOME's *Automatic suspend*; Setup's backup step offers an external drive mounted in `/media/<you>`; and Status's **Start** for a stopped Jellyfin asks for the password and starts `jellyfin.service`.

**Also check, the native feel:** in KDE's System Settings › Colors & Themes, an accent other than the default blue: the app's links, buttons, and selected sidebar item take it (after Setup › **Check again**, or reopening the app). On GNOME 47 or later, the same with Settings › Appearance › Style › Accent colour.

**Also check, KDE's look:** in desktop mode on the Steam Machine, the app looks like Plasma's own apps (System Settings, Dolphin): Noto Sans, bordered buttons, and the selected sidebar item tinted blue with a blue edge, on Breeze and Breeze Dark.

---

## ISSUE-0013: Windows host profile not yet run on the Windows PC

The Windows profile (Docker Desktop, Task Scheduler, `homelab.cmd`) is tested only with fakes and a cross-compile in CI. Expected rough edge: bind mounts from Windows folders into containers are slower than from WSL 2.

The app is a GUI program, so each command it starts (docker for Status every few seconds, git, the CLI) would get a console window of its own; they start hidden instead. The one background job, the agent (it starts the apps, keeps the PC awake on power, runs the watchdog every 15 minutes and the nightly backup), starts at sign-in from the user's Run key (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, value `homelab-agent`) through `homelab-run.exe` (installed beside the CLI, and built by `homelab.cmd`), a windowless program, so signing in shows no window; without `homelab-run.exe` it is a script in the Startup folder. Installing it removes the separate Task Scheduler jobs older versions made.

**Verify:** on the Windows PC, `homelab.cmd doctor`, `homelab.cmd up`, `homelab.cmd schedule install`, sign out and back in, then `homelab.cmd schedule status` (the agent *runs at sign-in*) and the logs. Task Manager › Startup apps lists `homelab-agent`, signing in opens no window, and Task Scheduler has no Homelab folder left from an older version.

**Also check, from the October 2026 changes:** `doctor` reads the power plan's *Sleep after* (with no console window flashing from the app); Setup's backup step offers OneDrive and the other drive letters, and leaves out Google Drive's own drive; with a domain, **This PC finds its apps by name** shows in the app and its button asks for approval once; Status's **Start** for a stopped Jellyfin starts the `JellyfinServer` service or its tray app; and an account outside `docker-users` gets the group hint, not "Docker Desktop is not running".

**Also check, the native feel:** with an accent other than blue in Settings › Personalization › Colors, the app's links, buttons, and the selected sidebar item take it on light and on dark (after **Check again** on Setup, or reopening the app).

**Also check, high contrast:** Settings › Accessibility › Contrast themes › *Night sky*, Apply: the selected screen is outlined, buttons have borders, links are the theme's link colour, and Status's dots and Setup's bars still show.

---

## ISSUE-0014: Release builds not yet opened on a Mac, a Windows PC, or SteamOS

`release.yml` runs green without secrets and builds, for each platform, the app with its tray and the `homelab` CLI: the macOS universal DMG (signed ad hoc), the Windows installer (x64 and ARM64) and portable zips, the Linux .deb, .rpm, Arch package, and tarball, and an AppImage for SteamOS. The AppImage carries WebKitGTK; each run starts it with the system's copy moved away and checks the window comes up on its own (a screenshot is kept with the run).

Still unproven: opening each on its real machine (step 2 of [Testing](<Testing.md>) for the Mac), and signing, notarization, and the signed installer rebuild, which run once the secrets are added (docs/Releasing.md). The AppImage is built on Ubuntu 22.04, so it needs that release's glibc (2.35) or newer: `ldd --version` on the Steam Machine shows its own.

**Verify:** on the Mac, the DMG as in Testing step 2. On the Steam Machine (desktop mode), download the AppImage, `chmod +x Homelab-Wizard-x86_64.AppImage`, open it, check Settings › This machine shows the machine and the tray icon appears; with the homelab folder chosen, **Install the jobs** and confirm `systemctl --user list-timers` points at `bin/homelab` in the folder. On a Windows PC, run the installer and check `homelab.exe` sits beside the app in its folder.

**Progress (October 2026):** every run of `release.yml` now opens what it built on that system's runner, and keeps a screenshot: the DMG mounted, the app dragged to Applications and started (macOS 14); the installer run silently and the app started with its window, the CLI beside it (Windows Server 2022); the AppImage started without the system's WebKitGTK (Ubuntu 22.04). Still to verify: each on a real machine, with a person's account and screen, and the signed builds.

---

## ISSUE-0015: App wiring and the menu bar item not yet run against real apps

`homelab wire` is tested against fake Prowlarr and Sonarr APIs only; the field names it fills come from each app's own templates, but a version that renames one fails that link with a clear message. The macOS menu bar helper (Objective-C for hiding its Dock icon) has not been compiled yet; the release workflow is the first place it builds.

**Verify:** install `@arr` and qBittorrent with "Connect the apps for me", set `QBITTORRENT_PASSWORD`, run `homelab wire --apply` again, and check Prowlarr › Settings › Apps and Sonarr › Settings › Download Clients. On each machine, check the menu bar or tray item appears once, its links open, and Back up now writes a new dump.

**Progress (October 2026):** the nightly workflow's `wire` job runs `homelab wire --apply` against the real Prowlarr, Sonarr, Radarr, Lidarr, and FlareSolverr: Prowlarr's own API then lists Sonarr, Radarr, and Lidarr as applications at their container addresses and FlareSolverr as its indexer proxy, and a second run finds each link already made. Still to verify: qBittorrent as each app's download client (it waits for Gluetun's VPN key, which needs an account), the menu bar or tray item on each machine.

## ISSUE-0016: Duplicati jobs, restores, and repairs through its API not yet run against the real image

`homelab duplicati setup` creates jobs (`POST /api/v1/backups`), runs and repairs them, and sets the alert URL as a default option (`PATCH /api/v1/serversettings`). `restore-test --auto` restores a sample, and Backups reads each job's next run from the proposed schedule in `/api/v1/serverstate`. All of this was written against Duplicati's current source and tested against fakes. The image is `lscr.io/linuxserver/duplicati:latest`, which may be an older 2.1 release with small API differences. A refused request fails with Duplicati's own message. Each job is created whole or not at all, and running the step again creates only the jobs still missing.

**Verify:** Setup › **Create the backup jobs**: Duplicati's UI lists the jobs with the right sources, the `/destination/<folder>` targets, AES, and smart retention; Settings › Default options shows `send-http-url`; the first runs finish (Backups › Off-site jobs), and each job shows "next in N hours" matching Duplicati's own *Next scheduled task*. Then Backups › **Test a restore** passes and its tile says how long it took.

**Progress (October 2026):** the nightly run against real Docker (`lscr.io/linuxserver/duplicati:latest`) now does most of this. It gives Duplicati a backup folder and runs `duplicati setup --apply`, then reads each job back through Duplicati's own API: its sources, its `/destination/<folder>` target, AES, smart retention, and its schedule. It checks that `send-http-url` is a default option once the alert token exists, and that Backups (`homelab duplicati jobs`) knows each job's next run. Once Homelab AppData's first run finishes, `restore-test --auto` restores a sample and passes. After the move, the run plays a new machine: the jobs are taken out of Duplicati (their backups stay), `duplicati setup --apply` makes them again and rebuilds each one's database from its backup, and Homelab AppData then backs up into its old folder without an error. Beside it, the nightly `rebuild` job runs every job into a folder, wipes the homelab, and restores each one from its backup files alone with Duplicati's own command line (`homelab rebuild`), then makes the jobs again from their backups. Still to verify: the same on the Mac with Proton Drive (ISSUE-0003).

## ISSUE-0017: Updates from the app not yet run on the Mac

**Update now** (the line at the top of the window) moves the homelab files forward, then on a Mac downloads the newest Homelab Wizard (the latest build, or the newest `v*` release with `UPDATE_CHANNEL=stable`), checks it against GitHub's SHA-256 checksum, replaces the running app, and opens it again. For a git checkout, the update check runs `git fetch` as the user, with prompts turned off (`GIT_TERMINAL_PROMPT=0`, `ssh -o BatchMode=yes`), and moving forward is `git pull --ff-only` followed by `up`. An app opened from Finder relies on the macOS SSH agent (or the keychain) for the GitHub key; without it the check says GitHub could not be reached and uses the last fetch. A folder the app made (**Set it up for me**) moves forward from the files inside the newer app instead.

**Verify:** within 15 minutes of a build of a merged change (or on bringing the window forward), the line at the top says the update is ready, with no **Check again**; **Update now** brings the files in and runs `up`, then replaces the app and opens the new one, which says *Updated to …*; the menu bar's *Update to …* goes away. When only the app is behind, **Update now** does the app alone. With a build from the release workflow, the version row shows `build <commit>`.

## ISSUE-0018: Disk space readings not yet compared on the Mac

Settings › This Mac › Storage, `homelab doctor`, and the watchdog read free space with `statfs`, as `df` does: the space free right now. Finder's *Available* also counts purgeable space (caches and iCloud copies macOS deletes when room is needed), so on the Mac the homelab's number can be lower than Finder's, and a disk could read low while Finder still shows room. That errs on the side of warning early. On Windows the reading comes from `GetDiskFreeSpaceEx`. Disks are grouped by device, so folders on the Mac's disk (the homelab folder, the Proton Drive folder) share one line, and the media drive gets its own.

**Verify:** Settings › This Mac › Storage shows two lines, the Mac's disk and the media drive, with free space matching `df -h ~ /Volumes/Media`. With the drive unplugged, its line goes away instead of showing the Mac's disk under its name.

## ISSUE-0019: A cloud drive's own quota cannot be read

The watchdog, `doctor`, and Settings › This Mac › Storage read the free space on the disk that holds `BACKUP_DESTINATION`. A cloud drive's folder (Proton Drive, iCloud Drive, and the like) sits on the Mac's own disk, and the account's storage limit is not visible from the Mac, so a full cloud account is not warned about ahead of time. The off-site jobs then fail, and the watchdog alerts once a job fails or has not succeeded for a week.

**Mitigation:** check the space left in the cloud drive's own app or website now and then (the monthly checks in [Monitoring](<Monitoring.md#daily-and-weekly-checks>)).

## ISSUE-0020: Vaultwarden web vault shows a black screen in LibreWolf

In LibreWolf, Vaultwarden's web vault can load as a black screen. The server and the Bitwarden apps are not affected.

**Workaround:** open the web vault in Safari or another browser.

---

## ISSUE-0021: Installing and updating the app on Windows and Linux not yet run everywhere

`install.sh` was run on Ubuntu 24.04: it installed the .deb with apt, and with `HOMELAB_APPIMAGE=1` put the AppImage in `~/Applications`. The self-update code (`Stage` and `Swap`, run from a test harness) replaced an AppImage with the live release's. The silent installer runs on the Windows runner in every `release.yml` run (ISSUE-0014's progress). Still unproven: `install.ps1` on Windows (the agent and tray stopped and started again around the installer), the portable zip's update, a package update through pkexec, and the .rpm and Arch package paths.

Found on a Windows PC (October 2026): updating went round in a loop (the app closed, opened again, still the old version), because SmartScreen or Smart App Control blocked the unsigned installer the update ran as an administrator. Since then the update unpacks the new files with Windows' own PowerShell, as an administrator only when the app is in Program Files, and a build that does not go in place says why when the app opens again instead of offering the same update. Each attempt's steps are in `%LOCALAPPDATA%\Homelab Wizard\update.log`. A PC already in the loop needs this build installed by hand once ([Upgrading](<Upgrading.md>)).

**Verify:** on Windows, run `irm https://raw.githubusercontent.com/Snooper42/homelab-wizard/main/install.ps1 | iex`; the app opens, and after the next change to main the line's **Update now** brings the new build (one approval prompt for Program Files, and no SmartScreen), with the tray item and `homelab-agent` running again after, and `update.log` ending with `done` (Testing W21, W22). On Fedora or Arch, `install.sh`, then the same update from the line (pkexec asks for the password).

---

## ISSUE-0022: A rollback brings back the image, not the data the newer version changed

Found by the nightly run against real Docker (October 2026). `homelab rollback` (and the watchdog's automatic rollback of an update that leaves an app unwell) starts the image the app ran before its update, on the data as it is now. An app that changes its own data when a newer version starts (a database schema moved on) can then refuse it: ntfy 2.11 rolled back from 2.34 stopped with "unexpected schema version: version 17 is higher than current version 13" and restarted in a loop. The update dumps the app's databases first, but the rollback does not put them back, and not every file an app migrates is dumped (ntfy's message cache is not).

**Workaround:** restore the dump the update took (`recovery-staging/databases/<app>`, the newest before the update's time) as [Disaster Recovery](<Disaster Recovery.md>) describes for that app, or update again (`homelab updates release <app>`, then `homelab update <app>`).

**Progress (October 2026):** `homelab update` now stops each app whose image changed, copies its folders and named volumes and keeps its dumps (`recovery-staging/before-update`), then starts the new image; `homelab rollback` sets today's data aside and puts that copy back with the earlier image. The watchdog's rollback puts the copy back by itself only when the app was never well after the update; otherwise it keeps today's data and its alert names `homelab rollback <app> --data`. Resolved: the nightly updates are run by the agent (`homelab update --all --nightly`), so they are copied too, and Watchtower is gone. The nightly run now proves it across a schema change: it starts on ntfy v2.25.0 (its cache database at schema 15, its users at 8), which refuses the newer ntfy's migrated databases; after the update to the newest (17 and 9), both `homelab rollback` and the watchdog put it back on v2.25.0 with its data from before, and its tokens from then still publish and read.

**Fix (decided in [ADR-0020](<Decisions.md#adr-0020-a-rollback-puts-back-the-apps-data-with-its-image>), October 2026; [Roadmap](<Roadmap.md#10-stable>)):** before an update, keep a copy of the app's data folders and named volumes as well as its dumps, and have the rollback put that copy back with the older image. Large data (photo libraries, media) stays where it is; the apps that keep those (Immich) keep their schema in the database, which the dump covers. `homelab update` and `homelab rollback` do this since 0.13.0 (Progress, above), and since Watchtower went the nightly updates are `homelab update --all --nightly`, so they do it too.

---

---

## Resolved

- [ISSUE-0022](<#issue-0022-a-rollback-brings-back-the-image-not-the-data-the-newer-version-changed>), after 0.14.0: every update, the nightly ones included, copies the app's data first, and a rollback puts it back.

### ISSUE-0023: Nextcloud's default port is the phone companion's

`NEXTCLOUD_PORT` defaulted to 8099, the port the phone companion (`homelab serve`) always listens on, so Nextcloud could take it while the companion was not running.

**Fixed (October 2026):** the install plan never hands a container the fixed port of an app that runs on the machine itself (the phone companion's 8099, Jellyfin's 8096), whether or not that app runs now; a `.env` that still says 8099 gets Nextcloud moved to a free port, and says why. A new `.env` starts Nextcloud on 8089. Jellyfin in a container still takes 8096, the port it stands in for.

### ISSUE-0024: The homelab's own records in `data/` were not in the off-site backup

Duplicati's jobs read `data/appdata`, not the files beside it in `data/`: the household (`people.json` and the welcome pages), the paired phones (`phones.json`), the apps' single sign-on settings (`data/sso`), the update history, Setup's ticked steps, and the savings history. A rebuild from the backups lost them.

**Fixed (October 2026):** the nightly backup copies `data/*.json`, `data/people`, and `data/sso` into `recovery-staging/secrets/data`, which the encrypted Homelab Secrets job takes off-site with `.env`. A restore puts them back with `.env` ([Disaster Recovery](<Disaster Recovery.md#scenario-full-mac-rebuild>), step 3).
