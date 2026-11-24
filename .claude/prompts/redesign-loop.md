# Loop R: Redesign

**Started by** the accounts' start lines in `lanes.md`: the table *Which account runs what* says which account runs lane R when.

**Paused:** no

## The job

Every screen looks and works like its picture in `docs/Redesign.md`, with the app's real data. The pictures are the target and that page's **The pattern** is the rulebook: a screen that matches its picture but breaks the pattern doesn't match. The owner agreed the pictures on Nov 23 and asked for each screen to merge on its own once it matches and CI is green (lanes.md rule 5). Departing from a picture is the owner's call (lanes.md rule 4).

## When a screen matches its picture

Check each of these yourself before you open the pull request, and put the pictures in it:

1. **Side by side.** Your screen from the fake backend (`app/preview/shoot.mjs`, with a smoke case of its own) at 1280×800, beside `docs/images/redesign/<its name>.png`, in light and dark: the same parts, in the same order, and the same cards on the first screen without scrolling.
2. **The card's shape** (`docs/Redesign.md`, *Cards*): title with at most two icon buttons, one figure with smaller cents, a capitalised label, the comparison chip where the data has the period before. No hole beside a short card.
3. **Real data only.** The mock's made-up November is a picture, not data. A part the data can't fill yet is left out, and a line goes under **From the other lanes** in `money-loop.md` (or `quality-loop.md` for Backups' parts).
4. **Still works:** every button, keyboard shortcut, command palette entry and right-click menu the screen had; axe passes (`make app-smoke`); Tab reaches everything in order; 860px and 320px with big text fit, with no sideways scroll; a phone allowed only to look sees no Edit or Add.
5. **The phone's page** (served by `homelab serve`, built from the same `web/src`) at 390px shows the same screen in one column, matching `docs/images/redesign/phone-*.png` where there is one.
6. **The docs' pictures** (`make screenshots`, `docs/images/app-*.png`) redrawn for the screens you changed, in the same pull request.

A smoke case that asserts the old layout: change it to the new one. Never drop a case that covers what the screen *does*.

## Where things are (read the code before relying on this)

- **The sidebar:** its buttons in `web/dist/index.html` (`<nav aria-label="Screens">`); the bank balances under them, on every screen, from `web/src/app.ts` (the comment near line 62) and `Balances` in `web/src/finances/widgets/Worth.tsx`.
- **Shared parts:** `web/src/parts/` (`Card.tsx`, `Row.tsx`, `Segmented.tsx`, `MenuButton.tsx`, `Sheet.tsx`, …). The colours and sizes: tokens in `web/dist/style.css` (`--fin-*`, edited by hand; `app/preview/lint.mjs` checks contrast). `web/dist/app.js` is built by `make frontend`.
- **Finances:** `web/src/finances/Finances.tsx` (its tabs are `groups`, near line 83), `widgets/` (`Now.tsx` checking now and after the paycheck, `Period.tsx` the period bar, `Latest.tsx`, `Trend.tsx`, `Flow.tsx`, `Spent.tsx`, `ComingUp.tsx`, `Budgets.tsx`, `Investments.tsx`, `Worth.tsx`), `Transactions.tsx`, `Edit.tsx` (Update balances and the forms), `Mark.tsx` (logos and marks), `ui/` (charts, the money flow).
- **Status:** `web/src/screens/status.ts`, `web/src/status/` (`AppList.tsx`, `Cards.tsx`, `Tiles.tsx`, `Usage.tsx`).
- **Backups:** `web/src/screens/backups.ts`, `web/src/backups/Backups.tsx`. **Settings:** `web/src/screens/settings.ts`, `web/src/settings/`. **Tidy Up:** `web/src/screens/tidy.ts`, `web/src/tidy/Tidy.tsx`.
- **The mocks:** `app/preview/redesign/` (`make redesign` redraws them). Change a mock only with the owner's yes, and `docs/Redesign.md` with it.

## The work, in order

Each is one pull request unless it says it's split. Tick it in the pull request that finishes it.

- [x] **R1. The card.** One shared component for the card's shape (extend `parts/Card.tsx` or add one beside it): title, up to two icon buttons, figure with smaller cents, label, comparison chip (green or red, an arrow, "vs last paycheck"), and its body. Used first for Finances' lead card, **Left after this paycheck's bills**, with the step chart of checking through the period (from the period's rows that `Now.tsx` and `Period.tsx` already read: each bill a dot, the cushion a dashed line) and Checking now, After payday and Bills left under it. Done when that card matches its part of `computer-finances.png` in light and dark.
- [x] **R2. Finances' frame.** In Finances the sidebar becomes Finances' own: the homelab's screens as a strip of five icons at the top, then Dashboard, Transactions, Budgets, Bills & paychecks, Calendar, Net worth and Reports (in place of the tabs and their second row), then the accounts. One top bar: Add transaction (with its menu), the period (‹ › and Paycheck or Month), hide amounts, customise (where Arrange the Dashboard goes). Gone from Finances: the title, the subtitle, both rows of tabs, the Arrange row and the stopped-app banner. **The bank balances leave every other screen's sidebar.** Every shortcut, palette entry and right-click menu still reaches every page. May be split: the sidebar, then the top bar. **Split (Nov 23):** (a) the sidebar, with Budgets added once R4 makes it a page and Shared with … once M4 ships; (b) the top bar and what leaves Finances' page (the title, the subtitle, the Arrange row, the stopped-app banner).
- [x] **R3. The Dashboard.** The grid of `computer-finances.png` in its order: the lead card (R1), Latest transactions, Net worth, Cash flow, Where the money went, Coming up, Budgets, Investments. Each with its ↗ to what's behind it. Chips only where the View has the period before (M6 adds the rest). Shared with … joins once M4 ships.
  - **The cards the picture doesn't have (the owner, Nov 23):** the notices (Bills not seen, New prices, Bills' averages, Since the balances) stay, at the top, and only when there's something to do. The rest move to the page they belong to, nothing lost: This paycheck and Renewing soon to Bills & paychecks, Checking ahead to Calendar, Looking back and Money flow to Reports, Spent this month to Budgets (Transactions until R4 makes Budgets a page), Goals to Net worth. Customise still brings any card back to the Dashboard.
