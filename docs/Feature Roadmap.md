---
version: 0.17.0
---

# Feature Roadmap

The features that would make Homelab Wizard a pleasure to use, grouped by area: the small touches (a right-click menu, an undo, a hover that answers a question) as much as the big screens. The [Roadmap](<Roadmap.md>) says what each version must prove; this page is the list of what to build, to pick from.

Each item has a size and a status:

- **Size:** **S** is a day or less, **M** a few days, **L** a week or more, or a piece of the backend that does not exist yet.
- **Status:** *Idea* (only written here), *Mocked up* (drawn, not built), *Next* (the next batch), or *Built* (in the app, with the pull request).

The Finances screen's history and rules are in [the Finances loop's file](<../.claude/prompts/finances-loop.md>); its unfinished items are under **Finances** below.

## Built in November 2026

What started this page: small features asked for one by one, each now in the app.

| Feature | What it does | Pull request |
|---|---|---|
| Health in one line | At the top of every screen but Status: ✓ All well, or the one thing that needs you, with Open Status | #470 |
| Snooze an alert | Snooze… beside a failing check on Status's Watchdog card: no alerts about it for an hour or a day, and one then if it still fails | #469 |
| Tailnet devices | Settings › Phones lists every device on the tailnet, online or when last seen, one unseen for a month marked, and Remove… opens it in Tailscale's admin console | #465 |
| Weekly integrity check | On Sundays each Duplicati job's backup is checked with Duplicati's own Verify; a damaged file is a failing check (and an alert) and a red line on Backups, the last check on each job's hover | #463 |
| A copy before anything risky | An app's databases are dumped before it starts again on changed settings (a domain or tailnet address, Pocket ID sign-in, Fix it's changed settings), as before an update; a dump that fails stops the change | #461 |
| Memory pressure alert | The apps above 90% of the memory Docker has for two watchdog runs in a row: one alert naming the three biggest, and Status's Watchdog card lists them, each with Stop | #458 |
| An update window per app | An app's page › **Only on Sundays**, or `homelab updates days` for any days: the other nights' updates leave it alone | #457 |
| Phones that expire | Settings › Phones › **For a week** beside a phone: its changes and Finances end then, and it only looks | #455 |
| The last Status, offline | Away from home with no tailnet, the phone opens on the last Status it saw, with a line saying when, rather than an error | #453 |
| Add to Home Screen, done right | The phone companion added to the Home Screen has the app's icon on an iPhone and Android (PNG, maskable), its name, a splash in the app's own background, and a bar that follows light or dark mode | #452 |
| Status read aloud | A screen reader hears each row's change on Status as it is drawn (a Restart's step and its end, an app that goes down), apps that change together in one line | #451 |
| A sheet of shortcuts | Press ? on any screen (or pick *Keyboard shortcuts* in ⌘K) for that screen's shortcuts, those that work everywhere, and each screen's key | #450 |
| Shapes as well as colours | Status's dots are a circle when up, a triangle when an app is stopped or needs a look, and a cross when it's down, so a state reads without its colour | #449 |
| Quick actions | On a phone that may make changes, hold an app's row on Status for Open, Start, Restart, Stop, Stop for a while, and Logs | #447 |
| A sheet for the fridge | Each person's apps, addresses, phone apps, and a code for the camera, on one printed page, without passwords or the sign-in link | #446 |
| Suggestions from what you use | Choose stacks › Add more opens on the apps that go with ones you run (Beets with Navidrome, Bazarr with Sonarr), each with what it brings | #445 |
| Quiet hours | From 10 PM to 7 AM alerts reach the phone without a sound, unless the vault is unreachable or backups have failed two nights running | #439 |
| Two apps that do the same job | Choose stacks says when you already run one that does it (Komga and Kavita, Mealie and Tandoor), and why you might keep one or both | #438 |
| Savings over time | Hover *Replaces a year* on Status for what the apps have saved since the first nightly record, month by month | #437 |
| What changed since last night | On Backups, each copy's size beside the night before's; one less than half the night before's is marked in red | #435 |
| What CrowdSec stopped | The proxy's page lists every address CrowdSec stopped since midnight, where from, what it tried, and whether it's still banned | #430 |
| What happened overnight | Status's first line in the morning: the night's updates, rollbacks, backup, and whether anything needed you | #420 |
| After sleep | When the machine wakes, every app is checked at once rather than at the watchdog's next run | #422 |
| A restart that keeps failing | An app Docker restarted 3 times in an hour is stopped and flagged with its last log lines, instead of restarting forever | #427 |
| A drive comes back | Apps waiting for an unplugged drive start within a minute of it being plugged in again | #423 |
| An update's notes | Hover *updates held* on Status for why, how to put it back, and the first lines of its newest release | #419 |
| A backup's contents | Hover an off-site job's time on Backups for its last run, how long it took, what it holds, the versions kept, its folders, and its next run | #418 |
| Remember where you were | Each screen keeps its scroll and open sections between visits and after quitting; another screen opens at its own place | #417 |
| What changed since you looked | A dot beside each app on Status that restarted, updated, stopped, or started since your last visit, cleared once you leave | #416 |
| Open, your way | Alt-click (⌥-click) an address on Status to copy it; Shift-click (⇧-click) Open for its address on this computer | #415 |
| Pinned apps | Right-click › Pin to the top keeps an app in a Pinned group at the top of Status, and first in the menu bar's Open an app | #414 |
| Right-click the sidebar | A screen's own menu from the sidebar: Status's Check again and Update all, Backups' Back up now and Test a restore, Finances' Add a transaction, Update balances, and Hide amounts | #413 |
| Why it restarted | Hover *up 9 minutes* on Status for why the app last started and when: you, an update, Fix it, the watchdog, the power back, its drive back, a Stop for a while ending, or Docker after a crash | #411 |
| A balance's accounts | Rest on a group in the sidebar's Accounts for its accounts, each balance, and how long since each was updated; a dot on one older than a month | #409 |
| The week's outages | Hover *96.2% up this week* on Status for the week as a strip, with each time the app was down, how long, and why | #406 |
| Command palette | ⌘K (Ctrl+K) on any screen, then an app's name for its Open, page, Restart, Stop, or Logs, or *stop media*, *back up now*, *update all*, a screen; Stop asks twice | #395 |
| Export your finances | Finances › **Export**: the plan as JSON, the year ahead as a spreadsheet, and this month or the next on a page that prints itself; on a phone too | #405 |
| Type to filter Status | Typing an app's name on Status keeps only the apps that have it; Return opens the first, Escape brings every app back | #385 |
| Finances on the phone | A phone's Finances opens with the next two weeks of bills, card charges on their cards, and the goals with what each needs a paycheck | #381 |
| Card charges on the calendar | A bill charged to a card shows on its day, on its card with the card's due day, never as checking money; on the phone too | #380 |
| Tidy Up | Music, books, films, TV, and audiobooks sorted, tagged, and shrunk; new downloads filed by themselves, lyrics, and a nightly sweep of leftovers ([Tidy Up](<Tidy Up.md>)) | #376 |
| A balance opens its own group | A sidebar balance opens Net worth on that group alone: its total, and each of its accounts month by month | #379 |
| The calendar a year ahead | Past the three months checking is read for, each payday and payment on its day to a year out, so a yearly renewal shows in its month | #373 |
| Right-click an app's row | Open, Open on a phone, Copy address, Restart, Stop, Stop for a while, Logs, Back up now, and Tell me if it stops, where you click; Shift+F10 too | #369 |
| Hide amounts, and the money card | ⌘⇧H or the eye writes every amount as $•••, on the phones too; a wall screen picked for it shows the next payday, what is left, and the next 3 bills | #368 |
| Stopped on purpose, and Stop for a while | An app stopped from its group's menu or its page stays stopped: nothing starts it by itself, and its row says *Stopped by you*. Stop for a while stops it for an hour, until tonight, or until tomorrow, then it starts again | #367 |
| A group's menu | Click a category's count on Status ("Media · 7 running ✓ · 1.6 GB") for its memory, each app's share, and Start, Restart, or Stop them all | #362 |
| Balances on every screen | The sidebar's Accounts shows whatever screen is open; a group opens Net worth | #361 |
| Click outside to close | A click on the dimmed screen around a panel closes it, as its Close or Cancel would | #361 |
| Back on power | Apps paused on battery start within a minute of plugging in, and one that will not start no longer holds the rest | #361 |
| beets in the Music pick | Tagging and filing music comes with Navidrome and Feishin | #358, #360 |

