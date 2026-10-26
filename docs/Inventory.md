---
version: 0.9.0-beta
---

# Inventory

Every app, where it lives, and how to reach it. The tables are generated from the compose files by `./homelab docs`; edit the compose files, not the tables.

- **Address** is the hostname with a domain set (through AdGuard and Nginx Proxy Manager on the LAN), and on the internet as well when Public is Yes. In Home mode (no domain, the default) each app is at `https://homelab.<tailnet>.ts.net:<port>` instead; `./homelab status` and the app's Status screen show the address in use.
- **On this machine** is the direct port, for troubleshooting from the homelab's own computer.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
### Baseline (started by ./homelab up)

| App | Project | Address | On this machine | Public |
|---|---|---|---|---|
| [Nginx Proxy Manager](<../services/network/Nginx Proxy Manager.md>) | `homelab_network` | https://npm.example.com | http://localhost:8181 |  |
| [AdGuard Home](<../services/network/AdGuard Home.md>) | `homelab_network` | https://ads.example.com | http://localhost:3003 |  |
| [CrowdSec](<../services/security/CrowdSec.md>) | `homelab_security` |  |  |  |
| [Vaultwarden](<../services/security/Vaultwarden.md>) | `homelab_security` | https://passwords.example.com | http://localhost:8087 | Yes |
| [Uptime Kuma](<../services/security/Uptime Kuma.md>) | `homelab_security` | https://uptime.example.com | http://localhost:3001 |  |
| [ntfy](<../services/security/ntfy.md>) | `homelab_security` | https://ntfy.example.com | http://localhost:9293 | Yes |
| [Watchtower](<../services/system/Watchtower.md>) | `homelab_system` |  |  |  |
| [Duplicati](<../services/system/Duplicati.md>) | `homelab_system` | https://backups.example.com | http://localhost:8200 |  |
| [Navidrome](<../services/media/Navidrome.md>) | `homelab_media` | https://navidrome.example.com | http://localhost:4533 | Yes |
| [Feishin](<../services/media/Feishin.md>) | `homelab_media` | https://music.example.com | http://localhost:9180 | Yes |
| [Audiobookshelf](<../services/media/Audiobookshelf.md>) | `homelab_media` | https://audiobooks.example.com | http://localhost:13378 | Yes |
| [Calibre-Web](<../services/media/Calibre-Web.md>) | `homelab_media` | https://books.example.com | http://localhost:8083 | Yes |
| [Komga](<../services/media/Komga.md>) | `homelab_media` | https://comics.example.com | http://localhost:25600 | Yes |
| [MoneyMatter](<../services/finance/MoneyMatter.md>) | `homelab_budget_tracker` | https://money.example.com | http://localhost:13480 |  |
| [Cloudflare Tunnel](<../services/network/Cloudflare Tunnel.md>) | `homelab_cloudflare` |  |  |  |
| [Immich](<../services/cloud and files/Immich.md>) | `homelab_immich` | https://photos.example.com | http://localhost:8013 | Yes |
| [Paperless-ngx](<../services/documents/Paperless-ngx.md>) | `homelab_paperless` | https://docs.example.com | http://localhost:8010 | Yes |

### Optional (ready to slot in)

