---
version: 0.9.0-beta
---

# Roadmap

Where the app is, and what comes next. Every build of main has its own number (0.9.1, 0.9.2, …; [Releasing](<Releasing.md#version-numbers>)); each heading below is the next minor version, and 1.0 is the stable release once the 0.x work has proven itself. Open problems live in [Known Issues](<Known Issues.md>); what changed, and when, in the [CHANGELOG](<../CHANGELOG.md>).

Each version says what it is for, then its items. An item is done when its **Done when** holds, not when the code is merged: a check that runs in CI, a number measured on a real machine, or a person doing it without help. Items marked ✓ are in the builds already; what they left open is listed under them.

## The two goals

Since October 2026 the work is organised around two goals. 0.11 (real Docker in CI) is how both are proven; 0.12 and 0.13 are the goals themselves, and they run side by side.

1. **The same on every system.** Every feature works the same way on macOS, Windows, and Linux (GNOME, KDE Plasma, and SteamOS), and CI proves it on each. Where something truly cannot be done on a system, [Host](<Host.md#the-same-on-every-system>) says why, in place of a missing feature. Today's state is the table there, one row per feature.
2. **More apps in the catalog.** Ten new apps and a second backup engine (0.13), each one held to the bar below.

**New apps no longer wait for 1.0.** The earlier rule kept the catalog as it was until the stable release, so that 1.0 had less to prove. It is replaced by a bar each app passes on its own, so a new app adds its own proof instead of adding to what is unproven:

- its compose service with an `x-homelab` block (category, description, what it replaces), and its own stack with a database when it needs one
- its note under `services/`, generated with `./homelab docs` and written by hand after the block
- a row in [Savings](<Savings.md>) with a real, current price and its source (or a line under *Not counted* saying why not)
- an end-to-end test against the fake docker: it installs, its data is backed up, and it gets its address
- a place in 0.11's nightly run against real Docker, where it starts and answers on its own page
- its image pinned the way the catalog already does (`latest` with the Watchtower label, or an exact version with `pin:` saying why)
- a line in the CHANGELOG

A heavy app (Nextcloud, Frigate, Tdarr) is optional and in no starter or preset a newcomer picks by default.

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

Since then, the Go tests run on macOS and Windows as well as Ubuntu, the click-through and its accessibility checks run on every pull request, the jobs' logs are trimmed, and every package has a coverage floor in CI, with the thin ones above now at 83–100% (0.11, ticked below). What is left of the list, 0.11 and the 1.0 bar below answer.

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
  - **Done when:** Status draws its list in under 1 second warm on each machine, or the slowest part is named with a plan (often 0.15's Engine API)
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
  - Each app 0.13 adds joins the run as it lands: installed, started, and its page answering (the bar in [The two goals](#the-two-goals))
  - **Done when:** the run is green for a week in a row, and a failure opens an issue with the run's `homelab report` attached
- [ ] The proxy image built and run in that job (ISSUE-0001): the CrowdSec bouncer registered and pulling, and a banned address gets 403
  - **Done when:** the nightly run builds `dockerfiles/npm-crowdsec`, `cscli bouncers list` shows the bouncer with a recent pull, and a request from a banned address gets 403
- [ ] `domain setup` against the real Nginx Proxy Manager and AdGuard Home (ISSUE-0004, all but Cloudflare, which stays a fake: it needs a real account)
  - **Done when:** the nightly run makes each proxy host and AdGuard rewrite, and an app answers through the proxy by its name
- [ ] The same run in Home mode, with Tailscale replaced by a fake tailnet, so Setup's checklist is walked from top to bottom by the CLI
  - **Done when:** every step of `homelab setup` the CLI can do ends done in the nightly run, and the ones left name the person's step

### Each system, not only Ubuntu

- [x] The Go tests (`cmd`, `internal`, and the `app` module) on `macos-latest` and `windows-latest` as well as Ubuntu, on every pull request
  - **Done when:** the files for one system (`*_darwin.go`, `*_windows.go`) run their tests on that system, and a test that only passes on Linux is fixed, not skipped
- [ ] The jobs installed for real on each runner: launchd on macOS (ISSUE-0005), the Run key and `homelab-run.exe` on Windows (ISSUE-0013), systemd user units on Linux; then `schedule status` reads them back and `schedule uninstall` leaves nothing behind
  - **Done when:** a CI job on each of the three runners installs, reads back, runs the agent once, and uninstalls, and fails on anything left behind
- [ ] The release builds opened on each runner: the DMG mounted and the app started, the Windows installer run silently and `homelab.exe` found beside the app, the AppImage already started on its own (ISSUE-0014, ISSUE-0021)
  - **Done when:** `release.yml` does each of these on every run and keeps a screenshot of each window

### The app clicked through

- [x] `make app-smoke` on every pull request: each screen, light and dark, as each system's look, against the fake backend
  - **Done when:** CI fails on a script error, a missing element, or a broken layout, and keeps the screenshots of a failing run
- [x] An accessibility check in the same run (axe): every screen with no serious finding, each control named, contrast held in both themes and with more contrast on
- [ ] The app against the real homelab of the nightly run (not the fake backend) at least once a night: Status shows the preset, a job's window runs to the end, Backups shows last night's backup (ISSUE-0015)
  - **Done when:** the nightly run serves the app's frontend from `homelab serve` against its real containers and the click-through passes there

### Tests where a mistake costs most

- [x] A coverage floor per package, checked in CI, raised as tests are added and never lowered without a reason in the pull request
  - First floors: `selfupdate` 80%, `recovery` 80%, `sso` 70%, `notify` 75%, `docker` 60%, `host` 60%, `domain` 70%, `people` 70%
  - **Done when:** each of those packages meets its floor, and the floors are in the Makefile
  - Done in October 2026: `coverage-floors.txt` holds a floor for every package, a point under what each measures, and `make coverage` checks them in CI. The eight measure `selfupdate` 85%, `recovery` 100%, `sso` 89%, `notify` 99%, `docker` 83%, `host` 93%, `domain` 85%, `people` 93%. The system-specific steps (sudo, pkexec, the Mac's password window, Windows' approval prompt, the swap helpers) are checked on every runner through a stand-in for the system, and run for real where a runner can: the shell scripts on Ubuntu and macOS, the Windows ones under PowerShell
- [x] Every package at 70% or more: the ones under it raised, `core` and `pgexec` tested (they had no tests), and the desktop app's own Go module (`app/`, `app/tray`) measured by `make coverage` with floors
  - **Done when:** `make coverage` lists every package of both modules at 70% or more, each floor in `coverage-floors.txt` a point under what it measures
  - October 2026: `ports` 60→84%, `ui` 51→96%, `sysmem` 50→91%, `kit` 70→85%, `diskhealth` 69→90%, `battery` 66→87%, `core` 0→85%, `pgexec` 0→100%; `cmd/homelab` 62→71% and `cmd/homelab-run` 60→81% (its Windows script now runs on the Windows runner); the app module measured in `make coverage` too: `app` 20→75% and `app/tray` 41→81%. The App's methods run against the docker package's fake, with a stand-in for the Wails window (its events, dialogs, and clipboard) and a homelab launcher that says what it was asked; the tray's menu is built and clicked on Linux, where it needs no running tray
- [x] Self-update tested end to end: a fake release with a good download, a bad checksum, a cut-off download, and a full disk; the app is replaced only in the first case and reopens on the old version in the others
  - **Done when:** the four cases are tests that run on each of the three systems' runners
  - Done in October 2026: `TestTheFourCases` in `internal/selfupdate` stages only the good download and leaves nothing behind in the other three, so the app carries on as it is; the helpers that put a build in place run for real (`TestSwapLinuxScriptPutsTheAppImageInPlace`, `TestSwapScriptPutsTheMacAppInPlace`, `TestSwapWindowsScriptUnpacksThePortableBuild`), and the Mac's disk image is opened with `hdiutil` on the macOS runner
- [ ] The recovery kit tested: the printed kit has every secret it needs for a restore and nothing else, and a homelab rebuilt from the kit alone (with the backup) starts
  - **Done when:** a test compares the kit with what a restore reads, and the nightly run restores from the kit and a backup alone

### Upgrades from every release

- [ ] A homelab folder kept from each release from 0.2.0 to 0.9.0-beta (`.env`, update history, paired phones, settings, the jobs' state; made from each tag) under `testdata`, and a test that opens each with the current build
  - **Done when:** each one upgrades with no question asked and no setting lost, and a release that changes a file's shape adds its folder to the set
- [ ] The same, for the app's own update: the previous release's app replaced by this one keeps the window's settings, the paired phones, and the jobs
  - **Done when:** a test replaces the previous release's build with this one in a scratch folder and reads each setting back

### What happens on the machine, kept

- [x] A crash in the app or the agent written to `scripts/logs/crash-<date>.log` (what it was doing, the version, the stack), `homelab report` including the newest, and Status saying "The app stopped unexpectedly yesterday" with **Send the report**
  - **Done when:** a test crashes a real process and reads its log back, and the click-through shows the note, sends the report, and hides it
- [x] The jobs' logs trimmed: each file kept under 5 MB, with the older half moved to `<job>.1.log` (one kept); `homelab report` reads both
  - **Done when:** a test runs the watchdog's logging for a simulated year and the folder stays under 30 MB

## 0.12: the same on every system

Goal 1. The parity audit of October 2026 ([Host](<Host.md#the-same-on-every-system>)) lists each feature on macOS, Windows, Linux, and SteamOS as *works*, *works differently*, *missing*, or *can't*. This version turns every *missing* into one of the others, and every *works* into something CI shows.

### Know where it differs

- [ ] The parity table in Host: one row per feature (Setup, Status, the jobs, alerts, the tray, self-update, installers, drives, sleep and battery, the hosts file and names, the administrator prompt, the app's look), one column per system
  - **Done when:** every cell says *works*, *works differently (how)*, *missing*, or *can't (why)*, and each *works* names the test or CI job that shows it
- [ ] No Mac-only words on other systems: "menu bar", "Finder", "this Mac", and OrbStack only where the app runs on a Mac, and the system's own words elsewhere ("tray", "File Explorer", "this PC")
  - **Done when:** a check in `make frontend-check` and a Go test over the CLI's and the engine's messages fail on a Mac-only word outside a Mac branch, and both pass
  - The Go test is in (`internal/host`, every string literal in `cmd`, `internal`, and `app`); the frontend's strings were read by hand in October 2026 and each Mac word sits beside its system's branch, so its check is still to come

### Close the gaps

- [ ] Each *missing* cell in the table either built, with a test on that system's runner, or turned into *can't* with the reason written in Host
  - **Done when:** the table has no *missing* cell
- [ ] Each *works differently* cell that a person would notice (a step that asks for more, a screen that says less) brought level, or its difference said in plain words on the screen where it shows
  - **Done when:** each such row in the table names the screen that explains it, and the click-through shows that text as that system

### Progress everywhere

The job window already shows a bar and a row per app for an install, Fix it, Update apps, the backups, and Setup's steps (`internal/progress` reads Compose's JSON progress). Four places still say only "busy":

- [x] A bar wherever something waits on a download or a row of apps: the app's own update (now "Downloading…"), Setup's **Set up Docker for me** on SteamOS (one "Downloading …" line per file), the tray's **Update apps now** ("updating…", then "done"), and the CLI in a terminal (Docker's raw lines)
  - **Done when:** the app's update shows how much of its download is in; Docker's setup moves its bar through each file's download; the tray's item names the app it is at and how far along; `homelab up`, `install`, and `update` in a terminal print a line per app as its stage changes instead of Compose's own; and smoke checks (or unit tests, for the tray and the terminal) see each
  - Done in October 2026: `internal/transfer` counts both downloads; the update banner and Setup's **Update now** show the app's (`app:download`), and a step can carry a percent (`ui.StepPercent`), which moves the window's bar within the step and draws a terminal's line again in place. The tray's two jobs follow the CLI's steps and Compose's rows into their title. In a terminal, Compose's output goes through `internal/progress` too (`cmd/homelab/rows.go`). Smoke checks for the banner, Update now, and Docker's setup; unit tests for the tray and the terminal rows, and the rows were run against a real Docker in a pseudo-terminal

### Proven on each runner

- [ ] The jobs installed and read back on each system's runner (0.11's *The jobs installed for real*), as the parity table's proof for the jobs row
- [ ] The tray item started on each runner: on macOS and Windows its menu read back, on Linux it registers with the desktop's status notifier (a test watcher on D-Bus)
  - **Done when:** CI starts `homelab-tray` on each system and reads its items, and the job fails when it does not come up
- [ ] An alert from each system's own path: the tray's notification on macOS and Windows, `notify-send` on Linux, and ntfy everywhere
  - **Done when:** a test on each runner sends one through the code path the watchdog uses and sees it arrive (a fake notification daemon on Linux)
- [x] The names with a domain written and removed on each runner: `/etc/resolver` on macOS, the NRPT rule on Windows, the systemd-resolved drop-in on Linux; and the hosts-file entries the same
  - **Done when:** `domain resolver --apply` then its undo run on each runner with the administrator step automated, and leave the system as it was
  - Done in October 2026: `domain resolver --undo` removes what homelab wrote (and its lines in the hosts file). CI's `ChangedForReal` tests (`go test -tags forreal`) set the resolver and take it back on the Ubuntu, macOS, and Windows runners through sudo or the approval, checking the system's own DNS each time (`resolvectl status`, `scutil --dns`, the NRPT policy), and write the hosts file, look the name up, and put the file back byte for byte
- [ ] Drives, sleep, and battery read on each runner the way the machine would: an external drive (a disk image on macOS, a VHD on Windows, a loop device on Linux) found and its free space read; the sleep setting and the power state read
  - **Done when:** each system's runner has a test for each, not only a fake
- [ ] The click-through as SteamOS too (Plasma in desktop mode, its Breeze look and font), beside Mac, Windows, GNOME, and KDE
  - **Done when:** `make app-smoke` checks every screen as SteamOS with axe, light and dark

### What only the real machines show

Some of Goal 1 cannot be proven by a runner: a signed app opening without a warning, the tray on a real Plasma session in Game Mode, a real external drive, real sleep. Each of these is a step in [Testing › Waiting for real hardware](<Testing.md#waiting-for-real-hardware>), so the first session on each machine is a checklist.

- [ ] Every row of the parity table that CI cannot prove has a numbered step there for the machine that can
  - **Done when:** the list covers the Mac, the Windows PC, and the Steam Machine, each step with what to do and what you should see

## 0.13: more apps

Goal 2. Each item is done when the app passes the bar in [The two goals](#the-two-goals); the **Done when** lines say what is particular to it. In the order they are planned: the light, self-contained apps first, then the ones that lean on another app, then the heavy ones.

- [ ] **Actual Budget:** an envelope budget, lighter than MoneyMatter (one container, no database server)
  - **Done when:** the nightly run creates a budget through its API and reads it back after a restore
- [ ] **Linkwarden:** bookmarks saved permanently (a copy of each page, a screenshot, and a PDF), with its own PostgreSQL
  - **Done when:** the nightly run saves a link and finds its archived copy after a restore; its note says how it differs from Karakeep
- [ ] **Tandoor:** recipes with meal planning and nutrition, with its own PostgreSQL
  - **Done when:** the nightly run adds a recipe through its API and reads it back after a restore; its note says how it differs from Mealie
- [ ] **Kiwix:** offline Wikipedia and reference sites, read from a folder of `.zim` files
  - **Done when:** the nightly run serves a small `.zim` file and finds a page in it; its note says where to get the files and how big they are
- [ ] **Firefly III:** where the money went, from bank imports (with its data importer and its own database)
  - **Done when:** the nightly run imports a sample CSV through the importer and Firefly's API lists the transactions
- [ ] **Beszel:** CPU, memory, and disk history per container (its hub, and its agent with the runtime's socket)
  - **Done when:** the nightly run sees the agent connected to the hub and a container's history in the hub's API; the parity table says what the agent sees on each runtime (OrbStack, Docker Desktop, rootless Docker)
- [ ] **Paperless-AI:** automatic titles and tags for Paperless, using Ollama on this machine
  - **Done when:** it installs only beside Paperless (it `requires` Paperless's API token), the nightly run starts it against the real Paperless and a fake Ollama, and Setup says when Ollama is missing, on each system
- [ ] **Tdarr:** shrinks the media library (its server, with a node of its own); heavy, optional
  - **Done when:** the nightly run starts it, its web page answers, and its note says how much CPU a library takes and how to keep it to the night
- [ ] **Frigate:** cameras with local person and car detection, paired with Home Assistant; heavy, optional
  - **Done when:** the nightly run starts it with a test video as its camera and its API answers; its note covers adding it to Home Assistant, and the parity table says which systems can pass a detector (Coral, GPU) through (no USB or GPU in containers on macOS)
- [ ] **Nextcloud:** shared family files with phone sync; heavy, optional, in no starter
  - **Done when:** the nightly run installs it with its PostgreSQL and Redis, signs in, uploads a file over WebDAV, and reads it back after a restore
- [ ] **Immich share links for the family:** a guided step (Setup, or the note) for sending an album to someone without an account, such as grandparents: the shared-link address that works away from home, how long it lasts, and turning it off
  - **Done when:** the step is in Immich's note and, where the address can be made by the homelab, on Setup; a newcomer can follow it without help
- [ ] **Kopia, a second backup engine beside Duplicati:** proposed first as an ADR in [Decisions](<Decisions.md>) (now [ADR-0019](<Decisions.md#adr-0019-kopia-as-an-optional-second-backup-engine-beside-duplicati>), waiting for the owner) (what it backs up, where, how a restore test and the Backups screen treat two engines, and how someone chooses), and built only once the ADR is accepted
  - **Done when:** the ADR is accepted, and then Kopia passes the same restore test Duplicati does in the nightly run

## 0.14: a frontend that grows

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

## 0.15: the Docker API, in the agent

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
- [ ] The same on every system: the parity table in [Host](<Host.md#the-same-on-every-system>) has no *missing* cell, and every *works* is shown by CI
- [ ] Every app in the catalog started and answered in the nightly run against real Docker at least once a week
- [ ] Signed releases for macOS, Windows, and Linux
- [ ] Upgrade notes between versions, and a timed restore drill on record
  - Every release's folder from 0.11's set upgrades to 1.0 in CI
- [ ] A restore brings back the versions that wrote the data
  - Each nightly backup records every app's image by its digest (not `:latest`) next to the dumps; a restore or a move starts those images first, then offers the updates
  - The apps that change their own data on start (Paperless, Vaultwarden, Ghostfolio, Docmost, Dawarich, Mealie, and the others 0.11's run lists) follow a pinned version in `.env`, updated by `homelab update` and kept by a backup, like the PostgreSQL versions already are
  - **Done when:** 0.11's nightly run restores onto a clean runner with images newer than the backup available, and the apps come up on the backup's versions
- [ ] A rollback brings back the data from before the update, not only the image (ISSUE-0022)
  - **Done when:** the nightly run updates an app across a change of its database schema, rolls it back, and the app answers with its data from before the update
- [ ] Hands-off setup proven: someone who is not technical sets it up on their own computer without help
- [ ] A month with no unexplained alert, a monthly restore test passed each time, and a rollback of a bad update exercised
- [ ] Security review of the app's own code with no open high findings ([threat review](<Security.md#threat-review-of-the-app-october-2026>))
- [ ] The tests at the 1.0 bar: 0.11's nightly run green for a month, the Go tests on all three systems, the click-through and accessibility checks on every pull request, and every coverage floor met
- [ ] Every screen and every page of the docs checked against the 1.0 behaviour; no step that needs Terminal for the common path

## After the two goals

Not held for 1.0 by rule: these start once 0.12 and 0.13 leave room, in this order.

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
