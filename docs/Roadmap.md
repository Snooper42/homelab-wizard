---
version: 0.9.0-beta
---

# Roadmap

Where the app is, and what comes next. Every build of main has its own number (0.9.1, 0.9.2, …; [Releasing](<Releasing.md#version-numbers>)); each heading below is the next minor version, and 1.0 is the stable release once the 0.x work has proven itself. Open problems live in [Known Issues](<Known Issues.md>); what changed, and when, in the [CHANGELOG](<../CHANGELOG.md>).

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

## Still open from the first months

These need the real machines, accounts, or money, not code.

- [ ] The first real install, finished on the Mac: Vaultwarden accounts then sign-ups off, the tunnel, Duplicati jobs on Proton Drive and each run once, alerts on the phone, the jobs, and the first restore test
- [ ] Tailscale verified from the phone on mobile data, two-factor sign-in for Vaultwarden and the proxy admin, CrowdSec console enrollment
- [ ] The Windows PC and the Steam Machine through their checklists (ISSUE-0012, ISSUE-0013, ISSUE-0014, ISSUE-0021)
- [ ] Apple Developer ID (certificate, notarization) and Windows code signing, with the secrets in GitHub ([Releasing](<Releasing.md#secrets>))
- [ ] A second machine (or a NAS) as a cold standby, and a practice takeover ([the runbook](<Disaster Recovery.md#scenario-another-machine-takes-over>))
- [ ] Hand it to someone who is not technical and watch without helping; each place they stop becomes the next fix

## 0.10: fast, everywhere

The app should answer at once on every system, the Windows PC included, where each `docker` command costs more.

- [x] Opening a category on Status redraws the list instead of loading Status again
- [ ] A Status load timed in parts (runtime, page checks, settings drift, stats), so what is slow is measured, not guessed
- [x] The window and the menu bar item read Status through the agent, which reads the runtime once for requests that arrive together (both are told of the same change)
- [x] Page checks fill in after the list instead of holding it (one app not answering cost 3 seconds); the power card reads `docker stats` only while Status is open
- [ ] Each screen loads its cards side by side, not one after another (Status does)

## 0.11: a frontend that grows

Make each screen cheap to change and hard to break.

- [ ] One store per screen's data, written by the engine's changes; components keep their own small state (which categories are open), so a click never reloads a screen
- [ ] The last screens built by hand (the command and log sheets, Settings' page list) as components; `app.ts` down to loading data and choosing screens
- [ ] Shared building blocks (card, sheet, row, segmented control, empty state) used everywhere, with the colours as tokens only
- [ ] CI clicks through every screen in the preview, light and dark, as each system, and fails on a script error, a missing element, or a broken layout
- [ ] An app page: one app's state, address, logs, usage, week, settings, and actions in one place, instead of a row of icons

## 0.12: the Docker API, in the agent

ADR-0018 left the Go SDK out while the CLI's output was enough; on Windows its cost is now measured in 0.10. The agent becomes the one place that reads the runtime.

- [ ] A small client for the Engine API over the socket (the Windows pipe included), found the way the CLI finds it (`DOCKER_HOST`, the current context, OrbStack): containers, inspect, events, stats as a stream, and exec with its output and exit code
- [ ] Compose stays the CLI: starting, stopping, updating, and recreating from the compose files
- [ ] The CLI's `docker` stays as the fallback while the client proves itself on each system

## 0.13: the library, in order

Music and books arrive messy; the homelab tidies them, the same way on every system, with nothing installed beside it.

- [ ] Import music: beets as an app, one job with two sources (new downloads, or an archive folder), albums then loose tracks, into the folder Navidrome reads; what moved and what did not, in the app and through ntfy
- [ ] Books: Calibre-Web Automated's ingest folder (convert, fetch metadata, add), genres put into the household's own list, publishers' blurbs cleaned, with a preview before it touches the library
- [ ] Both from a button and on a schedule; neither needs PowerShell, Calibre, or Python on the computer

## 0.14: the dashboard

- [ ] A home screen: the apps as tiles with live state, what needs a look, and the week at a glance (scope to be agreed)

## 1.0: stable

Not more features: the bar for calling it stable.

- [ ] Every Known Issue verified or accepted with a reason
- [ ] Signed releases for macOS, Windows, and Linux
- [ ] Upgrade notes between versions, and a timed restore drill on record
- [ ] Hands-off setup proven: someone who is not technical sets it up on their own computer without help
- [ ] A month with no unexplained alert, a monthly restore test passed each time, and a rollback of a bad update exercised
- [ ] Security review of the app's own code with no open high findings ([threat review](<Security.md#threat-review-of-the-app-october-2026>))
- [ ] Every screen and every page of the docs checked against the 1.0 behaviour; no step that needs Terminal for the common path

## Later

- [ ] A native iOS app with widgets and Lock Screen status, once signing is in place
- [ ] The taskbar and Dock icon in the colour picked in Appearance
- [ ] A router that can hand out the AdGuard DNS server (ISSUE-0008)
- [ ] MoneyMatter on native arm64 images when upstream publishes them (ISSUE-0009)
- Left out, with reasons ([Decisions](<Decisions.md#adr-0018-not-now-docker-go-sdk-tsnet-several-machines>)): Tailscale built into the binary (tsnet), several machines as one, and GitOps
