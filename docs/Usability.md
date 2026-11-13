---
version: 0.17.0
---

# Usability scoreboard

Is the app getting easier? Each row is a task a household does, tried end to end by the tester (Account 3, `.claude/prompts/audit-loop.md`) as someone who isn't technical: on each system, in light and dark, at 320px and with big text, against the fake backend. A row is run again whenever a lane says it fixed one of its findings.

- **Steps:** screens and presses from the start to done. Fewer is better.
- **Dead ends:** places where the screen doesn't say what to do next.
- **Words:** wrong, misleading, or jargon text met on the way.
- **Keys:** whether the keyboard and a screen reader reach everything (yes or no).
- **320px:** whether it all fits on a small phone with big text (yes or no).
- **Open:** findings still waiting, by owner (A1 is Account 1, A2 is Account 2).

| # | Task | Owner | Last run | Steps | Dead ends | Words | Keys | 320px | Open |
|---|---|---|---|---|---|---|---|---|---|
| 1 | From a new computer to the first app open, with no docs | A2 | | | | | | | |
| 2 | Something is down: find out what, and fix it | A2 | Nov 13 | 2 (phone: Status, Start; computer: Status, Start) | 0 | 2 | not tried | yes | A2: 1 |
| 3 | Install an app that needs a login or a drive | A2 | Nov 13 | 4 (Frigate), 5 (qBittorrent, with its key) | 1 | 5 | no | yes | A2: 4 |
| 4 | Update everything, and know it worked | A2 | Nov 6 | 3 | 0 | 2 | not tried | not tried | A2: 2 |
| 5 | Get one file back from last week's backup | A2 | Nov 13 | can't be done in the app | 1 | 3 | not tried | not tried | A2: 3 |
| 6 | Pair a partner's phone (look only), then remove a lost phone | A2 | Nov 6 | 5 to pair, 3 to remove | 1 | 5 | not tried | not tried | A2: 5 |
| 7 | Give a person their own account, and send the welcome page | A2 | Nov 13 | 5 (with Pocket ID installed) | 1 | 6 | keyboard yes, screen reader not tried | no | A2: 4 |
| 8 | Put the apps on your own domain | A2 | | | | | | | |
| 9 | The computer is slow: find out why and free memory | A2 | | | | | | | |
| 10 | After a restart or power cut: is everything back? | A2 | | | | | | | |
| 11 | An alert on the phone: understand it, and act from the phone | A2 | | | | | | | |
| 12 | Move the homelab to a new computer | A2 | | | | | | | |
| 13 | Tidy Up: clean a music library and undo a mistake | A1 | | | | | | | |
| 14 | Tidy Up: find what takes the space and free some | A1 | | | | | | | |
| 15 | Finances: set up the month's bills and see what's left | A1 | Nov 13 | 12 (checking 4, a paycheck 5, a bill 3), then read the Dashboard | 1 | 3 | no | no | A1: 5 |
| 16 | Finances: bring in a bank file and fix a wrong category | A1 | | | | | | | |

## History

Each run, newest first: the date, the task, what changed since the last run, and the findings handed over.

