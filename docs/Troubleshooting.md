---
version: 0.12.0
---

# Troubleshooting

Symptoms and their usual fixes, grouped by where you notice them. When none of these fits, make a diagnostics report (Setup › **Make a diagnostics report**, or `./homelab report`): it collects doctor, status, the setup checklist, the jobs, and the logs of anything unwell, with every password and token removed and your home folder, account name, and email addresses replaced, ready to share. Read it through before you send it.

Many problems are fixed by **Fix it** on Status (`./homelab fix`): it shows what it will do first.

An app's log usually says why it is unwell. With [Ollama](<../services/documents/Open WebUI.md>) and a model on this machine (`ollama pull llama3.2`), **Explain this log** in its Logs panel (or `./homelab logs <app> --explain`) has the model read the last 200 lines and say what is wrong, the likely cause, and what to try. The log stays on this machine, and what looks like a password or token is removed before the model reads it. A small model can be wrong: the line it quotes is in the log below to check.

## The desktop app

| Symptom | Fix |
|---|---|
| macOS says the app is damaged or from an unidentified developer | The app is not signed with an Apple Developer ID, and macOS blocks unsigned apps downloaded in a browser: run `xattr -dr com.apple.quarantine "/Applications/Homelab Wizard.app"` once, then open it again. Installing with `install.sh` (README › Get started) avoids this |
| "Unknown app" in Choose stacks, or only some apps listed | The app is older than the homelab files: Setup › **Update** (it downloads the newest build, checks it, replaces the app, and opens it again, on every system). Newer builds say *this homelab folder is newer than this copy* instead. `./homelab` in Terminal keeps working meanwhile |
| Status is slow to load | `./homelab status --timing` says which part takes the time (the runtime, the containers, the apps' pages, the settings check, or `docker stats`); Setup › **Make a diagnostics report** includes the same. Each `docker` command costs more with Docker Desktop on Windows than with OrbStack on a Mac |
| "Choose the homelab folder in Setup first" | Setup › Homelab folder › **Choose…** and pick `~/Homelab` (the folder with `compose.yaml`) |
| Status says an app is **Restarting**, or shows *restarted N×* | It stops on its own and Docker starts it again. Its log (the Logs button, or `./homelab logs <app>`) says why: often a setting it needs, a full disk, or a database it cannot reach. The badge clears when the container is next recreated, for example by an update |
| Status says the container runtime is not running | Open OrbStack (`open -a OrbStack`) and turn on Settings › General › Start at login. Every app is paused until it runs |
| A button says another install or setup step is running | One change runs at a time. Wait for the panel to finish; quitting asks first while something runs |
| No menu bar icon | Open the app once; the icon starts with it and stays after the window closes. On Linux it needs a status-notifier tray |
| Recent alerts says the alert token is not set up | Setup › Alerts on the phone › **Set up the alert token** (run it again if you did it before October 2026) |

## At home

| Symptom | Fix |
|---|---|
| Tailscale keeps restarting, or its sign-in link stops working | An older homelab folder: Tailscale gave up on the sign-in after a minute and restarted with a new link. Update (Setup › **Check again**), then `./homelab tailnet login` (or Setup › **Addresses on your tailnet**): it now waits up to 30 minutes |
| An app's tailnet address does not open (Home mode) | The phone or computer needs the Tailscale app, on and signed in to the same account, the homelab's own machine too: its Tailscale runs inside the homelab, apart from the machine (Setup › *This machine opens the tailnet addresses*; until then its `localhost` addresses work there). On this machine, Setup › **Addresses on your tailnet** must be done: if Tailscale waits for a sign-in, the step (or `./homelab tailnet login`) opens its sign-in page; no auth key is needed. HTTPS Certificates must be on in the Tailscale admin console › DNS |
| *With a domain:* `photos.example.com` (or any app name) does not open on a phone or laptop | The device must use the Mac for DNS: Wi-Fi settings › DNS › `192.168.1.10`. On iPhone also turn off iCloud Private Relay and *Limit IP address tracking* for the home Wi-Fi; on Android set Private DNS to Off. Each sends names past AdGuard |
| *With a domain:* app names do not open on the Mac with a VPN on (or at all on the Mac) | Setup › **This Mac finds its apps by name** (`./homelab domain resolver --apply`) writes `/etc/resolver/<domain>`, so the Mac asks AdGuard Home for every name under the domain whatever DNS the VPN sets. It asks for the Mac's password once. A VPN with a kill switch can still block the home network: turn on *Allow LAN connections* and turn off the kill switch |
| *With a domain:* the browser warns about the certificate, or shows no padlock | Run **Set up the domain** (`./homelab domain setup --ssl`); the first certificate takes a few minutes. If it fails, the Cloudflare token lacks a permission: Settings › `CLOUDFLARE_API_TOKEN` › **Test** names it |
| *With a domain:* an app works at `localhost` but not at its name | `./homelab domain setup` adds the proxy host for apps installed since it last ran |
| Everything stopped after a restart | FileVault keeps everything off until someone logs in; log in and the startup job brings the baseline back within a few minutes |
| The Mac's address changed | Reserve it again in the router; phones (and, with a domain, the app names) point at `192.168.1.10` |

## Away from home

| Symptom | Fix |
|---|---|
| An app does not open away from home (Home mode) | Turn Tailscale on in the phone; the apps open at their tailnet addresses anywhere. Nothing is published to the internet |
| *With a domain:* a public app does not open on mobile data | Check the tunnel: Status shows Cloudflare Tunnel running, Settings › `TUNNEL_TOKEN` › **Test** passes, and `./homelab domain setup` has run since the token was added. Only apps marked public are published |
| *With a domain:* a private app does not open away from home | That is by design. Turn on Tailscale to reach it privately |
| Alerts reach the phone only at home | Home mode: turn Tailscale on in the phone. *With a domain:* run `./homelab domain setup` after **Set up the alert token**: it publishes ntfy once the publishers use the token |
| Status › Protection says bans are not enforced (or doctor or an alert says the proxy's bouncer is not pulling) | Click **Fix** on the Protection card (or **Fix it**, or `./homelab fix`): it removes the old bouncer, restarts CrowdSec, and restarts the proxy. If it comes back, `./homelab logs nginx-proxy-manager` shows why ([CrowdSec](<../services/security/CrowdSec.md>)) |
| CrowdSec blocked you | `./homelab compose crowdsec exec crowdsec cscli decisions list`, then `cscli decisions delete --ip <address>` ([Runbooks](<Runbooks.md>)) |

## Apps

| Symptom | Fix |
|---|---|
| AdGuard Home does not start on Linux: *bind 0.0.0.0:53: address already in use*, or on Windows: *listen udp4 0.0.0.0:53: bind: Only one usage of each socket address* | Something already holds port 53. On Linux, systemd-resolved (`127.0.0.53:53`): installing again fixes it, since the homelab sets `ADGUARD_DNS_BIND_IP` (Settings › AdGuard Home DNS listens on) to this machine's home-network address, where port 53 is free (by hand: the address `homelab doctor` names, then `homelab install adguard-home`). On Windows, Internet Connection Sharing (`SharedAccess`, the Mobile hotspot service) holds `0.0.0.0:53`, and Docker Desktop binds DNS there even with `ADGUARD_DNS_BIND_IP` set (seen on a Windows 11 PC): in PowerShell as administrator, `Set-Service SharedAccess -StartupType Disabled`, restart the PC, then `homelab install adguard-home`. Mobile hotspot stops working until you set it back to `Manual` |
| On Fedora (or another Linux with SELinux), apps stop with *Permission denied* on their folders | Fedora's Docker (`moby-engine`) gives containers SELinux labels, which keep them out of folders in your home folder; `./homelab doctor` warns about it. Turn Docker's SELinux option off (`--selinux-enabled` in `/etc/sysconfig/docker`, or `"selinux-enabled"` in `/etc/docker/daemon.json`) and restart Docker, or use Docker CE from docker.com, which runs without it |
| *This account may not use Docker Engine yet* (*Docker Desktop* on Windows) | Docker runs, but your account is not allowed to use it. On Linux: `sudo usermod -aG docker $USER`, then log out and back in. On Windows, as an administrator: `net localgroup docker-users %USERNAME% /add`, then sign out and back in |
| Installing stops with *Docker Hub's download limit … was reached* (Docker's own words: *429 Too Many Requests* or *toomanyrequests*) | Docker Hub limits how many images one internet connection downloads without an account. Wait an hour and press **Install** again (or `./homelab up` again): what already downloaded is kept. To lift the limit, make a free account at hub.docker.com and run `docker login` once |
| An app is unhealthy or stopped | Status › its log icon shows the last 200 lines; the restart icon often clears it. Status lists what needs a look first |
| An app broke after the nightly update | Status › pause nightly updates, read its log, and check the app's release notes; the [update table](<Automation.md#who-updates-what>) says which images update and which are pinned |
| Vaultwarden says it needs a secure connection | Open it at its https address from Status (its tailnet address in Home mode, `https://passwords.example.com` with a domain), not by IP |
| Vaultwarden's web vault shows a black screen | Seen in LibreWolf ([ISSUE-0020](<Known Issues.md#issue-0020-vaultwarden-web-vault-shows-a-black-screen-in-librewolf>)): use Safari or another browser |
| MoneyMatter signs in, then loops | Open it at exactly `MONEYMATTER_URL` |
| The installer moved an app's port | Something else held the port; the plan (or `./homelab plan <app>`) says which setting changed and why. On macOS, AirPlay Receiver holds 5000 and 7000; `./homelab doctor` warns about it |
| Prowlarr, Sonarr, or qBittorrent are not connected | Status › More… › **Connect apps** (or `./homelab wire --apply`); qBittorrent needs a permanent Web UI password in `QBITTORRENT_PASSWORD` |

## Backups and jobs

| Symptom | Fix |
|---|---|
| Backups shows a stale copy | The nightly job did not run or an app's dump failed: `./homelab schedule status`, then **Back up now** and read its output |
| An off-site job failed or has not run for a week | Backups › Off-site jobs shows Duplicati's error. Most often the backup folder is missing or offline: the cloud drive's app is not running, or the drive is unplugged ([ISSUE-0003](<Known Issues.md#issue-0003-duplicati-writing-into-the-proton-drive-folder>)) |
| Off-site jobs fail after months of working | The cloud drive may be full: its quota cannot be read from this machine ([ISSUE-0019](<Known Issues.md#issue-0019-a-cloud-drives-own-quota-cannot-be-read>)), so check the space left in the drive's own app |
| **Create the backup jobs** says Duplicati does not see the folder | It recreates Duplicati for a changed `BACKUP_DESTINATION` by itself, so this means the folder is not reachable from containers: check that the cloud drive's app is running (or the drive plugged in) and the path in Settings is right, then `./homelab up` and the step again |
| Off-site jobs says to set `DUPLICATI_PASSWORD` | It is the Duplicati web UI password from `.env`; Settings › **Test** checks it |
| `schedule status` shows a job not loaded | `./homelab schedule install` again, then log out and back in ([ISSUE-0005](<Known Issues.md#issue-0005-scheduled-jobs-not-yet-run-under-launchd>)) |
| An alert says a disk is low on space | Setup › Disk space and `./homelab doctor` show each disk and what is on it; `doctor` also says how much the runtime keeps in images, volumes, and build cache, and the alert how much pruning images would free. On the homelab folder's disk, `docker image prune -a` removes images no container uses (often many GB after updates) and Status › More… › **Clean up old containers** removes leftovers; on the media disk, finished downloads and Immich's trash (Administration › Trash) are the usual culprits. The check clears on the next watchdog run once the disk has room |
| healthchecks.io says the Mac is down, but it is up | The watchdog is not running: `./homelab schedule status`, and check `HEARTBEAT_URL` with **Test** |
| An alert says to delete a plain vault export | A readable Bitwarden export is in `recovery-staging/secrets`: delete it and export again as a password-protected `.json` ([Backups](<Backups.md#password-vault-export>)) |
| Backups has no **Test a restore** button | It appears once Off-site jobs lists the Homelab AppData job with a run (named exactly that, as in [Automation](<Automation.md#duplicati-off-site-backups>)) |
| **Test a restore** fails | The log names the step. "no job named" means the job has another name: rename it, or run `./homelab restore-test --auto --job "<name>"`. On a difference, the restored files stay in `recovery-staging/restore-test` for a look; run the AppData job again in Duplicati and test again, and read Duplicati's log if it repeats |

## "homelab can run in the background" notices

macOS announces each login item when it is added or changes. The homelab has one: its background agent (starting the apps at login, the nightly backup, the watchdog, the phone companion, keeping awake, and the menu bar item). Older versions installed six, which the app replaces with the one agent the first time it opens. It is listed in System Settings › General › Login Items & Extensions; Setup › Runs in the background › *What are these?* says what each one does, and **Turn the scheduled jobs off** removes them (the apps keep running, but nothing starts them after a restart, backs them up, or watches them; Setup offers to put them back). Until the builds are signed with a Developer ID, an app update can make macOS announce them once more, because each unsigned build looks new to it.

## Apps on an external drive are stopped after a restart

Status says *Waiting for the Hobbies drive* (with your drive's name) for these. Docker starts the apps before macOS has mounted the drive, so the ones whose folders are on it cannot start. The startup job waits up to 15 minutes for every drive the apps use, then starts them, and the watchdog starts any left over within 15 minutes of the drive appearing. If they stay stopped, check the drive is mounted under `/Volumes`, run `./homelab schedule install`, and read `scripts/logs/startup.log`.

## The laptop's battery runs down

The homelab's apps run all the time inside the container runtime, whether or not anyone is signed in, and some work hard in the background. On battery, the battery saver pauses those (Status says *Paused on battery*) and starts them again on power; the rest keep running. The keep-awake job (`caffeinate -s`) only holds sleep off while plugged in. For the longest battery life, quit OrbStack while away from power; everything starts again when it opens. Status › *What's using power* names the apps working hardest right now; one that stays busy for hours (beyond a photo import or a library scan) is worth stopping if you don't use it. `pmset -g assertions` shows what holds sleep off.
