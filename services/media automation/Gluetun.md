---
version: 0.17.0
---

# Gluetun

A ProtonVPN WireGuard tunnel. qBittorrent and [SABnzbd](<SABnzbd.md>) share Gluetun's network, so their traffic can only leave through the VPN; if the tunnel drops, they have no network at all.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `gluetun` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `qmcgaw/gluetun:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install gluetun` |
| Data | `data/appdata/gluetun` → `/gluetun` |
| Updates | Nightly at 4 AM, with a copy of its data first |
| Needs in .env | `PROTONVPN_WIREGUARD_PRIVATE_KEY` |
<!-- END homelab:generated -->

## Purpose

- Kill switch for downloads: qBittorrent has no route except the VPN.
- ProtonVPN port forwarding (P2P servers only) for better connectivity.
- Publishes qBittorrent's and SABnzbd's web UIs (`QBITTORRENT_PORT`, `SABNZBD_PORT`), because they have no network of their own.

## Setup

1. ProtonVPN account › Downloads › WireGuard configuration: create a configuration with NAT-PMP (port forwarding) on.
2. Copy only the `PrivateKey` value into `PROTONVPN_WIREGUARD_PRIVATE_KEY` in `.env`. Optionally set `PROTONVPN_SERVER_COUNTRIES`.
3. `./homelab install qbittorrent` (starts Gluetun first and waits until it is healthy).
4. Nothing to type: Setup's **Downloads are private** turns green once qBittorrent lives in Gluetun's network, the VPN is connected, and qBittorrent is tied to the tunnel (qBittorrent's page shows the same). To see the exit address yourself:

   ```bash
   cat data/appdata/gluetun/ip
   ```

5. Nothing to copy: Gluetun gives qBittorrent the forwarded port each time the VPN connects, and **Connect apps** checks it (*qBittorrent takes the VPN's forwarded port by itself*).

## How it works

- Gluetun is a single Go program that sets up the VPN, a firewall, and a DNS resolver inside its container.
- On start it picks a ProtonVPN server from its server list: only servers with port forwarding (`PORT_FORWARD_ONLY: "on"`), limited to `PROTONVPN_SERVER_COUNTRIES` if set. It then brings up WireGuard with your private key.
- Its firewall drops everything that does not go through the tunnel. This is the kill switch: when the tunnel is down, nothing leaves.
- DNS queries are answered by its own resolver, which forwards them over an encrypted connection, so they do not leak to your home router.
- With `VPN_PORT_FORWARDING: "on"` it asks ProtonVPN for a forwarded port (NAT-PMP) and keeps renewing it, so peers can connect in to qBittorrent.
- Each time it has a port, `VPN_PORT_FORWARDING_UP_COMMAND` posts it to qBittorrent's Web API on the loopback the two share (`127.0.0.1:8082`, `listen_port` and the network interface `tun0`), trying for up to five minutes while qBittorrent starts. qBittorrent lets that one address in without its login (*Bypass authentication for clients on localhost*, `bypass_local_auth`), which only Gluetun and qBittorrent can use: everything else, the proxy and this computer included, reaches qBittorrent from another address and still signs in. When the VPN drops, `VPN_PORT_FORWARDING_DOWN_COMMAND` puts qBittorrent on no port and the loopback until it's back. The port is also written to `data/appdata/gluetun/forwarded_port` (`VPN_PORT_FORWARDING_STATUS_FILE`), where **Connect apps** reads it and sets it if qBittorrent missed it.
- Each time it connects it asks, through the tunnel, which address it reached the internet from, and writes it to `data/appdata/gluetun/ip` (`PUBLICIP_FILE`); when it stops it empties the file. **Downloads are private** reads that file, so the homelab asks no outside service itself.
- It checks the tunnel all the time and reconnects when it fails. Docker's health check reads that state; qBittorrent waits for it (`depends_on: service_healthy`).
- [qBittorrent](<qBittorrent.md>) runs with `network_mode: service:gluetun`: it has no network of its own and uses Gluetun's. That is why qBittorrent's Web UI port (`QBITTORRENT_PORT`, default `8082`) is published on Gluetun, and why other containers reach qBittorrent at `gluetun:8082`.

## Where things live

| What | Where |
|---|---|
| ProtonVPN server list | `data/appdata/gluetun/servers.json` (`/gluetun/servers.json`) |
| Forwarded port | `data/appdata/gluetun/forwarded_port` (rewritten on each connect) |
| Exit address | `data/appdata/gluetun/ip` (written on each connect, emptied when it stops) |
| WireGuard private key | `.env` → `PROTONVPN_WIREGUARD_PRIVATE_KEY` (passed in as `WIREGUARD_PRIVATE_KEY`) |
| Server countries | `.env` → `PROTONVPN_SERVER_COUNTRIES` (passed in as `SERVER_COUNTRIES`) |
| Logs | `./homelab logs gluetun` (no log file) |

## Everyday use

There is nothing to click: Gluetun has no web UI. The things you do with it:

- After a change, look at Setup's **Downloads are private** (Setup step 4).
- Change the country: set `PROTONVPN_SERVER_COUNTRIES` (comma-separated, for example `Netherlands,Switzerland`), then `./homelab update gluetun qbittorrent` to recreate both.

## Connects to

- [qBittorrent](<qBittorrent.md>) lives in its network; restart qBittorrent whenever Gluetun is recreated.
- [Prowlarr](<Prowlarr.md>) lives in its network too while searching goes through the VPN (`SEARCH_THROUGH_VPN`, on by default), and reaches Sonarr, Radarr, Lidarr and FlareSolverr by name from there (Gluetun v3.41 and later). Gluetun's firewall drops everything but the tunnel, IPv6 included (its `ip6tables` policies are DROP whenever the container has IPv6 at all; Docker's default networks give it none), so neither app can leave through the home connection by IPv6 either.
- [Sonarr](<Sonarr.md>), [Radarr](<Radarr.md>), [Lidarr](<Lidarr.md>), and [LazyLibrarian](<LazyLibrarian.md>) reach qBittorrent through it at `gluetun:8082`. `./homelab wire` derives that address from qBittorrent's `network_mode`.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) sends https://qbittorrent.example.com to `gluetun:8082` (the `proxy_host` in qBittorrent's `x-homelab`).
- `./homelab install qbittorrent` skips both apps until `PROTONVPN_WIREGUARD_PRIVATE_KEY` is set.
- `.env`: `PROTONVPN_WIREGUARD_PRIVATE_KEY`, `PROTONVPN_SERVER_COUNTRIES`, `QBITTORRENT_PORT`, `TZ`.

