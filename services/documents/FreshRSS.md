---
version: 0.14.0
---

# FreshRSS

A self-hosted RSS reader: follow sites and newsletters in one place, synced to any reader app.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `freshrss` in `compose/documents.yaml` (project `homelab_documents`) |
| Image | `lscr.io/linuxserver/freshrss:latest` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install freshrss` |
| Address | https://freshrss.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8085 (`FRESHRSS_PORT`) |
| Data | `data/appdata/freshrss` → `/config` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Read news and blogs without algorithms or accounts elsewhere.

## Setup

1. `./homelab install freshrss`; with a domain, then `./homelab domain setup`.
2. Open `https://<TAILSCALE_HOST>:8085` in Home mode, or `https://freshrss.example.com` with a domain, and finish the installer (SQLite is fine for one household).
3. For mobile apps: Settings › Authentication › allow API access, then set an API password in your profile. Use the Google Reader API URL it shows.

## How it works

- A PHP app. The LinuxServer.io image runs it with nginx and PHP-FPM; the app itself is in `/app/www`, and its `data` and `extensions` folders are links into `/config`.
- Each user has their own SQLite database (the installer's choice here); FreshRSS can also use PostgreSQL or MySQL, not set up here.
- A built-in cron job fetches every feed every 15 minutes. Feeds that support WebSub can push new items sooner, but only when FreshRSS is reachable from the internet, which it is not.
- Mobile and desktop readers sync through its Google Reader API (`/api/greader.php`) or Fever API (`/api/fever.php`), with a separate API password.
- The image turns off FreshRSS's built-in updater; the nightly updates update the image instead.

## Where things live

| What | Where |
|---|---|
| Main configuration | `data/appdata/freshrss/www/freshrss/data/config.php` → `/config/www/freshrss/data/config.php` |
| Each user's database and settings | `data/appdata/freshrss/www/freshrss/data/users/<user>/` (`db.sqlite`, `config.php`) |
| Extensions | `data/appdata/freshrss/www/freshrss/extensions/` → `/config/www/freshrss/extensions` |
| Web server and PHP settings | `data/appdata/freshrss/nginx/`, `data/appdata/freshrss/php/` |
| Command-line tools | `/app/www/cli/` in the container |

## Everyday use

- **Add a feed:** the **+** next to Subscriptions, or Subscription management › Add a feed. Paste a site's address and FreshRSS finds its feed.
- **Read:** **j** and **k** move between articles, **r** toggles read, **f** stars, **space** opens the original page, and **q** refreshes feeds; Settings › Shortcuts lists and changes them.
- **Organise:** put feeds in categories, and add labels to articles you want to keep.
- **Saved searches:** search, then save it as a user query from the search menu so it appears in the sidebar.
- **Phone and desktop apps:** any Google Reader API client, such as NetNewsWire or Reeder on Apple devices and Readrops or FocusReader on Android. Use `https://freshrss.example.com/api/greader.php`, your user name, and the API password.
- **Import and export:** Subscription management › Import / export takes and gives OPML files.

## Connects to

- [Changedetection.io](<Changedetection.io.md>): its RSS feed of changes can be followed here, and so can sites that have no feed of their own.
- [Karakeep](<Karakeep.md>): save an article you want to keep for good with the Karakeep browser extension or the share sheet.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves `https://freshrss.example.com`; `.env` sets `FRESHRSS_PORT` (default `8085`), `PUID`, `PGID`, and `TZ`.

## Tinkering ideas

- Sites without a feed: Add a feed › choose the **HTML + XPath (Web scraping)** type and point it at the parts of the page that list the articles.
- Extensions: browse the official collection, copy one into the extensions folder, then turn it on under Settings › Extensions.
- Filters: a feed's settings can mark articles as read automatically when they match a search, to mute topics you never read.
- Reading view: Settings › Display sets the theme, article width, and whether articles open in the list or one by one.
- Newsletters: many newsletter sites offer an RSS feed of each issue, which keeps them out of your inbox.

## Useful commands

Follow the log, restart, list users, and fetch one user's feeds now (the tools run as the image's `abc` user so file ownership stays right):

```zsh
./homelab logs freshrss -f
./homelab compose freshrss restart freshrss
./homelab compose freshrss exec -u abc freshrss php /app/www/cli/list-users.php
./homelab compose freshrss exec -u abc freshrss php /app/www/cli/actualize-user.php --user <name>
```

## API

FreshRSS speaks the Google Reader API for apps. Turn on API access under Settings › Authentication, set an API password in Settings › Profile, then sign in to get a token:

```zsh
curl -s 'http://localhost:8085/api/greader.php/accounts/ClientLogin?Email=<name>&Passwd=<api-password>'
```

The `Auth=` line it returns goes in an `Authorization: GoogleLogin auth=<token>` header on later calls.

## Learn more

- [freshrss.org](https://freshrss.org) and the [documentation](https://freshrss.github.io/FreshRSS/)
- [GitHub: FreshRSS/FreshRSS](https://github.com/FreshRSS/FreshRSS) and [FreshRSS/Extensions](https://github.com/FreshRSS/Extensions)
- [GitHub: linuxserver/docker-freshrss](https://github.com/linuxserver/docker-freshrss) (the image)

## Backup

`data/appdata/freshrss` (feeds, articles, users, SQLite database) is in the Homelab AppData job. Export your feeds (OPML) occasionally as a portable copy.

## Troubleshooting

If feeds stop refreshing, check `./homelab logs freshrss`; the image refreshes every 15 minutes with its built-in cron.
