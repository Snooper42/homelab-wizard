# Lanes: three accounts, no conflicts

Three loops work on this repository at once, each from its own account. Every loop reads this file at the start of every round. Where it and a loop's own file disagree, this file wins.

| Account | Loop file | Its branches | What it owns |
|---|---|---|---|
| 1 | `features-loop.md` | `claude/feature-*` | The roadmap's features; `docs/Feature Roadmap.md` |
| 2 | `maintenance-loop.md` | `claude/fix-*` | Failure issues (*Nightly run failed*, *Catalog share N failed*); how records are stored (`internal/lockedfile`, `internal/envfile`, and the code that reads and writes the files in `data/`); cleanup and dead code; `docs/Decisions.md` |
| 3 | `audit-loop.md`, as the security team | `claude/audit-security-*` and `claude/security-*` | Security findings and their fixes; `docs/Security.md` |

## Rule 1: your branches only

Never push to, merge, rebase, close, or comment on another lane's branch or PR. A `claude/*` branch that matches no row above is no loop's: leave it alone, and list it for the owner in your report.

## Rule 2: a file is claimed by an open PR

Each lane has at most one open PR. Before you start an item, and again just before each push:

1. List every other open PR, whatever its branch (other lanes, and sessions with no row above), and the files each one changes (`pull_request_read` with `get_files`).
2. If your change would touch any file in one of them, don't start it, and don't push it. Take your next item instead, or wait until that PR is merged.
3. The shared files in Rule 4 are the only exception.

So two open PRs never change the same file, and neither can conflict with the other.

## Rule 3: stay in your own work

- Account 2 does not fix security findings. Account 3 does not take storage, cleanup, or failure issues. Neither builds features.
- When you find something in another lane, write it in your own loop file under **For Account N**, with what you found and how to show it. Don't fix it, don't open an issue, and don't comment on a PR.
- At the start of every round, read the **For Account <you>** section in the other two loop files.
- **A security finding in storage code** (a record written in place, a lock that can be raced): Account 3 writes it up in `docs/Security.md` and under **For Account 2**, with the test that would show the hole. Account 2 takes it next, ahead of its own order (after only failure issues), and writes that test and the fix. Account 3 ticks it in `docs/Security.md` in its next PR, after the fix is merged.
- Each lane edits only its own loop file. Only the owner changes this file.

## Rule 4: shared files

Only these may be changed by two open PRs at once:
- `CHANGELOG.md`
- `web/dist/*`
- `coverage-floors.txt`
- `docs/Testing.md`
- `app/preview/shoot.mjs`
- `app/preview/mock.js`

How each lane writes to them:
- **CHANGELOG.md:** only under `## [Unreleased]`, each lane in its own place:
  - Account 1 at the top of **New** or **Improved**
  - Account 2 at the top of **Fixed**
  - Account 3 at the bottom of **Fixed**
  A conflict there is always resolved by keeping both lines.
- **`web/dist/*`:** never merged by hand. After merging main in, run `make frontend` with a real `node_modules` (not a symlink: esbuild writes the linked path into the output, and CI's frontend-check fails) and commit what it builds.
- **The others:** both sides only add lines. Keep both.

## Rule 5: one merge at a time, in order

- When more than one lane has a green PR, they merge in this order: **Account 2, then Account 3, then Account 1.** Before you merge, check whether a lane ahead of you has a green, mergeable PR. If one does, don't merge: check again at your next check-in.
- After any merge to main, every other open PR merges main in and lets CI run again before it may merge. Never merge on a CI run older than main.
- Always squash-merge with `expectedHeadSha` pinned to the head that CI passed on.

## Rule 6: issues

Only Account 2 closes failure issues, from the PR that fixes them (`Fixes #N` in its description). The other lanes leave them alone.
