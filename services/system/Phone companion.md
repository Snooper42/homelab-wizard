---
version: 0.15.0
---

# Phone companion

Status, alerts, backups, and Finances on your phones, each paired with a code; home network and tailnet only.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Runs as | A native app, not a container |
| Install | `./homelab schedule install` |
| Category | System |
| Starts with `./homelab up` | No: a native app (`./homelab schedule install`) |
| Address | https://homelab.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8099 |
<!-- END homelab:generated -->

## Purpose

![The companion on a phone](../../docs/images/app-phone.png)

The homelab on your phone: the same Status and Backups screens as Homelab Wizard on the Mac, with each app's dot and address, alerts, the watchdog, savings, and the backups and restore test. It is for checking on the homelab from the sofa or from away, and for a quick restart without walking to the Mac.

On the phones you allow, it is also the household's Finances: the same screen as on the Mac (Dashboard, Recurring, Pay, Net worth), on your phone and your partner's, to look at or to change.

## Setup

1. Nothing to install: the serve job runs it (`./homelab schedule install`, or Setup › **Install the jobs**). `PHONE_COMPANION=false` turns it off.
2. On the Mac: Homelab Wizard › Settings › **Phones**, give the phone a name, and **Pair a phone**. It shows a QR code, the code, and links with the code in them (`https://homelab.example.com/#pair=…`, the tailnet address in Home mode, and `http://<this Mac>:8099/#pair=…` at home). The code works once, for 10 minutes. In Terminal, `./homelab phone pair --name "My iPhone"` prints the same, QR code included.
3. Scan the QR code with the phone's camera (or open a link on it), and tap **Pair**.
4. In Safari: Share › **Add to Home Screen**. It then opens full screen, like an app.
5. To let the phone restart, stop, update, and back up: **Allow changes** in Settings › Phones, or `./homelab phone allow <id>` (`./homelab phone list` shows the id). Ticking *Can make changes* before pairing (`--can-change`) does it at once.
6. To show Finances on it: pick **Sees Finances** (look only) or **Changes Finances** beside the phone in Settings › Phones, or `./homelab phone finances <id> view` (or `edit`; `off` hides them again). Picking it before pairing (`--finances view`) does it at once. It is apart from *Can make changes*: a partner's phone can keep the budget without being able to restart apps, and the reverse.

## How it works

- `homelab serve` is a small web server inside the CLI (Go's `net/http`). It serves the desktop app's frontend (`web/dist`, built into the binary) with one extra script, `companion.js`, that turns each of the app's calls into a request to the Mac.
- Each request carries the phone's own token. The Mac keeps only a hash of each token, with the phone's name, whether it may make changes, and when it was last seen.
- Pairing: `phone pair` stores a hash of a one-time code that expires after 10 minutes; the phone trades the code for its token. After 10 wrong codes in 10 minutes, pairing waits.
- Only requests from this Mac, the home network, containers, and the tailnet get an answer. Anything with Cloudflare's headers is refused, so it never works through the tunnel, even if someone publishes it there by mistake.
- Reading (Status, Backups, alerts, logs) works for every paired phone. Start, stop, restart, update, pausing updates, Back up now, Test a restore, and Fix it need a phone allowed to make changes; the Mac runs the same `homelab` commands the desktop app does.
- Finances go only to a phone allowed them, and only over an encrypted connection (Tailscale, or the https address): a phone paired over plain home Wi-Fi never gets them, nor does a wall screen in kiosk mode, whatever was picked. A phone that may only look gets the plan marked read-only, and the server refuses its saves.
- The plan is the Mac's `data/finance.json`, read and saved by the Mac's own code. Each read carries the file's version; a save from a phone or the Mac made after another device saved is refused, the latest is shown, and a form left open keeps what was typed, so Save again keeps both changes.
- Settings, Setup, and Choose stacks stay on the Mac.

## Where things live

| What | Where |
|---|---|
| Paired phones (names, token hashes, permissions, Finances) | `data/phones.json` (only you can read it) |
| Finances | `data/finance.json`, the same file the Mac's Finances keeps |
| The screens | `web/dist`, inside the `homelab` binary |
| The server | `internal/companion`; `homelab serve` in `cmd/homelab/serve.go` |
| Its log | `scripts/logs/` with the other jobs |

## Everyday use

- Open it from the Home Screen. It follows the homelab as it changes, like Status on the computer.
- Tap an app's address to open the app itself.
- Tap an app's row for its page: its state, its last 200 log lines, its week, and its last backup.
- **Send a report** (top of Status) makes the diagnostics report, with every password and token removed, and opens the share sheet to send it to whoever helps you.
- A lost or sold phone: **Remove** in Settings › Phones (or `./homelab phone remove <id>`); its token stops working at once.

### On a TV or a wall screen

Pair a screen the way you pair a phone, with `&kiosk` at the end of the pairing link (`https://homelab.example.com/#pair=CODE&kiosk`; Settings › Phones shows it). It then shows Status only: larger, without the sidebar or any button, with the time in the corner, and it asks the browser to keep the screen on. It follows the computer as it changes, like the phone. The browser keeps it in kiosk mode across restarts; open the address with `#kiosk=off` to leave. Pair it read-only (the default).

## Connects to

- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) gives it `https://homelab.example.com` at home, behind [CrowdSec](<../security/CrowdSec.md>) like every app.
- [Tailscale](<../network/Tailscale.md>) gives it the tailnet address in Home mode (`https://<TAILSCALE_HOST>:8099`), which works away from home.
- [ntfy](<../security/ntfy.md>) is where the alerts it lists come from; the phone's ntfy app still delivers them.
- [Duplicati](<Duplicati.md>) is read for the off-site jobs.

