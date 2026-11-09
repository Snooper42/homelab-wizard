# iPhone and desktop in unison: build everything that works unsigned (handoff, Nov 9, 2026)

Paste the launcher line from the bottom of this file into a new session, or point the session at this file. It starts the work the owner agreed on Nov 9, 2026: making the iPhone app and the desktop app work together, as far as possible without the paid Apple Developer Program. It sits beside, and does not replace, the other files in `.claude/prompts/`.

You are working on homelab-wizard (github.com/Snooper42/homelab-wizard) with its owner. They are not a designer or a developer. Explain choices in plain words, recommend one option rather than listing many, and show what changed (the simulator screenshots CI makes, before and after, light and dark). The owner works on this **in the evening after work**, at home with their Mac and phones: make every PR something they can install and try in one evening, and end it with a short **Try this tonight** list (3 to 5 taps, with what each should show).

## 0. Read first, and follow

1. `.claude/prompts/lanes.md`: who owns what. **`apple-client/` is Account 4's lane, and this work is mostly Account 4's.** The desktop side under it (`internal/companion`, `cmd/homelab/serve.go`, `internal/notify`, the desktop's screens) is in Account 2's area, and Tidy Up and Finances are Account 1's. Rule 2 (a file claimed by another lane's open PR) applies before every branch and every push.
2. `.claude/prompts/complaints.md`: anything about the phone comes first.
3. `apple-client/README.md`: what the iPhone app does today, how it's built, and its look. Keep its **What it does** table current with every PR.
4. `docs/Feature Roadmap.md`: mark items *Built* with their PR as you finish them (only items this work builds).
5. `CONTRIBUTING.md`, `docs/Testing.md`, and `.github/workflows/apple-client.yml`.

Read the code before trusting any description of it, this file's included.

