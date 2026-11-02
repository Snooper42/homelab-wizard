---
version: 0.16.0
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
| A group's menu | Click a category's count on Status ("Media · 7 running ✓ · 1.6 GB") for its memory, each app's share, and Start, Restart, or Stop them all | #362 |
| Balances on every screen | The sidebar's Accounts shows whatever screen is open; a group opens Net worth | #361 |
| Click outside to close | A click on the dimmed screen around a panel closes it, as its Close or Cancel would | #361 |
| Back on power | Apps paused on battery start within a minute of plugging in, and one that will not start no longer holds the rest | #361 |
| beets in the Music pick | Tagging and filing music comes with Navidrome and Feishin | #358, #360 |

## Next

The first batch, chosen because each makes the group menu safer or quicker. A loop builds this page in order, one pull request per feature ([its prompt](<../.claude/prompts/features-loop.md>)):

1. Right-click an app's row (Everyday control)
2. Stopped on purpose (Everyday control)
3. Stop for a while (Memory)
4. Undo (Everyday control)

## Everyday control

The things you do many times a day, made one click shorter.

- **Right-click an app's row** (M, *Next*): Open, Open on a phone, Copy address, Restart, Stop, Logs, Back up now, Tell me if it stops. Everything on the app's page, without opening it. A right-click on a group's heading opens its menu.
- **Stopped on purpose** (M, *Next*): an app you stop from the menu stays stopped. Start them all, the watchdog, and plugging in skip it, and its row says "Stopped by you" with Start beside it. Today any of those could start an app you meant to keep off.
- **Undo** (S, *Next*): after Stop all, Restart all, or Stop, a note for 10 seconds: "Stopped 6 Media apps · Undo".
- **Right-click the sidebar** (S, *Idea*): Status: Check again, Update all. Backups: Back up now, Test a restore. Finances: Add a transaction, Update balances.
- **Command palette** (M, *Idea*): ⌘K (Ctrl+K elsewhere), then type "immich" for Open, Restart, or Logs, or type "stop media", "back up now", "update all".
- **Type to filter Status** (S, *Idea*): start typing an app's name on Status and the list narrows, as Finder does; Escape clears it.
- **A quick peek** (M, *Idea*): Space on a selected row shows its last log lines, memory, uptime, and its address's QR code, without leaving Status.
- **Pinned apps** (S, *Idea*): pin the apps you open most to the top of Status and of the menu bar item's Open an app.
- **Open, your way** (S, *Idea*): ⌥-click (Alt-click) an address to copy it; ⇧-click Open to use the address on this computer instead of the domain.
- **What changed since you looked** (S, *Idea*): a dot on each row whose state changed since you last opened Status (restarted, updated, stopped), cleared once seen.
- **Remember where you were** (S, *Idea*): each screen keeps its scroll position and open sections between visits and restarts.
- **Drop files onto an app** (M, *Idea*): drop a PDF on Paperless's row and it goes into its import folder; an album folder on beets lands in its downloads; photos on Immich go to an album named for the day.

## Answers on hover

Questions the screen can answer without a click.

- **Why it restarted** (S, *Idea*): hover "up 9 minutes" for the reason: an update, a crash, the battery saver, the watchdog, or you, with the time.
- **The week's outages** (S, *Idea*): hover "94% up this week" for a strip of the week with each time it was down, and why.
- **A balance opens its own group** (S, *Idea*): clicking Cash or Investments in the sidebar opens Net worth on that group's accounts, not the whole page; each account opens its own history.
- **A balance's accounts** (S, *Idea*): hover a group in the sidebar's Accounts for its accounts and how long since each was updated; a dot marks one older than a month.
- **A backup's contents** (S, *Idea*): hover a backup's time on Backups for its size, what it holds, and how long it took.
- **An update's notes** (S, *Idea*): hover "updates held" or an update waiting for the release's first lines.

## Memory and performance

So a laptop or a small machine stays responsive, and you can see why when it does not.

