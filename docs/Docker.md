---
version: 0.1.0-alpha
---

# Docker

## Environment

| Property | Value |
|---|---|
| Runtime | OrbStack (Linux VM on the Mac); Start at login on |
| Engine and Compose | OrbStack's bundled Docker Engine and Compose (2.20 or newer required) |
| Compose files | `compose/<category>.yaml` (one project each) and `stacks/*/compose.yaml`; `compose.yaml` holds the catalog |
| Shared network | `homelab` (external; created by `./homelab up`) |
| Settings | `~/Homelab/.env` for every project |
| Architecture | Apple Silicon (arm64); MoneyMatter's Intel-only images run under Rosetta |

## Networking facts

- Containers on `homelab` reach each other by service name: `nginx-proxy-manager`, `immich-server`, `paperless`, `ntfy`, `crowdsec`.
- `host.docker.internal` is the Mac itself. Only native apps (Jellyfin) are reached that way.
- `127.0.0.1` inside a container is the container, never the Mac.
- App ports are published on the Mac's `127.0.0.1` for local use; only the proxy (80/443) and DNS (53) listen on the LAN.
- Database services are not on `homelab` at all; only their own stack can reach them.

## Compose projects

| Project | Notes |
|---|---|
| `homelab_<category>` | One per category (`compose/<category>.yaml`): the single-container apps, baseline and optional (`profiles: [optional]`) |
| `homelab_cloudflare` | cloudflared; waits for `TUNNEL_TOKEN` |
| `homelab_immich` | Four containers; pinned database and Redis images |
| `homelab_paperless` | Three containers |
| `homelab_budget_tracker` | MoneyMatter, five containers (folder `budget-tracker`, not `money`) |

Run Compose through the CLI so the right folder, project name, and `.env` are used:

```bash
./homelab compose paperless ps
./homelab compose security logs --tail 50 crowdsec
```

## Operational rules

- **Always** go through `./homelab` (or `./homelab compose`), not a bare `docker compose` in a stack folder.
- **Never** update Nginx Proxy Manager by pulling an image; `./homelab update nginx-proxy-manager` rebuilds it.
- **Never** run `docker volume prune` or `docker system prune --volumes`: databases live in named volumes.
- **Never** mount `/var/run/docker.sock` into a new service; read-only consumers use `docker-socket-proxy`. Watchtower is the one exception (it must write).
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

and declares `com.centurylinklabs.watchtower.enable` explicitly. If an image refuses to start with `no-new-privileges`, remove it for that one service and say why in the note.

## Custom image

| Property | Value |
|---|---|
| Image | `homelab/nginx-proxy-manager-crowdsec:<NPM_VERSION>` |
| Base | `jc21/nginx-proxy-manager` (`NPM_VERSION` in `.env`) |
| Adds | `lua-cs-bouncer` v1.0.19, `lua-resty-http` v0.17.2, ban/captcha templates, `crowdsec_openresty.conf` in `/etc/nginx/conf.d`, an entrypoint that writes the bouncer config |
| Source | `dockerfiles/npm-crowdsec/` |
| Update | Bump `NPM_VERSION`, then `./homelab update nginx-proxy-manager` |
| Watchtower | Excluded |

## Maintenance

```bash
./homelab status
./homelab logs <app> --tail 100
docker system df                 # disk used by images, containers, volumes
docker image prune               # unused images only (safe)
```
