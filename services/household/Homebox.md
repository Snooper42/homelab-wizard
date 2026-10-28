---
version: 0.12.0
---

# Homebox

What you own, where it is, and its receipts, serial numbers, and warranties

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `homebox` in `compose/household.yaml` (project `homelab_household`) |
| Image | `ghcr.io/sysadminsmedia/homebox:latest` |
| Category | Household |
| Starts with `./homelab up` | No: optional, `./homelab install homebox` |
| Address | https://inventory.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:7745 (`HOMEBOX_PORT`) |
| Data | `data/appdata/homebox` → `/data` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/homebox` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | inventory |
<!-- END homelab:generated -->

## Purpose

A home inventory: what you own, where it is, what it cost, its serial number, the receipt, the manual, and when the warranty ends. Useful for insurance, moving, and finding the spare charger. Labels with QR codes can be printed for boxes.

## Setup

1. `./homelab install homebox` and open `https://<TAILSCALE_HOST>:7745` in Home mode, or `https://inventory.example.com` with a domain.
2. Register an account, create a group for the household, and invite the others from Profile.
3. Once everyone has an account, set `HOMEBOX_ALLOW_REGISTRATION=false` in Settings and run `./homelab install homebox` again.

## Away from home

In Home mode (the default), Homebox is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere, or, to publish it through the tunnel, add `public: true` to its `x-homelab` block and run `./homelab domain setup` again.

## How it works

- A single Go program that serves the API and the web app on port 7745.
- Everything is in a SQLite database, `homebox.db`, in `/data`, with photos, receipts, and manuals stored as files next to it.
- Data belongs to a group (the household): everyone invited to the group sees the same items and locations.
- Each item can get an asset ID, and the label generator prints QR codes that open the item's page when scanned.
- `HBOX_OPTIONS_ALLOW_REGISTRATION` (fed by `HOMEBOX_ALLOW_REGISTRATION` in `.env`) decides whether the sign-up form is open.

## Where things live

| What | Where |
|---|---|
| Database | `data/appdata/homebox/homebox.db` → `/data/homebox.db` |
| Photos, receipts, manuals | under `data/appdata/homebox/` → `/data` |
| Daily consistent copy | `recovery-staging/databases/homebox` (by `./homelab backup`) |

## Everyday use

- **Add:** the **Create** menu › Item / Asset: name, location, tags, then photos and attachments. Fill in purchase price, date, serial number, and warranty under the item's details.
- **Find:** Search, or browse Locations (rooms, shelves, boxes can nest).
- **Scan:** the Scanner reads a printed QR label or a product barcode with the phone's camera.
- **Maintenance:** log what was done and when (filter changes, servicing), and schedule the next one.
- **Templates:** save an item as a template for things you add often.
- **Phone:** add `https://inventory.example.com` to the home screen.

## Connects to

- [Paperless-ngx](<../documents/Paperless-ngx.md>) keeps the official copy of receipts and warranties; attach a copy here too, or note the Paperless document number on the item.
- [Grocy](<Grocy.md>) is for things you use up; Homebox is for things you keep.
- [Pocket ID](<../security/Pocket ID.md>): Homebox supports OpenID Connect sign-in; see its documentation for the settings.
- [ntfy](<../security/ntfy.md>): Homebox notifiers take Shoutrrr URLs, which include ntfy, for its reminders.
- `.env`: `HOMEBOX_PORT` (default `7745`) and `HOMEBOX_ALLOW_REGISTRATION`.

## Tinkering ideas

- Print labels ahead: Tools › Asset ID Labels › Label Generator makes a PDF of QR labels to stick on boxes before you fill them in.
- Insurance list: Tools › Bill of Materials exports a CSV of items with prices.
- Move in from a spreadsheet: Tools › Import / Export takes and gives CSV files.
- A full export: Tools › Backups writes everything, attachments included, to a zip you can restore on another server.
- Warranty dates on every new appliance, so you know what is still covered when something breaks.
- API keys: Profile › API Keys makes a token for scripts (it expires after 30 days unless you set a date).

## Useful commands

Follow the log, restart, look at the data folder, and check the version:

```zsh
./homelab logs homebox -f
./homelab compose homebox restart homebox
./homelab compose homebox exec homebox ls -la /data
curl -s http://localhost:7745/api/v1/status
```

## Learn more

- [homebox.software](https://homebox.software) (documentation)
- [GitHub: sysadminsmedia/homebox](https://github.com/sysadminsmedia/homebox) (source of the `ghcr.io/sysadminsmedia/homebox` image)

## Backup

The nightly backup takes a consistent copy of the database (`homebox.db`); photos and receipts in `data/appdata/homebox` are covered by the AppData job.

## Troubleshooting

- **Cannot sign up:** registration is off (`HOMEBOX_ALLOW_REGISTRATION`); invite people from an existing account instead.
