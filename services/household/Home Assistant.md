---
version: 0.14.0
---

# Home Assistant

Smart-home hub for lights, locks, sensors, and automations.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `home-assistant` in `compose/household.yaml` (project `homelab_household`) |
| Image | `ghcr.io/home-assistant/home-assistant:stable` |
| Category | Household |
| Starts with `./homelab up` | No: optional, `./homelab install home-assistant` |
| Address | https://home.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8123 (`HOME_ASSISTANT_PORT`) |
| Data | `data/appdata/home-assistant` → `/config` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

The smart-home hub: lights, locks, thermostats, sensors, and the automations that tie them together, all running locally instead of in each vendor's cloud.

## Setup

1. `./homelab install home-assistant`, open it, and create the owner account.
2. The install writes a starter `configuration.yaml` (from `config/home-assistant`) that already trusts the proxy, so `https://home.example.com` works from the first start. On an existing configuration it changes nothing; add this block yourself and restart it (`./homelab restart home-assistant`):
   ```yaml
   http:
     use_x_forwarded_for: true
     trusted_proxies:
       - 172.16.0.0/12
       - 192.168.0.0/16
       - 10.0.0.0/8
   ```
3. Add integrations. In a container on macOS, Home Assistant cannot discover devices on its own (no mDNS, Bluetooth, or USB radios such as Zigbee sticks), so add network devices by their address. For discovery and radios, run Home Assistant OS in a VM instead and point the proxy at it.

## How it works

- A Python app (Home Assistant Core) on port 8123. This is the Container install: there is no Supervisor, so no add-on store and no OS updates from inside the app. Extra services such as an MQTT broker or Zigbee2MQTT run as containers of their own.
- Integrations connect devices and services. Each one adds entities (a light, a sensor, a switch) whose state changes are written to the recorder database, a SQLite file in `/config`.
- Automations, scripts, and scenes react to those states. Ones you build in the web editor are saved to `automations.yaml`, `scripts.yaml`, and `scenes.yaml`; integrations and dashboards set up in the web app live in `.storage`.
- `configuration.yaml` is the starting point. The starter one the homelab wrote (`config/home-assistant`) loads `default_config` and trusts the proxy's private address ranges.
- It runs on the homelab's Docker network, not the host network, so it sees devices only by address. That is why discovery, Bluetooth, and USB radios do not work here.

## Where things live

| What | Where |
|---|---|
| Main configuration | `data/appdata/home-assistant/configuration.yaml` → `/config/configuration.yaml` |
| Automations, scripts, scenes | `automations.yaml`, `scripts.yaml`, `scenes.yaml` in the same folder |
| Passwords referenced as `!secret` | `secrets.yaml` |
| Settings made in the web app | `.storage/` (do not edit while it runs) |
| History database | `home-assistant_v2.db` |
| Log | `home-assistant.log` |
| Built-in backups | `backups/` |
| Community integrations, blueprints | `custom_components/`, `blueprints/` |

## Everyday use

- **Add a device or service:** Settings › Devices & services › **Add integration**, then search by brand. Here most need an IP address.
- **Automate:** Settings › Automations & scenes › **Create automation**: a trigger (motion, time, sunset, someone arriving), optional conditions, and actions.
- **Dashboards:** Overview › pencil to edit; Settings › Dashboards to make more.
- **Phone:** the Home Assistant companion app (iOS and Android) with `https://<TAILSCALE_HOST>:8123` in Home mode, or `https://home.example.com` with a domain. It adds notifications, location for presence, and phone sensors (battery, Wi-Fi) as entities.
- **Check and reload YAML:** Developer tools › YAML checks the configuration and reloads automations without a restart.
- **Keyboard:** **e** searches entities, **c** opens the command palette, **a** opens Assist.
- **Backups:** Settings › System › Backups makes a backup into `backups/`.

## Connects to

- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves `https://home.example.com`; that is why the `trusted_proxies` block must be there.
- [ntfy](<../security/ntfy.md>): send alerts to the phone through ntfy with a `rest_command` (or use the companion app's own notifications).
- [Mealie](<Mealie.md>) has a built-in integration (meal plan and shopping lists); [Grocy](<Grocy.md>) has a community one.
- [Open WebUI](<../documents/Open WebUI.md>) uses Ollama on this Mac; Home Assistant's Ollama integration can use the same server for its voice assistant.
- [Jellyfin](<../media/Jellyfin.md>), [AdGuard Home](<../network/AdGuard Home.md>), and [Uptime Kuma](<../security/Uptime Kuma.md>) have integrations too, to show what is playing, DNS stats, or monitor states.
- `.env` sets only `HOME_ASSISTANT_PORT` (default `8123`) and `TZ`.

## Tinkering ideas

- Presence: with the companion app on each phone, turn things off when the last person leaves (Settings › People sets who is tracked).
- Blueprints: Settings › Automations & scenes › Blueprints › import a ready-made automation from the community forum.
- Zigbee without USB: a network (Ethernet or Wi-Fi) Zigbee coordinator works with ZHA or Zigbee2MQTT by its address, sidestepping the USB limit on macOS.
- Energy: Settings › Dashboards › Energy, with a smart plug or meter reading, tracks use over time.
- HACS: the community store, copied into `custom_components`, adds integrations and cards that are not built in. Read what you install; it runs inside Home Assistant.
- Keep the history smaller: a `recorder:` block with `purge_keep_days: 10` in `configuration.yaml`.

## Useful commands

Follow the log, restart, check the configuration before a restart, and call the API with a long-lived token:

```zsh
./homelab logs home-assistant -f
./homelab restart home-assistant
./homelab compose home-assistant exec home-assistant python -m homeassistant --script check_config --config /config
./homelab compose home-assistant exec home-assistant ls -la /config
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/states
```

## API

- **Token:** your profile › Security › Long-lived access tokens › **Create token**.
- **Base URL:** `http://localhost:8123/api/` on this Mac, or `https://home.example.com/api/`, with `Authorization: Bearer <token>`. `/api/` answers `API running.` when the token works.
- **Turn on a light:** `curl -s -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{"entity_id":"light.kitchen"}' http://localhost:8123/api/services/light/turn_on`
- Reference: [REST API](https://developers.home-assistant.io/docs/api/rest/); there is also a WebSocket API that the web app itself uses.

## Learn more

- [Home Assistant documentation](https://www.home-assistant.io/docs/)
- [Companion apps](https://companion.home-assistant.io)
- [GitHub: home-assistant/core](https://github.com/home-assistant/core) (source of the `ghcr.io/home-assistant/home-assistant` image)

## Backup

`data/appdata/home-assistant` (configuration, history database, and its own backups) is covered by the AppData job. Home Assistant's built-in backups land there too.

## Troubleshooting

- **400 Bad Request through the proxy:** the `trusted_proxies` block is missing (an existing configuration is never overwritten).
- **A device is not found:** add it by IP address; automatic discovery does not work in this setup.
