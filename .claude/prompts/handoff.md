# One session for everything: Tidy Up, Finances, and the iPhone app (Nov 12, 2026, morning)

The owner has one Claude account for this repository. This file is the hub: where the work stands, what to do first, and how to hand on. It sits above the files it points to (section 5); each keeps its detail and its own rules.

You are working on homelab-wizard (github.com/Snooper42/homelab-wizard) with its owner. They are not a designer or a developer, and they work on this in the evening, at home with their Mac and phones. Explain choices in plain words, recommend one option rather than listing many, and show what changed. Keep reports plain and short, and say what you need from them. **Give every time in New York time (Eastern, America/New_York), never UTC** (the owner, Nov 11); convert what tools report in UTC, and schedule check-ins with the zone in brackets (`2026-11-11T20:00:00[America/New_York]`).

## 0. Rules for this session (they never bend)

1. **Money stays on the machine** (`finances-loop.md`'s rules): never put the owner's amounts, holdings, account names, merchants or screenshots of Finances in a commit, a PR, a prompt file or an artifact. Describe a Finances bug in ratios and shapes; test with made-up numbers.
2. **A failing test first**, then the fix: Go tests beside the code, smoke cases in `app/preview/shoot.mjs` (mock: `app/preview/mock.js`), Swift Testing in `apple-client/Tests/`.
3. **One open PR at a time.** Small and plain, one change each (batch only small related fixes). Branch from a fresh `origin/main`; GitHub is the only source of truth (`git fetch origin`, the open PRs, `git ls-remote origin 'refs/heads/claude/*'`).
4. **Merge each PR as soon as every check is green on its head, without asking** (the owner's standing rule; the 3-a-day cap is waived): squash, `expectedHeadSha` pinned, after checking that what main gained since touches none of its files. Never merge red.
5. **Waiting on CI:** `subscribe_pr_activity`, one `send_later` check-in about 50 minutes out, end the turn. Don't poll.
6. **Every PR ends with "Try this tonight"** (what to click, and whether the iPhone needs the cable re-install). `CHANGELOG.md` under `## [Unreleased]` only.
7. **Each new companion (phone) call** checks the device's permission: a read, or a change (`Change: true`) that a look-only phone and a wall screen can't make, and that a member's phone makes only for its own things. Changes ask Face ID on the iPhone, except a fold (it only changes what shows open).
8. **Ask the owner with the pop-up** (AskUserQuestion: multiple choice, the recommendation first), never as a question in the text (the owner, Nov 12: "whenever you ask me questions do the pop up multiple choice thing").

## Start here (every session, in this order, before anything else)

1. **Read this whole file**, then the files section 5 names for the work you're about to do. Read the code before trusting any description of it, this file's included.
2. **Find where things stand on GitHub, not in your memory:** `git fetch origin --prune`; list the open PRs; `git ls-remote origin 'refs/heads/claude/*'`; `git log --oneline -15 origin/main`. Compare with section 1. If GitHub shows something section 1 doesn't (a PR merged or opened since), GitHub is right: carry on from what it shows.
3. **An open PR from an earlier session comes first:** subscribe to it, read every check on its head, and land it (the playbook below). Only then start the next step. Never open a second PR while one is open.
4. **Find the next step:** the first step in section 2 not marked **Done**. Each step says what "done" is. Mark it **Done** (with its PR number) in this file in the PR that finishes it, so GitHub always shows the next step.
5. **Branch from a fresh `origin/main`:** `git checkout -B <your branch> origin/main`. The branch name is whatever the session was given; a merged PR's branch is gone from GitHub, so push it plainly (`git push -u origin <branch>`), never `--force-with-lease` against a deleted branch.
6. **Tell the owner in two or three lines** what you're about to do and what (if anything) you need from them, then start.

## How to decide (so nothing waits on a guess)

- **The owner says "continue", "keep going" or similar without answering a question:** take the recommendation you gave, say in one line that you did and that they can still change it, and write that into this file (as #593's "per phone" was).
- **A step says "ask the owner":** ask once, in one short message with one recommendation first. While you wait, go on to the next step that doesn't need the answer; never sit idle and never build the asked-about thing on a guess. Write the question into section 4.
- **Never without the owner's yes:** anything that weakens a security choice (the Keychain's unlock-only pairing, a phone call made a change without `Change: true`, anything published to the internet); deleting a branch or data; pushing to a branch that isn't this session's; a second open PR; changing CI to skip or loosen a step. These are asked even if they say "continue".
- **Dropped by the owner, never offer again:** the phone away from home (Nov 10); background refresh (Nov 11); ⌘1 to ⌘4 for Finances tabs; syncing the Finances sidebar's folds.
- **Two ways to do something and no answer:** the one that changes less for the partner's phone and the household (as "per phone" did), and the one that can be undone.

## 1. Where it stands (Nov 12, 9 AM Eastern)

**Merged Nov 10 to 12** (each green):

| PRs | What |
|---|---|
| #556, #557 | The last hand-off; the owner dropped the phone away from home (leave it off, don't ask again) |
| #558 | Investments count shares from the buys and sales when Ghostfolio's holdings disagree. **complaints.md keeps it open until the owner confirms after Read now** |
| #559, #560, #562 | Home only: **Reach it away from home** on each public app's page, desktop and iPhone; fails closed |
| #561 to #573 | The security backlog through item 88, and N21 to N41 |
| #574, #583, #589 | Finances imports: Amex payees cleaned, game stores as their brand, an import read as money in on a card says so; a bank file's own Category column on import; company endings (LLC, Inc.) off payees |
| #575 | A mortgage split with someone else falls as its papers say, on Net worth and Loans alike |
| #576 | iPhone: a stopped app offers Start, or says to start it from the computer |
| #577 | Finances in four tabs: Dashboard · Spending · Plan · Net worth |
| #578 to #582 | Tidy Up queue items 2 to 6 |
| #584, #585 | Finances rules: **Always do this for "…"**, "any name starting with", change the ones already in, edit them in **Rules** |
| #586 | Back and Forward between screens: ⌘[ ⌘], mouse buttons, a two-finger swipe |
| #587, #588 | Status folds kept by the computer, the same on the app, the phone's page and the iPhone |
| #590 | **Snooze a failing check's alerts from a phone allowed to change things** (the phone's page and the iPhone, behind Face ID); **a form opening leaves the cursor where it was put** (`web/src/parts/Sheet.tsx`: the sheet no longer moves the cursor to its first field once it's in another of its fields; that race made the *Always do this for only that name* smoke case fail now and then) |
| #591 | Alerts PR 1: **the computer keeps every alert** (`internal/history`'s `alerts`, 90 days), when it cleared and who snoozed it, never an amount; `AlertLog`; **Every alert…** on Status's Recent alerts, on the computer and the phone's page |
| #592 | Alerts PR 2: **the iPhone's Every Alert page** (`AlertLogView`, `KeptAlert`; the contract's `alertLog` sample) |
| #593 | Alerts PR 3: **Alerts From** on the iPhone (the ntfy app or this app, per phone; this app notifies while it's open) |
| #594, #595 | The hand-off after Alerts in the app; the one for the feature check, then the rest |
| #600 | **Finances Step 4, PR 3:** the Dashboard by month (`monthPeriods`, `widgets/Planned.tsx`, the bar's By paycheck / By month). **Step 4 is done:** its last piece, the near-black dark theme, was already on main (`--fin-night`, since #545) |
| #599 | **Finances Step 4, PR 2:** look back at a paycheck (`View.Before`, `widgets/Past.tsx`); a smoke case's fixed Nov 12 fixed |
| #598 | **Finances Step 4, PR 1:** the period bar atop the Dashboard (`widgets/Period.tsx`, `#finPeriod`); the paycheck card follows it |
| #597 | Tidy Up's queue item 7: *Started yesterday at 3:04 AM* (`startedText`), and the stopped-part-way card says when it started |
| #596 | **The feature map:** `docs/Parity.md` (every feature on the computer, the phone's page, the iPhone, the iPad and the Mac app), `TestParityNamesEveryPhoneCall`; `apple-client/README.md` no longer claims a Mac menu bar item and Dock count the code never had |
| #602, #603, #605, #608, #611 | The security session's (its own branch, `audit-loop.md`): N42 to N48, round 7. Leave its PRs to it |
| #601 | Tidy Up's look, L3 (no Space card that repeats the header; Genres takes the row) |
| #604 | **Gap 1:** links into the app on the iPad and the Mac app (`IntentInbox.outcome`, `landing`, shared by the iPhone's tabs and the split view) |
| #606 | **Gaps 2 and 4:** What was done and Every Alert from the split view (the detail column's own stack; `DashboardViewModel.openAlertLog`) |
| #607 | **Gap 3:** Snooze… on an alert in Every alert whose watchdog check still fails (`snoozable`, web and Swift) |
| #609 | The owner's screenshots (Nov 12): a ring card measures itself (`.fx-widget:has(.fx-donutrow)`), so category names don't break mid-word; Setup's count says *· 1 can wait* |
| #610 | **The iPhone's Backups as the owner picked it:** the card, three tiles (`tiles(now:)`), Needs a Look, the fresh folded to logos, More one tap down |
| #612 | **The iPhone's Settings as the owner picked it:** *The Homelab* (`firstSettings`, in plain words), *This iPhone* (the lock, the widget, Alerts From), *Everything Else*; `SettingRow` shared with the form |
| #613 | The security session's N49 |
| #614 | **Gap 6:** Settings on the phone's page (`phoneSettings`; read-only where it only looks, none on a wall screen); the hand-off after 2A |
| #615 | Tidy Up's look, **L4**: cards in a row one height, as Finances'; Genres' library with Finances' switch |
| #616, #617 | The security session's N50, N51 |
| #618 | Tidy Up's look, **L5's first half**: captions on one line at 860px |
| #619 | The security session's N52 |
| #634 | **2C step 4, PR 4b:** the Watchlist on the iPhone and iPad, no share bar there (`WatchlistCard.swift`) |
| #635 | The security session's N57 (a followed ticker's address and size) |
| #633 | **2C step 4, PR 4a:** an account's page on the iPhone and iPad (`AccountBalance.swift`, `AccountDetailView.swift`) |
| #632 | **2C step 4, PR 3b:** the Watchlist (`finance.Watched`, `ghostfolio.FollowInto`, `FinancesFollow` on the app and the phone) |
| #631 | **2C step 4, PR 3a:** Investments as a list, no share bar; *Update apps holds still* measured once its window has slid in (a CI race) |
| #630 | **2C step 4, PR 2:** a loan's page with the payments that pay it (`Loan.tsx`, `Transaction.Extra`) |
| #626 | The security session's N54 to N56 |
| #629 | **2C step 4, PR 1:** an account's own page (`Account.tsx`, the tab `account:<id>`; `balanceAfter`, `runsFrom`) |
| #628 | **2C step 3:** Back and Forward step through Finances' and Tidy Up's tabs (`web/src/tabs.ts`); `TestTheTunnel`'s chance failure fixed (it searched a sealed box's base64 for "Sam") |
| #627 | **2C step 1, the iPhone half:** your own logos in the Homelab app (`OwnLogos`, the plan's `logos`, `LogoCircle` draws them first) |
| #625, #626 | The security session's round 13, N54 |
| #623 | The security session's round 12 |
| #624 | The hand-off after L7 |
| #621 | The security session's N53 |
| #622 | Tidy Up's look, **L7**: in the dark, Finances' night (`--fin-night` on `#tidy`); every tab compared at three widths in both themes |
| #620 | Tidy Up's look, **L5's second half**: what a job freed on the right of its line in Recently done (`media.Activity.Freed`, `Activity.Said()`); Audiobooks' Merge says what it wins back |

**In flight:** #PRNUM, **2C step 4, PR 4c: a loan's page on the iPhone and iPad** (`LoanLinks.swift`; `LoanSection` and `LinkPaymentView` in `AccountDetailView.swift`; `LedgerEdit.settingLink`; `FinanceTransaction.notPlanned`, `.extra`; `FinancesViewModel.link`/`notThisOne`/`countInFull`, each after Face ID; `LoanLinksTests`); on branch `claude/blissful-pascal-997omq`, with this hand-off. *Done:* merged green. **Next, committed locally:** 2C step 5's first piece, **Arrange the Dashboard** (`local/arrange`, its top commit *Finances: arrange the Dashboard, kept on this device*: `web/src/finances/Arrange.tsx`, Overview's cards as slots; the owner's yes Nov 12, artboard 5 of the canvas, per device). Then section 4's waits.

**Mockups (Nov 12, made-up apps):** the private canvas https://claude.ai/artifact/V6EmaatcLbMwdXu3UAzWd3 (gaps 1, 2, 4 on the iPad; 3 on the iPhone; 6 on the phone's page; the iPhone's Backups and Settings, both built). The owner asked that mocks match the iPhone app more closely (section 6).

**Alerts in the app is done.** Background refresh was **dropped by the owner (Nov 11: "I'm okay with no backgrounds")**: the pairing stays readable only while the phone is unlocked (`KeychainManager.swift`), and a locked phone hears from the ntfy app until push (APNs, behind `HOMELAB_SIGNED`). Don't offer it again.

**Dropped, with the owner told:** ⌘1 to ⌘4 for Finances tabs; syncing the Finances sidebar's folds.

## 2. The owner's pick (Nov 11): all of it, in this order

The owner asked for "a handoff to do all this" (Nov 11): the feature check first (recommended), then the rest of the list. One PR at a time; ask where a step says so (*How to decide*, above). Mark each numbered step **Done (#PR)** in the PR that finishes it; the next session starts at the first step without the mark. What Alerts in the app built is in `unison-handoff.md` section 4, item 6, and #591 to #593.

### 2A. The feature check: every feature, everywhere: done (#596 to #614)

The owner asked (Nov 11) whether every version on each platform has the same features. The answer then was "mostly, not entirely", from `apple-client/README.md`'s table alone. This makes it definite.

1. **The map** (docs PR, with its test). **Done (#596):** `docs/Parity.md`, `TestParityNamesEveryPhoneCall`; its *Gaps* section is step 2's list.
   - *Where:* a new `docs/Parity.md`: one table, a row per feature (group them as the computer's sidebar does: Status, an app's page, Backups, Finances, Tidy Up, Setup, Settings, Choose apps, then alerts, links, widgets, keyboard), and a column each for **the computer** (one column; a note where Mac, Windows or Linux differ), **the phone's page** (the companion in a browser), **the iPhone app**, **the iPad**, and **the Homelab app on the Mac** where it differs from the iPad. Each cell: *yes*, *partly* (what's missing), *on purpose* (why: a phone can't install apps, a wall screen only looks, away from home only looks), or *gap*.
   - *Read, don't trust descriptions:* the computer's screens (`web/src/screens/*.ts` and what they mount); the phone's page is the same bundle under `html.companion`, so a feature is there only if its calls are in `phoneMethods` (`cmd/homelab/serve.go`) and CSS doesn't hide it (`html.companion` and `.can-change` rules in `web/dist/style.css`); the iPhone and iPad from `apple-client/Shared/Views` and `apple-client/README.md`'s table ("Not yet" there is a gap); the computer per system from `docs/Host.md` (*The same on every system*) and `os-mac`/`os-windows`/`os-linux` in the CSS. Every **New** line in `CHANGELOG.md` since 0.17.0 should land in a row.
   - *Test that fails today:* `cmd/homelab` `TestParityNamesEveryPhoneCall`: every key of `phoneMethods` is named in `docs/Parity.md`, so a new phone call can't go unmapped. Mention the map in `CONTRIBUTING.md`'s every-PR list.
   - *Fixed looks like:* the owner can read one page and see what each device can and can't do, and why.
   - *Done:* merged green, with the test.
2. **Show the owner the gaps and ask which to close.** **Done (Nov 12):** asked Nov 11, 6 PM; the owner said "continue", so the recommended order is taken (they can still change it): **1** (links into the app on the iPad and Mac app, **#604**, merged), then **2 and 4** together (What was done and Every alert from the split view, **#606**), then **3** (Snooze on an open alert), then **6** (Settings on the phone's page); the iPhone Finances pieces (5) after 2B. A short list in chat (or a private Artifact page): each gap in a line, what closing it takes (S, M, L), and one recommended order. Gaps already known: the iPad lacks **What was done** and **links into the app** (README says "Not yet"); **Snooze…** on an open row of Every Alert (the watchdog card has it); whether **Every Alert**'s link opens from the iPad and Mac split view's list; Tidy Up and Choose apps are the computer's only (on purpose for now; Tidy Up's questions on the phone are `unison-handoff.md` item 9).
   *Done:* the owner has the list and has picked (or said none).
3. **Each gap the owner picks: its own PR**, a failing test first (Swift Testing for the iPhone and iPad, smoke for the phone's page), and its row in `docs/Parity.md` changed to *yes* in the same PR. **Done:** gap 1 (#604), 2 and 4 (#606), 3 (#607), 6 (#614, with this hand-off). Gaps 5 (the iPhone's Finances pieces), 7, 8 and 9 stay on `docs/Parity.md`'s list to offer later; recommend 5's *Select together* first when the owner asks what's next for the iPhone. The security review (2B step 6) was already running in its own session (the owner, Nov 12), so no launcher was needed.

### 2B. Then the rest, in this order: started while 2A waits on the owner

1. **Finances imports, round 3.** **Screenshot asked for Nov 11, 6 PM.** Ask the owner for a screenshot of rows that still look wrong (they said "closer to being correct", Nov 11). Describe them in shapes, never commit their merchants (section 0, rule 1). No screenshot: go to 2, and ask again when 2 is done. *Done:* the rows in the screenshot import right, with a test of each shape.
2. **Finances Steps 4 to 6** (`finances-handoff.md` section 3): **mocked Nov 11, 7 PM, made-up numbers:** the private canvas https://claude.ai/artifact/2sogwZGydVNULUWaPBNMMu (Step 4: the picker *By paycheck / By month* with ‹ › and Today over the Dashboard, every card following it, past periods from transactions and future ones from the plan, a Dark switch for the near-black theme; Step 5: Balance trend looking back 30/90/365 days, per account, a point opening its day; Step 6: the table with sortable Date, Payee, Category, Account, Amount, *Balance after* when one account is picked, and the list again under 860px). **The owner, Nov 11: yes to Step 4** ("i really like the new paycheck screen"). Step 5 confused them (the stick chart, no amounts on the side); it was redrawn as **Checking, last 90 days**, the forward chart's look facing back, and waits on their yes. Step 6 waits on their yes. **Step 4, in four PRs, each with screenshots (1280, 860, phone; light and dark):**
   - **PR 1, the bar (#598, merged):** `PeriodBar` above `.fx-board` in `Overview.tsx` (`#finPeriod`: ‹ the period's name and days › and Today, on the computer and the phone's page); `PaycheckWidget` loses its own ‹ › and is titled *This paycheck* or *Until the next paycheck*. Test: smoke *one period picker atop the Dashboard, the cards follow it*.
   - **PR 2, past paychecks (#599, merged):** built as planned, with one change: the paydays before today come from the computer (`View.Before`, the last 12 into checking, each earner's schedule run back with `Schedule.Back`, moved off weekends and holidays, two on a day one payday; `TestBefore…`), not worked out in the browser. The pick is an index: 0 now, 1+ ahead, −1 and below before now (`pickedOf`); Net worth keeps `Math.max(0, sel)`. A past period: **What happened** (`PastWidget`: *Came in*, *Went out* and what was left, from `totals`, transfers neither; its transactions, `TxRow` shared with Latest) in the paycheck card's place; **Where it went** (`SpentWidget` with `days`); Latest transactions hidden; the checking chart's band off. The original plan: ‹ goes back before now. A past period is worked from the ledger (`finance.Ledger`'s transactions between two paydays of the plan's people), not the plan: the paycheck card shows what came in and went out, checking at its end (the running balance's sum), and *Latest transactions* and *Spent this month* follow it (titled for the period). *Where:* a `pastPeriods(v, ledger)` in `web/src/finances/model.ts` (paydays from `v.plan.people`' schedules going back, as far as transactions go), `Period.tsx`, `Latest.tsx`, `Spent.tsx`. *Test that fails today:* smoke *the period bar goes back to the last paycheck, from transactions* (‹ from Now is disabled today), and a smoke for a period's sums with the mock's ledger.
   - **PR 3, By month (#600, merged):** built: the bar is drawn from props Overview works out (`PeriodBarProps`); `readBy`/`keepBy` keep the choice per device (`homelab.finances.periodBy`, in try); months from `monthsBack` (6) before this one to the last the plan's days reach; a past month is `PastWidget`, this month `PastWidget` (*So far this month*, to today) and `PlannedWidget` (*Still to come*, from tomorrow), a month ahead `PlannedWidget` (*The plan*: comes in, goes out, checking at its end, each paycheck and payment). The original plan: a *By paycheck / By month* switch on the bar; months from the ledger behind, from the plan ahead (`v.days` summed by month). Kept per device (`localStorage`, wrapped in try). *Test:* smoke *By month steps months, and the cards follow*.
   - **PR 4, the dark theme: already done** (found Nov 11: `--fin-night`, `--fin-night-card`, `--fin-night-line` in `style.css`, applied to `#finances` in the dark unless more contrast is asked, since #545). Nothing to build. The original plan: near-black ground, cards a step lighter, thin borders (`style.css` tokens only, `lint.mjs`), as the mock's Dark switch. *Test:* the axe and contrast smoke cases in dark, and screenshots.
   Today's Dashboard already had a pay-period picker inside the Paycheck card (`widgets/Paycheck.tsx`, forward only) and the 30-day checking chart already opens a day (`widgets/Checking.tsx` `onPick`): one period picker the Dashboard follows, Dashboard cards that click through, the Transactions table. Mock each first (a private Artifact page with made-up numbers) and show the owner before building; build only what they say yes to. *Done:* each step's PR merged, or the owner said no to it.
3. **Tidy Up:** queue item 7 ("Started yesterday at 3:04 AM", **done, #597**), L3 (**#601**), L4 (**#615**), L5 (**#618**, **#620**), then L6 (**asked Nov 12**: the owner's call, build nothing until they say) and L7 (**#622**: done, every tab compared). **Done except L6, asked Nov 12**; L8 (the books review's rows) is to offer. *Done:* each merged, `tidy-loop.md` ticked, and L6 answered.
4. **The rest of the iPhone plan** (`unison-handoff.md` section 4, items 7 onward: Send to my phone / Open on the computer, files in without an extension, Tidy Up's questions on the phone, scan a receipt, Spotlight), each item a desktop PR first where the computer needs something new. Item 11 (widget extras) waits on the App Group test (section 4). Ask the owner which item first if they haven't said; recommend item 7. **Asked Nov 12, 7 AM** (section 4). *Done:* each item merged and `unison-handoff.md` marks it.
5. **Rules, deeper:** a rule that links a payee to a planned bill; rules by amount or direction. Each needs the owner's yes first; no yes, no build. **Asked Nov 12, 8 AM** (section 4), recommending the payee-to-bill link first. *Done:* built, or the owner said no.
6. **An independent security review**, in **a session of its own** (launcher below), of #556 onwards. **Done (Nov 12):** the owner started it on their other account before 2A ended; it runs on its own branch (`audit-loop.md`). Leave its PRs ("Security N…") and `audit-loop.md` to it, and carry on with your own while one is open.

### 2C. The owner's list (Nov 12, 8:30 AM): before what's left of 2A and 2B

The owner, Nov 12: what doesn't work as they expect, and what they'd like next. They picked this order (the pop-up). One PR each, a failing test first.

1. **Their own logos don't show on the phone** (the iPhone app **and** the phone's page; pictures they set on the computer; a letter or an icon shows instead; on Net worth, the Dashboard, Transactions and Investments).
   - *The iPhone half:* **done, #627** (the owner re-installs with the cable to see it). The app never read the plan's `logos` (docs/Parity.md claimed it did).
   - *The phone's page:* **not found yet; the owner runs the count on the Mac "later" (Nov 12): ask again, with the pop-up, when they're back.** It is the computer's own bundle, and the phone's `Finances` call sends the whole plan, `logos` included (`serve.go`; `img-src 'self' data:` in the companion's CSP). In the preview (`phone: ['companion', 'finances']`, a `chase` picture) the page draws them as the computer does. So look at what the real plan holds. Ask the owner (pop-up) to run, on the Mac, a line that prints only counts (how many pictures, how many over 64 KB, how many not PNG/JPEG/WebP, how many by name), never names. Then reproduce that shape in a smoke case.
2. **Read now times out from the phone** (waits on the words after the colon: the owner will look next time; on the Mac it works in seconds) ("Couldn't read Ghostfolio:" then a time-out). The phone's `FinancesReadInvestments` and the app's both give Ghostfolio 30 s; the phone's goes through the companion (and the tunnel when away, which the owner dropped Nov 10: they mean away from the computer, at home). Find where the phone's call stops first (the tunnel's or the companion's timeout, the iPhone's `actionSession`) and give it what the read needs, or make the read answer at once and finish behind (the card says *Reading…* until it's in).
3. **Back and Forward remember tabs: done, #628.** `web/src/app.ts`'s `remember()` keeps only the screen (and an app's page), so Back from Finances › Recurring or Spending skips every tab and lands on the screen before (Status). A `Place` keeps the screen's tab too (Finances' `tab` in `screens/finances.ts`, Tidy Up's, Settings' page); a tab change pushes a step; `visit` puts the tab back. Fold in Finances' own *← back* from Transactions. *Test:* smoke *Back from Recurring goes to Spending, then the Dashboard, then the screen before*.
4. **The mockup: https://claude.ai/artifact/HxLxza1NGSNjGtsfxZuRzA (private canvas, made-up numbers). The owner, Nov 12: yes to all four, in this order: the account page, the loan page with linked payments, Investments as a list with a Watchlist, then each on the iPhone. A payment over their share: ask each time (as drawn).** Each its own PR, a failing test first:
   - **An account's own page: done, #629** (the computer and the phone's page; the iPhone's is with PR 4). tapping an account (Net worth, the sidebar, the phone) opens its page, not the balance form: its balance and a chart of it over time, its latest transactions, **Update balance** and **Edit** (name, logo, type) as buttons.
   - **A loan's page: done, #630.** Built as: links are a transaction's `payment` (the plan's payments into the loan); the same payee's next ones offered (`alike`), not linked on import; Link a payment… lists money out not linked to anything; one over the plan's payment asks *count all of it?* (Count it: `extra`; Not this one: unlinked, `notPlanned`). The original plan: builds on the account page (`Account.tsx`: a loan section above Latest transactions). A link is a rule (`finance.Rule`, #584/#585: Always do this for "…") that names a loan account and the owner's share; a linked transaction is counted towards the loan at the share, and one over the share is asked about (Count it / Not this one), as the mockup draws. *Where to read first:* `internal/finance` rules and the split (#575, `Share`), Worth.tsx's loans (`LoansWidget`). the payment, rate, months left, payoff date and **your share** (the split, #575), then **the payments linked to it**: link a transfer once (theirs is a Zelle payment to the person they share the mortgage with) and every one after counts towards the loan, at their share. This is 2B step 5's "a rule that links a payee to a planned bill": **the owner's yes (Nov 12)**. Rules by amount or direction still wait.
   - **Investments: PR 3a the list (done, #631); PR 3b the Watchlist (done, #632):** `finance.Plan` keeps followed tickers (symbol, name, data source, the day and price followed, a point a day); `ghostfolio.ReadInto` quotes each (`Session.quote`) as it reads; an app method and a phone call (Finances edit level, `Change: true`, Face ID on the iPhone) follow one found by `FindSymbol`; Unfollow saves the plan without it. The original plan: no horizontal ratio bar (the owner doesn't like it; they like the holdings separated); each holding with its price, today's change, its gain and a small chart; the total and a chart on top; a **Watchlist** of tickers followed without owning, priced through Ghostfolio's lookup.
5. **Later:** the Dashboard's cards moved, hidden and sized (**the owner's yes, Nov 12, as artboard 5 draws it, kept per device; built locally, see In flight**) (Edit layout: drag, and Move up/down for the keyboard; Hide; Reset; kept per device; then a third, half or full width); text that wraps or doesn't line up (ask for a screenshot; seen with made-up data: *This paycheck*'s account tiles, one name on two lines; four then two tiles at 860px; the sidebar cutting account names short).

## 3. Once the owner picks: hand on before you build

Before the first line of the chosen work, rewrite **this file** for it, in the same shape, and commit it in that work's first PR:

- **Header and section 0** stay (update a rule only when the owner changed it).
- **Section 1:** what merged since, one table row per PR or group; what's in flight, in order, each with its PR number, branch or commits, and what "done" is.
- **Section 2:** the owner's pick, broken into small PRs in order, each with *where in the code*, *what fixed looks like*, and *the test that fails today*. Then what's left to offer next time, with one recommended.
- **Section 4** (waiting on the owner) and **section 6** (lessons) brought up to date.
- **The launcher** at the bottom, one line, updated.

Keep it the hub: detail belongs in the loop file for that area (`finances-handoff.md`, `tidy-loop.md`, `unison-handoff.md`); link to it. Rewrite this file again whenever the session nears its end, so the next one starts from GitHub alone.

## 4. Waiting on the owner

- **Tidy Up's L6 (asked Nov 12, 7 AM):** should Tidy Up's main button (*Next up*'s: Scan, Build, Shrink…) also sit in the screen's header, as Finances has **+ Add a payment** there, or stay in the list with **Settings…** alone in the header? Recommended: **leave it in the list** (it changes with what's next, and the header's button would then be a second copy of it; a step that throws things away never gets it, P2). Build nothing until they say.
- **What's next for the iPhone (2B step 4), asked Nov 12:** recommended `unison-handoff.md` item 7 first (Send to my phone / Open on the computer).
- **Rules, deeper (2B step 5), asked Nov 12, 8 AM:** yes or no to a rule that links a payee to a planned bill, and to rules by amount or direction. Recommended: the payee-to-bill link first.

- **Also from the owner's screenshots (Nov 12), to mock before changing (the next UI work to offer; recommend the Setup error first, the smallest):** Setup shows a failed step's error twice (the log and the step) with a raw API path; the Dashboard's Cash flow card has a lot of empty space; Spent this month sits alone on its row and repeats Where it goes.
- **The Finances mocks (2B step 2):** Step 4 is a yes (Nov 11). Yes or no to Step 5 (redrawn as *Checking, last 90 days*) and Step 6 on the canvas (link in section 2). Build only what they say yes to.
- **Trying on the phone:** #576, #588, #590, #592, #593, and now #604, #606, #607, #610 and #612 (the iPad's links, What was done and Every Alert; Snooze in Every Alert; the new Backups and Settings) need the cable re-install, on the iPhone and the iPad (`git pull`, then `apple-client/scripts/run-on-iphone.sh <prefix>` after updating the computer): Every Alert under Recent Alerts, and Settings › **Alerts From**. **Who notifies** was taken as per phone (the recommendation) when they said "continue"; they can still say household. The App Group test: `HOMELAB_WIDGET=1` with the same script.
- **Investments (#558):** they press **Read now** and confirm the share counts; then move its complaint in `complaints.md` to **Done**.
- **Imports:** a screenshot of what still looks off (2B, step 1).
- **"After <name>'s paycheck"** against their spreadsheet (`finances-handoff.md` section 2, item 1): which row still differs.
- **Amex rows:** whether purchases show as minus and the account's kind is Credit card.
- **`unison-handoff.md` section 6's three questions** (setup from the phone; the partner's phone; which hurts most).
- **Branches safe to delete** (the owner deletes): `claude/feature-iphone-signed`, `claude/inspiring-noether-x39490`, `claude/investments-bug-pr-merges-pmy7tp`.

## 5. Read before each kind of work

| Work | Read first | Its rules |
|---|---|---|
| Finances | `finances-handoff.md` (first section), `finances-loop.md` (**How Finances works**) | `finances-loop.md`'s **Rules that never bend** |
| Tidy Up | `tidy-loop.md` (**Open now**, the queue, the look) | its **Standing rules**, **Rules that never bend**, promises P1 to P12 |
| The iPhone app and its desktop side | `unison-handoff.md` (section 4's order, section 5's **Every PR**), `apple-client/README.md` | section 0 here |
| Security and privacy | `docs/Security.md`, `docs/Decisions.md` (ADR-0005, ADR-0022, ADR-0023) | `audit-loop.md` |
| Every PR | `lanes.md`, `complaints.md`, `CONTRIBUTING.md`, `docs/Testing.md` | section 0 here |

## 6. Lessons from this container (save yourself the time)

- **Swift can't compile here.** CI's Apple client job (`build-and-test`) is the first compile; read its log if red. Payee logic is shared with Swift: change `web/src/finances/payees.ts`, then `node apple-client/scripts/make-payee-logos.mjs` (regenerates `PayeeLogos.json` and `PayeeVectors.json`; `--check` in CI), and mirror it in `PayeeLogos.swift`.
- **The bundle:** `web/dist/app.js` is built (`node web/build.mjs`; CI runs `--check`). Build it in the main checkout: a worktree with a `node_modules` symlink writes its own path into the bundle (`grep -c home/user web/dist/app.js` must be 0). `web/dist/style.css` and `index.html` are hand-written sources. `node app/preview/lint.mjs` forbids `document.createElement` and colours that aren't tokens.
- **Smoke:** `SMOKE_ONLY="<part of a name>" node app/preview/shoot.mjs --smoke light` (rebuild the bundle first). Finances tabs: the `finTab(page, name)` helper. A long local run can die with a container restart; CI runs the full set in two themes.
- **Companion calls:** add to `phoneMethods` in `cmd/homelab/serve.go`, then `go test ./cmd/homelab -run TestCompanionContract -update-contract`; the bindings for the app: `cd app && go test -run TestBindings -update .`.
- **`govulncheck` can't reach its database here;** CI's security job runs it. When a new Go advisory turns it red on every PR, bump `toolchain` in `go.mod` and `app/go.mod`.
- **Coverage floors are per package** (`coverage-floors.txt`, CI's **check** job runs `make coverage`): a new function tested only from another package lowers its own package's figure. Test it beside its code (`notify.SnoozeHours`, #590).
- **Windows CI:** a test that saves inside `if runtime.GOOS != "windows"` and checks outside it fails there (#587).
- **Preact:** state set while typing isn't read by a Save pressed at once; keep a `useRef` mirror (the Rules sheet, #585).
- **After a conflict, diff every touched file against `origin/main`** before pushing; a CHANGELOG conflict keeps both lines. `git cherry-pick --continue` takes no `-q`: check `git log` after.
- **GitHub's runners losing Ubuntu's mirror** (Nov 11, about 9 AM to 12:30 PM Eastern): **app**, **smoke (light)** and **smoke (dark)** died at `playwright install --with-deps` or `apt-get` with `Temporary failure resolving 'archive.ubuntu.com'`, before any test. Not the code: check the log for that line (`gh api repos/Snooper42/homelab-wizard/actions/jobs/<id>/logs`), wait, then `rerun-failed-jobs` on the run. Never change CI to skip the step.
- **Run `make lint` before every push** (gofmt on `cmd` and `internal`, both `go vet`s): #591 went red once on a map entry's alignment in `serve.go`.
- **GitHub can lag:** a job's log can end while its check still says in progress for half an hour, and `upload-artifact` can fail on GitHub's own HTML error pages (#593). Read the job's log before deciding it's stuck or red; re-run an upload that failed that way once.
- **A flaky smoke case is a bug until shown otherwise:** the one on Nov 11 was a real race in `Sheet.tsx` (typing right as a sheet opened), fixed at its source in #590 with a case that reproduced it every time.
- **A smoke click aimed while a panel is still filling in can land on what moved into its place:** wait for the panel's content (the Tidy places panel's drives, #595) before clicking a button below it. A case that passes alone but fails in CI's shards is usually this or a focus race (#590).
- **A smoke case can hold a date that comes round:** *a calendar day adds a payment* checked that a new payment's form didn't start on Nov 12, the day it had picked; the form starts on this machine's real today (`todayISO`), so on Nov 12, 2026 it failed on every branch. A test that compares with a fixed day must compare with the real today when the code reads the clock (fixed in #599). Look for these when a Finances case fails on main too.
- **A README's table can claim what the code never had:** `apple-client/README.md` said the Mac app had a menu bar item and a Dock count; no `MenuBarExtra` or Dock badge was ever in `apple-client` (`git log -S`). Grep for the API before trusting a feature list, and keep `docs/Parity.md` the place that's checked.
- **Mocks must look like the app, not a guess at it** (the owner, Nov 12: "every time it is less like the iPhone app"). Before drawing, read `apple-client/Shared/Views/Theme.swift` and `Design.swift` (warm canvas `#F5F4F2`, white grouped sections, violet `#6A4FF0`, state pills, 56 pt round buttons, app icons with a state badge) and the view you're extending, and use its exact words. The phone's page is the web bundle (`web/dist/style.css` tokens), so it keeps the computer's look. CI's `iphone-screenshots` artifact can't be downloaded here (its storage host is blocked).
- **While a PR is open, the next ones wait as local commits** (`local/<name>` branches stacked on each other), each cherry-picked onto a fresh `origin/main` when the one before merges; a CHANGELOG conflict keeps both lines, and the bundle is rebuilt after (`node web/build.mjs`). Never push them to the open PR's branch. The Stop hook asks for a push when files are uncommitted: commit locally and say why it isn't pushed yet.
- **A test of an old rule changes with the rule, never goes:** gap 6 put Settings on a look-only phone, so *A read-only phone has no restart…* no longer checks that Settings is hidden but that every field is locked and there's no Save.
- **The phone's page at phone width shows Settings' pages as a list** (`#settingsNav select`), not buttons: `selectOption`, as the gap 6 cases do.
- **A container query asks the nearest container:** `@container (max-width: …)` inside a Finances card measured the whole screen (`#finances`), so a narrow card never stacked (#609). Name the container you mean.
- **Mocks for the owner:** the Artifact tool's Design type makes a private canvas of `.dc.html` artboards (start with `action: quickstart`, `intent: design`); write the files in the scratchpad, never in the repo, and use made-up numbers and payees only.
- **Before and after pictures without touching the repo:** copy `app/preview` and `web/dist` (main's `app.js` and `style.css` from `git show origin/main:…` for the before) into the scratchpad, cut shoot.mjs down to everything up to `const mock = ` with `root` pointed at the repo and `export { mock, tidy }` added, then load `index.html` with `window.__MOCK = { ...mock, screen }` and `mock.js`, as `open()` in shoot.mjs does. `npm ci` first (`node_modules` isn't there in a fresh container; the smoke needs `axe-core`).
- **A static helper on a SwiftUI `View` that a test calls must be `nonisolated`** (a View is main-actor isolated; the call from a test is a warning, and `build-and-test` fails on any warning): #627's `LogoCircle.cgImage`, #634's `WatchlistCard.sinceWords`/`changeWords`. Better still, keep such helpers on a model type.
- **A macOS job *cancelled* at 15 minutes with no runner name and no steps** never got a Mac (GitHub's queue), Nov 12 on #630: main's ran in 5 minutes meanwhile. `gh api repos/Snooper42/homelab-wizard/actions/jobs/<id>` shows `runner_name` empty; re-run the failed jobs once.
- `go build ./cmd/homelab` fails in the repo root (a `homelab` script is there): use `-o /dev/null`. A merged PR's branch is deleted on GitHub: start the next from fresh `origin/main`.

## When a check is red or stuck (the playbook)

Read the job's log before deciding anything: `gh api repos/Snooper42/homelab-wizard/actions/jobs/<job id>/logs` (job ids from `gh api repos/Snooper42/homelab-wizard/commits/<sha>/check-runs`). Then:

| What the log says | What it is | What to do |
|---|---|---|
| `Temporary failure resolving 'archive.ubuntu.com'` (or `azure.archive…`) at `apt-get` or `playwright install --with-deps`, before any test | GitHub's runners can't reach Ubuntu's mirror (Nov 11, 3½ hours) | Not the code. Wait 30 to 60 minutes, then `gh api -X POST repos/Snooper42/homelab-wizard/actions/runs/<run id>/rerun-failed-jobs`. Repeat at each check-in while it lasts. Never change CI to skip the step |
| `Failed to CreateArtifact … Unexpected token '<'` after the work passed | GitHub's artifact service answering HTML | Re-run the failed job once; one comment on the PR saying so |
| The log ended, but the check still says in progress | GitHub's status lagging | Read the log's end for the result; wait for the check to catch up (a check-in 40 minutes out). Merge only when GitHub shows it green |
| A run with no jobs at all, marked failed | GitHub | Re-run once |
| `make: *** [Makefile:…: lint]` with a file name | gofmt or vet | Yours: `gofmt -w` that file, `make lint`, push |
| ` FAIL <case name>` in smoke | A real failure until shown otherwise | Run that case alone locally (`SMOKE_ONLY="<name>" node app/preview/shoot.mjs --smoke light`). If it passes locally, look for a race (#590's was the sheet's cursor), and check main's recent runs for the same case: if main fails it too, it isn't this PR's; fix it at its source anyway, in this PR if the owner allows, else the next one |
| `error:` in build-and-test (Swift) | The first compile of new Swift | Yours: read the errors group, fix, push. Swift 6 concurrency is the usual cause |
| `coverage … below` | A package fell under `coverage-floors.txt` | Test the new code beside it, in its own package |

Re-run a job at most once for a real-looking failure; a second failure is real. A red PR you own is never finished: every event and check-in on it is work until it's green or you've told the owner exactly what blocks it.

## Before every push (the checklist)

- `make lint` (gofmt, both `go vet`s); `go test ./...` for what you touched, and `cd app && go test ./...` if `app/` changed.
- A new or changed phone call: `go test ./cmd/homelab -run TestCompanionContract -update-contract`; a new app method: `cd app && go test -run TestBindings -update .`.
- Web changes: `node web/build.mjs` then `node web/build.mjs --check`, `grep -c home/user web/dist/app.js` is 0, `node app/preview/lint.mjs`, `npx tsc -p .`, and the smoke cases you added or touched.
- `go run ./cmd/homelab docs --check` when compose files, metadata or docs changed.
- After a cherry-pick or a conflict: `git diff --stat origin/main` shows only what this PR adds.
- The PR: the template's sections (`.github/pull_request_template.md`), **Try this tonight**, no money (section 0, rule 1), no model name.

## Before the session ends (or the owner stops)

Rewrite this file so the next session starts from GitHub alone: section 1 (what merged, what's open and what "done" is for it), section 2's **Done** marks, section 4, any new lesson in section 6, and the launcher. Land it as a PR (or in the open one). Then tell the owner the launcher line to paste.

## Launchers (paste one into a new session)

The work, in this file's order (2A is done; 2B from its first step not marked Done):

    Read .claude/prompts/handoff.md and follow it from "Start here": land anything open, then do section 2 in order from the first step not marked Done, asking me only where it says to. Merge each PR as soon as it's green, and rewrite the hand-off before you stop. A security session on my other account may be running at the same time (.claude/prompts/audit-loop.md): leave its "Security N…" PRs and audit-loop.md to it, and carry on with your own while one is open.

The independent security review, in a session of its own (it was started Nov 12; when it next runs, add what this session merged: the iPad's links into the app (#604), Snooze from Every alert (#607), Settings on the phone's page (#614), the iPhone's Settings rows (#612)):

    Read .claude/prompts/audit-loop.md and follow it, against what merged from #556 onwards: the phone's change calls (SetStatusFolds, SnoozeCheck), home only (#559 to #562), Finances rules (#584, #585), imports, the alert record (internal/history's alerts table, AlertLog, #591) and the iPhone's local notifications (#593). Write each finding with a test that fails without its fix, and fix the real ones.
