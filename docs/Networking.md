---
version: 0.1.0-alpha
---

# Networking

## LAN

| Property | Value |
|---|---|
| Gateway | The ISP's router, 192.168.1.1 (an example; use your own network's addresses) |
| Subnet | 192.168.1.0/24 |
| Homelab host | 192.168.1.10 (DHCP reservation for the interface in use) |
| VLANs | None |
| Port forwards | None |

## DNS

AdGuard Home on the Mac (port 53) answers for the LAN.

| Setting | Value |
|---|---|
| Rewrite | `*.example.com` → 192.168.1.10 (added by `./homelab domain setup`) |
| Upstream | Encrypted DNS of your choice, for example `https://dns.quad9.net/dns-query` and `https://cloudflare-dns.com/dns-query` |
| Bootstrap | 9.9.9.9, 1.1.1.1 |
| Clients | Each device's DNS is set to 192.168.1.10 by hand (when the router cannot hand it out), or Tailscale's DNS setting does it for every Tailscale device |

Because of the wildcard rewrite, every hostname, public or not, resolves to the Mac on the LAN, and LAN traffic never leaves the house. Outside the house only the public hostnames exist, as CNAME records to the tunnel.

For the Mac itself, Setup › **This Mac finds its apps by name** (`./homelab domain resolver`) writes `/etc/resolver/<domain>`: macOS then looks up every name under the domain in AdGuard Home, whatever DNS the network or a VPN sets (Proton VPN included, with *Allow LAN connections* on), and for apps added later too. The rest of its lookups are untouched. Without AdGuard, `./homelab domain setup --dns hosts` writes the hostnames into `/etc/hosts` on the Mac instead.

## Reverse proxy

Nginx Proxy Manager listens on 80 and 443 on every address of the Mac.

| Setting (every proxy host) | Value |
|---|---|
| Forward to | `http://<service>:<container port>` on the `homelab` network; `host.docker.internal:8096` for Jellyfin |
| Certificate | Wildcard `*.example.com` from Let's Encrypt, DNS challenge through Cloudflare |
| Force SSL, HTTP/2 | On |
| Block common exploits | On |
| Websockets | On |
| Trust forwarded proto | On (requests from the tunnel arrive as HTTP with `X-Forwarded-Proto: https`) |

`./homelab domain setup` creates and updates these; it matches hosts by name and changes only what differs. Hand-made proxy hosts are left alone. After it has run once, every install does the same for the apps it starts (`domain setup --auto`, `AUTO_DOMAIN=true`): their proxy hosts with the wildcard certificate, with no prompt. With `/etc/hosts` instead of AdGuard, run Set up the domain after an install to add the new names there (it asks for your password).

These automatic addresses are LAN only: an install adds proxy hosts, never tunnel hostnames. Publishing an app to the internet stays a deliberate **Set up the domain** (`./homelab domain setup --apply`), which also adds the public apps' tunnel hostnames.

### Home mode (no domain)

With `HOMELAB_DOMAIN` empty, none of the above is needed: Tailscale serves every app at `https://<TAILSCALE_HOST>:<port>` with its own certificate, on every device in the tailnet, at home and away. See [Tailscale](../services/network/Tailscale.md#home-mode-no-domain). Every new homelab starts this way (the default); set a domain later in Settings to switch to proxy addresses.

Each proxy host includes `/data/nginx/custom/server_proxy.conf`, which sets `real_ip_header CF-Connecting-IP` so tunnel visitors are logged (and judged by CrowdSec) by their real address. Proxy Manager already trusts private ranges, which include the cloudflared container.

## Docker network

| Network | Members |
|---|---|
| `homelab` (external, shared) | Every core service, cloudflared, and the web service of each stack |
| `homelab_immich_default` | Immich's server, machine learning, Redis, and database |
| `homelab_paperless_default` | Paperless and its database and broker |
| `homelab_budget_tracker_default` | MoneyMatter's five containers |

qBittorrent has no network of its own: it uses Gluetun's (`network_mode: service:gluetun`), so its traffic can only leave through ProtonVPN, and its web UI is reached as `gluetun:8082`.

## Cloudflare

| Item | Setting |
|---|---|
| Zone | example.com |
| SSL/TLS mode | Full (strict) |
| Always Use HTTPS | On |
| Minimum TLS | 1.2 |
| Tunnel | One remotely managed tunnel; connector is the `cloudflared` container |
| Public hostnames | One per app marked `public: true`, each to `http://nginx-proxy-manager:80`, written by `./homelab domain setup` |
| DNS records | A proxied CNAME per public hostname to `<tunnel id>.cfargotunnel.com` |
| Access / WARP | Not used ([Decisions](<Decisions.md>), ADR-0005) |

The API token in `CLOUDFLARE_API_TOKEN` needs Zone:Read and DNS:Edit on the zone, and Cloudflare Tunnel:Edit on the account.

## Traffic paths

```text
LAN:       device ─DNS→ AdGuard (*.example.com = 192.168.1.10)
           device ─HTTPS→ 192.168.1.10:443 → Proxy Manager (+CrowdSec) → service:port

Internet:  visitor ─HTTPS→ Cloudflare edge → tunnel → cloudflared
           cloudflared ─HTTP→ nginx-proxy-manager:80 (+CrowdSec, CF-Connecting-IP) → service:port
```
