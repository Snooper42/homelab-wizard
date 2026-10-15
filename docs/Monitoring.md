---
version: 0.1.0-alpha
---

# Monitoring

Three layers: the watchdog checks every app and the public path every 15 minutes (and an outside heartbeat notices if the watchdog itself stops), Uptime Kuma adds history and a dashboard, and CrowdSec watches who is knocking. All alerts arrive through ntfy.

## Uptime Kuma

Optional since 0.3.0: the watchdog already alerts on every app, so Uptime Kuma is for its history graphs and status page. Its monitors are set up by hand (it has no API for creating them).

Uptime Kuma is on the `homelab` network, so monitors use service names and container ports, not localhost addresses.

| Monitor | Type | Target |
|---|---|---|
| Nginx Proxy Manager | HTTP | `http://nginx-proxy-manager:81` |
| AdGuard Home | HTTP | `http://adguard-home:80` |
| AdGuard DNS | DNS | `npm.example.com`, resolver `192.168.1.10`, port 53 |
| CrowdSec | TCP port | `crowdsec`, port 8080 |
| Duplicati | HTTP | `http://duplicati:8200` |
| Vaultwarden | HTTP | `http://vaultwarden:80/alive` |
| ntfy | HTTP | `http://ntfy:80/v1/health` |
| Navidrome | HTTP | `http://navidrome:4533/ping` |
| Feishin | HTTP | `http://feishin:9180` |
| Audiobookshelf | HTTP | `http://audiobookshelf:80/healthcheck` |
| Calibre-Web | HTTP | `http://calibre-web:8083` |
| Komga | HTTP | `http://komga:25600` |
| Immich | HTTP | `http://immich-server:2283/api/server/ping` |
| Paperless-ngx | HTTP | `http://paperless:8000` |
| MoneyMatter | HTTP | `http://moneymatter-frontend:80` |
| Jellyfin | HTTP | `http://host.docker.internal:8096/health` |

Add one for each optional app you install (`http://<service>:<container port>`; the port is the `web` value in its note's table).

**Notifications:** Settings > Notifications > Setup Notification > ntfy. Server URL `http://ntfy:80`, topic `uptime-kuma`, priority 4, authentication method *Access token* with `NTFY_PUBLISH_TOKEN` from `.env` (after `./homelab notify setup`). Apply it to every monitor.

These monitors check that each app answers on the Docker network. They do not prove the public path works; that is the watchdog's job.

## Watchdog

`./homelab watchdog` runs every 15 minutes (launchd) and checks:

- that OrbStack is running;
- every app the homelab runs: a container that is unhealthy or keeps restarting (Docker counts one waiting to be restarted as running, so this is checked apart), a baseline app that is not running, and, for apps without a health check, whether the web page answers on this Mac. Optional apps that are stopped, Watchtower while updates are paused, and the tunnel before it has a token are left alone;
- every public hostname, resolved through public DNS (Cloudflare 1.1.1.1), so the request takes the same path as a visitor's;
- each running app's newest database dump, which fails when it is over 26 hours old (backups that quietly stopped);
- each Duplicati job, with `DUPLICATI_PASSWORD` set: one whose last run failed, or with no successful run for over a week (jobs never run yet are left alone);
- the proxy's CrowdSec bouncer, while CrowdSec and the proxy run: missing, revoked, or without a pull for over 5 minutes means bans are not enforced (it pulls every 10 seconds);
- free space on each disk the homelab writes to: the homelab folder's, and those under `IMMICH_UPLOAD_LOCATION`, `MEDIA_ROOT`, `DOWNLOADS_ROOT`, `BACKUP_DESTINATION`, `JELLYFIN_DATA_DIR`, and `SYNC_ROOT` that are connected. A disk fails under 5% free, at least 10 GB and at most 50 GB (a full disk stops databases, downloads, and the container runtime, whose disk image lives on the Mac's own disk). This check runs even while the runtime is down. `homelab doctor` and Setup's machine card show the same.

- each drive's own health report (SMART), when `smartctl` is installed (`brew install smartmontools`): a drive that says it is failing fails the check. Containers cannot read a Mac's disks, which is why this runs on the host rather than as an app like Scrutiny. Many USB enclosures do not pass the report through; those drives are listed by `homelab doctor` as having no report and are left alone. `doctor` also warns about early signs on a passing drive: reallocated or pending sectors, media errors, or an SSD past 90% of its rated wear.

It alerts the `tunnel-watchdog` topic when a check starts failing and again when it recovers, not on every run. State is kept in `scripts/logs/watchdog-state.json`, with the last run's time, how many checks ran, and what each failing check said: the app's Status screen shows it under **Watchdog** (all passed, or each failing check and since when), and `homelab report` includes it.

### Weekly summary

