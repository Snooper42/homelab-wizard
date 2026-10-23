---
version: 0.1.0-alpha
---

# Services

One note per app, grouped by category. Each note starts with a generated table of facts (image, address, data, backups, updates), followed by hand-written sections: Purpose and Setup; how it works, where things live, everyday use, what it connects to, ideas to try, useful commands, and its API where it has one; links to learn more; then Backup and Troubleshooting.

Databases and caches are not listed separately: they appear as Helpers in the note of the app that uses them. See [PostgreSQL](<../services/system/PostgreSQL.md>) and [Redis and Valkey](<../services/system/Redis and Valkey.md>) for how they are run.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
### Network

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [Nginx Proxy Manager](<../services/network/Nginx Proxy Manager.md>) | https://npm.example.com | Yes |
| [AdGuard Home](<../services/network/AdGuard Home.md>) | https://ads.example.com | Yes |
| [Ad blocking on the tailnet](<../services/network/Ad blocking on the tailnet.md>) |  | Optional |
| [Tailscale](<../services/network/Tailscale.md>) |  | Optional |
| [Speedtest Tracker](<../services/network/Speedtest Tracker.md>) | https://speedtest.example.com | Optional |
| [Cloudflare Tunnel](<../services/network/Cloudflare Tunnel.md>) |  | Yes |

### Security

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [CrowdSec](<../services/security/CrowdSec.md>) |  | Yes |
| [Vaultwarden](<../services/security/Vaultwarden.md>) | https://passwords.example.com | Yes |
| [Uptime Kuma](<../services/security/Uptime Kuma.md>) | https://uptime.example.com | Yes |
| [ntfy](<../services/security/ntfy.md>) | https://ntfy.example.com | Yes |
| [Pocket ID](<../services/security/Pocket ID.md>) | https://id.example.com | Optional |

### System

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [Watchtower](<../services/system/Watchtower.md>) |  | Yes |
| [Duplicati](<../services/system/Duplicati.md>) | https://backups.example.com | Yes |
| [Homarr](<../services/system/Homarr.md>) | https://homarr.example.com | Optional |
| [Homepage](<../services/system/Homepage.md>) | https://homepage.example.com | Optional |
| [Dozzle](<../services/system/Dozzle.md>) | this computer only | Optional |
| [Phone companion](<../services/system/Phone companion.md>) | https://homelab.example.com | Native app |

### Cloud & Files

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [File Browser](<../services/cloud and files/File Browser.md>) | https://files.example.com | Optional |
| [Syncthing](<../services/cloud and files/Syncthing.md>) | https://sync.example.com | Optional |
| [Baikal](<../services/cloud and files/Baikal.md>) | https://dav.example.com | Optional |
| [PairDrop](<../services/cloud and files/PairDrop.md>) | https://drop.example.com | Optional |
| [PsiTransfer](<../services/cloud and files/PsiTransfer.md>) | https://send.example.com | Optional |
| [Dawarich](<../services/cloud and files/Dawarich.md>) | https://location.example.com | Optional |
| [Immich](<../services/cloud and files/Immich.md>) | https://photos.example.com | Yes |

### Documents

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [FreshRSS](<../services/documents/FreshRSS.md>) | https://freshrss.example.com | Optional |
| [Stirling PDF](<../services/documents/Stirling PDF.md>) | https://pdf.example.com | Optional |
| [Open WebUI](<../services/documents/Open WebUI.md>) | https://ai.example.com | Optional |
| [Changedetection.io](<../services/documents/Changedetection.io.md>) | https://watch.example.com | Optional |
| [Memos](<../services/documents/Memos.md>) | https://notes.example.com | Optional |
| [Docmost](<../services/documents/Docmost.md>) | https://wiki.example.com | Optional |
| [Karakeep](<../services/documents/Karakeep.md>) | https://links.example.com | Optional |
| [Paperless-ngx](<../services/documents/Paperless-ngx.md>) | https://docs.example.com | Yes |

### Finance

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [Wallos](<../services/finance/Wallos.md>) | https://subscriptions.example.com | Optional |
| [MoneyMatter](<../services/finance/MoneyMatter.md>) | https://money.example.com | Yes |
| [Ghostfolio](<../services/finance/Ghostfolio.md>) | https://invest.example.com | Optional |

### Media

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [Navidrome](<../services/media/Navidrome.md>) | https://navidrome.example.com | Yes |
| [Feishin](<../services/media/Feishin.md>) | https://music.example.com | Yes |
| [Audiobookshelf](<../services/media/Audiobookshelf.md>) | https://audiobooks.example.com | Yes |
| [Calibre-Web](<../services/media/Calibre-Web.md>) | https://books.example.com | Yes |
| [Komga](<../services/media/Komga.md>) | https://comics.example.com | Yes |
| [Kavita](<../services/media/Kavita.md>) | https://kavita.example.com | Optional |
| [RomM](<../services/media/RomM.md>) | https://games.example.com | Optional |
| [Jellyfin](<../services/media/Jellyfin.md>) | https://jellyfin.example.com | Native app |

### Media Automation

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [Prowlarr](<../services/media automation/Prowlarr.md>) | https://prowlarr.example.com | Optional |
| [Sonarr](<../services/media automation/Sonarr.md>) | https://sonarr.example.com | Optional |
| [Radarr](<../services/media automation/Radarr.md>) | https://radarr.example.com | Optional |
| [Lidarr](<../services/media automation/Lidarr.md>) | https://lidarr.example.com | Optional |
| [Bazarr](<../services/media automation/Bazarr.md>) | https://bazarr.example.com | Optional |
| [FlareSolverr](<../services/media automation/FlareSolverr.md>) |  | Optional |
| [Seerr](<../services/media automation/Seerr.md>) | https://seerr.example.com | Optional |
| [LazyLibrarian](<../services/media automation/LazyLibrarian.md>) | https://lazylibrarian.example.com | Optional |
| [qBittorrent](<../services/media automation/qBittorrent.md>) | https://qbittorrent.example.com | Optional |
| [Gluetun](<../services/media automation/Gluetun.md>) |  | Optional |

### Household

| Service | Address | Starts with `./homelab up` |
|---|---|---|
| [Mealie](<../services/household/Mealie.md>) | https://mealie.example.com | Optional |
| [Vikunja](<../services/household/Vikunja.md>) | https://todo.example.com | Optional |
| [Home Assistant](<../services/household/Home Assistant.md>) | https://home.example.com | Optional |
| [Grocy](<../services/household/Grocy.md>) | https://grocy.example.com | Optional |
| [Homebox](<../services/household/Homebox.md>) | https://inventory.example.com | Optional |
<!-- END homelab:generated -->
