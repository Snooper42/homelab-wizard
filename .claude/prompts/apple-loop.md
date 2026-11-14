# The iPhone and iPad app: the loop (lane 4)

The owner, Nov 14: "I want to iterate the shit out of the iphone and ipad app." This file is the whole job for a session that runs it. Do only what is here: `apple-client/` (lane 4, `lanes.md`) and what the app needs on the computer's side (a new phone call, its Go test, `docs/Parity.md`). Everything else in `handoff.md` (task 15, 2G item 22, 2H, 2I) is parked for another session. Don't start any of it.

## Launcher (paste into a new session)

> Read `.claude/prompts/apple-loop.md` and follow it from "Start here". Work only on the iPhone and iPad app. Merge each PR as soon as it's green, and update section 3 of that file before you stop.

## 0. Rules (they never bend)

1. **Money stays on the machine.** Never put the owner's amounts, holdings, account names, merchants or a screenshot of their real Finances in a commit, a PR, this file or an artifact. Use made-up numbers only. The CI pictures come from `apple-client/Screenshots/data.json`, which is made up. Keep it that way: never paste real figures into it.
2. **A failing test first, then the fix.** Use a Swift Testing case in `apple-client/Tests/`, or a picture that shows the problem (section 2, step 6). Logic gets a test. A pure layout fix gets its before and after pictures named in the PR.
3. **One open PR at a time**, on the branch your session is given (never another branch, and never another lane's PR or `audit-loop.md`/`docs/Security.md`).
4. **Merge as soon as every check is green.** Squash-merge with `expectedHeadSha` pinned, after checking that main's new commits touch none of the PR's files. Never merge red. **No daily cap for this lane** (the owner, Nov 14: lanes.md Rule 5's 3 a day doesn't apply here).
5. **While a PR waits:** call `subscribe_pr_activity`, set one `send_later` about 50 minutes out, and don't poll. Write the next change locally meanwhile (a local branch, not pushed).
6. **Every PR ends with "Try this tonight":** two to four taps to try, and whether it needs **the cable re-install** (`git pull`, then `./apple-client/scripts/run-on-iphone.sh <prefix>`, on the iPhone and the iPad). Any change in `apple-client/` needs it. Say so plainly.
7. **Every new phone call checks the device's permission** (look-only, changes, Finances level) on the computer, with a Go test, and is added to `phoneMethods` (`cmd/homelab/serve.go`) and to `docs/Parity.md`.
8. **Keep three things true in the same PR:** `apple-client/README.md`'s table, `docs/Parity.md`'s row, and a `CHANGELOG.md` line under `## [Unreleased]` (top of **Improved** for the look, **New** for a feature).
9. **Ask the owner only with the AskUserQuestion pop-up**, every question at once, and only when it's genuinely theirs (a new feature's look: mock it first). Times in New York (Eastern) time. Never tell them to use Tailscale; say "away from home" or "Wi-Fi off".
10. **Never without the owner's yes:** weaken a security choice, delete a branch or data, loosen CI, or open a second PR. No model name in commits or PRs.

## Start here (every session)

1. `git fetch origin main` and look at section 3: land the open PR if it's green. If it's red, fix it first.
2. Read `complaints.md` under **The phone**, and every **For Account 4** section in the other loop files (`audit-loop.md`, `features-loop.md`, `maintenance-loop.md`). Those come first, ahead of section 4's order.
3. Fetch the newest pictures (section 2, step 6), look at them all, and take the next item from section 4.

## 1. What you're working with (facts, checked Nov 14)

- **No Swift here.** This container has no `swift` or `xcodebuild`. The only compiler is CI's Mac job: `.github/workflows/apple-client.yml` › **build-and-test**. It builds the package for macOS and iOS, runs `swift test`, builds the iPhone app three ways (plain, with the widget, signed), and **fails on any compiler warning**. It runs only when the PR touches `apple-client/**`, `mobile/**`, `internal/finance/**` or the payee-logo files.
- **Reading a red Mac job:** `get_job_logs` with `return_content: false` gives a URL. Run `curl` on it and `grep -n "error:\|warning:"`.
- **Swift 6, strict concurrency.** What compiles first time:
  - plain `Sendable` structs;
  - `@MainActor @Observable` stores;
  - no new statics on a `View`. A static helper a test calls must be `nonisolated`; better, put it on a model type;
  - iOS-only APIs (camera, haptics, `UIApplication`) inside `#if os(iOS)`, because the package also builds for macOS.
