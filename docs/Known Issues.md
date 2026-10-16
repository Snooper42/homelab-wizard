---
version: 0.1.0-alpha
---

# Known Issues

Open issues, risks, and items to verify on the Mac. Close an issue by moving it to Resolved with the date and what fixed it.

| ID | Title | Severity | Status |
|---|---|---|---|
| ISSUE-0001 | Custom proxy image not yet built on the Mac | High | To verify |
| ISSUE-0002 | Client addresses for LAN requests through OrbStack | Low | To verify |
| ISSUE-0003 | Duplicati writing into the Proton Drive folder | High | To verify |
| ISSUE-0004 | Domain automation not yet run against the live services | Medium | To verify |
| ISSUE-0005 | Scheduled jobs not yet run under launchd | Medium | To verify |
| ISSUE-0006 | No alert when OrbStack itself is down | Medium | Fixed, to verify |
| ISSUE-0007 | Nothing starts after a restart until someone logs in | Medium | Accepted |
| ISSUE-0008 | With a domain, each device's DNS is set by hand | Low | Accepted |
| ISSUE-0009 | MoneyMatter runs Intel-only images under Rosetta | Low | Accepted |
| ISSUE-0010 | Immich machine learning runs on the CPU | Low | Accepted |
| ISSUE-0011 | Alerts reach the phone only on the home network | Medium | Fixed, to verify |
| ISSUE-0012 | Linux host profile not yet run on the Steam Machine | Medium | To verify |
| ISSUE-0013 | Windows host profile not yet run on the Windows PC | Medium | To verify |
| ISSUE-0014 | Release builds not yet opened on a Mac, a Windows PC, or SteamOS | Medium | To verify |
| ISSUE-0015 | App wiring and the menu bar item not yet run against real apps | Medium | To verify |
| ISSUE-0016 | Duplicati jobs, restores, and repairs through its API not yet run against the real image | High | To verify |
| ISSUE-0017 | Updates from the app not yet run on the Mac | Medium | To verify |
| ISSUE-0018 | Disk space readings not yet compared on the Mac | Low | To verify |
| ISSUE-0019 | A cloud drive's own quota cannot be read | Low | Accepted |
| ISSUE-0020 | Vaultwarden web vault shows a black screen in LibreWolf | Low | Accepted |

---

## ISSUE-0001: Custom proxy image not yet built on the Mac

The image in `dockerfiles/npm-crowdsec` follows CrowdSec's OpenResty reference build, but has not been built and run on Apple Silicon yet.

**Verify:**

1. `./homelab up` builds it; `./homelab logs nginx-proxy-manager` shows no Lua errors.
2. `./homelab compose crowdsec exec crowdsec cscli bouncers list` shows `nginx_proxy_manager` with a recent last pull.
3. Status › Protection says bans are enforced, and the ban test in [Runbooks](<Runbooks.md>) returns 403.

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

The first start takes several minutes (the health checks allow 300 seconds). The images are pinned and excluded from Watchtower.

**Native option:** the frontend and backend build for arm64 from MoneyMatter's own Dockerfiles at the pinned commit; [its note](<../services/finance/MoneyMatter.md>) has the two build commands and the three settings that switch to them (and back). The exchange-rate service stays on Intel because its source is not public. Not yet tried on the Mac. The lasting fix is upstream publishing multi-arch images, which its release workflow already anticipates.

## ISSUE-0010: Immich machine learning runs on the CPU

Containers on macOS have no GPU. The first face and smart-search indexing of a large library takes hours; afterwards new photos are processed quickly.

## ISSUE-0011: Alerts reach the phone only on the home network

Applies with a domain; in Home mode the phone reaches ntfy over Tailscale. ntfy was LAN-only: its publishers (Watchtower, Duplicati, Uptime Kuma, the watchdog) use anonymous write grants, which must not be reachable from the internet. Away from home the phone cannot fetch messages.

