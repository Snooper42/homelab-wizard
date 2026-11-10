# Tidy Up: the refinement loop

The master prompt for a session that makes Tidy Up solid, one finished fix per round, each in its own pull request that it merges once CI is green. It is **Account 1's** work (`lanes.md`: Tidy Up is Account 1's lane), written by Account 3 at the owner's ask (Nov 7, 2026). Start it from a Claude Code session of your own on this repository and send:

    /loop Read .claude/prompts/tidy-loop.md and do the next round.

With no interval, /loop paces itself. Each round re-reads this file, so to steer the loop, edit it, commit and push it to main, and the next round follows.

It has two tracks, taken in turn: **fixes** (*The queue*: bugs and the promises below) and **the look** (*The look*: Tidy Up made to look and feel like the Finances screen, and like the finance app in the owner's reference screenshots).

**Paused:** no. (Change this to **yes** and push to pause the loop: a round that reads yes merges nothing new, opens nothing new, says it is paused, and waits for the next round.)

**Alongside `features-loop.md`:** both are Account 1. While this loop runs, it owns Tidy Up; the features loop's *Tidy Up focus* defers to it and goes on to Finances. The two share Account 1's limits: **one open PR**, between them. The owner waived the 3-a-day cap for Account 1 on Nov 8 ("Remember always merge everything"): merge each PR as soon as it is green and mergeable, without asking, still pinned to `expectedHeadSha` and still checking what main gained (Rule 5). Before opening a PR, list Account 1's open PRs; if one is open, wait (subscribe to it, as **Waiting on CI** says) or take an item that needs no push (an audit pass).

---

## What "bulletproof" means here

Tidy Up moves a household's music, films, and books. A round is worth doing only if, after it, one of these holds more firmly than before, or a household member would notice the screen got clearer. Every one of these is a **promise**: each has a test that fails if it breaks. A round that finds a promise with no test writes the test first (failing on a build that breaks it), before anything else.

| # | Promise | Guarded by (add it if missing) |
|---|---|---|
| P1 | Nothing is deleted outright: it goes to the Trash (Recycle Bin, `.tidy-trash`), noted under its run in `data/media-trash.jsonl` | `tools/media/tests`, `internal/media/media_test.go` |
| P2 | Every step that changes a library asks first (a sheet, or `--yes` from a script); a step that can't be undone from here asks twice | smoke: *Free the space takes a second click*, *Swap in asks first* |
| P3 | Undo puts back only what is still in the Trash, never over something now in its place | `homelab media restore` tests, smoke: *Undo on a sweep* |
| P4 | One job moves files at a time; a crashed job's lock is taken over and the job carries on | `internal/media` lock tests |
| P5 | **A job that stopped part-way carries on as the same job**, with the same flags | **missing**: queue item 2 |
| P6 | **Every argument a button sends is one the app accepts** (the preview's fake backend accepts anything, so a smoke case can't see a refusal) | `TestTidyArgsTakeEveryJobTheScreenSends` in `app/tidy_test.go` (#485) |
| P7 | The screen never says *done* when nothing was done, never says *everything's tidy* when it couldn't read the record or the review | smoke: *a record that can't be read*, *a books review that can't be read* |
| P8 | Numbers agree: the first line, **Needs your OK**, the drive, and **Recently done** count the same things the same way (1000 to a KB) | smoke: *a size reads the same…*, *the first line counts what Overview lists* |
| P9 | A library whose drive is away runs nothing, and says so | smoke: *a library whose folder is gone* |
| P10 | Every job shows its step and bar, can be stopped, and says *stopped*, *didn't finish* (with why), or *done*; a job started elsewhere is followed the same way | smoke: *a running job shows its step…*, *a job started elsewhere…* |
| P11 | No secret on a command line, in a log, or in `data/homelab_media.json` | `cmd/homelab` media tests, `make security` |
| P12 | The vendored organizers (`music_organizer.py`, `books_organizer.py`) change only with the owner's OK, recorded in their `VENDORED` comment with the new hash | `tools/media/tests` |

## Standing rules

These come before everything below; where they disagree with a later section, these win. `lanes.md` wins over this file.

- **State:** GitHub is the only source of truth. Start each round with `git fetch origin`, the open PRs, and `git ls-remote origin 'refs/heads/claude/*'`. Never rely on a previous chat.
- **Read first, every round:** `lanes.md`; `complaints.md` (its **Tidy Up** section comes before this file's queue); the **For Account 1** sections of `audit-loop.md` and `maintenance-loop.md` (their Tidy Up items too).
- **Branches:** `claude/feature-tidy-<short-name>`, from main. Never push to, merge, rebase, close, or comment on another lane's branch or PR. Rule 2 of `lanes.md`: before starting an item and again before each push, list every other open PR's files; if yours would touch one, take another item.
- **Failing first, always:** every fix comes with a test that fails on main's build and passes on yours: a Go test, a Python test in `tools/media/tests`, or a smoke case in `app/preview/shoot.mjs` (light and dark). For a smoke case, put back main's `web/dist/app.js` and `style.css`, run the case, see it fail, restore. Put the failing run's line in the PR under **Evidence**.
- **Never** skip, weaken, quarantine, or delete a test or check to get green; change an expected value only after proving the new one right. Never merge red, with a conflict, or with a review comment unanswered.
- **Merging** (`lanes.md` Rule 5): squash-merge with `expectedHeadSha` pinned to the head CI passed on, only when every commit main gained since that run touches none of the PR's files (a `CHANGELOG.md` line that merges cleanly doesn't count). Otherwise merge main in and let CI run again. Account 2's and Account 3's green PRs merge first.
- **Hot files:** `web/dist/*`: never hand-merge; take either side, `make frontend`, commit. `CHANGELOG.md`: your line at the top of **Improved** or **Fixed** (Account 1's place) under `## [Unreleased]`; after every merge, check it didn't slide into a released version. `app/preview/shoot.mjs`, `app/preview/mock.js`, `docs/Testing.md`, `coverage-floors.txt`: add lines only, keep both sides.
- **Waiting on CI:** `subscribe_pr_activity` on the PR and one `send_later` check-in about 50 minutes out, then end the turn. Don't poll. When it merges, delete the check-in and unsubscribe.
- **Spend less:** one item per round; work in the main checkout; read files by line range; locally run only the tests and `SMOKE_ONLY` cases you touched and their neighbours (CI runs the rest). Background anything over 10 minutes.
- **Ask the owner only** about a real product decision (what a household should see), once, in the round's report, with your pick; carry on with the most conservative choice meanwhile and write it under **Decisions to look at**.
- **Save before you stop:** push before any long wait and at the end of every round.
- **A long session hands off:** when the chat has been summarized, or the owner asks: push every branch, update **Open now** below in your next PR, delete check-ins, unsubscribe, and tell the owner to start a fresh session with the line at the top.

## Each round

1. **Start:** fetch, open PRs, branches; re-read this file. **Paused** yes: say so, stop.
2. **Your open PR first** (Account 1's, from this loop or the features loop): green and mergeable, merge it (pinned) and tick its item below in the next PR; red, root-cause it (a job may be re-run once to tell a flaky runner from a real failure; a second failure is real); conflicting, merge main in, `make frontend`, push. Still running: go on to step 3 on a new branch, but open nothing until it merges.
3. **Pick**, the first that applies:
   1. an owner complaint under **Tidy Up** in `complaints.md`;
   2. a Tidy Up item handed to Account 1 by another lane;
   3. a **High** item in **The queue**, or a promise above with no test;
   4. otherwise the tracks take turns: if the newest entry in **Done** is a fix, take the first unticked item in **The look**; if it is a look item, the first unticked item in **The queue**. If the track whose turn it is has nothing ready (the look waits on references, say), take the other.
   5. Both empty: do **The audit pass**, which also compares the look (below), write what it finds into the right list (ranked), and take the first.
4. **Reproduce** it before changing anything: the failing test, or for a screen item the screenshot (`node app/preview/shoot.mjs` with a mock that shows it). An item you can't reproduce goes back with what you tried, under **Couldn't reproduce**.
5. **Fix** the cause, smallest change that holds; read the code it touches first. Keep the house style: words in plain English (`app/preview/words.mjs`), colours as tokens, shared markup from `web/src/parts`, components draw and `screens/tidy.ts` acts.
6. **Checks:** `make check`; `make coverage` and `make security` when Go changes; `make frontend` then `make frontend-check` when the frontend changes; `python3 -m unittest discover -s tools/media/tests` when an engine changes (`make check` runs it too); the smoke cases you touched (`SMOKE_ONLY="Tidy Up" node app/preview/shoot.mjs --smoke` runs them all, about 60).
7. **Words:** a `CHANGELOG.md` line (what the household gets); `docs/Tidy Up.md` and `docs/Testing.md` where the behaviour is described.
8. **PR:** the repository's template; **What changed** (before → now), **Evidence** (the failing-first run, the passing run), **Decisions to look at**. Subscribe, check-in, end the turn.
9. **Report** in a few lines: what shipped, what merged, the checks, what's next.

## The audit pass

When the queue is empty, and at least every fifth round regardless, look Tidy Up over as a demanding household member would, against the preview (`app/preview`, its mock in `mock.js`). Screenshots go in `docs/images/tidy/` (committed with the queue update). Check each of these, and write each failure into **The queue**, ranked worst first, with: what you did, what the screen said (quoted), why it gets in the way, what fixed looks like, and the test that would fail today.

- **Every tab:** Overview, Music, Movies, TV, Books, Audiobooks.
- **Every state of each:** new (nothing scanned), mid-way (each music stage: `new`, `scanned`, `built`, `swapped`, `verified`, `freed`), all tidy, drive away, a tool missing, a job running here, a job running elsewhere (`lock`), a job stopped part-way (`stale`, for every action that takes the lock), a job that failed (`tidyFails`), a record that can't be read (`tidyUpFails`), a review that can't be read (`tidyReviewFails`), Stop that takes a while (`tidyStopSlow`).
- **Every button:** what it sends to `TidyRun` (`M.tidyRuns` in the mock) is accepted by the real app (`tidyArgs` in `app/tidy.go`); what asks first asks; what throws away is never the main button; Undo is offered wherever **Recently done** promises it.
- **Widths and looks:** desktop, 860px, phone (390px); light, dark, more contrast; as Mac, Windows, and Linux (`platform` in the mock). Nothing cut off, overlapping, or off its card's edge.
- **Keyboard and VoiceOver:** Tab order follows the eye; focus goes somewhere sensible after every sheet, job, and Close; every control has a name; a job's progress is announced by step, not by tick; axe finds nothing serious.
- **Words:** each card says first what matters most; no command names, codes, or paths where a sentence would do; numbers agree across the screen (P8).
- **The look:** each tab beside Finances' Dashboard and the references in `docs/images/tidy-reference/`, at the same width and theme. Each difference worth closing goes into **The look**'s list, with the screenshot pair.
- **The engines:** for each script in `tools/media`, a run against a small fixture library in a throwaway home (stopped half-way with Ctrl-C, then run again; run twice; run with the drive missing). What a household would see if it went wrong is the finding.

## The Inbox plan (owner, Nov 8)

The owner's vision: drop messy files of any kind (untagged music, films, shows, books, audiobooks) in a watched folder or on a drive, and Tidy Up works out what each is, tags it, adds lyrics, checks for duplicates, and files it, by itself (as things arrive, or once a day) or when pressed, in words a household member who isn't technical can follow. They approved the mockup ("I love it. Yes. build that out") and asked for it in pieces, each its own PR:

1. (done: #521) **Inbox home**: Drop anything here: the watched folders (Add…, Remove), when it tidies (`TIDY_INBOX_WHEN`: arrive, daily, manual), Tidy up now.
2. (done: #524) **What I did today + Undo**: a plain line for each download filed (`data/media-filed.jsonl`), Undo puts its files back (`homelab media inbox undo <id>`).
3. (done: #526) **Needs a look**: what no engine could place, with why (`data/media-needs.json`); It's a film… / It's an episode… rename and file it (`inbox name`), Leave it (`inbox leave`), Show in Finder.
4. (done: #529) **Where should your libraries live?**: the first time, and from Change where your libraries live… or Choose another…: each drive (`diskspace.Drives`) with its space and the libraries on it, each library's folder on the one picked, Use it keeps `MEDIA_ROOT` and runs the Fix it flow (the apps that read the libraries recreated after asking). No per-library Change…: the apps mount each library from `MEDIA_ROOT`'s own subfolders.

Next, in this order, each its own PR (mockups exist for the first two, in the Nov 8 session's scratchpad; make new ones with the real app if they're gone):

5. (done: #535) **Name these songs**: music with no tags and no match. The owner, Nov 9: "yes" to trying them by their sound first when AcoustID is set up (only what beets can't match waits in Needs a look), to the artist being optional, and to stopping when a song is more than 30 s off its place on the album. A sheet asks the artist and album, looks the album up (MusicBrainz, as beets does), shows the matches (*Rumours · Fleetwood Mac · 1977 · 11 tracks*), and files the songs as that album. Needs a look already lists the download (kind music); add the button and an `inbox name <path> album "<artist>" "<album>"`.
6. (done: #537) **Look a typed title up**: It's a film… and It's an episode… show what TMDB (through Jellyfin or the *arr apps, which have the key) finds for what's typed, so a person picks *The Big Lebowski (1998)* rather than typing the year.
7. (done: #538) **Archives**: a .rar or .7z in a watched folder says so in Needs a look (*open it in Finder; what's inside is filed next time*), instead of being passed over.

Lessons from pieces 1–4, for whoever builds the next:
- A button the mock app accepts can still be refused by the app: `TestTidyArgsTakeEveryJobTheScreenSends` fills in each new job's arguments, and the CLI's `homelab media inbox` routes every inbox action (Undo was a preview until #524).
- Whole paths in the app's tests are `C:\...` on Windows (the `vid` and `show` helpers in `app/tidy_test.go`).
- `make check` doesn't run the coverage floors; run `make coverage` before pushing new code in a package with a high floor (internal/diskspace is 91%).
- A sheet's boxes update from the latest values (`setTyped((t) => ({ ...t, ... }))`): fixed in v0.27.4 after typing fast in two boxes wiped the first.
- Every new button on the Inbox waits while a job runs; the running-job smoke case fails on any enabled button in `.fx-board`.
- Build `web/dist/app.js` only in a checkout with its own `node_modules` (a copy, never a link): esbuild writes each module's path into the bundle, so a linked one gives `../../home/…/node_modules/preact/…` and CI's `make frontend-check` fails (#529, Nov 9).
- A question sheet can look things up first: `TidyConfirm.find` (Look it up, a list to pick from, the pick handed to `go` as `picked`), with `needs` (the box it looks up: typing in another keeps the list) and `optional` (the main button doesn't wait for a pick). Name these songs uses it for albums (a pick needed), It's a film… and It's an episode… for titles (#537).
- In a smoke case, type into a sheet's second box only once the sheet has put the cursor in its first (`document.activeElement` is `#tidySheet .tidyfields input`): the sheet focuses a frame after it shows, and on a slow runner that frame took the second box's typing (#535's red dark run). The cause is in `parts/Sheet.tsx`, noted for Account 2 above.
- A PR that conflicts with main gets no CI at all (no checks, nothing red): after a merge, `git fetch` before starting the next branch from `origin/main`, and if a PR shows no checks, look for a conflict first (#537 sat 25 minutes so).
- After a PR merges, its branch is deleted on GitHub: start the next one from a fresh `origin/main` and push it plainly (no force push is needed, and the sandbox refuses one).
- The sandbox can't reach musicbrainz.org, Radarr, Sonarr, or Jellyfin, nor GitHub's artifact storage (a failed smoke run's screenshots): reproduce a CI-only failure locally with three smoke runs at once and the page's own state printed on failure.

## The queue

Worst first. Each item: where, what goes wrong (proved, or what to prove), what fixed looks like, and the test that fails today. Tick an item **(done: #PR)** when it merges; never delete one.

1. (done: #485) **Tidy lyrics never runs from the app** (High; proved Nov 7 by Account 3). Overview's and Music's **Tidy lyrics** sends `act.run('music', 'lyrics', ['--tidy'])` (`web/src/tidy/Tidy.tsx`, the `apart > 0` row). The app's guard on what the screen may send, `tidyScreenArgs` in `app/tidy.go`, takes only `--apply`, `--check`, `--skip <ids>`, and one Undo run, so it refuses with `Tidy Up doesn't run a job with "--tidy"`, and the job panel says *didn't finish*. Every smoke case passes, because `mock.js`'s `TidyRun` accepts anything.
   - *Fixed looks like:* `--tidy` accepted for `music lyrics` only (keep the guard tight: a flag is allowed for the kind and action that use it, not everywhere), and **Tidy lyrics** runs.
   - *Tests that fail today:* a row in `TestTidyArgsTakesOnlyWhatTheScreenSends` for `music lyrics --tidy` (accepted) and `movies scan --tidy` (refused); and promise P6's guard: a Go test in `app/` that reads every `act.run(…, [...])` and `run(…, [...])` call in `web/src/tidy/*.tsx` and `web/src/screens/tidy.ts`, takes each literal flag list, and checks `tidyArgs` accepts it for that kind and action. Then make the mock's `TidyRun` refuse what the app refuses (the same list, with a comment naming the Go test that keeps the two in step), so a smoke case sees a refusal too.
   - The guard is Account 3's (N12, round 17). Loosen it only as above; tell Account 3 in **For Account 3** below when it ships.
2. (done: #578) **A job that stopped part-way carries on as another job** (High; read from the code Nov 7, prove it first). The lock (`media.Lock` in `internal/media/lock.go`, written by `media.Acquire` from `cmd/homelab/media.go`) keeps the kind and action, never the flags. The screen's **Carry on** (`carryOn` in `Tidy.tsx`) runs `act.run(kind, action)` with no flags, and its card names the job by `jobTitle(kind, action)` with none either. So:
   - a **Tidy lyrics** (`lyrics --tidy`, which takes the lock) that stopped shows *Adding lyrics: stopped part-way*, and **Carry on** asks LRCLIB about every song instead of finishing the tidy (once item 1 lets it run at all);
   - a **Set up Tdarr** (`tdarr setup --apply`) or **Check Downloads** (`inbox … --apply`) that stopped carries on without `--apply`: a preview that changes nothing, takes no lock, and so leaves the *stopped part-way* card there for good.
   - *Fixed looks like:* `Lock` keeps the flags the job ran with (only the ones `tidyScreenArgs` allows; old lock files without them still read); `TidyUp`'s `stale` carries them; `carryOn` and the card's title use them; a lock that can't say its flags offers **Carry on** only for jobs with none. *Tests:* `internal/media` (a lock written with flags reads back with them; an old one reads), `app` (stale carries them), smoke: *a Tidy lyrics that stopped part-way says so, and carries on as Tidy lyrics* and *a Tdarr setup that stopped part-way carries on with --apply* (assert `M.tidyRuns`).
3. (done: #579) **A job started elsewhere can't be stopped from the screen** (Medium). `RunningCard` has no Stop, and `TidyStop` cancels only the job this window started. The agent's **Collect** or a Terminal run holds every button until it ends, however long. *Fixed looks like:* **Stop** on that card, which asks the lock's process to stop at its next safe point (the same interrupt `TidyRun` uses; only the PID `media.ReadLock` vouches for, checked again just before), then *Stopping…* until the lock is gone. Mind P4 and Account 3's lock checks (a PID reused by another program is never signalled). *Tests:* `app` (Stop signals only a live lock's process; a stale or reused PID is left alone), smoke: *a job started elsewhere can be stopped, and says Stopping…*.
4. (done: Nov 10, the PR after #579) **Undo depends on the words of a line** (Medium). **Recently done** finds the music swap's Undo by the text `'Cleaned library swapped in'` and the books' by `kind + text.slice(0, 12) === 'booksBooks tidied'` (`DoneWidget`). Rewording either line in an engine silently removes Undo. *Fixed looks like:* the activity line carries what it was (`action`, as `undo` already carries its run) and Undo is found by that, with old records still matched by their words. *Tests:* `internal/media` (the record keeps the action), smoke: *Undo is offered on a swap whose line is worded differently*.
5. **Recently done on Books stays empty after a review** (Medium; from `features-loop.md`'s open list). Reproduce with the mock, find whether the engine writes no activity for a review or the screen filters it out, and fix the cause. *Test:* smoke: *a books review shows in Books' Recently done*.
6. **Following a job elsewhere stops for good after one failed read** (Low). In `screens/tidy.ts`'s `follow()`, a `TidyLock()` call that rejects sets `running = null` and returns without drawing or re-arming; the screen keeps the stale running card and every button waits until something else redraws it. *Fixed looks like:* it tries again on the next tick. *Test:* smoke with a mock whose `TidyLock` rejects once.
7. **A job that started yesterday says only "Started at 3:04 AM"** (Low; `RunningCard`, and the stopped-part-way card has no time at all). *Fixed looks like:* "Started yesterday at 3:04 AM" (or the date), using the app's own date words. *Test:* smoke with a `lock.start` a day old.
8. **The sidebar's Tidy Up badge** counts only something wrong, not *N things need your OK*. The owner's call, asked Nov 6: ask once more in a report if there's no answer in `complaints.md`; build nothing until they say.
9. **The owner's own machines** (not a code item): `docs/Testing.md`'s Tidy Up rows on the Mac, a Steam Deck with Calibre from Discover, Windows with Docker Desktop. List them in a report once a week until the owner says they're tried.

## The look

The owner wants Tidy Up to look like the Finances screen, and like a finance app whose screenshots they keep in `docs/images/tidy-reference/`. Finances is the house's own model: it already has the parts (`web/src/finances/ui`: `Widget`, `Stat`, `Legend`, `SplitBar`, `Donut` and the charts in `charts.tsx`), and Tidy Up uses some of them already.

### The references

- **Where:** `docs/images/tidy-reference/`. Each picture is beside a line in its `README.md`: the file, and what the owner likes in it, in their words ("the big number on top", "the cards' spacing", "how the list shows each bill's logo"). The owner adds them (on GitHub: that folder, **Add file › Upload files**, commit to main), or sends them in a session that commits them to main.
- **Read them at the start of every look round**, every picture, with the README. A picture with no line in the README: say what you take from it in the PR, under **Decisions to look at**.
- **No references yet:** the look track does the **Finances** items below only, and the round's report asks the owner once a week for the pictures and what they like in each.
- **Take the style, never the app.** Layout, spacing, hierarchy, how a figure leads a card, how a chart reads, how a list row is built: yes. Its name, logo, icons, illustrations, words, colours copied as values, or its pictures in the app: never. Every colour stays a token in `style.css`; every icon is drawn here or comes from where the repo's icons already come from. The reference pictures stay in `docs/` and are never loaded by the app.
- **What doesn't carry over:** money words, red for a loss, a budget's guilt. Tidy Up's numbers are space won back, things to do, and time; green means won back, amber means look at it, and red only means something failed.

### Each look round

1. **Before:** screenshots of every Tidy Up tab the change touches, light and dark, at desktop (1280), 860px, and phone (390px), and the same of Finances' Dashboard and of the reference it follows. Use the preview (`app/preview`, its mock), at `deviceScaleFactor: 1`. Look at them side by side and write down, in one line each, what differs.
2. **One change**, from the first unticked item below (or from a reference). Build it from Finances' parts. When Tidy Up needs a part Finances also has, use that one; when it needs a variant, add the variant to the shared part, never a copy. Shared markup stays in `web/src/parts` and `web/src/finances/ui` (`make frontend-check` fails otherwise).
3. **Keep every promise:** no button, Undo, count, warning, or job state may be lost or hidden to make it look tidier (P2, P7, P8, P10). What a household must act on stays first on the screen. One main button on a screen, never on a step that throws things away.
4. **A test that fails first:** a smoke case for what the change puts on the screen (*Overview leads with what was won back, as a figure and a chart*), failing on main's build. Run the layout cases too: *every card keeps its contents off its edges*, *every card's heading sits at the same height*, *on a phone the tabs sit in two rows of three*, and axe in both themes.
5. **After:** the same screenshots. Commit the before and after pairs under `docs/images/tidy-look/<item>/` and show them in the PR (before | after | the reference). Add the screen to the repo's screenshot list (`shots` in `app/preview/shoot.mjs`) if it isn't there: Tidy Up's tabs have none there today.
6. **Data:** a change that needs a new number the engines don't keep (space over time, say) records it in `data/` through `internal/lockedfile`, never `.env`; old records keep loading; a Go test for each. Mark the item **M** and do the data in its own PR first.

### Finances' style, item by item

**The owner's pick (Nov 7): Take 2, built in #485.** After two rounds of mockups, the owner chose this over the Finances look: **Needs your OK** leads with *Next up* (the one thing with the main button, larger) beside the drive as a ring; **Your libraries**, a tile each in its colour, with a bar only where the record can say; each tab opens on its library, and Music's on its five steps. Build on it: the items below stand only where they still fit.

What the screenshots (Nov 7) show Tidy Up lacks, worst first. Tick **(done: #PR)**; never delete one. Re-check each against main before starting it.

L1. (dropped: the owner chose Take 2's *Next up* over a Finances hero; a size history may still come back as a chart on the drive card) **A hero card first, as Finances' Dashboard has** (M: needs history). Finances opens with one card: a big figure ("$2,512.40", its small part smaller), a caption in capitals ("TODAY"), a chart over time with a **30 days / 3 months** switch, a figure on the right that matters ("$407.91, lowest… under your cushion", in its colour), and a legend. Tidy Up opens with a to-do list. *Looks like:* "412 GB won back" as the figure, the drive's free space over time as the chart (with each run that won space back as a dot, as paydays are on Finances), and on the right "380 GB more to win back" or the drive's lowest free space. **Needs your OK** goes right under it. The sizes are measured every six hours (`~/.homelab-media/sizes.json`) but only the latest is kept: keep a history first (a point a day, a year at most, in `data/`).
L2. (done: #485, Take 2's header on each tab; Movies' and TV's charts stay on their Space card) **Each library's tab leads the same way** (after L1): Music, "13,932 songs" with where the library is in its steps (scanned → built → swapped → checked → freed) as a row of steps; Movies and TV, their size with Lean / Could shrink / With Tdarr as the chart; Books, the books and how many could look tidier; Audiobooks, the books and how many are in pieces.
L3. (partly: #485, cards keep their own height; Music's Space card is still one figure, which its header now also shows: fold it in) **Cards that are half empty** (`docs/images/tidy-look/baseline/tidy-music-light.png`, Nov 7: Music's **Space** card is one number and a blank half-card). A card has a figure, a caption, and something under it (a bar, a short list), or it joins another card.
L4. **The two-up cards line up as Finances' do:** same height in a row, the same padding, the figure on the same line; the Genres card's dropdown looks like Finances' switch, not a system select box, where it can (keep it a real `select` for the keyboard and VoiceOver if a switch can't hold six libraries).
L5. **Rows as Finances lists them:** each row's figure on the right in the same place and type as Finances' amounts (today only films' rows show one, "380 GB"); its caption on one line where it fits at 860px; long subtitles (Music's *Lyrics* row runs to two lines) said shorter.
L6. **The header's button.** Finances has its one action in the header ("+ Add a payment", filled); Tidy Up has **Settings…**. Whether the screen's main button goes in the header is the owner's call (P2: never a step that throws things away): ask once, build nothing until they say.
L7. **Dark mode, 860px, and the phone** match Finances' at each step: compare every look item at all three widths in both themes before ticking it.

## Done

- #485: queue item 1 (Tidy lyrics runs; P6's guard), and the look: Take 2.
- #540: Account 2's hand-off: Tdarr's setup says *Choose apps › Tdarr*, not *Choose stacks*; a test in `tools/media/tests` keeps *stacks* and *baseline* out of what the engines print.
- #541: the plan for *media apps run only while a job needs them* (in **Open now**).

## Couldn't reproduce

(None yet.)

## For Account 2

(Problems in shared parts or other screens that this loop finds: what you saw, the screenshot path, the smoke case that would fail. Never fix them here.)

- **A sheet's first-box focus can take what's typed in another box** (`web/src/parts/Sheet.tsx`, Nov 9, #535). When a sheet shows, a `requestAnimationFrame` puts the cursor in its first field, even if the person (or a test) has already clicked into another one. On a slow frame, letters typed into the second box in between land in the first: CI's smoke (dark) on #535 had *Rumors* in Artist and Album empty; reproduced 2 runs in 9 with three smoke runs at once. Tidy Up's two cases now wait for that focus before typing a second box. *Fixed looks like:* the frame leaves the focus alone when it's already inside the panel. *Test:* open any sheet with two fields, slow `requestAnimationFrame` (as *Tidy Up: Needs a look names a film…* does), fill the second field at once, and expect its value kept.

- **A resting Tdarr reads "Stopped by you" on Status** (Nov 9, `claude/feature-tidy-tdarr-rest`). Tidy Up now stops an idle Tdarr and notes it in `data/stopped.json` as `{"why": "tidy"}`. `stoppedWords` in `web/src/status/stopFor.ts` knows only `restarting`, so the row says *Stopped by you*, and the phone's screens likely say the same. *Fixed looks like:* *Resting* (the owner, Nov 9: shorter than *Resting until Tidy Up needs it*), with Start still offered (a Start keeps it up until Tidy Up's next job). *Test:* a smoke case with a mock whose `stopped` has `tdarr: {why: 'tidy'}`, expecting the words. Also check that an update recreating Tdarr leaves a resting one stopped, as it does one a person stopped.

- **The \*arr apps rest too, with the same `{"why": "tidy"}`** (Nov 9): Sonarr, Radarr, Lidarr, Prowlarr, Bazarr, FlareSolverr, qBittorrent and Gluetun. Each should read *Resting* on Status as Tdarr does; a Start there keeps them up until the next 12-hour wake. The nightly update should leave resting ones stopped.

## For Account 3

(Anything that touches a security guard: `tidyScreenArgs`, `TidyReveal`, the lock's PID checks, the Trash log, secrets. Say what changed and the PR.)

## Open now

**Nov 9, later (Account 1's session):** #540 merged (the hand-off from Account 2, see **Done**). No Account 1 PR is open. None of the Inbox plan's pieces 4 to 7 has been tried on a machine yet: `docs/Testing.md` has a row for each.

**Next, in this order:**

1. **Media apps run only while a job needs them** (the owner's ask, for memory on the 16GB Mac). The plan, from reading the code (Nov 9):

   *What's there.*
   - Tdarr does only what Tidy Up gives it: `tdarr_setup.py` makes its libraries with `scanOnStart`, `folderWatching` and `scheduledScanFindNew` all off. It is one container (`compose/media-automation.yaml`, `internalNode: "true"`). The jobs that need it are `tdarrJob` in `cmd/homelab/media_tdarr.go`: `tdarr setup`, and `movies`/`tv` `run` and `collect`. The agent's `mediaTick` runs **Collect** every 5 minutes while `media.HasTdarrWork` says a film or episode is still with Tdarr (`pending`, or a file not yet collected).
   - Whether Tdarr is converting right now: `tdarrAPI.busy` (`media_tdarr.go`), already used by the battery saver.
   - Anything that starts apps by itself (the watchdog, `heal`, `fix`, the battery saver, the wait for a drive, Start the N stopped) skips an app in `data/stopped.json` (`internal/stopped`). Its `Why` is a free string; the watchdog uses `restarting`. So a stop Tidy Up makes there is honoured everywhere, with no change to `internal/stopped`.
   - `record.go`'s `DuplicatiPaused` is the model for a pause Tidy Up undoes itself.

   *What to build (one PR, Account 1's files only: `cmd/homelab/media_tdarr.go`, `media.go`, `internal/media/record.go`, the Tidy screen, their tests and docs):*
   - **Rest when idle.** In `mediaTick`, with no lock held: Tdarr running, `HasTdarrWork` false for films and TV, `busy` false (or Tdarr not answering), and the last Tdarr job ended at least 15 minutes ago. Then stop the container and add Tdarr to `stopped.json` with `Why: "tidy"`. The media record keeps `TdarrResting: true`. `TIDY_TDARR_REST=false` turns it off.
   - **Wake for a job.** Before a `tdarrJob` runs: if Tdarr's stop says `Why: "tidy"`, take it out of `stopped.json`, start the container, and wait for Tdarr's API (up to 2 minutes, saying *Starting Tdarr…* as a step). If it doesn't answer, the job says why, as it does now when Tdarr isn't answering.
   - **A person's start wins.** A Tdarr someone started (Status, its page, Docker Desktop) is out of `stopped.json` while the record says resting. Tidy Up then clears `TdarrResting` and leaves Tdarr up until a Tidy Up job next uses it. A stop by a person (no `Why`, or any other `Why`) is never undone by Tidy Up.
   - **Battery.** A resting Tdarr is held, so the battery saver neither pauses nor restarts it. One paused on battery that then has no work stays paused until power, and then may rest.
   - **The screen:** nothing to change, as it turned out. Its only "Tdarr isn't answering" row (`Tidy.tsx`, `away`) shows while a film or episode is with Tdarr, and Tdarr never rests then.
   - **Found while building:** the inbox files a bloated download through Tdarr (`video_engine.py` `file`, run by `inbox.py`). So a sweep with a video in a watched folder, and Needs a look's *It's a film…* / *It's an episode…*, wake it too (`needsTdarr`, `media.InboxHasVideo`).
   - *Tests that fail today:* `cmd/homelab` (idle with no work → stopped with why `tidy`; work pending, busy, a job in the last 15 minutes, or `TIDY_TDARR_REST=false` → left running; a person's stop is never started; a `run` wakes a resting Tdarr and waits for its API; a person's start clears resting), and a smoke case for the resting row.

   *Built in the PR after #541 (`claude/feature-tidy-tdarr-rest`).* *For Account 2 (handed over below, under **For Account 2**):* Status reads `why === "tidy"` as *Stopped by you* today (`web/src/status/stopFor.ts`, `stoppedWords`). It should say *Resting* (the owner's word), with Start still offered. Also check that an update recreating Tdarr leaves a resting one stopped.

   *Asked of the owner (Nov 9), building the conservative choice meanwhile:* (a) **Which apps:** Tdarr only for now, or also Sonarr, Radarr, Lidarr, qBittorrent and Prowlarr when nothing is downloading? Those fetch on their own schedules (RSS, Seerr's requests), so stopping them means new episodes don't arrive until something starts them: a bigger change. Jellyfin and Navidrome stay up. (b) **Status:** should a resting app show there as *Resting until Tidy Up needs it*, in the stopped list? Pick: yes, as above.
2. **The *arr apps rest too** (the owner, Nov 9: "All arr apps should rest unless there is something actually pending"). After #542 merges, its own PR, built on #542's rest-and-wake (generalise `restTdarr`/`wakeTdarr` to a list of apps, each with what counts as pending):
   - *Which:* Sonarr, Radarr, Lidarr, Prowlarr and Bazarr, with the helpers that serve only them: qBittorrent (and Gluetun, which it runs through), FlareSolverr. Seerr, Jellyfin and Navidrome stay up.
   - *Pending* (any keeps them all up, as they call each other): a torrent downloading or queued in qBittorrent; anything in a Sonarr, Radarr or Lidarr queue (`/api/v3/queue`, Lidarr `/api/v1/queue`); a Seerr request approved and not yet available; a Tidy Up job that hands downloads over (`arr apply`); and 15 minutes after any of these. A torrent seeding keeps qBittorrent and Gluetun up (the owner: yes), not the rest.
   - *New episodes and films* still come: they wake on a timetable (the owner: every 12 hours, "I'm not adding files that often"; and at once when Seerr has a new request), ask for an RSS sync and a search of what's missing (`RssSync`, `MissingEpisodeSearch`), and rest again once nothing was grabbed. A request Seerr couldn't hand over while they rested is sent again once they're up.
   - *Lanes:* Status's word for them is the same hand-off as Tdarr's (**For Account 2**).
   - *Built (Nov 9, the one-account session):* `cmd/homelab/media_arr_rest.go`, `TIDY_ARR_REST`. Pending is read from the queues, qBittorrent (`QBITTORRENT_PASSWORD`) and Seerr (`filter=processing`); what can't be read keeps them up. A person's start keeps them up until the next 12-hour wake. *Not built yet:* sending again a request Seerr couldn't hand over while they rested (Seerr's `/api/v1/request/{id}/retry` for its failed ones, once they're up).
3. The queue's item 2 (*a job that stopped part-way carries on as another job*), then the rest of the queue and the look's L3.

Owner's answers, Nov 9 (later): all the *arr apps rest unless something is actually pending (item 2 above); they wake every 12 hours to look for new releases; seeding keeps qBittorrent up; a resting app's word on Status is just *Resting*.

Owner's answers this session (Nov 9): untagged songs go to beets first when AcoustID is set up; the album sheet's artist is optional; filing stops when a song is more than 30 s off its place on the album. #508 (Finances, idle) was closed at the owner's word.

## What earlier sessions learned about Tidy Up

- The preview loads `web/dist` as built: `make frontend` before running a smoke case on a change.
- The preview's fake backend (`app/preview/mock.js`) accepts every job: it can't show what the real app refuses (item 1). When a smoke case clicks a button that runs a job, also assert what reached `M.tidyRuns`.
- Mock knobs for Tidy Up: `tidy` (the record), `tidyTab`, `tidyEvents['kind action']` (what a job says as it runs), `tidyHold` (a job that doesn't end), `tidyFails['kind action']`, `tidyStopSlow`, `tidyReviewFails`, `tidyUpFails`, `stale` and `lock` inside `tidy`.
- The Mac app runs in WebKit, where a click doesn't focus a button. In a smoke case, click as WebKit does: `dispatchEvent('mousedown', { detail: 1 })` then `click`.
- Scope every locator to `#tidy`; other screens draw rows and cards with the same classes.
- *Tidy Up: lyrics say what came of every song…* failed once on a loaded CI runner at its first click; if it fails again, wait for `#tidy .seg` first, never a longer timeout.
- Sizes are 1000 to a KB on this screen (`size()` in `Tidy.tsx`), unlike `web/src/format.ts`'s `bytes` (Account 2's).
- `homelab media … --events json` is what the app runs; `--yes` is the screen's OK. A flag the screen sends must be allowed in `tidyScreenArgs` (P6).
- `make check` doesn't run gosec or govulncheck: `make security` does, and CI's *security* job runs it.

## Rules that never bend

1. Nothing a household owns is deleted outright, moved without asking, or changed without a way back that the screen offers (P1–P3).
2. Never skip, weaken, or delete a test to get green; never merge red.
3. Never print, log, or pass a secret on a command line.
4. Never edit the vendored organizers without the owner's OK in writing, recorded in their `VENDORED` comment (P12).
5. Every screen stays accessible: no serious axe finding, every control named, everything reachable by keyboard.
6. Words are short, plain, and about what the household gets.
