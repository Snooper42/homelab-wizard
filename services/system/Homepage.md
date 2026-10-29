---
version: 0.14.0
---

# Homepage

A fast, static dashboard configured with YAML files: links, bookmarks, and service widgets.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `homepage` in `compose/system.yaml` (project `homelab_system`) |
| Image | `ghcr.io/gethomepage/homepage:latest` |
| Category | System |
| Starts with `./homelab up` | No: optional, `./homelab install homepage` |
| Address | https://homepage.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3000 (`HOMEPAGE_PORT`) |
| Data | `data/appdata/homepage` → `/app/config` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

A start page for the household: one address with every app on it, kept up to date by the homelab. An alternative to Homarr, whose page you arrange by hand. Install one or the other.

## Setup

1. `./homelab install homepage` and open `https://<TAILSCALE_HOST>:3000` in Home mode, or `https://homepage.example.com` with a domain (after `./homelab domain setup`).
2. The homelab writes `services.yaml` for you: every running app with its `https://` address, its icon, and what it does, grouped like Choose stacks. It is rewritten after each install, start, stop, or removal (or with `./homelab homepage`), so the page always matches what runs.
3. To keep your own list instead, delete the file's first line (the marker); from then on the homelab leaves `services.yaml` alone. `bookmarks.yaml` and `widgets.yaml` are always yours.
4. For container status, install `docker-socket-proxy` and add it in `docker.yaml` as `host: docker-socket-proxy`, `port: 2375`.

## How it works

- A Next.js app with no database and no accounts: the page is built from YAML files in `/app/config`.
- Service widgets call each app's API from the Homepage server, not from your browser, so API keys in the YAML never reach the page.
- `./homelab homepage` writes `services.yaml` from the apps that run, with a marker on its first line; without the marker it leaves the file alone.
- With people in the household (`./homelab person add`), each gets a tab with only the apps they use, at `https://homepage.<domain>/#anna`, and every app moves to an *Everything* tab. That needs Homepage's `layout`, so the homelab writes `settings.yaml` too, with the same marker; a `settings.yaml` of your own is left alone (the tabs then show as groups on one page). `./homelab person apps anna immich-server mealie` chooses a person's apps.
- Most edits show on the next page reload; restart it if one does not.
- `HOMEPAGE_ALLOWED_HOSTS` lists the host names it answers to.

## Where things live

| What | Where |
|---|---|
| Config folder | `data/appdata/homepage` → `/app/config` |
| App list (written by the homelab) | `services.yaml` |
| Your links | `bookmarks.yaml` |
| Info widgets along the top | `widgets.yaml` |
| Title, theme, layout (the people's tabs; written by the homelab while it has the marker) | `settings.yaml` |
| Docker hosts for container status | `docker.yaml` |
| Your own styles and scripts | `custom.css`, `custom.js` |
| Log | `logs/homepage.log` |

## Everyday use

- Start typing anywhere on the page to search apps and bookmarks (Quick Launch); Enter opens the first match.
- Edit the YAML files in `data/appdata/homepage` with any editor, then reload the page.
- Set the page title, theme, and colour in `settings.yaml` (`title`, `theme`, `color`).

## Connects to

- Each tile links to the address Status shows: `https://<TAILSCALE_HOST>:<port>` in Home mode, or `https://<subdomain>.example.com` behind [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) with a domain.
- An alternative to [Homarr](<../system/Homarr.md>); run one or the other.
- Container status uses `docker-socket-proxy` (shared with [Dozzle](<../system/Dozzle.md>)). Homepage matches containers by name, and Compose names them `<project>-<service>-1`, for example `homelab_system-duplicati-1`.
- Service widgets exist for many apps here, such as [Immich](<../cloud and files/Immich.md>), [Paperless-ngx](<../documents/Paperless-ngx.md>), [Sonarr](<../media automation/Sonarr.md>), [Radarr](<../media automation/Radarr.md>), [AdGuard Home](<../network/AdGuard Home.md>), and [Uptime Kuma](<../security/Uptime Kuma.md>). Each needs that app's API key in a `widget:` block, so keep your own `services.yaml` (remove the marker) to use them.
- `.env`: `HOMEPAGE_PORT` and `HOMELAB_DOMAIN`, which make up `HOMEPAGE_ALLOWED_HOSTS`.

## Tinkering ideas

- Add the `resources` (CPU, memory, disk), `datetime`, and `search` widgets to `widgets.yaml`.
- Add an `openmeteo` weather widget with your town's coordinates.
- Add `siteMonitor: <url>` to a service to show its response time.
- Turn on container status: a `docker.yaml` entry, then `server:` and `container:` on each service.
- Group the family's links (school, bills, utilities) in `bookmarks.yaml`.
- Change how groups are laid out (columns, rows) under `layout:` in `settings.yaml`.

## Useful commands

Rewrite the app list, follow the logs, restart, check whether `services.yaml` still has the homelab's marker, read Homepage's own log, and check the page answers:

```zsh
./homelab homepage
./homelab logs homepage -f
./homelab compose homepage restart homepage
head -1 data/appdata/homepage/services.yaml
tail -f data/appdata/homepage/logs/homepage.log
curl -sI http://localhost:3000
```

## Learn more

- Docs, including every widget: https://gethomepage.dev/
- Source and image: https://github.com/gethomepage/homepage

## Backup

`data/appdata/homepage` is in the Homelab AppData job.

## Troubleshooting

"Host validation failed": open it at `https://homepage.example.com`, `https://<TAILSCALE_HOST>:3000`, or `http://localhost:3000`, the hosts in `HOMEPAGE_ALLOWED_HOSTS`.
