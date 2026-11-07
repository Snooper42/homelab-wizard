# Lanes: who owns what

Every loop reads this file at the start of every round. Where it and a loop's own file disagree, this file wins. Only the owner changes it.

## The goal (Nov 6, 2026)

The app is to become clearly easier to use. A round that a household member would not notice is a round wasted, unless it fixes a failure, lost data, or a security hole. The owner's complaints are in `.claude/prompts/complaints.md`; every lane reads it at the start of every round and takes the ones in its area first.

| Account | Loop file | Branches | Owns |
|---|---|---|---|
| 1 | `features-loop.md` | `claude/feature-*` | Tidy Up and Finances, end to end: `web/src/tidy`, `web/src/screens/tidy.ts`, `web/src/finances`, `web/src/screens/finances.ts`, `internal/media`, `internal/finance`, `tools/media`, their docs and smoke cases |
| 2 | `maintenance-loop.md` | `claude/fix-*` | Every other screen and what is under it: Setup, Status, Choose and install, an app's page, Updates, Backups, Settings, the menu bar and tray, the phone's screens other than Finances; failure issues; how records are stored, and the SQLite base (ADR-0022) |
| 3 | `audit-loop.md` | `claude/audit-security-*`, `claude/security-*` | Usability testing of the whole app (findings go to the owning lane); security findings and their fixes; `docs/Security.md`, `docs/Usability.md` |
| 4 | (its own) | its own | `apple-client/` (the SwiftUI app). No other lane touches it |

A `claude/*` branch that matches no row is no loop's: leave it alone and list it for the owner.

## Rule 1: your branches only

Never push to, merge, rebase, close, or comment on another lane's branch or PR.

## Rule 2: a file is claimed by an open PR

Each lane has at most one open PR. Before you start an item, and again before each push, list every other open PR's files. If your change would touch one of them, don't push it: take your next item, or wait. The shared files below are the only exception.

## Rule 3: stay in your own work

- A problem in another lane's screens or code goes in your loop file under **For Account N**: what you saw, a screenshot path, and the smoke case that would fail. Don't fix it, don't open an issue, don't comment on its PR. Read the **For Account <you>** sections in the other loop files at the start of every round, and take those items ahead of your own order.
- Account 3 builds no screens. It fixes security holes itself (the smallest fix, in a commit of its own, even in another lane's code when the hole is real and no open PR claims the file). Anything else it finds goes to the owning lane.
- A security finding in storage code: Account 3 writes it up with the test that shows it; Account 2 takes it next, ahead of its order.

## Rule 4: shared files

Only these may be changed by two open PRs at once, each lane adding its own lines:
- `CHANGELOG.md`: only under `## [Unreleased]`; Account 1 at the top of **New** or **Improved**, Account 2 at the top of **Fixed** (or **Improved** for a usability change), Account 3 at the bottom of **Fixed**. A conflict there keeps both lines.
- `web/dist/*`: never merged by hand; after merging main in, `make frontend` with a real `node_modules`, and commit what it builds.
- `coverage-floors.txt`, `docs/Testing.md`, `app/preview/shoot.mjs`, `app/preview/mock.js`: add lines only; keep both.

## Rule 5: merging

- **Order** when more than one lane has a green PR at once: Account 2, then Account 3, then Account 1.
- **A PR merges** when every check is green on its current head, and every commit main gained since that run touches none of its files (a newer `CHANGELOG.md` line on main does not count, provided main merges in with no conflict). Otherwise merge main in and let CI run again. Never merge with a red check.
- Always squash-merge with `expectedHeadSha` pinned to the head CI passed on.
- **At most 3 merges a day per lane.** Batch related fixes into one PR.

## Rule 6: issues

Only Account 2 closes failure issues, from the PR that fixes them (`Fixes #N`).
