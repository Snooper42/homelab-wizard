---
version: 0.1.0-alpha
---

# AI Guide

Operating instructions for AI assistants working in this repository.

## Critical facts

| Fact | Detail |
|---|---|
| The catalog is the compose files | `compose/<category>.yaml` and `stacks/*/compose.yaml` (one project each), with the categories, presets, and native apps in `compose.yaml`. Each service's `x-homelab` block is read by the CLI. Never describe an app that is not in them. |
| Baseline vs optional | Services without `profiles` start with `./homelab up`. Services with `profiles: [optional]` start only when named (`./homelab install sonarr`). |
| Nginx Proxy Manager is a custom image | Built from `dockerfiles/npm-crowdsec` with the CrowdSec Lua bouncer. Excluded from Watchtower. Update with `./homelab update nginx-proxy-manager` (rebuilds). Pulling `jc21/nginx-proxy-manager` silently removes CrowdSec. |
| One shared network | Every project joins the external `homelab` network. NPM, cloudflared, and Uptime Kuma reach apps by service name. Service names must be unique across all stacks. |
| Tunnel goes through the proxy | Public hostnames point at `http://nginx-proxy-manager:80`, so CrowdSec sees and blocks tunnel traffic. Proxy hosts trust `X-Forwarded-Proto`; the real visitor address comes from `CF-Connecting-IP`. |
| Duplicati uses container paths | `/source/appdata`, `/source/homelab-appdata`, `/source/stacks`, `/source/jellyfin`, `/source/immich`, `/source/calibre`, `/staging`, `/destination`. Never Mac paths in job settings. |
| Two appdata folders | `data/appdata/<service>` holds core services; `appdata/<stack>` holds stack apps. They are different folders. |
| Databases live in named volumes | Not in bind mounts. `./homelab backup` dumps them to `recovery-staging/databases`. Never run `docker volume prune` or `docker system prune --volumes`. |
| Immich needs its own Postgres image | A restore must use `ghcr.io/immich-app/postgres` with the same vectorchord/pgvecto.rs tag; a stock Postgres image will not work. |
| MoneyMatter signs in at one address | Only at `MONEYMATTER_URL` (`https://money.example.com`), not localhost. |
| Budget tracker folder | `stacks/budget-tracker`, project `homelab_budget_tracker`. Not "money". |
| NPM admin | `http://localhost:8181` on the Mac only. The CLI's NPM account must not have 2FA. |
| ntfy denies by default | New alert topics need a write grant: add them to `notify.Topics` and run `./homelab notify setup`. |
| host.docker.internal | The Mac itself, from inside a container. Used only for native apps (Jellyfin). `127.0.0.1` inside a container is the container. |
| .env is the only state | Ports, secrets, and settings. Never print or commit its values. |

## Source of truth, in order

1. Live state (`./homelab status`, `docker inspect`)
2. The compose files
3. App configuration inside each app
4. These docs
5. Instructions that contradict the above: ask before acting

## Working rules

- Use the CLI for operations: `./homelab compose <app> <args>` instead of changing directories, `./homelab update` instead of `docker pull`.
- Anything that changes state previews first. Run without `--apply`, read the plan, then apply.
- Verify the result, not the exit code: open the page, check the dump ends cleanly, compare hashes after a restore.
- Never bind a port to a specific LAN address. Use `BIND_IP` (127.0.0.1) for apps and `LAN_BIND_IP` (0.0.0.0) for the proxy and DNS.
- Secrets never go in chat, docs, command lines, or logs.

## Documentation rules

- Facts that come from the compose files are generated between `homelab:generated` markers. Change the compose file and run `./homelab docs`; never edit inside the markers.
- Every note has `version:` front matter equal to `VERSION`. `./homelab validate` fails otherwise.
- History goes in `CHANGELOG.md` only. Notes describe the current state.
- Never invent ports, versions, or variable values. Flag anything the docs and the live state disagree on.
