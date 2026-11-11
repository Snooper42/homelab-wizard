# One session for everything: Tidy Up, Finances, and the iPhone app (Nov 11, 2026)

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

## 1. Where it stands (Nov 11, 1:00 PM Eastern)

**Merged Nov 10 and 11** (each green):

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

**In flight:** nothing open. The owner said "continue" (Nov 11) without picking from the list; this session took the recommendation, **Alerts in the app** (section 2). Its first PR carries this file.

**Dropped, with the owner told:** ⌘1 to ⌘4 for Finances tabs; syncing the Finances sidebar's folds.

## 2. Alerts in the app (the pick), in PRs

`unison-handoff.md` section 4, item 6. **Today:** the phones and the app read `Alerts` (`core.RecentAlerts`): what ntfy kept on the alert topics (12 hours), less what cleared (`core.Current`). Nothing remembers an alert past ntfy's 12 hours, when it cleared, or who snoozed it. Every alert goes through one function, `(*homelab).alert` in `cmd/homelab/jobs.go`; the watchdog's down and recovered alerts are at the end of its run there (`core.DownTitle`, "Homelab: recovered"); snoozes are `notify.SnoozeHours` (from `app.SnoozeCheck`, the phone's `SnoozeCheck` in `cmd/homelab/serve.go`, and `homelab notify snooze`).

1. **The computer keeps every alert** (desktop PR, carries this file).
   - *Where:* `internal/history` gains a second table (migration 2, `alerts`: at, topic, title, body, priority, checks, cleared_at, snoozed_until, snoozed_by), with `AddAlert`, `ClearAlerts` (a down alert is cleared when none of its checks still fail), `SnoozeAlert` (the newest open alert naming that check: until when, and who), `Alerts` (newest first, 30 days, at most 200), trimmed to 90 days like the actions. `alert()` records every alert, before it looks for ntfy's token (the record is the computer's, set up or not). The watchdog's recovered names clear their alerts. Each snooze records who (this computer, the phone's name, the command line).
   - **Money never goes in:** Finances' reminders and the weekly summary can carry amounts, in their titles too. `notify.Message` gets a field for the line the record keeps instead (*A Finances reminder*, *The weekly summary*); the record never holds their title or body.
   - *Shown:* a look-only companion call `AlertLog` (contract JSON updated, `computer.calls`), the app's `AlertLog` binding, and on Status's alerts card, on the computer and the phone's page, **Every alert…**: a sheet listing them, each with *Cleared at 3:12 AM* or *Snoozed by Alex's iPhone until 9 PM*.
   - *Fixed looks like:* an alert from yesterday morning still listed today, with when it cleared.
   - *Tests that fail today:* `internal/history` (`TestAlertsKept`, `TestAlertCleared`, `TestAlertSnoozedBy`, `TestAlertsTrimmed`); `cmd/homelab` (`alert()` records even without ntfy's token; a Finances reminder is kept as its plain line, no amount; a phone's `AlertLog` is a read, refused to no device); a smoke case for **Every alert…** on the computer and the phone's page.
2. **The iPhone's Recent Alerts page** (iPhone PR). *Where:* the alerts card in `StatusCardsView.swift` opens a page reading `AlertLog` (`APIClient.alertLog`), only where `computer.calls` lists it; each row with its time, cleared or snoozed (by whom, until when), and Snooze… on an open one (the same `SnoozeMenu`, Face ID). *Test that fails today:* Swift decoding the contract's `AlertLog` sample, and the row's words for cleared, snoozed and open.
3. **Notifications from the Homelab app, and who notifies** (desktop + iPhone; **ask the owner first**). Local notifications while the app runs, from the live events the phone already reads (a new alert), and from background refresh (best effort). A setting chooses whether the ntfy app or this app notifies, never both. **The question:** ntfy can't be muted per phone from here, so "this app notifies" either means the household stops sending to ntfy (the partner's phone too, if it relies on ntfy) or each person unsubscribes in the ntfy app. Recommend per phone: the setting on the iPhone, with one line saying to turn the ntfy app's notifications off. Push (APNs) stays behind `HOMELAB_SIGNED`.

**Next time, offer** (recommended first): **a check of every feature on the computer, the phone's page, the iPhone and the iPad, with the gaps** (the owner asked about parity on Nov 11 and was offered it); Finances imports round 3 (a screenshot of rows still wrong, described in shapes); Finances Steps 4 to 6 (`finances-handoff.md` section 3, mock each first); Tidy Up queue item 7, then the look (L3 to L7); an independent security review of #556 to the alerts work, in a session of its own (launcher below); rules, deeper (a rule that links a payee to a planned bill; by amount or direction), each needing a yes.

## 3. Once the owner picks: hand on before you build

Before the first line of the chosen work, rewrite **this file** for it, in the same shape, and commit it in that work's first PR:

- **Header and section 0** stay (update a rule only when the owner changed it).
- **Section 1:** what merged since, one table row per PR or group; what's in flight, in order, each with its PR number, branch or commits, and what "done" is.
- **Section 2:** the owner's pick, broken into small PRs in order, each with *where in the code*, *what fixed looks like*, and *the test that fails today*. Then what's left to offer next time, with one recommended.
- **Section 4** (waiting on the owner) and **section 6** (lessons) brought up to date.
- **The launcher** at the bottom, one line, updated.

Keep it the hub: detail belongs in the loop file for that area (`finances-handoff.md`, `tidy-loop.md`, `unison-handoff.md`); link to it. Rewrite this file again whenever the session nears its end, so the next one starts from GitHub alone.

## 4. Waiting on the owner

- **Alerts, PR 3's question** (section 2): who notifies, per phone or for the household.
- **Investments (#558):** they press **Read now** and confirm the share counts; then move its complaint in `complaints.md` to **Done**.
- **Imports:** a second look later (they said "closer to being correct", Nov 11); a screenshot of what still looks off.
- **"After <name>'s paycheck"** against their spreadsheet (`finances-handoff.md` section 2, item 1): which row still differs.
- **Amex rows:** whether purchases show as minus and the account's kind is Credit card.
- **Trying on the phone:** #576, #588 and #590 need the cable re-install (`git pull`, then `apple-client/scripts/run-on-iphone.sh <prefix>` after updating the computer). The App Group test: `HOMELAB_WIDGET=1` with the same script.
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
- **A flaky smoke case is a bug until shown otherwise:** the one on Nov 11 was a real race in `Sheet.tsx` (typing right as a sheet opened), fixed at its source in #590 with a case that reproduced it every time.
- `go build ./cmd/homelab` fails in the repo root (a `homelab` script is there): use `-o /dev/null`. A merged PR's branch is deleted on GitHub: start the next from fresh `origin/main`.

## Launchers (paste one into a new session)

The work, in this file's order (carries on with Alerts in the app, section 2):

    Read .claude/prompts/handoff.md and follow it: carry on with section 2's Alerts in the app, one PR at a time from where section 1 says it stands, asking me PR 3's question before building it. Merge each PR as soon as it's green.

The independent security review, in a session of its own (not at the same time as the other):

    Read .claude/prompts/audit-loop.md and follow it, against what merged from #556 onwards: the phone's change calls (SetStatusFolds, SnoozeCheck), home only (#559 to #562), Finances rules (#584, #585), imports, and the alert record (internal/history's alerts table, AlertLog). Write each finding with a test that fails without its fix, and fix the real ones.
