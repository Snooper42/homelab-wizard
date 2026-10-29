---
version: 0.14.0
---

# Beszel

How this machine and its apps are doing over time, with alerts.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `beszel` in `stacks/beszel/compose.yaml` (project `homelab_beszel`) |
| Image | `docker.io/henrygd/beszel:latest` |
| Category | System |
| Starts with `./homelab up` | No: optional, `./homelab install beszel` |
| Address | https://monitor.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8090 (`BESZEL_PORT`) |
| Data | `appdata/beszel` → `/beszel_data` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/beszel` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

How this machine and its apps are doing over time: CPU, memory, disk use and speed, network, temperatures, and each container's share, as graphs over hours, days, and weeks. Alerts (by email, or through ntfy with a webhook) when the machine runs hot, a disk fills, or it stops answering. Status shows now; Beszel shows the trend.

## Setup

1. `./homelab install beszel`. Its first account is made on its first start from `BESZEL_EMAIL` and `BESZEL_PASSWORD` (**Sign-in details** on its page in Status shows the email and copies the password).
2. Open it, **Add System**, and copy the **Public Key** it shows into Settings as `BESZEL_AGENT_KEY`. Then `./homelab install beszel-agent`.
3. Back in Add System: name it after this machine, host `host.docker.internal`, port `45876` (`BESZEL_AGENT_PORT`), and add it. It turns green within a minute.

## How it works

- The hub is a Go app with PocketBase (its database, `data.db`, in `appdata/beszel`). It keeps the history and the alerts, and connects to each agent over SSH with its own key.
- The agent (`beszel-agent`) runs on this machine's network and reads the machine's counters, and each container's through Docker's socket (read-only). The hub reaches it at `host.docker.internal`.
- What the agent sees depends on the runtime: on Linux and SteamOS the machine itself; with Docker Desktop (Windows) or OrbStack (macOS), the runtime's Linux VM, so CPU and memory are the VM's share and the Mac's or PC's own sensors are not there. Its containers are the homelab's either way.

## Where things live

| What | Where |
|---|---|
| History, systems, alerts, accounts | `appdata/beszel/data.db` → `/beszel_data` |
| The hub's SSH key | `appdata/beszel/id_ed25519` |
| Settings | `BESZEL_EMAIL`, `BESZEL_PASSWORD`, `BESZEL_AGENT_KEY`, `BESZEL_PORT`, `BESZEL_AGENT_PORT`, `BESZEL_URL` in `.env` |

## Everyday use

- **The dashboard:** each system with its CPU, memory, and disk now; click one for its graphs over time and each container's.
- **Alerts:** the bell on a system sets limits (CPU, memory, disk, temperature, down); Settings › Notifications says where they go.
- **Other machines:** run its agent on another computer (Beszel's site has a one-line install) and add it the same way.

## Connects to

- [ntfy](<../security/ntfy.md>): Settings › Notifications › add `ntfy://` with the homelab's topic, for alerts on the phone.
- [Uptime Kuma](<../security/Uptime Kuma.md>) watches that each app answers; Beszel watches the machine under them.
- [Beszel agent](<Beszel agent.md>), which it reads.

## Tinkering ideas

- Alert when the media drive is over 90% full.
- Add the other computers at home (a NAS, a desktop) to see them all on one page.

## Useful commands

```sh
./homelab logs beszel -f
./homelab logs beszel-agent -f
./homelab compose beszel ps
```

## API

PocketBase's REST API: `POST /api/collections/users/auth-with-password` for a token, then `GET /api/collections/systems/records` with `Authorization: <token>`. See [Beszel's documentation](https://beszel.dev/guide/what-is-beszel).

## Learn more

- [beszel.dev](https://beszel.dev)
- [GitHub: henrygd/beszel](https://github.com/henrygd/beszel)

## Backup

`./homelab backup` copies `data.db` nightly (SQLite, checked) into `recovery-staging/databases/beszel`, and Duplicati takes it off-site. The hub's key in `appdata/beszel` goes with the Homelab Stack Data job; without it, add the key to the agent again (Setup, step 2).

## Troubleshooting

- **The system stays red:** `BESZEL_AGENT_KEY` does not match the hub's key (copy it again from Add System), or the agent is not running (`./homelab status`).
- **No temperatures:** the runtime's VM has no sensors (macOS, Windows), or the machine does not expose them.
