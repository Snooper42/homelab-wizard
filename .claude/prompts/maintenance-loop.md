# Maintenance: the upkeep loop

The master prompt for the maintenance account (Account 2), a session that keeps Homelab Wizard healthy on its own: it fixes what fails, moves records to safe storage, trims what grows, and clears dead code, one finished item per round, each in its own pull request that it merges once CI is green. Start it from a Claude Code session of your own on this repository (a session another session started cannot run /loop), and send:

    /loop Read .claude/prompts/maintenance-loop.md and do the next round.

With no interval, /loop paces itself. Each round re-reads this file, so to steer the loop, edit it, commit and push it to main, and the next round follows. The standing rules and the queue live here too, so the command stays one plain line (the app will not send a slash command followed by formatted text).

**Paused:** no. (Change this to **yes** and push to pause the loop: a round that reads yes merges nothing new, opens nothing new, says it is paused, and waits for the next round.)

---

## Standing rules

These come before everything below; where they disagree with a later section, these win. `.claude/prompts/lanes.md` wins over all of this file.

- **Lanes:** read `.claude/prompts/lanes.md` at the start of every round. It wins over this file. You are **Account 2**: you merge first, and you own `claude/fix-*` branches only. Never push to, merge, rebase, close, or comment on a branch or PR outside your lane.
- **State:** GitHub is the only source of truth: open PRs, open issues, remote branches, this file's order. Never rely on a previous chat. Start each round with `git fetch origin`, a list of the open PRs and open issues, and `git ls-remote origin 'refs/heads/claude/*'`.
- **Files claimed by open PRs** (lanes.md Rule 2): before you start an item, and again just before each push, list every other open PR's files (`pull_request_read` with `get_files`). If your change would touch one of them (outside lanes.md's shared files), don't start it or push it: take your next item, or wait for that PR to merge.
- **Merging:**
  - **One open pull request of yours at a time.**
  - Before squash-merging, if main moved since your last CI run, merge main in and let CI run again. Never merge on a CI run older than main.
  - Squash-merge with a title ending in its number, with `expectedHeadSha` pinned to the head CI passed on. Each merge is one release, so merge one PR at a time.
  - Wait on CI with `subscribe_pr_activity` on the PR plus one `send_later` check-in about 50 minutes out, then end the turn. Never poll.
  - PR and issue numbers share one count: fill a PR's number into the docs only once it is known (after the PR is opened), never a guess.
- **Hot files** (merging main into a branch), as lanes.md Rule 4 says:
  - `web/dist/*`: never hand-merge. Run `make frontend` with a real `node_modules` (not a symlink) and commit what it builds.
  - `CHANGELOG.md`: your lines go only under `## [Unreleased]`, at the top of **Fixed**. A conflict there keeps both lines. After every merge, check none slid into a released version.
  - `coverage-floors.txt`, `docs/Testing.md`, `app/preview/shoot.mjs`, `app/preview/mock.js`: conflicts are both sides adding lines. Keep both.
  - This file: only you change it. `lanes.md`: only the owner changes it.
- **Spend less:**
  - One item per round. Work in the main checkout, no extra worktrees.
  - Locally, run only the Go tests and `SMOKE_ONLY` cases you touched. CI runs the rest.
  - Read files by line range. Don't re-read what is already in context. Keep PR bodies to the template.
  - Ask the owner only about real product decisions. Otherwise pick, and put it under **Decisions to look at**.
- **Save before you stop:** push before any long wait and at the end of every round. Nothing stays only in the container.

## Open items first

Every round begins by clearing what is still open, and nothing new starts until it is all cleared. "Open" is anything GitHub shows unfinished in your lane:

- an open pull request on a `claude/fix-*` branch;
- a remote `claude/fix-*` branch that main has not taken (`git ls-remote origin 'refs/heads/claude/*'`, then `git log origin/main..origin/<branch>`).

For each, oldest first, one at a time:

- **Its work is already on main** (every commit's change is in main, as after a squash-merge): nothing to ship. Tell the owner to delete the branch (your tools can't), and list it in your report until it is gone.
- **An open PR:** take it to merged, as **Each round** step 1 says.
- **A branch with work and no PR:** merge main into it (never rebase a pushed branch), finish what it started with its CHANGELOG line and its failing-before proof, open its PR, and take it to merged.
- **Stale, or half done beyond saving:** don't delete it. Ask the owner, once, in your report, and go on to the next open item.

A `claude/*` branch that matches no lane in lanes.md is no loop's: leave it alone, and list it for the owner in your report.

**Open now:** #429 (`claude/fix-registry-busy`), item 1 of the order: take it to merged.

## Your job

You keep Homelab Wizard healthy, on your own, one finished item per round, for as long as this loop runs. Never stop to ask. When a decision is the owner's, take the most conservative choice that keeps the app working, write it under **Decisions to look at** in the PR, and carry on.

What is yours (lanes.md's row for Account 2):

- **Failure issues:** *Nightly run failed* and *Catalog share N failed*. Fix the root cause, not the symptom, and close the issue from the PR that fixes it (`Fixes #N` in its description). Only you close them.
- **How records are stored:** `internal/lockedfile`, `internal/envfile`, and the code that reads and writes the files in `data/`.
- **Cleanup and dead code.**
- **`docs/Decisions.md`.**

What is not yours: features (Account 1) and security findings (Account 3). When you find something in their lane, write it below under **For Account 1** or **For Account 3**, with what you found and how to show it. Don't fix it, don't open an issue, and don't comment on a PR. The one exception: a security finding in storage code that Account 3 has written up under **For Account 2** in `audit-loop.md` is yours, next after failure issues.

## Each round

1. **Your own open PR and branches.** `git fetch origin`, list the open PRs and issues, `git ls-remote origin 'refs/heads/claude/*'`, then `git checkout main && git pull`. Re-read `lanes.md` and this file; if **Paused** is yes, say so and stop the round. Clear **Open items first**. For your open PR, read its head's CI, its mergeability, and any review comments:
   - Green on every check, mergeable, and CI ran on main's current head: squash-merge it (title ending in its number, `expectedHeadSha` pinned). You merge first, so no other lane's green PR holds you back.
   - Main moved since its CI run: merge main in, regenerate what is generated, push, and wait again.
   - Red: find out why. Yours: fix the cause and push. A job may be re-run once to tell a flaky runner from a real failure; a second failure is real.
   - Still running: carry on with the next steps on a new branch, but open no second PR.
2. **Main's health.** A red CI on main, or an open failure issue, comes before anything in **The order**.
3. **For Account 2.** Read the **For Account 2** sections in `features-loop.md` and `audit-loop.md`. A security finding in storage code there comes next, after failure issues only: write the test that shows the hole, then the fix.
4. **The order:** the first item below not yet done, and whose files no other open PR has claimed. Read the code it touches before changing it. Do it whole.
5. **Tests that prove it:** a Go test that fails before your change and passes after (a table test for logic; the fake docker in `cmd/homelab/main_test.go` and `fakebin_test.go` for anything that runs a command; `TestEachReleasesFolderUpgrades` for anything that changes what is on disk). Show it failing first.
6. **Checks** (CONTRIBUTING.md has the full list): `make check`; `make coverage` when Go changes; `make frontend` then `make frontend-check` when the frontend changes; the smoke cases you touched (`SMOKE_ONLY="..." node app/preview/shoot.mjs --smoke`). Fix the cause of anything that fails.
7. **Words:** a line at the top of **Fixed** under `## [Unreleased]` in `CHANGELOG.md`, in plain words about what the household gets. Update the docs the change touches.
8. **Ship:** commit on `claude/fix-<short-name>`, re-check the other open PRs' files (lanes.md Rule 2), push, and open the PR (the repository's template), with `Fixes #N` for each issue it closes, how it was tested (with the failing-before proof), and **Decisions to look at**. Then `subscribe_pr_activity`, one `send_later` about 50 minutes out, and end the turn.
9. **Report** in a few lines: what shipped, what merged, the checks, branches for the owner to delete, what's next.

## The order

Do these in order, one per round. Tick each with its PR number once it is known.

1. **(#429, open)** **The open failure issues, oldest first:** #403 (*Nightly run failed* on 2026-11-04), #404 (*Catalog share 3 failed to start* on 2026-11-04), #421 (*Nightly run failed* on 2026-11-05). Read each run's job logs with `get_job_logs` and `return_content` (artifact and raw-log downloads can be blocked by the proxy), fix the root cause, and close the issue from the PR. If two share one cause, one PR closes both.
2. **App-written lists out of `.env`.** Move these into `data/*.json` through `internal/lockedfile`, one PR per record:
   - `UPDATES_HELD` (`internal/updates`, `cmd/homelab/rollback.go`)
   - `ALERTS_OFF` (`internal/notify`, `cmd/homelab/jobs.go`)
   - `APPS_PINNED` (`internal/api/pinned.go`, `cmd/homelab/pin.go`)

   On first run, read the old `.env` key, carry it over, then remove it, so nothing is lost on upgrade; prove it in `TestEachReleasesFolderUpgrades`. Top-level `data/*.json` goes off-site in the encrypted Secrets job, as `.env` does. Leave every other key the CLI writes where it is: secrets it generates (`NTFY_*`, `ADGUARD_*`, `KOPIA_*`), settings Compose reads (`VAULTWARDEN_SIGNUPS_ALLOWED`), and the owner's choices (`HOMELAB_DOMAIN`, `BACKUP_DESTINATION`). Leave the `<APP>_DIGEST` lines too: `cmd/homelab/versions.go` keeps them in `.env` on purpose, so a restore starts the version that wrote the data.
3. **Records written in place.** Records that more than one process writes with a plain `os.WriteFile` move to `internal/lockedfile`. Start with `data/healed.json` (`cmd/homelab/heal.go`), the watchdog's state (`internal/health/health.go`), `data/battery.json` (`internal/battery`), and the savings history (`internal/savings`), and grep for others under `data/`. `internal/stopped`'s own copy of the lock becomes `lockedfile` too.
4. **Memory and growth.** Anything that only grows, in memory or on disk (logs, alert and outage history, caches), gets a limit or rotation. Measure the agent's memory over an hour where it runs here; the desktop app can't run in a cloud container, so say what wasn't measured.
5. **The database decision**, as a short record in `docs/Decisions.md`: SQLite (pure Go, `modernc.org/sqlite`, no cgo) in `data/`, only for data that grows and is searched, such as the roadmap's action log and the Memory screen's samples. Small state stays in JSON files.
6. **Dead code and duplicates.**
7. **When the order runs out:** run `make check`, `make security`, `make coverage`, and the whole smoke suite (if `govulncheck` can't reach vuln.go.dev here, CI's security job is the check). Chase flaky or slow cases and stale docs, then add 10 new items here.

## For Account 1

- **A Finances smoke case timed out once in CI** (Nov 5, #429's first run, `smoke (light)`): *Finances: a logo picked on a transaction goes with its payee*, `page.waitForSelector: Timeout 5000ms exceeded (waiting for locator('#finSheet') to be hidden)` after a Save. It passed 10 of 10 times locally (light and dark) and #429 touches no frontend. Worth a look at what the Save waits for before the sheet closes; `SMOKE_ONLY="Finances: a logo picked on a transaction goes with its payee" node app/preview/shoot.mjs --smoke` runs it.

## For Account 3

Nothing yet.

## What the last sessions learned

- `internal/lockedfile` (lock beside the file, replaced whole, 0600) and `internal/turn` (one queue for every process's changes) exist; use them.
- Never build `web/dist` in a worktree whose `node_modules` is a symlink.
- A force-push to reset a branch can be refused; merge main in instead.
- A job's whole log: `get_job_logs` with `tail_lines` larger than the log (1500) is too big to show, so it is saved to a file you can grep (`logs_content` in its JSON). The run's zip of logs is blocked by the proxy.
- Nov 4 and 5's nightly failures were all ghcr.io's per-minute limit (`toomanyrequests: retry-after: <µs>, allowed: 44000/minute`), hit by every job at about 11:01 UTC. #429 makes downloads wait it out. If it comes back, look at how long the tries span (`RegistryBusyWaits`) and at any `docker run` that pulls its own image.

## Rules that never bend

1. **Never skip, weaken, or delete a test or check** to get green. Change an expected value only after proving the new one is right.
2. **Never merge red**, a conflict, or a PR with an open review comment you have not answered.
3. **Anything that changes state previews first** or asks for a second click; stopping or removing an app never happens on a single stray click.
4. **Never print, log, or pass secrets** on a command line; read them from `.env` when needed.
5. **The house style**: UI words, CHANGELOG lines, and commit titles are short, plain English about what the household gets (`app/preview/words.mjs` checks, and no Mac word outside a Mac branch). Colours are tokens in `style.css`; shared markup comes from `web/src/parts`.
6. **Every screen stays accessible**: no serious axe finding, every control named, everything reachable by keyboard.
7. **Never touch `VERSION` or cut a release.**
