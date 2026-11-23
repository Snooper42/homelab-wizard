# Lanes: who does what, and how every loop works

The owner's, Nov 23, 2026. Every session of every loop reads this file first, then its own loop file, then `owner.md`. **Nothing else in `.claude/prompts/` is read:** the other files are history, and each says so at its top (a loop file may point at a named section of one; read only that section). Where this file and a loop file disagree, this file wins. Only the owner changes this file.

## The goal

The owner, Nov 23: *"Lately it feels like you just work and work for super long yet nothing happens or works in the app."* So a merged pull request must change something the owner sees or uses on their own machine, or fix a failure, lost data, or a security hole. No rounds of word polish. No bookkeeping commits. The target for how the app looks is `docs/Redesign.md` and its pictures.

## Which account runs what

Three accounts, each with its own usage and lifetime (the owner, Nov 23). **Every session works out its lane from this table and the time now, in ET.** Its start line says which account it is. A lane change at a time below happens by itself: the next session starts the new lane.

| Account | Its usage | From, to (ET) | Lane | Pace |
|---|---|---|---|---|
| **C, the fresh one** (ends after a week: assumed Mon Nov 30, noon; the owner corrects it here if not) | a week from Mon Nov 23 | now, to Tue Nov 24, 9 PM | **S**, `setup-loop.md` | Steady |
| | | Tue Nov 24, 9 PM, to Thu Nov 26, 2 PM | **Q**, `quality-loop.md`: reviews first in every session | Steady |
| | | Thu Nov 26, 2 PM, to Mon Nov 30, 10 AM | **R**, taking over from account A, with Q's reviews first in every session | Flat out from Sat Nov 28 (what's left is lost). Start nothing new after Mon 10 AM; leave the open pull request with a clear **Next** for account B |
| **A, the trial** (ends Thu Nov 26, afternoon) | resets Tue Nov 24, 9 PM | Tue Nov 24, 9 PM, to Thu Nov 26, noon | **R**, `redesign-loop.md` | Flat out (what's left is lost). Start nothing new after Thu 10 AM; leave the open pull request with a clear **Next** for account C |
| **B, the owner's own** (the only one that lasts) | resets Wed Nov 25, 9 PM, and weekly after | Wed Nov 25, 9 PM, to Mon Nov 30, 10 AM | **M**, `money-loop.md` | Steady |
| | | from Mon Nov 30, 10 AM | **All, alone:** in each session, anything broken first, then the reviews it would have asked Q for (go through *A review, step by step* yourself and ask the owner, rule 6), then alternately the next item of `money-loop.md` and of `redesign-loop.md`, then `quality-loop.md`'s list when both are done | Steady |

**Start lines** (the owner pastes one once per account; it's also each account's scheduled task's prompt). Account C's is:

    Run: git fetch origin main && git fetch origin claude/vibrant-mayer-jiim8w:refs/remotes/origin/plan. Read .claude/prompts/lanes.md from origin/main if it has the section "Which account runs what", else from origin/plan (git show origin/plan:.claude/prompts/lanes.md), and follow it as account C.

Accounts A and B use the same line, with `A` or `B` at the end.

**Pace:** *Flat out* means take the next item straight away, until usage runs out. *Steady* means the same, but stop for the session after three merged pull requests. A session can't see its usage meter, so the pace is what keeps an account going all week.

| Lane | Loop file | Branches | Owns |
|---|---|---|---|
| **R, Redesign** | `redesign-loop.md` | `claude/redesign-*` | How every screen looks and is laid out: `web/src` screens, parts and components (not the data under them), `web/dist/index.html`, `web/dist/style.css`, its smoke cases in `app/preview/shoot.mjs`, `docs/images/app-*.png` (it alone runs `make screenshots`), `app/preview/redesign/`, `docs/Redesign.md`, `docs/Tour.md`. Later the iPhone app, `apple-client/` (its item P1) |
| **M, Money** | `money-loop.md` | `claude/money-*` | What Finances does: `internal/finance`, `internal/sitelogo`, `internal/cardprice`, `app/finance*.go`, `cmd/homelab`'s finance and person commands, `mobile/finance`, and in `web/src/finances` the data side: `model.ts`, `importData.ts`, `payees.ts`, `guessCategory.ts`, `logos.ts`, `sites.ts`, `money.ts`, `privacy.ts`, `seal.ts`, the preview data (`app/preview/finance.json`, `ledger.json`), and the Swift ports the phone's import is tested against |
| **Q, Quality** | `quality-loop.md` | `claude/quality-*` | Security and privacy, reviews of the other lanes' risky pull requests, what's broken on the owner's real machine, CI and the nightly run, media automation (`compose/media-automation.yaml`, `internal/wiring`, `internal/downloads`, `services/media automation/`), the backups' engine for R's new Backups parts, and every other Go package |

**Paused:** lane Q (above), and the iPhone app's own loop (`apple-loop.md`), until lane R reaches its item P1. Tidy Up's, Finances' and the old lanes 1 to 5 loops are history.

**Where R and M meet (`web/src/finances`):** R changes layout, styling and which component goes where; M changes data, the model, the import, new fields and the Go bindings. A change that needs both: M ships the data first (with the plainest UI that works, or none), and adds a line under **From the other lanes** in `redesign-loop.md` saying what R can now lay out. R never invents a number the data doesn't have: it leaves that part out and adds a line under **From the other lanes** in `money-loop.md`.

## Every session, step by step

1. **Your lane, and your name.** Find your account's row in *Which account runs what* for the time now, and read that lane's loop file. `get_session` for your ID, then `set_session_title` to `Account <X>: <lane>` (for example `Account A: Redesign`). Outside every row of your account, end, saying so.
2. **One at a time.** `list_sessions` (`mine: true`): if another session of your account is `working` and was updated in the last 30 minutes, end now; it's still going. A session woken later by a pull request's event does this check first too, and ends without acting if a newer session of its account exists.
3. **Paused?** If your loop file says **Paused: yes**, end, saying so.
4. **The repository.** If it isn't in this session, `add_repo` (`Snooper42`, `homelab-wizard`, access `push`), clone it, and `register_repo_root`.
5. **Keep yourself running.** `list_triggers`: if none is named `Homelab loop, account <X>`, `create_trigger` one: `cron_expression` `0 */3 * * *` for account A and `0 */5 * * *` for B and C; `create_new_session_on_fire: true`; `initiation: human_request` (the owner asked for it, Nov 23); `notifications: {push: true}`; and your account's start line as its prompt. Say in your first report that you made it.
6. **Catch up.** `git fetch origin main`. Read `owner.md`: an answer to one of your questions, or a line under **Doesn't work or bugs me** in your area, comes before your list.
7. **Your open pull request first.** You have at most one, and two only while one waits for Q's review (rule 6) and the second touches none of its files. Green: merge it (rule 5). Red: fix it before anything else. CI still running: `subscribe_pr_activity` and end your turn; its result wakes you.
8. **The next item.** The first unticked item in your loop file whose files no other lane's open pull request touches (rule 2). Too big for one pull request: split it, and write the split into the loop file.
9. **Build it.** Read the code you'll change (only that). A failing test first, then the change. Run the checks for what you changed (rule 7). For a screen, pictures in light and dark at 1280px and the phone's width.
10. **Open the pull request** (rule 8), then go straight on: step 7 again. Keep going until your usage runs out. Never stop to ask; rule 4 says how to ask without stopping.

Where you stopped needs no separate note: it's your open pull request (its branch and its description's **Next**), or, with none open, the loop file's ticks on main. **Never commit to main directly** and never make a commit that only records progress.

## Rules that never bend

1. **Your branches only.** Never push to, merge, close or rebase another lane's branch or pull request. Lane Q may comment on another lane's pull request to review it (rule 6), and only that.
2. **A file belongs to whoever has an open pull request on it.** Before you branch and before each push, list the other open pull requests' files (`list_pull_requests`, then `pull_request_read` with its files). If yours would touch one, take your next item. Rule 3's files are the only exception.
3. **Shared files,** which two open pull requests may both change, each adding its own lines, both kept on a conflict:
   - `CHANGELOG.md`: one line per pull request, directly below the *Everything else (the other lanes)* marker in its `[Unreleased]` section (New, Improved or Fixed); an `apple-client/` change below *The iPhone and iPad app (lane 4)*. Never move or delete a marker.
   - `web/dist/app.js`: never merged by hand. After merging main in, `make frontend` and commit what it builds.
   - `coverage-floors.txt`, `docs/Testing.md`, `app/preview/shoot.mjs`, `app/preview/mock.js`: add only.
   - A line under **From the other lanes** in another lane's loop file, and a question in `owner.md`.
4. **Asking the owner, without stopping.** Only for a choice that's genuinely theirs: money or data leaving the house, a security choice, deleting anything, spending money, or a screen that departs from its picture in `docs/Redesign.md`. Write the question in `owner.md` under **Waiting on you** (the question, two to four options, the one you recommend, and what you're doing meanwhile), in your open pull request. Send it with `PushNotification` if you have it, in one or two lines. Then carry on with your next item. Read the answer in `owner.md` when it's there; never ask the same thing twice.
5. **Merging.** Squash-merge with `expectedHeadSha` pinned to the head CI passed on, when every check on that head is green and every commit main gained since then touches none of its files (a newer `CHANGELOG.md` line doesn't count if main merges in cleanly). Otherwise merge main in and let CI run again. **No daily cap.** Several green at once: Q's first, then M's, then R's. Never merge on red; never skip, weaken or delete a test or a check to get green; change an expected value only after proving the new one is right. A check that fails for a reason outside your change (a flaky Windows test): run that job once more, and if it fails again, say so in `owner.md` and in `quality-loop.md`'s **From the other lanes**.
6. **Q reviews the risky ones first.** A pull request that adds a host the homelab calls, stores a new secret, opens a port or a listener, changes what a phone may call (`cmd/homelab/serve.go`'s `phoneMethods`), touches pairing, sign-in or the private Finances' seal, or sends anything off the machine says so in the first line of its description: **Needs Q's review: yes**, and why. It doesn't merge until lane Q has commented **Q review: OK** on its current head. **When no account runs lane Q,** go through `quality-loop.md`'s *A review, step by step* yourself. Write what you found in the description, ask the owner in `owner.md` (rule 4), and merge only on their yes. Meanwhile its lane works on something else (step 7).
7. **The checks, for what you changed:** Go: `make check` and `make coverage` (keep `coverage-floors.txt`), and `cd app && go test ./...` when the app's bindings change. Frontend: `make frontend` (commit `web/dist`), `make frontend-check`, `make app-smoke`. Docs: `go run ./cmd/homelab --root . validate`. The iPhone app: its own CI on the pull request. While you work, run only the narrow tests; run the full set once before you push.
8. **A pull request.** One item. Its title is a plain sentence about what the household gets (see `git log`). Its description: what changed and why; **Try this tonight**, three to five clicks the owner can do on their own machine with what each should show; before and after pictures for a screen; the checks you ran; **Next**. In the same pull request: tick the item in your loop file, a line in `CHANGELOG.md` (rule 3), and the docs the change touches. End the description with the attribution lines the session gives you.
9. **Secrets stay secret.** Keys, tokens and passwords go in `.env` (0600, ADR-0011) and nowhere else: never in a log, a link, an alert, a page, a pull request, a test fixture or a loop file. A new one goes in `.env.example` with a comment saying where it comes from, and in the redaction phones, alerts and reports get.
10. **Old files keep loading.** A new field in `data/finance.json` or any record is optional, with a safe default and a test loading a file without it. Never rename or drop a field.
11. **MoneyMatter is AGPL-3.0; this repository is MIT.** Take its ideas and behaviour only. Never copy its code, words or images.
12. **Words.** The house style: short, plain English about what the household gets, no code names on a screen (`app/preview/words.mjs` checks some). Sentence case on both systems. Times for the owner in ET, never UTC. No model name in a commit, a pull request or a file.
13. **Never without the owner's yes** (rule 4): weaken a security choice, delete a branch or data, move files on the media drive, loosen CI, spend money, publish anything to the internet, or turn on by default anything that sends data off the machine.
14. **Spend usage on the work.** Read only the code you'll change and the sections you're pointed at; search with `rg` rather than reading whole files; keep command output short (`| tail`); don't redraw every picture until the item is done.
