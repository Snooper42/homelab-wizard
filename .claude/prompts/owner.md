# For the owner

The one file you need. The three loops read it at the start of every session.

**To tell them something:** add a line under **Doesn't work or bugs me** and commit it. On GitHub from your phone: `github.com/Snooper42/homelab-wizard`, this file, the pencil, then *Commit changes* to main.

**To answer a question:** write your answer under it and commit. A loop that asks you also sends a push notification, and carries on with other work while it waits.

## Starting the loops (once per account)

From Wed Nov 25, 9 PM ET, when usage resets. On each account, open Claude Code on the web, start a session on this repository, and paste its line:

- **Account 1, Redesign:** `Read .claude/prompts/lanes.md and .claude/prompts/redesign-loop.md, and follow them.`
- **Account 2, Money:** `Read .claude/prompts/lanes.md and .claude/prompts/money-loop.md, and follow them.`
- **Account 3, Quality:** `Read .claude/prompts/lanes.md and .claude/prompts/quality-loop.md, and follow them.`

That first session sets up a scheduled task on its account, which starts a fresh session every 5 hours. Each one picks up where the last stopped and keeps going until its usage runs out. You don't restart anything.

**To pause a loop:** change **Paused: no** to **Paused: yes** at the top of its loop file and commit. Its next session ends at once. With only two accounts, start R and M; lane Q's reviews then wait, and so do the pull requests that need them.

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
