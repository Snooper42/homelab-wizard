# Loop W: The phone's page

**Started by** account B's start line (`lanes.md`: M and W by turns from Wed Nov 25, 9 PM; the owner, Nov 25), or by the launcher below.

**Paused:** no

## The focus (the owner, Nov 25)

*"I want to only focus on the web page component. This needs to be perfect across all possible platforms. And let's try and optimize for iPhone Duo."*

So this is the only work: the phone's page, on every device and browser people actually use, with **the iPhone Duo (Apple's foldable) first.** Nothing outside this file's items, and nothing in `apple-client/`, Finances' data or the computer-only screens. The other lanes keep running (the owner, Nov 25); `lanes.md` rule 2 keeps you apart.

## Why this lane exists

The owner, Nov 25: *"I think they should kinda be in parallel in case there are more people like my buddy that'll only use it via the web."* A tester runs the homelab on a rented server (Ubuntu 24.04, no screen, tailnet only) and sees it only through the phone's page (`homelab serve`), from a phone and a tablet. For him and anyone like him, **the phone's page is the whole product.** Lane R builds every screen for the computer; this lane makes sure each one arrives on the phone's page as well, at every size, and adds what only a web page can do (alerts on the Lock Screen, a passkey lock, working offline).

The phone's page is the computer's own screens (`web/dist`, the same bundle) drawn under `html.companion`, with `web/dist/companion.js` sending each call to the computer, which answers only the calls in `phoneMethods` (`cmd/homelab/serve.go`). So most of the redesign reaches it automatically. The gaps are where the page is told to be different: CSS scoped `html.companion` / `html:not(.companion)`, code behind `onPhone()`, and calls missing from `phoneMethods`.

**The target:** the four pictures in `docs/Redesign.md` › *The phone's page* (`docs/images/redesign/web-*.png`, drawn by `app/preview/redesign/web.mjs`), plus the `phone-*.png` pictures for the screens they don't cover:

| Picture | What it is |
|---|---|
| `web-wide.png` | A tablet or wide window (1280×800): the computer's sidebar, the screens as a strip of icons, then Status' own menu; the stopped app, Backups, the server; each category |
| `web-status.png` | A phone added to the Home Screen (390×844): Status, *Alerts on this phone* offered once, the stopped app with Start, Logs, Its page |
| `web-app.png` | An app's own page: back button, Open, Restart, Logs, Stop; its week; its backups; its last update with Roll back |
| `web-push.png` | An alert on the Lock Screen, through Web Push |

## Launcher (paste into a new session)

    Read .claude/prompts/lanes.md, then .claude/prompts/web-loop.md, and follow web-loop.md as lane W. Take the next unticked item.

Or, for a loop that paces itself: `/loop Read .claude/prompts/web-loop.md and do the next round.`

## Rules

`lanes.md` holds the rules for every lane. Read *Every session, step by step* and *Rules that never bend*, and follow them, with these for this lane:

