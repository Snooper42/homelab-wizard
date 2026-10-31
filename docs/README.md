---
version: 0.16.0
---

# Homelab Knowledge Base

<p align="center">
  <img src="../assets/logo.svg" alt="" width="72" height="72"><br>
  <strong>Everything about Homelab Wizard, in one place.</strong><br>
  New here? Start with <a href="Getting%20Started.md">Getting Started</a>. Something wrong? <a href="Troubleshooting.md">Troubleshooting</a>. Trying a new build? Follow <a href="Testing.md">Testing</a>.
</p>

## Quick reference

| Property | Value |
|---|---|
| Host | One computer that stays on: a Mac, a Windows PC, a Linux machine, or a Steam Machine. These docs use a Mac with Apple Silicon as the example |
| LAN address | 192.168.1.10 (reserved in the router) |
| Container runtime | OrbStack on a Mac, Docker Desktop on Windows, Docker Engine on Linux |
| Repository / root | `~/Homelab` |
| Desktop app | Homelab Wizard for macOS, Windows, and Linux. Every build of main is a numbered release (Releases › Latest), and the app updates itself ([app/README.md](<../app/README.md>)) |
| Domain | None by default (Home mode: every app on the tailnet), or your domain on Cloudflare (`example.com` in these docs) |
| External access | Home mode: Tailscale Serve. With a domain: Cloudflare Tunnel → Nginx Proxy Manager. No open router ports either way |
| LAN access | With a domain: AdGuard Home answers `*.example.com` with this computer's address → Nginx Proxy Manager |
| Threat blocking | CrowdSec, enforced inside Nginx Proxy Manager for LAN and tunnel traffic |
| Backups | Duplicati → `BACKUP_DESTINATION` (a cloud drive folder such as Proton Drive, or an external drive); databases dumped nightly by `./homelab backup` |
| Alerts | ntfy (topics: `watchtower`, `duplicati-alerts`, `uptime-kuma`, `tunnel-watchdog`, `reminders`), plus a healthchecks.io heartbeat |
| Media | An external drive (`/Volumes/Media` on a Mac) |
| Household money | **Finances**, a screen of the app itself: typed in by hand, kept in `data/finance.json`, on the phones you allow |

The full app list with addresses and ports is in [Inventory](<Inventory.md>). It is generated from the compose files, so it is always current.

## Start here

| Page | For |
|---|---|
| [Getting Started](<Getting Started.md>) | From an empty computer to a homelab the household uses, step by step, without code |
| [Testing](<Testing.md>) | The script for each test session on a real machine, with what every step should show |
| [To-do](<To-do.md>) | The next things only a person can do, in order |
| [Upgrading](<Upgrading.md>) | What to do after pulling a newer version, batch by batch |
| [Commands](<Commands.md>) | Every `./homelab` command on one page |

## Run it

| Page | For |
|---|---|
| [Runbooks](<Runbooks.md>) | Step-by-step procedures, each ending with a check |
| [Automation](<Automation.md>) | Scheduled jobs, the nightly updates, the Duplicati jobs, and alert topics |
| [Monitoring](<Monitoring.md>) | The watchdog, ntfy, Uptime Kuma, the heartbeat, and CrowdSec |
| [Backups](<Backups.md>) | What is backed up, how, and the restore test |
| [Disaster Recovery](<Disaster Recovery.md>) | Rebuilding a lost machine from the backups in one command (`homelab rebuild`), moving to a new one, and the recovery kit |
| [Troubleshooting](<Troubleshooting.md>) | Symptoms and their usual fixes, by where you notice them |
| [Known Issues](<Known Issues.md>) | Open problems and what is still to verify |

## How it works

| Page | For |
|---|---|
| [Architecture](<Architecture.md>) | Diagrams of the traffic paths and the engine, the Compose projects, a night of jobs |
| [Networking](<Networking.md>) | The LAN, DNS, the Docker network, and Cloudflare |
| [Security](<Security.md>) | The security posture, its standards, and the review of what is reachable from outside |
| [Storage](<Storage.md>) | Folders, volumes, and the paths Duplicati sees |
| [Docker](<Docker.md>) | The container runtime, Compose projects, and container standards |
| [Host](<Host.md>) | The machine: the Mac's power, login, and FileVault settings, and the Linux and Windows profiles |
| [Environment](<Environment.md>) | Every `.env` setting and what it is for |

## The apps

| Page | For |
|---|---|
| [Services](<Services.md>) | Every app's note, by category (generated) |
| [Inventory](<Inventory.md>) | Every address and port (generated) |
| [Savings](<Savings.md>) | The subscriptions each app can replace, and what that is worth |
| [Service Organization](<Service Organization.md>) | How services are grouped into category projects and stacks |

## The project

| Page | For |
|---|---|
| [Roadmap](<Roadmap.md>) | What comes next, version by version |
| [Decisions](<Decisions.md>) | Architecture decisions and why they were made |
| [Contributing](<Contributing.md>) | Changing the homelab safely; adding a service |
| [Standards](<Standards.md>) | Engineering standards |
| [Releasing](<Releasing.md>) | Building and publishing the desktop app, numbered releases and their patch notes, and self-update |
| [Homelab Manifest](<Homelab Manifest.md>) | Mission, values, and rules |
| [Homelab Context](<Homelab Context.md>) | The household, host, and network the project is designed around, and the code layout |
| [Maintainer Guide](<Maintainer Guide.md>) | Critical facts, the code layout, and rules for changing the repository |

## Before changing anything

Read the [Maintainer Guide](<Maintainer Guide.md>) first. The critical facts:

- Nginx Proxy Manager is a locally built image with the CrowdSec bouncer. Never update it by pulling `jc21/nginx-proxy-manager`; use `./homelab update nginx-proxy-manager`.
- Duplicati jobs use container paths (`/source/...`, `/staging/...`), never paths on the computer.
- Everything joins the `homelab` Docker network. The proxy and the tunnel reach apps by service name (`immich-server:2283`), not through `host.docker.internal`.
- The budget tracker's folder is `stacks/budget-tracker` (not `money`).
- Run Compose through the CLI: `./homelab compose <app> <args>` picks the right project, folder, and `.env`.

## Service notes

```text
services/
  network/                proxy, DNS, tunnel, Tailscale, ad blocking on the tailnet, speed tests
  security/               Vaultwarden, CrowdSec, Uptime Kuma, ntfy, Pocket ID, Frigate
  system/                 backups (Duplicati, Kopia), updates, logs, start pages, Beszel, the phone companion, databases
  cloud and files/        Immich, Nextcloud, Syncthing, File Browser, Baikal, PairDrop, PsiTransfer, Dawarich
  documents/              Paperless-ngx and Paperless-AI, Stirling PDF, Karakeep, Linkwarden, FreshRSS, Open WebUI, Memos, Docmost, Kiwix, Changedetection.io
  finance/                MoneyMatter, Actual Budget, Firefly III, Ghostfolio, Wallos
  media/                  Jellyfin, music, audiobooks, books, comics, RomM
  media automation/       the *arr apps, Seerr, Tdarr, qBittorrent with Gluetun
  household/              Home Assistant, Grocy, Mealie, Tandoor, Vikunja, Homebox
```

Each note starts with a table generated from the compose files (image, address, ports, data, backups, updates), then the parts a person writes: purpose, setup, how it works, where things live, everyday use, what it connects to, ideas to try, useful commands, its API where it has one, links to learn more, backup, and troubleshooting.

The change history lives in the repository's [CHANGELOG](<../CHANGELOG.md>), the patch notes for each version, not in the notes. Every note carries the repository version in its front matter.
