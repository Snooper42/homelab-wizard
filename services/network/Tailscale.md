---
version: 0.14.0
---

# Tailscale

Reach the home network from anywhere, privately, without opening router ports

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `tailscale` in `compose/network.yaml` (project `homelab_network`) |
| Image | `tailscale/tailscale:latest` |
| Category | Network |
| Starts with `./homelab up` | No: optional, `./homelab install tailscale` |
| Data | `data/appdata/tailscale` → `/var/lib/tailscale` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Private access to the whole home network from anywhere: phones and laptops on your tailnet reach the proxy, AdGuard, and every app's address as if they were at home. It is a subnet router, so nothing else needs Tailscale installed, and no router ports are opened. Admin apps that stay off the public tunnel (Nginx Proxy Manager, AdGuard, Duplicati) become reachable this way.

## Setup

These steps make it a subnet router for the home network, which a homelab with a domain uses. In Home mode (the default), follow [Home mode](#home-mode-no-domain) below instead.

1. Check `TAILSCALE_ROUTES` matches the home network (for example `192.168.1.0/24`).
2. `./homelab install tailscale`, then `./homelab tailnet login`: it opens Tailscale's sign-in page in the browser (make a free account there if you have none) and carries on once you signed in. No auth key is needed; one in `TAILSCALE_AUTHKEY` (login.tailscale.com, Settings, Keys) signs it in without the browser instead.
3. In the Tailscale admin, open the `homelab` machine > Edit route settings, and approve the subnet route.
4. DNS > Nameservers > Add nameserver > Custom: `192.168.1.10`, restricted to the domain `example.com` (split DNS), so the app names resolve through AdGuard away from home.
5. Install Tailscale on the phone and sign in; with mobile data, `https://npm.example.com` should open.

## Home mode (no domain)

With `HOMELAB_DOMAIN` empty (the default), Tailscale gives every app its https address instead of the domain, AdGuard rewrites, Cloudflare, and the tunnel:

1. In the Tailscale admin, turn on DNS › MagicDNS and HTTPS Certificates.
2. Setup › **Addresses on your tailnet** (or `./homelab install tailscale` then `./homelab tailnet setup`). The first time, it opens Tailscale's sign-in page and waits until you signed in.
3. Each app is at `https://homelab.<tailnet>.ts.net:<its port>`, e.g. Vaultwarden at `:8087`. Status shows the addresses; they open on any device signed in to the same tailnet, at home or away. Nothing is published to the internet.

How it works: `homelab tailnet setup` writes `data/appdata/tailscale/serve.json` (`TS_SERVE_CONFIG`), one HTTPS listener per running app's port, forwarding to the app's container on the `homelab` network (`host.docker.internal` for native apps like Jellyfin), and saves the machine's tailnet name in `TAILSCALE_HOST`. Tailscale fetches a Let's Encrypt certificate for the name on first use, so the first visit can take a few seconds. Apps that need to know their own address (Vaultwarden, Paperless-ngx, Karakeep, MoneyMatter, Pocket ID, ntfy, and a few more) get the tailnet one in their `*_URL` setting and are restarted with it, so sign-in and links work. Every install reruns it, so new apps get an address by themselves. `TAILNET_ADMIN_APPS=false` keeps the admin apps (the proxy, AdGuard, Duplicati, Dozzle) off the tailnet, so only this machine opens them. Setting a domain later and running Set up the domain clears those settings again. `./homelab doctor` warns when the tailnet has no HTTPS certificates.

Useful commands:

```sh
./homelab compose tailscale exec tailscale tailscale status
./homelab compose tailscale exec tailscale tailscale serve status
./homelab compose tailscale exec tailscale tailscale cert homelab.<tailnet>.ts.net
```

## How it works

- `tailscaled` (Go) runs in userspace networking mode (`TS_USERSPACE`): WireGuard runs inside the process, so it needs no kernel module or extra privileges.
- It signs in to Tailscale's coordination server once, through the sign-in page `homelab tailnet login` opens (or with `TAILSCALE_AUTHKEY`), then keeps its identity in its state folder. Devices connect to it directly when they can, and through Tailscale's relays (DERP) when they cannot; traffic is end-to-end encrypted either way.
- As a subnet router it advertises `TAILSCALE_ROUTES` (`192.168.1.0/24`): your devices send traffic for that range to this container, which forwards it onto the home network.
- `TS_ACCEPT_DNS=false` keeps the container on Docker's DNS, so service names still resolve for it.
- In home mode, its HTTPS listeners come from `serve.json` (see above).

## Where things live

| What | Where |
|---|---|
| Machine identity and keys | `data/appdata/tailscale` → `/var/lib/tailscale` (`tailscaled.state`) |
| Home-mode listeners | `/var/lib/tailscale/serve.json` (`TS_SERVE_CONFIG`) |
| Certificates for the tailnet name | `/var/lib/tailscale/certs/` |
| Control socket | `/var/run/tailscale/tailscaled.sock` (`TS_SOCKET`) |
| Optional auth key, routes, tailnet name | `TAILSCALE_AUTHKEY`, `TAILSCALE_ROUTES`, `TAILSCALE_HOST` in `.env` |

## Everyday use

- The Tailscale app on iPhone, iPad, Android, Mac, and Windows: turn it on away from home, and the home addresses work as if you were there.
- Admin console (login.tailscale.com) › Machines: which devices are online, the `homelab` machine's routes, and renaming or removing devices.
- Admin console › Users: invite family members to the tailnet.
- `./homelab doctor` checks that it is logged in and its route is approved.

## Connects to

- Reaches [Nginx Proxy Manager](<Nginx Proxy Manager.md>) and every app's address on the LAN, and uses [AdGuard Home](<AdGuard Home.md>) (192.168.1.10) as the split-DNS nameserver for `example.com`.
- The way in for apps that stay off the tunnel: [AdGuard Home](<AdGuard Home.md>), [Duplicati](<../system/Duplicati.md>), [Pocket ID](<../security/Pocket ID.md>), [Uptime Kuma](<../security/Uptime Kuma.md>).
- The private alternative to [Cloudflare Tunnel](<Cloudflare Tunnel.md>). In home mode it replaces the domain, AdGuard's rewrite, the proxy, and the tunnel.
- `.env`: `TAILSCALE_AUTHKEY` (optional), `TAILSCALE_ROUTES`, `TAILSCALE_HOST`, and `HOMELAB_DOMAIN` (empty means home mode).

## Tinkering ideas

- Admin console › Machines › `homelab` › Disable key expiry, so the Mac does not drop off the tailnet when its key expires (every 180 days by default).
- Make it an exit node: set `TAILSCALE_EXTRA_ARGS=--advertise-exit-node` in `.env`, run `homelab install tailscale --apply`, approve it in the admin, and choose it in the phone's app to browse through home on public Wi-Fi.
- Run the tailnet yourself: with your own [Headscale](https://headscale.net) server, set `TAILSCALE_EXTRA_ARGS=--login-server=https://<your Headscale>` and an auth key from it in `TAILSCALE_AUTHKEY`. Headscale gives out no HTTPS certificates, so Home mode's https addresses do not open there; a domain does.
- Admin console › Access controls: limit which users or devices may use the `192.168.1.0/24` route.
- In the iPhone app's settings, turn on VPN On Demand so it connects by itself when you leave home Wi-Fi.
- `tailscale netcheck` (below): which relay is nearest and whether direct connections are possible from here.

## Useful commands

These add to the home-mode commands above. `tailscale ping` shows whether a device is reached directly or through a relay.

```zsh
./homelab logs tailscale -f
./homelab compose tailscale restart tailscale
./homelab compose tailscale exec tailscale tailscale ip -4
./homelab compose tailscale exec tailscale tailscale netcheck
./homelab compose tailscale exec tailscale tailscale ping <device>
./homelab tailnet setup
./homelab doctor
```

## Learn more

- [Tailscale docs](https://tailscale.com/kb), including [Tailscale in Docker](https://tailscale.com/kb/1282/docker) and [subnet routers](https://tailscale.com/kb/1019/subnets)
- [Source on GitHub](https://github.com/tailscale/tailscale)
- [Image on Docker Hub](https://hub.docker.com/r/tailscale/tailscale)

## Backup

`data/appdata/tailscale` holds the machine's identity and is covered by the AppData job. Without it, the machine signs in again (`./homelab tailnet login`).

## Troubleshooting

- **Routes do nothing:** the route was not approved in the admin, or `TAILSCALE_ROUTES` does not match the network; `./homelab doctor` says which, and whether Tailscale is still logged in.
- **Names do not resolve away from home:** the split-DNS nameserver is missing; addresses like `192.168.1.10` still work.
