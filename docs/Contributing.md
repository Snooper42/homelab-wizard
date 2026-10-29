---
version: 0.15.0
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
    x-homelab:
      name: My App                       # display name; the note is services/<category>/My App.md
      category: documents                # network, security, system, cloud, documents, finance, media, media-automation, household
      description: One line on what it is for
      subdomain: myapp                   # https://myapp.<domain>
      web: 8080                          # container port of the UI, or false
      # local: true                      # no sign-in of its own: this computer only, no tailnet or domain address
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
| `path` | Path of the UI under its address (defaults to `/`) |
| `url` | The `.env` setting with the address the app is opened at, for apps that need to know it (sign-in, links). Empty means `https://<subdomain>.<domain>`; in Home mode `homelab tailnet setup` fills it with the tailnet address |
| `public: true` | Also publish through the Cloudflare Tunnel (refused for admin apps) |
| `admin: true` | Its pages manage the homelab, so it is never published; every Network and System app counts as admin already |
| `internal: true` | A helper (database, cache): no note, not listed, pulled in as a dependency |
| `aliases` | Other names that select it (`overseerr` → `seerr`) |
| `requires` | `.env` variables that must be set before it starts (for example a token) |
| `warning` | One line the install plan shows under *Worth knowing* (for example that its page has no password at first) |
| `seed` | A repository folder of starter files copied into its data folder on install, never over existing files |
| `login` | `.env` variables the homelab set the app's sign-in up with, user then password; the app's page on Status shows them behind **Sign-in details** (the password is only copied) |
| `dump: postgres` | `homelab backup` dumps this database daily |
| `archive` | Named volumes `homelab backup` tars daily |
| `phone` | The phone app people use the app with, shown on each person's welcome page (`homelab person add`) |
| `version` | For a PostgreSQL database (`dump: postgres`): the `.env` setting with its major version, used in its image as `postgres:${KEY:-N}`; `homelab db upgrade` moves it on |
| `proxy_host` | Reach the UI through another container (qBittorrent through `gluetun`) |
| `conflicts` | Apps that cannot run alongside it |
| `doc` | A different note path |
| `releases` | The GitHub project (`owner/name`) the image's releases are published in, when the image does not say (no `org.opencontainers.image.source` label, not on `ghcr.io`): Update shows their notes |
| `pin` | Why the image is updated by hand rather than by the nightly updates (a database, a cache, and a locally built image are by hand already) |

The catalog-wide blocks live in `compose.yaml`: `x-homelab-format` (the layout version), `x-homelab-categories`, `x-homelab-small-baseline`, `x-homelab-bundles` (`name`, `description`, `apps`, `aliases`, `starter`), and `x-homelab-native` for apps that run on the host (`name`, `category`, `description`, `subdomain`, `port`, `install`, `install_linux`, `install_windows`, `public`, `doc`, `phone`).

### Then

1. Add any new variables (ports, secrets as `__REPLACE_ME__`) to `.env.example` and [Environment](<Environment.md>).
2. `./homelab docs` creates the note with its facts filled in; write Purpose, Setup, Backup, and Troubleshooting.
3. `make check`.
4. `./homelab install myapp`. It gets its address by itself: on the tailnet in Home mode, or a proxy host once Set up the domain has run (`AUTO_DOMAIN`).
5. Check the watchdog sees it (`./homelab watchdog`); add an Uptime Kuma monitor only for checks of your own (see [Monitoring](<Monitoring.md>)).

## Service acceptance checklist

- [ ] `restart: unless-stopped` (from `<<: *service`); an `x-homelab` `pin` with the reason if its image must not update nightly
- [ ] App ports on `${BIND_IP}`; data in `data/appdata`, `appdata`, or a named volume
- [ ] Authentication on, with the password in Vaultwarden
- [ ] Backup coverage (an existing Duplicati job, `dump`, or `archive`), or the gap written in the note
- [ ] The watchdog checks it (a health check, or a web page it can open)
- [ ] Note written, `./homelab validate` passes
- [ ] If it replaces a paid service, a row in [Savings](<Savings.md>) and an updated summary
- [ ] `CHANGELOG.md` updated

## Code changes

See the repository's [CONTRIBUTING](<../CONTRIBUTING.md>) for the Go workflow.
