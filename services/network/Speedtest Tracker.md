---
version: 0.10.0-beta
---

# Speedtest Tracker

Measures the internet connection on a schedule and keeps the history

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `speedtest-tracker` in `compose/network.yaml` (project `homelab_network`) |
| Image | `lscr.io/linuxserver/speedtest-tracker:latest` |
| Category | Network |
| Starts with `./homelab up` | No: optional, `./homelab install speedtest-tracker` |
| Address | https://speedtest.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8765 (`SPEEDTEST_PORT`) |
| Data | `data/appdata/speedtest-tracker` → `/config` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Runs a speed test every six hours (`SPEEDTEST_SCHEDULE`) and keeps the history, so slowdowns and outages on the home connection are on record, not a feeling.

## Setup

1. `./homelab install speedtest-tracker` (its `SPEEDTEST_APP_KEY` is generated).
2. Open it and sign in with the default account `admin@example.com` / `password`, then change both under the profile.
3. Optionally, under Settings > Notifications, send failed or slow tests to ntfy with the publishers' token.

## How it works

- A Laravel (PHP) web app with a Filament admin interface, packaged by LinuxServer.io with nginx and PHP in one container.
- On the `SPEEDTEST_SCHEDULE` cron (every six hours by default), its scheduler runs Ookla's Speedtest CLI inside the container and stores the result: download, upload, ping, jitter, packet loss, and the server used.
- Results and settings are in SQLite (`DB_CONNECTION: sqlite`) in its `/config` folder.
- `APP_KEY` (`SPEEDTEST_APP_KEY`) encrypts its sessions and stored secrets; `APP_URL` is its https address.
- The test runs from the container over this Mac's connection, so anything that slows the Mac's connection (a VPN, a big download) shows in the results.

## Where things live

| What | Where |
|---|---|
| Results and settings database | `data/appdata/speedtest-tracker` → `/config` (`database.sqlite`) |
| Schedule and key | `SPEEDTEST_SCHEDULE`, `SPEEDTEST_APP_KEY` in `.env` |
| Logs | Container output: `./homelab logs speedtest-tracker` |

## Everyday use

- **Dashboard:** charts of recent download, upload, and ping, with the latest result on top.
- **Results:** every test with its server and numbers; open one for the details.
- Run a test now from the button at the top of the dashboard.
- **Settings › Notifications:** where alerts to ntfy are set up (see Setup).

## Connects to

- Optional alerts to [ntfy](<../security/ntfy.md>) at `http://ntfy:80` with the publishers' token (`NTFY_PUBLISH_TOKEN`). The token may only write to the granted topics, so pick one of those.
- [Uptime Kuma](<../security/Uptime Kuma.md>) can watch it at `http://speedtest-tracker:80`.
- `.env`: `SPEEDTEST_PORT`, `SPEEDTEST_APP_KEY`, `SPEEDTEST_SCHEDULE`, `TZ` (shown times), and `HOMELAB_DOMAIN` (its address).

## Tinkering ideas

- Test more often: set `SPEEDTEST_SCHEDULE` to `0 * * * *` (hourly) in `.env` and run `./homelab update speedtest-tracker`.
- Pin the test server, so results compare like with like: add `SPEEDTEST_SERVERS` (Ookla server ids) to its environment in `compose/network.yaml`.
- Keep the database small with `PRUNE_RESULTS_OLDER_THAN` (days) in its environment.
- Set notification thresholds, so ntfy hears only about slow or failed tests rather than every result.
- Add the Speedtest Tracker widget to [Homepage](<../system/Homepage.md>); Homepage's widget docs say what it needs.

## Useful commands

Laravel's `artisan` lists the app's own maintenance commands.

```zsh
./homelab logs speedtest-tracker -f
./homelab compose speedtest-tracker restart speedtest-tracker
./homelab compose speedtest-tracker exec speedtest-tracker php /app/www/artisan list
./homelab compose speedtest-tracker exec speedtest-tracker ls -la /config
./homelab plan speedtest-tracker
```

## Learn more

- [Speedtest Tracker docs](https://docs.speedtest-tracker.dev/)
- [Source on GitHub](https://github.com/alexjustesen/speedtest-tracker)
- [LinuxServer.io image docs](https://docs.linuxserver.io/images/docker-speedtest-tracker/) and [image source](https://github.com/linuxserver/docker-speedtest-tracker)

## Backup

`data/appdata/speedtest-tracker` (settings and the results database) is covered by the AppData job.

## Troubleshooting

- **"No encryption key":** `SPEEDTEST_APP_KEY` is empty; run `./homelab plan speedtest-tracker` to generate it, then reinstall.
- **Tests use the VPN's speed:** a VPN on the Mac routes the test through it (see doctor's network checks).
