# For the owner

The one file you need. The three loops read it at the start of every session.

**To tell them something:** add a line under **Doesn't work or bugs me** and commit it. On GitHub from your phone: `github.com/Snooper42/homelab-wizard`, this file, the pencil, then *Commit changes* to main.

**To answer a question:** write your answer under it and commit. A loop that asks you also sends a push notification, and carries on with other work while it waits.

## Starting the loops

On each account, open Claude Code on the web, start a session on this repository, and paste its line:

- **Now, the fresh account (until Tue Nov 24, 9 PM ET):**
  `/loop Run: git fetch origin main claude/vibrant-mayer-jiim8w. Then read .claude/prompts/setup-loop.md from main if it's there, else from the branch (git show FETCH_HEAD:.claude/prompts/setup-loop.md), and follow it.`
- **Tue Nov 24, 9 PM ET, the second account (Redesign):**
  `Read .claude/prompts/lanes.md and .claude/prompts/redesign-loop.md, and follow them.`
- **Wed Nov 25, 9 PM ET, the third account (Money):**
  `Read .claude/prompts/lanes.md and .claude/prompts/money-loop.md, and follow them.`

Redesign's and Money's first sessions each set up a scheduled task on their account that starts a fresh session every 5 hours, picking up where the last one stopped. **To pause a loop:** change **Paused: no** to **Paused: yes** at the top of its loop file and commit.

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
