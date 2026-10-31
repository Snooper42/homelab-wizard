# Finances: the build-out loop

The master prompt for a session that keeps improving the Finances screen on
its own. Start a new session on this repository and send:

    /loop Read .claude/prompts/finances-loop.md and do the next round.

With no interval, /loop paces itself. Each round re-reads this file, so to
steer the loop, edit it, commit and push it, and the next round follows.

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

## Round 0, already on branch `claude/homelab-finances-improvements-2v5ec9`

Before round 1, merge that branch into yours (`git fetch origin
claude/homelab-finances-improvements-2v5ec9 && git merge FETCH_HEAD`), unless
its PR was merged already. It holds:

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

Another session clears the open PRs, fixes CI and release errors, and owns
releases. A third helps the owner set the app up on their machine. To stay out of each other's way:

- You own Finances: internal/finance, web/src/finances, the Finances
  parts of cmd/homelab/serve.go, internal/companion, app/preview (finance.json,
  the Finances cases in shoot.mjs), and the Finances docs. Change other code
  only when a Finances feature needs it, in its smallest form.
- Never touch VERSION, never cut a release, and never merge, close, or push
  to a PR that isn't yours. Your PR stays a draft. The owner merges it.
- `git fetch origin main` and merge main into your branch at the start of
  every round, since the other session merges things. On a conflict in
  web/dist/*, never merge it by hand: resolve the sources, then run
  `make frontend` again. In CHANGELOG.md, keep both sides' lines.
- If main's CI is red for a reason outside Finances, leave it to the
  cleanup session. Note it in your PR and carry on.

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

A. **One pay-period card on the Dashboard.** Remove the row of
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
B. **Cards paid off in full with each paycheck.** A per-card option, "I pay
   it off in full with each paycheck", with an estimate of spending on it
   between paychecks. "Each paycheck" is every payday into checking,
   whoever is paid. Post-pay checking and the surplus include the payoff,
   and card spending counts as Spent once, not twice. (Already there: a
   payment with Card pays the card's whole balance on its own schedule;
   build on it rather than beside it.)
C. **"With each paycheck" as a schedule, and saving shown.** $500 into
   savings every paycheck and $625 a month into the Roth. "With each
   paycheck" (anyone's, into checking) as a schedule choice beside the
   existing "With each of Alex's paychecks"; savings and the Roth show
   today's balance and the post-pay balance.
D. **Update balances, one panel.** The owner updates balances once a day.
   An "Update balances" button opens one panel: every account, each box
   prefilled with today's expected balance, the difference shown while
   typing, and Enter saves all. (Already there: Update balances inside the
   post-pay grid; A moves that grid, so the panel stands on its own.)
E. **Logos from the name, more of them, and your own.** Pick the logo from
   the name unless one was picked by hand: Chase Checking → Chase, Mazda 3
   → Mazda, Fidelity 401(k) → Fidelity, BofA, Amex, CX-5, F-150; car
   model names match only for cars. Add as many institutions as possible.
   Where simple-icons has none (Fidelity, Vanguard, Schwab, Capital One,
   Citi, USAA, GEICO…), a clean letter tile in the brand's colour. Let the
   owner upload their own logo image for a brand, kept locally in the
   finances file and shown everywhere that brand appears. Never fetch a
   logo from the internet.
F. **Polish the marks.** Logos and icons centred and the same size; rows
   with and without a logo line up; text-only logos readable at row size.
   Render every logo on one test sheet and check it before committing.
G. **Groups:** investments, Roth IRA, traditional IRA, brokerage, and
   401(k) all under one "Investments" group (no separate Retirement), and
   "Home and car" written "Home & Car".

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
3. **Subscription logos, a batch of 10–15 per round**. Round 3 did the
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
4. **Subscriptions, properly**. Round 4 did the first slice:
   Recurring › Subscriptions (widgets/Subscriptions.tsx) with a month, a
   year, renewals in 7 and 30 days, yearly against monthly, and each one's
   due status, from `View.Next` and the new `View.Last`. Round 5 added
   `Payment.Type` (optional, kept as-is when unknown, TestPaymentType), the
   form's Type (suggested from the brand or name: `suggestType` in
   Mark.tsx), its glyph through `PayMark`, and the year split by type.
   Still to come: a renewals line on the Dashboard (what renews before the
   next paycheck).
   The original item: (MoneyMatter has subscriptions and bills with
   due status and reminders). A Subscriptions view for Payment.Kind ==
   subscriptions: monthly and yearly cost of each and in total, sorted; the
   due status of each (due today, in N days, just paid); renewals in the
   next 7 and 30 days; a yearly plan vs monthly plan comparison; and an
   optional type (streaming, software, cloud/homelab, gaming, news,
   fitness, food, phone, other) with a glyph each, suggested from the brand.
5. **Brand picker**: search as you type the payee, a live mark, clear it, and
   a remembered "None" (picking None by hand sticks, rather than the name
   matching again). Suggest the payment Kind from the brand's kind.
6. **Savings meets Finances**: when a running app replaces a subscription
   still in the plan (internal/savings: Jellyfin/Plex for Netflix, Immich for
   Google One/iCloud, Vaultwarden for 1Password…), say "Immich is running:
   Google One still costs $X a year". Add a "cancelled because of the
   homelab" total.
7. **Goals** (MoneyMatter's goals). A goal has a target, an optional date,
   and a share (%) of one or more accounts' balances. It never moves money.
   It shows Target, Saved, Left, Needs (a month, or per paycheck here, since
   this app thinks in paychecks), and Pace with the month it's reached at
   that pace, from Account.History. Add a **What if** sandbox (a different
   amount per paycheck or date; early or late by N months) and a banner when
   all goals together need more than the household saves.
8. **Loans, payoff** (MoneyMatter's loans). With Rate, Original, Balance,
   and the payment going `To` the loan: the payoff date, the interest still
   to pay, a balance-over-time chart to zero, what an extra $X per paycheck
   does, and avalanche vs snowball order across loans and cards carrying a
   balance. Paid-off loans move to their own list.
9. **Set aside for bills that come less often than monthly** (yearly Claude
   Pro, car insurance every 6 months, quarterly water): how much each
   paycheck should put aside, with an optional transfer Payment to savings
   made from it.
10. **Money reminders through the homelab's ntfy**: a bill or card due
   tomorrow, a paycheck that will leave checking below Cushion, a yearly
   renewal in 7 days, balances not updated in 7+ days. Each can be turned off.
   Also a Finances paragraph in the weekly digest: what the next paycheck
   leaves, the biggest bills before it, and the change in net worth.
11. **Calendar feed**: an .ics of paydays and bills served by `homelab serve`
    to phones that may see Finances (LAN/tailnet, a revocable link, amounts
    on or off).
12. **Car value over time** (MoneyMatter's vehicles). Optional purchase
    price, date, and class on a Car account; its value drops each year,
    faster at first, to a floor (10% by default). A typed-in value overrides
    it. This feeds Worth.
13. **Net worth, richer** (MoneyMatter's net worth and money flow): net
    worth history stacked by group (cash, investments, retirement, home and
    car, owed); a money-flow picture of a typical month, pay → bills,
    subscriptions, saving, left over (extend widgets/Flow).
14. **FIRE number** (MoneyMatter's FIRE planner, kept simple): yearly
    spending from the plan ÷ a withdrawal rate (4% default) = the number;
    progress toward it from retirement and investments; the month it's
    reached at today's saving and an assumed return, with a ±2-point range.
    Label it an estimate, not advice.
15. **Bring data in from the homelab's own apps, on a click**: subscriptions
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
