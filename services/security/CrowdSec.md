---
version: 0.14.0
---

# CrowdSec

Reads Nginx Proxy Manager's logs, recognises attacks (scans, brute force, exploit attempts), and bans the source. The ban is enforced by the bouncer inside the proxy image, for LAN and tunnel traffic alike. It also pulls CrowdSec's community blocklist.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `crowdsec` in `compose/security.yaml` (project `homelab_security`) |
| Image | `crowdsecurity/crowdsec:latest` |
| Category | Security |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Data | `data/appdata/crowdsec/config` → `/etc/crowdsec`<br>`data/appdata/crowdsec/data` → `/var/lib/crowdsec/data`<br>`config/crowdsec/acquis.yaml, read-only` → `/etc/crowdsec/acquis.d/nginx-proxy-manager.yaml`<br>`config/crowdsec/appsec.yaml, read-only` → `/etc/crowdsec/acquis.d/appsec.yaml`<br>`npm-logs (volume), read-only` → `/var/log/npm` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

- Detection: the `crowdsecurity/nginx-proxy-manager` collection parses the proxy's access and error logs.
- Enforcement: the proxy's Lua bouncer pulls decisions every 10 seconds and answers banned addresses with 403.
- Intelligence: the community blocklist bans known-bad addresses before they try anything.

## Setup

Nothing to do by hand:

- `CROWDSEC_BOUNCER_KEY` registers the proxy's bouncer (`BOUNCER_KEY_nginx_proxy_manager`) when CrowdSec starts, and the proxy uses the same key.
- The proxy's logs reach CrowdSec through the `npm-logs` volume; `config/crowdsec/acquis.yaml` tells it where to look.
- Optional: set `CROWDSEC_ENROLL_KEY` (app.crowdsec.net › Engines › Add) to see alerts in the CrowdSec console.

Check it works:

```bash
./homelab compose crowdsec exec crowdsec cscli bouncers list   # nginx_proxy_manager, recent last pull
./homelab compose crowdsec exec crowdsec cscli metrics         # lines read from /var/log/npm
```

`./homelab doctor` reads the bouncer list for you ("the proxy's bouncer pulled decisions 8 seconds ago"), and the watchdog alerts when the bouncer is missing, revoked, or has not pulled for 5 minutes.

Then run the ban test in [Runbooks](<../../docs/Runbooks.md>): the app's Status screen lists it under **Protection** (as a manual ban) within a minute.

If the bouncer stopped pulling: Status › **Fix it** (or `./homelab fix`) reconnects the proxy to CrowdSec; it shows the plan first, and both restart for a moment. `./homelab logs nginx-proxy-manager` shows CrowdSec errors; a 403 there means CrowdSec no longer accepts the key (its database kept an older registration). By hand, remove the old registration and let CrowdSec register the current key again:

```bash
./homelab compose crowdsec exec crowdsec cscli bouncers delete nginx_proxy_manager
./homelab restart crowdsec
```

## How it works

- One Go program with two halves. The agent tails logs, parses each line, and runs scenarios (for example, "too many 404s from one address in a short time"). The Local API (LAPI, port 8080 on the `homelab` network) stores the resulting alerts and decisions and serves them to bouncers.
- Acquisition files say what to read: `acquis.yaml` (the proxy's logs in `/var/log/npm`) and `appsec.yaml` (the AppSec listener on port 7422, which the proxy's bouncer asks about each request). AppSec loads only the `crowdsecurity/virtual-patching` rules (exploits of known vulnerabilities), which rarely touch normal traffic; if it is down, requests go through.
- Hub collections installed at start (`COLLECTIONS`) say what to detect: `crowdsecurity/nginx-proxy-manager` (log parsers and HTTP scenarios) and `crowdsecurity/appsec-virtual-patching` (rules for known vulnerabilities).
- When a scenario fires, `profiles.yaml` turns the alert into a decision, by default a 4-hour ban of the address.
- It shares its alerts (address and scenario) with CrowdSec's central API and gets the community blocklist back.
- Alerts and decisions are kept in SQLite. The default `crowdsecurity/whitelists` parser skips private addresses.

## Where things live

