---
version: 0.14.0
---

# Uptime Kuma

Watches every app from inside the Docker network and sends ntfy alerts when one stops answering.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `uptime-kuma` in `compose/security.yaml` (project `homelab_security`) |
| Image | `louislam/uptime-kuma:2` |
| Category | Security |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://uptime.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3001 (`UPTIME_KUMA_PORT`) |
| Data | `data/appdata/uptime-kuma` → `/app/data` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/uptime-kuma` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

- One page that shows whether everything is up, with history.
- Down and up alerts on the `uptime-kuma` topic.

## Setup

1. Open http://localhost:3001 and create the admin account (store it in Vaultwarden).
2. Settings › Notifications › Setup Notification › ntfy: server URL `http://ntfy:80`, topic `uptime-kuma`, priority 4, authentication method Access token with `NTFY_PUBLISH_TOKEN` from `.env` (after `./homelab notify setup`). Turn on "Default enabled" so new monitors use it.
3. Create the monitors in [Monitoring](<../../docs/Monitoring.md>). Use service names and container ports (`http://paperless:8000`), not `localhost`.

## How it works

- A Node.js server with a Vue web UI. The page talks to the server over a websocket (Socket.IO), not a REST API, which is why monitors cannot be created by script here.
- Each monitor runs inside the server on its own interval (60 seconds by default) from the `homelab` network, so it reaches apps by service name.
- Monitors, results, and settings are in SQLite (`kuma.db`), dumped daily. Version 2 can also use MariaDB; this homelab uses SQLite.
- When a monitor changes state (down after its retries, or up again), it sends the notifications attached to it: here, ntfy on `uptime-kuma`.
- History is kept for 180 days by default (Settings › Monitor History).

## Where things live

| What | Where |
|---|---|
| Database (monitors, history, settings) | `data/appdata/uptime-kuma` → `/app/data/kuma.db` |
| Uploaded status-page logos | `/app/data/upload/` |
| Daily database dump | `recovery-staging/databases/uptime-kuma` |

## Everyday use

- **Dashboard:** every monitor with its recent up and down bars; open one for response times and events.
- **Add New Monitor:** HTTP(s), HTTP(s) keyword, TCP port, ping, DNS, push, and more.
- **Maintenance:** schedule a window so planned downtime does not alert.
- **Status Pages:** a read-only page for the family that shows what is up.
- **Settings › Notifications:** the ntfy notification from Setup.
- On a phone, the web page works; add it to the home screen.

## Connects to

- Alerts go to [ntfy](<ntfy.md>) at `http://ntfy:80`, topic `uptime-kuma`, with `NTFY_PUBLISH_TOKEN`.
- Watches every app ([Monitoring](<../../docs/Monitoring.md>) has the list), including [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>), [AdGuard Home](<../network/AdGuard Home.md>) (web and DNS), [Vaultwarden](<Vaultwarden.md>), and native [Jellyfin](<../media/Jellyfin.md>) through `host.docker.internal`.
- The watchdog covers the same apps; Uptime Kuma adds history and status pages.
- `.env`: `UPTIME_KUMA_PORT` and `NTFY_PUBLISH_TOKEN`.

## Tinkering ideas

- Push monitor: Add New Monitor › Push gives a URL; have a script call it when it finishes, and Uptime Kuma alerts when the calls stop.
- Keyword monitor: check that a page contains a word, which catches an app that answers 200 with an error page.
- On an HTTPS monitor of `https://npm.example.com`, turn on certificate expiry notification to hear about a failed renewal early.
- Build a status page and show it on [Homepage](<../system/Homepage.md>) with Homepage's Uptime Kuma widget.
- Settings › Security: turn on two-factor authentication for the admin account.
- Tags on monitors to group them by category.

## Useful commands

`reset-password` asks for a new admin password if you lose it. The `curl` inside the container tests a target exactly as a monitor sees it.

```zsh
./homelab logs uptime-kuma -f
./homelab compose uptime-kuma restart uptime-kuma
./homelab compose uptime-kuma exec uptime-kuma npm run reset-password
./homelab compose uptime-kuma exec uptime-kuma curl -sI http://paperless:8000
curl -s "http://localhost:3001/api/push/<push token>?status=up&msg=OK"
```

## API

There is no API for creating monitors. What there is:

- **Push:** `http://localhost:3001/api/push/<token>`; the token is on the push monitor's page.
- **Badges:** `/api/badge/<monitor id>/status` and `/api/badge/<monitor id>/uptime`, for monitors on a public status page.
- **Metrics:** `/metrics` in Prometheus format, with an API key from Settings › API Keys as the basic-auth password.

## Learn more

- [Uptime Kuma wiki](https://github.com/louislam/uptime-kuma/wiki)
- [Source on GitHub](https://github.com/louislam/uptime-kuma)
- [Image on Docker Hub](https://hub.docker.com/r/louislam/uptime-kuma)

## Backup

`data/appdata/uptime-kuma` (monitors, history, settings) is in the Homelab AppData job.

## Troubleshooting

| Symptom | Fix |
|---|---|
| A monitor using `localhost` is always down | Inside the container, `localhost` is Uptime Kuma itself. Use the service name |
| Jellyfin monitor down | Use `http://host.docker.internal:8096/health` |
| No alerts arrive | `./homelab notify setup` grants `uptime-kuma`; check the notification uses `NTFY_PUBLISH_TOKEN`, then use its Test button |