- **`UNUserNotificationCenter.current()` crashes `swift test`** (no app bundle). Anything a test can reach must check `PrivateReminders.canNotify` first.
- **The pictures:**
  - The **screenshots** job builds with the `SCREENSHOTS` flag (`Shared/Screenshots/ScreenshotMode.swift`, data from `apple-client/Screenshots/data.json`). It launches `-shot <name>` for each name in its `shots=` list, in light and dark, plus `large-*` at the largest text size and `light-finances-hidden`.
  - The names the app knows are switched on in `DashboardView.swift` (around `ScreenshotMode.shot`) and `FinancesView.swift` (around line 3735).
  - A PR's pictures are an artifact this container **can't download** (its storage host is blocked), so **a PR takes only the iPhone's 47** (a screen that won't open still fails it). **Main takes all 94**, the iPad's too (the owner, Nov 14: "full set on main only").
  - **On main**, the iphone-docs-pictures job force-pushes 10 of them (half size, light and dark) to the **`iphone-screenshots` branch**, and this container **can** read that.
  - **Every picture, iPhone and iPad, at half size, is in `review/`** there (beside `docs/images`, so CONTRIBUTING's checkout never takes it), since item 0 (Nov 14): `<look>-<shot>.png`, `large-<shot>.png`, `ipad-<look>-<shot>.png`, `ipad-large-<shot>.png`.
- **Measuring contrast from a picture** (Pillow is here): crop the button with `Image.open(p).convert('RGB').crop(box)`, take the most common colour as the background and the colour farthest from it as the text, then apply the WCAG ratio. The pictures are half size, so a box is in half-size pixels.
- **The app's look** (the owner's choice): a plain iPhone app, with the system's large titles, lists and tab bar, SF Pro, light and dark, and a violet accent. `Shared/Views/Theme.swift` holds the colours: warm canvas `#F5F4F2`, white cards, violet `#6A4FF0`, calm status colours at 4.5:1. `Shared/Views/Design.swift` holds the pieces: `.card()`, `LogoCircle`, `RoundActionButton`, `WalletCard`, `ProgressRing`, `DotPill`. Reuse these pieces; don't invent new ones. Mocks for the owner have to look like the app (the owner, Nov 12: "every time it is less like the iPhone app"). Read the view you're changing first and use its exact words.
- **The size:** about 11,700 lines of views (`Shared/Views/`), 29 test files. `FinancesView.swift` is the largest; grep before you read.
- **What's on the iPhone and iPad and what isn't:** `docs/Parity.md`. Its **Gaps** list at the bottom is the feature backlog.
- **The payee logos** are the computer's own. After a change in `web/src/finances/payees.ts` or `logos.ts`, run `node apple-client/scripts/make-payee-logos.mjs` (CI checks it with `--check`), and mirror the change in `PayeeLogos.swift`.
- **Private Finances** (a member's sealed Finances) are `private-finances.md`'s. Read it in full before touching `PrivateFinances*.swift`, `PrivateSeal`, `PrivateOffline` or `PrivateReminders`.

## 2. One round (about 1½ hours of CI; write the next round while it runs)

1. **Look:** fetch the pictures (step 6) and open each one with Read. Write down what's off, in the owner's terms: cut off, crowded, unclear words, wrong colour in dark mode, a tap target too small, an empty space, a number that doesn't line up, different from its sibling screen.
2. **Pick** the worst few that touch the same files. Batch a screen's fixes into one PR; split two screens into two PRs.
3. **Test:** a Swift Testing case for anything with logic (words, sorting, what shows when). For pure layout, name the picture it fixes.
4. **Change**, then read your diff once more as the compiler would: missing `import`, `Sendable`, actor isolation, `#if os(iOS)`, a name used before it exists, an unused variable (a warning, so red).
5. **Push and open the PR:**
   - Template headings: Summary, Safety impact, Validation, Notes, with "Try this tonight".
   - Run `subscribe_pr_activity`, then one `send_later` at 50 minutes.
   - If it goes red, read the log (section 1) and fix. One re-run at most for anything that looks like GitHub's fault.
6. **Green: merge.** Then wait for main's Apple client run (it photographs after build-and-test), and fetch:
   ```bash
   d=<scratchpad>/shots && mkdir -p "$d" && git fetch -q --depth=1 origin iphone-screenshots && git --work-tree="$d" checkout FETCH_HEAD -- review && git reset -q review
   ```
   Check that `git log -1 --format=%cd FETCH_HEAD` is after your merge, then Read the PNGs in `$d/review` (never under the repo: the pictures stay out of commits). Compare each with what you meant. Anything still off goes first in the next round.

## 3. Where it stands

- **Merged Nov 14:** #694 at 12:14 PM Eastern (this file, item 0: the iPad's pictures on main, and lane 1's last two web fixes), and #695 at 12:31 PM (round 1 of item 1: `ClockWords`, `TransferWords`, Spending's *+$X on Sep*, the `app` shot pushed as a tap; green on its first Mac compile).
- **The pictures:** #694's main run (started 12:13 PM) is the first full set, but at 12:31 PM `iphone-screenshots` still held only the 10 docs pictures (4:40 AM UTC, no `review/`). Read that run (`apple-client.yml` on main, 2743f2c) before anything else: if `review/` never came, the docs step is the cause (section 5, *No new pictures*). #695's main run follows it.
- **Open: round 2 of item 1, Finances home** (`LeftUntil` with `LeftUntilTests`, `LeftUntilCard` in `FinancesView.swift`; its first Mac compile). The first card reads *Left until Nov 19, after the bills* (the next paycheck's period's `left`, or now's with no paycheck ahead), with *Under your $500 cushion on Thu, Nov 5* or *Short $X on …* from the first period up to it that dips, and opens Bills. *After Alex's paycheck* stays under the Wallet card with *…, before its bills*. **First:** land it. If red, read the log (section 1).
- **Then:** fetch `review/` and look at every picture, the iPad's first (item 0's last step), and check rounds 1 and 2 show: Settings' times, a transfer's line, Spending's ring, the `app` picture's own title, Finances' first card. Then the rest of item 1's first look (Status's *⋯ All of These*, Backups' dark accent), then the screen order.
- **Not yet tried on the owner's iPhone and iPad** (each needs the cable re-install, once covers all): rounds 1 and 2 (#695 and the open one), the private Finances work in the app (#676, #678, #680, #683, #686, #688), and the earlier list in `handoff.md` section 4 (*Trying on the phone*). One re-install covers them all; don't ask again until the owner has done it.

## 4. The order (the owner's, Nov 14)

**0. The picture loop first (one PR, CI only, no app change). Written Nov 14 (the screenshots job's `Pick an iPad simulator` and `take()`, and `review/` in the docs step).** It lets each round see every screen on both devices:
- In the **screenshots** job, after the iPhone set, boot an iPad simulator. Pick the newest available `iPad Air 11-inch` or `iPad Pro 11-inch`, the same way as "Pick an iPhone simulator". Take the same `shots` in light and dark, plus `large-*`, named `ipad-<look>-<shot>.png`.
- In "The docs' pictures, at half size", keep the 10 docs pictures as they are, and also write **every** picture (iPhone and iPad, light, dark, large, hidden) to `review/` beside `docs/`, half size with `sips --resampleWidth`, which the `iphone-docs-pictures` job adds to the branch.
- **Not loosening CI:** the push still happens only from main, with the same token. Say so in the PR.
- After it merges, fetch the pictures and look at the iPad ones. If the split view's sidebar or detail column shows nothing for a shot, add what `ScreenshotMode` needs for the iPad (the selected screen in the sidebar and the first app in the detail column) as item 1's first PR.

**1. Look and feel, screen by screen.** Go through the pictures in this order: Status, an app's page, Backups, Finances home, Transactions, a transaction, Budgets, Bills, Recurring, Cash Flow, Month in Review, Accounts, Investments, Goals, Spending, Setup, Settings, Settings › everything, the lock screen.
- Check each on the iPhone and the iPad, light and dark, and at the largest text size.
- Fix what's cut off, crowded, unclear in words, off-colour in dark mode, too small to tap, or unlike its sibling screens.
- One screen (or two small ones) per PR. Name the pictures it fixes.
- Add a `-shot` name for any screen you change that has none (the Collection, a card, a loan, an account's page, private Finances locked).
- Done when a full pass over the pictures finds nothing you'd fix.

   **First look (Nov 14, from main's 10 iPhone pictures; check each again in the full set before fixing):**
   - *Settings:* **Quiet hours … 22-7** and **Daily at 04:00** are raw clock numbers. **Written** (`ClockWords`, `ClockWordsTests`; Settings, and Status's Updates tile): *10 PM to 7 AM*, *Every night at 4 AM*.
   - *An app's page:* the bar still says **Status**, with Status's **Apps** search field above the app. **This one is the picture, not the app:** the `app` shot laid the page over Status's list instead of opening it. Fixed with the ClockWords PR (the shot now pushes the page as a tap does). Check the new picture has the app's own title.
   - *Finances home:* the same problem as the web's task 15 item 2. The big card is checking **now**; *After Alex's paycheck* comes next; **Left to spend**, the number people want, is below the fold. Put what's left first, in words (*Left until …*), as the web does once item 2 lands. **Written Nov 14** (`LeftUntil`, round 2), ahead of the web's item 2: say so to lane 1 if the web picks other words.
   - *Transactions:* a transfer's second line is cut off (*Chase Checking →…*). **Written with the ClockWords PR** (`TransferWords`: *From Chase Checking* under *Roth IRA*).
   - *Spending:* the ring's red **+$1,021** said nothing about what it's compared to. **Written:** *+$1,021 on Sep*, the month review's own words.
   - *Status:* each folded group's **⋯ All of These** reads vaguely for a menu of actions on the whole group. Look at it in the full set: *Start All*, *Restart All*, or the group's name (*All of Network*)?
   - *Backups, dark:* **measured Nov 14:** **Back Up Now** is white on violet `(140,123,255)`, 3.3:1; **Test a Restore** is violet on `(57,51,93)`, 3.7:1. Both pass 3:1 for large bold text, not the README's 4.5:1. The fix is the dark accent (`Theme.swift`), which every button shares. Look at every dark picture before changing it, and check each colour pair again after.

**2. The missing Finances pieces** (`docs/Parity.md` gap 5). Each is its own PR, with a failing test first. Mock it first only where it's a new screen. In this order:
- add a payment, then a goal;
- select transactions together (delete, one category, Move to…);
- a running balance for one account;
- change or delete a buy on Investments;
- Export;
- import a bank file and Rules (the largest; split it).

**3. The iPad made for the iPad** (Parity gap 9 and more):
- layouts that use the width: two columns where the iPhone stacks, and Finances' pages side by side with a list;
- every screen's actions as keyboard shortcuts;
- a command palette on ⌘K;
- pointer hover on rows;
- Stage Manager sizes, where a split view becomes compact.

Mock the palette and any new layout for the owner first (a private canvas, made-up data, the app's exact look).

**4. The missing phone features** (Parity gap 7): memory and processor per app, disk per app, Explain these logs. Each needs a new read-only phone call on the computer first (rule 7), then the app's view.

## 5. When something's stuck

| Sign | Cause | Do |
|---|---|---|
| `error:` in build-and-test | the first compile of new Swift | Read the log (section 1), fix, push. Swift 6 concurrency is the usual cause |
| `warning:` makes it red | a warning is an error here | Fix the warning. Never silence the check |
| `Failed to CreateArtifact … Unexpected token '<'` | GitHub's artifact service | Re-run that job once |
| A check says in progress long after its log ended | GitHub lag | Read the job's log before calling it stuck |
| No new pictures on `iphone-screenshots` | main's run was skipped (no app path changed) or the screenshots job failed | Read main's Apple client run |
| **screenshots** says *cancelled* after its pictures uploaded | its `timeout-minutes` (80 since Nov 14; main's run, both devices, takes about 45) | Read the log's times; if a new shot pushed it over, raise the limit in the same PR and say why |
| A picture is plain white or black | the app was still opening | Re-take it in the next run; the job already waits once |
