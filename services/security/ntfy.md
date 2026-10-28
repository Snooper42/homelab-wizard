---
version: 0.12.0
---

# ntfy

The homelab's notification server. Every alert, from Watchtower, Duplicati, Uptime Kuma, and the watchdog, arrives on your phone through it.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `ntfy` in `compose/security.yaml` (project `homelab_security`) |
| Image | `binwiederhier/ntfy:latest` |
| Category | Security |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://ntfy.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this machine | http://localhost:9293 (`NTFY_PORT`) |
| Data | `data/appdata/ntfy/cache` → `/var/cache/ntfy`<br>`data/appdata/ntfy/lib` → `/var/lib/ntfy` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/ntfy` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

- Push notifications, self-hosted: messages stay on the Mac. The iPhone app is woken through ntfy.sh, which only sees a message ID.
- Five topics: `watchtower`, `duplicati-alerts`, `uptime-kuma`, `tunnel-watchdog`, `reminders`.

Access is deny-all: nobody can read or publish unless granted.

**Away from home.** The services publish with an access token, not anonymously, so ntfy can be public: `./homelab domain setup` publishes it through the tunnel once `./homelab notify setup` has made that token. Until then it is LAN-only, and the phone gets alerts only on home Wi-Fi. See [Known Issues](<../../docs/Known Issues.md>), ISSUE-0011 (fixed, to verify).

## Setup

1. `./homelab notify setup` lets the services publish (write-only, as user `homelab` with `NTFY_PUBLISH_TOKEN`) to exactly these topics and removes anonymous write access. It also creates `homelab-reader` for the desktop app and `phone` for the phone (read-only; its password is `NTFY_PHONE_PASSWORD`).
2. Optionally, create your own user and let it read every topic:

   ```bash
   ./homelab compose ntfy exec ntfy ntfy user add <name>
   ./homelab compose ntfy exec ntfy ntfy access <name> '*' read-only
   ```

3. In the ntfy iPhone app, Settings › Users: add server `https://<TAILSCALE_HOST>:9293` in Home mode, or `https://ntfy.example.com` with a domain, with user `phone` (or your own), and subscribe to the topics.
4. With a domain, `./homelab domain setup` publishes ntfy through the tunnel. In Home mode the phone reaches it over Tailscale.
5. `./homelab notify test watchtower` and check the phone.

A new alert topic must be added to the list in `internal/notify` and granted with `./homelab notify setup`, or its messages are refused.

## How it works

- One Go program. Publishing is an HTTP POST or PUT to `/<topic>`; subscribing is a long-lived HTTP, websocket, or JSON stream on the same topic.
- Messages are kept in a SQLite cache (`cache.db`) for 12 hours, so a phone that was offline catches up.
- Users, access grants, and tokens are in `user.db`. With `NTFY_AUTH_DEFAULT_ACCESS=deny-all`, a topic is closed to anyone without a grant.
- The iPhone app can only be woken by Apple's push service, so ntfy sends a poll request (the message ID only) to ntfy.sh (`NTFY_UPSTREAM_BASE_URL`), which wakes the app; the app then fetches the message from this server.
- `NTFY_BEHIND_PROXY=true` takes the client's address from the proxy's headers.
- Accounts made by `./homelab notify setup`: `homelab` publishes (write-only, `NTFY_PUBLISH_TOKEN`), `homelab-reader` reads for the desktop app (`NTFY_READ_TOKEN`), and `phone` reads for the phone app (`NTFY_PHONE_PASSWORD`).

## Where things live

| What | Where |
|---|---|
| Message cache | `data/appdata/ntfy/cache` → `/var/cache/ntfy/cache.db` |
| Users, grants, tokens | `data/appdata/ntfy/lib` → `/var/lib/ntfy/user.db` |
| Server settings | The `NTFY_*` environment in `compose/security.yaml` (no `server.yml` is mounted) |
| Daily dump of `user.db` | `recovery-staging/databases/ntfy` |
| The list of alert topics | `internal/notify` (`Topics`) |

## Everyday use