| What | Where |
|---|---|
| Main configuration | `data/appdata/crowdsec/config` → `/etc/crowdsec` (`config.yaml`) |
| What a ban is (type, duration) | `/etc/crowdsec/profiles.yaml` |
| Installed collections, parsers, scenarios | `/etc/crowdsec/collections/`, `parsers/`, `scenarios/` (linked into `/etc/crowdsec/hub/`) |
| Credentials (local API, central API) | `/etc/crowdsec/local_api_credentials.yaml`, `/etc/crowdsec/online_api_credentials.yaml` |
| Alerts and decisions database | `data/appdata/crowdsec/data` → `/var/lib/crowdsec/data/crowdsec.db` |
| Log sources | `config/crowdsec/acquis.yaml` and `config/crowdsec/appsec.yaml` → `/etc/crowdsec/acquis.d/` (read-only) |
| The proxy's logs | `npm-logs` volume → `/var/log/npm` (read-only) |

## Everyday use

- `cscli decisions list`: who is banned now, why, and for how long.
- `cscli alerts list`: what was detected, including attempts that did not lead to a ban.
- The app's Status screen › Protection and `./homelab doctor` show whether the bouncer is pulling.
- With `CROWDSEC_ENROLL_KEY` set, app.crowdsec.net shows alerts on a map and the engine's health.
- The weekly check in [Monitoring](<../../docs/Monitoring.md>) includes a look at the decisions.

## Connects to

- Reads [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>)'s logs, and the bouncer inside that image enforces the decisions. Tunnel visitors from [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>) are judged by their real address (`CF-Connecting-IP`).
- `.env`: `CROWDSEC_BOUNCER_KEY` (the same key on both sides) and `CROWDSEC_ENROLL_KEY` (optional console).
- The watchdog's bouncer checks alert through [ntfy](<ntfy.md>).

## Tinkering ideas

- Ask why a log line did or did not trigger: `cscli explain --file /var/log/npm/<file> --type nginx-proxy-manager`.
- Change the ban length in `/etc/crowdsec/profiles.yaml` (`duration: 4h`) and restart CrowdSec.
- Send new bans to [ntfy](<ntfy.md>) with the HTTP notification plugin (`/etc/crowdsec/notifications/http.yaml`, then `notifications:` in `profiles.yaml`), using the publishers' token and a granted topic.
- Enroll in the console (`CROWDSEC_ENROLL_KEY`) and subscribe the engine to extra blocklists there.
- Whitelist a trusted outside address (a relative's house, an office) with your own file in `/etc/crowdsec/parsers/s02-enrich/`.
- Look at `cscli metrics` after a week to see which scenarios fire most.

## Useful commands

`cscli` runs inside the container. The `decisions add` line bans a documentation address for 5 minutes, which is a safe way to see a decision appear.

```zsh
./homelab logs crowdsec -f
./homelab compose crowdsec restart crowdsec
./homelab compose crowdsec exec crowdsec cscli metrics
./homelab compose crowdsec exec crowdsec cscli alerts list
./homelab compose crowdsec exec crowdsec cscli decisions list
./homelab compose crowdsec exec crowdsec cscli decisions add --ip 203.0.113.7 --duration 5m
./homelab compose crowdsec exec crowdsec cscli collections list
./homelab compose crowdsec exec crowdsec cscli hub update
./homelab compose crowdsec exec crowdsec cscli capi status
```

## Learn more

- [CrowdSec docs](https://docs.crowdsec.net/)
- [Source on GitHub](https://github.com/crowdsecurity/crowdsec)
- [Image on Docker Hub](https://hub.docker.com/r/crowdsecurity/crowdsec)
- [The proxy's Lua bouncer](https://github.com/crowdsecurity/lua-cs-bouncer)

## Backup

`data/appdata/crowdsec` (configuration, local database of decisions and alerts) is in the Homelab AppData job. If lost, CrowdSec starts fresh and re-downloads the blocklist.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Bouncer stopped pulling, or Status › Protection says the proxy is not connected | Status › Fix it reconnects it (`./homelab fix`) |
| Bouncer missing from `cscli bouncers list` | `CROWDSEC_BOUNCER_KEY` was empty when CrowdSec first started. Set it, then `./homelab update crowdsec nginx-proxy-manager` |
| Metrics show no lines read | The proxy is not writing to `npm-logs`, or `acquis.yaml` is not mounted. `./homelab compose network config` and the logs |
| Someone legitimate was banned | `cscli decisions list`, then `cscli decisions delete --ip <address>` |
| A LAN device is never banned | Expected: private addresses are whitelisted |