On Sundays the nightly backup also sends *Homelab this week* to the `tunnel-watchdog` topic: the apps (all healthy, or which need a look), the watchdog (still running every 15 minutes, and any other check it alerted about, such as a public address or the CrowdSec bouncer), the database copies, the off-site jobs, the last restore test, a due or readable vault export, the free space on each disk (or which is low), each drive's health (passing, wearing, or failing), homelab updates waiting on GitHub, how many attacks CrowdSec caught, and the yearly savings. A good week arrives quietly (low priority) as *all well*; otherwise the title counts the things that need a look. `./homelab digest` shows this week's summary, and `--send` sends it now. It waits until **Set up the alert token** has run.

### External heartbeat

When OrbStack (or the whole Mac) is down, ntfy is down too, so it cannot say so. With `HEARTBEAT_URL` set, every watchdog run also pings an outside monitor: the URL when all checks pass, `<URL>/fail` with the failures otherwise. Create a free check at healthchecks.io with a 15-minute period and a 15-minute grace, give it your phone's or email alerts, and put its ping URL in `HEARTBEAT_URL` (the app's Settings screen, or `.env`). If the pings stop, because the Mac is off, asleep, or offline, or launchd stopped running the watchdog, healthchecks.io alerts you.

## On this machine's screen

Every alert the homelab's own jobs send (the watchdog, backups, the weekly summary) also shows as a notification on the machine running the homelab: Notification Center on a Mac, the desktop's notifications on Linux, a toast on Windows. So alerts reach someone before the phone is set up, and while ntfy itself is down. `DESKTOP_ALERTS=false` in Settings sends them to the phone only. Until **Set up the alert token** has run, the screen is the only place they go.

## ntfy

ntfy denies everything by default. `./homelab notify setup` creates the `homelab` user that every alert source publishes as, gives it write-only access to the topics below, saves its access token in `.env` (`NTFY_PUBLISH_TOKEN`, and the same as an `?auth=` parameter in `NTFY_PUBLISH_AUTH`), removes anonymous write access, and recreates Watchtower so it uses the token. The watchdog uses it automatically; Duplicati gets it as a default option for every job (by `notify setup` itself, and by `duplicati setup`), and Uptime Kuma as described above. Once the token exists, `./homelab domain setup` publishes ntfy through the tunnel, so the phone gets alerts away from home too.

It also creates `homelab-reader`, with read-only access to the same topics, and keeps its token in `NTFY_READ_TOKEN`. The desktop app uses it to show the last 12 hours of alerts on Status (ntfy keeps 12 hours), and the menu bar shows the newest one. Re-running `notify setup` on an existing homelab adds the reader and keeps the publisher's token.

And it creates `phone`, the account the phone subscribes with: read-only on the same topics, with a generated password kept in `.env` as `NTFY_PHONE_PASSWORD`. The password reaches ntfy through docker's environment, never a command line; an account named `phone` made by hand before gets the generated password. In the ntfy app on the phone: Settings › Users › add server `https://ntfy.example.com`, user `phone`, and the password from the desktop app's Settings › `NTFY_PHONE_PASSWORD` › **Copy** (Universal Clipboard pastes it on an iPhone signed in to the same Apple ID). Then subscribe to the topics below on that server.

| Topic | Expect |
|---|---|
| `watchtower` | A summary after each night's updates |
| `duplicati-alerts` | Only failures |
| `uptime-kuma` | Down and up messages |
| `tunnel-watchdog` | Down and recovered messages |
| `reminders` | From the apps you set up for it: Wallos renewals, Changedetection.io changes |

`./homelab notify test <topic>` sends a test message.

## CrowdSec

```bash
./homelab compose crowdsec exec crowdsec cscli metrics            # what is parsed, per source
./homelab compose crowdsec exec crowdsec cscli alerts list        # recent detections
./homelab compose crowdsec exec crowdsec cscli decisions list     # active bans
./homelab compose crowdsec exec crowdsec cscli bouncers list      # the proxy's bouncer and its last pull
```

`./homelab doctor` and the watchdog read the bouncer list themselves: doctor says how long ago the proxy pulled decisions, and the watchdog alerts when it stops. The app's Status screen shows **Protection**: bans enforced or not, the attacks caught this week (`cscli alerts list --since 168h`, the community blocklist left out), how many addresses are banned now, and the latest three. The weekly summary counts the week's attacks too.

`cscli metrics` should show lines read from `/var/log/npm/*.log` and parsed by the nginx-proxy-manager parser. If it reads nothing, check the `npm-logs` volume and `config/crowdsec/acquis.yaml`.

Optionally enroll the engine in the CrowdSec console (`CROWDSEC_ENROLL_KEY`) for a web view of alerts.

## Daily and weekly checks

| When | Check |
|---|---|
| Daily, glance | No unread alerts in ntfy |
| Weekly | `./homelab status`; Duplicati's last run per job; `cscli decisions list` |
| Monthly | A restore test ([Backups](<Backups.md>)); `./homelab doctor`; disk space on the media drive |
