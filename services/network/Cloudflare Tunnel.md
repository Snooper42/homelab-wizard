---
version: 0.10.0-beta
---

# Cloudflare Tunnel

Publishes the public apps on the internet without opening a single router port. cloudflared connects out to Cloudflare, and Cloudflare sends visitors back through that connection to Nginx Proxy Manager.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `cloudflared` in `stacks/cloudflare/compose.yaml` (project `homelab_cloudflare`) |
| Image | `cloudflare/cloudflared:latest` |
| Category | Network |
| Starts with `./homelab up` | Yes, once `TUNNEL_TOKEN` is set in .env |
| Updates | Watchtower, nightly at 4 AM |
| Needs in .env | `TUNNEL_TOKEN` |
<!-- END homelab:generated -->

## Purpose

- Remote access for the family to the public apps from anywhere, with nothing to install.
- Every public hostname goes to `http://nginx-proxy-manager:80`, so CrowdSec checks tunnel traffic exactly like LAN traffic.

## Setup

1. Cloudflare dashboard > Zero Trust > Networks > Tunnels > Create a tunnel > Cloudflared. Name it `homelab`.
2. Under the Docker install instructions, copy the token (the long value after `--token`) into `TUNNEL_TOKEN` in `.env`.
3. `./homelab up` starts cloudflared; the tunnel shows Healthy in the dashboard.
4. `./homelab domain setup` adds a public hostname for each app marked `public: true` and creates its proxied CNAME record. Routes you added by hand are kept.

## How it works

- `cloudflared` is a small Go program. It needs no open port: it dials out to Cloudflare and keeps several connections open to nearby Cloudflare data centres.
- The tunnel is remotely managed: its routes (public hostnames) live in your Cloudflare account, and the container only holds the token. Route changes reach cloudflared without a restart.
- A visitor's request goes Cloudflare's edge (TLS, firewall rules, DDoS protection) → the tunnel → `http://nginx-proxy-manager:80` on the `homelab` network → the app. Cloudflare holds the public certificate; inside the tunnel the request is plain HTTP to the proxy.
- The proxy reads the visitor's real address from `CF-Connecting-IP`, so CrowdSec judges the visitor, not the tunnel.
- `./homelab domain setup` writes the routes and the DNS records through the Cloudflare API with `CLOUDFLARE_API_TOKEN`. It adds and updates; it never removes routes.

## Where things live

Nothing is stored on this Mac apart from `.env`.

| What | Where |
|---|---|
| Tunnel token | `TUNNEL_TOKEN` in `.env`, passed to the container's environment |
| Token for `domain setup` | `CLOUDFLARE_API_TOKEN` in `.env` |
| Routes (public hostnames) | The tunnel's page under Zero Trust › Networks › Tunnels |
| DNS records | Cloudflare dashboard › example.com › DNS: a proxied CNAME per public app to `<tunnel id>.cfargotunnel.com` |
| Logs | Container output only: `./homelab logs cloudflared` |

## Everyday use

Mostly nothing: it reconnects by itself after a restart or an outage.

- **Health:** Zero Trust › Networks › Tunnels shows the tunnel as Healthy, with the connector's version and the data centres it is connected to.
- **Publish an app:** add `public: true` to its `x-homelab` block and run `./homelab domain setup`.
- **Unpublish an app:** remove the flag, then delete its route on the tunnel's page and its DNS record by hand.
- **Traffic:** the zone's Analytics and Security pages in the Cloudflare dashboard show visitors and what Cloudflare blocked.

## Connects to

- Every route ends at [Nginx Proxy Manager](<Nginx Proxy Manager.md>), so [CrowdSec](<../security/CrowdSec.md>) bans apply to tunnel visitors too.
- The public apps: [Vaultwarden](<../security/Vaultwarden.md>), [ntfy](<../security/ntfy.md>) (once its token exists), [Immich](<../cloud and files/Immich.md>), [Paperless-ngx](<../documents/Paperless-ngx.md>), [Navidrome](<../media/Navidrome.md>), [Feishin](<../media/Feishin.md>), [Audiobookshelf](<../media/Audiobookshelf.md>), [Calibre-Web](<../media/Calibre-Web.md>), and [Komga](<../media/Komga.md>).
- `.env`: `TUNNEL_TOKEN`, `CLOUDFLARE_API_TOKEN` (Zone:Read and DNS:Edit on the zone, Cloudflare Tunnel:Edit on the account), and `HOMELAB_DOMAIN`.
- The watchdog's public checks alert through [ntfy](<../security/ntfy.md>) on `tunnel-watchdog`.
- [Tailscale](<Tailscale.md>) is the private way in for apps that should not be public. The zone settings are in [Networking](<../../docs/Networking.md>).

## Tinkering ideas

- Security › WAF › Custom rules: block countries you never visit from. Use Block, not a challenge: the native apps cannot answer challenges ([Decisions](<../../docs/Decisions.md>), ADR-0005).
- Notifications in the Cloudflare dashboard: add a tunnel health alert, so you also get an email when the tunnel goes down.
- Look at the zone's Analytics now and then to see which public apps get traffic and from where.
- Run `./homelab domain setup` without `--apply`: it shows the plan and asks before it changes anything.

## Useful commands

`dig` against 1.1.1.1 shows what the internet sees (Cloudflare's addresses, not 192.168.1.10), and the `curl` request takes the same path as a visitor's when run away from home.

```zsh
./homelab logs cloudflared -f
./homelab compose cloudflared restart cloudflared
./homelab compose cloudflared exec cloudflared cloudflared --version
./homelab domain setup
./homelab watchdog
dig +short passwords.example.com @1.1.1.1
curl -sI https://passwords.example.com
```

## Learn more

- [Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/) (Tunnel is part of it)
- [cloudflared on GitHub](https://github.com/cloudflare/cloudflared)
- [Image on Docker Hub](https://hub.docker.com/r/cloudflare/cloudflared)

## Backup

Nothing local: the tunnel's configuration lives in Cloudflare, and the token is in `.env` (Homelab Secrets job).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Cloudflare error 1033 | The tunnel is not connected. `./homelab logs cloudflared`; check `TUNNEL_TOKEN` |
| Cloudflare 502 | Proxy Manager is down, or the route does not point at `http://nginx-proxy-manager:80` |
| Proxy Manager's default page | No proxy host for that hostname. `./homelab domain setup` |
| Too many redirects | The proxy host does not trust forwarded proto. `./homelab domain setup` |
| Token lost | Copy it again from the tunnel's page (or create a new tunnel) and rerun `./homelab domain setup` |

The watchdog checks every public hostname every 15 minutes and alerts `tunnel-watchdog`.
