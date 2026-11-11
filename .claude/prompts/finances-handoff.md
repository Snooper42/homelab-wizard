# Finances: where the last session left off (Nov 7, 2026)

Paste this into a new session, or point the session at this file. It carries on the Finances work of Account 1 exactly where it stopped. It sits beside, and does not replace, the files below.

## Read this first: where it stands on Nov 9, 2026

The account that built Finances (sessions `01Vi5AofCa…` and `01Vi5AogT7…`) ran out of usage on Nov 9. Everything it pushed was checked against GitHub that day, and **nothing is lost: all of its Finances work is on main.** This section is the current state. Sections 1 to 3 and 7 below are history, kept for their notes; where they disagree with this section, this section wins.

**Merged since section 1 was written:** #487 (Chase CSVs, select and change many), #488 (round logos, accounts in the sidebar), #489, #490, #494, #498, #510 (Investments from Ghostfolio: the card, Read now, Add a holding, put a buy right or delete it), #495, #497 (clean imported names, renames that stick), #499 (logos from each company's website, approved by the owner), #523 (section 7's usability round, plus imports that link the HOA and checking on payday as the owner's spreadsheet counts it), #532 (a loan read from its papers with its payments ring, Amex files the right way round, shares in parts of one). Branch `claude/elegant-ritchie-8dkyd1` (imported bills link by what they are; no PR) was checked line by line: its changes reached main in #523.

