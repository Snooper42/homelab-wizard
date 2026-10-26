---
version: 0.9.0-beta
---

# Grocy

Groceries and household stock, chores, and shared to-dos

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `grocy` in `compose/household.yaml` (project `homelab_household`) |
| Image | `lscr.io/linuxserver/grocy:latest` |
| Category | Household |
| Starts with `./homelab up` | No: optional, `./homelab install grocy` |
| Address | https://grocy.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:9283 (`GROCY_PORT`) |
| Data | `data/appdata/grocy` → `/config` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/grocy` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

What is in the pantry and fridge, what to buy, who does which chore, and shared to-dos: the household's running list, with barcode scanning from the phone.

## Setup

1. `./homelab install grocy` and open it.
2. Sign in with `admin` / `admin`, then change the password under the user menu and create an account for each person.
3. Optionally turn off the parts you do not use with the `FEATURE_FLAG_*` settings in `data/appdata/grocy/data/config.php` (see Tinkering ideas).

## How it works

- A PHP app. The LinuxServer.io image runs it with nginx and PHP-FPM; the app is in `/app/www`, and its `data` folder is a link to `/config/data`.
- Everything is in one SQLite database, `grocy.db`. Settings that apply to the whole install (currency, language, which parts are on) are in `config.php`; per-user settings are in the web app.
- Scanning an unknown barcode looks the product up on Open Food Facts (the default lookup plugin).
- Product pictures and other uploads are files in the data folder.

## Where things live

| What | Where |
|---|---|
| Database | `data/appdata/grocy/data/grocy.db` → `/config/data/grocy.db` |
| Settings (currency, locale, feature flags) | `data/appdata/grocy/data/config.php` → `/config/data/config.php` |
| Pictures and uploads | `data/appdata/grocy/data/storage/` |
| Barcode lookup plugins | `data/appdata/grocy/data/plugins/` |
| Web server and PHP settings | `data/appdata/grocy/nginx/`, `data/appdata/grocy/php/` |

## Everyday use

- **Bought something:** Purchase, scan or pick the product, and set the due date. **Used it:** Consume.
- **What is low or expiring:** Stock overview, with colours for due soon, overdue, and below the minimum.
- **Shopping:** Shopping list; products under their minimum stock can be added in one click.
- **Chores and tasks:** Chores overview (who is next, when it is due) and Tasks for one-off jobs.
- **Phone:** the browser's barcode camera works on `https://grocy.example.com`. There is also a community Android app (Grocy Android) that talks to the API.

## Connects to

- [Mealie](<Mealie.md>) is the better place for recipes and meal plans; use one of the two for the shopping list, not both.
- [Homebox](<Homebox.md>) tracks things you keep (tools, electronics); Grocy tracks things you use up.
- [Home Assistant](<Home Assistant.md>) can show stock and chores through a community integration (installed with HACS), using a Grocy API key.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves `https://grocy.example.com`; `.env` sets `GROCY_PORT` (default `9283`), `PUID`, `PGID`, and `TZ`.

## Tinkering ideas

- Turn off what you do not use: set `FEATURE_FLAG_BATTERIES`, `FEATURE_FLAG_EQUIPMENT`, or others to `false` in `config.php` and reload the page.
- Your currency and language: `CURRENCY` and `DEFAULT_LOCALE` in `config.php`.
- Batteries: track when smoke-alarm batteries were last changed and get them on the overview when due.
- Locations: give each product a location (fridge, freezer, cellar) and freeze or thaw stock to change its due date.
- Meal plan: plan recipes on the calendar and put the missing ingredients on the shopping list.
- Calendar feed: the calendar page offers an iCal link with chores and due dates for your calendar app.

## Useful commands

Follow the log, restart, read the settings, and call the API with a key from the user menu › Manage API keys:

```zsh
./homelab logs grocy -f
./homelab compose grocy restart grocy
./homelab compose grocy exec grocy grep FEATURE_FLAG /config/data/config.php
curl -s -H "GROCY-API-KEY: YOUR_KEY" http://localhost:9283/api/stock
curl -s -H "GROCY-API-KEY: YOUR_KEY" http://localhost:9283/api/system/info
```

## API

- **Key:** user menu (top right) › Manage API keys › Add.
- **Base URL:** `http://localhost:9283/api` on this Mac, or `https://grocy.example.com/api`, with the key in the `GROCY-API-KEY` header.
- **Reference:** opening `https://grocy.example.com/api` in the browser shows the interactive API documentation.

## Learn more

- [grocy.info](https://grocy.info)
- [GitHub: grocy/grocy](https://github.com/grocy/grocy)
- [GitHub: linuxserver/docker-grocy](https://github.com/linuxserver/docker-grocy) (the image)

## Backup

`data/appdata/grocy` (the SQLite database and uploads) is covered by the AppData job.

## Troubleshooting

- **Barcode scanning does not open the camera:** the phone needs the https address (`https://<TAILSCALE_HOST>:9283` in Home mode, or `https://grocy.example.com` with a domain).