- **Nov 13, task 15 (set up the month's bills and see what's left), first run.** Finances against the fake backend from nothing, then the example household; the Mac at 1280px in light, the phone at 390px light and 320px dark with big text. From nothing the Dashboard offers three things to start with, but the card goes once the checking account is in: nothing then points to Plan › Paychecks (one dead end). The bills themselves are quick to type in. "What's left" is the hard part: the first card's big number is checking right after payday, before that paycheck's bills, and what's actually left is the second card's smaller figure. Keyboard: no (344 presses of Tab through the logos to reach a payment's Name). 320px: no (the period bar's arrows split onto two lines). Three words. Five findings for Account 1 (its items 1 to 5).
- **Nov 13, task 5 (get one file back from last week's backup), first run.** Backups against the fake backend, on the Mac in light. The screen says a lot about the backups (last night, each app's copies, the off-site jobs, the restore test) but nothing gets one file back. The only door is Open Duplicati, the engine's own admin page behind a password, and the docs say a restored file is copied back by hand: one dead end. Three words (Duplicati, Stale, sampled). Found on the way: the synced Files (Syncthing's `SYNC_ROOT`) are in no backup, and nothing says so (N76, for Account 2). Three findings for Account 2 (items 22 to 24).
- **Nov 13, task 3 (install an app that needs a login or a drive), first run.** Choose apps against the fake backend, on the Mac in light and at 320px dark with big text. Frigate (records to a drive): search, tick, Install, Done (4 steps). Nothing asks or says where the recordings go, or what to do next, so you land in an empty Frigate: one dead end. qBittorrent (needs a ProtonVPN key): search, tick, paste the key, Install, Done (5 steps). The plan says plainly what it waits for, but the key's help calls it "Optional". "Connect the apps for me" names apps that aren't there, and Done leaves out the VPN tunnel. Five words (Optional, WireGuard, Gluetun, Prowlarr, Seerr). Keyboard: no, because Gluetun's Settings link is skipped by Tab. 320px: fits. Four findings for Account 2 (items 18 to 21).
- **Nov 13, task 2 (something is down), re-run.** Against the fake backend with Mealie stopped, on the phone (390px light, 320px dark with big text) and the computer. Better in every column. Steps 3 to 2: the phone now has Start on a stopped app's row, and the computer's row has it too. Dead ends 2 to 0: the page says it was stopped outside the homelab and that Start starts it again, and the phone can start it. Words 6 to 2: "Choose apps", the subscription sense and Protection in plain words; left are "AUTO_HEAL=false" in the watchdog's note and "tailnet" on the page. 320px: fits now, but a status dot wraps away from its word. Findings 1 to 5 are done (2 and 5 by the lane, 1, 3 and 4 confirmed here); one new small finding for Account 2 (item 17).
- **Nov 13, task 7 (give a person their own account, send the welcome page), first run.** Settings › People, against the fake backend. Without Pocket ID the card offers only Install Pocket ID, which opens Choose apps with it picked. With it running: Settings, People, a name, an email, Add them (5 steps). The person appears, but nothing says the welcome page opened or how to get it to them. There is no Send, and the page holds their sign-in link and a password: one dead end. Six words or phrases unexplained (passkey, Pocket ID, Infuse, "their keys in Settings", which of Welcome page and New sign-in link to use, the inverted app ticks). Tab reaches every button in order; screen reader not tried. At 320px with big text the row breaks (name a letter per line, buttons off the edge), and the stopped-app banner is cut off on every width. Four findings for Account 2 (items 13 to 16).
- **Nov 6, task 4 (update everything), first run.** Status › Update apps, Update them, Close (3 steps), on the Mac, light, against the fake backend. No dead end, but you can't tell it worked: the sheet says "✓ updated" in a terminal's words before anything happens, and "Done" lists every app as Running without saying what changed. Two findings for Account 2 (items 11 and 12).
- **Nov 6, task 6 (pair a phone, remove a lost one), first run.** Settings › Phones on the Mac, light, against the fake backend. To pair: Settings, Phones, a name, Pair a phone, then scan on the phone and tap Pair (5 steps, then Add to Home Screen). To remove: Settings, Phones, Remove (3). One dead end: a wall screen needs `&kiosk` typed onto a link. Five words or marks unexplained (two links with no word on which, a red ▲, "tailnet", "key", "kiosk"); the controls differ phone to phone. Keyboard and the phone's own screens not tried this run. Five findings for Account 2 (items 6 to 10).
- **Nov 6, task 2 (Something is down), first run.** Against the fake backend with Mealie stopped, on the Mac at full width and on the phone at 390px, light. Three steps to start it on the computer: Status, open Household, Start. On the phone there is no way, and no word. Two dead ends: no reason it stopped, and nothing to do on the phone. Six wrong or unreadable phrases: the two screens disagreeing about checks; "Choose stacks"; "baseline"; "Replaces a year"; scanner names. The phone cuts log lines off at 390px. Keyboard and screen reader not tried this run. Five findings for Account 2, in `audit-loop.md`; pictures in `images/usability/`.
