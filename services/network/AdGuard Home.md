---
version: 0.13.0
---

# AdGuard Home

DNS for the house. It blocks ads and trackers and answers every `*.example.com` name with the Mac's address, so LAN traffic goes straight to the proxy. That is for a homelab with a domain; in Home mode (no domain, the default) it is optional and only blocks ads, through [Ad blocking on the tailnet](<Ad blocking on the tailnet.md>).

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `adguard-home` in `compose/network.yaml` (project `homelab_network`) |
| Image | `adguard/adguardhome:latest` |
| Category | Network |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://ads.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3003 (`ADGUARD_PORT`) |
| Data | `data/appdata/adguard-home/conf` → `/opt/adguardhome/conf`<br>`adguard-work (volume)` → `/opt/adguardhome/work` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

- LAN DNS server on port 53 of the Mac (192.168.1.10).
- One rewrite, `*.example.com` → 192.168.1.10, so every hostname works at home without a trip through Cloudflare.
- Network-wide ad and tracker blocking.

## Setup

1. Setup › **Set up AdGuard** (or `./homelab adguard setup`) answers the first-run wizard: admin pages on port 80 and DNS on 53 (the container maps them to 3003 and 53 on the Mac), with a generated login saved as `ADGUARD_USER` and `ADGUARD_PASSWORD`. By hand instead: the wizard at http://localhost:3002 with those two ports, then put the login you made in Settings. Afterwards, the key button on its row in Status shows the user name and copies the password.
2. Settings > DNS settings: set the upstream servers and bootstrap servers ([Networking](<../../docs/Networking.md>)).
3. `./homelab domain setup` adds the rewrite (Filters > DNS rewrites).
4. Point each device's DNS at 192.168.1.10, or, for every Tailscale device at home and away, install [Ad blocking on the tailnet](<Ad blocking on the tailnet.md>).
5. On the Mac itself: `./homelab domain resolver` (Setup › This Mac finds its apps by name) makes it look up every `*.example.com` name here, also with a VPN on. It asks for the Mac password once.

## How it works

- One Go program is both the DNS server (port 53, TCP and UDP) and the web admin (container port 80, `3003` on this Mac). There is no database server: settings are one YAML file, and the query log and statistics are files in the work folder.
- Each query is checked against the DNS rewrites, your custom rules, and the blocklists (downloaded and refreshed on a timer). A rewrite answers with its address, a blocked name gets an empty answer (`0.0.0.0` in the default mode), and everything else goes to the upstream servers and is cached.
- Every device whose DNS is 192.168.1.10 uses it. The wildcard rewrite is how `*.example.com` reaches Nginx Proxy Manager without leaving the house.
- The CLI talks to its HTTP API (`/control/...`) with `ADGUARD_USER` and `ADGUARD_PASSWORD` to add and update the rewrite.

## Where things live

| What | Where |
|---|---|
| Settings, upstreams, rewrites, filter lists, users | `data/appdata/adguard-home/conf/AdGuardHome.yaml` → `/opt/adguardhome/conf/AdGuardHome.yaml` |
| Query log | `adguard-work` volume → `/opt/adguardhome/work/data/querylog.json` |
| Statistics | `/opt/adguardhome/work/data/stats.db` |
| Downloaded blocklists | `/opt/adguardhome/work/data/filters/` |
| Web sign-in sessions | `/opt/adguardhome/work/data/sessions.db` |

## Everyday use

- **Dashboard:** queries, the blocked share, and the top clients and domains. How long statistics are kept is under Settings › General settings.
- **Query Log:** what a device looked up and why it was blocked or allowed. Each row has buttons to block or unblock that domain.
- **Filters › DNS blocklists:** add lists (Add blocklist › Choose from the list) and check for updates.
- **Filters › Custom filtering rules:** one-off rules, such as `@@||example.com^` to allow a domain or `||ads.example.com^` to block one.
- **Filters › DNS rewrites:** the `*.example.com` rewrite lives here. Add your own for LAN devices, such as a printer.
- **Settings › Client settings:** name devices by address, so the log shows "Kitchen iPad" instead of 192.168.1.x.
- **Setup guide:** how to point each kind of device at it.