## Next

The first batch, chosen because each makes the group menu safer or quicker. A loop builds this page in order, one pull request per feature ([its prompt](<../.claude/prompts/features-loop.md>)):

1. Right-click an app's row (Everyday control): *Built*
2. Stopped on purpose (Everyday control): *Built*
3. Stop for a while (Memory): *Built*
4. Undo (Everyday control): *Built*

## Everyday control

The things you do many times a day, made one click shorter.

- **Right-click an app's row** (M, *Built*, #369): Open, Open on a phone, Copy address, Restart, Stop, Logs, Back up now, Tell me if it stops. Everything on the app's page, without opening it. A right-click on a group's heading opens its menu.
- **Stopped on purpose** (M, *Built*, #367): an app you stop from the menu stays stopped. Start them all, the watchdog, and plugging in skip it, and its row says "Stopped by you" with Start beside it. The wait for a drive skips it too.
- **Undo** (S, *Built*, #375): after Stop, Stop all, or Stop for a while, a note for 10 seconds: "Stopped 6 Media apps · Undo", and ⌘Z. Restart all has none (nothing to take back).
- **Right-click the sidebar** (S, *Built*, #413): Status: Check again, Update all. Backups: Back up now, Test a restore. Finances: Add a transaction, Update balances.
- **Command palette** (M, *Built*, #395): ⌘K (Ctrl+K elsewhere), then type "immich" for Open, Restart, or Logs, or type "stop media", "back up now", "update all".
- **Type to filter Status** (S, *Built*, #385): start typing an app's name on Status and the list narrows, as Finder does; Escape clears it, and Return opens the first one's page.
- **A quick peek** (M, *Idea*): Space on a selected row shows its last log lines, memory, uptime, and its address's QR code, without leaving Status.
- **Pinned apps** (S, *Built*, #414): pin the apps you open most to the top of Status and of the menu bar item's Open an app.
- **Open, your way** (S, *Built*, #415): ⌥-click (Alt-click) an address to copy it; ⇧-click Open to use the address on this computer instead of the domain.
- **What changed since you looked** (S, *Built*, #416): a dot on each row whose state changed since you last opened Status (restarted, updated, stopped), cleared once seen.
- **Remember where you were** (S, *Built*, #417): each screen keeps its scroll position and open sections between visits and restarts.
- **Drop files onto an app** (M, *Idea*): drop a PDF on Paperless's row and it goes into its import folder; an album folder on beets lands in its downloads; photos on Immich go to an album named for the day.

## Answers on hover

Questions the screen can answer without a click.

- **Why it restarted** (S, *Built*, #411): hover "up 9 minutes" for the reason: an update, a crash, the battery saver, the watchdog, or you, with the time.
- **The week's outages** (S, *Built*, #406): hover "94% up this week" for a strip of the week with each time it was down, and why.
- **A balance opens its own group** (S, *Built*, #379): clicking Cash or Investments in the sidebar opens Net worth on that group's accounts, not the whole page; each account opens its own history.
- **A balance's accounts** (S, *Built*, #409): hover a group in the sidebar's Accounts for its accounts and how long since each was updated; a dot marks one older than a month.
- **A backup's contents** (S, *Built*, #418): hover a backup's time on Backups for its size, what it holds, and how long it took.
- **An update's notes** (S, *Built*, #419; "updates held" only, as Status has no per-app update waiting yet): hover "updates held" or an update waiting for the release's first lines.

## Memory and performance

So a laptop or a small machine stays responsive, and you can see why when it does not.

- **A Memory screen** (L, *Mocked up*): what OrbStack (or Docker Desktop) uses of the machine's memory, split into the apps, the runtime and its cache, and what is free; today's peak; a chart of the day with its spikes named (the nightly updates, Immich reading photos); every group and app with its memory now and its peak; and Ways to free memory. Needs a day of samples kept by the agent, and the runtime's own total.
- **An app's Memory tab** (M, *Mocked up*): each part of an app (its server, its database, its machine learning) with its line over the day, its peak, and how often it was stopped for memory.
- **Stop for a while** (S, *Built*, #367): Stop for an hour, until tonight, or until tomorrow, then it starts again by itself; from the group menu and an app's page, and later from a row's right-click and the Memory screen.
- **Memory limits** (M, *Mocked up*): a limit for an app or one part of it, suggested from its peak; reaching it restarts that part, and the watchdog says so.
- **Stop when idle** (L, *Mocked up*): stop Immich's machine learning after an hour with no new photos and start it when a phone uploads; the same for other apps with a clear sign of work.
- **Ways to free memory** (M, *Mocked up*): suggestions from what the apps actually do: one idle for hours, two that do the same job (Komga and Kavita), one not opened in a month, and the runtime's limit set higher than the apps need.
- **Memory pressure alert** (S, *Built*, #458): an alert when the apps stay above 90% of the memory Docker has for 10 minutes or more (two watchdog runs in a row), naming the three biggest; Status's Watchdog card lists them, each with Stop, until it comes down.
- **Quiet hours for heavy work** (M, *Idea*): Tdarr, Immich's jobs, and the downloads run at night, or while the machine is idle and plugged in, and pause when you use it.
- **Disk space ahead** (M, *Idea*): at today's rate, when each drive fills (photos, downloads, backups), and which app grows fastest.

## Reliability and self-healing

The homelab looks after itself, and says what it did.

- **Start in order** (M, *Idea*): Start all and Restart all start databases and VPNs first (Gluetun before qBittorrent), from each app's dependencies.
- **One app at a time** (M, *Idea*): the nightly update updates one app, waits for it to answer, then the next; the first that stays unwell is rolled back and the rest are held until morning.
- **An update window per app** (S, *Built*, #457): update Immich only on Sundays (an app's page › **Only on Sundays**, or `homelab updates days immich sun` for any days). Still an idea: Vaultwarden at once when a security release comes out.
- **A restart that keeps failing** (S, *Built*, #427): an app Docker restarted three times in an hour is stopped and flagged, with its last log lines, instead of restarting forever.
- **After sleep** (S, *Built*, #422): when the machine wakes, every app is checked at once rather than at the watchdog's next run.
- **A drive comes back** (S, *Built*, #423): when an unplugged drive returns, the apps waiting for it start within a minute, as the battery saver now does for power. On Linux, where Docker made an empty folder in the drive's place and started the app on it, the library folders now wait for the drive too (#428).
- **What happened overnight** (S, *Built*, #420): Status's first line in the morning: "Overnight: 4 apps updated, 1 rolled back, a backup of 2.1 GB, nothing needed you."

## Security and privacy

Safe by default, and easy to check.

- **Hide amounts** (S, *Built*, #368): one shortcut (⌘⇧H) and a menu item blur every money figure, the sidebar's balances included, for screen sharing or someone at your shoulder (Finances' *Hide amounts and a wall-screen card*).
- **Lock with Touch ID or Windows Hello** (M, *Idea*): Finances, sign-in details, and the recovery kit ask for the system's own unlock after the app has been idle.
- **What is reachable from the internet** (M, *Idea*): a check from outside, through the tunnel, that lists every address it can reach and flags anything admin that answers.
- **A log of what was done** (M, *Idea*): every start, stop, update, restore, and settings change, by whom (this computer, or which phone), kept for 90 days and searchable.
- **Phones that expire** (S, *Built*, #455): a phone's access to Finances or to changes ends after a time you choose, and Settings › Phones shows when each was last seen.
- **Tailnet devices** (S, *Built*, #465): every device on the household's tailnet in Settings › Phones, online or when it was last seen (a month unseen is marked), and Remove for a lost phone, in Tailscale's admin console where it is done.
- **Rotate a secret** (M, *Idea*): a new database password or API key put in `.env` and into the app, then the app restarted, in one step; old ones flagged after a year.
- **Images with known holes** (M, *Idea*): each running image checked against the public vulnerability lists weekly; one with a critical finding is named with its fix version.
- **What CrowdSec stopped** (S, *Built*, #430): the addresses banned today, where from, and what they tried, on the proxy's page (and CrowdSec's): Status › Nginx Proxy Manager.
- **Two-step sign-in, nudged** (S, *Idea*): Setup and the weekly summary name each admin app without a second factor until it has one.

## Backups and data

Confidence that what matters can come back.

- **Restore one file** (M, *Idea*): browse a backup by app and date and bring back one document, photo, or setting without restoring the whole app.
- **Yesterday's version of an app** (M, *Idea*): Restore to last night on an app's page: its data and its image as they were, the current ones kept aside in case.
- **A copy before anything risky** (S, *Built*, #461): a database dump just before an update (with the app's own data, kept for the week a rollback can use it), before a restore (`rollback --data` sets today's aside), and now before an app starts again on changed settings (a new address, signing in with Pocket ID, settings changed by hand), kept with the nightly dumps.
- **What changed since last night** (S, *Built*, #435): each backup's size beside the night before's, with a warning when an app's data shrinks sharply (under half of a copy of 1 MB or more).
- **Weekly integrity check** (S, *Built*, #463): Duplicati's own Verify of each job on Sundays (`homelab backup-check`, a sample of its files against the hashes it recorded); a damaged file is a failing check on Status and a red line on Backups until a check passes again.

## Notifications and alerts

Few, clear, and useful when they come.

- **Buttons on alerts** (M, *Idea*): "Radarr stopped" on the phone with **Restart** and **Show logs** (ntfy's actions, through the phone companion's own access).
- **Quiet hours** (S, *Built*, #439): no sound overnight unless it is serious (backups failing for days, the vault unreachable). `QUIET_HOURS=22-7` by default; Settings › Quiet hours.
- **One alert for many** (S, *Idea*): three apps stopping together is one alert, "3 apps stopped: the drive was unplugged", not three.
- **Snooze an alert** (S, *Built*, #469): snooze one failing check for an hour or a day beside it on Status's Watchdog card (or `homelab notify snooze`): still checked, not alerted about until it wakes, and alerted then if it still fails. Not from the phone's alert itself: ntfy's buttons would need a way in to the computer from the notification.
- **Who hears what** (S, *Idea*): each person picks the alerts they get; the household's other members get only the ones about their apps.

## The household

The homelab as something a family uses, not one person.

- **Guest access** (M, *Idea*): a guest's sign-in to chosen apps (Jellyfin, an Immich album) that ends on a date.
- **A printable welcome sheet** (S, *Built*, #446): each person's apps, addresses, and QR codes on one page for the fridge, linked from their welcome page, with no sign-in link or password on it.
- **Each person's apps** (S, *Built*): a person's welcome page lists only the apps they use, with their phone app for each (`homelab person apps <name> <app>…`).
- **What's new for the family** (S, *Idea*): a short page in plain words when an app they use gains something (a new player in Navidrome), not the technical notes.

## Apps and the catalog

Picking, trying, and using apps.

- **Import music on a button** (M, *Idea*): beets' import from Status, with the albums it is unsure of asked in the app instead of Terminal. The [Roadmap](<Roadmap.md#the-library-in-order>) has the library work in order.
- **Try an app for a day** (M, *Idea*): install an app on trial; tomorrow the app asks to keep it or removes it with its data.
- **Suggestions from what you use** (S, *Built*, #445): with Navidrome, beets; with Sonarr, Bazarr; each with one line on why. Thirteen, in each app's `goes_with`, under Choose stacks › Add more › *Suggested for what you run*.
- **Two apps that do the same job** (S, *Built*, #438): Choose stacks says when you already run one that does it (Komga and Kavita, Navidrome and Jellyfin's music), and why you might want both. Eight pairs, in each app's `same_job`.
- **Quick settings on an app's page** (M, *Idea*): the two or three settings people change most (Navidrome's scan interval, Immich's machine learning on or off) as switches, without opening the app.

## The desktop and the menu bar

The app at home on each system.

- **A Dock menu** (M, *Idea*): right-click the Dock icon for Open an app ▸, Back up now, Pause updates. Likely needs native code beyond the app's framework; the Windows taskbar's jump list and a Linux desktop file's actions are the same idea.
- **An app's submenu in the menu bar** (S, *Idea*): Open an app ▸ Immich ▸ Open, Restart, Logs.
- **⌥-click the menu bar item** (S, *Idea*): Option-click (as with Wi-Fi) for more: each app's memory, the runtime's version, Restart the runtime.
- **A global shortcut** (S, *Idea*): one key anywhere opens the command palette over whatever you are doing.
- **Shortcuts and Siri** (L, *Idea*): actions for the Shortcuts app: back up now, stop an app, the homelab's state.
- **Widgets** (L, *Idea*): Status and net worth on the desktop and the phone's home screen, once signing is in place (the [Roadmap](<Roadmap.md#later>) has the iOS app).

## The phone companion

The household's phones as a second screen.

- **The last Status, offline** (S, *Built*, #453): away from home with no tailnet, it shows the last Status it saw and when, rather than an error. The page itself is kept on the phone too (a service worker), where it's served over HTTPS.
- **Add to Home Screen, done right** (S, *Built*, #452): an icon, a name, and a splash screen, so it opens like an app: PNG icons an iPhone takes (and a maskable one for Android), a splash in the app's own background, and the bar above it light or dark with the phone.
- **Quick actions** (S, *Built*, #447): long-press an app for Open, Restart, Stop for a while, on a phone that may make changes (also Start, Stop, and Logs).

## Media library cleanup

Begun by the owner on Nov 3, 2026, with the two scripts and a wider brief (films, TV, audiobooks, the Downloads inbox, lyrics, a nightly sweep, and space reclaimed by itself): built as [Tidy Up](<Tidy Up.md>). The plan below was its starting point; where the brief changed it (reports in `reports/media`; Windows too; duplicates and verified backups to the Trash by themselves rather than kept for review), Tidy Up's page says how it works now.

- **Library cleanup** (L, *Built*, #376): the owner's tested engine, two stdlib Python scripts added unchanged at `tools/media/` (`music_organizer.py`: init, status, scan, run, finalize, verify, undo, delete-backup; `books_organizer.py`: init, status, review, apply, undo), wrapped, not rewritten. The plan, agreed in outline:
  1. **Settings from the homelab:** `homelab media` writes `data/homelab_media.json` before each run (libraries from `MEDIA_ROOT`, `pause_containers` as the containers that mount each library, the beets container's image, `engine: container`) and always passes `--config`.
  2. **CLI:** `homelab media music|books <action> [flags]` runs the script with `--events json`, prints the events as ordinary CLI lines, forwards flags, and never adds `--yes` itself.
  3. **Background and lock:** `--background` runs the job detached (it outlives the window and the app), holding `data/media.lock` (pid, script, action, start) and writing `logs/media/<job>.jsonl`; one media job at a time; a stale lock (its process gone) offers to run the same action again, which the scripts resume.
  4. **A Library cleanup page** from the Media group's menu and Navidrome's and Calibre-Web's pages: `status --json`; Scan → Run → Finalize → Verify → Delete backup, Undo after Finalize; Books: Review → Apply → Undo; live progress, a summary from the `result` event, and buttons for the album report CSV, the planned changes CSV, the books review page, and *Music - Needs Attention*.
  5. **Confirmations:** a native dialog before each step that changes anything, and only then `--yes`; Delete backup in an in-app sheet that needs DELETE typed (Wails' dialogs take no text).
  6. **Battery:** no `music run` on battery; *Start when plugged in*, picked up by the awake job within a minute of power.
  7. **Updates:** while the lock is held, nightly updates and Update apps postpone every app whose container mounts a media library (Navidrome, beets, Calibre-Web, Komga, Kavita), and say so; updating one alone is refused; `homelab up` at login leaves them too, so nothing starts Navidrome mid-swap.
  8. **Backups:** nothing backs up the music library today (Duplicati and Kopia have no music source), so the guard is a doctor and Needs a look warning for any job, the owner's own included, that covers the music folder without excluding `.music-cleanup`, and the exclusion built in should a music job ever be added.
  9. **Needs a look**, from what the wrapper records after each step (`data/media.json`), so Status runs no Python: verify exit 2; built but not swapped; the originals' backup still there 14 days after finalize (Verify, then Delete backup); a books review that flagged misfiled books.
  10. **Preflight** with plain fixes: python3 on the Mac (checked without macOS's install prompt), the library drive mounted, OrbStack running, the beets image pulled (offer to pull it), calibredb installed.
  11. **Tests** with no Docker or Python: a stub `python3` replays recorded event fixtures and exit codes; event parsing, settings generation, the lock, battery, nightly and single updates, `up`, and each Needs a look case.

  **Never** delete `~/.music-cleanup` or `<library>/.music-cleanup/original` (the original library's backup and the scripts' saved progress); only the script's own `delete-backup`, after DELETE is typed. Don't change the scripts' genre lists or matching rules; any other change to them small, in its own commit, with why. Four PRs: the CLI, settings, and lock; the page, dialogs, and progress; battery, updates, `up`, and backups; Needs a look and preflight.

  **Still to decide with the owner:** where reports go (`<homelab>/reports/media` rather than `~/Downloads`, proposed); after a crash or restart, a Resume button (proposed) or resuming a stopped Run at login; Mac and Linux only (proposed; the scripts and Calibre's paths are Mac and Linux); Needs a look as a line in its tile plus a note atop Status opening the page (proposed).

## Finances

The Finances loop's unfinished items, built by the features loop now, with their numbers from its backlog. The rest of its backlog (items 1 to 15, 22 to 24, and the MoneyMatter list) is in the app.

- **Hide amounts and a wall-screen card** (S, *Built*, #368; F16): every money figure as $••• on ⌘⇧H, View › Hide Amounts, or the eye on Finances, kept in the plan so the phones follow; and a money card with the next payday, what is left after it, and the next 3 bills, on a wall screen allowed it in Settings › Phones.
- **The calendar, further ahead** (S, *Built*, #373; F20): a payment past the chart's 93 days, such as a yearly renewal, shows in its month a year ahead, without a balance.
- **Card charges on the calendar** (S, *Built*, #380; F21): a bill charged to a card shows on its day, marked "on Chase Freedom", with the card's due day.
- **Finances on the phone** (M, *Built*, #381; F17): the phone's Dashboard opens with Coming up (the next two weeks of bills, card charges on their cards) and the goals; the calendar (a list of days), Renewing soon, and Update balances (one sheet, every account) were already there.
- **Export** (S, *Built*, #405; F18): the plan and its projection as CSV and JSON, and a printable month.
- **Polish, all along** (S, *Idea*; F19): empty states for a new plan, alignment, 860px and phone widths, contrast themes, focus order, labels; a little in each Finances round.

## Accessibility and polish

Details that make it feel finished.

- **Status read aloud** (S, *Built*, #451): VoiceOver and Narrator announce a job's progress and a row's change, not only the result: *Vikunja: Restarting…*, then *Vikunja: Running*, and apps that go down together in one line.
- **A sheet of shortcuts** (S, *Built*, #450): press ? (or *Keyboard shortcuts* in ⌘K) for the shortcuts of the screen you are on, then those that work everywhere and each screen's key.
- **Shapes as well as colours** (S, *Built*, #449): each state's dot also has a shape (a circle when up, a triangle when stopped or it needs a look, a cross when down), for colour-blind eyes, small screens, and contrast themes.
- **Every menu by keyboard** (S, *Built*, #369, #413): right-click menus open with the context-menu key and Shift+F10, and work like More… (arrows, Escape): an app's row, a group's heading, and the sidebar.

## Insight

What the homelab did for you, in numbers you can trust.

- **A monthly report** (M, *Idea*): uptime, backups and restore tests, updates, memory, and what the apps replaced in money, as a page and a PDF.
- **Health in one line** (S, *Built*, #470): "All well", or the one thing that needs you (an app in its row's words, several in one line, or a failing check that is no app's), at the top of every screen but Status, with Open Status.
- **Savings over time** (S, *Built*, #437): what the apps have saved since the homelab started, month by month, from [Savings](<Savings.md>): hover *Replaces a year* on Status.
