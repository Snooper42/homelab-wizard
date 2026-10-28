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
- [x] The timings measured on each real machine, with a number to hold: moved to 0.15 (October 2026, the owner's call), where the real machines are tested and where the Engine API needs these numbers
- [x] A timing check in CI, so a change that makes Status slower is seen before it ships
  - The 0.11 integration run records `status --timing` against its real containers and fails when the list takes more than twice the last good run
  - Done in October 2026: with every app running and holding data, the real-Docker run times `status --json` (the middle of three warm runs) and logs `status --timing`; the time is kept in an Actions cache when the run passes, and a run taking more than twice the last good one (and a second more) fails, with both runs' parts in the failure

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
- [x] The proxy image built and run in that job (ISSUE-0001): the CrowdSec bouncer registered and pulling, and a banned address gets 403
  - **Done when:** the nightly run builds `dockerfiles/npm-crowdsec`, `cscli bouncers list` shows the bouncer with a recent pull, and a request from a banned address gets 403
  - Done in October 2026: `TestTheProxyBlocksABannedAddress`, the nightly workflow's `proxy` job, on a homelab of its own with ntfy, the proxy (built from `dockerfiles/npm-crowdsec`), and CrowdSec: `cscli bouncers list` shows `nginx_proxy_manager` with a last pull and the watchdog's bouncer check passes; a ban on the address the proxy sees (Docker's gateway) gets 403 through the proxy, and lifting it lets ntfy through again
- [x] `domain setup` against the real Nginx Proxy Manager and AdGuard Home (ISSUE-0004, all but Cloudflare, which stays a fake: it needs a real account)
  - **Done when:** the nightly run makes each proxy host and AdGuard rewrite, and an app answers through the proxy by its name
  - Done in October 2026: `TestTheDomainThroughTheProxy`, the nightly workflow's `domain` job, on a homelab of its own with ntfy, the proxy, and AdGuard Home: `domain setup example.test --dns adguard --ip 127.0.0.1 --no-tunnel` makes a proxy host for each running app (five) and AdGuard's `*.example.test` rewrite; both read back through their APIs, ntfy's name resolves through AdGuard's DNS, and ntfy answers through the proxy on port 80 by its name
- [x] The same run in Home mode, with Tailscale replaced by a fake tailnet, so Setup's checklist is walked from top to bottom by the CLI
  - **Done when:** every step of `homelab setup` the CLI can do ends done in the nightly run, and the ones left name the person's step
  - Done in October 2026: `TestHomeModeSetupWalked`, the nightly workflow's `home` job. A Headscale server on the homelab's network is the tailnet; `TAILSCALE_EXTRA_ARGS=--login-server=…` and its key sign the homelab's own Tailscale container in. A new folder with the small baseline is walked as **Do the steps I can** walks it: started, Tailscale installed and its addresses set up, the alert token, the scheduled jobs (systemd user units); Vaultwarden added brings its own steps. Every step the CLI ran ends done, and each left (the boxes only a person ticks, the backup folder, the outside check's address) names the person's part. Then the test plays that part and every step ends done. It found Setup's tailnet step failing when Tailscale had just started (`tailnet setup` now waits up to a minute for the sign-in link or the auth key's sign-in), and `signups open` naming `https://passwords.` with no domain in Home mode (it now names the tailnet address)

### Each system, not only Ubuntu

- [x] The Go tests (`cmd`, `internal`, and the `app` module) on `macos-latest` and `windows-latest` as well as Ubuntu, on every pull request
  - **Done when:** the files for one system (`*_darwin.go`, `*_windows.go`) run their tests on that system, and a test that only passes on Linux is fixed, not skipped
- [x] The jobs installed for real on each runner: launchd on macOS (ISSUE-0005), the Run key and `homelab-run.exe` on Windows (ISSUE-0013), systemd user units on Linux; then `schedule status` reads them back and `schedule uninstall` leaves nothing behind
  - **Done when:** a CI job on each of the three runners installs, reads back, runs the agent once, and uninstalls, and fails on anything left behind
  - Done in October 2026: `TestJobsInstalledForReal` (`go test -tags forreal`, a CI step on Ubuntu, macOS, and Windows) builds the CLI, runs `schedule install`, `status`, waits for the agent to start (on Windows by running the Run key's own command, as at sign-in), then `schedule remove`, and fails on a file, a registration, or a process left. On Windows, removing the jobs now stops the running agent too, as launchd and systemd do
- [x] The release builds opened on each runner: the DMG mounted and the app started, the Windows installer run silently and `homelab.exe` found beside the app, the AppImage already started on its own (ISSUE-0014, ISSUE-0021)
  - **Done when:** `release.yml` does each of these on every run and keeps a screenshot of each window
  - Done in October 2026: `app/packaging/dmg-smoke.sh` mounts the DMG, drags the app to `~/Applications` as a person does, checks its signature, the CLI inside (`homelab version`), the menu bar helper, and the homelab files, then opens it and finds it still running 20 seconds on. `app/packaging/windows-smoke.ps1` runs the installer silently (`/S`, as `install.ps1` does), finds `Homelab Wizard.exe` in Program Files with `homelab.exe`, `homelab-run.exe`, and the homelab files beside it, starts it, and waits for its window titled Homelab Wizard. Each keeps a screenshot (`macos-dmg-screenshot`, `windows-installer-screenshot`), as the AppImage's step already did (`linux-appimage-screenshot`)

### The app clicked through

- [x] `make app-smoke` on every pull request: each screen, light and dark, as each system's look, against the fake backend
  - **Done when:** CI fails on a script error, a missing element, or a broken layout, and keeps the screenshots of a failing run
- [x] An accessibility check in the same run (axe): every screen with no serious finding, each control named, contrast held in both themes and with more contrast on
- [x] The app against the real homelab of the nightly run (not the fake backend) at least once a night: Status shows the preset, a job's window runs to the end, Backups shows last night's backup (ISSUE-0015)
  - **Done when:** the nightly run serves the app's frontend from `homelab serve` against its real containers and the click-through passes there
  - Done in October 2026: after the nightly backup, the real-Docker run starts `homelab serve`, makes a pairing code (`phone pair --can-change`), and `app/preview/real.mjs` pairs with it in Chromium at phone width, then checks that Status lists every app the run installed, Backups shows each copy fresh, and **Back up now** runs to "Backup done" in its window. A failed step's screenshot goes with the run's report

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
- [x] The recovery kit tested: the printed kit holds no secret, so it is safe to print, and names everything a restore reads: the backup folder, each backup job and what it holds, and the line where the Secrets passphrase is written by hand
  - **Done when:** a test gives every secret in `.env` a value of its own and finds none on the kit, and finds the backup folder, each job, and the passphrase's line on it
  - Reworded in October 2026 (the owner's call): the kit was secret-free by design, and the old wording asked for the secrets on it. Done in October 2026: `TestRecoveryKitHoldsNoSecretAndNamesWhatARestoreNeeds` fills every placeholder in `.env.example` (each generated value and passphrase) and checks none is on the kit, and that the backup folder, all the Homelab jobs, and `DUPLICATI_SECRETS_PASSPHRASE`'s line are. A whole homelab rebuilt from Duplicati onto a clean machine is 1.0's (*A restore brings back the versions that wrote the data*)

### Upgrades from every release

- [x] A homelab folder kept from each release from 0.2.0 to 0.9.0-beta (`.env`, update history, paired phones, settings, the jobs' state; made from each tag) under `testdata`, and a test that opens each with the current build
  - **Done when:** each one upgrades with no question asked and no setting lost, and a release that changes a file's shape adds its folder to the set
  - Done in October 2026: `testdata/upgrades/<tag>` for 0.2.0 to 0.8.0, 0.9.0-beta, and 0.9.56-beta, each made by `testdata/upgrades/make.sh` from that tag. Its CLI installs ntfy against a stand-in Docker (making `.env` as that release did) and holds ntfy's updates, two settings are changed as in Settings, and `make/main.go`, built inside the tag, writes the phones, the update history, Setup's steps, a restore test, the watchdog's state, a week of savings, and the household. `TestEachReleasesFolderUpgrades` opens each with this build (install, Setup, Status with no input) and checks every setting kept, each new one from `.env.example` added, and each file read back. Releasing says when a version adds its folder
- [x] The same, for the app's own update: the previous release's app replaced by this one keeps the window's settings, the paired phones, and the jobs
  - **Done when:** a test replaces the previous release's build with this one in a scratch folder and reads each setting back
  - Done in October 2026: `TestAnUpdateKeepsTheWindowThePhonesAndTheJobs` (`internal/selfupdate`, on the Ubuntu, macOS, and Windows runners) runs each system's real update helper (the Mac's bundle swap, the AppImage's, the portable Windows build's) on stand-in builds in a scratch folder, with the window's place and size, the phones the newest release in `testdata/upgrades` paired, and the agent's job (its plist, systemd unit, or Run value) pointing at the CLI. Each reads back the same after, and the job's program is there. It showed that an AppImage's jobs run a copy of the CLI in the homelab folder that the update left on the previous release; the app now copies it again at its next start (`core.JobsCLIBehind`)

### What happens on the machine, kept

- [x] A crash in the app or the agent written to `scripts/logs/crash-<date>.log` (what it was doing, the version, the stack), `homelab report` including the newest, and Status saying "The app stopped unexpectedly yesterday" with **Send the report**
  - **Done when:** a test crashes a real process and reads its log back, and the click-through shows the note, sends the report, and hides it
- [x] The jobs' logs trimmed: each file kept under 5 MB, with the older half moved to `<job>.1.log` (one kept); `homelab report` reads both
  - **Done when:** a test runs the watchdog's logging for a simulated year and the folder stays under 30 MB

## 0.12: the same on every system

Goal 1. The parity audit of October 2026 ([Host](<Host.md#the-same-on-every-system>)) lists each feature on macOS, Windows, Linux, and SteamOS as *works*, *works differently*, *missing*, or *can't*. This version turns every *missing* into one of the others, and every *works* into something CI shows.

### Know where it differs

- [x] The parity table in Host: one row per feature (Setup, Status, the jobs, alerts, the tray, self-update, installers, drives, sleep and battery, the hosts file and names, the administrator prompt, the app's look), one column per system
  - **Done when:** every cell says *works*, *works differently (how)*, *missing*, or *can't (why)*, and each *works* names the test or CI job that shows it
  - Done in October 2026: the last *works* cells without a test got one: `TestNativeAppOpensForReal` and `TestNativeAppsOpenAfterARestartForReal` (`go test -tags forreal`, CI's macOS runner, with the Jellyfin cask installed) open Jellyfin as Status's button and the startup after a restart do, and wait for its server. Frigate's detector on Linux is *works differently*: added by hand, as Frigate's note says, and the homelab does none of it
- [x] No Mac-only words on other systems: "menu bar", "Finder", "this Mac", and OrbStack only where the app runs on a Mac, and the system's own words elsewhere ("tray", "File Explorer", "this PC")
  - **Done when:** a check in `make frontend-check` and a Go test over the CLI's and the engine's messages fail on a Mac-only word outside a Mac branch, and both pass
  - Done in October 2026: the Go test (`internal/host`, every string literal in `cmd`, `internal`, and `app`), and `app/preview/words.mjs` in `make frontend-check` (every string, template, and JSX text in `web/src` through TypeScript's parser, and `index.html`). The click-through also reads each screen as Windows, GNOME, KDE, and SteamOS, its text and what a screen reader says, for the same words. The Go test also catches the Mac's `open -e .env` and "to the Trash" (two CLI messages had them on every system)

### Close the gaps

- [x] Each *missing* cell in the table either built, with a test on that system's runner, or turned into *can't* with the reason written in Host
  - **Done when:** the table has no *missing* cell
  - Signed builds moved to 1.0 in October 2026 (the owner's call; 1.0 already has *Signed releases*): the Mac's build is signed ad hoc and Windows' is unsigned until the certificates are in place, which the table now says as *works differently*
  - Progress in October 2026: Jellyfin on SteamOS, both cells, is *works differently*: SteamOS takes no native install, so there `homelab install jellyfin` and the **Movies and TV** pick install Jellyfin in a container (`jellyfin-container`, `catalog.ForSteamOS`), with its library in `JELLYFIN_DATA_DIR` as the native app's is (`TestOnSteamOSJellyfinIsTheContainer`; the nightly catalog job starts the container on Ubuntu). Left: signed builds on macOS and Windows, which wait for the certificates
- [x] Each *works differently* cell that a person would notice (a step that asks for more, a screen that says less) brought level, or its difference said in plain words on the screen where it shows
  - **Done when:** each such row in the table names the screen that explains it, and the click-through shows that text as that system
  - Done in October 2026 (the screens' hold lifted for it): `web/src/differs.ts` holds each system's words. Choose stacks says under Beszel what it sees on a Mac and Windows, and under Frigate how each system detects; Setup's machine card says under Tray icon how *needs a look* shows on Windows and GNOME, and that GNOME needs the AppIndicator extension; Appearance says why there is no system accent on a Linux desktop without one; Status's **Start** for Jellyfin says what Windows and Linux ask for. Each is a click-through check drawn as that system, and each row in Host names its screen. Host lists the cells no one sees on a screen, and Getting Started says how to answer the unsigned build's question on Windows, as it did on the Mac

### Progress everywhere

The job window already shows a bar and a row per app for an install, Fix it, Update apps, the backups, and Setup's steps (`internal/progress` reads Compose's JSON progress). Four places still say only "busy":

- [x] A bar wherever something waits on a download or a row of apps: the app's own update (now "Downloading…"), Setup's **Set up Docker for me** on SteamOS (one "Downloading …" line per file), the tray's **Update apps now** ("updating…", then "done"), and the CLI in a terminal (Docker's raw lines)
  - **Done when:** the app's update shows how much of its download is in; Docker's setup moves its bar through each file's download; the tray's item names the app it is at and how far along; `homelab up`, `install`, and `update` in a terminal print a line per app as its stage changes instead of Compose's own; and smoke checks (or unit tests, for the tray and the terminal) see each
  - Done in October 2026: `internal/transfer` counts both downloads; the update banner and Setup's **Update now** show the app's (`app:download`), and a step can carry a percent (`ui.StepPercent`), which moves the window's bar within the step and draws a terminal's line again in place. The tray's two jobs follow the CLI's steps and Compose's rows into their title. In a terminal, Compose's output goes through `internal/progress` too (`cmd/homelab/rows.go`). Smoke checks for the banner, Update now, and Docker's setup; unit tests for the tray and the terminal rows, and the rows were run against a real Docker in a pseudo-terminal

### Proven on each runner

- [x] The jobs installed and read back on each system's runner (0.11's *The jobs installed for real*), as the parity table's proof for the jobs row
- [x] The awake job's hold on sleep, on each runner: held while the job runs, and gone when it stops
  - **Done when:** each system's runner sees the hold in the system's own list of what keeps it awake
  - Done in October 2026: `TestKeepAwakeForReal` (`cmd/homelab`, `go test -tags forreal`) starts `keepAwake` as the job does, finds caffeinate's PreventSystemSleep in `pmset -g assertions`, the test's program under SYSTEM in `powercfg /requests`, or homelab's block in `systemd-inhibit --list`, then stops it and sees the hold gone. On Ubuntu it first found polkit refusing the hold to a job outside a login session, as the agent is: Setup's step **This machine stays awake while plugged in** (`homelab awake allow`) now writes a rule letting this account block sleep, the test grants it that way, and `doctor` checks the hold is really there. Letting go on battery stays with M2 and W2: a runner has no battery
- [x] The tray started at login, on each runner: turned on as Settings does, run the way login runs it, and turned off with nothing left
  - **Done when:** each system's runner turns it on, has the system start what it wrote, and sees it gone when turned off
  - Done in October 2026: `TestTrayAtLoginForReal` (`app`, `go test -tags forreal`) writes the LaunchAgent, the Run value, or the autostart entry with a stand-in program; `launchctl bootstrap` runs it on macOS, the Run value's own command line runs on Windows, and `gio launch` starts the entry on Linux, its path with a space
- [x] The tray item started on each runner: on macOS and Windows its menu read back, on Linux it registers with the desktop's status notifier (a test watcher on D-Bus)
  - **Done when:** CI starts `homelab-tray` on each system and reads its items, and the job fails when it does not come up
  - Linux is in (October 2026): `TestTrayRegistersForReal` (`app/tray`, `go test -tags forreal`, in CI's `app` job) starts `homelab-tray` on a session bus of its own, sees it register with a watcher the test plays, reads its menu over dbusmenu, and clicks Quit. The Mac is in too: the same test on the macOS runner starts the helper, clicks its menu bar item and reads its menu through System Events (the Accessibility API, which the runner allows), then clicks Quit and sees it end. On Windows the test starts it, finds its icon in `HKCU\Control Panel\NotifyIconSettings` (Windows' own record of the notification area's icons), sends its window the message the taskbar sends on a right click on the icon, reads the menu Windows shows (`MN_GETHMENU`, `GetMenuStringW`), and chooses Quit
- [x] The "needs a look" mark on each runner: the Dock count on macOS, the tray icon's dot on Windows, the taskbar count over D-Bus on Linux
  - **Done when:** each system's runner sets the mark and reads it back from where the system shows it
  - Linux is in (October 2026): `TestBadgeArrivesForReal` (`app`, `go test -tags forreal`, in CI's `app` job) sends the count through `setBadge` on a session bus of its own and hears the Unity launcher update Plasma's taskbar and Ubuntu's dock read, then the count cleared
  - The Mac is in too: `TestDockBadgeForReal` (`app/dock`, on the macOS runner) runs an app of its own in the Dock, sets its badge to 3 through `dock.SetBadge` (the app's own call) and then clears it, and reads each from the Dock's own record (`lsappinfo`'s `StatusLabel`)
  - Windows' dot cannot be read back on a runner: Windows has no way for one program to read another's notification-area icon. The dot is drawn by the tray's icon code (unit tests) whenever the menu's reading needs a look, which the Windows runner's tray test reads; seeing it on the PC is W13, which the owner moved with the other real-machine steps to 0.15
- [x] An alert from each system's own path: the tray's notification on macOS and Windows, `notify-send` on Linux, and ntfy everywhere
  - **Done when:** a test on each runner sends one through the code path the watchdog uses and sees it arrive (a fake notification daemon on Linux)
  - Linux and Windows are in (October 2026): `TestDesktopAlertArrivesForReal` sends one through `notify.Desktop` and `notify-send` to a notification server the test plays on D-Bus, and `TestToastArrivesForReal` sends one through the same call on the Windows runner and finds it in Windows' toast history (`ToastNotificationManager.History`) under Homelab.Wizard. The Mac's is in too: `TestDesktopAlertArrivesForReal` (`internal/notify`) sends one through `notify.Desktop` (`osascript`) on the macOS runner and finds its title in Notification Center's own record (usernoted's database, `~/Library/Group Containers/group.com.apple.usernoted/db2`)
- [x] The names with a domain written and removed on each runner: `/etc/resolver` on macOS, the NRPT rule on Windows, the systemd-resolved drop-in on Linux; and the hosts-file entries the same
  - **Done when:** `domain resolver --apply` then its undo run on each runner with the administrator step automated, and leave the system as it was
  - Done in October 2026: `domain resolver --undo` removes what homelab wrote (and its lines in the hosts file). CI's `ChangedForReal` tests (`go test -tags forreal`) set the resolver and take it back on the Ubuntu, macOS, and Windows runners through sudo or the approval, checking the system's own DNS each time (`resolvectl status`, `scutil --dns`, the NRPT policy), and write the hosts file, look the name up, and put the file back byte for byte
- [x] Drives, sleep, and battery read on each runner the way the machine would: an external drive (a disk image on macOS, a VHD on Windows, a loop device on Linux) found and its free space read; the sleep setting and the power state read
  - **Done when:** each system's runner has a test for each, not only a fake
  - Done in October 2026: `go test -tags forreal` on each runner. `TestExternalDriveForReal` makes a 32 MB drive (hdiutil, diskpart, a loop mount under `/mnt`), finds it with `ExternalDrive`, reads its space, takes it away, and sees it missing. `TestSleepSettingForReal` changes the sleep on power with `pmset` or `powercfg` and reads it back (then puts it back), and on Linux reads GNOME's keys through `gsettings` and Plasma's `powerdevilrc`. `TestPowerStateForReal` reads each system's own source and finds the runner on mains power, with no battery.
- [x] What Setup reads from the system, changed and read back on each runner: the time zone a new `.env` gets, the Machine row's system and model, and the system's accent colour
  - **Done when:** each system's runner has a test for each that goes through the system's own tool or store, and puts it back as it was
  - Done in October 2026: `TestTimeZoneForReal` (`internal/envfile`) sets two zones with `systemsetup`, `tzutil`, or `timedatectl`, reads each back, and makes a new `.env` with it; `TestMachineReadForReal` (`app`) reads the system and model; `TestAccentReadForReal` sets the accent with `defaults` on macOS and in the registry on Windows, and on Ubuntu through `gsettings` and a `kdeglobals` of its own
- [x] The click-through as SteamOS too (Plasma in desktop mode, its Breeze look and font), beside Mac, Windows, GNOME, and KDE
  - **Done when:** `make app-smoke` checks every screen as SteamOS with axe, light and dark
  - Done in October 2026: SteamOS is a system of its own in the sweep (the Steam Machine, Docker run as you, `/home/deck`), and KDE is now a Fedora KDE machine. Each system carries what its Go side reports (runtime, scheduler, folder, the runtime's hint), so a screen as Windows no longer shows the Mac's OrbStack

### What only the real machines show

Some of Goal 1 cannot be proven by a runner: a signed app opening without a warning, the tray on a real Plasma session in Game Mode, a real external drive, real sleep. Each of these is a step in [Testing › Waiting for real hardware](<Testing.md#waiting-for-real-hardware>), so the first session on each machine is a checklist.

- [x] Every row of the parity table that CI cannot prove has a numbered step there for the machine that can
  - **Done when:** the list covers the Mac, the Windows PC, and the Steam Machine, each step with what to do and what you should see
  - Progress in October 2026: steps added for a native app started from Status (M12, W12), the "needs a look" mark on the icon (M13, W13, S11), each system's look (M14, W14, S12), and the tray at login (M15, W15; S2 on the Steam Machine)
  - Done in October 2026: each row of the parity table in Host now ends its *Proven by* with *on the machine* and the steps that show it there; the rows CI cannot show on every system that had none got M16 to M18 (battery saver, the hosts file, Beszel's view), W16 to W20 (the same, Jellyfin's service at boot, Kopia on a drive letter), and S14 to S16 (Docker started from Setup, the hosts file across an update, Kopia on `/run/media/deck`). Rows without one are shown by CI on each system already, or have nothing to show yet (signed builds)

## 0.13: more apps

Goal 2. Each item is done when the app passes the bar in [The two goals](#the-two-goals); the **Done when** lines say what is particular to it. In the order they are planned: the light, self-contained apps first, then the ones that lean on another app, then the heavy ones.

- [x] **Actual Budget:** an envelope budget, lighter than MoneyMatter (one container, no database server)
  - **Done when:** the nightly run creates a budget through its API and reads it back after a restore
  - Done in October 2026: the run sets the server's password through its API, then makes a budget with an account and a transaction through Actual's own API package (`@actual-app/api`, which syncs it to the server as the app does); after the move a fresh client downloads it from the server and reads the transaction back
- [x] **Linkwarden:** bookmarks saved permanently (a copy of each page, a screenshot, and a PDF), with its own PostgreSQL
  - **Done when:** the nightly run saves a link and finds its archived copy after a restore; its note says how it differs from Karakeep
- [x] **Tandoor:** recipes with meal planning and nutrition, with its own PostgreSQL
  - **Done when:** the nightly run adds a recipe through its API and reads it back after a restore; its note says how it differs from Mealie
- [x] **Kiwix:** offline Wikipedia and reference sites, read from a folder of `.zim` files
  - **Done when:** the nightly run serves a small `.zim` file and finds a page in it; its note says where to get the files and how big they are
- [x] **Firefly III:** where the money went, from bank imports (with its data importer and its own database)
  - **Done when:** the nightly run imports a sample CSV through the importer and Firefly's API lists the transactions
  - Done in October 2026: the run sets the importer up as its note says (the token in `.env`, then installed), sends a two-line bank CSV through the importer's own `importer:import`, and finds both transactions through Firefly's API, before and after the move
- [x] **Beszel:** CPU, memory, and disk history per container (its hub, and its agent with the runtime's socket)
  - **Done when:** the nightly run sees the agent connected to the hub and a container's history in the hub's API; the parity table says what the agent sees on each runtime (OrbStack, Docker Desktop, rootless Docker)
- [x] **Paperless-AI:** automatic titles and tags for Paperless, using Ollama on this machine
  - **Done when:** it installs only beside Paperless (it `requires` Paperless's API token), the nightly run starts it against the real Paperless and a fake Ollama, and Setup says when Ollama is missing, on each system
- [x] **Tdarr:** shrinks the media library (its server, with a node of its own); heavy, optional
  - **Done when:** the nightly run starts it, its web page answers, and its note says how much CPU a library takes and how to keep it to the night
- [x] **Frigate:** cameras with local person and car detection, paired with Home Assistant; heavy, optional
  - **Done when:** the nightly run starts it with a test video as its camera and its API answers; its note covers adding it to Home Assistant, and the parity table says which systems can pass a detector (Coral, GPU) through (no USB or GPU in containers on macOS)
  - Done in October 2026 (#204): FFmpeg's test pattern is its camera (the runner has none), saved through Frigate's own API; the run sees frames arrive in its stats and Frigate online on its broker, before and after the move
- [x] **Nextcloud:** shared family files with phone sync; heavy, optional, in no starter
  - **Done when:** the nightly run installs it with its PostgreSQL and Redis, signs in, uploads a file over WebDAV, and reads it back after a restore
  - Done in October 2026 (#208): installed by itself on its first start with the administrator from `.env`, a file uploaded over WebDAV, and read back after the move
- [x] **Immich share links for the family:** a guided step (Setup, or the note) for sending an album to someone without an account, such as grandparents: the shared-link address that works away from home, how long it lasts, and turning it off
  - **Done when:** the step is in Immich's note and, where the address can be made by the homelab, on Setup; a newcomer can follow it without help
  - Done in October 2026: Immich's note has *Sending an album to family without an account* (the address that works away from home, with a domain or in Home mode; how long a link lasts, a password, what they may do; and turning a link off), and with a domain Setup shows *Photo links that open anywhere* with your own address once the tunnel is up (`TestSteps`, `internal/setup`). The newcomer following it is a real-person step, which the owner moved to 0.15 with the real machines
- [x] **Kopia, a second backup engine beside Duplicati:** proposed first as an ADR in [Decisions](<Decisions.md>) (now [ADR-0019](<Decisions.md#adr-0019-kopia-as-an-optional-second-backup-engine-beside-duplicati>), accepted in October 2026: beside Duplicati, Kopia rather than restic, offered by Setup with a second drive by default, and a nightly restore test of both engines)
  - **Done when:** the ADR is accepted, and then Kopia passes the same restore test Duplicati does in the nightly run
  - Progress in October 2026: Kopia is an optional app (Choose stacks › System), pinned, with its repository at `KOPIA_REPOSITORY` made or reconnected at each start and every source scheduled for 3:45. The nightly run snapshots a file through Kopia's API, restores its folder into `recovery-staging` and reads it, then after the move finds it in the repository again. Setup's step *A second copy with Kopia* offers each drive plugged in (then the cloud drives), never the one with Duplicati's backups or the media, through `homelab kopia repository`, which checks you can write there and starts Kopia again on it; start.sh then connects to the repository in the new folder, or makes one, instead of writing into a folder with no repository file (tried against the real image, and on an exFAT drive mounted as you). `homelab restore-test --auto --engine kopia` restores a sample of settled files from Kopia's newest snapshot and compares them, on record as Kopia's with its own monthly reminder, and the real-Docker run runs it after the folder restore. The nightly run also tests Duplicati's own restore: Setup's two backup steps (a folder beside the homelab, then the jobs), and once Homelab AppData has run, `homelab restore-test --auto` restoring a sample of settled files and comparing them. The Backups screen has a line for each engine: Duplicati's jobs, and, with Kopia installed, *Second copy (Kopia)*: where its repository is, its own last restore test (or the failure, or that one is due), and **Test Kopia's restore** (`homelab restore-test --auto --engine kopia`); `TestKopiaLine` and three click-through checks

## 0.14: a frontend that grows

Make each screen cheap to change and hard to break. 0.11's click-through is the safety net for this work: each step below must leave it green.

- [x] One store per screen's data, written by the engine's changes; components keep their own small state (which categories are open), so a click never reloads a screen
  - **Done when:** no screen calls the backend from a click handler except for an action, and the smoke test counts zero reloads while opening and folding every category
  - `web/src/store.ts` keeps each screen's data; picking a screen draws it and reads it again only when the engine said it changed or it is over a minute old. The click-through counts the fake backend's calls: none while opening and folding every category, and none when going back to screens already read
- [x] The last screens built by hand (the command and log sheets, Settings' page list) as components; `app.ts` down to loading data and choosing screens
  - **Done when:** `app.ts` is under 400 lines (1,713 in October 2026), and no screen builds elements with `document.createElement`
  - Done in three steps: the sheets' contents (#260), the rest of what was built by hand (#261), then each screen's code in `web/src/screens` with `core.ts` and `jobs.ts` beside it; `app.ts` is 141 lines, and `app/preview/lint.mjs` (in `make frontend-check`) fails if it reaches 400 or anything in `web/src` calls `document.createElement`
- [x] Shared building blocks (card, sheet, row, segmented control, empty state) used everywhere, with the colours as tokens only
  - **Done when:** a check in `frontend-check` fails on a colour written outside the tokens, or on a block's markup written outside the blocks
  - Every colour a rule uses is a token in `style.css`'s `:root`; the blocks are components in `web/src/parts` (Card, CardHead, Rows and Row, Segmented, Empty, Sheet) that every screen draws with; `app/preview/lint.mjs` fails on a colour written in a rule or a component, and on a block's markup written anywhere else. A preview page per block was dropped (October 2026): the click-through already draws every screen, and so every block, on each system
- [x] A job's window: a row per app in plain words with its own bar, the whole job's bar, Docker's lines under Show details (installing, Fix it, Update apps, Backups, Setup)
  - Every long job shows the same window: what each app is doing ("Downloading · 54%", "Starting"), and Docker's own output only when asked for
- [ ] An app page: one app's state, address, logs, usage, week, settings, and actions in one place, instead of a row of icons
  - Its log with **Explain this** (the AI on this machine), its last backup and its last restore test, its update history with **Roll back**, and the people who can sign in to it
  - **Done when:** every action on a Status row is also on the app's page, and the row keeps only Open and the page
- [x] The window draws the last Status at once when it opens, then refreshes it
  - The agent keeps the last Status it read; the window draws it marked with its age ("a few seconds ago") and replaces it when the fresh one arrives, instead of an empty list while Docker answers
  - **Done when:** the click-through opens the app against a slow fake engine and the list is drawn before the engine answers, then updated once it does
  - The engine keeps its last good reading (`GET /v1/status/last`; `/v1/status` itself still always reads the runtime); the window and the phone companion ask for it with `LastStatus` and draw it under "As it was a few seconds ago; checking now…". The click-through's *Status draws the last reading at once, then the fresh one* opens against an engine that takes 3 seconds
- [x] A click answers at once: Start, Stop, Restart, and Update change their row straight away ("Starting…"), then the runtime confirms it or the row goes back with the error
  - **Done when:** the click-through sees the row change before the fake backend answers, and a failed action puts the row back and says why
  - Roll back and a category's Start them do the same. The row keeps "Restarting…" until Status has read the result, so it never flickers back to the old state; a failure stays under the row ("Could not stop: …") until the next action on that app
- [x] Motion and transparency in Settings › Appearance, beside Theme and Contrast: **Motion** (Like the system, Less, None) and **Transparency** (Like the system, Off)
  - Every animation and transition follows them, the ones that ignore the system's "reduce motion" today included (the meter, the row buttons' fade, the switch); Off drops the blur behind the save bar and the phone companion's bar
  - Each system's default may differ (less blur on SteamOS, if 0.10's timings or the Steam Machine show it costs there)
  - **Done when:** the click-through draws each screen with Motion at None and finds no animation or transition running, and with Transparency Off finds no `backdrop-filter`
  - `tray.Appearance` keeps Motion and Transparency; appearance.ts sets `motion-less`, `motion-none`, and `no-blur` on the page from them, or from the system's reduce motion and reduce transparency while they are Like the system (followed live), the phone included; style.css's own reduced-motion blocks went into those classes. Less stops what slides, spins, or grows and keeps colour fades; Off also draws Windows' Mica and the Mac's see-through side panel solid

## 0.15: the Docker API, in the agent

ADR-0018 left the Go SDK out while the CLI's output was enough; on Windows its cost is now measured in 0.10. The agent becomes the one place that reads the runtime.

- [ ] The timings measured on each real machine, with a number to hold (from 0.10)
  - `homelab status --timing` run on the Mac, the Windows PC, and the Steam Machine, cold (just after sign-in) and warm, and the results written here
  - **Done when:** Status draws its list in under 1 second warm on each machine, or the slowest part is named with a plan (often this version's Engine API)
- [ ] The real-machine steps (Testing › Waiting for real hardware: M, W, and S) and the steps a person follows (a newcomer sending an album with Immich's share links), moved here from 0.11 to 0.13 in October 2026 (the owner's call): those versions count them as done, and they are walked on the Mac, the Windows PC, and the Steam Machine here
- [ ] A small client for the Engine API over the socket (the Windows pipe included), found the way the CLI finds it (`DOCKER_HOST`, the current context, OrbStack): containers, inspect, events, stats as a stream, and exec with its output and exit code
  - **Done when:** 0.11's nightly run passes with the client on, on each system's runner, and Status is faster than the CLI on the Windows PC by the 0.10 timings
- [ ] Compose stays the CLI: starting, stopping, updating, and recreating from the compose files
- [ ] The CLI's `docker` stays as the fallback while the client proves itself on each system
  - A setting (and `homelab doctor`) says which one is in use, and the client falls back by itself after an error it does not know, saying so in the report
- [ ] The new ADR in [Decisions](<Decisions.md>) that replaces ADR-0018's Docker part, with the 0.10 measurements behind it
- [ ] The agent follows the runtime's events and tells the window and the menu bar item of each change, so no screen asks the runtime when it is opened or switched to
  - A container started, stopped, or unhealthy reaches Status within a second, without a refresh; the window asks again only after it was asleep or the agent restarted
  - **Done when:** the nightly run stops a container behind the app's back and the agent's Status stream has it stopped within 2 seconds, with no Status request made
- [ ] One request per screen: Status's cards (the watchdog, alerts, storage, usage, the week, protection) come back from the agent in one answer, each filled in as it is ready, instead of about eight requests
  - **Done when:** the click-through counts one backend request when Status opens, and the cards still fill in one by one

## 1.0: stable

Not more features: the bar for calling it stable. Each line is checked by CI, a number on record, or a person; none is "it should work".

- [ ] Every Known Issue verified or accepted with a reason
- [ ] The same on every system: the parity table in [Host](<Host.md#the-same-on-every-system>) has no *missing* cell, and every *works* is shown by CI
- [ ] Every app in the catalog started and answered in the nightly run against real Docker at least once a week
  - Progress in October 2026: the nightly workflow's `catalog` job starts a seventh of the apps the life run does not cover each night, by the day of the week (`TestTheCatalogStarts`, `REALDOCKER_CATALOG=<n>/7`), each alone on a homelab of its own; run by hand it takes all seven. The four that need a setting from the person's own account are skipped with that reason: cloudflared (its tunnel token), Gluetun (its VPN key) and qBittorrent (which waits for Gluetun), and the Beszel agent (its key). Its first run by hand found Ghostfolio stopping at every start (TLS to its own database) and File Browser, Seerr, and Homebox unable to write their folders under a uid other than 1000, then Homebox refusing to start without its new API key pepper; all are fixed
- [ ] Signed releases for macOS, Windows, and Linux (moved here from 0.12's parity table: a Developer ID for the Mac and a code-signing certificate for Windows, docs/Releasing.md)
- [ ] Upgrade notes between versions, and a timed restore drill on record
  - Every release's folder from 0.11's set upgrades to 1.0 in CI
- [ ] A restore brings back the versions that wrote the data
  - Each nightly backup records every app's image by its digest (not `:latest`) next to the dumps; a restore or a move starts those images first, then offers the updates
  - The apps that change their own data on start (Paperless, Vaultwarden, Ghostfolio, Docmost, Dawarich, Mealie, and the others 0.11's run lists) follow a pinned version in `.env`, updated by `homelab update` and kept by a backup, like the PostgreSQL versions already are
  - **Done when:** 0.11's nightly run restores onto a clean runner with images newer than the backup available, and the apps come up on the backup's versions
  - Progress in October 2026: the nightly backup notes each running app's image and its registry digest in `recovery-staging/databases/images` (newest 7 kept, off-site with the dumps, and in a move's bundle). `homelab move in` pulls each by its digest and puts it under the name its compose file uses before anything starts, then lists those apps for `homelab update`. The nightly run moves in a homelab whose ntfy runs an older version than `:latest` and checks ntfy comes back on that one. Still to do: the pinned versions for the apps that change their own data on start, and a restore from Duplicati onto a clean machine (it uses the same record once its files are back)
- [ ] A rollback brings back the data from before the update, not only the image (ISSUE-0022)
  - As [ADR-0020](<Decisions.md#adr-0020-a-rollback-puts-back-the-apps-data-with-its-image>) decided in October 2026: the agent runs the nightly updates and copies each app's data first (2 GB a folder, databases always), and the watchdog puts data back by itself only when the app never came up healthy after the update
  - **Done when:** the nightly run updates an app across a change of its database schema, rolls it back, and the app answers with its data from before the update
  - Progress in October 2026: `homelab update` copies the data of each app whose image changed (stopped, each folder and named volume up to `UPDATE_COPY_LIMIT`, its dumps), and `homelab rollback` puts it back, setting today's aside in `recovery-staging/rolled-back` (`--image-only` keeps it, `--data` restores it later). The nightly run shows a file written after the update set aside by the rollback. The watchdog puts the data back by itself only when the app was never well after the update (`healthyAfter` in `data/updates.json`), and otherwise offers `--data`; the nightly run makes ntfy hang right after an update and checks the watchdog puts back its image and data, setting aside a file written while it hung. Still to do: the nightly updates run by the agent
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

- [ ] A home screen: the apps as tiles with live state, what needs a look, and the week at a glance
  - On hold (the owner, October 2026): two mockups were tried and neither fit; Status stays as it is until this is picked up again
  - Built from 0.14's building blocks and stores, with 0.14's app page behind each tile, and fed by 0.15's live event and stats streams from the agent

### Later

- [ ] A native iOS app with widgets and Lock Screen status, once signing is in place
- [ ] The taskbar and Dock icon in the colour picked in Appearance
- [ ] A router that can hand out the AdGuard DNS server (ISSUE-0008)
- [ ] MoneyMatter on native arm64 images when upstream publishes them (ISSUE-0009)
- Left out, with reasons ([Decisions](<Decisions.md#adr-0018-not-now-docker-go-sdk-tsnet-several-machines>)): Tailscale built into the binary (tsnet), several machines as one, and GitOps