**Still to do, in order** (one small PR each; show the owner first):
1. **Ask the owner** whether "After <name>'s paycheck" now matches their spreadsheet (#523 changed how payday is counted). Until they say yes, section 2's item 1 stays open.
2. **Follow-ups #532 left:**
   - ~~A mortgage split between two people, with only one half in the plan, falls by that half a month in the projection, while the Loans card uses the papers' whole payment.~~ **Done Nov 10:** a loan read from its papers follows them in the projection (`project.go`, `dueAhead`), whatever the plan pays into it.
   - ~~Amex payee names keep the city and state, `AplPay`, `WWP*` and `WL *`.~~ **Done Nov 10** (`shopOf` and `withoutTown` in `payees.ts`, the Swift port beside it). A town spaced one word from the shop with no City/State column in the file still stays (nothing says where the shop ends). Clean them in `cleanPayee`, and change the iPhone app's Swift port in the same PR: it's tested against the computer's answers (`apple-client/Tests/Resources/PayeeVectors.json`, made by `apple-client/scripts/make-payee-logos.mjs`).
3. **Step 4, the rest** (the owner, Nov 11, from the mock: "i really like the new paycheck screen"; four PRs, the hub's section 2 has them): **PR 1, the bar (#598):** `widgets/Period.tsx` `PeriodBar` atop the Dashboard, the paycheck card without ‹ › of its own. Then past paychecks from the ledger, By month, the dark theme. The original note: one period picker at the top of the Dashboard ("‹ This paycheck ›", or by month) that every card follows. Today `Overview.tsx` picks only now or the next paycheck. Then the dark theme near-black, cards a step lighter (tokens only, `lint.mjs`). Check what's there before starting either.
4. **Step 5, the one card left:** Balance trend, a point opening its day. Latest transactions, Spent this month (the ring) and Cash flow's six months are built (#523).
5. **Step 6, the Transactions table:** columns, sort by any column, at 860px and on a phone the list again. Select and change many is built (#487), and so are the running balance and Show more (#523).
6. ~~**Step 7, fewer tabs.**~~ **Done Nov 10:** the owner picked four from the mockup: Dashboard, Spending (Transactions, Reports), Plan (Calendar, Recurring, Paychecks), Net worth (`groups` in `Finances.tsx`; smoke tests open a page with `finTab`).
7. **Each needing the owner's yes first:** ~~rules ("Always do this for <payee>")~~ (**yes Nov 11, built:** `Plan.Rules`, `ruleFor`, the transaction form's *Always do this for…*, the Rules sheet; then, Nov 11: "starts with" rules (`Rule.Prefix`, `ruleMatches`), **Also change the N already in**, and the Rules sheet editable; next, if asked: a rule that links to a planned payment, and rules on the amount or direction (money in from X of about $125)), a reminder for a bill not seen yet, picking a category's colour by hand. Bank sync stays declined (rule 1).
8. **Backlog 19, polish,** a little in every round.

**Branches:** keep `claude/feature-finances-shots` (every PR's screenshots). Safe to delete: `claude/elegant-ritchie-8dkyd1` and `claude/busy-newton-vvxfza` (both on main).

---

You are working on the Finances screen of homelab-wizard (github.com/Snooper42/homelab-wizard) with its owner. They are not a designer or a developer. Explain choices in plain words, show screenshots (before and after, light and dark, 1280px, 860px and phone width), and recommend one option rather than listing many.

## 0. Read first, and follow

1. `.claude/prompts/lanes.md`: who owns what. Finances is Account 1's (`claude/feature-*` branches).
2. `.claude/prompts/complaints.md`: anything under Finances comes first.
3. `.claude/prompts/finances-loop.md`: its **How Finances works** and **Rules that never bend** bind you. The rest is history.
4. `.claude/prompts/features-loop.md`: **For Account 2** has the Windows test note below.
5. `CONTRIBUTING.md` and `docs/Testing.md`, for the checks.

Read the code before trusting any description of it, this file's included.

## 1. What is done

Merged to main on Nov 7:
- **#482**, the two clear checking numbers. "Checking now" and "After <name>'s paycheck" lead the Dashboard (`widgets/Now.tsx`). Each shows how it adds up on hover, Tab, or tap (`View.CheckingNow`, `View.AfterPay`, `finance.Working`, recorded by `ProjectWith` as it runs). The owner's spreadsheet counts to payday itself, before that day's bills. The pay-period card's figure is the end of the period.
- **#483**, the three known causes plus smart matching:
  - **A:** a bill due the day balances were typed in comes out, unless marked **Already in** (`Plan.InBalance`). A paycheck that day is still taken as in the balance.
  - **B:** an import links a row to the planned payment it plainly pays (`View.Dues`, `importData.ts` `plannedFor`).
  - **C:** money in from someone outside the household (`Payment.Payer`), for the owner's wife's mortgage share.
  - **Step 3.1:** Transactions offers Link, Not it (`Transaction.NotPlanned`) and Link all, and a typed transaction picks its payment by itself.
  - **3.3:** a subscription's new price (`widgets/Prices.tsx`).
  - **3.4:** a bill not seen yet (`widgets/Missing.tsx`; no reminder yet).
  - **3.6:** a changing bill's average (`widgets/Averages.tsx`).
  - **3.5:** transfers joined (`Transaction.ToBank`, `Transaction.Apart`, `importData.ts` `pairs`).
- **#484**, the money flow (Sankey) on the Dashboard and Recurring (`flowData.ts`, `ui/sankey.tsx`, `widgets/Flow.tsx` `MoneyFlowWidget`).
  - A real month from the ledger, or a typical one from the plan, stepped with ‹ ›.
  - Top 5 / 8 / All; the Income / Taxes / Expenses / Saved strip.
  - Hover lights a box or band; clicking a box lists what is behind it, each item opening its form.
  - Narrow, it keeps fewer columns.

To merge just after 00:05 UTC Nov 8 (a scheduled job of the last session does it):
- **#486**: each category in its own colour everywhere (`hues.ts`; `--cat-N-soft` and `--cat-N-ink` tokens, checked at 4.5:1 by `lint.mjs`). The owner liked it ("i really like the category colors"). It also fixes a flaky smoke case (*a subscription's new price, Keep*: carry storage across a reload by hand), and notes Account 2's Windows test.
- **Then the PR from `claude/feature-finances-circles`**: round logos and icons on Finances (`#finances .fmark`), and the sidebar listing each account under its group with its round logo, each group folding away with an arrow, kept on this device (`widgets/Worth.tsx` `Balances`, `homelab.finances.foldedGroups`). The owner asked for it ("as long as you make them collapsible i love it"). It carries this file too. It merges when green: the owner said "merge everything when it's green".

If that job did not run, do both by hand (section 5's merge rules).

## 2. Waiting on the owner

1. **Their example against their spreadsheet** (Step 2's "Done when"): not confirmed yet. Ask them to open the Dashboard, rest on "After …'s paycheck", link anything Transactions offers, and say which row still differs from their sheet. Until they confirm, Step 2 is not done.
2. **Investments** (they asked: "begin to build a way to track investments … mock some stuff up there and automate that").
   - The mockup was sent (an Investments card on Net worth): total value, you paid, gain, this month; a bar by account; and each holding with symbol, name, account, shares, paid, worth now, and gain in $ and %.
   - Recommended: read holdings from **Ghostfolio**, the homelab's own app, already read for balances in `app/financeapps.go`. Read each morning when turned on, and on a **Read now** click. Ghostfolio itself looks prices up by symbol; only symbols leave, and that is Ghostfolio, not this app.
   - Other options offered: import a broker's OFX statement (its `INVPOSLIST`), or type holdings in by hand.
   - Asked and not answered: (a) do they run Ghostfolio, or would they install it; (b) a morning read on its own, or only Read now; (c) is the card right, or do they want a value-over-time chart or a holding's history on click?
   - It is a new kind of record (holdings), so build only after they answer. A holding's data must stay on this machine (rule 1). Never fetch a price or logo from the internet in this app.
3. **Not built, each needing a yes:** Step 3.2, rules ("Always do this for <payee>", listed and editable: a new record); a reminder for a bill not seen yet (a new setting); picking a category's colour by hand (a new setting).
4. **Declined or deferred:** bank sync (Lunch Flow, SimpleFIN) and the AI-powered import in their MoneyMatter screenshots send money data off the machine (rule 1). Both were explained, and neither was built. The YNAB and Wallet imports are local files, so they are possible if asked.

## 3. What is next, in order (one small PR each; show the owner before the next)

1. **Investments**, once section 2's questions are answered.
2. **Step 4, the rest:** one period picker at the top of the Dashboard ("‹ This paycheck ›", or by month) that every card follows; then the dark theme near-black, with cards a step lighter, thin borders, and generous corners (token changes only, `lint.mjs`).
3. **Step 5, Dashboard cards,** built like the money flow (title with its small actions, one big figure, a small capitalised label, a green or red chip against the period before). Each one clicks into what is behind it, as the owner asked ("all the charts … actually click into something"):
   - **Latest transactions:** a row opens the transaction.
   - **Where the money went:** a donut by category, a slice opening its transactions, with a table for a screen reader.
   - **Cash flow:** income, expenses, and saved %, with the last six periods as bars, a bar opening its period.
   - **Balance trend:** a point opening its day.
4. **Step 6, the Transactions table:** columns for date, category (its icon in its colour), amount, account, and payee (its logo). Sort by any column; tick rows to change category, payee, tags, or link for all at once; a row opens its details; at 860px and on a phone it is the list again.
5. **Step 7, fewer tabs:** propose a grouping with a mock screenshot (for example Dashboard; Transactions; Plan = Recurring, Pay, Calendar; Net worth with Reports). Change nothing until the owner picks. Keep every shortcut, the command palette's entries, the sidebar's right-click menu, and the phone working.

## 4. Known issues

- **Account 2's Windows test.** `cmd/homelab` `TestJobLogSplitsAtOnceAllFinish` (and once `TestAgentStateIsReplacedWhole`) fails on CI's Windows runner about half the time, with "being used by another process". `splitLog` reads with a plain `os.ReadFile` while another copy of it replaces the file, and Windows refuses that open. It is noted in `features-loop.md` **For Account 2**. Do not fix it (lanes.md Rule 3). Re-run the failed job once (the run must finish first), and comment once on the PR saying why it is not this PR's.
- **Local only:** *Finances, Net worth, 860px at text size 2* fails in this container ("Toyota Financial takes 8 lines"), unchanged on main too, and passes on CI. It is this container's fonts.
- **A reloaded `file://` page can start with empty storage** when the machine is busy. A smoke case that reloads carries storage by hand (see Status's place case and the new-price case).
- **Local `main` was stale** in the last container. Always branch from `origin/main` (`git checkout -B <branch> origin/main`).

## 5. How the last session worked (keep doing this)

- **One open PR at a time** for this chat; **at most 3 merges a day** (lanes.md Rule 5). Before a branch, and before each push, list the other open PRs' files (Rule 2). Squash-merge with `expectedHeadSha` pinned, every check green on that head, and nothing touching the PR's files gained by main since. When main has moved, merge it in.
- **Owner's approval:** merge after they say yes to the screenshots. They said "merge everything when it's green", which still means within the daily limit.
- **Branches:** `claude/feature-finances-<topic>`. Screenshots go on the one branch `claude/feature-finances-shots`, a folder per branch, linked from the PR (keep it; never delete it). Try `git push origin --delete` for merged branches; when refused, give the owner one **Safe to delete** command naming only `claude/feature-*` branches with no open PR.
- **Every change:**
  - A failing test first: Go in `internal/finance` for logic (made-up round numbers, never the owner's); a smoke case in `app/preview/shoot.mjs` for the screen.
  - Preview data: `go test ./internal/finance -run TestPreview -update`; bindings: `cd app && go test -run TestBindings -update .`.
  - Run `make check`, `make coverage`, `make frontend` (commit `web/dist`), and `make frontend-check`.
  - Then the full Finances smoke set: `SMOKE_ONLY=inanc SMOKE_SHARD=i/4 node app/preview/shoot.mjs --smoke`, in four shards. Run it in a separate `git worktree` (with `node_modules` symlinked) so edits don't disturb it; it takes about an hour.
  - Take screenshots with a throwaway copy of `shoot.mjs` that adds `SHOT…` cases writing PNGs (never committed). Do "before" from a worktree of the base branch. Look at them yourself before sending.
  - Add a CHANGELOG line under `[Unreleased]` (New or Improved, plain words, `words.mjs`) and a `docs/Testing.md` row.
- **Rules that never bend:** money stays on this machine; old `finance.json` and `finance-ledger.json` keep loading (new fields `omitempty`, with a Load/Clean test); MoneyMatter is AGPL, so take ideas only, never its code, CSS, text, icons or images; never skip or weaken a test; a phone allowed only to look gets no Edit or Add.
- **Asking the owner:** ask before changing how a number is worked out, before removing, merging or moving a tab, card or button, and before adding a new kind of record or setting. Mock things up (a throwaway worktree, screenshots) when they ask "what do you mean". It worked well for the sidebar.

## 6. Every report to the owner

A few plain lines: what changed for them, the check results (with the output when something failed), what is next, and any question. Then branch cleanup (`claude/feature-*` only) with its **Safe to delete** line.

## 7. Nov 8, 2026: the usability round on `claude/pensive-newton-igw9jp`

The owner asked this session to make Finances its main focus (usability, UI, features, bugs) and keep going. Everything is on `claude/pensive-newton-igw9jp`, pushed, with **no PR yet** (the owner did not ask for one). Each commit has its CHANGELOG line, a smoke case that fails on the build before it, and a `docs/Testing.md` row where it adds behaviour. Full Finances smoke runs (four shards) pass but for the known local-font case (*860px at text size 2*).

Shipped, in the order built:
- **Fixes:** Transactions' *This month* says *Kept* over the net; Loans' *Pay more* no *$0.00 a month* before an amount; the calendar's day buttons fill their cells (the platform's `td` padding beat `.fx-month td`); a new plan says *Nothing owed*, no dangling dots, no cushion key without a cushion; the checking chart's key lists only its marks; Cards and Loans no longer share Spending's and Car's colours (`hues.ts` `kindHue`).
- **Calendar:** days before today show what the ledger recorded (payee marks, the day's total; a day lists them, each opening its form; back to the first month with transactions, a year at most); *<Month> in all* beside the day picked (paychecks, bills, lowest checking, recorded so far); **Add a payment** / **Add a transaction** on a day (`Edit.tsx` `startOn`); a day clicked on the Dashboard's checking chart opens it (`Calendar.tsx` `showDay`).
- **Transactions:** a running balance per day when one account is picked; a day's total when it has several; this month's money out against last month's to the same day; 200 drawn at a time with **Show more** (5× faster with 3,000 rows); ⌘F to its search; search by amount and by day; a category filter takes a group (Food finds Groceries); `showTransactions(f)` opens it filtered (Reports, the Dashboard, budgets use it).
- **Dashboard:** *Latest transactions* and *Spent this month* (a ring by category, each opening its transactions); Cash flow's last six months (a month opens its transactions); Cash flow and Where it goes open Recurring, a kind on Where it goes its payments; Net worth takes the row after Money flow.
- **Reports:** a category, a payee, a month on its charts open their transactions; *Show all* payees; a category leads with its share.
- **Recurring:** what the payments shown come to a month and a year; **Largest first**.
- **Pay:** next paychecks by month with totals; a year's take-home; *Add them* where no gross is typed.
- **Forms:** amounts to the cent (*2512.40*); a payment's *Paid lately* (with its average); an account's *Balances lately*; Update balances says how many differ and what that does to net worth.
- **Budgets:** how much a day keeps one on budget; a budget opens its transactions.
- **Phone:** *Coming up* shows payday among the bills and what's due before it.
- **Weekly summary:** `finance.SpentLine`, what went out this week and where most of it went (`cmd/homelab/finances.go` `financeLines`).
- **Layout:** no card alone with half its row empty (container queries at 1052px); Net worth's paycheck-by-paycheck table shades its edge while more lies to the right (`--fin-edge`).

Left for the owner: open a PR from the branch when they want it reviewed and merged (it touches `web/src/finances`, `web/src/app.ts` for ⌘F, `internal/finance/reminders.go`, `cmd/homelab/finances.go`, and the shared `shoot.mjs`, `style.css`, `CHANGELOG.md`, `docs/Testing.md`). PR #508 (imports) touches `Edit.tsx`'s TransactionForm and ImportForm and `Transactions.tsx`'s LinksWidget; this branch changed other parts of those files, so a merge should go cleanly, but `web/dist` must be rebuilt after it.
