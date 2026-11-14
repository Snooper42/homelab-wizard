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
  - A PR's pictures are an artifact this container **can't download** (its storage host is blocked).
  - **On main**, the iphone-docs-pictures job force-pushes 10 of them (half size, light and dark) to the **`iphone-screenshots` branch**, and this container **can** read that.
  - **Every picture, iPhone and iPad, at half size, is in `review/`** there (beside `docs/images`, so CONTRIBUTING's checkout never takes it), since item 0 (Nov 14): `<look>-<shot>.png`, `large-<shot>.png`, `ipad-<look>-<shot>.png`, `ipad-large-<shot>.png`.
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

- **Nov 14:** this file written (the owner's picks: no merge cap for this lane, and the order in section 4), in one PR with item 0's CI change and lane 1's last two web fixes (Finances task 15, items 3 and 4). **Next:** once it's merged and main's Apple client run is done, fetch the pictures. `review/` should hold about 100: the iPhone's, then `ipad-*`. Look at the iPad ones first (item 0's last step), then start item 1.
- **Not yet tried on the owner's iPhone and iPad** (each needs the cable re-install, once covers all): the private Finances work in the app (#676, #678, #680, #683, #686, #688), and the earlier list in `handoff.md` section 4 (*Trying on the phone*). One re-install covers them all; don't ask again until the owner has done it.

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
   - *Settings:* **Quiet hours … 22-7** and **Daily at 04:00** are raw clock numbers. Make them the phone's own time words (*10 PM to 7 AM*, *Every night at 4 AM*), in a test of the words.
   - *An app's page:* the bar still says **Status**, with Status's **Apps** search field above the app. The app's page should have its own title (or none) and no search.
   - *Finances home:* the same problem as the web's task 15 item 2. The big card is checking **now**; *After Alex's paycheck* comes next; **Left to spend**, the number people want, is below the fold. Put what's left first, in words (*Left until …*), as the web does once item 2 lands.
   - *Transactions:* a transfer's second line is cut off (*Chase Checking →…*). Give it two lines, or *To Roth IRA*.
   - *Backups, dark:* **Test a Restore** (violet text on dark violet) reads weaker than **Back Up Now**. Check it at 4.5:1.

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
| A picture is plain white or black | the app was still opening | Re-take it in the next run; the job already waits once |