| App | Address | On this machine | Install |
|---|---|---|---|
| [Ad blocking on the tailnet](<../services/network/Ad blocking on the tailnet.md>) |  |  | `./homelab install tailnet-dns` |
| [Tailscale](<../services/network/Tailscale.md>) |  |  | `./homelab install tailscale` |
| [Speedtest Tracker](<../services/network/Speedtest Tracker.md>) | https://speedtest.example.com | http://localhost:8765 | `./homelab install speedtest-tracker` |
| [Pocket ID](<../services/security/Pocket ID.md>) | https://id.example.com | http://localhost:1411 | `./homelab install pocket-id` |
| [Homarr](<../services/system/Homarr.md>) | https://homarr.example.com | http://localhost:7575 | `./homelab install homarr` |
| [Homepage](<../services/system/Homepage.md>) | https://homepage.example.com | http://localhost:3000 | `./homelab install homepage` |
| [Dozzle](<../services/system/Dozzle.md>) | this computer only | http://localhost:9998 | `./homelab install dozzle` |
| [File Browser](<../services/cloud and files/File Browser.md>) | https://files.example.com | http://localhost:8086 | `./homelab install filebrowser` |
| [Syncthing](<../services/cloud and files/Syncthing.md>) | https://sync.example.com | http://localhost:8384 | `./homelab install syncthing` |
| [Baikal](<../services/cloud and files/Baikal.md>) | https://dav.example.com | http://localhost:5232 | `./homelab install baikal` |
| [PairDrop](<../services/cloud and files/PairDrop.md>) | https://drop.example.com | http://localhost:3020 | `./homelab install pairdrop` |
| [PsiTransfer](<../services/cloud and files/PsiTransfer.md>) | https://send.example.com | http://localhost:3030 | `./homelab install psitransfer` |
| [FreshRSS](<../services/documents/FreshRSS.md>) | https://freshrss.example.com | http://localhost:8085 | `./homelab install freshrss` |
| [Stirling PDF](<../services/documents/Stirling PDF.md>) | https://pdf.example.com | http://localhost:8095 | `./homelab install stirling-pdf` |
| [Open WebUI](<../services/documents/Open WebUI.md>) | https://ai.example.com | http://localhost:3080 | `./homelab install open-webui` |
| [Changedetection.io](<../services/documents/Changedetection.io.md>) | https://watch.example.com | http://localhost:5010 | `./homelab install changedetection` |
| [Memos](<../services/documents/Memos.md>) | https://notes.example.com | http://localhost:5230 | `./homelab install memos` |
| [Kiwix](<../services/documents/Kiwix.md>) | https://kiwix.example.com | http://localhost:8098 | `./homelab install kiwix` |
| [Wallos](<../services/finance/Wallos.md>) | https://subscriptions.example.com | http://localhost:8282 | `./homelab install wallos` |
| [Actual Budget](<../services/finance/Actual Budget.md>) | https://actual.example.com | http://localhost:5006 | `./homelab install actual-budget` |
| [Kavita](<../services/media/Kavita.md>) | https://kavita.example.com | http://localhost:5500 | `./homelab install kavita` |
| [Prowlarr](<../services/media automation/Prowlarr.md>) | https://prowlarr.example.com | http://localhost:9696 | `./homelab install prowlarr` |
| [Sonarr](<../services/media automation/Sonarr.md>) | https://sonarr.example.com | http://localhost:8989 | `./homelab install sonarr` |
| [Radarr](<../services/media automation/Radarr.md>) | https://radarr.example.com | http://localhost:7878 | `./homelab install radarr` |
| [Lidarr](<../services/media automation/Lidarr.md>) | https://lidarr.example.com | http://localhost:8686 | `./homelab install lidarr` |
| [Bazarr](<../services/media automation/Bazarr.md>) | https://bazarr.example.com | http://localhost:6767 | `./homelab install bazarr` |
| [Tdarr](<../services/media automation/Tdarr.md>) | https://tdarr.example.com | http://localhost:8265 | `./homelab install tdarr` |
| [FlareSolverr](<../services/media automation/FlareSolverr.md>) |  |  | `./homelab install flaresolverr` |
| [Seerr](<../services/media automation/Seerr.md>) | https://seerr.example.com | http://localhost:5055 | `./homelab install seerr` |
| [LazyLibrarian](<../services/media automation/LazyLibrarian.md>) | https://lazylibrarian.example.com | http://localhost:5299 | `./homelab install lazylibrarian` |
| [qBittorrent](<../services/media automation/qBittorrent.md>) | https://qbittorrent.example.com | http://localhost:8082 | `./homelab install qbittorrent` |
| [Gluetun](<../services/media automation/Gluetun.md>) |  |  | `./homelab install gluetun` |
| [Mealie](<../services/household/Mealie.md>) | https://mealie.example.com | http://localhost:9000 | `./homelab install mealie` |
| [Vikunja](<../services/household/Vikunja.md>) | https://todo.example.com | http://localhost:3456 | `./homelab install vikunja` |
| [Home Assistant](<../services/household/Home Assistant.md>) | https://home.example.com | http://localhost:8123 | `./homelab install home-assistant` |
| [Grocy](<../services/household/Grocy.md>) | https://grocy.example.com | http://localhost:9283 | `./homelab install grocy` |
| [Homebox](<../services/household/Homebox.md>) | https://inventory.example.com | http://localhost:7745 | `./homelab install homebox` |
| [Beszel](<../services/system/Beszel.md>) | https://monitor.example.com | http://localhost:8090 | `./homelab install beszel` |
| [Beszel agent](<../services/system/Beszel agent.md>) |  |  | `./homelab install beszel-agent` |
| [Dawarich](<../services/cloud and files/Dawarich.md>) | https://location.example.com | http://localhost:3050 | `./homelab install dawarich` |
| [Docmost](<../services/documents/Docmost.md>) | https://wiki.example.com | http://localhost:3040 | `./homelab install docmost` |
| [Firefly III](<../services/finance/Firefly III.md>) | https://firefly.example.com | http://localhost:8094 | `./homelab install firefly-iii` |
| [Firefly III importer](<../services/finance/Firefly III importer.md>) | https://firefly-import.example.com | http://localhost:8097 | `./homelab install firefly-iii-importer` |
| [Ghostfolio](<../services/finance/Ghostfolio.md>) | https://invest.example.com | http://localhost:3333 | `./homelab install ghostfolio` |
| [Karakeep](<../services/documents/Karakeep.md>) | https://links.example.com | http://localhost:3010 | `./homelab install karakeep` |
| [Linkwarden](<../services/documents/Linkwarden.md>) | https://bookmarks.example.com | http://localhost:3060 | `./homelab install linkwarden` |
| [Nextcloud](<../services/cloud and files/Nextcloud.md>) | https://cloud.example.com | http://localhost:8099 | `./homelab install nextcloud` |
| [Paperless-AI](<../services/documents/Paperless-AI.md>) | https://docs-ai.example.com | http://localhost:8011 | `./homelab install paperless-ai` |
| [RomM](<../services/media/RomM.md>) | https://games.example.com | http://localhost:7676 | `./homelab install romm` |
| [Tandoor](<../services/household/Tandoor.md>) | https://recipes.example.com | http://localhost:8093 | `./homelab install tandoor` |

