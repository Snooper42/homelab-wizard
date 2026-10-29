---
version: 0.14.0
---

# qBittorrent

The torrent client for the *arr apps. It has no network of its own: it runs inside Gluetun's network, so every byte goes through ProtonVPN, and nothing leaves if the VPN is down.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `qbittorrent` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `lscr.io/linuxserver/qbittorrent:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install qbittorrent` |
| Address | https://qbittorrent.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8082 (`QBITTORRENT_PORT`) |
| Depends on | `gluetun` |
| Data | `data/appdata/qbittorrent` → `/config`<br>`/Volumes/Media/downloads` → `/downloads` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Downloads for Sonarr, Radarr, Lidarr, and LazyLibrarian, only ever through the VPN.

## Setup

1. Set `PROTONVPN_WIREGUARD_PRIVATE_KEY` ([Gluetun](<Gluetun.md>)), then `./homelab install qbittorrent` (it also comes with the Media automation bundle, `./homelab install @arr`); with a domain, also `./homelab domain setup`.
2. The first start prints a temporary password: `./homelab logs qbittorrent`. Sign in at the address Status shows (`https://<TAILSCALE_HOST>:8082` in Home mode, https://qbittorrent.example.com with a domain) as `admin` and set a permanent password (Tools › Options › Web UI).
3. Options › Downloads: default save path `/downloads`.
4. Options › Connection: listening port = Gluetun's forwarded port.
5. Options › Advanced: network interface `tun0`, so it cannot use any other route even by mistake.

The *arr apps reach it at host `gluetun`, port `8082`.

## How it works

- qBittorrent is a C++ and Qt program built on the libtorrent library; this image runs it without a desktop window (`qbittorrent-nox`), so you use the Web UI. `WEBUI_PORT: "8082"` sets that port.
- Its settings live in `qBittorrent.conf`; each torrent's state (resume data and the `.torrent` file) lives in `BT_backup`, which is how it picks up where it left off after a restart.
- It runs inside [Gluetun](<Gluetun.md>)'s network (`network_mode: service:gluetun`), so it has no address of its own. Peers reach it through the ProtonVPN forwarded port; you and the *arr apps reach it at `gluetun:8082`.
- The *arr apps add torrents through its Web API with a category, poll the API for progress, and import the finished files from `/downloads`.
- With Options › Downloads › Default Torrent Management Mode set to Automatic, each category is saved in its own subfolder of `/downloads` (for example `/downloads/tv`); in Manual mode everything goes to the default save path.

## Where things live

| What | Where |
|---|---|
| Settings | `data/appdata/qbittorrent/qBittorrent/qBittorrent.conf` (`/config/qBittorrent/qBittorrent.conf`) |
| Torrent list and resume data | `data/appdata/qbittorrent/qBittorrent/BT_backup/` |
| Logs | `data/appdata/qbittorrent/qBittorrent/logs/qbittorrent.log` |
| Downloads | `DOWNLOADS_ROOT`, default `/Volumes/Media/downloads` → `/downloads` |

Sonarr, Radarr, Lidarr, and LazyLibrarian mount the same folder at the same `/downloads` path, so no remote path mapping is needed. The libraries are separate mounts in those apps, so imports are copies rather than hard links; [Sonarr](<Sonarr.md#where-things-live>) has the whole layout.

## Everyday use

- The sidebar filters by status (Downloading, Seeding, Stalled) and by category (`tv`, `movies`, `music`, and so on).
- Right-click a torrent to pause or resume it, force a recheck, change its category, or delete it with or without its files.
- The speed icons at the bottom switch to the alternative speed limits, for example while you are on a video call.
- Tools › Options › Speed and Options › BitTorrent: global speed limits and seeding limits.
- View › Log: the execution log, with connection and listening-port messages.
- On Android, nzb360 works with qBittorrent's Web API.

## Connects to

- [Gluetun](<Gluetun.md>) is its only way out; when Gluetun is recreated, restart qBittorrent.
- [Sonarr](<Sonarr.md>), [Radarr](<Radarr.md>), [Lidarr](<Lidarr.md>), and [LazyLibrarian](<LazyLibrarian.md>) use it as their download client with host `gluetun`, port `8082`, and the Web UI login. [Prowlarr](<Prowlarr.md>) can too.
- `./homelab wire` adds it to Sonarr, Radarr, and Lidarr. It needs the permanent Web UI password: add `QBITTORRENT_PASSWORD` (and `QBITTORRENT_USER` if it is not `admin`) to `.env`, then run `./homelab wire --apply`. See [Prowlarr](<Prowlarr.md#connects-to>).
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) proxies https://qbittorrent.example.com to `gluetun:8082`.
- `.env`: `QBITTORRENT_PORT` (published on Gluetun), `DOWNLOADS_ROOT`, `PUID`, `PGID`, `TZ`, and `QBITTORRENT_USER` and `QBITTORRENT_PASSWORD` for `./homelab wire`.

## Tinkering ideas

- Options › BitTorrent: seeding limits (a ratio or a time) that stop the torrent when reached, so the *arr apps' Remove Completed option can clean up the downloads.
- Options › Downloads: set Default Torrent Management Mode to Automatic, so each category gets its own folder under `/downloads`.
- Options › Downloads: Keep incomplete torrents in `/downloads/incomplete`, so half-finished files never sit next to finished ones.
- Options › Speed: schedule the alternative speed limits for the hours the household needs the bandwidth.
- Options › Web UI: turn on Use alternative WebUI, or add the VueTorrent mod to the LinuxServer image (`DOCKER_MODS`, a compose change), for a friendlier, phone-sized UI.

## Useful commands

Follow the log, check that qBittorrent's own traffic leaves through ProtonVPN, look at the downloads folder, and restart it after Gluetun.

```zsh
./homelab logs qbittorrent -f
./homelab compose qbittorrent exec qbittorrent curl -s https://ipinfo.io/ip
./homelab compose qbittorrent exec qbittorrent ls /downloads
./homelab compose qbittorrent restart qbittorrent
```

## API

The Web API is at `http://localhost:8082/api/v2/` (`http://gluetun:8082/api/v2/` from other containers). It uses the Web UI login: sign in once to get a session cookie, then send it with each call. This signs in and lists the torrents that are downloading:

```zsh
curl -s -c /tmp/qbt.cookie --data-urlencode 'username=admin' --data-urlencode 'password=YOUR_PASSWORD' http://localhost:8082/api/v2/auth/login
curl -s -b /tmp/qbt.cookie 'http://localhost:8082/api/v2/torrents/info?filter=downloading'
```

The Web API reference is linked from the [qBittorrent wiki](https://github.com/qbittorrent/qBittorrent/wiki).

## Learn more

- [qBittorrent](https://www.qbittorrent.org)
- [qBittorrent on GitHub](https://github.com/qbittorrent/qBittorrent) and its [wiki](https://github.com/qbittorrent/qBittorrent/wiki)
- [LinuxServer image](https://github.com/linuxserver/docker-qbittorrent) and its [docs](https://docs.linuxserver.io/images/docker-qbittorrent/)

## Backup

`data/appdata/qbittorrent` (settings, torrent list) is in the Homelab AppData job. Downloads are not backed up.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Web UI unreachable | Gluetun is down or was recreated. `./homelab restart gluetun qbittorrent` |
| "Unauthorized" through the proxy | Options › Web UI: turn off Host header validation, or add `qbittorrent.example.com` to the allowed domains |
| Slow or no peers | The listening port does not match Gluetun's forwarded port |
