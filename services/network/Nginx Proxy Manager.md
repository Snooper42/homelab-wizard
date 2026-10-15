---
version: 0.1.0-alpha
---

# Nginx Proxy Manager

The front door: every request, from the LAN or through the Cloudflare Tunnel, enters here. It terminates TLS and forwards to the app by service name. The image is built locally with CrowdSec's bouncer inside.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `nginx-proxy-manager` in `compose/network.yaml` (project `homelab_network`) |
| Image | Built locally from `dockerfiles/npm-crowdsec` |
| Category | Network |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://npm.example.com (LAN, through Nginx Proxy Manager) |
| On this Mac | http://localhost:8181 (`NPM_ADMIN_PORT`) |
| Data | `data/appdata/nginx-proxy-manager/data` → `/data`<br>`data/appdata/nginx-proxy-manager/letsencrypt` → `/etc/letsencrypt`<br>`npm-logs (volume)` → `/data/logs` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/nginx-proxy-manager` |
| Updates | Built locally: `./homelab update nginx-proxy-manager` rebuilds it. Carries the CrowdSec bouncer; pulling the upstream image would silently drop it |
<!-- END homelab:generated -->

## Purpose

- One entry point on ports 80 and 443 for every hostname.
- TLS with a wildcard certificate for `*.example.com` (Let's Encrypt, Cloudflare DNS challenge).
- Enforces CrowdSec's decisions on every request before it reaches an app.

## Setup

1. The first start creates the automation account from `NPM_API_EMAIL` and `NPM_API_PASSWORD`. There is no default login.
2. Sign in at http://localhost:8181 with that account. Under Users, add a personal administrator and turn on 2FA for it. Leave 2FA off on the automation account; the CLI signs in with it.
3. `./homelab domain setup --ssl` issues the certificate and creates a proxy host for every app.
4. For a proxy host made by hand: scheme `http`, forward host is the service name, port is the container port, the wildcard certificate, Force SSL, HTTP/2, websockets, Block common exploits, and trust upstream forwarded proto headers on.

**The image:** `dockerfiles/npm-crowdsec` adds `lua-cs-bouncer` and `lua-resty-http` to `jc21/nginx-proxy-manager`. At start, `homelab-init.sh` writes the bouncer configuration from `CROWDSEC_API_URL` and `CROWDSEC_API_KEY`, and creates `/data/nginx/custom/server_proxy.conf` (`real_ip_header CF-Connecting-IP`) if it is missing. To update, set `NPM_VERSION` and run `./homelab update nginx-proxy-manager`; never pull the upstream image.

## How it works

- Two parts in one container: OpenResty (nginx with Lua) does the proxying on ports 80 and 443, and a Node.js app serves the admin UI and its API on port 81 (`8181` on this Mac).
- The admin app keeps hosts, certificates, users, and settings in SQLite (`/data/database.sqlite`), writes one nginx config file per host, and reloads nginx. Hand edits to those files are lost the next time the host is saved; use the host's Advanced tab or `/data/nginx/custom/` instead.
- Certificates come from Let's Encrypt through certbot. The wildcard uses the Cloudflare DNS challenge, and Proxy Manager renews it before it expires.
- Requests go to apps by service name on the `homelab` network (`http://<service>:<port>`), and to native Jellyfin through `host.docker.internal`.
- The Lua bouncer checks every request against CrowdSec's decisions (refreshed every 10 seconds) and asks CrowdSec's AppSec component (`http://crowdsec:7422`) about it. If CrowdSec does not answer, requests go through (fail open).
- Access and error logs go to `/data/logs` (the `npm-logs` volume), which CrowdSec reads.

## Where things live

| What | Where |
|---|---|
| Settings database (hosts, users, certificates) | `data/appdata/nginx-proxy-manager/data/database.sqlite` → `/data/database.sqlite` |
| Generated config, one file per proxy host | `data/appdata/nginx-proxy-manager/data/nginx/proxy_host/<id>.conf` → `/data/nginx/proxy_host/` |
| Snippets included in every host | `data/appdata/nginx-proxy-manager/data/nginx/custom/` → `/data/nginx/custom/` (`server_proxy.conf` sets `CF-Connecting-IP`) |
| Certificates and certbot state | `data/appdata/nginx-proxy-manager/letsencrypt` → `/etc/letsencrypt` (`live/npm-<id>/`) |
| Access and error logs | `npm-logs` volume → `/data/logs` (`proxy-host-<id>_access.log`, `proxy-host-<id>_error.log`) |
| CrowdSec bouncer settings | `/etc/crowdsec/bouncers/crowdsec-openresty-bouncer.conf`, written from `.env` at every start |
| Bouncer hook into nginx | `/etc/nginx/conf.d/crowdsec_openresty.conf`, from `dockerfiles/npm-crowdsec` |

## Everyday use

- **Hosts › Proxy Hosts:** every hostname with its target and certificate. The menu on each row edits, disables, or deletes it; `./homelab domain setup` keeps the apps' hosts in line.
- **SSL Certificates:** the wildcard's expiry date, and Renew Now from its menu if a renewal failed.
- **Access Lists:** require a username and password, or allow only some addresses, then pick the list on a host's Details tab.
- **Users:** your administrator (2FA on) and the automation account (leave it as `.env` says).
- **Audit Log:** who changed what in the UI, and when.
- **Settings › Default Site:** what an unknown hostname shows.

