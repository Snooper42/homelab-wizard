---
version: 0.9.0-beta
---

# Actual Budget

An envelope budget, lighter than MoneyMatter, with the same budget on every device

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `actual-budget` in `compose/finance.yaml` (project `homelab_finance`) |
| Image | `actualbudget/actual-server:latest` |
| Category | Finance |
| Starts with `./homelab up` | No: optional, `./homelab install actual-budget` |
| Address | https://actual.example.com (LAN, through Nginx Proxy Manager) |
| On this Mac | http://localhost:5006 (`ACTUAL_PORT`) |
| Data | `data/appdata/actual-budget` → `/data` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/actual-budget` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | actual |
<!-- END homelab:generated -->

## Purpose

An envelope budget: every dollar that comes in gets a job (rent, groceries, the holiday), and spending comes out of its envelope. It is the lighter choice beside [MoneyMatter](<MoneyMatter.md>): one small container instead of a stack, no bank connection needed, and the same budget on a phone, a laptop, and this computer, each keeping a copy that syncs through the homelab. Pick one of the two for the household's budget; both can run.

## Setup

1. `./homelab install actual-budget`, then open it: `https://<TAILSCALE_HOST>:5006` in Home mode, `https://actual.example.com` with a domain, or `http://localhost:5006` on this computer.
2. Set the server password on the first page. Everyone in the household signs in with this one password; keep it in Vaultwarden.
3. **Create a new file** (or **Import my budget** from YNAB, nYNAB, or another Actual file), then add your accounts and their balances.
4. On each phone: open the same address in the browser and add it to the home screen. The budget works offline there and syncs when the homelab is reachable.

The app needs a secure address (https, or localhost on this computer): the tailnet and domain addresses are, a plain `http://192.168.1.10:5006` from another device is not, and it then shows *Actual requires access to SharedArrayBuffer*.

## Away from home

In Home mode (the default), Actual Budget is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only; install Tailscale to reach it from anywhere. Since every device keeps its own copy, a phone away from both still shows the budget and catches up later.

## How it works

- One Node.js server (`actual-server`) on port 5006 serves the web app and keeps the sync data. The budget itself runs in the browser, in a local database the browser keeps, and changes travel to the server and on to the other devices.
- The server's own database (`account.sqlite`) holds the password and the list of budget files; each budget's file and its change history live beside it in `user-files`.
- End-to-end encryption is optional (a budget's **Settings › Encryption**): the server then keeps only data it cannot read, and each device asks for the key once.
- Bank sync (GoCardless in Europe, SimpleFIN in North America) is optional and set up in the app; without it, transactions are typed in or imported from your bank's CSV, OFX, or QIF files.

## Where things live

| What | Where |
|---|---|
| Server database (password, list of budgets) | `data/appdata/actual-budget/server-files/account.sqlite` |
| Each budget's file and history | `data/appdata/actual-budget/user-files/` |
| Daily consistent copy of the server database | `recovery-staging/databases/actual-budget` (by `./homelab backup`) |

## Everyday use

- **Budget:** on the budget page, put this month's money into envelopes until *To budget* is zero; move money between envelopes when one runs short.
- **Spend:** add a transaction on the phone as you pay, or import the bank's file once a week (an account's **Import**).
- **Look back:** Reports for spending by envelope, net worth, and cash flow.
- **Plan ahead:** schedules for bills that repeat; envelope templates fill next month's budget the same way (**Apply budget template**).

## Connects to

- [MoneyMatter](<MoneyMatter.md>), the fuller budget with bank imports and investments; Actual Budget is the simpler of the two.
- [Wallos](<Wallos.md>) keeps the subscriptions; their amounts make a good *Subscriptions* envelope.
- `.env`: `ACTUAL_PORT` (default `5006`).

## Tinkering ideas

- End-to-end encryption on a budget (Settings › Encryption), so even the homelab's copy is unreadable.
- Rules (Payees › Rules) that file transactions from the same shop in the same envelope.
- A second budget file for a side project or a club, each with its own envelopes, on the same server.
- `@actual-app/api` (its Node.js library) for your own imports and reports.

## Useful commands

```sh
./homelab logs actual-budget -f
./homelab compose actual-budget restart actual-budget
curl -s http://localhost:5006/health
```

## API

Actual has no web API for budgets: its Node.js library, `@actual-app/api`, opens a budget through the server with the server password and works on it locally. The server answers `GET /health` (`{"status":"UP"}`) for checks.

## Learn more

- [actualbudget.org](https://actualbudget.org) and its [documentation](https://actualbudget.org/docs/)
- [GitHub: actualbudget/actual](https://github.com/actualbudget/actual)

## Backup

The nightly backup takes a consistent copy of the server database (`account.sqlite`); the budget files in `user-files` are covered by the AppData job. Every device also keeps a full copy of each budget it opened, and **Export data** (a budget's Settings) saves one as a file.

## Troubleshooting

- **"Actual requires access to SharedArrayBuffer":** the page was opened at a plain http address from another device. Use the tailnet or domain address (https), or `http://localhost:5006` on this computer.
- **A phone shows old numbers:** it could not reach the homelab; open the budget with the homelab reachable and it syncs. **Reset sync** (Settings › Advanced) makes that device fetch the server's copy again.
- **Forgot the server password:** `./homelab compose actual-budget exec actual-budget node /app/scripts/reset-password.js` sets a new one.