- **The phone app:** notifications, each topic's history, and muting a topic for a while.
- **The web app:** open `https://ntfy.example.com`, sign in, subscribe to topics, and allow browser notifications for alerts on a computer.
- **The desktop app:** Status shows the last 12 hours of alerts, and the menu bar shows the newest one.
- `./homelab notify test <topic>` sends a test message.

## Connects to

- Publishers: [Watchtower](<../system/Watchtower.md>) (`watchtower`, with `NTFY_PUBLISH_AUTH` in its URL), [Duplicati](<../system/Duplicati.md>) (`duplicati-alerts`), [Uptime Kuma](<Uptime Kuma.md>) (`uptime-kuma`), the watchdog (`tunnel-watchdog`), and [Wallos](<../finance/Wallos.md>) and [Changedetection.io](<../documents/Changedetection.io.md>) (`reminders`).
- Published through [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>) once the publishers' token exists.
- `.env`: `NTFY_PORT`, `NTFY_PUBLISH_TOKEN`, `NTFY_PUBLISH_AUTH`, `NTFY_READ_TOKEN`, `NTFY_PHONE_PASSWORD`, `DESKTOP_ALERTS`, and `HEARTBEAT_URL` (the outside check for when ntfy itself is down; see [Monitoring](<../../docs/Monitoring.md>)).

## Tinkering ideas

- Headers change how a message looks: `Priority: 5` for a loud alert, `Tags: warning` for an emoji, `Click: https://uptime.example.com` to open a page when tapped.
- Scheduled delivery: an `At: tomorrow 9am` or `Delay: 30m` header holds a message until then.
- Action buttons: an `Actions:` header adds up to three buttons, such as one that opens a URL.
- A personal topic for your own scripts or iPhone Shortcuts: grant your user with `ntfy access <name> <topic> rw`, and give the script its own token with `ntfy token add <name>`.
- Keep the web app open in a browser tab as a desktop notifier.

## Useful commands

`ntfy access` with no arguments lists every grant. The publish example uses the publishers' token, so it only works on the granted topics.

```zsh
./homelab logs ntfy -f
./homelab compose ntfy restart ntfy
./homelab compose ntfy exec ntfy ntfy user list
./homelab compose ntfy exec ntfy ntfy access
./homelab compose ntfy exec ntfy ntfy token list
./homelab notify test watchtower
curl -s http://localhost:9293/v1/health
curl -H "Authorization: Bearer <NTFY_PUBLISH_TOKEN>" -H "Title: Hello" -H "Priority: 4" -d "Test from this Mac" http://localhost:9293/watchtower
```

## API

- Tokens: `NTFY_PUBLISH_TOKEN` (write) and `NTFY_READ_TOKEN` (read) in `.env`, or a new one from `ntfy token add <user>`. Send as `Authorization: Bearer <token>`.
- Base URL: `http://localhost:9293` on this Mac, `http://ntfy:80` from containers, `https://ntfy.example.com` elsewhere.
- Example, the last 12 hours of one topic: `curl -s -H "Authorization: Bearer <NTFY_READ_TOKEN>" "http://localhost:9293/uptime-kuma/json?poll=1&since=12h"`.
- Docs: [publishing](https://docs.ntfy.sh/publish/) and [subscribing](https://docs.ntfy.sh/subscribe/api/).

## Learn more

- [ntfy docs](https://docs.ntfy.sh/)
- [Source on GitHub](https://github.com/binwiederhier/ntfy)
- [Image on Docker Hub](https://hub.docker.com/r/binwiederhier/ntfy)

## Backup

`data/appdata/ntfy` (users, grants, message cache) is in the Homelab AppData job.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Services get 403 when publishing | The topic is not granted. `./homelab notify setup` |
| Phone gets nothing at home | The phone's user lacks read access, or the phone's DNS is not 192.168.1.10 |
| Phone gets nothing away from home | ntfy is not published yet. `./homelab notify setup`, then `./homelab domain setup` (see Purpose) |
| Health check failing | `./homelab logs ntfy` |
