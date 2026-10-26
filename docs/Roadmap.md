---
version: 0.9.0-beta
---

# Roadmap

Where the app is, and what comes next. Every build of main has its own number (0.9.1, 0.9.2, …; [Releasing](<Releasing.md#version-numbers>)); each heading below is the next minor version, and 1.0 is the stable release once the 0.x work has proven itself. Open problems live in [Known Issues](<Known Issues.md>); what changed, and when, in the [CHANGELOG](<../CHANGELOG.md>).

Each version says what it is for, then its items. An item is done when its **Done when** holds, not when the code is merged: a check that runs in CI, a number measured on a real machine, or a person doing it without help. Items marked ✓ are in the builds already; what they left open is listed under them.

## Where it stands: 0.9

A desktop app (macOS, Windows, Linux) and the `homelab` CLI that install, connect, back up, update, and watch over 78 self-hosted apps on one computer.

- **Setting up:** Choose stacks (starters, presets, every app by category, your own apps), a Setup checklist with **Do the steps I can**, Home mode on the tailnet by default, and a domain with the proxy, AdGuard Home, Cloudflare Tunnel, and CrowdSec when wanted
- **Running:** Status follows the container runtime live (one engine, served by the background agent), says why an app failed to start or stopped answering, starts apps waiting for a drive, pauses heavy apps on battery, and gives background work a smaller CPU share
- **Healing:** the watchdog every 15 minutes restarts an app that hangs, makes one whose container is gone again, rolls back an update that leaves an app unwell, and alerts through ntfy and an outside heartbeat
- **Backups:** nightly database dumps and volume archives, Duplicati jobs off-site, a monthly restore test the app runs and times, and moving the homelab to another machine
- **Updates:** images nightly (opt-in per app, held or paused from the app), the homelab files and the app itself from Setup › **Update**, each app's release notes before it updates
- **The household:** People with one sign-in (Pocket ID), a phone companion with Status and Backups, kiosk mode for a wall screen, open-format export
- **The app:** a typed Preact frontend, native look per system (accent, Mica, translucent sidebar, high contrast, VoiceOver landmarks), Settings › **Appearance** (theme, accent, contrast, Islands, tray icon colour), and an AI that explains a log on this machine only
- **Safety:** a threat review of the app's own code, govulncheck, gosec, and npm audit in CI, pinned Actions, and checksummed self-updates

### How it is tested today

An audit in October 2026 (a tester's read of the code, CI, and Known Issues) found the code well covered by unit tests, and almost nothing proven against the real thing:

- **What CI runs:** formatting, vet, and the Go tests (all pass; most packages 75–95% covered), the catalog and docs checks, every Compose file's syntax, the frontend's type check, cross-builds for macOS and Windows, and the security scans. All of it on Ubuntu.
- **What it does not:** no container is ever started; the Go tests never run on macOS or Windows, only build for them; the Playwright click-through (`make app-smoke`) exists but is not in CI; and no test opens a homelab folder made by an older release.
- **Thin where a mistake costs most:** single sign-on (`sso`, 11%), the Docker client (28%), the host checks (44%), self-update (49%), alerts (`notify`, 54%), the domain setup (56%); `people` and the recovery kit (`recovery`) have no tests.
- **A restore can come back on newer apps than the backup:** 47 images follow `:latest` (Paperless, Vaultwarden, Ghostfolio, Docmost, Dawarich, Mealie, and others that change their own data on start). A backup records the data, not which version wrote it, and the image an update replaced is kept for a week on this machine only. A restore on a new machine starts the newest versions on older data. The PostgreSQL major versions are already pinned in `.env`; the apps above them are not.
- **The jobs' own logs grow forever:** the agent appends to each job's file in `scripts/logs` (the watchdog every 15 minutes) and nothing trims them. The containers' logs are already capped (10 MB × 3).

0.11 and the 1.0 bar below answer these.

## Still open from the first months

These need the real machines, accounts, or money, not code. 0.11 proves in CI what can be proven without them, so each of these becomes a confirmation on the machine, not a first try.

- [ ] The first real install, finished on the Mac: Vaultwarden accounts then sign-ups off, the tunnel, Duplicati jobs on Proton Drive and each run once, alerts on the phone, the jobs, and the first restore test
  - **Done when:** [Testing](<Testing.md>) steps 1–6 pass on the Mac, and ISSUE-0001, ISSUE-0003, ISSUE-0005, ISSUE-0015, ISSUE-0016, and ISSUE-0017 are closed or accepted with a reason
- [ ] Tailscale verified from the phone on mobile data, two-factor sign-in for Vaultwarden and the proxy admin, CrowdSec console enrollment
  - **Done when:** an app and an ntfy alert open on the phone with Wi-Fi off (closes ISSUE-0011), and both admin sign-ins ask for a second factor
- [ ] The Windows PC and the Steam Machine through their checklists (ISSUE-0012, ISSUE-0013, ISSUE-0014, ISSUE-0021)
  - **Done when:** each machine runs `doctor` clean, `up`, the jobs after a reboot, and the release build's own installer, with each issue's "Also check" list ticked
- [ ] Apple Developer ID (certificate, notarization) and Windows code signing, with the secrets in GitHub ([Releasing](<Releasing.md#secrets>))
  - **Done when:** the DMG opens on a fresh Mac with no Gatekeeper warning, and the Windows installer shows a publisher in SmartScreen
- [ ] A second machine (or a NAS) as a cold standby, and a practice takeover ([the runbook](<Disaster Recovery.md#scenario-another-machine-takes-over>))
  - **Done when:** the standby runs the household's three most important apps (Vaultwarden, Immich, Paperless) from last night's backup, and the time it took is written in the runbook
- [ ] Hand it to someone who is not technical and watch without helping; each place they stop becomes the next fix
  - **Done when:** the session is written up in [Testing](<Testing.md#a-newcomers-first-run>), and each stop is either fixed or in Known Issues

## 0.10: fast, everywhere

The app should answer at once on every system, the Windows PC included, where each `docker` command costs more. The work so far removed the waits that could be found from here; what is left is measuring on the real machines.

- [x] Opening a category on Status redraws the list instead of loading Status again
  - Opening or folding a category is a local change; nothing is asked of Docker or the agent
- [x] A Status load timed in parts (`homelab status --timing`, and in the diagnostics report), so what is slow is measured, not guessed
  - Each part (the runtime, the catalog, the pages' checks, the power card) has its own time, and `homelab report` carries the same table
- [x] The window and the menu bar item read Status through the agent, which reads the runtime once for requests that arrive together (both are told of the same change)
  - Two screens open at once cost one look at Docker, not two
- [x] Page checks fill in after the list instead of holding it (one app not answering cost 3 seconds); the power card reads `docker stats` only while Status is open
  - The list draws from the runtime alone; each app's "is it answering" fills in as it comes back
- [x] Each screen loads its cards side by side, not one after another (Status, Backups, Settings)
- [ ] The timings measured on each real machine, with a number to hold
  - `homelab status --timing` run on the Mac, the Windows PC, and the Steam Machine, cold (just after sign-in) and warm, and the results written here
  - **Done when:** Status draws its list in under 1 second warm on each machine, or the slowest part is named with a plan (often 0.13's Engine API)
- [ ] A timing check in CI, so a change that makes Status slower is seen before it ships
  - The 0.11 integration run records `status --timing` against its real containers and fails when the list takes more than twice the last good run

## 0.11: proven against real Docker

New in the October 2026 audit. Most of the "To verify" in [Known Issues](<Known Issues.md>) wait for a real runtime, not for the Mac: CI can start real containers, run the tests on each system, and click through the app. This version moves as much of that proof as it can from "try it on the machine" to "CI shows it every night", before more features are built on top.

### A real homelab, every night

- [ ] A nightly CI run on a Linux runner with Docker Engine that installs a small preset and takes it through a homelab's life:
  - `homelab install` of ntfy, Vaultwarden, Paperless (with its PostgreSQL), and Nginx Proxy Manager, then `doctor` and `status` with every app answering
  - Some data in each (a vault entry, a document, a proxy host), through each app's own API
  - The nightly backup (dumps and volume archives), then the homelab wiped, then restored from the backup, and the same data read back
  - `restore-test --auto` against a real Duplicati, with a local folder as the destination (ISSUE-0016)
  - An update to a newer image, then a rollback to the one before, with the app answering after each
  - The watchdog: a container stopped, another removed, a third made to hang; the next run brings each one back and sends the alert to ntfy
  - **Done when:** the run is green for a week in a row, and a failure opens an issue with the run's `homelab report` attached
- [ ] The proxy image built and run in that job (ISSUE-0001): the CrowdSec bouncer registered and pulling, and a banned address gets 403
- [ ] `domain setup` against the real Nginx Proxy Manager and AdGuard Home (ISSUE-0004, all but Cloudflare, which stays a fake: it needs a real account)
- [ ] The same run in Home mode, with Tailscale replaced by a fake tailnet, so Setup's checklist is walked from top to bottom by the CLI

### Each system, not only Ubuntu

- [x] The Go tests (`cmd`, `internal`, and the `app` module) on `macos-latest` and `windows-latest` as well as Ubuntu, on every pull request
  - **Done when:** the files for one system (`*_darwin.go`, `*_windows.go`) run their tests on that system, and a test that only passes on Linux is fixed, not skipped
- [ ] The jobs installed for real on each runner: launchd on macOS (ISSUE-0005), the Run key and `homelab-run.exe` on Windows (ISSUE-0013), systemd user units on Linux; then `schedule status` reads them back and `schedule uninstall` leaves nothing behind
- [ ] The release builds opened on each runner: the DMG mounted and the app started, the Windows installer run silently and `homelab.exe` found beside the app, the AppImage already started on its own (ISSUE-0014, ISSUE-0021)

### The app clicked through

- [x] `make app-smoke` on every pull request: each screen, light and dark, as each system's look, against the fake backend
  - **Done when:** CI fails on a script error, a missing element, or a broken layout, and keeps the screenshots of a failing run
- [x] An accessibility check in the same run (axe): every screen with no serious finding, each control named, contrast held in both themes and with more contrast on
- [ ] The app against the real homelab of the nightly run (not the fake backend) at least once a night: Status shows the preset, a job's window runs to the end, Backups shows last night's backup (ISSUE-0015)

### Tests where a mistake costs most

- [ ] A coverage floor per package, checked in CI, raised as tests are added and never lowered without a reason in the pull request
  - First floors: `selfupdate` 80%, `recovery` 80%, `sso` 70%, `notify` 75%, `docker` 60%, `host` 60%, `domain` 70%, `people` 70%
  - **Done when:** each of those packages meets its floor, and the floors are in the Makefile
- [ ] Self-update tested end to end: a fake release with a good download, a bad checksum, a cut-off download, and a full disk; the app is replaced only in the first case and reopens on the old version in the others
- [ ] The recovery kit tested: the printed kit has every secret it needs for a restore and nothing else, and a homelab rebuilt from the kit alone (with the backup) starts

### Upgrades from every release

- [ ] A homelab folder kept from each release since 0.9.0-beta (`.env`, update history, paired phones, settings, the jobs' state) under `testdata`, and a test that opens each with the current build
  - **Done when:** each one upgrades with no question asked and no setting lost, and a release that changes a file's shape adds its folder to the set
- [ ] The same, for the app's own update: the previous release's app replaced by this one keeps the window's settings, the paired phones, and the jobs

### What happens on the machine, kept

- [x] A crash in the app or the agent written to `scripts/logs/crash-<date>.log` (what it was doing, the version, the stack), `homelab report` including the newest, and Status saying "The app stopped unexpectedly yesterday" with **Send the report**
- [x] The jobs' logs trimmed: each file kept under 5 MB, with the older half moved to `<job>.1.log` (one kept); `homelab report` reads both
  - **Done when:** a test runs the watchdog's logging for a simulated year and the folder stays under 30 MB

## 0.12: a frontend that grows

Make each screen cheap to change and hard to break. 0.11's click-through is the safety net for this work: each step below must leave it green.

- [ ] One store per screen's data, written by the engine's changes; components keep their own small state (which categories are open), so a click never reloads a screen
  - **Done when:** no screen calls the backend from a click handler except for an action, and the smoke test counts zero reloads while opening and folding every category
- [ ] The last screens built by hand (the command and log sheets, Settings' page list) as components; `app.ts` down to loading data and choosing screens
  - **Done when:** `app.ts` is under 400 lines (1,713 in October 2026), and no screen builds elements with `document.createElement`
- [ ] Shared building blocks (card, sheet, row, segmented control, empty state) used everywhere, with the colours as tokens only
  - **Done when:** a check in `frontend-check` fails on a colour written outside the tokens, and each block has a page in the preview showing its states
- [x] A job's window: a row per app in plain words with its own bar, the whole job's bar, Docker's lines under Show details (installing, Fix it, Update apps, Backups, Setup)
  - Every long job shows the same window: what each app is doing ("Downloading · 54%", "Starting"), and Docker's own output only when asked for
- [ ] An app page: one app's state, address, logs, usage, week, settings, and actions in one place, instead of a row of icons
  - Its log with **Explain this** (the AI on this machine), its last backup and its last restore test, its update history with **Roll back**, and the people who can sign in to it
  - **Done when:** every action on a Status row is also on the app's page, and the row keeps only Open and the page

## 0.13: the Docker API, in the agent

ADR-0018 left the Go SDK out while the CLI's output was enough; on Windows its cost is now measured in 0.10. The agent becomes the one place that reads the runtime.

- [ ] A small client for the Engine API over the socket (the Windows pipe included), found the way the CLI finds it (`DOCKER_HOST`, the current context, OrbStack): containers, inspect, events, stats as a stream, and exec with its output and exit code
  - **Done when:** 0.11's nightly run passes with the client on, on each system's runner, and Status is faster than the CLI on the Windows PC by the 0.10 timings
- [ ] Compose stays the CLI: starting, stopping, updating, and recreating from the compose files
- [ ] The CLI's `docker` stays as the fallback while the client proves itself on each system
  - A setting (and `homelab doctor`) says which one is in use, and the client falls back by itself after an error it does not know, saying so in the report
- [ ] The new ADR in [Decisions](<Decisions.md>) that replaces ADR-0018's Docker part, with the 0.10 measurements behind it

## 1.0: stable

Not more features: the bar for calling it stable. Each line is checked by CI, a number on record, or a person; none is "it should work".

- [ ] Every Known Issue verified or accepted with a reason
- [ ] Signed releases for macOS, Windows, and Linux
- [ ] Upgrade notes between versions, and a timed restore drill on record
  - Every release's folder from 0.11's set upgrades to 1.0 in CI
- [ ] A restore brings back the versions that wrote the data
  - Each nightly backup records every app's image by its digest (not `:latest`) next to the dumps; a restore or a move starts those images first, then offers the updates
  - The apps that change their own data on start (Paperless, Vaultwarden, Ghostfolio, Docmost, Dawarich, Mealie, and the others 0.11's run lists) follow a pinned version in `.env`, updated by `homelab update` and kept by a backup, like the PostgreSQL versions already are
  - **Done when:** 0.11's nightly run restores onto a clean runner with images newer than the backup available, and the apps come up on the backup's versions
- [ ] Hands-off setup proven: someone who is not technical sets it up on their own computer without help
- [ ] A month with no unexplained alert, a monthly restore test passed each time, and a rollback of a bad update exercised
- [ ] Security review of the app's own code with no open high findings ([threat review](<Security.md#threat-review-of-the-app-october-2026>))
- [ ] The tests at the 1.0 bar: 0.11's nightly run green for a month, the Go tests on all three systems, the click-through and accessibility checks on every pull request, and every coverage floor met
- [ ] Every screen and every page of the docs checked against the 1.0 behaviour; no step that needs Terminal for the common path

## After 1.0

Features that wait for the stable release, in order. Moved here in October 2026: the 1.0 bar is about proof, and these would add new things to prove.

### The library, in order

Music and books arrive messy; the homelab tidies them, the same way on every system, with nothing installed beside it.

- [ ] Import music: beets as an app, one job with two sources (new downloads, or an archive folder), albums then loose tracks, into the folder Navidrome reads; what moved and what did not, in the app and through ntfy
  - **Done when:** an import of a messy test folder (tagged and untagged albums, loose tracks, duplicates) puts each album in Navidrome once, and leaves what it could not match in a folder named in the result
- [ ] Books: Calibre-Web Automated's ingest folder (convert, fetch metadata, add), genres put into the household's own list, publishers' blurbs cleaned, with a preview before it touches the library
- [ ] Both from a button and on a schedule; neither needs PowerShell, Calibre, or Python on the computer
- [ ] Both covered by the backups: the library's folders before an import, so one bad import can be undone

### The dashboard

- [ ] A home screen: the apps as tiles with live state, what needs a look, and the week at a glance (scope to be agreed)
  - Built from 0.12's building blocks and stores, with 0.12's app page behind each tile

### Later

- [ ] A native iOS app with widgets and Lock Screen status, once signing is in place
- [ ] The taskbar and Dock icon in the colour picked in Appearance
- [ ] A router that can hand out the AdGuard DNS server (ISSUE-0008)
- [ ] MoneyMatter on native arm64 images when upstream publishes them (ISSUE-0009)
- Left out, with reasons ([Decisions](<Decisions.md#adr-0018-not-now-docker-go-sdk-tsnet-several-machines>)): Tailscale built into the binary (tsnet), several machines as one, and GitOps