1. **Branches:** `claude/web-*`. One open pull request at a time (two only while one waits for a review, `lanes.md` rule 6).
2. **What this lane owns** (`lanes.md` rule 2 still decides who may touch a file today: a file another open pull request touches is theirs until it merges):
   - `web/dist/companion.js`, `web/dist/sw.js`, and `web/dist/phone.css` once item W1 makes it;
   - `internal/companion/` and the serve side of `cmd/homelab/serve.go` (`phoneMethods` only with Q's review, `lanes.md` rule 6);
   - `app/preview/companion.mjs`, the phone's cases in `app/preview/shoot.mjs` (add only, rule 3), `app/preview/redesign/web.mjs` and `docs/images/redesign/web-*.png`;
   - `services/system/Phone companion.md`, and the **Phone's page** column of `docs/Parity.md`.
3. **What it shares with lane R:** the screens themselves (`web/src/screens/`, `web/src/status/`, `web/src/backups/`, `web/src/page/`, `web/src/parts/`). Change one only for the phone's page (an `onPhone()` branch, a part both use), and only when R has no open pull request on that file. A change R should make on the computer goes under **From the other lanes** in `redesign-loop.md`.
4. **Never:** `apple-client/` (lane R's item P1), Finances' data (lane M: `web/src/finances` data files, `internal/finance`), Tidy Up on the phone (the owner: it stays on the computer).
5. **Q reviews first** (`lanes.md` rule 6) for anything that: adds a call to `phoneMethods`; changes pairing, tokens, or what a phone may do; adds a host the homelab calls (Web Push does: W9); stores a new secret (VAPID keys: W9); or touches sign-in (passkeys: W11). Write **Needs Q's review: yes** and why on the description's first line.
6. **Words** (`lanes.md` rule 12), and the owner's, Nov 25: **never "needs you"** (*"1 app needs you"*, *"Needs you"*). Say what happened: *"Decypharr stopped"*, *"Stopped"*, *"2 backups failed"*. Never write the household's chores as the app's feelings.
7. **The devices to check, every pull request that changes how the phone's page looks.** Pictures of the **Duo's four poses** go in the description, light and dark; the rest run as smoke cases (`app/preview/shoot.mjs`, add a case per size):

   | Device | CSS size (portrait; landscape swapped) | Why |
   |---|---|---|
   | **iPhone Duo, folded** | 382 × 556 | the tester's phone (reported) |
   | **iPhone Duo, unfolded** | 669 × 951 and 951 × 669 | the tester's phone; crosses 700 (reported) |
   | **iPhone Duo, two windows** | 385 × 669 | Split View unfolded (reported) |
   | iPhone SE | 320 × 568, big text | the smallest |
   | iPhone (6.1") | 390 × 844, and 844 × 390 | the most common |
   | iPhone Pro Max | 440 × 956, and 956 × 440 | the largest phone, wider than 700 in landscape |
   | Android phone | 360 × 800, and 412 × 915 | Chrome, the back button |
   | Android foldable, unfolded | about 690 × 840 | the same cliff as the Duo |
   | iPad mini | 744 × 1133, and Split View at 320 and 507 | iPad's narrowest |
   | iPad | 820 × 1180, and 1180 × 820 | the tablet |
   | A tablet in landscape | 1280 × 800 | the tester's other screen |
   | A computer's browser | 1280 × 800 and 1920 × 1080 | Chrome, Safari, Firefox, Edge on Mac, Windows and Linux |

   Every row as a paired phone (`html.companion`), once as **look only** (no Start, Stop, Edit or Add anywhere), and once as a **wall screen** (`#kiosk`: Status only, no buttons).

   **Engines:** Chromium is installed here (Playwright). Run the smoke cases in **WebKit** too, the engine every iPhone and iPad browser uses: try `require('playwright').webkit`; if it's missing, add the WebKit run to CI's frontend job (`.github/workflows/`) rather than skipping it, with **Needs Q's review: yes** (CI). Firefox where CI can.

   **Also, every time:**
   - big text (the browser's text size at 200%);
   - reduced motion;
   - dark mode, and increased contrast;
   - VoiceOver order (`make app-smoke`'s axe check);
   - the page added to the Home Screen (`display-mode: standalone`) and in Safari's tab;
   - no sideways scroll at any size.
8. **The server's homelab is a first-class case.** Use the preview's household for pictures (`app/preview/shoot.mjs`'s mock), and check every screen also reads right on Linux with no battery, no display and no desktop (no *This Mac*, no *Plugged in*, no tray).

## The iPhone Duo (reported Nov 25; **confirm on a real device**, item W1)

Apple's foldable, the tester's phone. Apple's spec pages give the panels: inner 7.6" OLED, 1878 × 2670 at 430 ppi; outer 5.4", 1398 × 2034 at 460 ppi. Apple gives no CSS viewport. Safari's widths as reported from a WebKit post (ppc.land, *Safari 27.1 on iPhone Duo runs web pages from 382 to 951 pixels wide*; third-party, not measured here):

| Pose | CSS width | Height (worked out from the panel at the same scale, not measured) | Today's layout |
|---|---|---|---|
| Folded (outer screen) | about 382 | about 556 | phone (under 700) |
| Unfolded, portrait, one window | about 669 | about 951 | phone: one narrow column on a 7.6" screen |
| Unfolded, landscape | about 951 | about 669 | **the computer's old layout** (over 700): the tester's screenshot |
| Unfolded, two windows side by side | about 385 each | about 669 | phone |

Other sites give 890 × 626 at 3×; that is the panel divided by 3, not Safari's report. Trust W1's measurement over both.

**What this means:** the page's one breakpoint (700 px) sits in the middle of this phone's range. Unfolding or turning it switches the page between the tab bar and the computer's sidebar, mid-use. On the Duo the page must:
- choose its layout by what fits, not by "phone or computer": a tab bar and two columns of cards unfolded in portrait; list and detail side by side unfolded in landscape (W4);
- keep where you were, what's open and what's typed when it's folded, unfolded or turned (W4);
- stay usable at about 382 when folded and in a two-window split.

## Facts (checked Nov 25; read the code before relying on them)

- **The 700 px cliff.** The phone's layout (tab bar along the bottom, one column, rows as cards) is one block, `@media (max-width: 700px)` with `html.companion` rules, near line 646 of `web/dist/style.css`. Above 700 px the phone's page gets the computer's layout **as it was before the redesign:** every rule that makes the sidebar the strip of icons plus a screen's menu is scoped `html:not(.companion)` (the `@container window (min-width: 701px)` block near line 3334, and lines 87–89, 1247–1256, 3316). The screens also draw no menu on the phone: `mountSideMenu(…, onPhone() ? null : {…})` in `web/src/screens/status.ts` (~161), `backups.ts` (~147), `setup.ts` (~296), and `choose.ts`. That is the tester's screenshot: a plain list sidebar on a tablet.
- **What the phone's page hides:** `web/dist/style.css` ~601–623: Choose apps, Tidy Up, Setup's tab, Finances unless allowed, Settings' People, Phones, Appearance and Uninstall cards, and every change button on a look-only phone.
- **Phone in landscape** (844×390, or 932×430 on a large iPhone) is wider than 700 px, so it falls into the computer's layout.
- **Installing:** the companion already serves `manifest.webmanifest`, `apple-mobile-web-app-capable`, the theme colours and the 180 px icon (`internal/companion/server.go` ~630). `web/dist/sw.js` keeps the page's own files for when the computer can't be reached; `companion.js` keeps the last Status and draws it with when. Nothing keeps Backups or an app's page offline yet.
- **HTTPS matters.** Service workers, Web Push, passkeys and the Badging API all need a secure page: the tailnet address (`https://<TAILSCALE_HOST>:8099`) or the domain's. A phone paired over plain `http://<LAN>:8099` gets none of them, and never gets Finances. Every new feature here must say plainly, on the page, what to open instead.
- **What iOS gives a page added to the Home Screen** (iOS 16.4 and later): Web Push (only after the person taps something, only once added to the Home Screen), the app badge (`navigator.setAppBadge`), screen wake lock, the share sheet (`navigator.share`), the camera (`getUserMedia`, for the pairing QR code), passkeys (WebAuthn, Face ID), and the PRF extension for a key from a passkey (iOS 18). No widgets, no Siri or Shortcuts, no Live Activities, no work in the background, no vibration. Safari clears a site's stored data after 7 days without a visit, unless the page was added to the Home Screen.
- **Why push matters here:** the iPhone app is built with a free Apple ID, so it has no push (`apple-client/README.md`, *The day you sign*). Web Push needs no Apple Developer account. For anyone without the app, it is the only way an alert reaches the Lock Screen other than ntfy's own app.
- **The version** a git checkout shows comes from its newest release tag since 59ab5ad (`./homelab`, `homelab.cmd`, `make build`); the release builds number themselves (`internal/tools/nextversion`).
- **The phone's calls** are tested against `docs/Parity.md` (`TestParityNamesEveryPhoneCall`, `cmd/homelab/contract_test.go`) and against the iPhone app (`apple-client/Tests/Resources/CompanionContract.json`, `go test ./cmd/homelab -run TestCompanionContract -update-contract`). A new call updates both.

## The work, in order

Each item is one pull request unless it says it splits. Tick it here in the same pull request.

- [ ] **W0. Land the start.** Branch `claude/quirky-ramanujan-jfgtq2` holds three commits not on main: 59ab5ad (a git checkout shows its real version), 8ab68b9 and ed32b46 (the four `web-*` mocks, `app/preview/redesign/web.mjs`, `docs/Redesign.md` › *The phone's page*). If they aren't on main, cherry-pick them onto `claude/web-start`, run the checks (`lanes.md` rule 7), and open one pull request. **Try this tonight:** `git pull`, `./homelab version` shows the newest release (not 0.17.0), and the sidebar's foot on the phone's page says the same.
- [ ] **W1. Measure the real devices.** Settings › This phone on the phone's page gets a small **About this screen** line, and `Report` includes it:
  - the window's CSS size, the device pixel ratio, and the safe-area insets;
  - `display-mode` (standalone or tab), and whether push, passkeys and the badge are offered here;
  - every change of size since the page opened (folding, unfolding, turning, Split View), with the time.

  Ask the tester (via the owner, `owner.md`) to open it on the Duo in each pose of rule 7's table, and on his tablet, and send the line. Put the measured numbers in this file's Duo table (replacing *reported*) and in the smoke cases. Until then, build to the reported sizes.
- [ ] **W1b. The phone's own stylesheet.** Move every `html.companion` rule out of `web/dist/style.css` into `web/dist/phone.css`, loaded only by the phone's page (the companion's `head` in `internal/companion/server.go`, after `style.css`), so lane R and this lane stop meeting in one 3,000-line file. **No change on screen:** the phone's smoke cases and pictures before and after must be identical (diff the PNGs; any pixel that moves is a mistake). Keep the `html:not(.companion)` rules in `style.css` (they're the computer's).
- [ ] **W2. No more "needs you".** Everywhere a person reads it: the computer's and the phone's Status headline and sidebar item, Backups' card, Setup, alerts, `docs/Redesign.md`, `docs/Tour.md`, the `phone-*` and `computer-*` mocks (`app/preview/redesign/`, then `make redesign`), and `owner.md`'s notes. The pattern: the headline names the problem (*Decypharr stopped*; two or more: *2 apps stopped* with each in a row under it); the card or menu item is *Stopped* (or *Failed*, for backups). Add `needs you` to the words check (`app/preview/words.mjs`) so it can't come back. The iPhone app's strings: a line under **From the other lanes** in `redesign-loop.md` for P1, not this lane. About 27 files today: `rg -il "needs you" web/src app/preview docs apple-client cmd internal`.
- [ ] **W3. A tablet or a wide window: the redesigned sidebar** (`web-wide.png`). Above 700 px the phone's page gets the strip of icons and each screen's own menu, as the computer has had since #839:
  - the strip's rules apply to `html.companion` too, sized to the screens this phone has (Status, Backups, and Finances only where allowed: two to four icons, never empty columns);
  - Status, Backups and Settings mount their menus on the phone (`onPhone() ? null` goes, leaving out items for parts the phone can't open);
  - the foot is one line: the system, the version, the free space (`Linux · 0.42.8 · 3.4 TB free`);
  - the wall screen keeps no sidebar.
  
  Check every size in rule 7; the narrow phone layout must not change. On the Duo unfolded in landscape this is the screen the tester sees first.
- [ ] **W4. Layout by what fits: the Duo and every foldable.** Replace the single 700 px switch with sizes chosen by the window, so no device lands on the wrong one:
  - **Narrow** (under about 600 wide: phones, the Duo folded, any Split View): the tab bar, one column. As today.
  - **Roomy** (about 600 to 900 wide and taller than wide: **the Duo unfolded in portrait**, an iPad in Split View, an Android foldable): the tab bar, cards in **two columns**, Status' categories two to a row, an app's page with its cards side by side.
  - **Wide** (over about 900, or landscape and taller than about 500: **the Duo unfolded in landscape**, a tablet): W3's sidebar with **list and detail side by side**. Status' list on the left, the app's page on the right, as the iPad app does (`apple-client/README.md`); no full-page jump to an app.
  - **Short and wide** (landscape and under about 500 tall: a phone on its side, the Pro Max at 956 × 440): the tab bar, two columns, the safe areas (`env(safe-area-inset-left/right)`) clear of the camera.

  **Mock it first:** add the Duo unfolded to `app/preview/redesign/web.mjs` (`web-duo-portrait` at 669 × 951, `web-duo-landscape` at 951 × 669, with the tester's apps), show the owner (`owner.md`, `lanes.md` rule 4: it's a new picture), then build it.

  Use container queries on `main` where a card's own width decides (most of them), media queries only for the frame.

  **Folding, unfolding and turning keep everything:** the screen, the app's page that's open, the scroll position, a half-typed form or setting, an open menu (closed cleanly, not left floating). Test each pose change in both directions with Playwright's `setViewportSize` on the Duo's sizes; nothing reloads, nothing is read twice.

  **Touch targets at least 44 px** in every size; nothing important in the centre fold line of the unfolded Duo in landscape (a card may cross it, a button shouldn't sit on it: keep the two panes' gap there).
- [ ] **W5. Status on the phone as `web-status.png`.** The stopped app first, with Start, Logs and Its page; Backups and the machine side by side; each category one row. The machine's card says what's true of *this* machine: a server with no battery says the disks and the next update (not *Plugged in*); a Mac or laptop keeps power. Name it from the computer's own facts (`core.Machine`, `internal/host`), never from the phone. The *Alerts on this phone* offer waits for W9.
- [ ] **W5b. A server's words** (the owner's yes, Nov 25). On a machine with no battery and no desktop session (no display server, `systemctl get-default` is `multi-user.target`, or what `internal/host` can read on each system), Setup leaves out *This machine stays awake* and every screen says *The server* in place of *This Mac* / *This machine*, on the computer's screens and the phone's page alike. The detection is Go in `internal/host` (lane Q's): with a test per system and **Needs Q's review: yes**. Laptops and desktops unchanged.
- [ ] **W6. An app's page on the phone as `web-app.png`.** A back button with the screen it came from, the app's name as the title (no search bar from the screen before). Open, then Restart, Logs and Stop sharing the width. Its week as seven squares; its backups (the last seven nights, the size, where); its last update with Roll back (a look-only phone sees no Roll back). Use what `web/src/page/AppPage.tsx` and `web/src/screens/apppage.ts` already draw; leave out what the phone's calls don't carry yet, and list it under *Next*.
- [ ] **W7. Moving around like an app.**
  - Every screen and page pushes a history entry, so iOS's edge swipe and Android's back button go back, and a reload lands where you were.
  - Pull down to refresh on Status and Backups.
  - Page changes with the View Transitions API where the browser has it (Safari 18), with nothing on `prefers-reduced-motion`.
  - The tab bar and top bar clear the safe areas in standalone mode.
- [ ] **W8. Offline, honestly.** With the computer unreachable (away without Tailscale, Tailscale off), the last Status, Backups and each app's page as last read, with *As of 7:02 AM* on top and every change button disabled with why. `sw.js` keeps the page; the readings go in IndexedDB (never Finances in plain form: those wait for W12). Back online, everything is read again by itself. A test in `app/preview/companion.mjs`.
- [ ] **W9. Alerts on the Lock Screen (Web Push)** (`web-push.png`). **Needs Q's review: yes** (a new outgoing host, a new secret, a new phone call), **The owner's yes: given Nov 25** (`lanes.md` rule 13: alerts leave the machine for Apple's, Google's or Mozilla's push service; their contents are encrypted end to end, the service sees only that one was sent). Off until each phone turns it on. Q's review still comes first. Split in two:
  - **(a) The computer's side:**
    - VAPID keys made once, kept in `.env` (`WEBPUSH_PRIVATE_KEY`, 0600; `lanes.md` rule 9; in `.env.example` with a comment, and in the redaction lists).
    - A subscription per paired phone, an optional field in `data/phones.json` (`lanes.md` rule 10, with a test loading a file without it), removed when the phone is removed or lowered.
    - The calls `PushKey` (the public key) and `SubscribePush` / `UnsubscribePush` in `phoneMethods`.
    - Sending from where ntfy's alerts are sent (`internal/notify`), with the same quiet hours, snoozes and priorities, as RFC 8291 (`aes128gcm`) with RFC 8292 (VAPID).
    - **Only to the known push services' hosts** (`web.push.apple.com`, `*.push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`): a subscription naming any other host is refused, so a phone can't make the computer call an address of its choosing.
    - A dead subscription (404 or 410) is dropped.
    - Tests: an `httptest` push service that decrypts the payload with the subscription's keys; a refused host; quiet hours.
    - A new Go dependency only if it's small and maintained (`govulncheck` clean); writing the encryption against the RFCs' test vectors is fine too.
  - **(b) The page's side:**
    - *Alerts on this phone* on Status (once) and in Settings › This phone, offered only where it can work: standalone (`display-mode: standalone`), a secure page, and a phone allowed alerts.
    - Elsewhere, one line on how: add to the Home Screen; open the https address.
    - The service worker shows the alert and opens the right page on a tap (the app's page for a stopped app; Backups for a backup).
    - The alert's words are the computer's alert's, never a token or an address.
- [ ] **W10. The count on the Home Screen icon.** `navigator.setAppBadge(n)` with the same count as the Status badge (one problem, one count), set when the page reads Status and by the service worker on a push. Cleared at zero. Only in standalone mode.
- [ ] **W11. A passkey lock** (Face ID or Touch ID, WebAuthn). **Needs Q's review: yes** (sign-in). **The owner, Nov 25: optional** (offered once on phones allowed changes; never required).
  - A phone allowed changes may add a passkey for this site (the relying party is the page's own host).
  - The computer keeps its public key beside the phone's token in `data/phones.json` (optional field).
  - With a passkey set, every `Change: true` call carries a fresh assertion that the computer checks (`allowed`, `internal/companion/server.go` ~481): the server checks the user, not just the page.
  - The page locks after 5 minutes in the background, as the iPhone app does.
  - Without a passkey nothing changes. Over plain `http://`, a passkey can't exist, so the page says to open the https address.
- [x] ~~**W12. Finances offline, sealed.**~~ **Dropped: the owner said no, Nov 25.** Finances show only while the homelab answers; never keep them on the phone. The old text, for the record: After W11 and with the owner's yes: the last Finances read, kept on the phone encrypted with a key from the passkey (WebAuthn PRF, iOS 18 and current Chrome), opened with Face ID, gone when Finances is taken from the phone or it's unpaired. The same rules as the iPhone app's `OfflineFinances` (`apple-client/README.md`, *Finances offline*). Changes made offline wait and replay as the app's do, through the same code (`mobile/finance`'s wasm build, `web/dist/finance.wasm`). With lane M's agreement in `money-loop.md` › **From the other lanes**.
- [ ] **W13. Choose apps on the phone.** **The owner, Nov 25: mock it first,** and build only on their yes once they've seen it. Choose apps stays on the computer *on purpose* today (`docs/Parity.md`, Gaps). For a household with no computer screen (a server), it's the one thing they can't do from the page. Mock it (`app/preview/redesign/web.mjs`: the list, the install plan, Install) and ask in `owner.md`. Only on a yes: the install calls in `phoneMethods` (**Needs Q's review: yes**), for phones allowed changes, behind W11's passkey once it exists.
- [ ] **W14. Every other phone.** Android (Chrome) and an iPad, as rule 7's sizes: the manifest's maskable icon, Android's back button (W7), Chrome's install prompt (shown once, as Status's alerts offer is). Fix what's off; list what can't be.
- [ ] **W15. Keep it in step with lane R.** For every screen R has redesigned since the last check, the phone's page at rule 7's sizes, against its `phone-*` picture and the pattern. Anything off: fix it here if the file is free, else a line in `redesign-loop.md` › **From the other lanes**. Then keep this item open: it repeats whenever R merges a screen.

## When an item is done

- The pictures for rule 7's sizes, light and dark, in the pull request, beside the mock where there is one.
- `make frontend` (commit `web/dist`), `make frontend-check`, `make app-smoke`. Plus `make check` for Go, and `node app/preview/companion.mjs` for the bridge. The phone's smoke cases pass at every size they cover; add cases for the sizes they don't (landscape, tablet).
- `docs/Parity.md`'s **Phone's page** cells and `services/system/Phone companion.md` say what's now true.
- A `CHANGELOG.md` line under *Everything else* (`lanes.md` rule 3).
- **Try this tonight:** three to five steps on the owner's own phone, and one for the tester's server (*on the server: `git pull` and `./homelab restart`; on the phone: pull to refresh*).

## The owner's answers (Nov 25)

- W0: land the branch through a pull request: yes.
- W9, alerts through the push services: yes, off until each phone turns them on.
- W11, the passkey lock: optional, never required.
- W12, Finances kept on the phone: **no** (dropped).
- W13, Choose apps on the phone: mock it first; build only on a yes after.
- W5b, a server's words: yes.
- The other lanes keep running. Lane W runs on account B, by turns with M (`lanes.md`).

## From the other lanes

Lanes R, M and Q add a line here when something this lane can now carry to the phone has shipped, with its pull request.
