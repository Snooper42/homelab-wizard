---
version: 0.14.0
---

# Watchtower

Updates containers every night at 4 AM, but only the ones that opt in with a label, and reports what it did to ntfy.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `watchtower` in `compose/system.yaml` (project `homelab_system`) |
| Image | `nickfedor/watchtower:1.23.2` |
| Category | System |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Updates | By hand. It controls Docker, which reaches every app and, on a Mac, your files; set WATCHTOWER_VERSION to a newer release after reading its notes, then ./homelab update watchtower |
<!-- END homelab:generated -->

## Purpose

- Keep opted-in apps current without anyone thinking about it.
- Leave alone what must be updated deliberately: the locally built proxy, every database and cache, and MoneyMatter's pinned images.

It uses the maintained `nickfedor/watchtower` fork, which negotiates the Docker API version with OrbStack's engine.

## Setup

Nothing to do. Every service declares `com.centurylinklabs.watchtower.enable=true` or `false`; each note's table says which. Watchtower itself and `docker-socket-proxy` are not labelled: they control Docker, so they stay on the version in `WATCHTOWER_VERSION` and `SOCKET_PROXY_VERSION` until you change it ([Security](<../../docs/Security.md#threat-review-of-the-app-october-2026>), M6). Run `./homelab notify setup` once so its `watchtower` messages are accepted.

To update one app now: `./homelab update <app>`. To update every app the nightly update would, now: Status › **Update apps**, or `./homelab update --all`.

## How it works

- A Go program with read-write access to the Docker socket, the only service here that has it.
- At each `WATCHTOWER_SCHEDULE` (a six-field cron with seconds; `0 0 4 * * *` is 04:00 every day) it checks running containers labelled `com.centurylinklabs.watchtower.enable=true`, pulls their image tag again, and if the image changed, stops the container and starts a new one with the same settings.
- It recreates containers from their current settings, not from the compose files, so an edited compose file only takes effect with `./homelab update <app>` or `./homelab up`.
- Every update can be undone. Watchtower leaves the old image (`WATCHTOWER_CLEANUP: "false"`); within 15 minutes the watchdog keeps it as `homelab-rollback/<app>:previous` for a week and removes the rest. `./homelab rollback <app>` (or the rewind button on Status) goes back to it and holds the app's updates.
- The nightly backup runs at 03:30, before Watchtower, so every database has a dump from just before its app updates. `./homelab update <app>` dumps the app's databases first.
- An app that is unhealthy, keeps restarting, or whose page does not answer (on two checks in a row) 20 minutes to 6 hours after its update is rolled back by the watchdog, its updates held, and an alert sent on `watchtower` (`AUTO_ROLLBACK=false`: alert only).
- Held apps are listed in `UPDATES_HELD`; Watchtower skips their containers (`WATCHTOWER_DISABLE_CONTAINERS` from `UPDATES_HELD_CONTAINERS`) until `./homelab updates release <app>`.
- Databases and caches carry `enable=false`, and Immich's are also pinned by digest.
- A summary goes to [ntfy](<../security/ntfy.md>) on the `watchtower` topic through `WATCHTOWER_NOTIFICATION_URL`, signed with `NTFY_PUBLISH_AUTH`.
- `./homelab updates pause` stops Watchtower and records `UPDATES_PAUSED` in `.env`, so `./homelab up` keeps it stopped.

## Everyday use

- Read the morning's ntfy message to see what was updated.
- Something broke after last night's update: Status › the app's page › **Roll back** (or `./homelab rollback <app>`). Once a fixed version is out, `./homelab updates release <app>`.
- `./homelab updates` says whether updates run and when; pause them before a trip or a busy week, and resume after.
- The Updates row in each note's table says whether that app is opted in.

## Connects to

- Reports to [ntfy](<../security/ntfy.md>); `./homelab notify setup` grants the `watchtower` topic.
- Skips the [PostgreSQL](<../system/PostgreSQL.md>) and [Redis and Valkey](<../system/Redis and Valkey.md>) containers and [MoneyMatter](<../finance/MoneyMatter.md>)'s pinned images.
- [Uptime Kuma](<../security/Uptime Kuma.md>) catches an app that an update broke; [Dozzle](<../system/Dozzle.md>) shows why.
- `.env`: `WATCHTOWER_SCHEDULE`, `NTFY_PUBLISH_AUTH`, `UPDATES_PAUSED`, `AUTO_ROLLBACK`, `UPDATES_HELD`, `UPDATES_HELD_CONTAINERS`.
- `data/updates.json`: the image each app runs and the one it ran before, for `homelab rollback`.

## Tinkering ideas

- Move the update time: set `WATCHTOWER_SCHEDULE` in `.env` (for example `0 30 3 * * *`) and run `./homelab up`.
- Be told about a new image without installing it: add `com.centurylinklabs.watchtower.monitor-only=true` next to an app's enable label.
- Run a command before an app updates (such as a dump) with the label `com.centurylinklabs.watchtower.lifecycle.pre-update` and `WATCHTOWER_LIFECYCLE_HOOKS: "true"`.
- Get a full report of checked, updated, and failed containers with `WATCHTOWER_NOTIFICATION_REPORT: "true"`.
- Restart one container at a time with `WATCHTOWER_ROLLING_RESTART: "true"`.

## Useful commands

Update status, pause and resume, updating one app now, the logs, a test message, and a restart:

```zsh
./homelab updates
./homelab updates pause
./homelab updates resume
./homelab update immich
./homelab logs watchtower -f
./homelab notify test watchtower
./homelab compose watchtower restart watchtower
```

## Learn more

- Source and image (the maintained fork): https://github.com/nicholas-fedor/watchtower
- The original project's docs, whose options the fork keeps: https://containrrr.dev/watchtower/

## Backup

Nothing: it keeps no state.

## Troubleshooting

| Symptom | Fix |
|---|---|
| No messages after updates | ntfy refused them. `./homelab notify setup`, then check `./homelab logs watchtower` |
| An update broke an app | `./homelab rollback <app>` within a week of the update (the watchdog does it by itself when the app is unhealthy). For good: pin the last good tag in the compose file (`image: app:1.2.3`), `./homelab update <app>`, and record it in [Known Issues](<../../docs/Known Issues.md>) |
| "no earlier image is kept" | The update is over a week old, or happened before this version. Pin a tag instead (above) |
| A new app is never updated | It lacks the label, or has it set to `false` |
