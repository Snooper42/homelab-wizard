# Next: lane R after Nov 25 (the redesign and the web page, merged)

For the next session running lane R (account A until Thu Nov 26 noon ET, then account C from Thu 2 PM: `lanes.md` ›
*Which account runs what*). Written Nov 25 by account A's lane R session, merging its work with the owner's Nov 25
decisions from the web-page session (`merge-nov25.md` on `claude/quirky-ramanujan-jfgtq2`, PR #891).
**Read only what this file points to.** Where a decision below contradicts older pictures or notes, it wins.

## 1. The owner's Nov 25 decisions (the rules every screen follows now)

- **Never "needs you".** Name what happened: *Decypharr stopped*, *2 apps stopped*, *2 backups failed*.
- **Cards in a row share one anatomy:** title row; one figure on the same line in every card; one line under it;
  a footer pinned to the bottom at the same height. No boxes inside cards, no wrapping figures, no empty band.
- **Every card drawn in every state** (all well, one problem, several, no data). A card never appears, disappears
  or resizes; the card is the thing a problem belongs to (**Apps**), never the problem (*Stopped*).
- **Logos everywhere,** your own apps included; letters only while none is found.
- **Fewer words** (Nov 24 and 25: *"way too much wording … removed from everywhere within the app and web page"*):
  a line that only explains a screen, card, switch or tap goes; facts, warnings, privacy notes and what a delete or
  move does stay. Never a sentence restating figures the card already shows.
- **Status (computer, phone's page, iPhone app alike):** menu = Overview, **Analytics**, each category, **your own
  apps last** (box icon, never +); **no *Stopped* item** (an amber dot by a category's count). Overview's top row:
  **Apps** (always: all well = count + 14 days of squares; stopped = amber count, the app named with its logo,
  Start · Logs · ⋯; two or more = Start all · See them), **Backups**, **the server / This Mac**.
- **A category's page:** *On this Mac/server*, big-icon tiles three across (two on a phone): status dot, one live
  line, Open or Start, ⋯; then *Add to <category>*: **every** catalog app not installed, faded, Install. No widgets,
  no *More* tile. Soft violet/teal backdrop, see-through tiles. CasaOS for feel only (ideas, never its look).
- **Analytics** (its own screen, under Overview): Day/Week/Month; Processor · Memory · Drives cards; the week as two
  charts on one timeline (% and GB), nightly jobs dotted; each app's use with its week as a line, 8 then Show all.
- **Toward 1.0:** *Add to …* is an app store's shelf; the catalog grows as data, one catalog call for every device.
- **The phone's page (lane W):** every device, the iPhone Duo first. Push alerts yes (opt-in); passkey lock
  optional; **no** Finances kept on the phone; Choose apps on the phone mocked first; server words yes; reskin (W16)
  to talk through; account B runs W by turns with M.

Where it's written: `docs/Redesign.md` › *Cards*, *The phone's page* … *Toward 1.0* (on #891's branch until it
merges); `web-loop.md` › *Rules* and item titles; `redesign-loop.md` › R12. Pictures (`docs/images/redesign/`,
each with `-dark`): `web-wide.png`, `web-wide-ok.png`, `computer-category.png` (+`-full-dark`), `web-category*.png`,
`web-analytics.png` (+`-full`, `-phone`). Only open a picture for the screen you're building.

## 2. State (Nov 25, 7:15 PM ET)

- **Open:** #894 `claude/redesign-iphone-quiet-heroes`: Cash Flow and Month in Review as plain cards (iPhone), and
  a Windows test fix (`TestWriteOutlastsAReaderOpeningItAgainAndAgain`, a millisecond between reads). Merge per
  rule 5 when green (main unchanged in its files, CHANGELOG aside); one comment on the PR says why the test changed.
- **Pushed, not opened:** `claude/redesign-iphone-fewer-empties` (two commits, stacked on #894: rebase
  `--onto origin/main 4ca537f` after #894 merges; CHANGELOG conflicts keep both lines): the iPhone's empty
  Recurring and Alerts, Add Payment's footer, a later Calendar day, the iPad's empty Setup pane; the computer's
  *Found in your transactions*, *Subscriptions in Wallos*, *Bills not seen yet* and a loan's links, fewer words.
  Finances smoke passes locally (960; Wallos, bills not seen, loans re-run).
- **Merged Nov 25 (#882–#893):** Backups' fourteen nights (computer and iPhone); iPhone Settings, Status buttons,
  Transactions (heading, day headings, review strip line), fewer words (Goals, This Month, forms, Recurring,
  Spending); Money Flow's sentence gone (iPhone) and *, from your transactions / the plan* (computer).
- **P1 (the iPhone app)** is at its `phone-*.png` pictures except what waits: *Not in any backup* and *Get something
  back* on the phone (a phone call, lane Q, rule 6), *Shared with …* (M4).
- **Notes left for Q** (`quality-loop.md` › From the other lanes): Make's `coverage` hides which test failed;
  `TestTakeWaitsItsTurn` and `TestWriteOutlastsAReader…` were too tight for Windows CI (both fixed in tests).
- Safety check-in: trigger `trig_01Ucs3yH9DDMx49CjpKXTtAg` (*Re-check lane R's open PR*); re-arm or delete it.
- Branch `claude/redesign-iphone-a-day` is still on the remote: deleting it needs the owner's yes (rule 13).

## 3. What the Nov 25 decisions change in work already done

- **iPhone Status** (#838–#886) shows *1 app needs you* and a card that appears only while something's stopped:
  becomes **Apps** always first (count + 14 days; stopped: amber count, the app named, Start · Logs · ⋯), same
  anatomy as Backups and This Mac beside it. `StatusHeadline.title`, `StatusAlertCard`, `HeroButtons(wide:)`.
- **iPhone Backups' *Needs You*** section and the computer's Backups *Needs you* tile: rename (*Skipped*, or what
  happened). The computer's and phone's page's words are W2's; the iPhone app's (`apple-client/`) are R's.
- **The computer's Status** keeps *Needs you* / *Stopped* in its menu today: R12 removes the item (amber dot).
- Cards built differently in one row (Backups' top tiles, Status' pair): bring each row to one anatomy as you touch it.

## 4. Next, in order (who builds what, once)

1. **Land #894, then open `claude/redesign-iphone-fewer-empties`.** One open PR at a time.
2. **R12 + Status' Overview on the computer** (R): category pages (*On this Mac*, *Add to <category>*, Install via
   the computer's flow), menu without *Stopped* (amber dot), **Analytics** item under Overview, *Your own apps*
   last, Overview's first card **Apps** in every state (`web-wide*.png`). Files: `web/src/screens/`,
   `web/src/status/`; check no W pull request holds them first (`lanes.md` rule 2). Lane W's W5a (a) follows on
   the phone's page from the same screens; W5a (c) (the read-only catalog call for the phone, Q's review) and
   (d) are W's. W3 (the phone's page's sidebar) is W's alone.
3. **Analytics on the computer** (R builds the screen in `web/src/status/` from `web-analytics.png`; W18 checks it
   on the phone's page at its sizes). Data already there: `StatusBoard` `usage`, `storage`, the kept history, the
   jobs' times. If the other account's analytics mock differs, ask the owner which wins (W18 says so).
4. **"Needs you" out of the iPhone app** (R, P1): Status as *Apps* always (§3), Backups' section renamed. W2 does
   the computer and the phone's page, and adds `needs you` to `app/preview/words.mjs`; take its words list once
   it lands so the iPhone's strings match.
5. **Logos everywhere** (W17 for catalog/own apps' data; R uses them wherever a row has letters today).
6. **Fewer words, continuing** across the iPhone app and the computer: footers and leads that only explain.
7. Then `redesign-loop.md`'s remaining P1 pieces as their lanes ship (Q's phone call for gaps, M4 for sharing).

Stop starting new work Thu Nov 26 10 AM ET (account A); account C takes over Thu 2 PM with Q's reviews first.

## 5. Open questions for the owner (in `owner.md` › *Waiting on you*; ask there, don't wait on them)

- Setup off the iPhone app's tab bar (four tabs), its unfinished steps on Status? (asked Nov 23)
- The owner's dark look (MoneyMatter-style, the iPhone's) on the computer app too?
- Analytics: the web-page session's mock or another account's, if they differ?
- R12's Install on the computer: straight in, or the plan shown first (R12 says the plan first)?

## 6. How this lane works (unchanged)

`lanes.md` (every rule), `redesign-loop.md` (R items, P1 notes, *From the other lanes*), `owner.md`. Branches
`claude/redesign-*`; squash-merge with the full 40-character `expectedHeadSha` when every check is green and main
gained nothing touching the PR's files; CHANGELOG lines under the right marker; the iPhone app is compiled only by
CI (`build-and-test`); the computer: `make frontend`, `make frontend-check`, `SMOKE_ONLY=… node app/preview/shoot.mjs
--smoke`. MoneyMatter is AGPL: ideas only (rule 11).
