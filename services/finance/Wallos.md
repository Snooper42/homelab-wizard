---
version: 0.14.0
---

# Wallos

Every subscription you still pay for, with renewal dates and the yearly total.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `wallos` in `compose/finance.yaml` (project `homelab_finance`) |
| Image | `bellamy/wallos:latest` |
| Category | Finance |
| Starts with `./homelab up` | No: optional, `./homelab install wallos` |
| Address | https://subscriptions.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8282 (`WALLOS_PORT`) |
| Data | `data/appdata/wallos/db` → `/var/www/html/db`<br>`data/appdata/wallos/logos` → `/var/www/html/images/uploads/logos` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/wallos` |
| Updates | Nightly at 4 AM, with a copy of its data first |
| Also known as | subscriptions |
<!-- END homelab:generated -->

## Purpose

Every subscription the household still pays for in one list: price, billing cycle, renewal date, payment method, and the monthly and yearly total, with a reminder before each renewal. It is the other half of [Savings](<../../docs/Savings.md>): what you cancelled, and what is left.

## Setup

1. `./homelab install wallos` and open `https://<TAILSCALE_HOST>:8282` in Home mode, or `https://subscriptions.example.com` with a domain.
2. Register the first account (it becomes the admin), then turn registrations off in Settings › Admin.
3. Add subscriptions; Settings › Notifications › **ntfy** with `https://ntfy.example.com`, topic `reminders`, and the publish token (Settings › `NTFY_PUBLISH_TOKEN` › **Copy**) sends renewal reminders to the phone.

## Away from home

In Home mode (the default), Wallos is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere, or, to publish it through the tunnel, add `public: true` to its `x-homelab` block and run `./homelab domain setup` again.

## How it works

- A PHP app served by nginx and PHP-FPM in one container on port 80, with its data in one SQLite database, `wallos.db`.
- Cron jobs inside the container do the background work each day: move renewal dates forward (1:00), refresh exchange rates (2:00), and send renewal reminders (9:00), in the container's time zone (`TZ`).
- Logos you upload or pick from a web search are saved as files in the logos folder.
- Prices in other currencies are converted with a free exchange-rate provider (Settings, Fixer API key or a provider that needs no key), so totals and statistics stay right.

## Where things live

| What | Where |
|---|---|
| Database | `data/appdata/wallos/db/wallos.db` → `/var/www/html/db/wallos.db` |
| Logos | `data/appdata/wallos/logos/` → `/var/www/html/images/uploads/logos` |
| Cron logs | `/var/log/cron/` in the container (not kept across updates) |
| Daily consistent copy | `recovery-staging/databases/wallos` (by `./homelab backup`) |

## Everyday use

- **Add:** **+** on the main page: name, price, currency, cycle, next payment, payment method, and who pays.
- **Cancelled something:** edit it and **Disable Subscription** instead of deleting it; Statistics then show what the cancelled ones save each month and year.
- **See the year:** Statistics for totals by category, member, and payment method; Calendar for what renews when, with **Export iCalendar** for your calendar app.
- **Set up once:** Settings › Household (who pays), Categories, Payment methods, and the main currency.
- **Phone:** add `https://subscriptions.example.com` to the home screen.

## Connects to

- [ntfy](<../security/ntfy.md>): renewal reminders go to the `reminders` topic with `NTFY_PUBLISH_TOKEN` (Setup step 3).
- [Savings](<../../docs/Savings.md>) lists the services the homelab replaced; Wallos holds what you still pay.
- [MoneyMatter](<MoneyMatter.md>) is the full budget; [Changedetection.io](<../documents/Changedetection.io.md>) can watch a service's pricing page for increases.
- `.env`: `WALLOS_PORT` (default `8282`) and `TZ`, which sets when reminders go out.

## Tinkering ideas

- Monthly budget: Settings › Monthly Budget compares what you set against the monthly total.
- Cancellation reminders: give a subscription a cancellation date to be reminded before a free trial turns paid.
- Two-factor sign-in: Profile › Enable Two Factor Authentication.
- AI recommendations: Settings › AI Recommendations suggests where to save. Pick **Local Ollama** with `http://host.docker.internal:11434` (the Ollama that [Open WebUI](<../documents/Open WebUI.md>) uses) so your list stays on this Mac.
- Household split: set who pays each subscription, and Statistics shows each person's share.

## Useful commands

Follow the log, restart, look at the cron logs, and list subscriptions through the API with the key from your profile page:

```zsh
./homelab logs wallos -f
./homelab compose wallos restart wallos
./homelab compose wallos exec wallos ls /var/log/cron
curl -s 'http://localhost:8282/api/subscriptions/get_subscriptions.php?api_key=YOUR_API_KEY&convert_currency=true'
```

## API

- **Key:** Profile › API Key (**Regenerate** makes a new one).
- **Base URL:** `http://localhost:8282/api/` on this Mac, or `https://subscriptions.example.com/api/`; the key goes in the `api_key` parameter.
- **Example:** `get_subscriptions.php` (above) returns every subscription as JSON, with filters for member, category, payment method, and state.

## Learn more

- [wallosapp.com](https://wallosapp.com)
- [GitHub: ellite/Wallos](https://github.com/ellite/Wallos) (source of the `bellamy/wallos` image)

## Backup

The nightly backup takes a consistent copy of the database (`wallos.db`); logos are covered by the AppData job.

## Troubleshooting

- **Logos do not upload:** `data/appdata/wallos/logos` must be writable by the container.