**Ask the owner once, at the start (it decides how the desktop half is done):** may this session change the desktop side too (the companion, notify, and the desktop screens these features need), or should it write each desktop need under **For Account 2** in `maintenance-loop.md` and wait? The pattern so far was a desktop PR first, then the iPhone PR that uses it (#528, then #530). Until they answer, build only the `apple-client/` parts that need nothing new from the computer.

## 1. The owner's decision (Nov 9, 2026)

- **No paid Apple Developer Program for now.** Build everything that works with a free Apple ID now.
- **Ready for the day they sign.** Every feature that needs signing gets built, tested and kept compiling now, switched off. The day they join, one flag and a short checklist turn it on. The app should be complete for now *and* need no rework then.
- **Re-installing with the cable every 7 days is fine**, on their phone and their partner's (`apple-client/scripts/run-on-iphone.sh`). Don't spend work on getting around the 7-day limit.

## 2. What a free Apple ID can and can't sign

Verify on the owner's phone before relying on any "unclear" row, and write the result into `apple-client/README.md`.

| | Free Apple ID | Notes |
|---|---|---|
| Push notifications (APNs) | **No** | Xcode refuses to sign the Push capability for a Personal Team. Alerts keep going through the ntfy app until they sign |
| App Groups (widget, extensions sharing data with the app) | **Unclear** | Reports conflict. `HOMELAB_WIDGET=1` already builds the widget with one. **First job:** ask the owner to try `HOMELAB_WIDGET=1 ./apple-client/scripts/run-on-iphone.sh <prefix>` one evening and say whether it signs |
| New App IDs and installed apps | **Limited** | A free account is commonly reported to be limited to 3 sideloaded apps per device and 10 new App IDs a week, and every extension is its own App ID. Add **at most one** new extension target, and put everything that needs one (widget, Live Activity, Control Center controls) in the existing widget extension |
| Universal links (Associated Domains) | **No** | Use a custom URL scheme (`homelab://`) instead |
| Custom URL scheme, "Open in Homelab" for files (`CFBundleDocumentTypes`), App Intents (Shortcuts and Siri, files as parameters), local notifications, background refresh (best effort), Vision / VisionKit text reading, CoreSpotlight | **Yes** | No entitlement needed. Prefer these |
| Live Activities, Control Center controls | Only if App Groups sign | They live in the widget extension. Without push, a Live Activity is updated only while the app runs |

**This container can't build Swift.** CI's macOS job (`apple-client.yml`) is the build and the test run; the owner installs on their phone at home. Keep the Swift small, typed and tested, so a red CI run is easy to read.

## 3. The switch for the day they sign

Build this first, before any feature needs it, so every signed-only part has somewhere to live.

- **Project:** `HOMELAB_SIGNED=1` in `apple-client/scripts/make-xcode-project.sh` turns on everything `HOMELAB_WIDGET=1` does, plus the push entitlement (`aps-environment`), and adds a Swift compilation condition `HOMELAB_SIGNED`. Without it, the project comes out exactly as today. `scripts/test-scripts.sh` checks both.
- **Code:** each signed-only piece is a protocol with an unsigned implementation used now (`AlertDelivery`: ntfy plus local notifications) and a signed one under `#if HOMELAB_SIGNED` (push registration, Live Activity push updates). **CI builds both variants**, so the signed path can't rot unseen.
- **Desktop:** a companion call that stores a phone's push token, and an alert fan-out with ntfy as its only sender now. The APNs sender is written and tested against a fake, and stays off until an APNs key is set in `.env`.
- **Write the checklist** in `apple-client/README.md` under **The day you sign**: join the program, the team ID, `HOMELAB_SIGNED=1`, make the APNs key and put it in Settings, TestFlight for the partner's phone, notarizing the Mac DMG (`docs/Releasing.md`). Keep it current as features land.

## 4. The work, in order

One small PR each, one open PR at a time. When a feature needs the computer to do something new, the desktop PR goes first and the iPhone PR follows (see section 0's question).

1. **Links into the app (`homelab://`).** `homelab://app/<id>`, `homelab://app/<id>?do=restart|start|stop|logs`, `homelab://status`, `homelab://backups`, `homelab://finances/<page>`, `homelab://tidy/inbox`. The lock still applies. **A link never changes anything by itself:** an action link opens the app's page with the action waiting for one confirming tap, and only on a device allowed changes, because anyone can send a link. Unknown or malformed links open Status. Tests: parsing every form, plus the rejects.
2. **Buttons on alerts, through ntfy.** The desktop's alerts gain ntfy `view` actions that are `homelab://` links (Radarr stopped → **Restart**, **Show logs**). They work in the ntfy app today and need no push. No secrets or tokens in a link. Mark the roadmap's *Buttons on alerts* item.
3. **What the computer can do.** The companion says its version and the features it supports; the phone hides what the computer lacks and says "Update Homelab Wizard on the computer to …" rather than failing. **Contract tests:** Go writes a sample answer for every call the phone uses into `apple-client/Tests/Resources/`, the Swift tests decode each one, and CI fails when they're out of date, as with `PayeeVectors.json`.
4. **A log of what was done** (roadmap idea). Every start, stop, update, restore, settings change and Finances edit, with who did it (this computer, or which phone by its name), kept 90 days, searchable on the desktop and on the phone, with Undo where Undo already exists. It doesn't record Finances amounts.
5. **The same preferences everywhere.** Pinned apps, folded groups and snoozes kept by the computer, so both devices show the same. "Seen" marks stay **per person**. Hide amounts already works this way; do the same.
6. **Alerts in the app.** A list of recent alerts on the phone, read from the computer: what fired, when, whether it cleared, who snoozed it. Local notifications while the app is running (live events), and from background refresh (best effort). A setting chooses whether the ntfy app or this app notifies, so nothing arrives twice.
7. **Send to my phone / Open on the computer.** "Send to my phone" on a desktop row's right-click menu and in ⌘K, through the live events the phone already reads. The phone shows a banner with one tap to open. The reverse puts the desktop window on the same page.
8. **Files in without an extension.** "Open in Homelab" for PDFs, images, audio and ebooks (`CFBundleDocumentTypes`), and App Intents with a file (Send to Paperless, Add to the Tidy Up Inbox, Attach as a receipt) that Shortcuts can put on the share sheet. On the companion: an upload call for devices allowed changes only, with a size cap and allowed types, and a file name that can never leave the target folder. Write a test for each of those. A real Share extension waits for section 2's App Group answer, behind the flag.
9. **Tidy Up's questions on the phone** ("Name these songs", "Needs a look", "Where should your libraries live?") and **Tidy up now**. Tidy Up is Account 1's on the desktop: read the companion's existing calls first, and ask for what's missing under **For Account 1** unless the owner said otherwise.
10. **Scan a receipt.** The camera reads the amount, payee and date on the phone (Vision), fills in a new transaction, and attaches the photo. The data stays on the phone and the computer (finances-loop.md rule 1); nothing goes to a server.
11. **In the widget extension, once App Groups sign:** a Live Activity for a running job (the nightly update, Back Up Now, a restore test), updated while the app runs, ending on its result; Control Center controls (Back Up Now, Pause Updates, Hide Amounts); and each person's widget showing their own apps and Finances.
12. **Spotlight:** each app's page findable by name in the phone's search.

**Desktop items to raise with the owner afterwards** (other lanes' work unless they say so): the Memory screen, with a card on the phone; Restore one file, browsable from the phone; one app at a time for nightly updates; start in order; one alert for many; disk space ahead; the monthly report, shown on the phone too; a desktop notification and a phone line when the container runtime is down (ISSUE-0006).

## 5. Every PR

- **A failing test first:** Swift Testing in `apple-client/Tests/` for the phone, and Go tests beside the code for the desktop.
- `CHANGELOG.md` under `## [Unreleased]` only. Update `apple-client/README.md`'s table and the roadmap's *Built* marks.
- **Security:**
  - Every new companion call checks the device's permission: reading, or making changes. A wall screen never makes changes, and a member's phone sees only its own things.
  - Changes ask for Face ID first, as they do today.
  - Nothing secret goes in a link, a notification, or a log.
- **Merging:** follow lanes.md Rule 5. Squash-merge with `expectedHeadSha` pinned, every check green on that head, at most 3 merges a day. After opening a PR, call `subscribe_pr_activity` and end the turn; don't poll.
- End the PR's description with **Try this tonight**, and say whether it needs the cable re-install.
- Branches: ask the owner which name Account 4 uses if `git ls-remote origin 'refs/heads/claude/*'` doesn't make it clear. Always branch from `origin/main`.

## 6. Still to ask the owner (asked Nov 9, not answered)

- Should the phone be able to *ask* the computer to do setup work (for example, "install Audiobookshelf"), which the computer then does? Today the iPhone app "does no setup, on purpose". Don't build it until they answer.
- Is the partner's phone a full equal of the owner's (the same features, changes too), or a member's phone as #528 made it?
- Which hurts most today: alerts, Tidy Up, typing in Finances, or "is everything all right?" Take that item first within section 4, as long as its dependencies are done.

## Launcher (paste into a new session)

    Read .claude/prompts/unison-handoff.md and follow it. If it isn't on main yet, run `git fetch origin claude/inspiring-noether-x39490` and read it with `git show origin/claude/inspiring-noether-x39490:.claude/prompts/unison-handoff.md`. Start with section 0's question to me, then section 2's App Group test and section 3's switch.
