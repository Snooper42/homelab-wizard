---
version: 0.16.0
---

# Docker

## Environment

| Property | Value |
|---|---|
| Runtime | OrbStack (Linux VM on the Mac), Start at login on; Docker Engine on Linux, Docker Desktop on Windows ([Host](<Host.md>)) |
| Engine and Compose | The runtime's Docker Engine and Compose (2.20 or newer required) |
| Compose files | `compose/<category>.yaml` (one project each) and `stacks/*/compose.yaml`; `compose.yaml` holds the catalog |
| How the homelab talks to it | Reads (the containers, their events, what they use, the engine's info) and commands run in containers go to the engine's own API over its socket (Docker Desktop's named pipe on Windows), found as the `docker` CLI finds it; the CLI answers whenever the API fails, and `DOCKER_API=off` keeps the CLI. Starting, stopping, and updating apps is `docker compose`. `./homelab doctor` says which is in use |
| Shared network | `homelab` (external; created by `./homelab up`) |
| Settings | `~/Homelab/.env` for every project |
| Architecture | Apple Silicon (arm64); MoneyMatter's Intel-only images run under Rosetta unless `MONEYMATTER_*_IMAGE` names native builds |

## Networking facts

- Containers on `homelab` reach each other by service name: `nginx-proxy-manager`, `immich-server`, `paperless`, `ntfy`, `crowdsec`.
- `host.docker.internal` is the host itself. Only native apps (Jellyfin, the phone companion) are reached that way.
- `127.0.0.1` inside a container is the container, never the host.
- App ports are published on the host's `127.0.0.1` for local use; only the proxy (80/443) and DNS (53) listen on the LAN. In Home mode the `tailscale` container serves the apps on the tailnet (`data/appdata/tailscale/serve.json`).
- Database services are not on `homelab` at all; only their own stack can reach them.

## Compose projects

| Project | Notes |
|---|---|
| `homelab_<category>` | One per category (`compose/<category>.yaml`): the single-container apps, baseline and optional (`profiles: [optional]`) |
| `homelab_cloudflare` | cloudflared; waits for `TUNNEL_TOKEN` |
| `homelab_immich` | Four containers; pinned database and Redis images |
| `homelab_paperless` | Three containers |
| `homelab_budget_tracker` | MoneyMatter, five containers (folder `budget-tracker`, not `money`) |
| `homelab_beszel`, `homelab_dawarich`, `homelab_docmost`, `homelab_firefly_iii`, `homelab_frigate`, `homelab_ghostfolio`, `homelab_karakeep`, `homelab_linkwarden`, `homelab_nextcloud`, `homelab_romm`, `homelab_tandoor` | Optional apps with their own database or helpers (one folder each under `stacks/`) |
| `homelab_custom` | Your own apps (`stacks/custom/compose.yaml`, written by `homelab custom add`; not in git) |

Run Compose through the CLI so the right folder, project name, and `.env` are used:

```bash
./homelab compose paperless ps
./homelab compose security logs --tail 50 crowdsec
```

## Operational rules

- **Always** go through `./homelab` (or `./homelab compose`), not a bare `docker compose` in a stack folder.
- **Never** update Nginx Proxy Manager by pulling an image; `./homelab update nginx-proxy-manager` rebuilds it.
- **Never** run `docker volume prune` or `docker system prune --volumes`: databases live in named volumes.
- **Never** mount `/var/run/docker.sock` into a new service; read-only consumers use `docker-socket-proxy`. The one exception is the optional Beszel agent, which runs on the host's network and cannot reach the proxy by name, mounts it read-only.
- **Never** bind a port to a specific LAN address.
- Use `--remove-orphans` only on purpose.

## Container standards

Every service starts from the shared settings in its file:

```yaml
x-service: &service
  restart: unless-stopped
  security_opt: ["no-new-privileges:true"]
  logging:
    driver: json-file
    options: { max-size: 10m, max-file: "3" }
```

and, when its image must not update nightly, an `x-homelab` `pin` saying why. If an image refuses to start with `no-new-privileges`, remove it for that one service and say why in the note.

Background work yields the CPU to the apps people are using: Duplicati, Immich's machine learning, qBittorrent, Dawarich's Sidekiq worker, Karakeep's crawler browser, and Speedtest Tracker run with `cpu_shares: 256` (a quarter of Docker's default 1024), and so do the throwaway containers the nightly backup starts for dumps and archives. Shares only count while the CPU is busy, and only between containers: on an idle machine, background work still gets all of it, and while someone uses an app, its container comes first. Native apps (Jellyfin) are outside this. Give a new background service the same line.

## Custom image

| Property | Value |
|---|---|
| Image | `homelab/nginx-proxy-manager-crowdsec:<NPM_VERSION>` |
| Base | `jc21/nginx-proxy-manager` (`NPM_VERSION` in `.env`) |
| Adds | `lua-cs-bouncer` v1.0.19, `lua-resty-http` v0.17.2, ban/captcha templates, `crowdsec_openresty.conf` in `/etc/nginx/conf.d`, an entrypoint that writes the bouncer config |
| Source | `dockerfiles/npm-crowdsec/` |
| Update | Bump `NPM_VERSION`, then `./homelab update nginx-proxy-manager` |
| Nightly updates | Left out (built locally) |

## Maintenance

```bash
./homelab status
./homelab logs <app> --tail 100
./homelab fix                    # restart what is down or unwell, recreate apps whose settings changed; with a low disk, remove unused images and build cache
docker system df                 # disk used by images, containers, volumes
docker image prune               # unused images only (safe)
```

`./homelab uninstall` removes every app's containers and images, the images the homelab made itself (`homelab-rollback/*`, kept to undo an update, and `homelab/sqlite`), any container of a `homelab_` project no compose file lists any more, and the `homelab` network; volumes stay unless `--data`. Containers that are not the homelab's stay, and it names them; an image one of them uses stays too (`Resource is still in use`). `--everything-else` removes those too: every container, volume, image, and network left (Docker's own `bridge`, `host`, and `none` stay), and the build cache.
