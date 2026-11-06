# Features: the build-out loop

The master prompt for a session that keeps building the [Feature Roadmap](<../../docs/Feature Roadmap.md>) on its own, one finished feature per round, each in its own pull request that it merges once CI is green. Start it from a Claude Code session of your own on this repository (a session another session started cannot run /loop), and send:

    /loop Read .claude/prompts/features-loop.md and do the next round.

With no interval, /loop paces itself. Each round re-reads this file, so to steer the loop, edit it, commit and push it to main, and the next round follows. The standing rules and the queue live here too, so the command stays one plain line (the app will not send a slash command followed by formatted text).

**Paused:** no. (Change this to **yes** and push to pause the loop: a round that reads yes merges nothing new, opens nothing new, says it is paused, and waits for the next round.)

---

## Standing rules

These come before everything below; where they disagree with a later section, these win.

- **State:** GitHub is the only source of truth: open PRs, remote branches, this file's order, the roadmap's *Built* marks. Never rely on a previous chat. Start each round with `git fetch origin`, a list of the open PRs, and `git ls-remote origin 'refs/heads/claude/*'`.
- **The three accounts:** `.claude/prompts/lanes.md` sets who owns what, how each lane claims files, and the order PRs merge in. Read it at the start of every round once it is on main; where it and this file disagree, it wins. You are Account 1, and you merge last when two lanes' PRs are green at once.
- **Lanes:** you own `claude/feature-*` branches and the roadmap's features. `claude/fix-*` is the maintenance account's lane, and the Library cleanup ("Tidy Up") branch belongs to its own session. Never push to, merge, or rebase a branch outside your lane. Library cleanup is not yours: leave its roadmap section and its files alone.
- **Merging:** maintenance (`claude/fix-*`) PRs go first; if one is green, don't race it. Before squash-merging, if main moved since your last CI run, merge main in and let CI run again. Always pin `expectedHeadSha`. Each merge is one release, so merge one PR at a time.
- **Hot files** (merging main into a branch):
  - `web/dist/*`: never hand-merge. Take either side, run `make frontend`, commit.
  - `CHANGELOG.md`: your lines go only under `## [Unreleased]`. After every merge, check none slid into a released version.
  - `app/preview/shoot.mjs` and `docs/Testing.md`: conflicts are both sides adding lines. Keep both.
  - `docs/Feature Roadmap.md` and this file: change only your own items.
- **Spend less:**
  - One feature per round. Work in the main checkout, no extra worktrees.
  - Locally, run only the Go tests and `SMOKE_ONLY` cases you touched. CI runs the rest.
  - Don't poll CI. Call `subscribe_pr_activity` on each PR you open and end the turn, or `ScheduleWakeup` at least 900 s.
  - Read files by line range. Don't re-read what is already in context. Keep PR bodies to the template.
  - Ask the owner only about real product decisions. Otherwise pick, and put it under **Decisions to look at**.
- **Save before you stop:** push before any long wait and at the end of every round. Nothing stays only in the container.
- **Waiting on CI:** after opening a PR, `subscribe_pr_activity` on it and one `send_later` check-in about 50 minutes out. When it merges, delete the check-in and unsubscribe. A check-in that finds main moved merges main in and re-arms; it never merges on a CI run older than main.
- **PR numbers:** pull requests and issues share one count, and other sessions take numbers too. Write `#PRn` in the docs until the PR exists; just before opening it, look at the newest PR *and* the newest issue, fill in the next number, and push that with the merge of main.
- **A long session hands off:** when the chat has grown long (a summary of earlier turns, or the owner asks), end it cleanly. Push every branch. Update **Open now** below on your next PR's branch. Delete your check-ins, unsubscribe from your PR, and tell the owner to start a fresh session with the one-line command at the top. Nothing else carries over: GitHub is the state.

## Open items first

The owner's rule (Nov 3, 2026): **every round begins by clearing what is still open, and nothing new starts until it is all cleared.** "Open" is anything GitHub shows unfinished:

- an open pull request in your lane;
- a remote `claude/feature-*` branch that main has not taken (`git ls-remote origin 'refs/heads/claude/*'`, then `git log origin/main..origin/<branch>`).

For each, oldest first, one at a time:

- **Its work is already on main** (every commit's change is in main, as after a squash-merge): nothing to ship. Tell the owner to delete the branch (your tools can't), and list it in your report until it is gone.
- **An open PR:** take it to merged, as **Each round** step 2 says (merge main in, fix the hot files, green, squash-merge with `expectedHeadSha` pinned).
- **A branch with work and no PR:**
  - merge main into it (never rebase a pushed branch);
  - finish what it started, with its CHANGELOG line, its failing-before proof, and *Built* in the roadmap;
  - open its PR, and take it to merged.