**Fix (0.3.0):** `./homelab notify setup` gives the publishers an access token and removes the anonymous grants; ntfy is marked public, and `domain setup` publishes it only once the token exists. **Verify:** after `notify setup`, the token in Uptime Kuma and Duplicati, and `domain setup`, send `./homelab notify test` with the phone on mobile data.

---

## ISSUE-0012: Linux host profile not yet run on the Steam Machine

The Linux profile (Docker Engine, systemd user units) is tested only with fakes in CI. SteamOS keeps its root filesystem read-only, so installing Docker Engine there may need the root filesystem unlocked (and redone after SteamOS updates) or a different install route.

**Verify:** on the Steam Machine, `./homelab doctor`, `./homelab up`, then `./homelab schedule install`, `loginctl enable-linger $USER`, a reboot, and `./homelab schedule status`. MoneyMatter's Intel-only images run natively on x86, so ISSUE-0009 does not apply there.

---

## ISSUE-0013: Windows host profile not yet run on the Windows PC

The Windows profile (Docker Desktop, Task Scheduler, `homelab.cmd`) is tested only with fakes and a cross-compile in CI. Expected rough edges: `schedule status` reads English `schtasks` output only; bind mounts from Windows folders into containers are slower than from WSL 2.

The app is a GUI program, so each command it starts (docker for Status every few seconds, git, schtasks, the CLI) would get a console window of its own; they start hidden instead. Scheduled tasks start their job through `homelab-run.exe` (installed beside the CLI by the installer, and built by `homelab.cmd`), a windowless program, so the watchdog does not flash a console window every 15 minutes. The at-sign-in job then starts from the user's Run key (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, value `homelab-startup`) through the same program, so sign-in shows no window either; without `homelab-run.exe` it stays a script in the Startup folder.

**Verify:** on the Windows PC, `homelab.cmd doctor`, `homelab.cmd up`, `homelab.cmd schedule install`, sign out and back in, then `homelab.cmd schedule status` and the logs. Task Scheduler › Homelab › watchdog › Actions shows `homelab-run.exe` with the job's script, and no window appears when it runs; Task Manager › Startup apps lists `homelab-startup`, and signing in opens no window.

---

## ISSUE-0014: Release builds not yet opened on a Mac, a Windows PC, or SteamOS

`release.yml` runs green without secrets and builds, for each platform, the app with its tray and the `homelab` CLI: the macOS universal DMG (signed ad hoc), the Windows installer (x64 and ARM64) and portable zips, the Linux .deb, .rpm, Arch package, and tarball, and an AppImage for SteamOS. The AppImage carries WebKitGTK; each run starts it with the system's copy moved away and checks the window comes up on its own (a screenshot is kept with the run).

Still unproven: opening each on its real machine (step 2 of [Testing](<Testing.md>) for the Mac), and signing, notarization, and the signed installer rebuild, which run once the secrets are added (docs/Releasing.md). The AppImage is built on Ubuntu 22.04, so it needs that release's glibc (2.35) or newer: `ldd --version` on the Steam Machine shows its own.

**Verify:** on the Mac, the DMG as in Testing step 2. On the Steam Machine (desktop mode), download the AppImage, `chmod +x Homelab-Wizard-x86_64.AppImage`, open it, check Setup shows the machine and the tray icon appears; with the homelab folder chosen, **Install the jobs** and confirm `systemctl --user list-timers` points at `bin/homelab` in the folder. On a Windows PC, run the installer and check `homelab.exe` sits beside the app in its folder.

---

## ISSUE-0015: App wiring and the menu bar item not yet run against real apps

`homelab wire` is tested against fake Prowlarr and Sonarr APIs only; the field names it fills come from each app's own templates, but a version that renames one fails that link with a clear message. The macOS menu bar helper (Objective-C for hiding its Dock icon) has not been compiled yet; the release workflow is the first place it builds.

**Verify:** install `@arr` and qBittorrent with "Connect the apps for me", set `QBITTORRENT_PASSWORD`, run `homelab wire --apply` again, and check Prowlarr > Settings > Apps and Sonarr > Settings > Download Clients. On each machine, check the menu bar or tray item appears once, its links open, and Back up now writes a new dump.

