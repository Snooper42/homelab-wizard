# Features: the build-out loop

The master prompt for a session that keeps building the [Feature Roadmap](<../../docs/Feature Roadmap.md>) on its own, one finished feature per round, each in its own pull request that it merges once CI is green. Start it from a Claude Code session of your own on this repository (a session another session started cannot run /loop), and send:

    /loop Read .claude/prompts/features-loop.md and do the next round.

With no interval, /loop paces itself. Each round re-reads this file, so to steer the loop, edit it, commit and push it to main, and the next round follows.

**Paused:** no. (Change this to **yes** and push to pause the loop: a round that reads yes merges nothing new, opens nothing new, says it is paused, and waits for the next round.)

---

## Your job

You build out Homelab Wizard's features from [docs/Feature Roadmap.md](<../../docs/Feature Roadmap.md>), on your own, one finished feature per round, for as long as this loop runs. The owner asked for exactly this (November 2026): "on a loop in the background, always improving and pushing requests and merging". So never stop to ask. When a decision is theirs, take the most conservative choice that keeps the app working, write it under **Decisions to look at** in the PR, and carry on.

What the owner values, in their words: small, nuanced touches that set an app apart, "like the right-click settings drop-down I suggested". A right-click menu, an undo, a hover that answers a question, a menu that opens where you expect it. Make each feature feel native on the Mac first (the owner's machine, WebKit), and the same on Windows and Linux.

When the roadmap's list runs out, look the app over as a demanding user would (every screen, desktop and 860px and phone widths, light and dark, more contrast, the keyboard alone, VoiceOver's labels), write at least 10 new items into the roadmap in its sections, push them, and keep going.

## Sharing the repo

No cleanup session runs any more (the owner, Nov 1): each loop merges its own pull requests. The owner's own sessions also work here, and the Finances and audit loops may run again.

- **What is yours:** everything the roadmap covers, except the Finances screen's own code (`internal/finance`, `web/src/finances`, the Finances parts of `serve.go` and `internal/companion`, `app/preview/finance*.json` and `ledger.json`, and the Finances cases in `shoot.mjs`), which is the Finances loop's. Change those only when a feature needs it, in its smallest form, and say so in the PR.
- **Never** touch `VERSION`, cut a release, or merge, close, or push to a pull request that is not yours.
- **One open pull request of yours at a time.** While its CI runs, you may start the next feature on a new branch from main; once the first is merged, merge main into the new branch (never rebase a pushed branch) before opening its PR.
- **Conflicts:** in `web/dist/*`, never merge by hand: resolve the sources, then `make frontend`. In `CHANGELOG.md`, keep both sides' lines. Generated docs: run `./homelab docs`.
- **Main's CI red** for a reason that is not yours: note it in your PR. Fix it in a small PR of its own, merged the same way, only when the cause and the fix are clear; otherwise leave it for the owner.

## Each round

1. `git fetch origin` and `git checkout main && git pull`. Re-read this file; if **Paused** is yes, say so and stop the round.
2. **Your open pull request first**, if there is one: read its head's CI, its mergeability, and any review comments.
   - Green on every check and mergeable: squash-merge it with a title ending in its number (pin the head SHA), then tick its item in the roadmap (below) in the next PR.
   - Red: find out why. Yours: fix the cause and push. Not yours (red on main too): as **Sharing the repo** says. A job may be re-run once to tell a flaky runner from a real failure; a second failure is real.
   - Conflicting: merge main into it, regenerate what is generated, push.
   - Still running: carry on with step 3 on a new branch.