## Connects to

- Sends every `*.example.com` name to [Nginx Proxy Manager](<Nginx Proxy Manager.md>) on this Mac.
- [Ad blocking on the tailnet](<Ad blocking on the tailnet.md>) passes it the lookups of every Tailscale device, once the tailnet's DNS setting points at this machine's tailnet address. In Home mode that is the only way devices use it: no address depends on it, so it is an optional pick (**Ad blocking**).
- [Tailscale](<Tailscale.md>) uses it as the split-DNS nameserver for `example.com`, so the names work away from home.
- `./homelab domain setup` writes the rewrite through its API with `ADGUARD_USER` and `ADGUARD_PASSWORD`. `ADGUARD_PORT` (3003) and `ADGUARD_SETUP_PORT` (3002) are its ports on this Mac; `HOMELAB_DOMAIN` is the rewritten name.
- [Uptime Kuma](<../security/Uptime Kuma.md>) checks both its web page and a real lookup ([Monitoring](<../../docs/Monitoring.md>)).
- Without it, `./homelab domain setup --dns hosts` writes the names into `/etc/hosts` instead ([Networking](<../../docs/Networking.md>)).

## Tinkering ideas

- Settings › Client settings: give a child's device its own client with blocked services (Filters › Blocked services lists them), Safe Search, or parental control, leaving everyone else alone.
- Filters › DNS blocklists › Add blocklist › Choose from the list: add a malware or tracker list and watch the blocked share on the dashboard.
- Settings › DNS settings: compare the upstream modes (load balancing, parallel requests, fastest IP address) by the average processing time on the dashboard.
- Settings › DNS settings: turn on DNSSEC validation.
- Custom filtering rules with `$client`, such as `||youtube.com^$client=192.168.1.42`, to block a domain for one device only.
- Query Log: filter by one device for a day to see how chatty it is.

## Useful commands

The API takes the admin login from `.env` (`ADGUARD_USER`, `ADGUARD_PASSWORD`). `dig` against 192.168.1.10 asks AdGuard directly; a blocked name answers `0.0.0.0`.

```zsh
./homelab logs adguard-home -f
./homelab compose adguard-home restart adguard-home
dig npm.example.com @192.168.1.10
dig doubleclick.net @192.168.1.10
curl -s -u admin:<password> http://localhost:3003/control/status
curl -s -u admin:<password> http://localhost:3003/control/rewrite/list
curl -s -u admin:<password> "http://localhost:3003/control/querylog?limit=20"
```

## API

- Sign-in: HTTP basic auth with the admin login (`ADGUARD_USER`, `ADGUARD_PASSWORD`).
- Base URL: `http://localhost:3003/control` on this Mac.
- Example: `curl -s -u admin:<password> http://localhost:3003/control/stats`.
- Reference: the OpenAPI file in the [openapi folder](https://github.com/AdguardTeam/AdGuardHome/tree/master/openapi) of the source repo.

## Learn more

- [AdGuard Home wiki](https://github.com/AdguardTeam/AdGuardHome/wiki)
- [Source on GitHub](https://github.com/AdguardTeam/AdGuardHome)
- [Image on Docker Hub](https://hub.docker.com/r/adguard/adguardhome)

## Backup

`data/appdata/adguard-home/conf` (settings, rewrites, filter list choices) is in the Homelab AppData job. The query log and statistics (`adguard-work` volume) are not backed up.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Won't start: port 53 in use | Something on the Mac holds 53, usually Internet Sharing. Turn it off |
| Admin page unreachable after the wizard | The admin port was set to something other than 80. Set `http.address: 0.0.0.0:80` in `conf/AdGuardHome.yaml` and restart |
| A device can't open `*.example.com` | Its DNS is not 192.168.1.10. Check with `dig npm.example.com @192.168.1.10` |
| The Mac can't open `*.example.com`, often with a VPN on | `./homelab domain resolver --apply` |
| A site is broken by blocking | Query log > find the blocked request > Unblock |