- **A Memory screen** (L, *Mocked up*): what OrbStack (or Docker Desktop) uses of the machine's memory, split into the apps, the runtime and its cache, and what is free; today's peak; a chart of the day with its spikes named (the nightly updates, Immich reading photos); every group and app with its memory now and its peak; and Ways to free memory. Needs a day of samples kept by the agent, and the runtime's own total.
- **An app's Memory tab** (M, *Mocked up*): each part of an app (its server, its database, its machine learning) with its line over the day, its peak, and how often it was stopped for memory.
- **Stop for a while** (S, *Next*): Stop for an hour, until tonight, or until tomorrow, then it starts again by itself; from the group menu, a row's right-click, and the Memory screen.
- **Memory limits** (M, *Mocked up*): a limit for an app or one part of it, suggested from its peak; reaching it restarts that part, and the watchdog says so.
- **Stop when idle** (L, *Mocked up*): stop Immich's machine learning after an hour with no new photos and start it when a phone uploads; the same for other apps with a clear sign of work.
- **Ways to free memory** (M, *Mocked up*): suggestions from what the apps actually do: one idle for hours, two that do the same job (Komga and Kavita), one not opened in a month, and the runtime's limit set higher than the apps need.
- **Memory pressure alert** (S, *Idea*): an alert when memory stays above 90% for 10 minutes, naming the biggest apps, with Stop on the alert itself.
- **Quiet hours for heavy work** (M, *Idea*): Tdarr, Immich's jobs, and the downloads run at night, or while the machine is idle and plugged in, and pause when you use it.
- **Disk space ahead** (M, *Idea*): at today's rate, when each drive fills (photos, downloads, backups), and which app grows fastest.

## Reliability and self-healing

The homelab looks after itself, and says what it did.

- **Start in order** (M, *Idea*): Start all and Restart all start databases and VPNs first (Gluetun before qBittorrent), from each app's dependencies.
- **One app at a time** (M, *Idea*): the nightly update updates one app, waits for it to answer, then the next; the first that stays unwell is rolled back and the rest are held until morning.
- **An update window per app** (S, *Idea*): update Immich only on Sundays, Vaultwarden at once when a security release comes out.
- **A restart that keeps failing** (S, *Idea*): an app the watchdog restarted three times in an hour is stopped and flagged, with its last log lines, instead of restarting forever.
- **After sleep** (S, *Idea*): when the machine wakes, every app is checked at once rather than at the watchdog's next run.
- **A drive comes back** (S, *Idea*): when an unplugged drive returns, the apps waiting for it start within a minute, as the battery saver now does for power.
- **What happened overnight** (S, *Idea*): Status's first line in the morning: "Overnight: 4 apps updated, 1 rolled back, a backup of 2.1 GB, nothing needed you."

## Security and privacy

Safe by default, and easy to check.

- **Hide amounts** (S, *Idea*): one shortcut (⌘⇧H) and a menu item blur every money figure, the sidebar's balances included, for screen sharing or someone at your shoulder.
- **Lock with Touch ID or Windows Hello** (M, *Idea*): Finances, sign-in details, and the recovery kit ask for the system's own unlock after the app has been idle.
- **What is reachable from the internet** (M, *Idea*): a check from outside, through the tunnel, that lists every address it can reach and flags anything admin that answers.
- **A log of what was done** (M, *Idea*): every start, stop, update, restore, and settings change, by whom (this computer, or which phone), kept for 90 days and searchable.
- **Phones that expire** (S, *Idea*): a phone's access to Finances or to changes ends after a time you choose, and Settings › Phones shows when each was last seen.
- **Tailnet devices** (S, *Idea*): every device on the household's tailnet, when it was last seen, and Remove for a lost phone.
- **Rotate a secret** (M, *Idea*): a new database password or API key put in `.env` and into the app, then the app restarted, in one step; old ones flagged after a year.
- **Images with known holes** (M, *Idea*): each running image checked against the public vulnerability lists weekly; one with a critical finding is named with its fix version.
- **What CrowdSec stopped** (S, *Idea*): the addresses banned today, where from, and what they tried, on the proxy's page.
- **Two-step sign-in, nudged** (S, *Idea*): Setup and the weekly summary name each admin app without a second factor until it has one.

## Backups and data

Confidence that what matters can come back.

- **Restore one file** (M, *Idea*): browse a backup by app and date and bring back one document, photo, or setting without restoring the whole app.
- **Yesterday's version of an app** (M, *Idea*): Restore to last night on an app's page: its data and its image as they were, the current ones kept aside in case.
- **A copy before anything risky** (S, *Idea*): a database dump just before an update, a restore, or a settings change, kept for a week.
- **What changed since last night** (S, *Idea*): each backup's size beside the night before's, with a warning when an app's data shrinks sharply.
- **Weekly integrity check** (S, *Idea*): Duplicati's own verify on a sample each week, and its result on Backups.

