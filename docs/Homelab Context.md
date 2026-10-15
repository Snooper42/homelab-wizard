---
version: 0.1.0-alpha
---

# Homelab Context

The facts this project is designed around. Read this before suggesting a change. Addresses and names are examples: `example.com` for the domain, `192.168.1.10` for the Mac.

## Who and what

- A private homelab for one household. One person administers it; family members use a handful of apps from their phones.
- The goal is to own photos, documents, passwords, music, and books, with little maintenance.
- Uptime matters for passwords, photos, and documents; everything else can wait a day.

## The host

- One Mac with Apple Silicon (a Mac mini, or a MacBook kept plugged in), kept awake by the homelab's awake job. See [Host](<Host.md>). Linux and Windows profiles exist too.
- OrbStack runs the containers. Jellyfin runs as a native app for hardware transcoding.
- Media is on an external drive (`MEDIA_ROOT`, `/Volumes/Media` by default).
- The homelab folder lives at `~/Homelab`, outside folders that macOS syncs or protects.

## The network

- A home router with the Mac's address reserved (`192.168.1.10` in these docs).
- Many ISP routers cannot hand out a custom DNS server, so either each device points at the Mac by hand, or Tailscale's DNS setting does it for every Tailscale device.
- No ports are open on the router. Public apps go through a Cloudflare Tunnel.
- The domain is on Cloudflare. Without one (Home mode), every app is on the tailnet instead.

## Constraints that shape every decision

| Constraint | Consequence |
|---|---|
| One machine as the only host | Single point of failure; backups must leave the Mac (Proton Drive or another synced folder) |
| Containers run in a Linux VM | No hardware video encoding in containers; paths must be shared with OrbStack |
| FileVault | Nothing starts after a reboot until someone logs in |
| A consumer cloud drive as the off-site target | Large media is not backed up; photos, documents, and settings are |
| Family uses native apps | No login gateway (Cloudflare Access) in front of public apps |
| One administrator | Prefer boring, documented, automated solutions over clever ones |

## What runs by default

Only the crucial apps run by default: the proxy, DNS, security, backups, monitoring, passwords, photos, documents, budget, music, audiobooks, books, and comics. Everything else is defined, documented, and one command away (`./homelab install <app>`). See [Service Organization](<Service Organization.md>).
