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
| 2 | Something is down: find out what, and fix it | A2 | Nov 6 | 3 | 2 | 6 | not tried | no | A2: 5 |
| 3 | Install an app that needs a login or a drive | A2 | | | | | | | |
| 4 | Update everything, and know it worked | A2 | | | | | | | |
| 5 | Get one file back from last week's backup | A2 | | | | | | | |
| 6 | Pair a partner's phone (look only), then remove a lost phone | A2 | Nov 6 | 5 to pair, 3 to remove | 1 | 5 | not tried | not tried | A2: 5 |
| 7 | Give a person their own account, and send the welcome page | A2 | | | | | | | |
| 8 | Put the apps on your own domain | A2 | | | | | | | |
| 9 | The computer is slow: find out why and free memory | A2 | | | | | | | |
| 10 | After a restart or power cut: is everything back? | A2 | | | | | | | |
| 11 | An alert on the phone: understand it, and act from the phone | A2 | | | | | | | |
| 12 | Move the homelab to a new computer | A2 | | | | | | | |
| 13 | Tidy Up: clean a music library and undo a mistake | A1 | | | | | | | |
| 14 | Tidy Up: find what takes the space and free some | A1 | | | | | | | |
| 15 | Finances: set up the month's bills and see what's left | A1 | | | | | | | |
| 16 | Finances: bring in a bank file and fix a wrong category | A1 | | | | | | | |

## History

Each run, newest first: the date, the task, what changed since the last run, and the findings handed over.

- **Nov 6, task 6 (pair a phone, remove a lost one), first run.** Settings › Phones on the Mac, light, against the fake backend. To pair: Settings, Phones, a name, Pair a phone, then scan on the phone and tap Pair (5 steps, then Add to Home Screen). To remove: Settings, Phones, Remove (3). One dead end: a wall screen needs `&kiosk` typed onto a link. Five words or marks unexplained (two links with no word on which, a red ▲, "tailnet", "key", "kiosk"); the controls differ phone to phone. Keyboard and the phone's own screens not tried this run. Five findings for Account 2 (items 6 to 10).
- **Nov 6, task 2 (Something is down), first run.** Against the fake backend with Mealie stopped, on the Mac at full width and on the phone at 390px, light. Three steps to start it on the computer: Status, open Household, Start. On the phone there is no way, and no word. Two dead ends: no reason it stopped, and nothing to do on the phone. Six wrong or unreadable phrases: the two screens disagreeing about checks; "Choose stacks"; "baseline"; "Replaces a year"; scanner names. The phone cuts log lines off at 390px. Keyboard and screen reader not tried this run. Five findings for Account 2, in `audit-loop.md`; pictures in `images/usability/`.