## Connects to

- LAN requests arrive by name through [AdGuard Home](<AdGuard Home.md>); public requests come from [Cloudflare Tunnel](<Cloudflare Tunnel.md>) to `http://nginx-proxy-manager:80`.
- [CrowdSec](<../security/CrowdSec.md>) reads its logs, and its bouncer enforces CrowdSec's bans with `CROWDSEC_BOUNCER_KEY` (passed in as `CROWDSEC_API_KEY`).
- `.env`: `NPM_API_EMAIL` and `NPM_API_PASSWORD` (the automation account the CLI signs in with), `NPM_VERSION` (the upstream version the image builds on), `NPM_HTTP_PORT`, `NPM_HTTPS_PORT`, `NPM_ADMIN_PORT`, `LAN_BIND_IP`, and `CLOUDFLARE_API_TOKEN` for the wildcard's DNS challenge.
- [Watchtower](<../system/Watchtower.md>) leaves it alone (built locally). [Uptime Kuma](<../security/Uptime Kuma.md>) checks `http://nginx-proxy-manager:81`.
- In home mode (no domain) it is not used: [Tailscale](<Tailscale.md>) serves the apps.

## Tinkering ideas

- Settings › Default Site: answer unknown hostnames with a 404 page instead of the welcome page, so scanners learn less.
- Access Lists: put a password in front of an app that has no login of its own. `./homelab domain setup` keeps access lists, custom locations, and the Advanced tab when it updates a host.
- A host's Advanced tab: per-host nginx directives, such as `client_max_body_size` for large uploads or extra security headers.
- Hosts › Redirection Hosts: send a short name, such as `pw.example.com`, to the real address.
- Run the ban test in [Runbooks](<../../docs/Runbooks.md>) and look at the 403 page the bouncer serves.
- Tail one host's access log (below) to see who visits and which paths scanners try.

## Useful commands

`nginx -t` checks the generated config without changing anything. Proxy host ids are in the file names under `/data/nginx/proxy_host`.

```zsh
./homelab logs nginx-proxy-manager -f
./homelab compose nginx-proxy-manager restart nginx-proxy-manager
./homelab compose nginx-proxy-manager exec nginx-proxy-manager nginx -t
./homelab compose nginx-proxy-manager exec nginx-proxy-manager ls /data/nginx/proxy_host
./homelab compose nginx-proxy-manager exec nginx-proxy-manager tail -f /data/logs/proxy-host-1_access.log
./homelab compose nginx-proxy-manager exec nginx-proxy-manager grep -E '^(ENABLED|API_URL|MODE)=' /etc/crowdsec/bouncers/crowdsec-openresty-bouncer.conf
./homelab update nginx-proxy-manager
./homelab domain setup --ssl
```

## API

- The admin UI is built on a JSON API at `http://localhost:8181/api`; `./homelab domain setup` uses it.
- Get a token by posting the automation account (`NPM_API_EMAIL`, `NPM_API_PASSWORD`) to `/api/tokens`, then send it as `Authorization: Bearer <token>`:

```zsh
curl -s -X POST http://localhost:8181/api/tokens -H 'Content-Type: application/json' -d '{"identity":"homelab@example.com","secret":"<NPM_API_PASSWORD>"}'
curl -s http://localhost:8181/api/nginx/proxy-hosts -H 'Authorization: Bearer <token>'
```

- There is no separate API reference site; the request shapes are in the source repo's `backend` folder.

## Learn more

- [Nginx Proxy Manager docs](https://nginxproxymanager.com/)
- [Source on GitHub](https://github.com/NginxProxyManager/nginx-proxy-manager)
- [Upstream image on Docker Hub](https://hub.docker.com/r/jc21/nginx-proxy-manager) (the base of `dockerfiles/npm-crowdsec`)
- [CrowdSec Lua bouncer](https://github.com/crowdsecurity/lua-cs-bouncer)

## Backup

`data/appdata/nginx-proxy-manager` (settings database, proxy hosts, certificates) is in the Homelab AppData job. Logs live in the `npm-logs` volume and are not backed up. Everything except hand-made hosts can also be recreated with `./homelab domain setup --ssl`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| 502 Bad Gateway | The app is stopped or not on the `homelab` network. `./homelab status`; check the forward host is the service name |
| Too many redirects through the tunnel | Trust forwarded proto is off on that host. Rerun `./homelab domain setup` |
| Proxy Manager's default page for a hostname | No proxy host for it. `./homelab domain setup` |
| `homelab-init: CROWDSEC_API_KEY is empty` in the logs | Set `CROWDSEC_BOUNCER_KEY` and `./homelab update nginx-proxy-manager` |
| Bans not enforced | `cscli bouncers list` must show a recent pull; see [CrowdSec](<../security/CrowdSec.md>) |
| CLI says the login was rejected | The automation account was changed in the UI. Make the UI match `.env` again |
| Certificate did not renew | The Cloudflare token expired or lost DNS:Edit. Renew from SSL Certificates once fixed |
