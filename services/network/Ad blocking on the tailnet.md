---
version: 0.11.0-beta
---

# Ad blocking on the tailnet

Sends DNS from your Tailscale devices to AdGuard Home, so ads are blocked at home and away

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `tailnet-dns` in `compose/network.yaml` (project `homelab_network`) |
| Image | `alpine/socat:latest` |
| Category | Network |
| Starts with `./homelab up` | No: optional, `./homelab install tailnet-dns` |
| Depends on | `tailscale`, `adguard-home` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Ad and tracker blocking on every phone and computer signed in to Tailscale, at home and away, without touching the router or each device's Wi-Fi settings. It is a small forwarder: DNS sent to this machine's tailnet address goes on to [AdGuard Home](<AdGuard Home.md>), which does the blocking. The tailnet's DNS setting then points every device at that address.

## Setup

1. Home mode working first ([Tailscale](<Tailscale.md>): Setup › **Addresses on your tailnet**, signing in when it opens Tailscale's page).
2. Choose stacks › **Ad blocking** › Install (or `./homelab install @adblock`). That brings AdGuard Home with it, and the install runs `./homelab adguard setup`: it answers AdGuard's first-run wizard with a generated login (saved as `ADGUARD_USER` and `ADGUARD_PASSWORD`) and shows this machine's tailnet address (`100.x.y.z`).
3. In the Tailscale admin console › DNS › Nameservers › Add nameserver › Custom: that address, then Save. Turn on **Override DNS servers**.
4. On the phone, with Tailscale on and Wi-Fi off, an ad-heavy page loads without its ads, and AdGuard's dashboard counts the queries.

## How it works

- The container is `socat` in [Tailscale](<Tailscale.md>)'s network namespace (`network_mode: service:tailscale`). Tailscale runs in userspace mode, where a connection to its own tailnet address is handed to `127.0.0.1` inside that namespace; `socat` listens there on port 53 (UDP and TCP) and passes each query to `adguard-home:53` on the `homelab` network.
- With **Override DNS servers** on, the Tailscale app on each device sends every lookup to that nameserver through the tailnet, so blocking works on mobile data too. MagicDNS names (`*.ts.net`) are still answered by Tailscale itself.
- AdGuard sees every tailnet query as coming from the Tailscale container, so its per-device statistics lump them together.
- When Tailscale restarts it gets a new network, and this container would be left on the old one. So it checks every 10 seconds that `adguard-home` still resolves; after 30 seconds without, it exits, and Docker starts it again inside Tailscale's new network. A health check makes the same test, so Status shows it as needing a look meanwhile (or while AdGuard is down).

## Where things live

| What | Where |
|---|---|
| The forwarding commands | `compose/network.yaml` › `tailnet-dns` › `command` |
| Blocklists, rules, query log | AdGuard Home ([its note](<AdGuard Home.md>)) |
| The nameserver setting | Tailscale admin console › DNS (not on this machine) |

## Everyday use

- Nothing to do day to day. Blocked and allowed lookups show in AdGuard Home's Query Log.
- A site broken by blocking: AdGuard › Query Log › find the request › Unblock.
- **While this machine is off**, devices with Tailscale on cannot look up any name. Turn Tailscale off on them until it is back, or turn off **Override DNS servers** for a longer outage. The watchdog and the heartbeat ([Monitoring](<../../docs/Monitoring.md>)) tell you when it is down.

## Connects to

- [Tailscale](<Tailscale.md>): shares its network and its tailnet address; it starts after Tailscale.
- [AdGuard Home](<AdGuard Home.md>): every query goes there.
- `./homelab adguard setup`: sets up AdGuard and prints the address for the admin console.

## Tinkering ideas

- Add a second nameserver in Tailscale (for example `9.9.9.9`) so lookups still work while this machine is off; some will then skip AdGuard, so blocking becomes partial.
- Restrict the nameserver to a few domains (split DNS) instead of overriding all DNS, to use AdGuard's rewrites only.
- Give a child's phone stricter rules in AdGuard: Settings › Client settings, by its tailnet name.

## Useful commands

```zsh
./homelab adguard setup
./homelab logs tailnet-dns -f
./homelab restart tailnet-dns
./homelab compose tailscale exec tailscale nslookup doubleclick.net 127.0.0.1
```

## Learn more

- [DNS in Tailscale](https://tailscale.com/kb/1054/dns)
- [socat manual](http://www.dest-unreach.org/socat/doc/socat.html)
- [Image on Docker Hub](https://hub.docker.com/r/alpine/socat)

## Backup

Nothing to back up: it keeps no data. AdGuard Home's settings are in the Homelab AppData job.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Phones cannot open any site with Tailscale on | This machine or AdGuard is down: Status › Fix it; meanwhile turn Tailscale off on the phone |
| Ads still show | Override DNS servers is off in the Tailscale admin console, or a second nameserver is answering instead |
| *Needs a look* for more than a minute | AdGuard is down (Status › Fix it), or Tailscale was recreated by hand: `./homelab restart tailnet-dns` |
| `adguard setup` says AdGuard was set up in its wizard | Put the login you made there in Settings › `ADGUARD_USER` and `ADGUARD_PASSWORD` |
