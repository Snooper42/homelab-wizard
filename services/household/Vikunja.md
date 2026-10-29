---
version: 0.15.0
---

# Vikunja

To-do lists and projects, shared with the household.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `vikunja` in `compose/household.yaml` (project `homelab_household`) |
| Image | `vikunja/vikunja:latest` |
| Category | Household |
| Starts with `./homelab up` | No: optional, `./homelab install vikunja` |
| Address | https://todo.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3456 (`VIKUNJA_PORT`) |
| Data | `data/appdata/vikunja/db` → `/db`<br>`data/appdata/vikunja/files` → `/app/vikunja/files` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/vikunja` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Everyday to-dos and longer projects in one place: lists, due dates, reminders, labels, and list, kanban, table, and Gantt views. Lists can be shared with other people in the household. It replaces Todoist.

## Setup

1. `./homelab install vikunja` and open it.
2. Sign-ups are off, so create each person's account from Terminal (it asks for the password):

   ```sh
   ./homelab compose vikunja exec vikunja /app/vikunja/vikunja user create -u <name> -e <email>
   ```

3. Sign in, then share a project with the others under its ... menu › Share.

On a phone, open `https://<TAILSCALE_HOST>:3456` in Home mode, or `https://todo.example.com` with a domain, and add it to the home screen. Apps that sync tasks over CalDAV (Tasks.org on Android, for example) can use `https://todo.example.com/dav/` with a CalDAV token from Settings › CalDAV.

## Away from home

In Home mode (the default), Vikunja is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere, or, to publish it through the tunnel, add `public: true` to its `x-homelab` block and run `./homelab domain setup` again.

## How it works

- A single Go program (`/app/vikunja/vikunja`) that serves the API, the Vue web app, and CalDAV on port 3456.
- Here it uses SQLite (`VIKUNJA_DATABASE_TYPE`, `VIKUNJA_DATABASE_PATH=/db/vikunja.db`); task attachments and project backgrounds are files in `/app/vikunja/files`.
- All settings come from `VIKUNJA_*` variables in the compose file instead of a `config.yml`. `VIKUNJA_SERVICE_SECRET` signs sign-in tokens, `VIKUNJA_SERVICE_PUBLICURL` is the address used in links and CalDAV, and registration is off.
- It runs as your user (`user: PUID:PGID`) rather than the image's uid 1000, so the data folders stay yours on this Mac. The same binary is the command-line tool and the health check.
- Email (reminders by mail, password resets) needs a mail server in `VIKUNJA_MAILER_*`, which is not set up here; reminders show in the app.

## Where things live

| What | Where |
|---|---|
| Database | `data/appdata/vikunja/db/vikunja.db` → `/db/vikunja.db` |
| Attachments and backgrounds | `data/appdata/vikunja/files/` → `/app/vikunja/files` |
| Program and CLI | `/app/vikunja/vikunja` in the container |
| Daily consistent copy | `recovery-staging/databases/vikunja` (by `./homelab backup`) |

## Everyday use

- **Add a task fast:** type into the add box with Quick Add Magic: `*label`, `+project`, `!3` for priority, `@user`, and dates such as `tomorrow` or `next monday`.
- **Views:** each project has List, Gantt, Table, and Kanban; switch at the top of the project.
- **Today:** the home page and the Upcoming view show what is due across all projects.
- **Keyboard:** **Cmd+K** opens search and quick actions; on a task, **t** marks it done. The user menu › Keyboard Shortcuts lists the rest.
- **Share:** a project's **...** menu › Share, with a person, a team, or a link.
- **Phone and other apps:** the web app on the home screen, or CalDAV (Settings › CalDAV) for apps such as Tasks.org.

## Connects to

- [Grocy](<Grocy.md>) also has chores and tasks; keep household chores there and projects here, or pick one.
- [Pocket ID](<../security/Pocket ID.md>): `./homelab sso setup` makes it Vikunja's sign-in. It writes the provider as `VIKUNJA_AUTH_OPENID_PROVIDERS_POCKETID_*` settings in `data/sso/vikunja.env`; Pocket ID sends people back to `/auth/openid/pocketid`. Sign-ups stay off for passwords, while a passkey makes the account on first sign-in, and an account with the same email is linked.
- [Baikal](<../cloud and files/Baikal.md>) is the calendar and contacts server; Vikunja serves its own CalDAV for tasks at `https://todo.example.com/dav/`.
- `.env`: `VIKUNJA_PORT` (default `3456`), `VIKUNJA_SECRET`, `TZ`, `PUID`, `PGID`.

## Tinkering ideas

- Two-factor sign-in: Settings › Two Factor Authentication.
- Webhooks: Settings › Webhooks (or a project's webhooks) calls a URL when tasks are created or done, for example a Home Assistant automation.
- Saved filters: make a filter such as `done = false && priority >= 3`; it shows up as a project of its own.
- Repeating tasks: set a task to repeat every week or month for bills and chores.
- Import from Todoist, Trello, or Microsoft To Do: Settings › Import, after adding that service's `VIKUNJA_MIGRATION_*` settings to the service.
- Project backgrounds from your own photos, to tell projects apart at a glance.

## Useful commands

Follow the log, restart, list accounts, check the setup, and reset a password (use the id from the list; it asks for the new password):

```zsh
./homelab logs vikunja -f
./homelab compose vikunja restart vikunja
./homelab compose vikunja exec vikunja /app/vikunja/vikunja user list
./homelab compose vikunja exec vikunja /app/vikunja/vikunja doctor
./homelab compose vikunja exec vikunja /app/vikunja/vikunja user reset-password <id> --direct
curl -s http://localhost:3456/api/v1/info
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3456/api/v1/projects
```

## API

- **Token:** Settings › API Tokens: choose what it may do and when it expires.
- **Base URL:** `http://localhost:3456/api/v1` on this Mac, or `https://todo.example.com/api/v1`, with `Authorization: Bearer <token>`. `/api/v1/info` needs no token.
- **Add a task to project 1:** `curl -s -X PUT -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{"title":"Call the plumber"}' http://localhost:3456/api/v1/projects/1/tasks`
- **Reference:** `https://todo.example.com/api/v1/docs` on your own server.

## Learn more

- [Vikunja documentation](https://vikunja.io/docs/)
- [GitHub: go-vikunja/vikunja](https://github.com/go-vikunja/vikunja) (source of the `vikunja/vikunja` image)

## Backup

The nightly backup takes a consistent copy of the database (`data/appdata/vikunja/db/vikunja.db`); attachments in `data/appdata/vikunja/files` are covered by the AppData job.

## Troubleshooting

- **Signed out after every restart:** `VIKUNJA_SECRET` is empty in `.env`. Run `./homelab install vikunja` again to generate it.
- **"Permission denied" on start:** the folders under `data/appdata/vikunja` must belong to your user (`PUID`/`PGID` in `.env`).