## Notifications and alerts

Few, clear, and useful when they come.

- **Buttons on alerts** (M, *Idea*): "Radarr stopped" on the phone with **Restart** and **Show logs** (ntfy's actions, through the phone companion's own access).
- **Quiet hours** (S, *Idea*): no sound overnight unless it is serious (backups failing for days, the vault unreachable).
- **One alert for many** (S, *Idea*): three apps stopping together is one alert, "3 apps stopped: the drive was unplugged", not three.
- **Snooze an alert** (S, *Idea*): snooze one check for an hour or a day from the alert itself.
- **Who hears what** (S, *Idea*): each person picks the alerts they get; the household's other members get only the ones about their apps.

## The household

The homelab as something a family uses, not one person.

- **Guest access** (M, *Idea*): a guest's sign-in to chosen apps (Jellyfin, an Immich album) that ends on a date.
- **A printable welcome sheet** (S, *Idea*): each person's apps, addresses, and QR codes on one page for the fridge.
- **Each person's apps** (S, *Idea*): a person's welcome page lists only the apps they use, with their phone app for each.
- **What's new for the family** (S, *Idea*): a short page in plain words when an app they use gains something (a new player in Navidrome), not the technical notes.

## Apps and the catalog

Picking, trying, and using apps.

- **Import music on a button** (M, *Idea*): beets' import from Status, with the albums it is unsure of asked in the app instead of Terminal. The [Roadmap](<Roadmap.md#the-library-in-order>) has the library work in order.
- **Try an app for a day** (M, *Idea*): install an app on trial; tomorrow the app asks to keep it or removes it with its data.
- **Two apps that do the same job** (S, *Idea*): Choose stacks says when you already run one that does it (Komga and Kavita, Navidrome and Jellyfin's music), and why you might want both.
- **Suggestions from what you use** (S, *Idea*): with Navidrome, beets; with Sonarr, Bazarr; each with one line on why.
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

- **Add to Home Screen, done right** (S, *Idea*): an icon, a name, and a splash screen, so it opens like an app.
- **The last Status, offline** (S, *Idea*): away from home with no tailnet, it shows the last Status it saw and when, rather than an error.
- **Quick actions** (S, *Idea*): long-press an app for Open, Restart, Stop for a while.

## Finances

The Finances loop's unfinished items, built by the features loop now, with their numbers from its backlog. The rest of its backlog (items 1 to 15, 22 to 24, and the MoneyMatter list) is in the app.

- **Hide amounts and a wall-screen card** (S, *Next*; F16): every money figure blurred on a shortcut (with **Hide amounts** under Security and privacy), and a kiosk card with the next payday, what is left after it, and the next 3 bills.
- **The calendar, further ahead** (S, *Idea*; F20): a payment past the chart's 93 days, such as a yearly renewal, shows in its month a year ahead.
- **Card charges on the calendar** (S, *Idea*; F21): a bill charged to a card shows on its day, marked "on Chase Freedom", with the card's due day.
- **Finances on the phone** (M, *Idea*; F17): the calendar, upcoming bills, subscriptions, and goals on the phone, and Update balances in one quick sheet.
- **Export** (S, *Idea*; F18): the plan and its projection as CSV and JSON, and a printable month.
- **Polish, all along** (S, *Idea*; F19): empty states for a new plan, alignment, 860px and phone widths, contrast themes, focus order, labels; a little in each Finances round.

## Accessibility and polish

Details that make it feel finished.

- **A sheet of shortcuts** (S, *Idea*): press ? for every shortcut on the screen you are on.
- **Status read aloud** (S, *Idea*): VoiceOver and Narrator announce a job's progress and a row's change, not only the result.
- **Shapes as well as colours** (S, *Idea*): each state's dot also has a shape (a check, a pause, a cross), for colour-blind eyes and small screens.
- **Every menu by keyboard** (S, *Idea*): right-click menus open with the context-menu key and Shift+F10, and work like More… (arrows, Escape).

## Insight

What the homelab did for you, in numbers you can trust.

- **A monthly report** (M, *Idea*): uptime, backups and restore tests, updates, memory, and what the apps replaced in money, as a page and a PDF.
- **Health in one line** (S, *Idea*): "All well", or the one thing that needs you, at the top of every screen.
- **Savings over time** (S, *Idea*): what the apps have saved since the homelab started, month by month, from [Savings](<Savings.md>).