3. **The next feature**: the first item of **The order** below not yet built. Read the code it touches before changing it. Do it whole: a feature that is half there is not shipped.
4. **Tests that prove it:**
   - Go: a table test for new logic; the fake docker (`cmd/homelab/main_test.go`, `fakebin_test.go`) for anything that runs a command.
   - The app: a smoke case in `app/preview/shoot.mjs` for each new behaviour, in light and dark. Check it fails without your change (put back main's `web/dist/app.js` and `style.css`, run the case, restore), so it really tests something.
5. **Checks** (CONTRIBUTING.md has the full list): `make check`; `make coverage` when Go changes; `make frontend` then `make frontend-check` when the frontend changes; the smoke cases you touched and their neighbours (`SMOKE_ONLY="..." node app/preview/shoot.mjs --smoke`). Fix the cause of anything that fails.
6. **Words**: a line in `CHANGELOG.md` under Unreleased (**New**, **Improved**, or **Fixed**), in plain words about what the household gets. Update the docs the change touches (`docs/Testing.md` has a row for each screen's behaviour).
7. **The roadmap**: mark the item *Built* with its PR number, and add a row to **Built** at the top of `docs/Feature Roadmap.md`.
8. Commit on a branch named `claude/feature-<short-name>`, push, and open the PR (the repository's template). Its description: what it does, how it was tested (with the failing-before proof), and **Decisions to look at**.
9. Report in a few lines: what shipped, what merged, the checks, what's next. Then the next round.

## The order

Do these first, one per round, in this order; then the rest of the roadmap, S before M before L within each section, in the roadmap's order of sections. Leave *Mocked up* L items (the Memory screen) until the S and M ones are done.

1. **Stopped on purpose** and **Stop for a while**, together (they share one record). An app the owner stops from the group menu, its page, or (later) a row's menu is recorded as stopped by them, optionally until a time (an hour, tonight at 9 PM, tomorrow at 8 AM). Everything that starts apps by itself skips it: the group menu's Start the N stopped (`groupAct` in `web/src/screens/status.ts`, `GroupMenu` in `web/src/status/AppList.tsx`), the watchdog, the battery saver's resume (`cmd/homelab/battery.go`, `resumeOnPower` in the awake job), and starting apps that waited for a drive (`startFailed`). When the time comes it starts again (the awake job checks each minute). Its row says "Stopped by you" or "Stopped until 9 PM", with Start. The record lives in `data/` beside `battery.json`, so it survives restarts and is backed up.
2. **Right-click an app's row** on Status: Open, Open on a phone, Copy address, Restart, Stop, Stop for a while ▸, Logs, Back up now, Tell me if it stops. Shift+F10 and the context-menu key open it too. A right-click on a group's heading opens the group menu. Reuse `GroupMenu`'s menu: its styles and keyboard.
3. **Undo**: after Stop, Stop all, or Restart all, a note for 10 seconds: "Stopped 6 Media apps · Undo".
4. **Hide amounts**: ⌘⇧H (Ctrl+Shift+H elsewhere) and a View menu item blur every money figure, the sidebar's balances included; kept between launches.
5. **A balance opens its own group**: a sidebar balance opens Net worth on that group's accounts (the click already passes the group: `mountBalances` in `web/src/screens/finances.ts`). Tell the Finances loop's file in the same PR if it is running.
6. **Type to filter Status**, then the **command palette** (⌘K).
7. **Answers on hover**: why an app restarted, the week's outages.
8. **Right-click the sidebar**, then **pinned apps**.

## What the last sessions learned

- The Mac app runs in WebKit, where a mouse click does not focus a button: "close when focus leaves" never fires there. For "a click elsewhere closes it", listen for `mousedown` in the capture phase on the document. In a smoke case, click as WebKit does: `dispatchEvent('mousedown', { detail: 1 })` then `click`, which moves no focus.
- Playwright's trial click does not check what a click would land on. To prove a menu is not cut off, use `document.elementFromPoint` at each item's centre.
- Status's table clipped overflowing menus (`overflow:hidden` for its corners); in `#status` it is visible now, with the corner cells rounded. A menu near the bottom opens upward, measured against `main`.
- Smoke cases that need memory samples pass `mock: { usage }`; the default Status fixture has none.
- The preview loads `web/dist` as built: rebuild with `make frontend` before running a smoke case on a change.
- This session's tools cannot delete a remote branch; GitHub deletes a PR's branch when it merges.
- Background commands that run longer than 10 minutes (a whole `app-smoke`) need `run_in_background` and a longer timeout, or they are cut off and read as failures.

## Rules that never bend

1. **Never skip, weaken, or delete a test or check** to get green. Change an expected value only after proving the new one is right.
2. **Never merge red**, a conflict, or a PR with an open review comment you have not answered.
3. **Anything that changes state previews first** or asks for a second click; stopping or removing an app never happens on a single stray click.
4. **Never print, log, or pass secrets** on a command line; read them from `.env` when needed.
5. **The house style**: UI words, CHANGELOG lines, and commit titles are short, plain English about what the household gets (`app/preview/words.mjs` checks, and no Mac word outside a Mac branch). Colours are tokens in `style.css`; shared markup comes from `web/src/parts`.
6. **Every screen stays accessible**: no serious axe finding, every control named, everything reachable by keyboard.
