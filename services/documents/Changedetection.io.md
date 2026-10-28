---
version: 0.10.0-beta
---

# Changedetection.io

Watches web pages for price drops, restocks, and changes, and tells you through ntfy

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `changedetection` in `compose/documents.yaml` (project `homelab_documents`) |
| Image | `ghcr.io/dgtlmoon/changedetection.io:latest` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install changedetection` |
| Address | https://watch.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:5010 (`CHANGEDETECTION_PORT`) |
| Data | `data/appdata/changedetection` → `/datastore` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | price-tracker |
<!-- END homelab:generated -->

## Purpose

Watches web pages and tells you when they change: a price drops, an item is back in stock, a page you care about is updated. Notifications go to the phone through ntfy.

## Setup

1. `./homelab install changedetection` and open `https://<TAILSCALE_HOST>:5010` in Home mode, or `https://watch.example.com` with a domain.
2. Settings › General: set a password (it has none by default).
3. Settings › Notifications: add `ntfys://:TOKEN@ntfy.example.com/reminders`, with the publish token from Settings › `NTFY_PUBLISH_TOKEN` › **Copy** in place of `TOKEN`.
4. Paste a page's address and **Watch**. For a price, use **Edit › Filters & Triggers** and pick the price with the visual selector, or restock detection on shop pages.

## Away from home

In Home mode (the default), Changedetection.io is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere, or, to publish it through the tunnel, add `public: true` to its `x-homelab` block and run `./homelab domain setup` again.

## How it works

- A Python (Flask) app. For each watch it fetches the page on a timer with a plain HTTP request, keeps a text snapshot, and compares it with the previous one.
- There is no database: settings, watches, and every snapshot are plain files in `/datastore`, one folder per watch.
- Filters (CSS, XPath, JSONPath, and text to ignore) decide which part of a page counts as a change. The restock and price processor reads the stock text and price data that shop pages publish.
- Notifications go out as Apprise URLs; `ntfys://` sends them to [ntfy](<../security/ntfy.md>) over HTTPS.
- `BASE_URL` (`https://watch.example.com`) makes the links inside notifications open the right page.
- Pages that build themselves with JavaScript need a real browser through `PLAYWRIGHT_DRIVER_URL`. None is configured here, so those pages come back empty.

## Where things live

| What | Where |
|---|---|
| App settings and tags | `data/appdata/changedetection/changedetection.json` → `/datastore/changedetection.json` (older versions: `url-watches.json`) |
| One watch: its settings and snapshots | `data/appdata/changedetection/<watch-uuid>/` (`watch.json` plus the saved history) |
| Session secret | `data/appdata/changedetection/secret.txt` |
| Password reset switch | `/datastore/removepassword.lock`: create it and restart, and the password is removed on start |
| Logs | Container output only: `./homelab logs changedetection` |

## Everyday use

- **Add a watch:** paste the address on the main page, give it a tag, and **Watch**. Tags group related watches in the list.
- **Less noise:** Edit › Filters & Triggers: limit the watch to one element, and list lines to ignore (dates, view counters, ads).
- **How often:** Edit › General sets the recheck interval for one watch; Settings › General sets the default for all.
- **What changed:** **History** on a watch shows the difference between any two snapshots; **Preview** shows the latest text.
- **Check now:** **Recheck** on a watch, or select several in the list and recheck them together.

## Connects to

- [ntfy](<../security/ntfy.md>): alerts go to the `reminders` topic, with `NTFY_PUBLISH_TOKEN` from `.env` inside the notification URL.
- [FreshRSS](<FreshRSS.md>): Changedetection.io also publishes an RSS feed of changes (its address carries an access token); follow it in FreshRSS to read changes alongside your feeds.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves `https://watch.example.com`; the app's own port (`CHANGEDETECTION_PORT`, default `5010`) only listens on this Mac.
- [Wallos](<../finance/Wallos.md>) pairs well: watch a subscription's pricing page to hear about a price rise before the renewal.

## Tinkering ideas

- Price drops: choose the restock and price processor when you add a shop page, then set its price limits so only a real drop notifies you.
- Trigger text: Edit › Filters & Triggers › trigger on text such as `In stock`, so only that wording sends an alert.
- Separate alerts per tag: a tag has its own notification settings, so price alerts and page changes can go to different ntfy topics.
- Watch an API instead of a page: point a watch at a JSON URL and filter with `json:$.price`.
- JavaScript-heavy shops: add a `dgtlmoon/sockpuppetbrowser` container and set `PLAYWRIGHT_DRIVER_URL=ws://<its name>:3000` on `changedetection`, as the upstream compose file shows. That also enables Browser Steps (sign in, click, then check).
- Restock watches for several shops under one tag, so you hear from whichever restocks first.

## Useful commands

Follow the log, restart, list the data folder, reset a forgotten password (create the switch file, then restart), and use the API with the key from Settings › API:

```zsh
./homelab logs changedetection -f
./homelab compose changedetection restart changedetection
./homelab compose changedetection exec changedetection ls /datastore
./homelab compose changedetection exec changedetection touch /datastore/removepassword.lock
curl -s -H "x-api-key: YOUR_API_KEY" http://localhost:5010/api/v1/watch
curl -s -H "x-api-key: YOUR_API_KEY" http://localhost:5010/api/v1/systeminfo
```

## API

- **Key:** Settings › API.
- **Base URL:** `http://localhost:5010/api/v1` on this Mac, or `https://watch.example.com/api/v1` on the LAN. Send the key in the `x-api-key` header.
- **Add a watch:** `curl -s -X POST -H "x-api-key: YOUR_API_KEY" -H "Content-Type: application/json" -d '{"url":"https://example.com"}' http://localhost:5010/api/v1/watch`
- Other endpoints list a watch's history (`/watch/<uuid>/history`), tags (`/tags`), and import a list of URLs (`/import`).

## Learn more

- [changedetection.io](https://changedetection.io)
- [GitHub: dgtlmoon/changedetection.io](https://github.com/dgtlmoon/changedetection.io) (source of the `ghcr.io/dgtlmoon/changedetection.io` image, and its wiki)

## Backup

Watches and their history are in `data/appdata/changedetection`, covered by the AppData job.

## Troubleshooting

- **A shop page shows nothing:** it needs a browser to render; those pages need the optional Playwright browser container, not set up here yet.
