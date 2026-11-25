# For the owner

The one file you need. The loops read it at the start of every session.

**To tell them something:** add a line under **Doesn't work or bugs me** and commit it. On GitHub from your phone: `github.com/Snooper42/homelab-wizard`, this file, the pencil, then *Commit changes* to main.

**To answer a question:** write your answer under it and commit. A loop that asks you also sends a push notification, and carries on with other work while it waits.

## Starting the loops

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
- **From the redesign (Nov 23):** show your wife the *Finances on a partner's phone* picture (`docs/Redesign.md`, *On the iPhone*). Is that what she'd want?
- **From the redesign (Nov 23):** Setup off the phone's tab bar, with its unfinished steps shown on Status: OK?
- **From the redesign (Nov 23):** the phone's accounts as small cards to swipe, or as a list?
- **From the redesign (Nov 25): Analytics' week.** Nothing on the machine keeps the processor and memory over time: Status samples them only while it's open. So Analytics draws the minutes since Status opened, and says *A week isn't kept yet*. Drawing your picture's week and month needs the agent to keep a sample (new work, lane Q's Go side):
  - **(a) Recommended:** the agent keeps one sample every 5 minutes for a month, in a small file in the homelab's data folder (about 1 MB; nothing leaves the machine). Then Day, Week and Month, the nightly jobs dotted.
  - **(b)** Read Beszel's history where Beszel is installed (nothing kept by us, but only with Beszel).
  - **(c)** Keep it live only.

  Meanwhile Analytics shows what exists, and the redesign carries on with the phone's page.

## Answered

The loops move a question here once they've read your answer.

- **Account C's scheduled task (Nov 23):** a session isn't allowed to make one, so you made *Homelab loop, account C* by hand (every 5 hours at 4 past, a custom cron). **Do the same for A and B** when they start, named exactly *Homelab loop, account A* (every 3 hours: `4 */3 * * *`) and *Homelab loop, account B* (every 5 hours: `4 */5 * * *`), each with its start line as the instructions: a session looks for that exact name.