## Tinkering ideas

- Pair a wall tablet as a read-only status board (kiosk mode, above).
- Give a family member's phone read-only access so they can see whether the homelab is up before asking.
- Your partner's phone with **Changes Finances** and without *Can make changes*: the budget, but no restart button.
- `curl -s -H "Authorization: Bearer <token>" -X POST http://localhost:8099/api/call/Status -d '[]'` returns the same JSON the screens use.

## Useful commands

```zsh
./homelab phone pair --name "My iPhone"
./homelab phone list
./homelab phone allow <id>
./homelab phone read-only <id>
./homelab phone finances <id> view   # or edit, or off
./homelab phone remove <id>
./homelab schedule status
```

## API

- Sign-in: `Authorization: Bearer <token>`, the token a phone gets when it pairs (`POST /api/pair` with `{"code": "…", "name": "…"}`).
- `POST /api/call/<Method>` with the method's arguments as a JSON array returns `{"result": …, "log": [lines]}`. The methods are the desktop app's: `Status`, `LastStatus`, `Backups`, `Alerts`, `Watchdog`, `Protection`, `SavingsHistory`, `DuplicatiJobs`, `AppIcon`, `Logs`, `Report`, and, for phones allowed to make changes, `AppAction`, `SetAppSetting`, `SetUpdatesPaused`, and `Homelab` (`backup`, `restore-test`, `fix`); for phones allowed Finances, over https or the tailnet, `Finances` and (with **Changes Finances**) `SaveFinances`.
- `POST /api/call/StatusBoard` answers in lines of JSON as they come: Status first, then each card asked for (the watchdog, alerts, storage, usage, the week, protection) as it is read, from the background agent when it runs.
- `GET /api/events` follows the homelab's changes as Server-Sent Events, as Status on the computer does.
- `GET /api/me` says which phone the token belongs to, whether it may make changes, and its Finances (`"view"`, `"edit"`, or none).

## Learn more

- [Add to Home Screen on iPhone](https://support.apple.com/guide/iphone/bookmark-favorite-webpages-iph42ab2f3a7/ios)
- [Web app manifests](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)

## Backup

`./homelab backup` copies `data/phones.json` into `recovery-staging/secrets/data` each night, and the encrypted Homelab Secrets job takes it off-site; `homelab move out` carries it too. After a restore or a move, the paired phones keep working.

## Troubleshooting

| Symptom | Fix |
|---|---|
| The link does not open | At home: the Mac's address is right and the serve job runs (`./homelab schedule status`). Away: Tailscale is on, and you used the tailnet address |
| "the phone companion answers only at home and on the tailnet" | The request came from a public address or through Cloudflare. Use the home or tailnet address |
| "that code does not work" | It was used, mistyped, or is over 10 minutes old: run `phone pair` again |
| Back on the pairing form | The phone was removed on the Mac, or Safari cleared its website data. Pair again |
| Restart or Stop is missing | The phone is read-only: `./homelab phone allow <id>` |
| No Finances in the tab bar | The phone is not allowed them: Settings › Phones, or `./homelab phone finances <id> view`. A phone paired with the `http:` link never gets them: remove it and pair it with the https link |
| Finances show no Edit or Add | The phone may only look ("view only" under the heading): pick **Changes Finances** for it |
| "Finances were changed on another device" | Someone saved on another phone or the Mac after this one read the plan. The latest is shown; check your change and Save again |
