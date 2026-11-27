# For the owner

The one file you need. The loops read it at the start of every session.

## Run This On Your Mac Tonight (10 Minutes)

The reliability reset (Nov 27, 2026) fixed what's below against fakes. Nothing is `VERIFIED` until you run this on the real Mac and paste the output back. **It changes nothing of the household's:** the live check makes its own throwaway containers, volumes and folder (`homelab-verify-…`, `recovery-staging/verify-live-…`), removes them, and only reads your apps.

**Before you start:** the reset's pull requests must be merged. The newest release on GitHub (Releases) should be dated after them.

### 1. Get the new build (2 minutes)

- **The app:** open Homelab Wizard. Click **Update now** on the line at the top (or quit it and open it again). Settings › This Mac should show the newest version.
- **The homelab folder, in Terminal:**

      cd "<your homelab folder>"        # Settings › This Mac › Homelab folder shows it
      ./homelab upgrade --apply          # a git checkout: the newest files, then up
      ./homelab schedule install --apply # the agent's plist again, with the new PATH

### 2. The live check (5 to 8 minutes; the first run downloads PostgreSQL 17, about 100 MB)

    ./homelab doctor --live             # or: scripts/verify-mac-live.sh (a git checkout)

**What a working Mac prints** (your sizes, versions and paths will differ):

    Live check of this machine (nothing of the household's is changed)

      Result  Check                              What it found
      PASS    Docker engine                      answers: orbstack 28.x OrbStack (/Users/you/.orbstack/bin/docker)
      PASS    Container start, stop, remove      a throwaway container ran, stopped, and was removed
      PASS    A folder shared with a container   a container wrote into the homelab folder as this account
      PASS    A volume backed up and restored    every file came back the same
      PASS    A database dumped and restored     PostgreSQL's dump loaded cleanly into a new database, rows and all
      PASS    Duplicati: a blind restore         a backup made with Duplicati came back from its files alone, every file the same
      PASS    The scheduled agent (launchd)      the plist parses, only you can change it, it runs, and its PATH finds /Users/you/.orbstack/bin/docker
      PASS    Connected app: Sonarr              its key is readable and it answers at http://localhost:8989
      PASS    Disk space: homelab folder, …      412 GB free of 994 GB (41%); not filling (or too few days kept yet to tell)

      9 passed, 0 failed, 0 skipped. …

A `SKIP` is fine when it says why (no Duplicati installed, no connected apps running). **Paste the whole table back**, FAILs included: each FAIL says what it found and what to do.

### 3. Three more readings (2 minutes)

    ./homelab doctor | sed -n '/After a restart/,/^$/p'   # matches System Settings: FileVault, automatic login, start after a power failure
    ./homelab backup --apply 2>&1 | tail -n 5              # no "is not there" or "is empty or missing" line
    ./homelab restore-test --auto 2>&1 | tail -n 5         # ends with a pass; "downloaded N file(s)" first if Proton Drive kept files online only

Paste all three back. Each promotes an item in `docs/Known Issues.md` from `READY FOR MAC VERIFICATION` to `VERIFIED`:

| Your output | Promotes |
|---|---|
| Step 2: the backup, database and Duplicati rows PASS; step 3: backup and restore test | ISSUE-0003, ISSUE-0016 (backups and blind restore) |
| Step 2: the launchd row PASS; step 3: *After a restart* | ISSUE-0005, ISSUE-0007 (scheduled jobs, start after a restart) |
| Step 1 (the app updated and reopened); `./homelab update ntfy` then `./homelab rollback ntfy --apply` | ISSUE-0017 (updates and rollback) |
| Step 2: every *Connected app* row PASS | ISSUE-0015 (app wiring) |
| Step 2: the *Disk space* rows match `df -h ~ /Volumes/Media` | ISSUE-0018 (disk readings and runway) |

### What the reset fixed (Critical and High)

- **Critical, a phone could wipe everything:** the phone's web page offered *Take the homelab off this machine*, with the apps' data and the backups. It's gone, and nothing a phone can call deletes data or backups (C1).
- **A rollback said "your data is back" over a half-restored database:** psql's errors were ignored. Now a dump that doesn't load cleanly stops the rollback (H1).
- **A half-done rollback started the app on a mix of two days' data:** now the app is left stopped, with today's data set aside (H2).
- **A rollback could load last week's database over today's:** now only the dump made for that update is used (H3).
- **`homelab logs --explain` could send a password to the model:** `.env`'s values are now hidden, as elsewhere (H4).
- **An unplugged photos drive was backed up as "every photo deleted," silently,** and a missing backup folder went unnoticed. The nightly backup now fails and alerts on both (H5, H6).
- **A restore from Proton Drive on a new Mac could read placeholders instead of files:** they are downloaded first (ISSUE-0003).
- **Under Docker Desktop, the nightly agent couldn't find its credential helper,** so its pulls failed (ISSUE-0005).
- **An app update whose new version couldn't start left the app stopped:** it now goes straight back to the version it ran (ISSUE-0017).

The whole audit, Medium items included: `docs/SRE-Audit-2026-11.md`.

### Only you can do these

- **Apple Developer ID signing and notarization:** the Mac build is signed ad hoc today, so Gatekeeper and Login Items treat it as unknown. `docs/Releasing.md` lists the secrets to add to the repository (a Developer ID certificate and an app-specific password, from a $99/year Apple Developer account).
- **Backup engine go/no-go:** the audit's assessment (`docs/SRE-Audit-2026-11.md`, *Duplicati or Restic?*) recommends making Kopia, which the homelab already ships, the main engine, rather than adding Restic, over about 4 to 6 pull requests, with Duplicati kept read-only for its year. Write **go**, **not now**, or **Restic instead** under *Waiting on you*.
- **After a power cut:** decide whether this Mac should come back by itself. Turn on *Start up automatically after a power failure* (System Settings › Energy) and use `sudo fdesetup authrestart` for macOS updates. Turning FileVault off for automatic login is a security trade only you can make. Doctor's *After a restart* says where you stand.

**To tell them something:** add a line under **Doesn't work or bugs me** and commit it. On GitHub from your phone: `github.com/Snooper42/homelab-wizard`, this file, the pencil, then *Commit changes* to main.

**To answer a question:** write your answer under it and commit. A loop that asks you also sends a push notification, and carries on with other work while it waits.

## Stop-the-line reliability reset (Nov 27, 2026)

All feature work, redesigns and polish are paused. Every account runs one lane, **Core Reliability** (`lanes.md`), through the phases in `.claude/prompts/reset-progress.md`. The rules are in `CLAUDE.md` at the repository's root.

**What "done" means now:** `MERGED` is CI green against fakes. `VERIFIED` is only ever set from output you ran on your Mac and pasted back. Until then a real-hardware item says `READY FOR MAC VERIFICATION`.

**Your decisions, locked in (Nov 27):**
- **Wiping from the phone's web page:** hard no. A phone or web page can never wipe the homelab, the apps' data, or the backups; that needs someone at the computer and an explicit CLI confirmation.
- **30-day CPU and memory samples for Analytics:** skipped. Health focuses on "is something broken?" and plain-English disk-full runway warnings.
- **"Move the apps' data…" button:** deferred.
- **Frozen:** new features in the iPhone and iPad app, Finances, Ollama log explanations, and new catalog apps (critical security or data-loss fixes only).
- **Paused lanes:** R (Redesign), M (Money), W (Phone Web).

## Starting the loops

**During the reset every account runs Core Reliability** (`lanes.md`); the per-account lanes in the list below are history. The start line is unchanged.

Once per account: open Claude Code on the web, start a session on this repository, and paste this line, with the account's letter at the end. Each account's first session sets up a scheduled task that keeps it going; `.claude/prompts/lanes.md`, *Which account runs what*, says what each one does and when.

    Run: git fetch origin main && git fetch origin claude/vibrant-mayer-jiim8w:refs/remotes/origin/plan. Read .claude/prompts/lanes.md from origin/main if it has the section "Which account runs what", else from origin/plan (git show origin/plan:.claude/prompts/lanes.md), and follow it as account C.

- **Account C (the fresh one, ends after a week): now.** It sets things up until Tue 9 PM, then runs Quality, then takes over the redesign from Thursday afternoon until it ends (assumed Mon Nov 30, noon: correct that in `lanes.md` if it's different).
- **Account A (the trial, ends Thursday): Tue Nov 24, 9 PM ET,** with `A` at the end. Redesign, flat out, until Thursday noon.
- **Account B (yours, the one that lasts): Wed Nov 25, 9 PM ET,** with `B` at the end. Money until Monday; then everything, alone: anything broken, then Money and Redesign by turns.

**To pause a lane:** change **Paused: no** to **Paused: yes** at the top of its loop file and commit.

## Try it on your machine (Nov 24)

What changed on the night of Nov 23, to try on the real thing. Write what's wrong under **Doesn't work or bugs me** below, one line each; the loops read it first.

**The computer** (it updates itself: let it look, then **Update now**, or quit and open it; Settings › This Mac should say the newest version):
1. **Finances' sidebar:** five small icons at the top, then Dashboard, Transactions, Bills & paychecks (Recurring and Paychecks under it), Calendar, Net worth, Collection, Reports, then your accounts. On Status or Backups, no bank balances in the sidebar.
2. **The top bar:** **Add a transaction ▾** (the ▾ has the other adds, Update balances, Export), your paycheck's name over its days with ‹ ›, Paycheck or Month, the eye, and the customise button.
3. **The Dashboard:** *Left after this paycheck's bills* first, with its chart and the three figures under it; Latest transactions beside it; Net worth, Cash flow, Where the money went, Coming up, Budgets to watch, Investments with this month's change.
4. **Where the other cards went:** This paycheck on Paychecks; Renewing soon and Where it goes on Recurring; Checking ahead on Calendar; Looking back and Money flow on Reports.
5. **Back buttons:** an app's page from Status (*‹ Status › its name*), an account's page from Net worth, Transactions opened from a Dashboard card.
6. **Your real numbers:** does *Left after this paycheck's bills* match your own sums? Does *+x% this month* on Investments look right?

**Added Nov 24** (merged through the day; each arrives as a new version, as above):
7. **Transactions:** a table: date, payee with its logo, the category as a coloured tag, the account, *Linked to*, the amount; each day's total in its band. Are the names level with their logos now?
8. **Budgets:** its own page in Finances' menu, with This month at the top (*vs last month* as a chip beside Money out).
9. **Status:** (its sidebar changed since: see 15) one headline, *All good* or *1 app needs you* with Start, Logs and Its page; Backups and This Mac beside it; each category one row with its apps' icons and a green *✓ 4 running* pill; Instead of subscriptions below the apps. A stopped app badges Status only, not Backups as well.
10. **Backups:** *Last night* (how many copied, what was skipped) with *Needs you* beside it; the restore test and off-site as cards; each app's copy one line, two to a line.
11. **Settings:** (its list is in the sidebar now: see 15) opens on *General*: People, Phones, Automatic care's three switches (they save at once), Alerts, Reaching the apps, This Mac. The list on the left in the same order, each app's own settings under *Advanced*.
12. **Tidy Up:** *What I did today* first with *Needs a look* beside it; the folders and when to tidy behind **Folders and when…**, **Tidy up now** beside it; its own menu in the sidebar (Overview, each library, the drive).
13. **The rest of Finances:** Net worth's three figures in one row; ↗ in place of *See all*; Paychecks' tiles level; *Income* without a gap before it.
14. **On your phone in the browser** (the companion): Backups' night in one line, the restore test and off-site side by side.

**Added later on Nov 24:**
15. **One sidebar everywhere:** on every screen, the homelab's screens are a row of icons at the top, then that screen's own pages (Status: Overview and each category; Backups: Last night, Needs you, Restore test, Off-site, Each app; Settings: its pages with their icons; Choose apps, Setup, Finances and Tidy Up their own), then Settings and *412 GB free · plugged in* at the foot. Nothing in it moves or animates as you switch screens. Is it the same on every screen?
16. **Transactions:** a line over the table with how many, what came in and what went out; **This paycheck** and **Last paycheck** in the date picker.
17. **Backups and Setup** have no line under their title any more, as Status.
18. **On your phone in the browser:** Status shows **This machine** (free space, plugged in, the nightly updates) beside Backups.

**The iPhone:** build it in Xcode as usual; Settings › About should show the same version as the computer's Settings › This Mac. Redesigned on Nov 24:
- **Status:** *1 app needs you* (or how many) with the app and Start, Logs, Its Page; **Backups** and **This Machine** side by side under it (its free space should match the computer's); the categories as one **Apps** card, a row each with logos and *✓ 4 running*, a tap opening it, a long press for Start, Restart, Stop.
- **Backups:** **Last night** (11 of 12 copied, when, where to, a chip for what was skipped) with Back Up Now and Test a Restore; **Needs You** in one list with Start beside a stopped app's copy; **Restore test** and **Off-site** as two cards.
- **Settings:** **Household** (phones), then **Automatic Care** (nightly updates, restart, undo, quiet hours, alerts).
- **Finances:** opens on **Left after this paycheck's bills**, the figure the computer's Dashboard shows, with checking day by day as a chart (a dot at each bill), and **Now**, **Payday** and **Bills** under it. Does the figure match the computer's?

## Doesn't work or bugs me

Rough is fine: one line each, worst first, naming the screen.

-

## Waiting on you

The loops add questions here: the question, the options, the one they recommend, and what they're doing meanwhile. Write your answer under it.

- **Why you see nothing change (account C, Nov 23):** what I found, and two questions only you can answer.
  - **The computer's app:** every change to main that touches it is published as a numbered release, with the Mac, Windows and Linux files: the newest is **0.40.3, Sat Nov 21, 1:52 PM ET**. The two changes merged after it were the iPhone app's only, so the computer's app hasn't changed since Saturday afternoon. Your Mac looks for a new build every 15 minutes and downloads it, but puts it in place only when you click **Update** or quit the app (with *install when the app quits* on): an app left open all the time keeps the old one. Its update tests pass, and each build's Mac download count suggests your Mac fetches them.
  - **The iPhone app:** most of the last days' work (Bills, Edit payment, Budgets, Sort, This month) was the iPhone app's, and it reaches you only when you build it in Xcode; a build lasts 7 days with a free Apple ID. From this change on, the phone shows the computer's version number (Settings › About), so the two can be compared at a glance.
  - **Question 1:** what version does Settings › This Mac show on the computer? (0.40.3 is the newest.)
  - **Question 2:** when did you last build the iPhone app in Xcode?

  Meanwhile the loops carry on with the redesign's card (S3).
## Assumptions the agents made

Small engineering choices made without asking (`CLAUDE.md`, rule 8): the safest option, written here so you can overrule it.

- **Immich's restore fix applied to every PostgreSQL dump load (Phase 2, H1):** the dump's `set_config('search_path', '', false)` line is rewritten as Immich's own restore instructions do. pg_dump names every object with its schema, so the other apps' loads are unchanged; without it, an Immich rollback would now fail loudly on its indexes.
- **A dump load fails on any psql error but two (Phase 2, H1):** "current user cannot be dropped" and "role … already exists", which every `pg_dumpall --clean` load prints. If a real load on the Mac prints another harmless one, the rollback stops with the app left stopped and today's data kept. Paste its output and it is added to the list.
- **A rollback that only partly put the data back leaves the app stopped (Phase 2, H2),** rather than starting it on a mix of both days. Starting it again is a click once someone has looked.
- **The nightly backup fails when the photos' drive is unplugged (Phase 2, H5),** but only for a job that has backed up before, so a homelab without photos is never flagged.
- **The computer's own Settings keeps *Take the homelab off this machine*** behind its typed confirmation: "local host access and explicit confirmation". Only the phone's web page lost it.

## Parked with lane R (paused)

Not asked again until the redesign lane is unpaused.

- **From the redesign (Nov 23):** show your wife the *Finances on a partner's phone* picture (`docs/Redesign.md`, *On the iPhone*). Is that what she'd want?
- **From the redesign (Nov 23):** Setup off the phone's tab bar, with its unfinished steps shown on Status: OK?
- **From the redesign (Nov 23):** the phone's accounts as small cards to swipe, or as a list?

## Answered

The loops move a question here once they've read your answer.

- **Account C's scheduled task (Nov 23):** a session isn't allowed to make one, so you made *Homelab loop, account C* by hand (every 5 hours at 4 past, a custom cron). **Do the same for A and B** when they start, named exactly *Homelab loop, account A* (every 3 hours: `4 */3 * * *`) and *Homelab loop, account B* (every 5 hours: `4 */5 * * *`), each with its start line as the instructions: a session looks for that exact name.

- **Wiping the homelab from the web page (asked Nov 26; answered Nov 27):** hard no, stricter than option (c): the web page cannot take the homelab off the machine at all, and nothing reachable from a phone deletes data or backups. Removed in the reset's Phase 2 pull request.
- **Analytics' week (asked Nov 25; answered Nov 27):** (c) skip: no 30-day CPU and memory samples.
- **Moving the apps' data (asked Nov 25; answered Nov 27):** deferred: no move button for now.
