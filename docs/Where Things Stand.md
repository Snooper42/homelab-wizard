---
version: 0.17.0
---

# Where things stand

What Homelab Wizard does today, what has been tried on a real machine, and what has only passed tests so far. Written Nov 27, 2026, at release v0.46.9. The detail behind each line is in [Testing](<Testing.md#waiting-for-real-hardware>), [Known Issues](<Known Issues.md>) and [What each device can do](<Parity.md>).

## In one paragraph

The homelab runs a real household on a Mac every day. The last full pass of the Mac's checklist was on **Nov 3, 2026: 13 of its 18 steps passed**, and the other five haven't been run yet. About 300 releases have shipped since then (v0.18.0 to v0.46.9, one for each change to main). Each one passed its tests against stand-ins for Docker and the Mac's scheduler, and every night CI runs the homelab against a real Docker Engine on Linux. Neither of those proves the Mac, so the changes since Nov 3 still need the Mac's checklist run again. The Windows PC and the Steam Machine haven't had a step run yet.

## What it does

| Part | What the household gets | Where it runs |
|---|---|---|
| **Status** | Every app, live: what runs, what needs a look, Start, Logs and its page | The desktop app, the phone's page, the iPhone and iPad app |
| **Backups** | A copy every night, encrypted before it leaves the house, and a monthly restore test | The same, plus `./homelab backup` |
| **Updates** | Each app's data copied first, then the update overnight, with a one-click undo; the app itself updates from GitHub's Latest release | The desktop app, the background agent |
| **Watchdog and alerts** | A check every 15 minutes that restarts what hangs, and a push to the phone when something needs you | The background agent, ntfy |
| **Finances** | The household's money paycheck by paycheck: transactions, bills, budgets, net worth | The desktop app; the iPhone and iPad app and the phone's page for the phones you allow |
| **Tidy Up** | The music, films and books you download, sorted and kept small | The desktop app, the background agent |
| **Choose apps** | 73 apps in nine categories: 16 start with the homelab, 55 are an **Install** away, 2 are native | The desktop app, `./homelab install <app>` |
| **An app's log in plain words** | Its log explained by Ollama on this computer; nothing leaves the house | An app's page in the desktop app, with Ollama installed |

## Tried on a real machine

| Machine | Steps passed | Last run | Not yet run |
|---|---|---|---|
| The Mac (where the homelab lives) | 13 of 18 | Nov 3, 2026 | M5 alerts with the app closed, M7 the drives' health, M10 Paperless-AI without Ollama, M11 a camera in Frigate and Home Assistant, M18 Beszel |
| The Windows PC | 0 of 23 | — | All of them. The owner ran the homelab on Windows for a while this autumn, but not step by step |
| The Steam Machine | 0 of 17 | — | All of them |
| The iPhone and iPad | Not tracked step by step | — | Built with Xcode on the owner's Mac, not from the App Store; with a free Apple ID it needs a rebuild every 7 days |

## Tested only against stand-ins

These pass CI but haven't run on the real thing yet. Each is an open item in [Known Issues](<Known Issues.md>):

- **The scheduled jobs under `launchd`** (ISSUE-0005): the nightly backup, updates and watchdog as the Mac itself starts them.
- **Duplicati's jobs, restores and repairs through its API** (ISSUE-0016), and Duplicati writing into the Proton Drive folder (ISSUE-0003).
- **Updates started from the app on the Mac** (ISSUE-0017), and installing and updating on Windows and Linux (ISSUE-0021).
- **App wiring and the menu bar item against real apps** (ISSUE-0015), and the domain set-up against the live services (ISSUE-0004).
- **The release builds opened** on a Mac, a Windows PC and SteamOS (ISSUE-0014): partly done.
- **The custom proxy image** (ISSUE-0001): built and run on Linux, not yet on the Mac.
- **Two fixes waiting on a check:** an alert when OrbStack itself is down (ISSUE-0006), and alerts reaching the phone away from home (ISSUE-0011).

Known and accepted: nothing starts after a restart until someone logs in (ISSUE-0007), each device's DNS is set by hand with a domain (ISSUE-0008), MoneyMatter's images run under Rosetta (ISSUE-0009), Immich's machine learning runs on the processor (ISSUE-0010), a cloud drive's own quota can't be read (ISSUE-0019), and Vaultwarden's web vault is blank in LibreWolf (ISSUE-0020).

## What's happening now

From Nov 27, 2026, the work moves to **making the core flows reliable on the real Mac** before anything new: backups and a restore from nothing, the jobs starting at boot, updates and rolling back, and the apps' wiring against live Docker. New features, redesigns and new catalog apps wait until those are checked on the Mac. Finances, the iPhone and iPad app, the Ollama log explanations and the catalog get only security and data-loss fixes meanwhile. The plan is in review in pull request #961.

## How to bring this page up to date

After a run of [Testing](<Testing.md#waiting-for-real-hardware>) on a machine, change its row in *Tried on a real machine*. When an item in [Known Issues](<Known Issues.md>) is resolved, take its line out of *Tested only against stand-ins*. Change the release and the date at the top at the same time.
