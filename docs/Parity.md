---
version: 0.17.0
---

# What each device can do

One page that says what works on each device, and why something doesn't. It was read from the code on Nov 11, 2026: the computer's screens (`web/src/screens`), what a phone may call (`phoneMethods` in `cmd/homelab/serve.go`), what the phone's page hides (`html.companion` and `.can-change` in `web/dist/style.css`), and the Apple app's views (`apple-client/Shared/Views`). Where a description elsewhere disagreed with the code, the code won, and the row says so.

**Keep it true:** a pull request that adds or changes a feature changes its row here. `TestParityNamesEveryPhoneCall` (`cmd/homelab/contract_test.go`) fails until every call a phone may make is named on this page, in backticks, in the row of the feature it serves.

## The devices

- **Computer:** Homelab Wizard, the desktop app on the machine that runs the homelab. It is the same on a Mac, Windows and Linux except where [Host › The same on every system](<Host.md#the-same-on-every-system>) says otherwise; that table has every difference by system, so this page only points to it.
- **Phone's page:** the phone companion (`homelab serve`) in a phone's browser. It is the computer's own screens (the same bundle, drawn under `html.companion`), with only the calls in `phoneMethods`. Any phone works: Android, a partner's, a visitor's.
- **iPhone:** the Homelab app (`apple-client`), on an iPhone.
- **iPad:** the same app on an iPad, in a split view with a sidebar.
- **Mac app:** the same app built for a Mac. It is the iPad's layout; its column says only where it differs.

What a phone may do also depends on how it was paired, on every phone (the phone's page and the app alike):

- **Allowed changes** (`Change: true` calls): start, stop, back up, settings and the like. The iPhone, iPad and Mac app ask Face ID or Touch ID first, except a fold, which only changes what shows open.
- **Look only:** sees everything a phone may see, changes nothing.
- **Wall screen** (`#kiosk`): Status only, look-only for good, and never names which phone did something.
- **A household member's phone** (`homelab phone person`): only their apps, their own Finances, and what the owner shares with them; no Backups, Setup or homelab settings.
- **Away from home** (through the Cloudflare tunnel, ADR-0023): looks only, on the iPhone app; changes wait until home.

## What the cells say

- **yes:** it's there and does the same job.
- **partly:** it's there, and the cell says what's missing.
- **on purpose:** it's left out, and the cell says why. Most are one of three: a phone can't install apps or move files on the computer; a wall screen only looks; away from home only looks.
- **gap:** it could be there and isn't yet. Each gap is a candidate to close (*Gaps*, at the bottom).

## Status

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| The list of apps, live, grouped as Needs a look, Pinned, then each category | yes | yes | yes | yes | — | `Status`, `StatusBoard`, `LastStatus`, `Catalog`, `Screen` |
| Each app's logo | yes | yes | yes | yes | — | `AppIcon` |
| Type to find an app | yes | yes | yes (search) | yes | — | |
| Folds kept by the computer, the same everywhere | yes | yes; a look-only phone keeps its own | yes; a look-only phone keeps its own | yes | — | `StatusFolds`, `SetStatusFolds` |
| What changed since you looked (the dots), why an app restarted, its week up | yes | yes | yes, on the app's page | yes | — | |
| Start, Stop (with Undo), Restart, Stop for a while, Roll back | yes | yes, held on a row (allowed changes) | yes, Face ID (allowed changes) | yes, plus a right-click menu and shortcuts | — | `AppAction`, `StopUntil` |
| A stopped app's **Start** on its row | yes | yes; a look-only phone says *Start it from the computer* | yes; the same | yes | — | |
| Open an app; Alt-click to copy its address; Shift-click for its address on this computer | yes | partly: Open only | partly: Open only | partly: Open only | — | |
| Open on a phone (a QR code) | yes | on purpose: it's already on the phone | on purpose: the same | on purpose | — | |
| A native app (Jellyfin) started from Status | yes ([Host](<Host.md#running>)) | on purpose: it runs on the computer | on purpose | on purpose | — | |
| Pin to the top | yes | yes, from the app's page | yes, from the app's page | yes | — | `SetAppSetting` |
| Update all, and an update's notes | yes | on purpose: no notes for a phone yet (`ReleaseNotes` isn't a phone call), so no blind update | on purpose: the same | on purpose | — | |
| Updates held, and holding them | yes | yes, from the app's page | yes, from the app's page | yes | — | `SetUpdatesPaused` |
| Check again, Fix it (Look for problems) | yes | yes (allowed changes) | yes, in Setup (allowed changes) | yes | — | `Homelab` |
| Health in one line atop each screen | yes | yes | yes | yes | — | |
| What happened overnight | yes | yes | yes | yes | — | |
| The money card | yes | yes, where the phone may see Finances (a wall screen if allowed) | yes | yes | — | `FinancesWall` |
| The watchdog card, with what's failing; memory nearly full with **Stop** on the biggest | yes | yes; **Stop** only with allowed changes | yes; the same | yes | — | `Watchdog` |
| **Snooze…** a failing check | yes | yes (allowed changes) | yes, Face ID (allowed changes) | yes | — | `SnoozeCheck` |
| Protection (what CrowdSec stopped today) | yes | yes | yes | yes | — | `Protection` |
| Savings, and what the apps have saved month by month | yes | yes | yes | yes | — | `SavingsHistory` |
| Recent alerts | yes | yes | yes | yes | — | `Alerts` |
| **Every alert…**: the 90 days the computer kept | yes | yes | yes | yes: **Every Alert** on Recent Alerts opens beside the list, in the app's place | — | `AlertLog` |
| **Snooze…** on an open alert of Every alert (its watchdog check still fails) | yes | yes (allowed changes) | yes, Face ID | yes | — | `SnoozeCheck` |
| Storage card (the disk and each app's share) | yes | on purpose for now: not a phone card | on purpose for now | on purpose for now | — | |
| Memory and processor per app | yes | gap: `Usage` isn't a phone call | gap | gap | — | |
| An app that keeps crashing (last crash) | yes | partly: the row says so, no crash card | partly: the same | partly | — | |
| The last Status while the computer can't be reached | on purpose: it's the computer | yes, over HTTPS | on purpose: the app keeps nothing on the device | on purpose | — | |
| Away mode (the apps on the internet, when nothing answers) | on purpose | on purpose | yes | yes | — | |
| A diagnostics report to share with a helper | yes | yes | yes, in Settings | yes | — | `Report` |
| How many need a look, on the icon | yes (Dock, taskbar) | on purpose: a web page has no badge | yes, the tab's badge | yes, the sidebar's | gap: `apple-client/README.md` used to say the Dock icon shows it; the code has no Dock badge | |
| The menu bar item (Open an app, Needs a look) | yes (menu bar or tray) | on purpose | on purpose: a phone has none | on purpose | gap: `apple-client/README.md` used to say there's one; the code has none | |

## An app's page

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| What's wrong, its actions, about it, another app that does the same job | yes | yes | yes | yes | — | |
| Its week (uptime and outages) | yes | yes | yes | yes | — | |
| Its backup (last run, the copy, restore test, Back up now) | yes | yes; Back up now with allowed changes | yes | yes | — | |
| Its logs (filter, errors in colour, Follow) | yes | yes | yes | yes, with ⌥⌘L | — | `Logs` |
| Explain these logs (the local AI) | yes | gap: `ExplainLogs` isn't a phone call | gap | gap | — | |
| Memory and disk it uses; who in the household uses it | yes | gap: `Usage`, `Storage`, `People` aren't phone calls | gap | gap | — | |
| Dozzle's live logs | yes | on purpose: kept to the computer (docs/Security.md, L1) | on purpose | on purpose | — | |
| Its settings: nightly updates (and Only on Sundays), alerts, pin | yes | yes (allowed changes) | yes, Face ID | yes | — | `SetAppSetting` |
| **Reach it away from home** (a public app) | yes | yes (allowed changes) | yes, Face ID | yes | — | `SetAppSetting` |
| **Recently done**, and **Everything that was done** (90 days) | yes | yes | yes, on More About | yes, on More About: an app's page beside Status's list has a navigation stack of its own | as the iPad | `History` |
| Its own menu and shortcuts (⌥⌘S, R, ., L) | yes | on purpose: no keyboard | on purpose | yes | yes | |

## Backups

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| Each app's copy, grouped; the night before's size; one that shrank by half in red | yes | yes | yes | yes | — | `Backups` |
| Duplicati's jobs, their last run, the weekly integrity check, a job's contents | yes | yes | yes | yes | — | `DuplicatiJobs` |
| Back up now, Test a restore | yes | yes (allowed changes) | yes, Face ID | yes | — | `Homelab` |
| Open Duplicati | yes | on purpose: kept to the computer | on purpose | on purpose | — | |
| Move the homelab to another drive; the recovery kit | yes | on purpose: they move or write files on the computer | on purpose | on purpose | — | |
| Backups on a household member's phone | — | on purpose: the owner's only | on purpose | on purpose | — | |

## Finances

Each phone sees Finances at the level it was paired with: none, the money card, to look at, or to change (`companion.Finances*`). A member's phone sees its own.

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| The plan: Dashboard, Spending, Plan, Net worth | yes, four tabs | yes, the same four | partly: its own home with a page each (Transactions, Budgets, Bills, Investments, Accounts, Goals, Loans, Spending, Cash Flow, Month in Review, Recurring, To Review) | yes, as the iPhone | — | `Finances` |
| An account's own page: its balance and chart (30 or 90 days, a year), this month's in and out, its latest transactions, Update balance and Edit | yes | yes; a look-only phone has no Update balance or Edit | gap (its Accounts page; the owner's yes, Nov 12: next after the computer's) | gap | — | `Finances`, `FinancesLedger` |
| Checking now and after the next paycheck, how it adds up | yes | yes | yes | yes | — | |
| Change balances, budgets, goals, a payment's amount, Hide amounts | yes | yes (Finances to change) | yes, Face ID | yes, ⇧⌘H hides amounts | — | `SaveFinances` |
| Add a payment, an account, a goal; money that comes in from someone | yes | yes (Finances to change) | partly: an account, not a payment or a goal | partly | — | `SaveFinances` |
| Transactions: list, search, filters | yes | yes | yes | yes | — | `FinancesLedger` |
| Add, change, delete a transaction | yes | yes | yes, Face ID | yes, ⌥⌘N adds one | ⌥⌘N (⌘N is New Window on a Mac) | `SaveFinancesLedger` |
| Select transactions together (delete, one category, Move to…) | yes | yes | gap | gap | — | |
| A running balance for one account | yes | yes | gap | gap | — | |
| Receipts: open one, add one | yes | yes; a look-only phone opens them | yes; a photo is stripped of its location | yes | — | `FinancesReceipt`, `SaveFinancesReceipt` |
| Import a bank file, with its categories; Rules (**Always do this for "…"**) | yes | yes | gap | gap | — | |
| Import from Firefly III, Ghostfolio or Wallos | yes | on purpose: the computer asks those apps | on purpose | on purpose | — | |
| Real logos from each company's website | yes | on purpose: the computer asks the website, a phone has nothing to ask with | on purpose | on purpose | — | |
| The household's own pictures for a logo (picked, or got from a website), drawn first | yes | yes | yes (before Nov 12 a letter or an icon: the app never read them) | yes | — | `Finances` (the plan's `logos`) |
| Investments: the card, Read now, Add a holding | yes | yes (Finances to change) | yes, Face ID | yes | — | `FinancesReadInvestments`, `FinancesFindSymbol`, `FinancesAddInvestment` |
| Investments: a holding's buys and sales, Change, Delete | yes | yes (Finances to change) | gap | gap | — | `FinancesInvestmentTrades`, `FinancesChangeInvestment`, `FinancesDeleteInvestment` |
| The money flow (Sankey), the Dashboard's prompts (a subscription's new price, a bill's average, a bill not seen) | yes | yes | partly: Cash Flow and Month in Review, not the flow or the prompts | partly | — | |
| The calendar (the days ahead and behind, a month in all, add on a day) | yes | yes | partly: Recurring as a calendar | partly | — | |
| The calendar feed for a phone's calendar | yes | on purpose: it's made on the computer | on purpose | on purpose | — | |
| Export (the plan, the year as a spreadsheet, a month to print) | yes | yes, shared or downloaded, even look-only | gap | gap | — | |
| A loan read from its papers | yes | yes | partly: Loans says what each owes and when it's paid off; not the ring of payments or their table | partly | — | |
| The household's shared bills on a member's phone | — | yes | yes | yes | — | `FinancesShared` |

## Tidy Up

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| The Inbox: watched folders, Tidy up now, What I did today, Undo | yes | on purpose for now: it moves files on the computer's drives | on purpose for now | on purpose for now | — | |
| Needs a look: It's a film…, It's an episode…, Look it up, Name these songs… | yes | on purpose for now (`unison-handoff.md` item 9 brings the questions to the phone) | on purpose for now | on purpose for now | — | |
| Music, Books, Films and Shows; where the libraries live; a Calibre library | yes | on purpose: they move files on the computer | on purpose | on purpose | — | |
| `homelab media` from a terminal | yes, on every system ([Host](<Host.md>)) | — | — | — | — | |

## Setup

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| What the machine runs (system, runtime, version) | yes | yes, on Settings' This machine card | yes | yes | — | `Host` |
| The checklist, **Do the N I can do for you** | yes ([Host](<Host.md#setting-up>)) | on purpose: setup is the computer's | partly: Look for problems → Fix these | partly | — | `Homelab` |
| Reach Finances away from home; the runtime, Ollama, Kopia's drive | yes | on purpose: the computer's | on purpose | on purpose | — | |

## Settings

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| The homelab's settings (`.env`), by section, searchable | yes | yes: the everyday ones a phone may change (its clock, quiet hours, alerts, updates, Tidy Up's choices; never a secret, an app's folders, image or sign-in, or what it connects through: N52), saved with allowed changes; none on a wall screen | yes; the everyday ones change with allowed changes, behind Face ID | yes | — | `Settings`, `SaveSettings` |
| Secrets and the settings a phone connects through | yes | on purpose: changed on the computer only | on purpose | on purpose | — | |
| Phones: pair, look only or changes, Finances level, For a day/week/month, remove | yes | on purpose: a phone can't give itself more | partly: This Device (how it paired, Unpair here) | partly | — | |
| People in the household, and what's shared with them | yes | on purpose | on purpose | on purpose | — | |
| Devices on your tailnet | yes | on purpose | on purpose | on purpose | — | |
| Quiet hours | yes | yes, as a setting | yes, as a setting | yes | — | |
| The lock (Face ID), the widget's switch, **Alerts From** | — | — | yes | yes | yes; the widget is the Desktop widget | |
| Appearance, start at login, the menu bar or tray | yes ([Host](<Host.md>)) | on purpose: the phone's own | on purpose | on purpose | — | |
| Update Homelab Wizard | yes | on purpose: no release notes for a phone yet | on purpose | on purpose | — | |
| Uninstall | yes | on purpose | on purpose | on purpose | — | |

## Choose apps

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| Choose stacks, suggestions from what you use, two apps that do the same job, install | yes ([Host](<Host.md#setting-up>)) | on purpose: a phone can't install apps | on purpose | on purpose | — | |
| A sheet for the fridge (each person's apps, printed) | yes | on purpose: printed from the computer | on purpose | on purpose | — | |

## Alerts

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| Alerts on the phone (ntfy) | — | the ntfy app, on any phone | the ntfy app, or this app while it's open (**Alerts From**) | the same | the same | `AlertLog` |
| Alerts on the computer's screen | yes (`DESKTOP_ALERTS`) | — | — | — | — | |
| Buttons on alerts (Restart, Show Logs, Start) | — | on purpose: they open the iPhone app | yes: the app's page with the action waiting for a tap and Face ID | yes: the same, in the split view | as the iPad | |
| Quiet hours, the memory alert, the weekly integrity check | yes, set on the computer, for every phone | yes | yes | yes | — | |
| Alerts while the phone is locked | — | the ntfy app | the ntfy app (push from this app needs the paid Apple program) | the same | the same | |

## Links, widgets and Siri

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| Links into the app (`homelab://app/<id>`, `homelab://finances/<page>`, `?do=restart`) | — | on purpose: a web page has its own address | yes; a link never changes anything by itself | yes: the split view follows them as the iPhone's tabs do (`IntentInbox.outcome`, `landing`) | as the iPad | |
| A widget | the menu bar or tray | on purpose: add it to the Home Screen as a web app | yes, the Home Screen and the Lock Screen (with `HOMELAB_WIDGET`) | yes | yes, the Desktop widget | |
| Siri and Shortcuts (is everything running, start, stop, restart, open an app) | — | on purpose | yes | yes | yes | |

## Keyboard and moving around

| Feature | Computer | Phone's page | iPhone | iPad | Mac app | Phone calls |
|---|---|---|---|---|---|---|
| A screen's key (⌘2 to ⌘6, Ctrl on Windows and Linux) | yes | on purpose: tabs at the bottom | on purpose: tabs | yes | yes | |
| Type a command (⌘K) and the sheet of shortcuts (?) | yes | on purpose: no keyboard | on purpose | gap: a hardware keyboard has the menus' shortcuts, no palette | gap: the same | |
| Back and Forward between screens and their tabs (⌘[ ⌘], mouse buttons, a swipe; Finances' and Tidy Up's tabs are steps too) | yes | on purpose: tabs at the bottom | yes, the system's Back | yes | yes | |
| Right-click the sidebar for a screen's own menu | yes ([Host](<Host.md>): the Mac's menus differ) | on purpose | on purpose | partly: a right-click menu on an app's row | partly | |
| Remember where you were on each screen | yes | yes | yes | yes | — | |

## Gaps

The cells marked *gap*, gathered, each with what closing it takes (S a few hours, M a day or two, L more):

1. ~~**iPad and Mac app: links into the app** (and with them, buttons on alerts).~~ **Closed (#604):** the split view reads `IntentInbox` as the iPhone's tabs do, through the same `IntentInbox.outcome` and `landing`.
2. ~~**iPad and Mac app: What was done.**~~ **Closed (#606):** an app's page beside Status's list has its own navigation stack, so More About, Recently Done and Everything That Was Done open in it.
3. ~~**Every alert: Snooze… on an open alert**~~ **Closed:** on every device, for an alert whose watchdog check still fails (`snoozable`), with the Watchdog card's own Snooze….
4. ~~**iPad and Mac app: Every alert from the split view's list.**~~ **Closed (#606):** **Every Alert** opens in the detail column, in the app's place (`DashboardViewModel.openAlertLog`), until an app or another screen is picked.
5. **iPhone Finances: Select together, a running balance, Change or Delete a buy, Export, import and Rules, add a payment or a goal.** Each its own piece; import and Rules are the largest. M each, L for import.
6. ~~**The phone's page: Settings and Setup's facts**~~ **Closed:** Settings on the phone's page lists the settings a phone may change (`phoneSettings`), saved where it may make changes, with This machine's facts; none on a wall screen.
7. **Memory and processor, disk per app, Explain these logs** on every phone: new phone calls first (`Usage`, `Storage`, `ExplainLogs`), each read-only. M.
8. **The Mac app's Dock badge and menu bar item**, which `apple-client/README.md` described but the code never had. M.
9. **A command palette on the iPad and Mac app.** M.

Tidy Up and Choose apps stay on the computer for now, on purpose; Tidy Up's questions on the phone are `unison-handoff.md` item 9.