### Native apps

| App | Address | On this machine | Install |
|---|---|---|---|
| [Jellyfin](<../services/media/Jellyfin.md>) | https://jellyfin.example.com | http://localhost:8096 | `brew install --cask jellyfin` |
| [Phone companion](<../services/system/Phone companion.md>) | https://homelab.example.com | http://localhost:8099 | `./homelab schedule install` |

### Helpers (databases and caches)

| Service | Project | Image | Backup |
|---|---|---|---|
| `docker-socket-proxy` | `homelab_system` | `ghcr.io/tecnativa/docker-socket-proxy:v0.5.0` |  |
| `moneymatter-backend` | `homelab_budget_tracker` | `letehaha/budget-tracker-be:sha-f862f3d` | Daily volume archive |
| `moneymatter-db` | `homelab_budget_tracker` | `postgres:16` | Daily dump |
| `moneymatter-redis` | `homelab_budget_tracker` | `redis:7` |  |
| `moneymatter-rates` | `homelab_budget_tracker` | `letehaha/currency-rates-api:latest` |  |
| `dawarich-sidekiq` | `homelab_dawarich` | `docker.io/freikin/dawarich:latest` |  |
| `dawarich-db` | `homelab_dawarich` | `docker.io/postgis/postgis:17-3.5-alpine` | Daily dump |
| `dawarich-redis` | `homelab_dawarich` | `docker.io/valkey/valkey:9-alpine` |  |
| `docmost-db` | `homelab_docmost` | `docker.io/library/postgres:17` | Daily dump |
| `docmost-redis` | `homelab_docmost` | `docker.io/valkey/valkey:9-alpine` |  |
| `firefly-iii-cron` | `homelab_firefly_iii` | `docker.io/library/alpine:3` |  |
| `firefly-iii-db` | `homelab_firefly_iii` | `docker.io/library/postgres:18` | Daily dump |
| `ghostfolio-db` | `homelab_ghostfolio` | `docker.io/library/postgres:17` | Daily dump |
| `ghostfolio-redis` | `homelab_ghostfolio` | `docker.io/valkey/valkey:9-alpine` |  |
| `immich-machine-learning` | `homelab_immich` | `ghcr.io/immich-app/immich-machine-learning:v3` |  |
| `immich-redis` | `homelab_immich` | `docker.io/valkey/valkey:9@sha256:c123e3715db63d06d4ad6964884037aa0d5d4d703939b9929954112889708e1d` |  |
| `immich-database` | `homelab_immich` | `ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0@sha256:bcf63357191b76a916ae5eb93464d65c07511da41e3bf7a8416db519b40b1c23` | Daily dump |
| `karakeep-chrome` | `homelab_karakeep` | `ghcr.io/karakeep-app/karakeep-chrome:release` |  |
| `karakeep-meilisearch` | `homelab_karakeep` | `getmeili/meilisearch:v1.41.0` |  |
| `linkwarden-db` | `homelab_linkwarden` | `docker.io/library/postgres:18` | Daily dump |
| `linkwarden-meilisearch` | `homelab_linkwarden` | `getmeili/meilisearch:v1.41.0` |  |
| `nextcloud-cron` | `homelab_nextcloud` | `docker.io/library/nextcloud:35-apache` |  |
| `nextcloud-db` | `homelab_nextcloud` | `docker.io/library/postgres:18` | Daily dump |
| `nextcloud-redis` | `homelab_nextcloud` | `docker.io/valkey/valkey:9-alpine` |  |
| `paperless-db` | `homelab_paperless` | `docker.io/library/postgres:18` | Daily dump |
| `paperless-broker` | `homelab_paperless` | `docker.io/valkey/valkey:9-alpine` |  |
| `romm-db` | `homelab_romm` | `docker.io/library/postgres:17` | Daily dump |
| `tandoor-db` | `homelab_tandoor` | `docker.io/library/postgres:18` | Daily dump |

### Public hostnames (Cloudflare Tunnel)

- audiobooks.example.com
- books.example.com
- cloud.example.com
- comics.example.com
- docs.example.com
- music.example.com
- navidrome.example.com
- ntfy.example.com
- passwords.example.com
- photos.example.com
<!-- END homelab:generated -->

## Fixed ports

| Port | Listens on | What |
|---|---|---|
| 53 TCP/UDP | LAN | AdGuard Home DNS |
| 53 TCP/UDP | Tailnet address | Ad blocking on the tailnet (`tailnet-dns`, inside Tailscale's network), on to AdGuard Home |
| 80, 443 | LAN | Nginx Proxy Manager |
| 22000 TCP/UDP, 21027 UDP | LAN | Syncthing's sync and discovery, when installed |
| 8096 | This Mac | Jellyfin (native) |
| 8099 | LAN | The phone companion (`homelab serve`); it refuses anything but private and tailnet addresses |

Everything else listens on 127.0.0.1 only (`BIND_IP`); the LAN ports use `LAN_BIND_IP`.
