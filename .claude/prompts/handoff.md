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

## 1. Where it stands (Nov 11, 5:00 PM Eastern)

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
| #591 | Alerts PR 1: **the computer keeps every alert** (`internal/history`'s `alerts`, 90 days), when it cleared and who snoozed it, never an amount; `AlertLog`; **Every alert…** on Status's Recent alerts, on the computer and the phone's page |
| #592 | Alerts PR 2: **the iPhone's Every Alert page** (`AlertLogView`, `KeptAlert`; the contract's `alertLog` sample) |
| #593 | Alerts PR 3: **Alerts From** on the iPhone (the ntfy app or this app, per phone; this app notifies while it's open) |
| #594 | The hand-off after Alerts in the app |

**In flight:** nothing open. **Alerts in the app is done.** Background refresh was **dropped by the owner (Nov 11: "I'm okay with no backgrounds")**: the pairing stays readable only while the phone is unlocked (`KeychainManager.swift`), and a locked phone hears from the ntfy app until push (APNs, behind `HOMELAB_SIGNED`). Don't offer it again.

**Dropped, with the owner told:** ⌘1 to ⌘4 for Finances tabs; syncing the Finances sidebar's folds.

## 2. The owner's pick (Nov 11): all of it, in this order

The owner asked for "a handoff to do all this": the feature check first (recommended), then the rest of the list. One PR at a time; ask where a step says so. What Alerts in the app built is in `unison-handoff.md` section 4, item 6, and #591 to #593.

### 2A. The feature check: every feature, everywhere (first)

The owner asked (Nov 11) whether every version on each platform has the same features. The answer then was "mostly, not entirely", from `apple-client/README.md`'s table alone. This makes it definite.

1. **The map** (docs PR, with its test).
   - *Where:* a new `docs/Parity.md`: one table, a row per feature (group them as the computer's sidebar does: Status, an app's page, Backups, Finances, Tidy Up, Setup, Settings, Choose apps, then alerts, links, widgets, keyboard), and a column each for **the computer** (one column; a note where Mac, Windows or Linux differ), **the phone's page** (the companion in a browser), **the iPhone app**, **the iPad**, and **the Homelab app on the Mac** where it differs from the iPad. Each cell: *yes*, *partly* (what's missing), *on purpose* (why: a phone can't install apps, a wall screen only looks, away from home only looks), or *gap*.
   - *Read, don't trust descriptions:* the computer's screens (`web/src/screens/*.ts` and what they mount); the phone's page is the same bundle under `html.companion`, so a feature is there only if its calls are in `phoneMethods` (`cmd/homelab/serve.go`) and CSS doesn't hide it (`html.companion` and `.can-change` rules in `web/dist/style.css`); the iPhone and iPad from `apple-client/Shared/Views` and `apple-client/README.md`'s table ("Not yet" there is a gap); the computer per system from `docs/Host.md` (*The same on every system*) and `os-mac`/`os-windows`/`os-linux` in the CSS. Every **New** line in `CHANGELOG.md` since 0.17.0 should land in a row.
   - *Test that fails today:* `cmd/homelab` `TestParityNamesEveryPhoneCall`: every key of `phoneMethods` is named in `docs/Parity.md`, so a new phone call can't go unmapped. Mention the map in `CONTRIBUTING.md`'s every-PR list.
   - *Fixed looks like:* the owner can read one page and see what each device can and can't do, and why.
2. **Show the owner the gaps and ask which to close.** A short list in chat (or a private Artifact page): each gap in a line, what closing it takes (S, M, L), and one recommended order. Gaps already known: the iPad lacks **What was done** and **links into the app** (README says "Not yet"); **Snooze…** on an open row of Every Alert (the watchdog card has it); whether **Every Alert**'s link opens from the iPad and Mac split view's list; Tidy Up and Choose apps are the computer's only (on purpose for now; Tidy Up's questions on the phone are `unison-handoff.md` item 9).
3. **Each gap the owner picks: its own PR**, a failing test first (Swift Testing for the iPhone and iPad, smoke for the phone's page), and its row in `docs/Parity.md` changed to *yes* in the same PR.

### 2B. Then the rest, in this order

1. **Finances imports, round 3.** Ask the owner for a screenshot of rows that still look wrong (they said "closer to being correct", Nov 11). Describe them in shapes, never commit their merchants (section 0, rule 1). No screenshot: go to 2.
2. **Finances Steps 4 to 6** (`finances-handoff.md` section 3): one period picker the Dashboard follows, Dashboard cards that click through, the Transactions table. Mock each first and show the owner before building.
3. **Tidy Up:** queue item 7 ("Started yesterday at 3:04 AM"), then the look, L3 to L7 (`tidy-loop.md`).
4. **The rest of the iPhone plan** (`unison-handoff.md` section 4, items 7 onward: Send to my phone / Open on the computer, files in without an extension, Tidy Up's questions on the phone, scan a receipt, Spotlight), each item a desktop PR first where the computer needs something new. Item 11 (widget extras) waits on the App Group test (section 4).
5. **Rules, deeper:** a rule that links a payee to a planned bill; rules by amount or direction. Each needs the owner's yes first.
6. **An independent security review**, in **a session of its own** (launcher below), of #556 onwards. Tell the owner when 2A is done that it's a good moment to start it; never in this session.

## 3. Once the owner picks: hand on before you build

Before the first line of the chosen work, rewrite **this file** for it, in the same shape, and commit it in that work's first PR:

- **Header and section 0** stay (update a rule only when the owner changed it).
- **Section 1:** what merged since, one table row per PR or group; what's in flight, in order, each with its PR number, branch or commits, and what "done" is.
- **Section 2:** the owner's pick, broken into small PRs in order, each with *where in the code*, *what fixed looks like*, and *the test that fails today*. Then what's left to offer next time, with one recommended.
- **Section 4** (waiting on the owner) and **section 6** (lessons) brought up to date.
- **The launcher** at the bottom, one line, updated.

Keep it the hub: detail belongs in the loop file for that area (`finances-handoff.md`, `tidy-loop.md`, `unison-handoff.md`); link to it. Rewrite this file again whenever the session nears its end, so the next one starts from GitHub alone.

## 4. Waiting on the owner

- **Trying on the phone:** #576, #588, #590, #592 and #593 need the cable re-install (`git pull`, then `apple-client/scripts/run-on-iphone.sh <prefix>` after updating the computer): Every Alert under Recent Alerts, and Settings › **Alerts From**. **Who notifies** was taken as per phone (the recommendation) when they said "continue"; they can still say household. The App Group test: `HOMELAB_WIDGET=1` with the same script.
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
- `go build ./cmd/homelab` fails in the repo root (a `homelab` script is there): use `-o /dev/null`. A merged PR's branch is deleted on GitHub: start the next from fresh `origin/main`.

## Launchers (paste one into a new session)

The work, in this file's order (the feature check, then the rest of section 2):

    Read .claude/prompts/handoff.md and follow it: do section 2 in order, starting with the feature check (2A), asking me where it says to. Merge each PR as soon as it's green.

The independent security review, in a session of its own (not at the same time as the other):

    Read .claude/prompts/audit-loop.md and follow it, against what merged from #556 onwards: the phone's change calls (SetStatusFolds, SnoozeCheck), home only (#559 to #562), Finances rules (#584, #585), imports, the alert record (internal/history's alerts table, AlertLog, #591) and the iPhone's local notifications (#593). Write each finding with a test that fails without its fix, and fix the real ones.
