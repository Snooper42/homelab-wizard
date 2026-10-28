---
version: 0.10.0-beta
---

# Dozzle

Live logs of every container, in the browser

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `dozzle` in `compose/system.yaml` (project `homelab_system`) |
| Image | `amir20/dozzle:latest` |
| Category | System |
| Starts with `./homelab up` | No: optional, `./homelab install dozzle` |
| Address | this computer only: it has no sign-in of its own, so it gets no tailnet or domain address |
| On this machine | http://localhost:9998 (`DOZZLE_PORT`) |
| Depends on | `docker-socket-proxy` |
| Helpers | `docker-socket-proxy` `ghcr.io/tecnativa/docker-socket-proxy:v0.5.0` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Live logs from every container in the browser, with search and filters. The first stop when an app misbehaves, instead of `./homelab logs` in a terminal.

## Setup

1. `./homelab install dozzle` (it brings the read-only Docker socket proxy with it).
2. Open it; there is no account, so it is never published through the tunnel. In Home mode it is on the tailnet like the other admin apps; `TAILNET_ADMIN_APPS=false` keeps it to this machine.
3. Anyone who can open it reads every container's log, including the line where Nginx Proxy Manager printed its first account's password on its first start. If others use your network or tailnet, change that password in the NPM UI and put the new one in `NPM_API_PASSWORD`.

## How it works

- A single Go program that serves the web page and streams each container's log to it as lines are written.
- It reads containers and logs from the Docker engine through `docker-socket-proxy` (`DOCKER_HOST: tcp://docker-socket-proxy:2375`), which only allows listing containers and reading engine info. Dozzle cannot start, stop, or change anything.
- It stores nothing. The history it shows is what Docker still keeps: every service here logs with the `json-file` driver, at most 3 files of 10 MB per container, so older lines of a busy container roll off.
- Anonymous usage reporting is off (`DOZZLE_NO_ANALYTICS`).

## Everyday use

- Pick a container in the left column; containers are grouped by Compose project (`homelab_media`, `homelab_immich`, and so on).
- Type in the search box above a log to filter its lines, and use the level filter (error, warning, info) for apps that write levelled logs.
- Open a second container beside the first to follow two at once, for example Sonarr and qBittorrent during a download.
- Press ⌘K to jump to a container by name.
- Download a log from the toolbar to attach it to a bug report.

## Connects to

- Shares `docker-socket-proxy` with [Homarr](<../system/Homarr.md>), and with [Homepage](<../system/Homepage.md>) if you give it container status.
- Opened on this computer only (Status › an app's log › **Open Dozzle**, or `http://localhost:9998`): it has no sign-in of its own and logs can hold secrets, so it gets no address on the tailnet or the domain ([Security](<../../docs/Security.md>), L1). A proxy host or tailnet address made before this change goes away the next time `./homelab domain setup` or `./homelab tailnet setup` runs.
- Pairs with [Uptime Kuma](<../security/Uptime Kuma.md>): Kuma says something is down, Dozzle shows why.
- `.env`: `DOZZLE_PORT`.

## Tinkering ideas

- Show only some containers with `DOZZLE_FILTER` in its `environment`, for example `label=com.docker.compose.project=homelab_media`.
- Give a container a friendlier name or group with the labels `dev.dozzle.name` and `dev.dozzle.group` on its service.
- Add a sign-in: `DOZZLE_AUTH_PROVIDER: simple` with a `users.yml` in a `/data` volume (see the authentication page of its docs).
- Leave container actions off: the socket proxy is read-only on purpose, and `DOZZLE_ENABLE_ACTIONS` would also need write access to the engine.

## Useful commands

Its logs, the socket proxy it depends on, its own health check, a restart, and whether the page answers:

```zsh
./homelab logs dozzle -f
./homelab status docker-socket-proxy
./homelab compose dozzle exec dozzle /dozzle healthcheck
./homelab compose dozzle restart dozzle
curl -sI http://localhost:9998
```

## Learn more

- Docs: https://dozzle.dev/
- Source and image: https://github.com/amir20/dozzle

## Backup

Nothing to back up: Dozzle keeps no data.

## Troubleshooting

- **No containers listed:** the socket proxy is not running; `./homelab install docker-socket-proxy` or reinstall Dozzle.