## Tinkering ideas

- Pin a city or a server instead of a country with Gluetun's `SERVER_CITIES` or `SERVER_HOSTNAMES` settings (a change to its `environment` in `compose/media-automation.yaml`).
- Gluetun can also offer an HTTP proxy (`HTTPPROXY: "on"`, port `8888`) so another container, such as Prowlarr, can send its traffic through the VPN (also a compose change).
- [Uptime Kuma](<../security/Uptime Kuma.md>): an HTTP monitor on `http://gluetun:8082` warns you when the tunnel, and with it qBittorrent, goes away.

## Useful commands

Follow the log, find the forwarded port, check the exit address, and restart both containers.

```zsh
./homelab logs gluetun -f
cat data/appdata/gluetun/forwarded_port
./homelab logs gluetun | grep -i "port forward"
cat data/appdata/gluetun/ip
./homelab compose gluetun ps
./homelab compose gluetun restart gluetun qbittorrent
```

## Learn more

- [Gluetun on GitHub](https://github.com/qdm12/gluetun) (code and image)
- [Gluetun wiki](https://github.com/qdm12/gluetun-wiki), including the ProtonVPN provider page and port forwarding

## Backup

`data/appdata/gluetun` holds only a server list; it is in the AppData job but nothing is lost without it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Won't start: key missing | Set `PROTONVPN_WIREGUARD_PRIVATE_KEY` |
| Unhealthy, no handshake | The key was revoked or the configuration lacks port forwarding. Create a new one |
| qBittorrent unreachable after Gluetun restarted | qBittorrent lost its network. `./homelab restart qbittorrent` |
| qBittorrent's listening port isn't the forwarded one | Gluetun couldn't reach qBittorrent within five minutes. Run **Connect apps** (it sets the port from `forwarded_port`), or `./homelab compose gluetun restart gluetun qbittorrent`; the log's port forwarding lines show the command's answer |
