# Finances: the build-out loop

The master prompt for a session that keeps improving the Finances screen on
its own. Start a new session on this repository and send:

    /loop Read .claude/prompts/finances-loop.md and do the next round.

With no interval, /loop paces itself. Each round re-reads this file, so to
steer the loop, edit it, commit and push it, and the next round follows.

**Retired (November 2026).** The owner can no longer run this loop. Its
unfinished items (16 to 21) are built by the features loop
(`.claude/prompts/features-loop.md`), which reads this file's **How
Finances works** and **Rules that never bend** before each Finances round
and ticks the items off here. Do not start this loop again beside it: run
the features loop instead.

---

## Your job

You are building the Finances screen in homelab-wizard out to its full
potential, on your own, one finished improvement per round, for as long as
this loop runs. Never stop to ask the owner anything. When a decision is
theirs, take the most conservative choice that keeps the app working, write
it under **Decisions to look at** in the PR description, and carry on. When
the backlog runs out, look over the Finances screen (desktop, 860px, the
phone, dark and contrast themes, the keyboard, a screen reader's labels),
write at least 10 new items into the backlog below, push them, and keep
going.

## Where this came from (the owner's words, in short)

- "Tinker and improve the finances section: a financial calendar, new logos
  for more types of subscriptions." Then: "Keep going on your own, make the
  ideas specific to this app, build it out to its full potential."
- A screenshot of Recurring › Payments with their own plan: Mortgage
  (house icon), Car (Mazda logo), **AMC A-List** and **Claude Pro** showing a
  plain repeat icon, not a logo, and Claude Pro (**yearly on Oct 23**) saying
  **"Not in the next year"**. "The logos aren't showing up. Let's improve it
  here." Their paychecks are named by person ("Andi's Nov 6 check").
- "I really like MoneyMatter; let's incorporate some of its key features."
  (Its features are listed below, as ideas.)

## Round 0, already in main

The first work was on `claude/homelab-finances-improvements-2v5ec9`. All of
it reached main with the early batches, and the branch is gone, so there is
nothing to merge. It held:

- `View.Next` (internal/finance/project.go, `nextDays`): each payment's next
  day from its own schedule, up to two years ahead. Recurring shows it for a
  payment past the 12 paychecks read ahead ("Sat, Oct 23, 2027 · in 12
  months") instead of "Not in the next year". Test: `TestProjectNext`.
- `brandOf(institution, name)` in web/src/finances/Mark.tsx: with no logo
  picked, the brand whose name (or an alias: amex, bofa, hbo, prime video,
  nyt, openai, comcast…) appears as whole words in the name. It's used by the
  payment and account rows, and the payment form fills the logo in as the name
  is typed, until one is picked by hand.
- AMC Theatres as a three-letter monogram (simple-icons has no AMC mark),
  with the `.fmark.mono.three` sizes in web/dist/style.css.
- Preview data: AMC A-List and a yearly Claude Pro with no logo picked; a
  smoke case for both in app/preview/shoot.mjs.
- **Verify first:** run `make app-smoke`. The two new preview payments change
  the typical month, so expected totals in older cases (for example "Recurring
  keeps saving apart from spending": Spent, Left over) may need the new
  figures. Update an expectation only after checking that the new number is
  right.

## How Finances works (read the code before relying on this)

- **Plan** (internal/finance/finance.go) in data/finance.json, copied
  off-site, encrypted, by the nightly backup. People (Earner: Schedule, Net,
  Gross, Deductions → Account), Accounts (Kind: checking, savings, card,
  investment, retirement, loan, home, car, collectible, other; Institution,
  Balance, Pending, Rate, Original, Loan, Detail, Updated, History), Payments
  (Kind: home, utilities, car, subscriptions, loans, cards, spending,
  savings, other; Institution, Estimate, From, To, Card, Schedule), Cushion,
  Currency, Holidays (us, uk, none), Waiting/NotYet, and Rev, which refuses
  a stale save from another device.
- **Schedules** (schedule.go): once, week, 2 weeks, twice a month, month,
  3 months, year, paycheck (with someone's pay). `Dates`, `Plan.Dates`,
  `HolidayIn`, `BankDayIn`. Paydays move to the bank day before; payments
  don't move.
- **Projection** (project.go): `Project(plan, today, Ahead=12)` → View:
  Periods (paycheck by paycheck: In, Out, Saved, Left, Rows, Accounts),
  Paydays (Moved, Why), Days (checking each day, Events), Worth (net worth
  history), Start, Since, Next.
- **Screen**: web/src/finances/: Finances.tsx (tabs Dashboard, Recurring, Pay,
  Net worth), Overview, Lists (Recurring, Pay), Worth, Edit (forms, BrandPick),
  Mark (logos, kind icons, brandOf), model.ts, money.ts, ui/*, widgets/*
  (Checking, Flow, Ledger, Paycheck, Worth). Glue is in web/src/screens/finances.ts.
  Building blocks are in web/src/parts (Card, Row, Rows, Segmented, Sheet,
  Empty). Colours come only from tokens (lint.mjs checks).
- **Logos**: web/src/finances/logos.ts, ~131 brands, each with kind bank,
  card, investment, car, home, or "" for a bill or subscription. Each has a
  `path` (simple-icons, CC0), `art` (selfh.st/icons, CC BY 4.0), or `letters`
  (our own monogram on the brand's colour). Kept inline, never fetched.
- **Phones**: cmd/homelab/serve.go gives paired phones Finances and
  SaveFinances when allowed (Settings › Phones: Sees or Changes Finances), on
  the LAN and tailnet only. The phone UI is in internal/companion and web/dist/companion.js.
- **Nearby, to build on**: docs/Savings.md and internal/savings (what the
  running apps replace, with the annual price, and its history);
  internal/notify (the homelab's own ntfy); internal/digest (the weekly
  summary); the finance apps in the catalog: Wallos (subscriptions,
  compose/finance.yaml), Actual Budget, Firefly III, Ghostfolio, and
  MoneyMatter (stacks/budget-tracker); kiosk mode; open-format export (on
  docs/Roadmap.md).
- **Preview and checks**: app/preview/finance.json is generated by
  `go test ./internal/finance -run TestPreview -update` from
  internal/finance/preview_test.go. Also mock.js, shoot.mjs (smoke cases and
  docs pictures), lint.mjs, and words.mjs (house words). TS types for the Go
  side are in web/types/backend.d.ts: `cd app && go test -run TestBindings -update .`.

## Sharing the repo with other sessions

No cleanup session runs any more (the owner, Nov 1): each loop merges its
own PRs once they are green, and VERSION and releases belong to the owner's
own session. The audit loops (.claude/prompts/audit-loop.md) may run beside
you, and the owner's own session merges its own changes too. To stay out of
each other's way:

- You own Finances: internal/finance, web/src/finances, the Finances
  parts of cmd/homelab/serve.go, internal/companion, app/preview (finance.json,
  the Finances cases in shoot.mjs), and the Finances docs. Change other code
  only when a Finances feature needs it, in its smallest form.
- Never touch VERSION, never cut a release, and never merge, close, or push
  to a PR that isn't yours (the audit sessions' PRs among them). Your own
  Finances PR you merge yourself, as the owner asked on Nov 1 ("try and
  merge as much as you can"): once it is ready for review, every CI check
  on its head is green, and GitHub says it merges cleanly, squash-merge it
  with a title that ends in its number, then merge main into the next
  batch and open that batch's PR at once.
- `git fetch origin main` and merge main into your branch at the start of
  every round, since other sessions merge things. On a conflict in
  web/dist/*, never merge it by hand: resolve the sources, then run
  `make frontend` again. In CHANGELOG.md, keep both sides' lines.
- If main's CI is red for a reason outside Finances, note it in your PR and
  carry on. Fix it in a small PR of its own, merged the same way, only when
  the cause and the fix are clear; otherwise leave it for the owner.

## Shipping in batches (the owner's rhythm)

Every 5 rounds, ship a batch: finish the round, make sure everything
passes, update the PR description, and mark the PR ready for review. Then
start the next batch on a fresh branch from the latest main,
`claude/homelab-finances-batch-<n>` (batches 1 to 7 were PRs #329, #337,
#340, #344, #346, #349, and #357, all merged; batch 7 ended at round 55 with
item 15 (Wallos and Ghostfolio), so batch 8 starts at round 56 with item 16),
with a new draft PR. Never more than one open Finances PR. If the
batch before is not merged yet, merge its branch into the new one first,
so the work builds on it (and on this file), and open the new draft PR only
once the batch before is merged or closed: until then the work is pushed
to the new branch with no PR, so there is never a second open one. Count
rounds per batch in the PR's Done list. A batch that reaches 5 rounds
while the one before is still open keeps going on its branch; when the
one before is merged, its PR opens at once, ready for review if it has 5
rounds or more (and the batch after starts then). Keep going otherwise;
never stop the loop.

## Rules that never bend

1. **Money stays on this machine.** No logo, price, or rate is fetched from
   the internet. The only outside sources allowed are the homelab's own apps
   on its own network, read only on a click or an opt-in setting.
2. **Old finance.json files keep loading.** New fields are optional
   (`omitempty`) with safe defaults, and each comes with a Load/Clean test on
   a file without it. Never rename or drop a field. Keep the Rev check.
3. **MoneyMatter is AGPL-3.0, and this repo is MIT.** Take its ideas and
   behaviour only. Write every line yourself, and never copy its code, text,
   or images. Its source is not in this repo; the features below are what you
   need.
4. **Logos**: copy marks exactly from the simple-icons package (npm `simple-icons`) or
   selfh.st/icons. If a brand has neither, use a monogram (`letters`) on a
   colour as near its own as known. Keep every bg/ink pair at 4.5:1 or
   better, and the license header in logos.ts true.
5. **Never skip, weaken, or delete a test or check** to get green. Change an
   expected number only after proving the new one is right.
6. **The house style**: UI words, CHANGELOG lines, and commit titles are short,
   plain English about what the household gets (see git log, CHANGELOG.md;
   words.mjs checks). Code comments say why, in the same voice.
7. Finances must work on a phone allowed only to look (ReadOnly: no Edit or Add).

## The owner's follow-up: do these first, one per round, in this order

The owner's words, in short. Before each, check origin/main and skip or
adapt anything that already exists. Keep each change small, with a
CHANGELOG line; run `make check`, `make frontend-check`, and the Finances
smoke checks (`SMOKE_ONLY=inanc make app-smoke`), and look at the
screenshots before committing. Mark each done here when it lands. Then
go back to the backlog below.

A. ~~**One pay-period card on the Dashboard.**~~ Done in round 6: the
   paycheck widget is the pay-period card (widgets/Paycheck.tsx), Cash
   flow's bars are gone, and PostPayWidget moved to Net worth. Remove the row of
   per-paycheck cards ("ugly and not useful"). In their place: one card
   with ‹ and › to step between pay periods, a Today button, and the title
   "Alex's paycheck · Fri, Nov 6" with its dates. Under it, the accounts
   side by side in a row (checking, savings, investment, Roth IRA, 401(k);
   the cards together in one tile), each with its post-pay balance for
   that period and the change. Highlight an account money goes into that
   period (the Roth on the period the $625 lands). No grid of every account
   × every paycheck on the dashboard; keep that only somewhere secondary.
   (Already there: widgets/Ledger.tsx PostPayWidget is the grid, and
   Cash flow's bars and the paycheck widget pick a period.)
B. ~~**Cards paid off in full with each paycheck.**~~ Done in round 7:
   Account.PaidEach and Spend, Plan.WithCards (a payoff `card:<id>` read
   ahead, never saved), Schedule Paycheck with no Person (every payday into
   checking), preview finance-cards.json. Also fixed: Finances' checkboxes
   never stayed ticked by a real click. A per-card option, "I pay
   it off in full with each paycheck", with an estimate of spending on it
   between paychecks. "Each paycheck" is every payday into checking,
   whoever is paid. Post-pay checking and the surplus include the payoff,
   and card spending counts as Spent once, not twice. (Already there: a
   payment with Card pays the card's whole balance on its own schedule;
   build on it rather than beside it.)
C. ~~**"With each paycheck" as a schedule, and saving shown.**~~ Done in
   round 8: the schedule came with B; Recurring's rows into savings,
   investments, or retirement show the account today and after the
   paycheck that pays them (`kept` in Lists.tsx). $500 into
   savings every paycheck and $625 a month into the Roth. "With each
   paycheck" (anyone's, into checking) as a schedule choice beside the
   existing "With each of Alex's paychecks"; savings and the Roth show
   today's balance and the post-pay balance.
D. ~~**Update balances, one panel.**~~ Done in round 9: BalancesForm in
   Edit.tsx (`what: 'balances'`), from the header's button and Net worth's
   grid; the grid no longer edits in place, and the cushion moved here. The owner updates balances once a day.
   An "Update balances" button opens one panel: every account, each box
   prefilled with today's expected balance, the difference shown while
   typing, and Enter saves all. (Already there: Update balances inside the
   post-pay grid; A moves that grid, so the panel stands on its own.)
E. ~~**Logos from the name, more of them, and your own.**~~ Round 10 did the
   first slice: the account form picks from the name, `brandOf(…, kind)`
   reads a car's model (only for a car), `AcctMark`, and None picked by
   hand is kept as institution "none". Round 11 did the rest: 296 logos
   (the selfh.st pictures are initials now, as the owner asked), everyday-word
   brands read only from a name of their own (`loose` in Mark.tsx), and
   Plan.Logos (TestOwnLogos): your own image, shrunk on the device, by brand
   or "name:<name>". Pick the logo from
   the name unless one was picked by hand: Chase Checking → Chase, Mazda 3
   → Mazda, Fidelity 401(k) → Fidelity, BofA, Amex, CX-5, F-150; car
   model names match only for cars. Add as many institutions as possible.
   Where simple-icons has none (Fidelity, Vanguard, Schwab, Capital One,
   Citi, USAA, GEICO…), a clean letter tile in the brand's colour. Let the
   owner upload their own logo image for a brand, kept locally in the
   finances file and shown everywhere that brand appears. Never fetch a
   logo from the internet.
F. ~~**Polish the marks.**~~ Done in round 12: the logo test sheet is a
   smoke case ("every logo on one sheet": size, centre, initials that fit
   and read, titles lined up, desktop and phone); 24 tiny wordmarks became
   initials; a person in a row of payments is a mark's size. Logos and icons centred and the same size; rows
   with and without a logo line up; text-only logos readable at row size.
   Render every logo on one test sheet and check it before committing.
G. ~~**Groups:**~~ Done in round 13 (model.ts `groups`). investments, Roth IRA, traditional IRA, brokerage, and
   401(k) all under one "Investments" group (no separate Retirement), and
   "Home and car" written "Home & Car". Round 14 added a Collectibles tile
   to the pay period card (the owner asked). The follow-up is done: back to the
   backlog below (next: the MoneyMatter section, H1).

## MoneyMatter, redone: do these next, before the backlog below

The owner: "we don't have to copy code. let's just redo everything." So
Finances grows every feature MoneyMatter has, written here from scratch in
this app's own style (rule 3 still holds: its behaviour only, never its
code, text, or images, and its source is never opened). MoneyMatter is a
budget tracker: accounts, transactions, categories, budgets, reports, and
currencies. Finances so far is a plan read forward, with no record of what
was actually spent. These add that record and everything built on it. Each
item ships in slices, one per round, each working on its own; old
finance.json files keep loading (rule 2), and the phone allowed only to
look sees all of it without Edit (rule 7).

H1. ~~**Transactions.**~~ (Done by round 20, splits and tags in the form. Round 17 did the Go model: internal/finance/ledger.go,
    Ledger, Transaction, Split, LoadLedger/SaveLedger/CleanLedger,
    TestCleanLedger, TestSaveLoadLedger; Save and SaveLedger share `write`.
    Round 18: FinancesLedger and SaveFinancesLedger (app and phones, the
    plan's levels), the Transactions tab (Transactions.tsx) and its form
    (TransactionForm in Edit.tsx), the mock's sample week. Round 19:
    search and filters with their total. Next: splits and tags in the
    form. Running balances wait for H2, which matches the ledger to the
    balances typed in.)
    A ledger of what actually happened: date, amount,
    account, payee (with its logo, `brandOf`), category, a note, and the
    payment from the plan it pays, when it does. Kept in its own file,
    `data/finance-ledger.json` (with a Rev check like the plan's, copied
    off-site by the nightly backup like every `data/*.json`), so the plan
    stays small. Slices: the Go model with Load/Save/Clean and tests; a
    Transactions tab (newest first, by day, a running balance per account);
    add, edit, delete in a sheet; search and filters (account, category,
    payee, amount, dates); transfers between accounts as one transaction
    (two legs); a split across categories.
H2. ~~**Matching the plan.**~~ (Round 22: Recurring's paid line, and the preview's
    ledger.json from preview_test.go, finance.json read forward with it. Round 21, the Go side: ProjectWith(plan,
    ledger), matchLedger within 16 days, txSides, View.Paid,
    TestProjectWithLedger; the app and the phones read forward with the
    ledger. Next: the screen says paid, and by how much it differed; a
    preview ledger from preview_test.go so the mock and Go agree.) A transaction that pays a planned payment marks
    it paid (Since and Waiting already know which have happened); one
    that differs says by how much ("Electric $152.40, about $140"); the
    balances follow the ledger once a day's transactions are in, so
    Update balances is needed less.
H3. ~~**Categories.**~~ (Round 24: the Categories editor (CategoriesForm),
    renames carried into the ledger, a deleted one's transactions to its
    group. Round 23: Plan.Categories (Category: name, parent,
    icon, income), DefaultCategories, cleanCategories (two levels),
    View.Categories (the plan's or the defaults), TestCategories; the form
    offers them and a payee brings its last; TxMark shows the category's
    icon. Next: a Categories editor, renames carried into the ledger.) A tree of its own (Housing › Mortgage, Food ›
    Groceries, Subscriptions › Streaming…) with an icon each (the glyphs in
    Mark.tsx), editable, seeded from the payment kinds and the
    subscription types; a payee remembered with its last category.
H4. ~~**Budgets.**~~ (Round 25: Plan.Budgets (Budget: category, amount, per
    month or paycheck, rollover), cleanBudgets, budgetsNow → View.Budgets
    (BudgetNow), TestBudgets; the Budgets card on Transactions and its
    editor; the preview's three. Round 26: Budgets to watch on the
    Dashboard (toWatch). H4 is done; next is H5, Reports.) A monthly amount per category (or per paycheck, as this
    app thinks in paychecks): spent so far from the ledger, left, and on
    pace or not for the day of the month, with what rolls over. A
    Budgets view and a Dashboard card for those over or close.
H5. ~~**Reports.**~~ (Round 27: the Reports tab (Reports.tsx, reportData.ts):
    ranges, money in and out, by category, by payee, month by month with
    an sr table. Round 31: Export CSV (reportData toCsv, csvName;
    App.ExportFinances, a save dialog, 0600; on a phone shared or
    downloaded through #reportDownload), the tag's when one is picked.
    Round 32: a category's last 12 months (Trend in Reports.tsx,
    categoryTrend, twelveMonths, StackedBars lineless) and this month so
    far against the same days a year before (yearOnYear). H5 done.) Spending by category month by month, income against
    spending, a category's trend, the biggest payees, a month against the
    same month last year; any range picked; each chart with its table for
    a screen reader. Exported as CSV (folds into item 18).
H6. ~~**Imports.**~~ (Round 28: ImportForm, importData.ts (csvRows,
    guessColumns, readDay, fromCsv, fromOfx, already, alike),
    Transaction.Bank for an OFX FITID. Item 15's reads from the homelab's
    apps are still to come.) A bank's CSV or OFX/QFX file, picked on this device:
    a preview with the columns mapped (date, amount, payee), duplicates
    skipped, payees matched to logos and remembered categories. Never a
    bank connection or anything fetched (rule 1). Plus item 15's reads
    from the homelab's own apps.
H7. ~~**Recurring found in the ledger.**~~ (Round 29: found.go
    (findRecurring: a week, two weeks, a month, three months, a year;
    three times or more, amounts within a tenth, still going, not paid
    to a planned payment or named like one), View.Found, FoundWidget on
    Recurring with Add to the plan; none on a read-only phone.) Payees paid on a rhythm that are
    not in the plan ("Hulu, $17.99 monthly since June") offered as
    payments, one click to add.
H8. ~~**Currencies.**~~ (Round 35: Account.Currency and Plan.Rates
    (currency.go: cleanCurrencies, inHome for the plan and the ledger,
    read ahead in the plan's currency; a transfer across two currencies
    refused), TestCleanCurrencies, TestProjectInTwoCurrencies; the account
    form's Currency and rate, its own sign; Transactions' rows in their
    own currency and totals, Reports, and budgets in the plan's; the CSV
    with a Currency column. Round 36: the rates in Pay › Paydays and
    money (one per other currency an account is in, kept as it changes);
    Update balances asks in each account's own currency (View.Start is the
    plan's: divided by the rate); Net worth's row shows the account's own
    figure first; model's balanceOn and todayOf read history and balance
    at the rate. Left, and set aside: reading the rates on a click from
    `moneymatter-rates` (stacks/budget-tracker). Its source is not public,
    so its API is unknown, and it listens only on the stack's network, not
    the host's: Finances has nothing documented to call and nothing here
    to test against. Pick it up if its API is ever published; H8 is done
    otherwise.) An account in its own currency, shown in the plan's
    at a rate typed in, or read on a click from MoneyMatter's own rates
    service on the homelab's network when it runs (`moneymatter-rates`,
    LAN only, opt-in: rule 1 allows the homelab's own apps); never from the
    internet.
H9. ~~**Receipts.**~~ (Round 33: receipts.go (SaveReceipt by content hash,
    0600, JPEG/PNG/WebP/PDF by their bytes, at most 2 MB; ReadReceipt;
    pruneReceipts after a ledger save, a day unused), Transaction.Receipt,
    data/finance-receipts in the nightly records backup, App and phone
    SaveFinancesReceipt/FinancesReceipt; the form's Receipt (a photo made
    1600px JPEG on the device, a PDF as it is, in a frame), Receipt on the
    row. Round 34: on a phone allowed only to look, a row with a receipt
    opens it under the row (Transactions' readReceipt, ReceiptView shared
    with the form); a hovered row's grey line in dark lifted to 4.5:1.
    H9 done.) A picture or PDF kept with a transaction, made small on
    the device like a logo of one's own, stored beside the ledger
    (`data/finance-receipts/`), backed up with it, never sent anywhere.
H10. ~~**Tags and notes.**~~ (Round 20: tags in the form, found by search.
    Round 30: tags shown on a transaction's row, a Tag filter in
    Transactions, and in Reports a Tag pick that narrows every report plus
    a By tag card (reportData byTag, tagsOf); the preview's Shell is
    tagged "road trip".) Free tags on transactions ("vacation",
    "tax-deductible"), filtered in Transactions and Reports.
H11. ~~Then MoneyMatter's planning features~~ (done by round 43) already in the backlog below, in
    this order: Goals (item 7), Loans (8), Net worth richer and money flow
    (13), Car value (12), FIRE (14). Goals and budgets read the ledger
    where it helps (a goal's real pace).

## The backlog, in order

Work top to bottom. A big item ships in slices, each slice working on its
own. Tick items off here as they land, and add new ones as you find them.

1. ~~**Logos everywhere they should be.**~~ Done in round 1: the
   dashboard's ledger, the paycheck, Recurring, the accounts, the checking
   line's day card, and the phone (it draws the same screen); a payment with
   no brand shows a glyph from its name (`hintOf` in Mark.tsx: water,
   insurance, internet, streaming, gym…). The calendar gets its marks with
   item 2. Finish what round 0 started: the
   Dashboard's ledger, the paycheck widget, the calendar, the phone, and
   anywhere else a payment or account shows. Payment rows with no brand get
   their category's icon, never the bare repeat icon for everything
   (subscriptions with no brand get a distinct glyph by type, item 4).
2. ~~**Money calendar.**~~ Done in round 2: its own tab (Calendar.tsx),
   `View.Holidays` (TestProjectHolidays), a week list under 600px of
   content (an 860px window, and the phone). Follow-ups are items 20 and 21.
   A month grid (a week list at narrow widths and on the
   phone) from View.Days, Events, Paydays, and Next. It shows paydays by
   person in their colours, each payment with its logo, card due days, bank
   holidays from HolidayIn, and paydays moved with why. Days where checking
   falls below Cushion are marked. Tap a day to see what moves and the
   balance after. Prev/next month, Today, the keyboard, and a screen reader
   all work. It goes as its own tab, or inside Recurring; choose one and note it.
3. ~~**Subscription logos, a batch of 10–15 per round**~~ (done in batch 1:
   296 logos, every batch below in, as marks or initials). Round 3 did the
   homelab batch (Plex through Discord; AWS as a monogram, since simple-icons
   has no AWS mark) and fixed 16 inks under 4.5:1. lint.mjs now checks every
   pair. Get the marks from the simple-icons tarball on registry.npmjs.org
   (download it, extract icons/*.svg and data/simple-icons.json, and read
   them as data; jsDelivr is blocked, and the classifier refuses running the
   package). Next batch: Steam, then streaming and media. Homelab first:
   Plex Pass, Tailscale, Cloudflare, Hetzner, DigitalOcean, AWS, Namecheap,
   Porkbun, Bitwarden, Mullvad, GitHub, Docker, Synology; then streaming and
   media (HBO, Twitch, Discord, Steam, SiriusXM, Kindle Unlimited, Fandango,
   Regal, AMC Stubs aliases); then software (Adobe, Notion, Canva, Google
   Workspace, Zoom, Grammarly); then banks and lenders (Schwab, Capital One,
   Citi, US Bank, Navy Federal, SoFi, Marcus, Betterment, Wealthfront,
   Empower; Rocket Mortgage, Mr. Cooper, Nelnet, MOHELA); then ISPs,
   utilities, insurers (Spectrum, Cox, Optimum, Google Fiber, Starlink,
   GEICO, State Farm, Allstate, Lemonade, USAA); then fitness and food
   (Planet Fitness, Calm, Headspace, HelloFresh, Instacart, Uber One,
   DashPass, Chewy). Add aliases to `brandOf` as you go.
4. ~~**Subscriptions, properly**~~. Round 4 did the first slice:
   Recurring › Subscriptions (widgets/Subscriptions.tsx) with a month, a
   year, renewals in 7 and 30 days, yearly against monthly, and each one's
   due status, from `View.Next` and the new `View.Last`. Round 5 added
   `Payment.Type` (optional, kept as-is when unknown, TestPaymentType), the
   form's Type (suggested from the brand or name: `suggestType` in
   Mark.tsx), its glyph through `PayMark`, and the year split by type.
   Round 15 (batch 2) finished it: Renewing soon on the Dashboard
   (`RenewingWidget`), the next 7 days, See all opening Subscriptions.
   The original item: (MoneyMatter has subscriptions and bills with
   due status and reminders). A Subscriptions view for Payment.Kind ==
   subscriptions: monthly and yearly cost of each and in total, sorted; the
   due status of each (due today, in N days, just paid); renewals in the
   next 7 and 30 days; a yearly plan vs monthly plan comparison; and an
   optional type (streaming, software, cloud/homelab, gaming, news,
   fitness, food, phone, other) with a glyph each, suggested from the brand.
5. ~~**Brand picker**~~ (round 16, batch 2: the picked logo comes into
   view as the name is typed, the category follows the logo, `kindForBrand`;
   the live mark, search, clear, and a None that sticks came in batch 1): search as you type the payee, a live mark, clear it, and
   a remembered "None" (picking None by hand sticks, rather than the name
   matching again). Suggest the payment Kind from the brand's kind.
6. ~~**Savings meets Finances**~~ (Round 44: homelab.ts (same, replacedBy:
   a payment's own words all in the service's name), from the catalog's
   Replaces and Status's running apps in screens/finances.ts; the card
   Your homelab does this now on Recurring, Cancelled it keeping
   Plan.Cancelled, and their total a year.) When a running app replaces a subscription
   still in the plan (internal/savings: Jellyfin/Plex for Netflix, Immich for
   Google One/iCloud, Vaultwarden for 1Password…), say "Immich is running:
   Google One still costs $X a year". Add a "cancelled because of the
   homelab" total.
7. ~~**Goals**~~ (MoneyMatter's goals). (Round 37: goals.go (Goal, GoalShare,
   cleanGoals: shares of accounts that hold money, none past 100% across
   the goals; goalsNow: Saved, Left, Needs a month and a paycheck, Pace
   from three months of history, Reaches, Behind), View.Goals, the Goals
   card on Net worth and GoalForm, two goals in the preview. Round 38: the
   word over the goals when together they need more a month than month()
   puts by, and What if under them (another amount a paycheck and when
   that gets there against its day, or another day and what that needs a
   paycheck; paydaysAMonth from View.Paydays). Item 7 done.) A goal has a target, an optional date,
   and a share (%) of one or more accounts' balances. It never moves money.
   It shows Target, Saved, Left, Needs (a month, or per paycheck here, since
   this app thinks in paychecks), and Pace with the month it's reached at
   that pace, from Account.History. Add a **What if** sandbox (a different
   amount per paycheck or date; early or late by N months) and a banner when
   all goals together need more than the household saves.
8. ~~**Loans, payoff**~~ (MoneyMatter's loans). (Round 39: loans.go (Payoff,
   amortize to zero at Rate and the payments To it, a month on average
   over the year ahead; Months, Date, Interest, Never, Path; monthsOn, a
   month from the 1st, which also fixed goals' Reaches rolling Feb 30
   into March), View.Loans, the Loans card on Net worth with the loan
   picked charted to zero and Paid off apart. Round 40: a card carrying a
   balance (a rate, paid down by a payment To it, none paying it whole)
   read with the loans; Pay more (payoffPlan.ts: amortize, payDown):
   an extra amount a paycheck on the loan picked, and highest rate first
   against smallest balance first; only where Finances may be changed.
   Item 8 done.) With Rate, Original, Balance,
   and the payment going `To` the loan: the payoff date, the interest still
   to pay, a balance-over-time chart to zero, what an extra $X per paycheck
   does, and avalanche vs snowball order across loans and cards carrying a
   balance. Paid-off loans move to their own list.
9. ~~**Set aside for bills that come less often than monthly**~~ (Round 45:
   widgets/SetAside.tsx on Pay: each bill every 3 months or a year, what it
   costs a year and needs a paycheck (paydaysAMonth), their total, and a
   "Set aside for bills" payment into savings with each paycheck, added or
   brought up to date.) (yearly Claude
   Pro, car insurance every 6 months, quarterly water): how much each
   paycheck should put aside, with an optional transfer Payment to savings
   made from it.
10. ~~**Money reminders through the homelab's ntfy**~~ (Round 46: reminders.go
   (Reminders from a view of today: due tomorrow, three days before a
   paycheck under the cushion, a week before a yearly payment, weekly
   from seven days without balances; each on its one day), Plan.Quiet,
   the switches in Pay › Paydays and money. Round 47: cmd/homelab's
   finances.go sends them from the nightly backup (before its failure
   return) to the weekly summary's topic, once a day (logs/
   finance-reminders.json), in the plan's currency (moneyIn); WeekLines
   closes the weekly summary (digest.Input.Finances); Monitoring.md and
   Automation.md say so. Item 10 done.): a bill or card due
   tomorrow, a paycheck that will leave checking below Cushion, a yearly
   renewal in 7 days, balances not updated in 7+ days. Each can be turned off.
   Also a Finances paragraph in the weekly digest: what the next paycheck
   leaves, the biggest bills before it, and the change in net worth.
11. ~~**Calendar feed**~~ (Round 48: ics.go (ICS: a day's event per payday
    and bill, amounts when asked, escaped and folded; CalendarKeyOK),
    Plan.CalendarKey and CalendarAmounts, companion's GET /finances.ics
    (encrypted only, behind the guard), serve's financeCalendar (the key
    compared in constant time), companion.SecureBase, App.FinancesCalendar,
    and the Calendar feed in Pay › Paydays and money on the computer.) An .ics of paydays and bills served by `homelab serve`
    to phones that may see Finances (LAN/tailnet, a revocable link, amounts
    on or off).
12. ~~**Car value over time**~~ (Round 42: cars.go (Account.Bought,
    BoughtOn, Holds; carFactor: the first year's drop, then each year's, by
    class, floored at a tenth; carNow from the price, or from a value typed
    in since; Plan.carsNow before reading ahead), the account form's
    purchase with its worth at its age (model.ts carFactor, its twin), and
    Net worth's row saying what it cost and when.) (MoneyMatter's vehicles). Optional purchase
    price, date, and class on a Car account; its value drops each year,
    faster at first, to a floor (10% by default). A typed-in value overrides
    it. This feeds Worth.
13. ~~**Net worth, richer**~~ (Round 41: the history stacked by group was
    there already (Investments holding retirement, as the owner asked); the
    Money flow card on Recurring (FlowChart in ui/charts, MoneyFlowWidget
    in widgets/Flow): each person's pay into a typical month, out to each
    kind, Saved, and Left over, or From the accounts when it takes more.)
    (MoneyMatter's net worth and money flow): net
    worth history stacked by group (cash, investments, retirement, home and
    car, owed); a money-flow picture of a typical month, pay → bills,
    subscriptions, saving, left over (extend widgets/Flow).
14. ~~**FIRE number**~~ (Round 43: Plan.Withdraw and Growth (4 and 5 when
    empty, kept within reason by Clean), fire.ts (monthsTo, fire), and the
    Financial independence card on Net worth: an estimate, said so, its
    two assumptions changed where Finances may be. H11, and with it every
    MoneyMatter feature on the list, is done.) (MoneyMatter's FIRE planner, kept simple): yearly
    spending from the plan ÷ a withdrawal rate (4% default) = the number;
    progress toward it from retirement and investments; the month it's
    reached at today's saving and an assumed return, with a ±2-point range.
    Label it an estimate, not advice.
15. ~~**Bring data in from the homelab's own apps, on a click**~~ (Round 53:
    Firefly III's asset balances into Update balances: app/financeapps.go
    FinancesFromFirefly, with FIREFLY_IMPORTER_TOKEN, 127.0.0.1 only, read
    only; matched by name and currency. Round 54: Wallos's subscriptions
    into Recurring (FinancesFromWallos, WALLOS_API_KEY, convert_currency
    on, 127.0.0.1 only; widgets/Wallos.tsx: shown on the computer while
    Status says wallos runs; in the plan by clean name or brand; type from
    Wallos's category, else the brand; every 6 months and turned-off named,
    not added). Round 55: Ghostfolio's accounts' worth into Update balances
    (FinancesFromGhostfolio: POST /auth/anonymous with
    GHOSTFOLIO_SECURITY_TOKEN, then GET /account, value else balance);
    Update balances' app buttons (fromApps) show only for apps Status says
    run, never on a phone. Item 15 is done as far as the rules allow.
    Next: 16.
    Actual Budget has no plain HTTP
    API, and MoneyMatter's is unknown: both left out, said in the PR.): subscriptions
    from Wallos (preview first, no duplicates, logo and type matched);
    balances from MoneyMatter, Actual Budget, Firefly III, or Ghostfolio into
    Update balances, when installed (read only, LAN only, opt-in).
16. **Hide amounts** (blur or bullets) for screenshots and the kiosk, plus a
    kiosk Finances card: next payday, what's left after it, the next 3 bills.
17. **Phone**: the calendar, upcoming bills, subscriptions, and goals on the
    phone, and Update balances in one quick sheet.
18. **Export**: the plan and projection as CSV and JSON, and a printable month.
19. **Polish, all along**: empty states for a new plan, alignment, 860px and
    phone widths, contrast themes, focus order, labels.
20. **Calendar, further ahead**: it reads only the chart's 93 days. Read
    payments past them from View.Next and Plan.Dates (no balance), so a
    yearly renewal shows in its month, a year ahead.
21. **Calendar, card charges**: a bill charged to a card (From a card) moves
    no checking money, so it is not in Days' events. Show it on its day too,
    marked "on Chase Freedom", with the card's due day.

22. ~~**Payee logos from a bank's wording**~~ (Round 49: payees.ts
    (cleanPayee: processor prefixes, the merchant's own reference, numbers,
    dates, phones, .COM, a trailing state, chains' statement wording, and
    capitals made ordinary), Mark's payeeBrand for transactions and
    Reports, and the import suggesting the clean name, the bank's wording
    kept in the note when it says more.) (the owner, Nov 1: do 22–24
    first in batch 6, before 15). Banks write payees as "NETFLIX.COM",
    "AMZN MKTP US*2K4", "SQ *BLUE BOTTLE", "TST* JOE'S CAFE 0042", or
    "PAYPAL *SPOTIFY", and brandOf misses most of them. Clean the wording
    before matching: take off a processor's prefix (SQ *, TST*, PAYPAL *,
    POS, DEBIT, PURCHASE), card and store numbers, ".COM", and a trailing
    city or state; add statement aliases (AMZN → Amazon, WM SUPERCENTER →
    Walmart, and the like). Importing a bank's file suggests the clean
    name ("NETFLIX.COM" → "Netflix") before it is saved, the bank's own
    wording kept in the note.
23. ~~**A logo picked on a transaction, remembered for its payee.**~~
    (Round 50: Change logo in the transaction form (BrandPick); a logo
    picked by hand goes on every transaction to its payee, a new one and an
    import take the payee's last; None picked is none (payeeBrand).) The
    transaction form gets the brand picker the payment form has; a payee's
    logo, once picked, is used for its transactions past and to come, as
    its category is remembered now.
24. ~~**Missing logos, built within the rules.**~~ (Round 52: (a) done: 15
    marks from simple-icons (JetBlue, Tesco, Zara, KFC as initials, being
    tiny words at 32px) and 24 chains as initials on their colour, with
    aliases (booking, hotels, tjs) and Gap, Subway, Booking.com, Hotels.com
    loose; and a category's icon comes before a payee's own mark, which
    takes only a plain letter's place. Round 51: (b) done:
    Mark's autoMark, a payee's initials on --auto-0…7 by a hash of its clean
    name, in Transactions, Reports, and the import; None picked keeps the
    category's icon. Next: (a) the simple-icons batch: Google, IKEA, Taco
    Bell, Burger King, KFC, Uniqlo, H&M, Zara, Lidl, Tesco, Booking.com,
    Hotels.com, JetBlue, Shopify, Waze; and initials on the brand's colour
    for chains it has none for (Trader Joe's, Whole Foods, Chick-fil-A,
    Dunkin', Subway, Wendy's, Publix, Aldi, 7-Eleven…).) Never fetched at runtime;
    marks copied exactly from simple-icons, every pair at 4.5:1. (a) A
    simple-icons batch for the brands the household's transactions name
    that have no mark yet. (b) Every other payee gets its own mark: its
    initials on a colour worked out from its name (the same each time),
    checked for contrast, instead of a grey letter. (c) "Use your own
    image" already covers a local shop's real logo. Never draw an imitation
    of a brand's logo, nor download one.

## Each round

1. `git pull`. If your branch's PR was merged, restart the branch from the
   latest main (`git fetch origin main && git checkout -B <branch>
   origin/main`) and open a new PR for what comes next.
2. Re-read this file. Read the code you will change before changing it.
3. Do one backlog item, or one slice of a big one.
4. Tests: Go table tests for new logic (dates, calendar, goals, payoff,
   set-aside, imports, depreciation, FIRE). Add the data to
   internal/finance/preview_test.go and regenerate app/preview/finance.json.
   Add a shoot.mjs smoke case for each new view, and check it at 1280px,
   860px, and phone widths, light and dark.
5. Run what CONTRIBUTING.md lists for what you changed. For the frontend:
   `make frontend` (commit web/dist), `make frontend-check`, `make app-smoke`.
   For Go: `make check`, `make coverage` (keep coverage-floors.txt), and
   `cd app && go test ./...` when bindings change. When something fails, fix
   the cause and run it again.
6. Add a line to CHANGELOG.md's unreleased section, and update the docs that
   the change touches (docs/Roadmap.md, services/finance notes, the screen's
   own help).
7. Commit with a clear message and push to your branch. Keep one draft PR
   open. Its description holds **Done** (a line per round), **Next** (the top
   of the backlog), and **Decisions to look at**. Tick the item off in this
   file in the same commit.
8. Report in a few lines: what shipped, the check results, what's next.
   Then go straight into the next round.
