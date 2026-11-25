# Merge handoff: the web page and the redesign (Nov 25)

For the session running lane R ("Account A: Redesign"). The owner spent Nov 25 in another session deciding how the
phone's page (`homelab serve`) and Status should look; much of it changes the computer too. Your job: **merge that
with what you're doing, write one combined handoff, and start a fresh session from it.** Spend as few tokens as you
can: read the files named here, not the history behind them.

## 1. Get it (2 commands)

    git fetch origin main claude/quirky-ramanujan-jfgtq2
    git log --oneline origin/main..origin/claude/quirky-ramanujan-jfgtq2   # PR #891, open; CI watched by its session

Read files from that branch with `git show origin/claude/quirky-ramanujan-jfgtq2:<path>`. Don't check it out over
your own work.

## 2. Read only these (in this order)

1. `docs/Redesign.md`, sections **Cards** (two new rules) and **The phone's page** through **Toward 1.0** (≈90 lines).
2. `.claude/prompts/web-loop.md`, sections **The focus**, **Rules** and the item titles (`rg -n '^- \[' `), not the bodies.
3. `.claude/prompts/redesign-loop.md` › **R12** (new, one paragraph).
4. Pictures, only if you'll build that screen (`docs/images/redesign/`, each with `-dark`):
   `web-wide.png` + `web-wide-ok.png` (Status, both states) · `computer-category.png` (+ `-full-dark`) ·
   `web-category*.png` · `web-analytics.png` (+ `-full`, `-phone`). Drawn by `app/preview/redesign/web.mjs`.

## 3. What the owner decided (Nov 25), in one place

**Rules for every screen (now in Redesign.md › Cards; they override older pictures):**
- **Never "needs you".** Name what happened: *Decypharr stopped*.
- **Cards in a row share one anatomy:** title row, one figure on the same line, one line under it, a footer pinned to the bottom. No boxes inside cards, no wrapping figures, no empty band.
- **Every card drawn in every state** (all well, one problem, several, no data). A card never appears, disappears or resizes; the card is the thing a problem belongs to (Apps), never the problem (Stopped).
- **Logos everywhere,** your own apps included; letters only when none can be found.

**Status (computer and phone's page alike):**
- Sidebar menu: Overview, **Analytics**, each category, **Your own apps last** (box icon, never +). **No "Stopped" item**: an amber dot by a category's count.
- Overview's top row: **Apps** (always; all well = count + 14 days of squares; stopped = amber count, the app named, Start · Logs · ⋯), **Backups**, **The server/This Mac**. Same anatomy.
- **A category's page** (click Network, Media…): *On this Mac/server*: big-icon tiles 3 across (status dot, one live line, Open or Start, ⋯); then *Add to <category>*: **every** catalog app not installed, faded, Install. No widgets, no "More" tile. CasaOS is the reference for feel only. Soft violet/teal backdrop, see-through tiles (the tester liked it).
- **Analytics** (its own screen): Day/Week/Month; Processor · Memory · Drives cards; the week as two charts on one timeline (% and GB), nightly jobs dotted; what each app uses with its week as a line, 8 then Show all.
- **Toward 1.0:** *Add to …* is an app store shelf; the catalog grows as data.

**The phone's page (lane W, `web-loop.md`):** built for every device, the iPhone Duo first (≈382 folded, 669/951 unfolded: it crosses today's 700 px switch). Owner's answers: push alerts yes (opt-in), passkey lock optional, **no** Finances kept on the phone, Choose apps on the phone mocked first, server words yes ("The server", no stay-awake step), reskinning (W16) to talk through, other lanes keep running, account B runs W by turns with M.

**Also on PR #891:** a git checkout now shows its real version (newest release tag, not `VERSION`'s 0.17.0).

## 4. Then do this

1. List your own state in ≤15 lines: branch, open PR, what's half-done, next item.
2. Write **`.claude/prompts/next.md`** (≤120 lines, pointers not prose): §3 above, condensed; your state; the merged
   next steps in order (R12 and W3/W5a overlap: say who builds what, once); open questions for the owner.
   Wherever a decision above contradicts your in-flight work, the owner's Nov 25 decision wins; note what changes.
3. Commit it to your branch with your current work, push, and say so in your PR's **Next**.
4. Reply to the owner with this one line, and stop:

       Read .claude/prompts/next.md from origin/<your branch> (git show), then follow it. Don't read anything it doesn't point to.