- **Stale, or half done beyond saving:** don't delete it. Ask the owner, once, in your report, and go on to the next open item.

The **one open pull request of yours at a time** rule still holds, so these go one by one. Only when the list is empty does **The order** go on. Re-check the list at the start of every round, since other sessions add to it.

**Open now** (Nov 6, 2026, 14:20 UTC):
- #463 *Weekly integrity check* (`claude/feature-weekly-check`): open. Take it to merged first.
- Then `claude/feature-tailnet-devices` (#PRn): *Tailnet devices*, built and pushed (Settings › Phones › Devices on your tailnet). Merge main in, fill its number, and open it.
- **Merging, the owner's call of Nov 5:** a PR of mine merges when its CI is green on its current head and every commit main gained since that run touches none of its files. A newer `CHANGELOG.md` line on main does not count, provided main merges in with no conflict there; `web/dist/*`, `docs/Testing.md` and every other file do. Otherwise merge main in and let CI run again. (Account 2 merges small PRs every half hour or so; under the old rule #430 re-ran four times.) Never force-push or rebase to make a head match.
- Nothing else is queued: every branch built ahead (shortcuts sheet, status aloud, home screen, offline status, phones expire, update window) is merged. After the tailnet devices, go on with the roadmap's S items: Security and privacy's *Two-step sign-in, nudged*, then Alerts' *Snooze an alert* and *Who hears what*.
- Not started, for later: *One alert for many* (the Alerts screen resolves an alert line by line, so one line for several apps needs more than an S); the menu bar's per-app submenu (`app/tray`, best tried on a Mac).
- Merged since Export (#405): #406, #409, #411, #413 to #420, #422, #423, #427, #428, #430, #435, #437, #438, #439, #445, #446, #447, #449, #450, #451, #452, #453, #455, #457, #458, #461.
- This session's container can run a real Docker Engine (`dockerd` as root; it doesn't survive a worker restart, so start it again). Use it to try what the Testing.md rows ask on Linux. Alpine's package host is blocked there, so a step that builds the dump helper fails; that is the network, not the homelab.

Still list what is open at the start of each round, as above: other sessions add to it.

**A Finances smoke case to watch:** *a logo picked on a transaction goes with its payee* failed twice on #393's CI (dark only) and passed on its third run; then once on #414's (Nov 5, dark only, waiting for `#finSheet` to be hidden after a Save: it has three such waits, so name each one's step before chasing it). Never on main or locally (24 of 24 runs, four at a time, on #414's head). Its cause is unknown. If it fails again, the FAIL line names the step it was waiting on: fix that cause; never widen its timeout.

**A Tidy Up smoke case to watch:** *Tidy Up: lyrics say what came of every song, and Overview counts only those still to ask* failed once on #439's CI (Nov 6, dark only): its first step, `page.click('#tidy .seg button:text-is("Overview")')`, gives the screen 5 s, and that run was early and under load. It passed on its re-run, and 6 of 6 locally. If it fails again, give that first click the time the screen needs (wait for `#tidy .seg` first), not a longer timeout.

**Tidy Up, by the owner's ask in this loop's session (Nov 3, 2026):** the owner asked this loop to polish Tidy Up, redesign it (round 5: Overview's *Needs your OK*, a genre ring with a dropdown, the drive, *Recently done* with Undo; a tab per library), and audit its engines on every system. Merged: #383, #384, #386, #387, #388, #389, #390, #393 (#391 folded into it): all five steps of the redesign and the audit are done. Left for the owner on real machines: docs/Testing.md's Tidy Up rows on the Mac, a Steam Deck with Calibre from Discover (whether its Flatpak can open the media drive; #391's and #393's notes), and Windows with Docker Desktop (#389). Tidy Up stays the owner's to ask for: don't add to it unasked.

**Nov 4, 2026, the owner's first real run of Tidy Up on their Mac** (in this loop's session, by their ask): #395 (⌘K) merged; then #396 (a job's reason, not *exit status 1*), #397 (Install ffmpeg: Homebrew or winget, else a pinned build), #398 (lyrics: a search when LRCLIB's exact record isn't there; songs it lacks remembered 30 days). All merged by Nov 4, 2026 (#399–#401 below, then #402: Start, Stop, and Restart run quietly, on the row):
- #399 `claude/feature-tidy-tdarr-signin`: Tidy Up signs in to Tdarr (a 401 with an empty key) and gives an idle node a worker (618 episodes sat in Tdarr's queue). Its Nightly `rebuild` job failed on lscr.io's rate limit (not this PR's; commented): re-run it once when the run ends.
- `claude/feature-update-newer-build`: a build installed by hand that's newer than the failed update's target counts as updated; Try again with nothing newer closes the line (the owner saw *The update stopped · no update is ready*).
- `claude/feature-tidy-genres-why`: a genre count with nothing to read says why, with **Add Jellyfin's API key** (Settings opens at it); *Jellyfin API key* and *Jellyfin port* named for any Jellyfin, not "in a container".

**ffmpeg's pins** (`internal/media/ffmpeg-pins.json`) are empty: this session's network can't reach the publishers. A Mac without Homebrew gets no Install until `go run ./internal/tools/ffmpegpins` runs where they're reachable (the owner can allow `ffmpeg.martin-riedl.de`, `github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com`, or run it on their Mac).

**The owner's own Mac, to finish by hand:** Jellyfin's API key (Settings › Jellyfin) for genres and refreshes, Navidrome's admin login (Settings › Navidrome) for lyrics' refresh, and a worker on Tdarr's node until #399 is in. Ask them what `~/Library/Caches/Homelab Wizard/update.log`'s `ERROR:` line said, for why the in-app update failed.

**The order** below is all built. Go on with the rest of the roadmap, S before M before L, sections in the roadmap's order. Reliability's S items are built (the update window's other half, *Vaultwarden at once on a security release*, stays an idea). Next is Security and privacy: *Phones that expire* is on its branch, then *Tailnet devices*, *What CrowdSec stopped*, and *Two-step sign-in, nudged*.

**Where the Finances loop left off** (its branch, `claude/homelab-finances-improvements-2v5ec9`, was deleted on Nov 3, 2026, with all its work already on main): its backlog in `.claude/prompts/finances-loop.md` is done up to F24 except F18 (export, item 10) and F19 (polish, a little each Finances round). Those are the Finances work still to do; tick each in that file too when it ships. When they are done, read that file's **MoneyMatter, redone** and backlog for anything still unstruck before adding new Finances items to the roadmap.

## Your job

You build out Homelab Wizard's features from [docs/Feature Roadmap.md](<../../docs/Feature Roadmap.md>), on your own, one finished feature per round, for as long as this loop runs. The owner asked for exactly this (November 2026): "on a loop in the background, always improving and pushing requests and merging". So never stop to ask. When a decision is theirs, take the most conservative choice that keeps the app working, write it under **Decisions to look at** in the PR, and carry on.

What the owner values, in their words: small, nuanced touches that set an app apart, "like the right-click settings drop-down I suggested". A right-click menu, an undo, a hover that answers a question, a menu that opens where you expect it. Make each feature feel native on the Mac first (the owner's machine, WebKit), and the same on Windows and Linux.

When the roadmap's list runs out, look the app over as a demanding user would (every screen, desktop and 860px and phone widths, light and dark, more contrast, the keyboard alone, VoiceOver's labels), write at least 10 new items into the roadmap in its sections, push them, and keep going.

## Sharing the repo

Each loop merges its own pull requests. The maintenance account works on `claude/fix-*` branches, the Library cleanup ("Tidy Up") has its own session, and the owner's own sessions also work here; see **Standing rules** for the lanes.

- **What is yours:** everything the roadmap covers except Library cleanup, the Finances screen included. The Finances loop is retired (the owner can no longer run it), and its unfinished items are in **The order** below. For a Finances round, read its file's **How Finances works** and **Rules that never bend** first (`.claude/prompts/finances-loop.md`) and keep to them: money stays on this machine, old `finance.json` files keep loading, logos only from simple-icons or selfh.st, and the preview data regenerated (`go test ./internal/finance -run TestPreview -update`). Each Finances round also does a little of item 19 (polish) on what it touched.
- **Never** touch `VERSION`, cut a release, or merge, close, or push to a pull request that is not yours.
- **One open pull request of yours at a time.** While its CI runs, you may start the next feature on a new branch from main; once the first is merged, merge main into the new branch (never rebase a pushed branch) before opening its PR.
- **Conflicts:** follow **Hot files** in the standing rules. Generated docs: run `./homelab docs`.
- **Main's CI red** for a reason that is not yours: note it in your PR. Fix it in a small PR of its own, merged the same way, only when the cause and the fix are clear; otherwise leave it for the owner.

## Each round

1. `git fetch origin`, list the open PRs, `git ls-remote origin 'refs/heads/claude/*'`, then `git checkout main && git pull`. Re-read this file; if **Paused** is yes, say so and stop the round. Clear **Open items first** before anything else.
2. **Your open pull request first**, if there is one: read its head's CI, its mergeability, and any review comments.
   - Green on every check and mergeable: squash-merge it with a title ending in its number (pin the head SHA), then tick its item in the roadmap (below) in the next PR.
   - Red: find out why. Yours: fix the cause and push. Not yours (red on main too): as **Sharing the repo** says. A job may be re-run once to tell a flaky runner from a real failure; a second failure is real.
   - Conflicting: merge main into it, regenerate what is generated, push.
   - Still running: carry on with step 3 on a new branch.
3. **The next feature**: the first item of **The order** below not yet built. Read the code it touches before changing it. Do it whole: a feature that is half there is not shipped.
4. **Tests that prove it:**
   - Go: a table test for new logic; the fake docker (`cmd/homelab/main_test.go`, `fakebin_test.go`) for anything that runs a command.
   - The app: a smoke case in `app/preview/shoot.mjs` for each new behaviour, in light and dark. Check it fails without your change (put back main's `web/dist/app.js` and `style.css`, run the case, restore), so it really tests something.
5. **Checks** (CONTRIBUTING.md has the full list): `make check`; `make coverage` when Go changes; `make frontend` then `make frontend-check` when the frontend changes; the smoke cases you touched and their neighbours (`SMOKE_ONLY="..." node app/preview/shoot.mjs --smoke`). Fix the cause of anything that fails.
6. **Words**: a line in `CHANGELOG.md` under Unreleased (**New**, **Improved**, or **Fixed**), in plain words about what the household gets. Update the docs the change touches (`docs/Testing.md` has a row for each screen's behaviour).
7. **The roadmap**: mark the item *Built* with its PR number, and add a row to **Built** at the top of `docs/Feature Roadmap.md`.
8. Commit on a branch named `claude/feature-<short-name>`, push, and open the PR (the repository's template). Its description: what it does, how it was tested (with the failing-before proof), and **Decisions to look at**.
9. Report in a few lines: what shipped, what merged, the checks, what's next. Then the next round.

## The order

Do these first, one per round, in this order: app rounds and Finances rounds take turns. Then the rest of the roadmap, S before M before L within each section, in the roadmap's order of sections. Leave *Mocked up* L items (the Memory screen) until the S and M ones are done. The Finances items keep their numbers from the Finances loop's backlog (F16 is its item 16); tick them in that file too.

1. **Stopped on purpose** and **Stop for a while**, together (they share one record). An app the owner stops from the group menu, its page, or (later) a row's menu is recorded as stopped by them, optionally until a time (an hour, tonight at 9 PM, tomorrow at 8 AM). Everything that starts apps by itself skips it: the group menu's Start the N stopped (`groupAct` in `web/src/screens/status.ts`, `GroupMenu` in `web/src/status/AppList.tsx`), the watchdog, the battery saver's resume (`cmd/homelab/battery.go`, `resumeOnPower` in the awake job), and starting apps that waited for a drive (`startFailed`). When the time comes it starts again (the awake job checks each minute). Its row says "Stopped by you" or "Stopped until 9 PM", with Start. The record lives in `data/` beside `battery.json`, so it survives restarts and is backed up.
2. **Hide amounts** (F16, with the roadmap's item): ⌘⇧H (Ctrl+Shift+H elsewhere) and a View menu item blur every money figure, the sidebar's balances and the phone included; kept between launches. With it, F16's wall-screen card for kiosk mode: the next payday, what is left after it, and the next 3 bills, shown with amounts hidden when they are.
3. **Right-click an app's row** on Status: Open, Open on a phone, Copy address, Restart, Stop, Stop for a while ▸, Logs, Back up now, Tell me if it stops. Shift+F10 and the context-menu key open it too. A right-click on a group's heading opens the group menu. Reuse `GroupMenu`'s menu: its styles and keyboard.
4. **Calendar, further ahead** (F20): the calendar reads only the chart's 93 days. Read payments past them from `View.Next` and `Plan.Dates` (no balance), so a yearly renewal shows in its month, a year ahead.
5. **Undo**: after Stop, Stop all, or Restart all, a note for 10 seconds: "Stopped 6 Media apps · Undo".
6. **Calendar, card charges** (F21, *Built*, #380): a bill charged to a card (From a card) moves no checking money, so it is not in Days' events. Show it on its day too, marked "on Chase Freedom", with the card's due day.
7. **A balance opens its own group** (*Built*, #379): a sidebar balance opens Net worth on that group's accounts (the click already passes the group: `mountBalances` in `web/src/screens/finances.ts`), and each account its own history.
8. **Finances on the phone** (F17, *Built*, #381): the calendar, upcoming bills, subscriptions, and goals on the phone companion, and Update balances in one quick sheet; view only where the phone may only look.
9. **Type to filter Status** (*Built*, #385), then the **command palette** (⌘K, *Built*, #395).
10. **Export** (F18, *Built*, #405): the plan and its projection as CSV and JSON, and a printable month.
11. **Answers on hover**, a PR each, sharing `web/src/parts/Hover.tsx`: the week's outages (*Built*, #406), then a balance's accounts and how long since each was updated (a Finances round, *Built*, #409), then why an app restarted (*Built*, #411: `internal/started`, data/started.json, noted wherever the homelab starts an app).
12. **Right-click the sidebar** (*Built*, #413: `web/src/palette/navMenu.tsx`, a shared `parts/ContextMenu.tsx`), then **pinned apps** (*Built*, #414: APPS_PINNED in .env, `homelab pin|unpin`).

**Not yours:** the roadmap's *Media library cleanup* ("Tidy Up"). It has its own session and branch; leave its roadmap section and its files alone.

## What the last sessions learned

- The Mac app runs in WebKit, where a mouse click does not focus a button: "close when focus leaves" never fires there. For "a click elsewhere closes it", listen for `mousedown` in the capture phase on the document. In a smoke case, click as WebKit does: `dispatchEvent('mousedown', { detail: 1 })` then `click`, which moves no focus.
- Playwright's trial click does not check what a click would land on. To prove a menu is not cut off, use `document.elementFromPoint` at each item's centre.
- Status's table clipped overflowing menus (`overflow:hidden` for its corners); in `#status` it is visible now, with the corner cells rounded. A menu near the bottom opens upward, measured against `main`.
- Smoke cases that need memory samples pass `mock: { usage }`; the default Status fixture has none.
- The preview loads `web/dist` as built: rebuild with `make frontend` before running a smoke case on a change.
- This session's tools cannot delete a remote branch; GitHub deletes a PR's branch when it merges.
- Releases are numbered one more than the newest (0.17.0, 0.17.1, … 0.17.10, then 0.18.0 by itself; `internal/tools/nextversion`, the owner's call of Nov 2, 2026). `VERSION` stays as it is; a CHANGELOG line goes under `## [Unreleased]`, above the newest version's heading.
- A session the owner starts can fetch, push a `claude/feature-*` branch, open a pull request, and squash-merge it (checked Nov 2, 2026).
- Background commands that run longer than 10 minutes (a whole `app-smoke`) need `run_in_background` and a longer timeout, or they are cut off and read as failures.
- Status's own rows are `#statusRows tr`. Backups draws `tr.grouphead` rows too, and in the morning Status reads Backups (the overnight line), so an unscoped `tr.grouphead` locator finds Backups' rows. Scope every locator to its screen.
- Go's monotonic clock stops while a Mac or Linux machine sleeps. Anything meant to notice a sleep compares wall-clock times (`t.Round(0)`).
- Records the app writes itself (held, pinned, days, phones) go in `data/` through `internal/lockedfile` (a lock beside the file, the file replaced whole), not in `.env`, which is for what the owner sets. Don't add new app-written keys to `.env` (the owner's call, Nov 5).
- If you use a git worktree anyway, copy `node_modules` into it. A symlink puts this machine's path into `web/dist/app.js`'s module comments.
- Logs too long to read through the GitHub tools are saved to a file; search that file for `FAIL` rather than reading it whole. The proxy blocks GitHub's log storage host, so `curl` on a log URL fails.
- `make check` doesn't run gosec or govulncheck: CI's *security* job does (`make security`). Run it before opening a PR that changes Go; #446's first push failed it on a `template.URL` (G203). `bin/gosec` stays after one `make security`, so later runs are quick.
- In this container's real Docker, `docker stop` leaves an app *stopped*, which the watchdog takes as stopped by hand and never alerts about. To make an app down for a test, `docker pause` it: it keeps running and stops answering (#439).

## Rules that never bend

1. **Never skip, weaken, or delete a test or check** to get green. Change an expected value only after proving the new one is right.
2. **Never merge red**, a conflict, or a PR with an open review comment you have not answered.
3. **Anything that changes state previews first** or asks for a second click; stopping or removing an app never happens on a single stray click.
4. **Never print, log, or pass secrets** on a command line; read them from `.env` when needed.
5. **The house style**: UI words, CHANGELOG lines, and commit titles are short, plain English about what the household gets (`app/preview/words.mjs` checks, and no Mac word outside a Mac branch). Colours are tokens in `style.css`; shared markup comes from `web/src/parts`.
6. **Every screen stays accessible**: no serious axe finding, every control named, everything reachable by keyboard.
