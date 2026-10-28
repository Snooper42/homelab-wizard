---
version: 0.10.0-beta
---

# Automation

Everything that runs on its own, and how to check it is alive. Setup › **Scheduled jobs** (**Install the jobs**) sets them up; you do not need to run any of them by hand.

## Scheduled jobs

`./homelab schedule install` installs one background job, `com.homelab.agent` (`homelab agent`), so the system's login items list one homelab entry. On a Mac it is a LaunchAgent in `~/Library/LaunchAgents`, run as you in your login session, which is where OrbStack's engine lives; on Linux, a systemd user unit; on Windows, a Task Scheduler task. The agent starts the menu bar item too when it is set to start at login. Each part below runs as its own process, so one failing leaves the rest running, and writes `scripts/logs/<part>.log`. A log that reaches 5 MB is split before the next run: its older half replaces `<part>.1.log` and the newer half stays, so the watchdog's, written every 15 minutes, stays under 8 MB for as long as the homelab runs. `homelab report` reads the two as one. Installing removes the five separate jobs older versions installed.

| Part | When | Runs | Purpose |
|---|---|---|---|
| startup | At login | `homelab up --apply --wait-media 15m` | Starts anything in the baseline that is not running; waits up to 15 minutes for the media drive first |
| backup | Daily 03:30, or as soon as the machine is awake after a missed night | `homelab backup --apply` | Dumps every database, archives listed volumes, notes each app's image by its digest, copies `.env` into `recovery-staging`, keeps the newest 7 of each; alerts `duplicati-alerts` on failure. Also measures the app folders and each person's photos (Status › What the apps keep), records the day's savings, sends the monthly restore-test and vault-export reminders, asks GitHub for homelab updates (for the menu bar), and on Sundays sends the weekly summary ([Monitoring](<Monitoring.md#weekly-summary>)) |
| watchdog | Every 15 minutes | `homelab watchdog --quiet` | Checks the runtime, every app, the database copies, the off-site jobs, the CrowdSec bouncer, free disk space, and *with a domain* every public hostname ([Monitoring](<Monitoring.md#watchdog>)); alerts `tunnel-watchdog` when something breaks or recovers, and keeps 7 days of counts for the *% up this week* badges. Keeps each updated app's previous image for a week, and rolls back an update that stays unwell |
| awake | Always (from login) | `homelab awake` | Keeps the machine from sleeping while it is plugged in, so the apps stay reachable; the screen still turns off. On a Mac this is `caffeinate -s`, which a laptop on battery ignores. `KEEP_AWAKE=false` in Settings lets it sleep as set. `homelab doctor` warns when the machine would sleep with nothing keeping it up (it reads the sleep setting on a Mac, in GNOME, and on Windows) |
| serve | Always (from login) | `homelab serve` | The phone companion on port 8099, home network and tailnet only ([Phone companion](<../services/system/Phone companion.md>)); `PHONE_COMPANION=false` turns it off |

Check the agent with `./homelab schedule status` (installed, last exit code). Each part's own log tells you what it did.

## Watchtower (container updates)

| Property | Value |
|---|---|
| Image | `nickfedor/watchtower` (maintained fork; negotiates the Docker API version itself) |
| Schedule | Daily at 4:00 AM (`WATCHTOWER_SCHEDULE`) |
| Scope | Only containers labelled `com.centurylinklabs.watchtower.enable=true` |
| Cleanup | Off in Watchtower: the watchdog keeps each app's previous image as `homelab-rollback/<app>:previous` for a week (`homelab rollback <app>` goes back to it), then removes it; other old images go at once |
| Before | The nightly backup at 03:30 dumps every database, so each update has a dump from just before it. `homelab update <app>` dumps the app's databases first |
| After | An app updated 20 minutes to 6 hours ago that is unhealthy, restarting over and over, or whose page does not answer on two checks in a row is rolled back by the watchdog, its updates held, and an alert sent to `watchtower` (`AUTO_ROLLBACK=false` turns this off). If it was never well after the update, its data from just before goes back with the image (nothing new can have been written); if it was well for a while, today's data stays and the alert says `homelab rollback <app> --data` puts the copy back |
| What is new | `homelab updates notes <app>` lists the releases newer than the version it runs, with the start of each one's notes; `homelab update` prints one line per app, and the app's **Update** shows the notes before it goes ahead. They come from the GitHub project the image names (its `org.opencontainers.image.source` label, a `ghcr.io` name, or `releases:` in the app's `x-homelab`), kept 6 hours in `data/releases.json` |
| Held | `homelab updates hold <app>` and `release <app>` (`UPDATES_HELD`; Watchtower's `WATCHTOWER_DISABLE_CONTAINERS` from `UPDATES_HELD_CONTAINERS`) |
| Alerts | ntfy topic `watchtower` |

### Who updates what

Every container falls into one of three groups, generated from the compose files: `homelab validate` warns when an image is updated by hand without a reason (`x-homelab` `pin`). Each service note's table says the same for its app.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
### Nightly, by Watchtower (69)

Labelled `com.centurylinklabs.watchtower.enable=true`: Watchtower pulls a newer image at 4 AM and recreates the container.

| App | Image |
|---|---|
| [AdGuard Home](<../services/network/AdGuard Home.md>) | `adguard/adguardhome:latest` |
| [Ad blocking on the tailnet](<../services/network/Ad blocking on the tailnet.md>) | `alpine/socat:latest` |
| [Tailscale](<../services/network/Tailscale.md>) | `tailscale/tailscale:latest` |
| [Speedtest Tracker](<../services/network/Speedtest Tracker.md>) | `lscr.io/linuxserver/speedtest-tracker:latest` |
| [CrowdSec](<../services/security/CrowdSec.md>) | `crowdsecurity/crowdsec:latest` |
| [Vaultwarden](<../services/security/Vaultwarden.md>) | `vaultwarden/server:latest` |
| [Uptime Kuma](<../services/security/Uptime Kuma.md>) | `louislam/uptime-kuma:2` |
| [ntfy](<../services/security/ntfy.md>) | `binwiederhier/ntfy:latest` |
| [Pocket ID](<../services/security/Pocket ID.md>) | `ghcr.io/pocket-id/pocket-id:v2` |
| [Duplicati](<../services/system/Duplicati.md>) | `lscr.io/linuxserver/duplicati:latest` |
| [Homarr](<../services/system/Homarr.md>) | `ghcr.io/homarr-labs/homarr:latest` |
| [Homepage](<../services/system/Homepage.md>) | `ghcr.io/gethomepage/homepage:latest` |
| [Dozzle](<../services/system/Dozzle.md>) | `amir20/dozzle:latest` |
| [File Browser](<../services/cloud and files/File Browser.md>) | `filebrowser/filebrowser:latest` |
| [Syncthing](<../services/cloud and files/Syncthing.md>) | `lscr.io/linuxserver/syncthing:latest` |
| [Baikal](<../services/cloud and files/Baikal.md>) | `ckulka/baikal:nginx` |
| [PairDrop](<../services/cloud and files/PairDrop.md>) | `lscr.io/linuxserver/pairdrop:latest` |
| [PsiTransfer](<../services/cloud and files/PsiTransfer.md>) | `psitrax/psitransfer:latest` |
| [FreshRSS](<../services/documents/FreshRSS.md>) | `lscr.io/linuxserver/freshrss:latest` |
| [Stirling PDF](<../services/documents/Stirling PDF.md>) | `ghcr.io/stirling-tools/stirling-pdf:latest` |
| [Open WebUI](<../services/documents/Open WebUI.md>) | `ghcr.io/open-webui/open-webui:main` |
| [Changedetection.io](<../services/documents/Changedetection.io.md>) | `ghcr.io/dgtlmoon/changedetection.io:latest` |
| [Memos](<../services/documents/Memos.md>) | `neosmemo/memos:stable` |
| [Kiwix](<../services/documents/Kiwix.md>) | `ghcr.io/kiwix/kiwix-serve:latest` |
| [Wallos](<../services/finance/Wallos.md>) | `bellamy/wallos:latest` |
| [Actual Budget](<../services/finance/Actual Budget.md>) | `actualbudget/actual-server:latest` |
| [Navidrome](<../services/media/Navidrome.md>) | `deluan/navidrome:latest` |
| [Feishin](<../services/media/Feishin.md>) | `ghcr.io/jeffvli/feishin:latest` |
| [Audiobookshelf](<../services/media/Audiobookshelf.md>) | `ghcr.io/advplyr/audiobookshelf:latest` |
| [Calibre-Web](<../services/media/Calibre-Web.md>) | `lscr.io/linuxserver/calibre-web:latest` |
| [Komga](<../services/media/Komga.md>) | `gotson/komga:latest` |
| [Kavita](<../services/media/Kavita.md>) | `jvmilazz0/kavita:latest` |
| [Jellyfin in a container](<../services/media/Jellyfin in a container.md>) | `jellyfin/jellyfin:latest` |
| [Prowlarr](<../services/media automation/Prowlarr.md>) | `lscr.io/linuxserver/prowlarr:latest` |
| [Sonarr](<../services/media automation/Sonarr.md>) | `lscr.io/linuxserver/sonarr:latest` |
| [Radarr](<../services/media automation/Radarr.md>) | `lscr.io/linuxserver/radarr:latest` |
| [Lidarr](<../services/media automation/Lidarr.md>) | `lscr.io/linuxserver/lidarr:latest` |
| [Bazarr](<../services/media automation/Bazarr.md>) | `lscr.io/linuxserver/bazarr:latest` |
| [Tdarr](<../services/media automation/Tdarr.md>) | `docker.io/haveagitgat/tdarr:latest` |
| [FlareSolverr](<../services/media automation/FlareSolverr.md>) | `ghcr.io/flaresolverr/flaresolverr:latest` |
| [Seerr](<../services/media automation/Seerr.md>) | `ghcr.io/seerr-team/seerr:latest` |
| [LazyLibrarian](<../services/media automation/LazyLibrarian.md>) | `lscr.io/linuxserver/lazylibrarian:latest` |
| [qBittorrent](<../services/media automation/qBittorrent.md>) | `lscr.io/linuxserver/qbittorrent:latest` |
| [Gluetun](<../services/media automation/Gluetun.md>) | `qmcgaw/gluetun:latest` |
| [Mealie](<../services/household/Mealie.md>) | `ghcr.io/mealie-recipes/mealie:latest` |
| [Vikunja](<../services/household/Vikunja.md>) | `vikunja/vikunja:latest` |
| [Home Assistant](<../services/household/Home Assistant.md>) | `ghcr.io/home-assistant/home-assistant:stable` |
| [Grocy](<../services/household/Grocy.md>) | `lscr.io/linuxserver/grocy:latest` |
| [Homebox](<../services/household/Homebox.md>) | `ghcr.io/sysadminsmedia/homebox:latest` |
| [Beszel](<../services/system/Beszel.md>) | `docker.io/henrygd/beszel:latest` |
| [Beszel agent](<../services/system/Beszel agent.md>) | `docker.io/henrygd/beszel-agent:latest` |
| [Cloudflare Tunnel](<../services/network/Cloudflare Tunnel.md>) | `cloudflare/cloudflared:latest` |
| [Docmost](<../services/documents/Docmost.md>) | `docker.io/docmost/docmost:latest` |
| [Firefly III](<../services/finance/Firefly III.md>) | `docker.io/fireflyiii/core:latest` |
| [Firefly III importer](<../services/finance/Firefly III importer.md>) | `docker.io/fireflyiii/data-importer:latest` |
| `firefly-iii-cron` | `docker.io/library/alpine:3` |
| `frigate-mqtt` | `docker.io/library/eclipse-mosquitto:2` |
| [Ghostfolio](<../services/finance/Ghostfolio.md>) | `docker.io/ghostfolio/ghostfolio:latest` |
| [Immich](<../services/cloud and files/Immich.md>) | `ghcr.io/immich-app/immich-server:v3` |
| `immich-machine-learning` | `ghcr.io/immich-app/immich-machine-learning:v3` |
| [Karakeep](<../services/documents/Karakeep.md>) | `ghcr.io/karakeep-app/karakeep:release` |
| `karakeep-chrome` | `ghcr.io/karakeep-app/karakeep-chrome:release` |
| [Linkwarden](<../services/documents/Linkwarden.md>) | `ghcr.io/linkwarden/linkwarden:latest` |
| [Nextcloud](<../services/cloud and files/Nextcloud.md>) | `docker.io/library/nextcloud:35-apache` |
| `nextcloud-cron` | `docker.io/library/nextcloud:35-apache` |
| [Paperless-ngx](<../services/documents/Paperless-ngx.md>) | `ghcr.io/paperless-ngx/paperless-ngx:latest` |
| [Paperless-AI](<../services/documents/Paperless-AI.md>) | `docker.io/clusterzx/paperless-ai:latest` |
| [RomM](<../services/media/RomM.md>) | `rommapp/romm:latest` |
| [Tandoor](<../services/household/Tandoor.md>) | `docker.io/vabene1111/recipes:latest` |

### Built locally (1)

Built from a Dockerfile in this repository; `./homelab update <app>` rebuilds it on the latest base image.

| App | Built from | Why |
|---|---|---|
| [Nginx Proxy Manager](<../services/network/Nginx Proxy Manager.md>) | `dockerfiles/npm-crowdsec` | Carries the CrowdSec bouncer; pulling the upstream image would silently drop it |

### By hand (29)

Not labelled for Watchtower, each for the reason given. Update with a backup first: `./homelab backup --apply`, then `./homelab update <app>` (or the steps in its note).

| App | Image | Why |
|---|---|---|
| [Watchtower](<../services/system/Watchtower.md>) | `nickfedor/watchtower:1.23.2` | It controls Docker, which reaches every app and, on a Mac, your files; set WATCHTOWER_VERSION to a newer release after reading its notes, then ./homelab update watchtower |
| [Kopia](<../services/system/Kopia.md>) | `kopia/kopia:0.23.1` | A backup engine reads and writes every copy you keep; set KOPIA_VERSION to a newer release after reading its notes, then ./homelab update kopia |
| `docker-socket-proxy` | `ghcr.io/tecnativa/docker-socket-proxy:v0.5.0` | It holds the Docker socket; set SOCKET_PROXY_VERSION to a newer release after reading its notes, then ./homelab update docker-socket-proxy |
| [MoneyMatter](<../services/finance/MoneyMatter.md>) | `letehaha/budget-tracker-fe:sha-f862f3d` | Pinned to the tested v0.30.2 build; read the release notes, then bump the frontend and backend tags together (its note) |
| `moneymatter-backend` | `letehaha/budget-tracker-be:sha-f862f3d` | Pinned with the frontend; a new version can migrate the budget database, so it follows a backup |
| `moneymatter-db` | `postgres:16` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `moneymatter-redis` | `redis:7` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `moneymatter-rates` | `letehaha/currency-rates-api:latest` | Publishes only a latest tag; it changes with MoneyMatter releases, so it is updated alongside them |
| [Dawarich](<../services/cloud and files/Dawarich.md>) | `docker.io/freikin/dawarich:latest` | Dawarich changes quickly and some releases need steps from their notes; update by hand with ./homelab update dawarich dawarich-sidekiq |
| `dawarich-sidekiq` | `docker.io/freikin/dawarich:latest` | Updated together with Dawarich (./homelab update dawarich dawarich-sidekiq) |
| `dawarich-db` | `docker.io/postgis/postgis:17-3.5-alpine` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `dawarich-redis` | `docker.io/valkey/valkey:9-alpine` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `docmost-db` | `docker.io/library/postgres:17` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `docmost-redis` | `docker.io/valkey/valkey:9-alpine` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `firefly-iii-db` | `docker.io/library/postgres:18` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| [Frigate](<../services/security/Frigate.md>) | `ghcr.io/blakeblackshear/frigate:0.18.2` | A new version can change the settings file and migrate the database; set FRIGATE_VERSION to a newer release after reading its notes, then ./homelab update frigate |
| `ghostfolio-db` | `docker.io/library/postgres:17` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `ghostfolio-redis` | `docker.io/valkey/valkey:9-alpine` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `immich-redis` | `docker.io/valkey/valkey:9@sha256:c123e3715db63d06d4ad6964884037aa0d5d4d703939b9929954112889708e1d` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `immich-database` | `ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0@sha256:bcf63357191b76a916ae5eb93464d65c07511da41e3bf7a8416db519b40b1c23` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `karakeep-meilisearch` | `getmeili/meilisearch:v1.41.0` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `linkwarden-db` | `docker.io/library/postgres:18` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `linkwarden-meilisearch` | `getmeili/meilisearch:v1.41.0` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `nextcloud-db` | `docker.io/library/postgres:18` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `nextcloud-redis` | `docker.io/valkey/valkey:9-alpine` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `paperless-db` | `docker.io/library/postgres:18` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `paperless-broker` | `docker.io/valkey/valkey:9-alpine` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `romm-db` | `docker.io/library/postgres:17` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
| `tandoor-db` | `docker.io/library/postgres:18` | A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks) |
<!-- END homelab:generated -->

## Duplicati (off-site backups)

Duplicati runs the jobs below. **Create the backup jobs** on the Setup screen (or `./homelab duplicati setup`) makes them through Duplicati's API:

- AES-256 encryption with the passphrases in `.env`. They are generated if missing: `DUPLICATI_SECRETS_PASSPHRASE` for Homelab Secrets, and `DUPLICATI_PASSPHRASE` for the rest.
- Zip compression and smart retention (a version a day for a week, a week for a month, a month for a year).
- Each job writes into its own folder in `BACKUP_DESTINATION`.

It leaves a job that already exists (by name) as it is. When a new job's folder already holds a backup (a rebuilt machine), it rebuilds the job's database from it (a repair) instead of a first run. It creates the photo, Jellyfin, and books jobs only once their folder on this machine has something in it, and runs the small jobs once straight away. It first checks that Duplicati sees `BACKUP_DESTINATION` at `/destination`, and recreates Duplicati when it still has an older folder (after the setting changed). The sources are container paths. See [Backups](<Backups.md>) for the full mapping.

| Job | Source | Folder | Schedule |
|---|---|---|---|
| Homelab Photos | `/source/immich` | `photos` | Daily 01:00 |
| Homelab Databases | `/staging/databases`, `/staging/volumes` | `databases` | Daily 05:00 (after the 03:30 dumps) |
| Homelab Secrets | `/staging/secrets` | `secrets` | Daily 05:00 |
| Homelab AppData | `/source/appdata` (without Duplicati's own folder) | `appdata` | Daily 05:30 |
| Homelab Stack Data | `/source/homelab-appdata` | `stack-data` | Daily 05:30 |
| Homelab Infrastructure | `/source/stacks` | `infrastructure` | Sundays 06:00 |
| Homelab Jellyfin | `/source/jellyfin` (without its cache, transcodes, and logs) | `jellyfin` | Sundays 02:00 |
| Homelab Calibre | `/source/calibre` | `calibre` | Sundays 03:00 |

`./homelab duplicati jobs` lists them with their last and next run, as the app's Backups screen does.

Failure alerts are set once for every job, as Duplicati default options: `send-http-url` is `http://ntfy:80/duplicati-alerts?auth=<NTFY_PUBLISH_AUTH>` and `send-http-level` is `Warning,Error,Fatal`. **Set up the alert token** (`notify setup`) and `duplicati setup` both set them; ntfy refuses anonymous posts, so they wait for the token. A job you make by hand gets them too.

## Alert topics (ntfy)

| Topic | Published by |
|---|---|
| `watchtower` | Watchtower, after updates |
| `duplicati-alerts` | Duplicati job failures and `homelab backup` failures |
| `uptime-kuma` | Uptime Kuma monitors |
| `tunnel-watchdog` | `homelab watchdog`, and the Sunday weekly summary |
| `reminders` | The apps you point at it (Wallos renewals, Changedetection.io changes) |

ntfy refuses anonymous publishing. `./homelab notify setup` gives the `homelab` user write-only access to exactly these topics and stores its token in `.env`; `./homelab notify test <topic>` sends a test message with it. A new topic needs to be added to the list in `internal/notify` and `notify setup` run again, or its messages are refused.

## Principles

- Everything previews first and needs `--apply` (or a yes in a terminal) to change anything.
- Every job checks its own result: a dump must end with Postgres's completion marker, a copy must hash identically, and a URL must actually answer.
- Alerts fire when something changes state, not on every check.