## ISSUE-0016: Duplicati jobs, restores, and repairs through its API not yet run against the real image

`homelab duplicati setup` creates jobs (`POST /api/v1/backups`), runs and repairs them, and sets the alert URL as a default option (`PATCH /api/v1/serversettings`). `restore-test --auto` restores a sample, and Backups reads each job's next run from the proposed schedule in `/api/v1/serverstate`. All of this was written against Duplicati's current source and tested against fakes. The image is `lscr.io/linuxserver/duplicati:latest`, which may be an older 2.1 release with small API differences. A refused request fails with Duplicati's own message. Each job is created whole or not at all, and running the step again creates only the jobs still missing.

**Verify:** Setup › **Create the backup jobs**: Duplicati's UI lists the jobs with the right sources, the `/destination/<folder>` targets, AES, and smart retention; Settings › Default options shows `send-http-url`; the first runs finish (Backups › Off-site jobs), and each job shows "next in N hours" matching Duplicati's own *Next scheduled task*. Then Backups › **Test a restore** passes and its tile says how long it took.

## ISSUE-0017: Updates from the app not yet run on the Mac

Setup › **Update** moves the homelab files forward, then on a Mac downloads the newest Homelab Wizard (the Nightly release, or the newest `v*` release with `UPDATE_CHANNEL=stable`), checks it against GitHub's SHA-256 checksum, replaces the running app, and opens it again. For a git checkout, the update check runs `git fetch` as the user, with prompts turned off (`GIT_TERMINAL_PROMPT=0`, `ssh -o BatchMode=yes`), and moving forward is `git pull --ff-only` followed by `up`. An app opened from Finder relies on the macOS SSH agent (or the keychain) for the GitHub key; without it the check says GitHub could not be reached and uses the last fetch. A folder the app made (**Set it up for me**) moves forward from the files inside the newer app instead.

**Verify:** after a change is merged, Setup shows "1 new change" with its title; **Update** brings it in and runs `up`, then replaces the app and opens the new one; the sidebar's **Update ready** and the menu bar's *Update ready* go away. When only the app is behind, **Update now** does the app alone. With a build from the release workflow, the version row shows `build <commit>`.

## ISSUE-0018: Disk space readings not yet compared on the Mac

Setup › Disk space, `homelab doctor`, and the watchdog read free space with `statfs`, as `df` does: the space free right now. Finder's *Available* also counts purgeable space (caches and iCloud copies macOS deletes when room is needed), so on the Mac the homelab's number can be lower than Finder's, and a disk could read low while Finder still shows room. That errs on the side of warning early. On Windows the reading comes from `GetDiskFreeSpaceEx`. Disks are grouped by device, so folders on the Mac's disk (the homelab folder, the Proton Drive folder) share one line, and the media drive gets its own.

**Verify:** Setup › Disk space shows two lines, the Mac's disk and the media drive, with free space matching `df -h ~ /Volumes/Media`. With the drive unplugged, its line goes away instead of showing the Mac's disk under its name.

## ISSUE-0019: A cloud drive's own quota cannot be read

The watchdog, `doctor`, and Setup › Disk space read the free space on the disk that holds `BACKUP_DESTINATION`. A cloud drive's folder (Proton Drive, iCloud Drive, and the like) sits on the Mac's own disk, and the account's storage limit is not visible from the Mac, so a full cloud account is not warned about ahead of time. The off-site jobs then fail, and the watchdog alerts once a job fails or has not succeeded for a week.

**Mitigation:** check the space left in the cloud drive's own app or website now and then (the monthly checks in [Monitoring](<Monitoring.md#daily-and-weekly-checks>)).

## ISSUE-0020: Vaultwarden web vault shows a black screen in LibreWolf

In LibreWolf, Vaultwarden's web vault can load as a black screen. The server and the Bitwarden apps are not affected.

**Workaround:** open the web vault in Safari or another browser.

---

## Resolved

None yet.
