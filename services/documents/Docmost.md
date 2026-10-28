---
version: 0.10.0-beta
---

# Docmost

The household wiki, with pages, spaces, comments, and diagrams

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `docmost` in `stacks/docmost/compose.yaml` (project `homelab_docmost`) |
| Image | `docker.io/docmost/docmost:latest` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install docmost` |
| Address | https://wiki.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3040 (`DOCMOST_PORT`) |
| Depends on | `docmost-db`, `docmost-redis` |
| Helpers | `docmost-db` `docker.io/library/postgres:17`, dumped daily by `./homelab backup`<br>`docmost-redis` `docker.io/valkey/valkey:9-alpine` |
| Data | `appdata/docmost` → `/app/data/storage` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | notion, confluence |
<!-- END homelab:generated -->

## Purpose

The household's own wiki: how-tos, the house manual (Wi-Fi, appliances, who to call), recipes that are not in Mealie, trip plans, and anything else worth writing down once. Pages live in spaces (one per topic or per person), with comments, page history, and diagrams. It replaces Notion or Confluence for a family.

## Setup

1. `./homelab install docmost`, then open http://localhost:3040 (or https://wiki.example.com once the domain is set up).
2. The first visit creates the workspace and its owner account. Use a password from Vaultwarden.
3. Settings › Members: invite the household. Without an email server Docmost shows the invite link; copy it to the person.
4. Make a space per topic (Home, Recipes, Travel) and set who can edit it under the space's settings.

## How it works

- A Node.js (NestJS) server with a React editor built on Tiptap and Yjs, so two people can edit the same page at once and see each other's cursors.
- Pages, spaces, members, and history live in PostgreSQL (`docmost-db`). Redis (`docmost-redis`, Valkey here) carries the background jobs and the live-editing traffic; it holds nothing worth keeping.
- Uploaded files and images are stored on disk in `/app/data/storage`, which is `appdata/docmost` on this Mac.
- `APP_URL` is the address it builds links with (invites, shares). It is `DOCMOST_URL` in `.env`: empty means https://wiki.\<domain\>, and in Home mode `homelab tailnet setup` writes the tailnet address.
- `APP_SECRET` signs sign-in sessions. Changing it signs everyone out.

## Where things live

| What | Where |
|---|---|
| Attachments and images | `appdata/docmost` (`/app/data/storage`) |
| Pages, spaces, users, history | the `docmost-pgdata` volume (PostgreSQL 17) |
| Daily database dump | `recovery-staging/databases/docmost-db` |
| Settings | `DOCMOST_PORT`, `DOCMOST_URL`, `DOCMOST_APP_SECRET`, `DOCMOST_DB_PASSWORD` in `.env` |

## Everyday use

- Type `/` in a page for headings, tables, callouts, code blocks, and diagrams (Draw.io, Excalidraw, Mermaid).
- Drag pages in the sidebar to nest them; each space has its own tree.
- The search box looks through every page you can see.
- Page menu › History shows earlier versions and restores one.
- Share a page publicly from its Share menu; on this homelab "publicly" means anyone who can reach the address.
- Import Markdown, HTML, or a Notion or Confluence export from the space's settings.

## Connects to

- [Vaultwarden](<../security/Vaultwarden.md>) for the accounts' passwords.
- [Pocket ID](<../security/Pocket ID.md>) can be the sign-in only in Docmost's paid edition; the free one signs in with email and password.
- [Duplicati](<../system/Duplicati.md>) backs up `appdata/docmost` with the AppData job and the database dump with the Databases job.

## Tinkering ideas

- A *House manual* space: Wi-Fi, the boiler, appliance manuals as attachments, and the recovery-kit location (never the secrets themselves).
- Templates: write a page once (a trip plan, a meeting note) and duplicate it.
- Diagrams of the home network with the Draw.io block.
- Export a space as Markdown now and then, so it opens without Docmost too.
- Email for invites and password resets: Docmost's `MAIL_DRIVER` and `SMTP_*` settings (add them to the compose file's environment).

## Useful commands

The log, a restart, and a look inside the database:

```zsh
./homelab logs docmost -f
./homelab compose docmost restart docmost
./homelab compose docmost exec docmost-db psql -U docmost -d docmost -c '\dt'
du -sh appdata/docmost
```

## Learn more

- [Docmost](https://docmost.com) and its [documentation](https://docmost.com/docs)
- [Docmost on GitHub](https://github.com/docmost/docmost)

## Backup

The nightly backup dumps the database (`docmost-db`), and the AppData job keeps `appdata/docmost` (attachments). Redis holds nothing to keep. To restore, follow the [PostgreSQL](<../system/PostgreSQL.md>) note for the dump and put the attachments folder back before starting Docmost.

## Troubleshooting

- **Links in invites point to the wrong address:** set `DOCMOST_URL` to the address you open it at (or leave it empty with a domain), then `./homelab compose docmost up -d docmost`.
- **Everyone is signed out:** `DOCMOST_APP_SECRET` changed; restore `.env` from the Secrets backup.
- **Pages load but live editing stalls:** Redis is down; `./homelab status` and start `docmost-redis`.
- **"Cannot connect to the database" on start:** `docmost-db` is still starting after an update; wait a minute, then check `./homelab logs docmost-db`.
