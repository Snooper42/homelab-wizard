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

What a phone may do also depends on how it was paired, on every phone (the phone's page and the app alike):

- **Allowed changes** (`Change: true` calls): start, stop, back up, settings and the like. The iPhone and iPad app ask Face ID first, except a fold, which only changes what shows open.
- **Look only:** sees everything a phone may see, changes nothing.
- **Wall screen** (`#kiosk`): Status only, look-only for good, and never names which phone did something.
- **A household member's phone** (`homelab phone person`): only their apps, their own Finances, and what the owner shares with them; no Backups, Setup or homelab settings.
- **Away from home** (through the Cloudflare tunnel, ADR-0023): looks only, on the iPhone app; changes wait until home.
- **Offline** (the iPhone and iPad app, Nov 13): with the Homelab not answering (no signal, or away without the tunnel), Finances shows the last Finances read on this device, "As of" when, to look at only; they're kept sealed with this device's own key, only at the view or edit level, and go when Finances is taken away or the phone is unpaired. Once it answers, the newest are read by themselves.

## What the cells say

- **yes:** it's there and does the same job.
- **partly:** it's there, and the cell says what's missing.
- **on purpose:** it's left out, and the cell says why. Most are one of three: a phone can't install apps or move files on the computer; a wall screen only looks; away from home only looks.
- **gap:** it could be there and isn't yet. Each gap is a candidate to close (*Gaps*, at the bottom).

## Status

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| Status's headline: how many apps need you over how many run ("1 app needs you", "21 of 22 running"), the first one's fix beside it | yes | yes | yes | yes | `Status` |
| A category's pill: "✓ 4 running", or "1 of 2 running" when one is down | yes | yes | yes | yes | `Status` |
| The categories as one card, a row each: the first apps' logos, the name over its apps' names, the pill, a tap to open | yes | yes | yes | gap: the iPad's Status list keeps a heading a category | `Status` |
| Backups and This Machine beside the headline: last night's copies ("11 of 12", what was skipped), the free space, the power and the nightly updates | yes | yes | yes | gap: the iPad's Status list doesn't show them yet | `StatusBoard` (`machine`) |
| The list of apps, live, grouped as Needs a look, Pinned, then each category | yes | yes | yes | yes | `Status`, `StatusBoard`, `LastStatus`, `Catalog`, `Screen` |
| Each app's logo | yes | yes | yes | yes | `AppIcon` |
| Type to find an app | yes | yes | yes (search) | yes | |
| Folds kept by the computer, the same everywhere | yes | yes; a look-only phone keeps its own | yes; a look-only phone keeps its own | yes | `StatusFolds`, `SetStatusFolds` |
| What changed since you looked (the dots), why an app restarted, its week up | yes | yes | yes, on the app's page | yes | |
| Start, Stop (with Undo), Restart, Stop for a while, Roll back | yes | yes, held on a row (allowed changes) | yes, Face ID (allowed changes) | yes, plus a right-click menu and shortcuts | `AppAction`, `StopUntil` |
| A stopped app's **Start** on its row | yes | yes; a look-only phone says *Start it from the computer* | yes; the same | yes | |
| Open an app; Alt-click to copy its address; Shift-click for its address on this computer | yes | partly: Open only | yes: Open and Copy Address in its row's menu (`AppActionControls`); its address on the computer itself is the computer's, on purpose | yes, as the iPhone | |
| Open on a phone (a QR code) | yes | on purpose: it's already on the phone | on purpose: the same | on purpose | |
| Send to my phone: an app's page (its row's menu) or the page you're on (⌘K), to a paired phone picked each time; never a wall screen, Finances only to a phone that sees them, a member's phone only Status and their own apps | yes, sends | yes, shows it at the bottom with Open | yes, a banner with Open | yes, as the iPhone | |
| Open on the Computer: the computer's window goes to the page the phone is on (an app's page, Status, Backups, Finances) | yes, follows it | on purpose: the computer's own page is a click away there | yes, a phone allowed to change things (no Face ID: it changes no data) | yes, as the iPhone | `OpenOnComputer` |
| A native app (Jellyfin) started from Status | yes ([Host](<Host.md#running>)) | on purpose: it runs on the computer | on purpose | on purpose | |
| Pin to the top | yes | yes, from the app's page | yes, from the app's page | yes | `SetAppSetting` |
| Update all, and an update's notes | yes | on purpose: no notes for the page yet, so no blind update | yes: **Update…** in an app's Actions shows what it brings first, as the computer's (one line, the newest five releases with the start of each one's notes and Full Notes, then Update after Face ID, through `AppAction`'s `update`); and **Update All Apps** (Setup, beside Look for Problems): which apps have an update and which wait or are held, then **Update Them** after Face ID, one at a time, running to the end on the computer even if the phone goes; on a phone that can make changes, never a wall screen or a member's phone | yes, as the iPhone | `ReleaseNotes`, `AppAction`, `Homelab` |
| Updates held, and holding them | yes | yes, from the app's page | yes, from the app's page | yes | `SetUpdatesPaused` |
| Check again, Fix it (Look for problems) | yes | yes (allowed changes) | yes, in Setup (allowed changes) | yes | `Homelab` |
| Health in one line atop each screen | yes | yes | yes | yes | |
| What happened overnight | yes | yes | yes | yes | |
| The money card | yes | yes, where the phone may see Finances (a wall screen if allowed) | yes | yes | `FinancesWall` |
| The watchdog card, with what's failing; memory nearly full with **Stop** on the biggest | yes | yes; **Stop** only with allowed changes | yes; the same | yes | `Watchdog` |
| **Snooze…** a failing check | yes | yes (allowed changes) | yes, Face ID (allowed changes) | yes | `SnoozeCheck` |
| Protection (what CrowdSec stopped today) | yes | yes | yes | yes | `Protection` |
| Savings, and what the apps have saved month by month | yes | yes | yes | yes | `SavingsHistory` |
| Status › Subscriptions: each paid service once, its price a month and a year, the apps that replace it | yes | yes | coming: the iPhone's Subscriptions (clearout 2d) | as the iPhone | `SavingsRows` |
| Status › Analytics: the processor, memory and drives, the apps' use over a day, a week or a month | yes | yes | coming: the iPhone's Analytics (clearout 2c) reads the `usage` card now, the history next | as the iPhone | `StatusBoard`, `UsageHistory` |
| Recent alerts | yes | yes | yes | yes | `Alerts` |
| **Every alert…**: the 90 days the computer kept | yes | yes | yes | yes: **Every Alert** on Recent Alerts opens beside the list, in the app's place | `AlertLog` |
| **Snooze…** on an open alert of Every alert (its watchdog check still fails) | yes | yes (allowed changes) | yes, Face ID | yes | `SnoozeCheck` |
| Storage card (the disk and each app's share) | yes | on purpose for now: not a phone card | yes: Settings' **What the apps keep** row (the total) opens it: the six largest folders, the rest counted, when the nightly backup measured them (`StorageCard`, `StoragePage`; Status on the iPhone stays as trimmed on Nov 9, with no cards under the apps); whose photos take what stays on the computer, on purpose (`phoneStorage`) | yes: **Storage** under Status's list, between Protection and Recent Alerts, and Settings' row | `StatusBoard` |
| Downloads card (what the media apps have on the way, and the media drive's room) | yes | gap: not on the phone's page yet | gap: lane 4's, from `Downloads` or `StatusBoard`'s `downloads` card (the computer's own words; a wall screen gets it without what's being downloaded); the drive's 85% and 95% warnings already come through ntfy | gap, as the iPhone | `Downloads`, `StatusBoard` |
| Memory and processor per app | yes | yes: Status' Analytics and its lines, read every 10 seconds (`Usage`, the `usage` card's reading; the owner's phones and wall screens, not a member's) | yes: on an app's page while it runs, Memory and Processor (`AppResources`, the `usage` card) | yes, as the iPhone | `StatusBoard`, `Usage` |
| An app that keeps crashing; and when Homelab Wizard itself stopped unexpectedly (its crash note) | yes | partly: the row says so, no crash card | yes: the row says so, and a note at the top of Status when Homelab Wizard stopped unexpectedly (which part, when), with Share the Report and Hide, once per crash (`CrashNote`; Hide kept on this device; not on a wall screen) | yes, as the iPhone | `LastCrash` |
| The last Status while the computer can't be reached | on purpose: it's the computer | yes, over HTTPS | on purpose: the app keeps nothing on the device | on purpose | |
| Away mode (the apps on the internet, when nothing answers) | on purpose | on purpose | yes | yes | |
| A diagnostics report to share with a helper | yes | yes | yes, in Settings | yes | `Report` |
| How many need a look, on the icon | yes (Dock, taskbar) | on purpose: a web page has no badge | yes, the tab's badge | yes, the sidebar's | |
| The menu bar item (Open an app, Needs a look) | yes (menu bar or tray) | on purpose | on purpose: a phone has none | on purpose | |

## An app's page

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| What's wrong, its actions, about it, another app that does the same job | yes | yes | yes | yes | |
| Its week (uptime and outages) | yes | yes | yes | yes | |
| Its backup (last run, the copy, restore test, Back up now) | yes | yes; Back up now with allowed changes | yes | yes | |
| Its logs (filter, errors in colour, Follow) | yes | yes | yes | yes, with ⌥⌘L | `Logs` |
| Explain these logs (the local AI) | yes | gap: the page has no button for it yet | yes: the log's **⋯ › Explain This Log**, the last 200 lines redacted on the computer and read by its own Ollama; not on a wall screen or a member's phone | yes, as the iPhone | `ExplainLogs` |
| Memory and disk it uses; who in the household uses it | yes | gap: `People` isn't a phone call | yes: Memory and Disk on its page (the `usage` and `storage` cards; a phone's storage card carries each app's folder, never whose photos take what: `phoneStorage`), and Who Uses It, by name only (never an email or a sign-in; the owner's phones over https, never a member's or a wall screen) | yes, as the iPhone | `StatusBoard`, `AppPeople` |
| Dozzle's live logs | yes | on purpose: kept to the computer (docs/Security.md, L1) | on purpose | on purpose | |
| Its settings: nightly updates (and Only on Sundays), alerts, pin | yes | yes (allowed changes) | yes, Face ID | yes | `SetAppSetting` |
| **Reach it away from home** (a public app) | yes | yes (allowed changes) | yes, Face ID | yes | `SetAppSetting` |
| **Recently done**, and **Everything that was done** (90 days) | yes | yes | yes, on More About | yes, on More About: an app's page beside Status's list has a navigation stack of its own | `History` |
| Its own menu and shortcuts (⌥⌘S, R, ., L) | yes | on purpose: no keyboard | on purpose | yes | |

## Backups

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| Each app's copy, grouped; the night before's size; one that shrank by half in red | yes | yes | yes | yes | `Backups` |
| Duplicati's jobs, their last run, the weekly integrity check, a job's contents | yes | yes | yes | yes | `DuplicatiJobs` |
| Back up now, Test a restore | yes | yes (allowed changes) | yes, Face ID | yes | `Homelab` |
| Last night (how many copied, when, where to, what was skipped) and Needs you in one list, Start beside a stopped app's copy | yes | yes | yes | yes | `Backups`, `AppAction` |
| The restore test and off-site as two cards: the result in big, when and what it checked; where to, encrypted, the second copy | yes | yes | yes | yes | `Backups` |
| Browse the backups (Duplicati's own page) | yes | on purpose: kept to the computer | on purpose | on purpose | |
| Move the homelab to another drive; the recovery kit | yes | on purpose: they move or write files on the computer | on purpose | on purpose | |
| Backups on a household member's phone | — | on purpose: the owner's only | on purpose | on purpose | |

## Finances

Each phone sees Finances at the level it was paired with: none, the money card, to look at, or to change (`companion.Finances*`). A member's phone sees its own.

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| The plan: Dashboard, Spending, Plan, Net worth | yes, four tabs | yes, the same four | yes: its own home with a page for each of the computer's tabs (Transactions, Budgets, Bills, Investments, Accounts, Goals, Loans, Spending, Cash Flow, Month in Review, Calendar, Recurring, **Paychecks**, Collection, To Review); Paychecks as the computer's Plan › Paychecks: each person's take-home a paycheck and about a year, how often and into what, the gross and what's taken out as a bar, and the next paychecks month by month (`Paychecks`); typing someone's pay in is the computer's for now | yes, as the iPhone | `Finances` |
| A Dashboard card opens what it sums up (its title, or the ↗ or See all beside it): Spent this month its month's transactions, Cash flow and Where it goes Recurring, Renewing soon the subscriptions, Budgets to watch and Latest transactions Transactions, Checking ahead the calendar, This paycheck Paychecks, Net worth its tab | yes | yes, a phone allowed only to look too (it opens, never changes) | on purpose: its own home, a page per card already | on purpose | |
| The Dashboard looks back: an account at each day's end over 30 or 90 days or a year (checking first, another picked), a day opening on the calendar, the title the account's page | yes | yes | on purpose: an account's own page has its chart (#633) | on purpose | |
| Transactions sorted by the date, payee, category, account or amount; kept on each device; long lists 200 at a time with Show more | yes, in columns on a wide window (the list under about 760px of card) | on purpose: the list (a phone is narrow) | yes: **Sort** beside Filter on Transactions, the same five and which way (Newest or Oldest First, A to Z, Most Out or Most In First), kept on this device; by the date in months as before, by anything else one list with each row's day (its year when not this year's) and **Newest First** to go back; 200 rows, then **Show 200 More** (a new search, filter or account starts again at 200) (`TransactionSort`) | yes, as the iPhone | `FinancesLedger` |
| A member's private Finances (`.claude/prompts/private-finances.md`): sealed on her own phone so only she can read them, the owner included; the computer keeps one envelope it can't open, for her phone only, and once it's there her plain Finances calls are refused | — (never opened on the computer; Settings › People will say only that she keeps them private, and when last saved: `PrivateFinances`) | yes: Make them private… (her recovery code once, two words typed back, Face ID's passkey or a passphrase), Lock (leaving Finances, 5 minutes, the page hidden), opened by Face ID, the passphrase or the code, read forward on the phone (`finance.wasm`), offline, Turn privacy off…; the page says its one limit (the computer serves it) | partly: opened (Face ID once she opened them on this device, the key kept here behind Face ID only; her passphrase; her recovery code), read forward on the phone (`HomelabFinance.xcframework`), changed and saved locked, Lock (leaving Finances, 5 minutes, the app in the background), **Make Them Private…** (her recovery code once, two words typed back, a passphrase) and **Turn Privacy Off…**; offline (her copy kept locked on the device, opened with no connection, changes waiting there and sent once the Homelab answers, one another device made meanwhile said plainly); her reminders (the computer's own, worked out on the device each time she opens them, today's at once and two weeks ahead at 9 AM) | partly: as the iPhone | `FinancesSealed`, `SaveFinancesSealed`, `UnsealFinances`, `FinancesSealedReceipt`, `SaveFinancesSealedReceipt` |
| Finances offline: the last Finances read, "As of" when, worked out from today on the device with the computer's own code (`HomelabFinance.xcframework`), and changed there: the plan's changes (balances, the cushion, budgets, goal targets, what a payment costs, waiting marks, a new account, payment or goal) wait sealed on the device with Undo, and go once it answers, replayed on its newest plan (`FinanceChange`, `FinanceReplay`, `AwayChanges`), asking only when another device changed the same thing; and transactions (add, change, a category, delete: `LedgerChange`, the same queue, replayed on the newest ledger; one added away is changed once home); loan links, Investments and Hide amounts stay home-only | — (the computer is where they are) | — (a browser would keep them readable) | yes | yes | `Finances`, `FinancesLedger`, `FinancesShared` |
| The Collection (Net worth › Collection): cards kept in their own account, what they're worth and the gain on what was paid, each card's own page; Add a card, Edit; a card's own photo | yes | yes, by its Finances level (a look-only phone sees it, changes nothing) | yes: the cards, their pictures and prices over time, Update Prices, Add a Card, Edit and Remove (Face ID); a photo of their own from the camera or Photos | yes, as the iPhone | `Finances`, `FinancesCardPicture`, `SaveFinancesCardPicture`, `FinancesUpdatePrices`, `FinancesCardPrices` |
| Arrange the Dashboard: move a card (drag, or ▲ ▼), its width (a third, half, the whole row), Hide, Reset; kept on each device | yes | on purpose: a phone's cards stack in one column | on purpose: its own home | on purpose | |
| An account's own page: its balance and chart (30 or 90 days, a year), this month's in and out, its latest transactions, Update balance and Edit | yes | yes; a look-only phone has no Update balance or Edit | yes: the Accounts page opens it; Update Balance at its top (Face ID) | yes | `Finances`, `FinancesLedger` |
| A loan's page: its payment, rate, months left and payoff; the payments linked to it (one over the plan's asked about), the same payee's next ones offered, Link a payment… | yes | yes; a look-only phone only sees them | yes: its account's page; Link a Payment, Not This One, Count It (Face ID) | yes | `Finances`, `FinancesLedger`, `SaveFinancesLedger` |
| Checking now and after the next paycheck, how it adds up | yes | yes | yes | yes | |
| What's left after the next paycheck's bills, first (*Left after this paycheck's bills*, its chart and Now, Payday and Bills under it), with the cushion's warning | as This paycheck's *Checking on …, after its bills* (in words first: task 15 item 2) | the same | yes, Finances' first card, opening Bills | yes | |
| The accounts as a row of small cards under the first card (checking first, each with its bank's logo, balance and name), each opening its page | the sidebar's accounts, each opening its page | not yet: each account's page from Net worth | yes: under the first card, a swipe for the rest (`AccountStrip`) | yes | |
| Net worth and Cash flow side by side under the accounts: net worth short with its change and line; this month's in less out, against last month by the same day, and how much was kept | Net worth and Cash flow cards (Cash flow a typical month, from the plan) | as the computer's | yes: full-width cards, net worth's line with a scale and its biggest moves, cash flow with Income · Expenses · Saved and six months with the savings rate (`CashFlowGlance`, `CashFlowHistory`, `NetWorthJumps`) | yes | |
| Spending this month against last month as a line, with the difference by the same day | no | no | yes: a card on Finances' home (`SpendingPace`), opening Spending | yes | |
| Coming up, Latest transactions and Budgets as the redesign's cards on Finances' home (Budgets: those worth a look first) | yes: the Dashboard's Coming up, Latest transactions and Budgets to watch | as the computer's | yes: three bills opening Calendar, the latest four, three budgets (`BudgetsGlance`) opening Budgets | yes | |
| This paycheck's bills: what's still to come with what's left to pay, and what's been paid since the last payday | the Dashboard's Coming up | as the computer's | yes: Upcoming and Paid on Finances' home (`PaycheckBills`), in place of Coming up | yes | |
| Transactions a day at a time with each day's total; how many, In and Out over them; each row's category colour and account | yes: the table's day bands and the line over it | as the computer's | yes (`TransactionDays`); This month on Budgets | yes | |
| Transactions' filters as chips over the list (the month, the account, the category) and the new ones to review as a strip | the filters in one row over the table | as the computer's | yes: three chips, each a menu; *N new to review* opening the review inbox | yes | |
| Review new transactions one at a time: the category as chips (its own, its payee's, the most used), Skip or Reviewed | the Review inbox's rows | as the computer's | yes: a stack of cards, a swipe right for Reviewed and left for Skip (`ReviewChoices`) | yes | |
| Budgets: each one's bar with the line of an even pace, its period's end, what rolled over and what's left a day; open its transactions; add one (a category or group, a month or each pay period, rolls over) and remove one | yes: the Dashboard's Budgets card and Edit budgets | yes (Finances to change) | yes: Budgets' rows as the computer's (`BudgetRow`, `FinanceBudget.perDay`, `paceShare`), a tap to Transactions with its category and month (`transactionsFilter`), **+** Add a Budget and a swipe to Change or Remove, Face ID first and kept while away (`FinancePlanEdit.addingBudget`/`removingBudget`, `FinanceChange.addBudget`/`removeBudget`) | yes, as the iPhone | `Finances`, `SaveFinances` |
| Change balances, budgets, goals, a payment's amount, Hide amounts | yes | yes (Finances to change) | yes, Face ID | yes, ⇧⌘H hides amounts | `SaveFinances` |
| A pay period with its paycheck, checking on payday once its own payments are out, every account after it with what changed, and how each bill is paid (its kind, on a card, from another account, from someone else) | yes: the Dashboard's This paycheck and Accounts, paycheck by paycheck | yes | yes: Bills (`BillsPeriod`: `payWords`, `onPayday` from `View.Days`, `via`, `tiles` from `Period.Accounts`; `AccountsAfter`) | yes, as the iPhone | `Finances` |
| Edit a whole payment (its name, kind, cost and whether it's about, how often and its day, when it ends, the account it comes out of) or delete it | yes: a payment's form | yes (Finances to change) | yes: a tap on a bill in Bills or Recurring opens **Edit Payment** (`EditPaymentView`), what it doesn't show kept as it was (where it goes, who sends it, the card it pays, its logo); Delete asks first; Face ID, kept while away (`FinancePlanEdit.updatingPayment`/`removingPayment`, `FinanceChange.editPayment`/`removePayment`) | yes, as the iPhone | `SaveFinances` |
| Add a payment, an account, a goal; money that comes in from someone; a payment that ends | yes | yes (Finances to change) | yes: an account, and a payment (**+** on Bills and Recurring: money out (name, kind, amount and about this much, the account it comes out of) or money in from someone outside the household (who sends it, the account it goes into); how often, twice a month on two days, or with each paycheck, anyone's or one person's, and **It Ends** for one that stops, `Schedule.Until`), and a goal (**+** on Goals: name, what it needs, by a day or whenever, a share of each of one or several accounts) | yes, as the iPhone | `SaveFinances` |
| A card paid off with each paycheck: each payoff after the first counts what goes on it between paychecks, read from the last 3 months of its transactions (its planned payments and payments into it left out) unless an amount is typed in | yes: Bills and the reading ahead (`cardSpend`, `View.CardSpend`); the card's form says what it worked out | yes | yes: Bills shows the computer's payoffs, and offline reads them the same way (`HomelabFinance`) | yes, as the iPhone | `Finances` |
| Transactions: list, search, filters | yes | yes | yes: the search as the computer's: each word typed somewhere in the payee, its categories, the note, a tag, its accounts, the amount as typed or shown (86.10, 1,240.55) or its day (Oct 28) (`TransactionSearch`); Filter as the computer's: money in or out (moves between your own accounts left out), **Between My Accounts**, a category, a **Month**, a **Tag**, $100 or more; a search or filter says how many and what they come to **together** (a move counted only with one account picked: `TransactionFilter`) | yes | `FinancesLedger` |
| Transactions' *This month*: money in, money out, what's kept and how many (every account, moves between them left out), and money out against last month's by the same day | yes | yes | yes: **This Month** at the top of Budgets, as the computer's (`ThisMonth`, `ThisMonthCard`) | yes, as the iPhone | `FinancesLedger` |
| Add, change, delete a transaction | yes | yes | yes, Face ID | yes, ⌥⌘N adds one | `SaveFinancesLedger` |
| Select transactions together (delete, one category, Move to…) | yes | yes | yes: **Select** on Transactions, then Category…, Move To… or Delete for each that can take it (a transfer or split one is changed on the computer), offline too | yes, as the iPhone | `SaveFinancesLedger` |
| Sort what looks like a planned payment (**Link**, **Not it**, Link all) or a transfer (**Join**, **Not one transfer**, Join all), at the top of Transactions | yes | yes | yes: the same two at the top of Transactions while there's something to sort, each with Undo, kept while away (`TransactionReview`, `LedgerChange.link`/`join`/`apart`); not on a phone that only looks | yes, as the iPhone | `FinancesLedger`, `SaveFinancesLedger` |
| A running balance for one account | yes | yes | yes: Transactions with one account picked, what it held (a card or loan: owed) after each day, under the day's latest (`AccountBalance.daily`, the computer's `balanceAfter`) | yes, as the iPhone | `FinancesLedger` |
| Receipts: open one, add one | yes | yes; a look-only phone opens them | yes; a photo is stripped of its location | yes | `FinancesReceipt`, `SaveFinancesReceipt` |
| Import a bank file, with its categories; Rules (**Always do this for "…"**) | yes | yes | yes: **⋯ › Import a File** on Transactions reads a CSV (its columns guessed and changeable) or an OFX/QFX on the device, as the computer's (`BankFile`, `BankImport`), each payee cleaned with its last category or its rule's, the ones already in skipped, offline too; a row that plainly pays a planned payment linked to it (changeable on the row), and a category guessed from the company, its words or the file's own Category column, or a move to or from the household's own account (`BankGuess`). rows brought in before fixed (CREDIT or DEBIT ones given their payee, the bank's own words a clearer name, no category the one guessed). **⋯ › Rules** lists them to change or remove, and **Always do this for…** on a changed transaction makes one, changing the ones already in too (`PayeeRules`; saved while the Homelab answers, as they change the plan for every device) | yes, as the iPhone | `SaveFinancesLedger` |
| Import from Firefly III, Ghostfolio or Wallos | yes | on purpose: the computer asks those apps | on purpose | on purpose | |
| Real logos from each company's website | yes | on purpose: the computer asks the website, a phone has nothing to ask with | on purpose | on purpose | |
| The household's own pictures for a logo (picked, or got from a website), drawn first | yes | yes | yes (before Nov 12 a letter or an icon: the app never read them) | yes | `Finances` (the plan's `logos`) |
| Investments: the card, Read now, Add a holding | yes | yes (Finances to change) | yes, Face ID | yes | `FinancesReadInvestments`, `FinancesFindSymbol`, `FinancesAddInvestment` |
| Investments: a holding's buys and sales, Change, Delete | yes | yes (Finances to change) | yes: **Buys and Sales** on a holding's page, each opening Change (shares, what was paid, the day) and Delete (asked first), Face ID first, Ghostfolio read again after | yes, as the iPhone | `FinancesInvestmentTrades`, `FinancesChangeInvestment`, `FinancesDeleteInvestment` |
| Investments' Watchlist: tickers followed without owning them, priced at each read, never in the worth; Follow a ticker, Unfollow | yes | yes (Finances to change); a look-only phone sees the list | yes: Follow a Ticker, Face ID; Unfollow from its menu | yes | `FinancesFollow`, `FinancesFindSymbol`, `SaveFinances` |
| Track from: one day the charts, totals and net worth start (transactions before it kept and listed, never counted); net worth before the first balance worked back through the transactions, dashed, each account's way back said, checking under nothing warned | yes: Net worth › Track from, `Ledger.from`, `worthBack` (`View.WorthEstimated`, `WorthBack`) | yes: the charts count from it; the setting is the computer's | yes: Spending, Cash Flow, Month in Review and Money Flow count from it (`FinanceLedger.counted`, `tracked`), and the net worth line is dashed before the first balance (`worthEstimated`); **Track From** on Accounts sets it (Face ID, offline too: `FinanceChange.trackFrom`), and Transactions marks the months before it *Not counted* | yes, as the iPhone | `Finances`, `FinancesLedger` |
| The money flow (Sankey), the Dashboard's prompts (a subscription's new price, a bill's average, a bill not seen) | yes | yes | yes: **Money Flow** on Cash Flow, a month from the ledger or a typical month from the plan (`FinanceFlow`, flowData.ts's), its last column listed under each box; **Worth a Look** on Finances' home with Update the Plan, Use the average, Keep (kept on this phone as HMACs only, `PromptsKept`) and Find It in Transactions (`FinancePrompts`); tapping a box shows what's behind it under the chart, as the computer's (its transactions, each opening its page, or the planned payments and pay; on an iPhone the boxes it leads on to, to pick: `FinanceFlow.behind`, `next`) | yes, the flow's four columns drawn | `Finances`, `FinancesLedger` |
| The calendar (the days ahead and behind, a month in all, add on a day) | yes | yes | yes: Finances › **Calendar** (`FinanceCalendar`, Calendar.tsx's `daysOf` and month in all): each day's paydays and payments as logos and checking at its end, outlined under the cushion, a year back of what was recorded and a year ahead of what's planned, the day picked and the month in all; on a day, **Add a Transaction** on today or a day before it and **Add a Payment** after it, as the computer's day card (`FinanceCalendar.adding`), and a recorded transaction opens its page, as on Transactions | yes, the day and the month in all beside the month | `Finances`, `FinancesLedger` |
| The calendar feed for a phone's calendar | yes | on purpose: it's made on the computer | on purpose | on purpose | |
| Export (the plan, the year as a spreadsheet, a month to print) | yes | yes, shared or downloaded, even look-only | yes: **⋯ › Export**, the year ahead as a spreadsheet, the plan as JSON, and this month or the next to print (a PDF of the computer's page), to the share sheet, even look-only and offline (`FinanceExport`, as exportData.ts; `PrintedPage`) | yes, as the iPhone | `Finances` |
| A loan read from its papers | yes | yes | yes: a loan on Loans opens its page: what's owed, its rate and each month, and where its papers are typed in the ring of payments made, what's paid down, the next payment split, who pays it each month, half paid and paid off, and **Every Payment** (`LoanPapers`, Loans.tsx's Papers); **Type In Its Papers…** there and on its account's page (what was borrowed, the rate, the first payment's day, each payment or the plan's into it, and the number of payments and finance charge if the papers say), what it owes today read from them as they're typed, as the computer's form (`LoanPapersEditor`, `LoanPapers.reading`), Face ID, offline too (`FinanceChange.loanPapers`) | yes, as the iPhone | `Finances` |
| The household's shared bills on a member's phone | — | yes | yes | yes | `FinancesShared` |

## Tidy Up

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| The Inbox: watched folders, Tidy up now, What I did today, Undo | yes | on purpose for now: it moves files on the computer's drives | on purpose for now | on purpose for now | |
| Needs a look: It's a film…, It's an episode…, Look it up, Name these songs… | yes | on purpose for now (`unison-handoff.md` item 9 brings the questions to the phone) | on purpose for now | on purpose for now | |
| Music, Books, Films and Shows; where the libraries live; a Calibre library | yes | on purpose: they move files on the computer | on purpose | on purpose | |
| `homelab media` from a terminal | yes, on every system ([Host](<Host.md>)) | — | — | — | |

## Setup

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| What the machine runs (system, runtime, version) | yes | yes, on Settings' This machine card | yes | yes | `Host` |
| The checklist, **Do the N I can do for you** | yes ([Host](<Host.md#setting-up>)) | on purpose: setup is the computer's | partly: Look for problems → Fix these, and the checklist (the owner's yes, Nov 19): how many are done, what's left and what can wait, each step's why, and **Do the N I Can Do for You** for the steps the homelab does by itself (starting it, the scheduled jobs, Duplicati's jobs, AdGuard), after Face ID; a step that needs typing, a sign-in, a drive, a password or opens something to the outside says *On the computer* | partly, as the iPhone | `Homelab`, `Setup`, `RunSetupStep` |
| Reach Finances away from home; the runtime, Ollama, Kopia's drive | yes | on purpose: the computer's | on purpose | on purpose | |

## Settings

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| The homelab's settings (`.env`), by section, searchable | yes | yes: the everyday ones a phone may change (its clock, quiet hours, alerts, updates, Tidy Up's choices; never a secret, an app's folders, image or sign-in, or what it connects through: N52), saved with allowed changes; none on a wall screen | yes; the everyday ones change with allowed changes, behind Face ID | yes | `Settings`, `SaveSettings` |
| Secrets and the settings a phone connects through | yes | on purpose: changed on the computer only | on purpose | on purpose | |
| An app's Sign-in details (the ⚙): copy a password or key into the password manager, and its **Saved** tick | yes: the ⚙ on Status and each app's page | not yet | yes: **Sign-in Details** on each app's page, with a dot while one isn't ticked Saved; the rows by label, never a value; Copy and the tick on a phone that can make changes, over https, Face ID before each copy, onto this device's clipboard only (not Universal Clipboard) for 90 seconds, never shown; each copy in the app's history on the computer; none on a member's phone or a wall screen | yes, as the iPhone | `SignInDetails`, `CopySignIn`, `MarkSignInSaved` |
| Phones: pair, look only or changes, Finances level, For a day/week/month, remove | yes | on purpose: a phone can't give itself more | partly: This Device (how it paired, Unpair here), and Settings › Phones (the owner's yes, Nov 19): every other paired phone and iPad, whose, what it may do now and when it was last seen, and only less from there (Looks Only from Now, less of Finances, Remove This Phone, each after Face ID; on a phone that can make changes, not a member's or a wall screen); pairing a phone or giving one more stays on the computer's, on purpose | partly, as the iPhone | `Phones`, `LowerPhone` |
| People in the household, and what's shared with them | yes | on purpose | on purpose | on purpose | |
| Devices on your tailnet | yes | on purpose | on purpose | on purpose | |
| Quiet hours | yes | yes, as a setting | yes, as a setting | yes | |
| Settings in the redesign's order: Household (phones), then Automatic Care (nightly updates, restart, undo, quiet hours, alerts) | yes: Settings › General | partly: the everyday settings in the page's list | yes | yes | `SaveSettings`, `SetUpdatesPaused` |
| The lock (Face ID), the widget's switch, **Alerts From** | — | — | yes | yes | |
| **Lock After**: how long the app may be away before Face ID again (Right Away, 1, 5 or 15 minutes) | — | — | yes, 5 minutes unless changed (a change still asks; the screen locking locks it) | yes | |
| Appearance, start at login, the menu bar or tray | yes ([Host](<Host.md>)) | on purpose: the phone's own | on purpose | on purpose | |
| Update Homelab Wizard | yes | on purpose: no release notes for a phone yet | on purpose | on purpose | |
| Uninstall | yes | on purpose | on purpose | on purpose | |

## Choose apps

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| Choose stacks, suggestions from what you use, two apps that do the same job, install | yes ([Host](<Host.md#setting-up>)) | on purpose: a phone can't install apps | on purpose | on purpose | |
| A sheet for the fridge (each person's apps, printed) | yes | on purpose: printed from the computer | on purpose | on purpose | |

## Alerts

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| Alerts on the phone (ntfy) | — | the ntfy app, on any phone | the ntfy app, or this app while it's open (**Alerts From**) | the same | `AlertLog` |
| Alerts on the computer's screen | yes (`DESKTOP_ALERTS`) | — | — | — | |
| Buttons on alerts (Restart, Show Logs, Start) | — | on purpose: they open the iPhone app | yes: the app's page with the action waiting for a tap and Face ID | yes: the same, in the split view | |
| Quiet hours, the memory alert, the weekly integrity check | yes, set on the computer, for every phone | yes | yes | yes | |
| Alerts while the phone is locked | — | the ntfy app | the ntfy app (push from this app needs the paid Apple program) | the same | |

## Links, widgets and Siri

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| Links into the app (`homelab://app/<id>`, `homelab://finances/<page>`, `?do=restart`) | — | on purpose: a web page has its own address | yes; a link never changes anything by itself | yes: the split view follows them as the iPhone's tabs do (`IntentInbox.outcome`, `landing`) | |
| A widget | the menu bar or tray | on purpose: add it to the Home Screen as a web app | yes, the Home Screen and the Lock Screen (with `HOMELAB_WIDGET`): health, and a money widget in words only (*On track until Nov 19*, *Next bill tomorrow*, never an amount: `MoneyLine`), each off until turned on, and the two side by side in a medium one | yes | |
| Siri and Shortcuts (is everything running, am I on track, start, stop, restart, open an app) | — | on purpose | yes (*Am I on track?* says the money widget's words, never an amount, `CheckMoneyIntent`) | yes | |

## Keyboard and moving around

| Feature | Computer | Phone's page | iPhone | iPad | Phone calls |
|---|---|---|---|---|---|
| A screen's key (⌘1 Home, ⌘2 Tidy Up, ⌘3 Finances, ⌘4 Backups, ⌘5 Find an app; Ctrl on Windows and Linux) | yes | on purpose: tabs at the bottom | on purpose: tabs | yes | |
| Finances' pages and Import from the keyboard | no: its tabs and Import button, with no keys of their own | on purpose: no keyboard | on purpose | yes: the Finances menu, ⌥⌘1 to ⌥⌘9 for its pages (as a link opens them), ⇧⌘I for Import a File on Transactions | |
| Type a command (⌘K) and the sheet of shortcuts (?) | yes | on purpose: no keyboard | on purpose | partly: ⌘K opens the palette (`CommandPaletteView`, `Palette.commands` as commands.ts), with screens, Finances' pages, each app's Open, Restart, Start, Stop (asked twice) and Logs, each group's, Back Up Now, Show or Hide Amounts, Import a File and Add a Transaction; no sheet of shortcuts (holding ⌘ shows the menus' own) | |
| Pointer hover on rows and cards | yes | on purpose: no pointer | on purpose | yes: a list's rows, and every card and round action (`PressableButtonStyle`) | |
| A window of any size (resized, beside another) | yes | yes | — | yes: Stage Manager and Split View; three columns only where they fit (`startsWithSidebar`), the iPhone's tabs when narrow, keeping the screen and the app open across (`placeKey`, `phoneStatusPath`) | |
| Back and Forward between screens and their tabs (⌘[ ⌘], mouse buttons, a swipe; Finances' and Tidy Up's tabs are steps too) | yes | on purpose: tabs at the bottom | yes, the system's Back | yes | |
| Right-click the sidebar for a screen's own menu | yes ([Host](<Host.md>): the Mac's menus differ) | on purpose | on purpose | partly: a right-click menu on an app's row | |
| Remember where you were on each screen | yes | yes | yes | yes | |

## Gaps

The cells marked *gap*, gathered, each with what closing it takes (S a few hours, M a day or two, L more):

1. ~~**iPad and Mac app: links into the app** (and with them, buttons on alerts).~~ **Closed (#604):** the split view reads `IntentInbox` as the iPhone's tabs do, through the same `IntentInbox.outcome` and `landing`.
2. ~~**iPad and Mac app: What was done.**~~ **Closed (#606):** an app's page beside Status's list has its own navigation stack, so More About, Recently Done and Everything That Was Done open in it.
3. ~~**Every alert: Snooze… on an open alert**~~ **Closed:** on every device, for an alert whose watchdog check still fails (`snoozable`), with the Watchdog card's own Snooze….
4. ~~**iPad and Mac app: Every alert from the split view's list.**~~ **Closed (#606):** **Every Alert** opens in the detail column, in the app's place (`DashboardViewModel.openAlertLog`), until an app or another screen is picked.
5. ~~**iPhone Finances: what the computer's Finances does that the app didn't.**~~ **Closed, Nov 15:** a payment, a goal, Select together, a running balance, Change or Delete a buy, Export (with a month to print), importing a bank's file (links, guesses, fixes) and Rules.
6. ~~**The phone's page: Settings and Setup's facts**~~ **Closed:** Settings on the phone's page lists the settings a phone may change (`phoneSettings`), saved where it may make changes, with This machine's facts; none on a wall screen.
7. ~~**Memory and processor, disk per app, Explain these logs** on every phone.~~ **Closed in the app, Nov 15:** the `usage` and `storage` cards come to the phone through `StatusBoard` (the storage card without whose photos take what), and `ExplainLogs` is a phone call. The phone's page shows none of them yet.
8. ~~**The Mac app's Dock badge and menu bar item.**~~ **Dropped:** the Mac version of the Homelab app was removed (Nov 12, 2026); on a Mac, Homelab Wizard is the way in, with its own menu bar item.
9. ~~**A command palette on the iPad.**~~ **Closed, Nov 15:** ⌘K, as the computer's. (With it, the iPad's wide layout: pages open on the right beside a screen's list, and Backups across the whole width in two columns.)

Tidy Up and Choose apps stay on the computer for now, on purpose; Tidy Up's questions on the phone are `unison-handoff.md` item 9.
