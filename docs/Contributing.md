---
version: 0.1.0-alpha
---

# Contributing

How to change the homelab safely, and how to slot in a new service.

## Principles

- Documentation is part of the change.
- Every change can be undone: know the rollback before you start.
- Prefer the simple solution.
- Preview first; apply second; verify the result, not the exit code.

## Standard change workflow

1. Know what you are changing and why.
2. Make sure a recent backup exists (`./homelab backup`, then the Duplicati jobs).
3. Plan the rollback.
4. Change the compose file or settings; run `./homelab plan` or the command without `--apply`.
5. Apply, then verify the app actually works (open it, check `./homelab status`).
6. Run `./homelab docs`, update the hand-written parts of the affected notes, and add a line to `CHANGELOG.md`.
7. Run `make check` and commit.

## Slotting in a new service

### One container

Add a block to its category's file in `compose/` (for example `compose/documents.yaml`, the `homelab_documents` project; services that depend on each other must share a file). Keep `x-homelab` as the last key:

```yaml
  myapp:
    <<: *service
    image: example/myapp:latest
    profiles: [optional]                 # remove to make it part of the baseline
    environment:
      TZ: ${TZ:-UTC}
    ports:
      - ${BIND_IP:-127.0.0.1}:${MYAPP_PORT:-8123}:8080
    volumes:
      - ./data/appdata/myapp:/config
    labels:
      - com.centurylinklabs.watchtower.enable=true
    x-homelab:
      name: My App                       # display name; the note is services/<category>/My App.md
      category: documents                # network, security, system, cloud, documents, finance, media, media-automation, household
      description: One line on what it is for
      subdomain: myapp                   # https://myapp.<domain>
      web: 8080                          # container port of the UI, or false
```

### Several containers

Create `stacks/<name>/compose.yaml` with its own `name: homelab_<name>`. Databases stay on the stack's default network; the web service also joins the shared network:

```yaml
name: homelab_myapp

networks:
  default:
  homelab:
    name: homelab
    external: true

services:
  myapp:
    image: example/myapp:latest
    networks: [default, homelab]
    depends_on: [myapp-db]
    x-homelab: { name: My App, category: documents, web: 8080, subdomain: myapp }
  myapp-db:
    image: postgres:17
    volumes: [myapp-pgdata:/var/lib/postgresql/data]
    x-homelab: { name: My App database, category: system, internal: true, dump: postgres }

volumes:
  myapp-pgdata:
```

Use `../../appdata/<name>/...` for bind mounts so data sits next to the other stacks' data.

### x-homelab fields

| Field | Meaning |
|---|---|
| `name`, `category`, `description` | How the app is listed and where its note lives |
| `web` | Container port of the UI, or `false` |
| `subdomain` | Hostname label (defaults to the service name) |
| `public: true` | Also publish through the Cloudflare Tunnel (refused for admin apps) |
| `admin: true` | Its pages manage the homelab, so it is never published; every Network and System app counts as admin already |
| `internal: true` | A helper (database, cache): no note, not listed, pulled in as a dependency |
| `aliases` | Other names that select it (`overseerr` → `seerr`) |
| `requires` | `.env` variables that must be set before it starts (for example a token) |
| `dump: postgres` | `homelab backup` dumps this database daily |
| `archive` | Named volumes `homelab backup` tars daily |
| `phone` | The phone app people use the app with, shown on each person's welcome page (`homelab person add`) |
| `version` | For a PostgreSQL database (`dump: postgres`): the `.env` setting with its major version, used in its image as `postgres:${KEY:-N}`; `homelab db upgrade` moves it on |
| `proxy_host` | Reach the UI through another container (qBittorrent through `gluetun`) |
| `conflicts` | Apps that cannot run alongside it |
| `doc` | A different note path |
| `pin` | Why the image is updated by hand, for one without the Watchtower label that is not a database or built locally (validate warns without it) |

### Then

1. Add any new variables (ports, secrets as `__REPLACE_ME__`) to `.env.example` and [Environment](<Environment.md>).
2. `./homelab docs` creates the note with its facts filled in; write Purpose, Setup, Backup, and Troubleshooting.
3. `make check`.
4. `./homelab install myapp`, then `./homelab domain setup` for its hostname.
5. Add an Uptime Kuma monitor (see [Monitoring](<Monitoring.md>)).

## Service acceptance checklist

- [ ] `restart: unless-stopped` (from `<<: *service`) and a Watchtower label: `true`, or `false` with the reason in the note
- [ ] App ports on `${BIND_IP}`; data in `data/appdata`, `appdata`, or a named volume
- [ ] Authentication on, with the password in Vaultwarden
- [ ] Backup coverage (an existing Duplicati job, `dump`, or `archive`), or the gap written in the note
- [ ] Uptime Kuma monitor
- [ ] Note written, `./homelab validate` passes
- [ ] If it replaces a paid service, a row in [Savings](<Savings.md>) and an updated summary
- [ ] `CHANGELOG.md` updated

## Code changes

See the repository's [CONTRIBUTING](<../CONTRIBUTING.md>) for the Go workflow.
