---
version: 0.12.0
---

# Baikal

Calendars and contacts for every phone and computer (CalDAV and CardDAV)

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `baikal` in `compose/cloud.yaml` (project `homelab_cloud`) |
| Image | `ckulka/baikal:nginx` |
| Category | Cloud & Files |
| Starts with `./homelab up` | No: optional, `./homelab install baikal` |
| Address | https://dav.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:5232 (`BAIKAL_PORT`) |
| Data | `data/appdata/baikal/config` → `/var/www/baikal/config`<br>`data/appdata/baikal/specific` → `/var/www/baikal/Specific` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | radicale, calendar, contacts, caldav, carddav |
<!-- END homelab:generated -->

## Purpose

The household's calendars and contacts, synced to every iPhone, Mac, and Android phone over the open CalDAV and CardDAV standards, instead of iCloud or Google. Shared calendars (the family calendar, bin days) live here too.

## Setup

1. `./homelab install baikal` and open it: `https://<TAILSCALE_HOST>:5232` in Home mode, or `https://dav.example.com` with a domain.
2. The first visit runs Baikal's setup: set the admin password (save it in Vaultwarden as `homelab - baikal admin`), keep SQLite, and finish.
3. In the admin pages, **Users and resources** › **Add user** for each person. Each user gets a default calendar and address book.
4. On an iPhone: Settings › Apps › Calendar › Calendar Accounts › Add Account › Other › **Add CalDAV Account**, server `dav.example.com` (in Home mode `<TAILSCALE_HOST>:5232`), the person's user name and password. Then the same under Contacts with **Add CardDAV Account**. On a Mac: System Settings › Internet Accounts › Add Other Account. On Android: DAVx⁵ with `https://dav.example.com/dav.php`.
5. To move from iCloud: export each calendar from Calendar on the Mac (File › Export) and import it into the new account; export contacts as a vCard from Contacts and import it the same way.

## Away from home

In Home mode (the default), Baikal is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere, or, to publish it through the tunnel, add `public: true` to its `x-homelab` block and run `./homelab domain setup` again.

## How it works

- A PHP app built on the sabre/dav library; this image runs it with nginx and PHP-FPM in one container.
- Phones and computers talk to `/dav.php` over CalDAV (calendars and reminders) and CardDAV (contacts). The `/.well-known/caldav` and `/.well-known/carddav` addresses point clients there, which is why the server name alone works on an iPhone.
- The admin pages at `/admin` manage users and their calendars and address books. There is no calendar web page: you read and edit events in your usual apps.
- All data is in one SQLite database; settings are in one YAML file.

## Where things live

| What | Where |
|---|---|
| Settings (admin password, sign-in type, time zone) | `data/appdata/baikal/config/baikal.yaml` (`/var/www/baikal/config`) |
| Database: users, calendars, events, contacts | `data/appdata/baikal/specific/db/db.sqlite` (`/var/www/baikal/Specific/db`) |

## Everyday use

- Add or remove people at `/admin` › **Users and resources**. The buttons beside each user open their calendars and address books, where you can add more (for example "Bin days").
- A user's addresses, for apps that ask for a full URL: `https://dav.example.com/dav.php/calendars/<user>/` and `https://dav.example.com/dav.php/addressbooks/<user>/`.
- Apps: Calendar, Contacts, and Reminders on iPhone, iPad, and Mac; DAVx⁵ on Android; Thunderbird on any computer.

## Connects to

- Reached through [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) at `dav.example.com`; from away through [Tailscale](<../network/Tailscale.md>). In Home mode, Tailscale serves it at `https://<TAILSCALE_HOST>:5232`.
- The admin password belongs in [Vaultwarden](<../security/Vaultwarden.md>).
- [Home Assistant](<../household/Home Assistant.md>) has a CalDAV integration that shows these calendars and can start automations from events.
- `.env`: `BAIKAL_PORT`.

## Tinkering ideas

- Make a `family` user whose calendar every device adds as a second account, for things everyone should see.
- Keep shopping and to-do lists in Reminders on the CalDAV account, so they sync through Baikal too.
- Use Home Assistant's CalDAV integration to announce bin day the evening before.
- On Android, pair DAVx⁵ with jtx Board or Tasks.org for tasks.
- Add the same accounts to Thunderbird for calendars and contacts on a Windows or Linux computer.

## Useful commands

The well-known redirect, a user's calendars listed over CalDAV (replace `alice`; it asks for her password), the users in the database, the logs, and a restart:

```zsh
curl -sI http://localhost:5232/.well-known/caldav
curl -s --anyauth -u alice -X PROPFIND -H 'Depth: 1' http://localhost:5232/dav.php/calendars/alice/
sqlite3 data/appdata/baikal/specific/db/db.sqlite 'SELECT username FROM users;'
./homelab logs baikal -f
./homelab compose baikal restart baikal
```

## Learn more

- Docs: https://sabre.io/baikal/
- Source: https://github.com/sabre-io/Baikal
- Image: https://github.com/ckulka/baikal-docker
- DAVx⁵ for Android: https://www.davx5.com/

## Backup

The SQLite database and settings are in `data/appdata/baikal`, covered by the AppData job.

## Troubleshooting

- **The phone says the account cannot be verified:** use the server name without `https://` on iOS, and check the address opens in Safari on the same Wi-Fi.
- **The setup page comes back:** `data/appdata/baikal/config` is empty or not writable; check its owner.
