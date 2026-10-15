---
version: 0.1.0-alpha
---

# Troubleshooting

Symptoms and their usual fixes, grouped by where you notice them. When none of these fits, make a diagnostics report (Setup › **Make a diagnostics report**, or `./homelab report`): it collects doctor, status, the setup checklist, the jobs, and the logs of anything unwell, with every password and token removed, ready to share.

## The desktop app

| Symptom | Fix |
|---|---|
| macOS says the app is damaged or from an unidentified developer | The build is not signed yet: run `xattr -dr com.apple.quarantine "/Applications/Homelab Wizard.app"` once, then open it again |
| "Unknown app" in Choose stacks, or only some apps listed | The app is older than the homelab files: get the newest Homelab Wizard (GitHub › Actions › Release › the latest green run). Newer builds say *this homelab folder is newer than this copy* instead. `./homelab` in Terminal rebuilds itself and keeps working |
| "Choose the homelab folder in Setup first" | Setup › Homelab folder › **Choose…** and pick `~/Homelab` (the folder with `compose.yaml`) |
| Status says an app is **Restarting**, or shows *restarted N×* | It stops on its own and Docker starts it again. Its log (the Logs button, or `./homelab logs <app>`) says why: often a setting it needs, a full disk, or a database it cannot reach. The badge clears when the container is next recreated, for example by an update |
| Status says the container runtime is not running | Open OrbStack (`open -a OrbStack`) and turn on Settings › General › Start at login. Every app is paused until it runs |
| A button says another install or setup step is running | One change runs at a time. Wait for the panel to finish; quitting asks first while something runs |
| No menu bar icon | Open the app once; the icon starts with it and stays after the window closes. On Linux it needs a status-notifier tray |
| Recent alerts says the alert token is not set up | Setup › Alerts on the phone › **Set up the alert token** (run it again if you did it before October 2026) |

## At home

| Symptom | Fix |
|---|---|
| `photos.example.com` (or any app name) does not open on a phone or laptop | The device must use the Mac for DNS: Wi-Fi settings › DNS › `192.168.1.10`. On iPhone also turn off iCloud Private Relay and *Limit IP address tracking* for the home Wi-Fi; on Android set Private DNS to Off. Each sends names past AdGuard |
| It fails on the Mac itself | Proton VPN carries all traffic: turn it off, or turn on *Allow LAN connections* and turn off the kill switch. `./homelab doctor` warns about it |
| The browser warns about the certificate, or shows no padlock | Run **Set up the domain** (`./homelab domain setup --ssl`); the first certificate takes a few minutes. If it fails, the Cloudflare token lacks a permission: Settings › `CLOUDFLARE_API_TOKEN` › **Test** names it |
| An app works at `localhost` but not at its name | `./homelab domain setup` adds the proxy host for apps installed since it last ran |
| Everything stopped after a restart | FileVault keeps everything off until someone logs in; log in and the startup job brings the baseline back within a few minutes |
| The Mac's address changed | Reserve it again in the router; phones and the domain point at `192.168.1.10` |

## Away from home

| Symptom | Fix |
|---|---|
| A public app does not open on mobile data | Check the tunnel: Status shows Cloudflare Tunnel running, Settings › `TUNNEL_TOKEN` › **Test** passes, and `./homelab domain setup` has run since the token was added. Only apps marked public are published |
| A private app does not open away from home | That is by design. Install Tailscale to reach the whole home network privately |
| Alerts reach the phone only at home | Run `./homelab domain setup` after **Set up the alert token**: it publishes ntfy once the publishers use the token |
| Doctor or an alert says the proxy's bouncer is not pulling CrowdSec's decisions | Bans are not enforced until it does. `./homelab logs nginx-proxy-manager` shows why; for a rejected key, `./homelab compose crowdsec exec crowdsec cscli bouncers delete nginx_proxy_manager`, then `./homelab restart crowdsec` ([CrowdSec](<../services/security/CrowdSec.md>)) |
| CrowdSec blocked you | `./homelab compose crowdsec exec crowdsec cscli decisions list`, then `cscli decisions delete --ip <address>` ([Runbooks](<Runbooks.md>)) |

## Apps

| Symptom | Fix |
|---|---|
| An app is unhealthy or stopped | Status › its log icon shows the last 200 lines; the restart icon often clears it. Status lists what needs a look first |
| An app broke after the nightly update | Status › pause nightly updates, read its log, and check the app's release notes; the [update table](<Automation.md#who-updates-what>) says which images update and which are pinned |
| Vaultwarden says it needs a secure connection | Open it at `https://passwords.example.com` after the domain step, not at `localhost` |
| MoneyMatter signs in, then loops | Open it at exactly `MONEYMATTER_URL` |
| The installer moved an app's port | Something else held the port; the plan (or `./homelab plan <app>`) says which setting changed and why. On macOS, AirPlay Receiver holds 5000 and 7000; `./homelab doctor` warns about it |
| Prowlarr, Sonarr, or qBittorrent are not connected | Status › More… › **Connect apps** (or `./homelab wire --apply`); qBittorrent needs a permanent Web UI password in `QBITTORRENT_PASSWORD` |

## Backups and jobs

| Symptom | Fix |
|---|---|
| Backups shows a stale copy | The nightly job did not run or an app's dump failed: `./homelab schedule status`, then **Back up now** and read its output |
| An off-site job failed or has not run for a week | Backups › Off-site jobs shows Duplicati's error. Most often the Proton Drive folder is missing or offline ([ISSUE-0003](<Known Issues.md#issue-0003-duplicati-writing-into-the-proton-drive-folder>)) |
| **Create the backup jobs** says Duplicati does not see the folder | It recreates Duplicati for a changed `BACKUP_DESTINATION` by itself, so this means the folder is not reachable from containers: check that Proton Drive is running and the path in Settings is right, then `./homelab up` and the step again |
| Off-site jobs says to set `DUPLICATI_PASSWORD` | It is the Duplicati web UI password from `.env`; Settings › **Test** checks it |
| `schedule status` shows a job not loaded | `./homelab schedule install` again, then log out and back in ([ISSUE-0005](<Known Issues.md#issue-0005-scheduled-jobs-not-yet-run-under-launchd>)) |
| An alert says a disk is low on space | Setup › Disk space and `./homelab doctor` show each disk and what is on it; `doctor` also says how much the runtime keeps in images, volumes, and build cache, and the alert how much pruning images would free. On the homelab folder's disk, `docker image prune -a` removes images no container uses (often many GB after updates) and Status › More… › **Clean up old containers** removes leftovers; on the media disk, finished downloads and Immich's trash (Administration › Trash) are the usual culprits. The check clears on the next watchdog run once the disk has room |
| healthchecks.io says the Mac is down, but it is up | The watchdog is not running: `./homelab schedule status`, and check `HEARTBEAT_URL` with **Test** |
| An alert says to delete a plain vault export | A readable Bitwarden export is in `recovery-staging/secrets`: delete it and export again as a password-protected `.json` ([Backups](<Backups.md#password-vault-export>)) |
| Backups has no **Test a restore** button | It appears once Off-site jobs lists the Homelab AppData job with a run (named exactly that, as in [Automation](<Automation.md#duplicati-off-site-backups>)) |
| **Test a restore** fails | The log names the step. "no job named" means the job has another name: rename it, or run `./homelab restore-test --auto --job "<name>"`. On a difference, the restored files stay in `recovery-staging/restore-test` for a look; run the AppData job again in Duplicati and test again, and read Duplicati's log if it repeats |
