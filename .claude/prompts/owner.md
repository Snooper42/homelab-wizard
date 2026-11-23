# For the owner

The one file you need. The loops read it at the start of every session.

**To tell them something:** add a line under **Doesn't work or bugs me** and commit it. On GitHub from your phone: `github.com/Snooper42/homelab-wizard`, this file, the pencil, then *Commit changes* to main.

**To answer a question:** write your answer under it and commit. A loop that asks you also sends a push notification, and carries on with other work while it waits.

## Starting the loops

Once per account: open Claude Code on the web, start a session on this repository, and paste this line, with the account's letter at the end. Each account's first session sets up a scheduled task that keeps it going; `.claude/prompts/lanes.md`, *Which account runs what*, says what each one does and when.

    Run: git fetch origin main && git fetch origin claude/vibrant-mayer-jiim8w:refs/remotes/origin/plan. Read .claude/prompts/lanes.md from origin/main if it has the section "Which account runs what", else from origin/plan (git show origin/plan:.claude/prompts/lanes.md), and follow it as account C.

- **Account C (the fresh one): now.** It sets things up until Tue 9 PM, then runs Quality lightly, then takes over the redesign on Thursday afternoon.
- **Account A (the trial): Tue Nov 24, 9 PM ET,** with `A` at the end. Redesign, flat out, until Thursday noon.
- **Account B (this one): Wed Nov 25, 9 PM ET,** with `B` at the end. Money, for the week.

**To pause a lane:** change **Paused: no** to **Paused: yes** at the top of its loop file and commit.

## Doesn't work or bugs me

Rough is fine: one line each, worst first, naming the screen.

-

## Waiting on you

The loops add questions here: the question, the options, the one they recommend, and what they're doing meanwhile. Write your answer under it.

- **From the redesign (Nov 23):** show your wife the *Finances on a partner's phone* picture (`docs/Redesign.md`, *On the iPhone*). Is that what she'd want?
- **From the redesign (Nov 23):** Setup off the phone's tab bar, with its unfinished steps shown on Status: OK?
- **From the redesign (Nov 23):** the phone's accounts as small cards to swipe, or as a list?

## Answered

The loops move a question here once they've read your answer.

-