- [x] **R4. Transactions.** `computer-transactions.png`: the table first; the filters in one row of designed dropdowns (a menu button from `parts/`, in place of the browser's `<select>`), the same filters as now; rows grouped by day with each day's total; the payee's logo, the category's coloured tag, the account, and *Linked to* (the planned bill or paycheck a row paid). Budgets and *This month* move to the Budgets page. At 860px and on the phone, the list. The banks' strip ("3 new from your banks…") once M1 or M2 reports what came in. **Done Nov 24 (the table, Budgets' page); left:** the filters as menu buttons from `parts/` (styled `<select>`s today, to keep the keyboard and every test that picks one), the picture's checkboxes column, and the period from the top bar on Transactions.
- [ ] **R5. The rest of Finances:** Budgets, Bills & paychecks, Calendar, Net worth, Reports and an account's own page, each in the pattern (no picture: follow the pattern and the Dashboard's look, and put the pictures in the pull request). Also: Add a payment's logo picker no longer a Tab stop per logo (usability task 15, item 3: 344 presses of Tab to reach Name).
- [ ] **R6. Status and the homelab's sidebar.** Everywhere outside Finances and Tidy Up the sidebar is Status, Backups, Tidy Up, Finances, Choose apps, with Settings at its foot and one line about the computer. Status leads with one headline ("All good" or "1 app needs you"), then the problems each with its fix, then the apps by category as compact rows, then the rest of today's cards, folded or lower. One problem, one badge. Units in one style (GB and MB, a space before). **Split (Nov 24):** (a) the sidebar's order and Settings at its foot, done; (b) Status's headline card with the problems and their fixes, done Nov 24 (in place of the Running and Needs a look tiles; Start, Logs, Its page); (c) the apps by category as compact rows, today's other cards folded or lower; (d) one badge per problem and the units' style.
- [ ] **R7. Backups** as `computer-backups.png`: Last night with fourteen nights, Needs you, Restore test, Off-site, Each app. *Not in any backup*, *Get something back* and each app's nights join as lane Q's Q4 ships them.
- [ ] **R8. Settings** as `computer-settings.png`: People, Phones, Automatic care, Alerts, Reaching the apps, This Mac; each app's own settings under Advanced. Bank connections joins with M1.
- [ ] **R9. Tidy Up** as `computer-tidy.png`: its sidebar (Overview, each library, the drives), Today with Undo, Needs a look, Needs your OK (the next first; a step that throws things away never gets the main button), the drive, Your libraries, Recently done, Genres. Watched folders and when to tidy behind the settings button; a library's step-by-step clean-up inside its page.
- [ ] **R10. The phone's page.** Each redesigned screen at 390px and 320px with big text against `phone-*.png`: one column, the same cards, four tabs (Setup's unfinished steps on Status), one badge per problem. A partner's three tabs (Finances, Apps, Settings) once M5 ships.
- [ ] **P1. The iPhone app** (`apple-client/`, SwiftUI), after R5: Finances, Transactions, Status, Backups and Settings from the `phone-*.png` pictures, four tabs. How it builds and is photographed: `apple-client/README.md` and `.github/workflows/apple-client.yml` (CI's Mac runners are the only compiler; its pictures come from main through the `iphone-screenshots` branch). One screen per pull request; its CHANGELOG line below the iPhone marker.
- [ ] **R11. Choose apps, an app's page and Setup,** in the pattern (no pictures: follow it, and put the pictures in the pull request).

## From the other lanes

Lanes M and Q add a line here when something R can now lay out has shipped, with its pull request.

- (none yet)
