# Changelog

What changed in each version of Homelab Wizard, newest first. Each version's notes are also its release notes on GitHub, and what the app shows before an update.

Notes are grouped as **New**, **Improved**, and **Fixed**, one line each, in plain words. The pull requests behind a version hold the details. Versions before 0.9.0-beta were tagged afterwards, at the commit where each one ended.

## [Unreleased]

### New

- **Tandoor:** recipes with meal planning, shopping lists, and nutrition (Choose stacks › Household).
- **Linkwarden:** bookmarks for the household in shared collections, each page kept as a screenshot, a PDF, and text (Choose stacks › Documents).
- **Beszel:** how this machine and its apps are doing over time (CPU, memory, disks, network), with alerts (Choose stacks › System).
- **Kiwix:** Wikipedia and other reference libraries, readable offline from every device at home (Choose stacks › Documents).
- **Actual Budget:** an envelope budget, lighter than MoneyMatter, with the same budget on every device (Choose stacks › Finance).
- **Paperless-AI:** titles, tags, and correspondents for Paperless-ngx's documents from an AI model, Ollama on this machine or a service you choose (Choose stacks › Documents). Setup says how to get Ollama on each system once an app that uses it is installed.
- **Tdarr:** shrinks the media library by converting films and shows to a smaller format, kept to the night if you like (Choose stacks › Media Automation).
- **Firefly III:** a full household ledger, with budgets, bills, rules, and reports, and its importer for bank files (Choose stacks › Finance).
- **SteamOS:** Setup can install Docker in your home folder for you, and it survives SteamOS updates.
- **Settings › Appearance:** pick the theme, an accent colour, more contrast, the Islands layout, and the tray icon's colour.
- Every build of the app has its own version number (`v0.9.1-beta`, `v0.9.2-beta`, …) with its own release notes.
- Setup checks that this machine can open the apps' tailnet addresses.
- `homelab status --timing` shows how long each part of Status takes on this machine.
- If the app, its tray icon, or the background agent stops unexpectedly, Status says so the next time, with **Send the report**; the report carries what happened.
- `homelab domain resolver --undo` takes back this machine finding its apps by name (the resolver, and homelab's lines in the hosts file); `uninstall` says when they are left.
- `homelab doctor` reads KDE Plasma's sleep setting too (SteamOS's desktop), and warns when the apps would sleep with it.

### Improved

- Sending an Immich album to family without an account: its note walks through the link, how long it lasts, and turning it off, and Setup gives the address to paste so links open away from home.
- Status counts a service once when two apps replace it (MoneyMatter and Actual Budget both stand in for YNAB).
- Messages and the apps' notes use each system's own words ("tray icon", "this PC", "On this machine", its own hosts file) instead of the Mac's.
- On Windows, a new homelab takes the PC's time zone, and the install plan knows the PC's memory, as on the Mac and Linux.
- `homelab doctor` finds smartctl where its Windows installer puts it, and on SteamOS says why drive health cannot be read.
- Links, buttons, and the green, orange, and red states are easier to read on every system, in light and dark, and a screen reader hears whether each category on Status is open.
- Status shows your apps straight away; each app's "is it answering" check fills in a moment later, so one stuck app no longer holds up the page.
- Opening or folding a category on Status is instant.
- The window and the menu bar item share one look at Docker instead of each asking separately.
- Backups and Settings load their parts side by side.
- Install, Fix it, Update and the other jobs show a row per app saying what's happening ("Downloading · 54%", "Starting").
- A bar shows how far along the app's own update is, Setup's **Set up Docker for me** on SteamOS, and the tray's **Back up now** and **Update apps now** (which name the app at hand); in a terminal, `homelab up`, `install`, and `update` show a line per app instead of Docker's own output.
- The count of apps that need a look shows on the app's icon on Linux too (KDE, Ubuntu's dock), and as a dot on the tray icon on Windows and Linux.
- Changing the hosts file from the app on Windows and Linux asks for an administrator in a window, as on the Mac.
- The watchdog rebuilds an app whose container was removed, when it ran earlier in the week.
- A port another program holds is named in plain words, and on Windows port 53 says how to free it.
- Bundles install without their `@` (`homelab install adblock`), which PowerShell needs.

### Fixed

- On Windows, removing the scheduled jobs (`homelab schedule remove`, `uninstall`) stops the running agent too, as on the Mac and Linux, instead of leaving it running until you sign out.
- The watchdog brings back an app you installed whose container was removed, not only the always-on ones; `homelab remove` takes an app out without the watchdog bringing it back.
- `homelab uninstall --data` deletes the apps' data on Linux with Docker Engine too: files the apps wrote as root had stopped it.
- **Set up the alert token** works with ntfy itself: it had read the new tokens where ntfy does not write them, and stopped with "creating the reader's access token".
- Alerts on a Windows PC's screen come from *Homelab Wizard*, a name Windows knows, so they are shown; `homelab uninstall` removes the name again.
- After signing in on Windows, the homelab opens Docker Desktop itself if it has not started, as it already did with OrbStack on the Mac; on Linux it starts your own Docker service the same way.
- On Windows and Linux, keeping the computer awake now stops on battery, as it already did on the Mac, so a laptop unplugged sleeps as usual.
- The background jobs' own logs no longer grow forever: each stays under 5 MB, with the older half kept in `<job>.1.log`, and the diagnostics report reads both.
- On Linux with Docker Engine, the proxy and Tailscale couldn't reach apps that run on the machine itself (Jellyfin, the phone companion).
- `homelab doctor` warns when the machine's address changes and the apps would look for it at the old one.
- A failed `homelab db upgrade` could put the old files back under a running database.

## [0.9.0-beta] - 2026-10-24

**The beta.** Built for macOS, Windows, and Linux, and now being tested on real machines, starting with a Windows PC.

### New

- Move a homelab between a Mac, Windows, and Linux: Backups › **Move in…** adjusts the settings that differ between systems.

### Improved

- Signing in to Tailscale waits up to 30 minutes for you, instead of restarting with a new link after a minute.
- Tailscale's route home is this machine's own network, not a guessed `192.168.1.0/24`.
- **Test** in Settings saves the other settings its check needs (the domain with the Cloudflare token, the user with the password).

### Fixed

- **Install** on Choose stacks ran off the bottom of the window under a long plan.

## [0.8.0] - 2026-10-23

**Clearer messages, and Windows fixes.** What a new homelab says on its first day, checked line by line, and fixes for Windows.

### New

- A new logo: a blue shield with a house, readable at taskbar size.

### Improved

- Docker Hub's download limit is explained in plain words, with what to do.
- On a new homelab, `doctor` and `up` only mention what applies to you.
- Status says why the phone companion isn't running yet, without a warning colour.
- Dozzle (live logs) stays on this computer, since logs can hold secrets.
- Setup names settings the way Settings shows them.
- Alerts on the phone point at the right ntfy address in Home mode.
- **This week** on a new homelab lists what's still to set up, not things to worry about.
- Apps that run on the computer itself (Jellyfin) are described plainly on Choose stacks.
- Updating is one step: the homelab folder follows the app on its own.
- Home Assistant's note fits every system.

### Fixed

- **Fix it** said "done" even when one of its fixes failed.
- Setup's first step stayed unticked until the homelab folder existed.
- Status counted the phone companion before the scheduled jobs started it.
- On Windows: `homelab.cmd` needed Go, `install.ps1` didn't open the app, Navidrome wouldn't install, and AdGuard Home couldn't start where port 53 was taken.
- The weekly summary counted backups that didn't exist yet.

## [0.7.0] - 2026-10-23

**A first run anyone can do, in each system's own look.** A newcomer's first run, counted step by step, and the app drawn the way each system draws its own apps.

### New

- The app takes the accent colour you picked on Windows, the Mac, GNOME, and KDE.
- On KDE Plasma (SteamOS's desktop), the app is drawn in the Breeze style.
- The Mac's Dock icon shows how many apps need a look.
- The window opens where you left it.
- F5 checks the screen again on Windows and Linux.

### Improved

- Home mode skips the router step.
- Setup asks a laptop to stay plugged in and open.
- Backups and the outside check can wait a week without nagging.
- The install plan warns when the apps wouldn't fit in memory.
- Getting Started walks through the first open of the app without Terminal.
- More contrast when the system asks for it, and Windows' contrast themes keep everything readable.
- Settings spell every app the way the app does (Open WebUI, qBittorrent, AdGuard Home).

## [0.6.0] - 2026-10-23

**Security pass.** A review of the app's own code, and fixes for what it found.

### New

- Security scanners in CI: govulncheck, gosec, and npm audit.
- A threat review of the app's own code, with a 1.0 criterion for it.

### Improved

- GitHub Actions are pinned to exact commits.
- Watchtower and the Docker socket proxy stay on a version you choose.
- A phone's view of a log has secrets taken out.

### Fixed

- **Move in** could write outside the homelab folder through a link.
- A screen paired in kiosk mode could make changes.
- A phone paired over home Wi-Fi without encryption could make changes; it can only look now.
- The domain wasn't checked before reaching an administrator prompt.
- The app could open links other than web and email.
- An app update without GitHub's checksum wasn't refused.

## [0.5.0] - 2026-10-23

**Live Status, and apps that heal themselves.** Status follows Docker as things happen, and the homelab fixes or undoes what breaks.

### New

- Status updates live, following Docker's own events through the background agent.
- The watchdog restarts an app that hangs, and an update that leaves an app not answering is rolled back.
- **Explain this log**: the AI model on this machine reads an app's log and says what's wrong, in plain words. The log never leaves the machine.
- Kiosk mode: Status on a TV or a wall screen.
- Update shows what it brings before it starts: the newer releases' notes.
- Progress bars for longer jobs.

### Improved

- Status notices an app that runs but doesn't answer, and settings that aren't applied yet (**Fix it** applies them).
- The power card is live, with each busy app's last few minutes.
- Background work yields the CPU to the apps people are using.
- The app's screens are rebuilt in TypeScript and Preact, one screen at a time.

## [0.4.0] - 2026-10-22

**Windows and Linux.** The app, the installers, and self-update on every system, not just the Mac.

### New

- Windows and Linux builds of the app, published for every change.
- One-line installs: `install.sh` on Linux and the Mac, `install.ps1` on Windows.
- The app updates itself on Windows and Linux.
- External drives, backups, battery saver, and starting Docker work on Windows and Linux as on the Mac.
- Windows and Linux find the apps by name with a domain.
- Start Jellyfin from Status on Windows and Linux.
- **Update apps** in the menu bar and tray.

### Improved

- When an app fails to start, the app says why.
- When Docker refuses your account, the app says so instead of calling Docker stopped.
- `doctor` reads the sleep setting on Windows and Linux, and warns about SELinux labels that keep apps out of their folders.
- AdGuard Home runs beside systemd-resolved on Linux.
- Windows and Linux are no longer called "this Mac".
- Panels open as sheets.

### Fixed

- Self-update on Linux stopped itself halfway.
- Linux treated ports below 1024 as taken just because only root may use them.
- Setting up a homelab off the Mac, or with Go installed.

## [0.3.0] - 2026-10-21

**The Mac app grows up.** A menu bar item, one background agent, and an app that updates itself.

### New

- One-click update: the app replaces itself with the newest build, after checking GitHub's checksum.
- A stable channel that only moves on new versions.
- Home mode is the default for a new homelab.
- One background agent instead of six login items.
- Settings › **People**: add and remove household members.
- Open any app on a phone with a QR code.
- Move to a new machine from Backups.
- Status: each app's week, what each app keeps on disk, what's using power, and the weekly summary.
- Battery saver: the heavy apps pause on battery and start again on power.
- Text size: ⌘/Ctrl plus, minus, and 0.
- `install.sh`: install the Mac app from one Terminal line.

### Improved

- Status: healthy categories fold, one address per row, and starting a category's stopped apps is one click.
- Settings: a page per app, with the everyday settings first.
- VoiceOver: landmarks, live regions, and focus on each screen's heading.
- Setup says what each step gives you, and what runs in the background.
- Errors show as a macOS notification.
- Two Mac polish passes across every screen.

### Fixed

- CrowdSec restarted over and over at startup.
- The diagnostics report missed the logs of apps that kept restarting.

## [0.2.0] - 2026-10-15

**The Mac, tested.** Everything learned from running 0.1 on a real Mac, and the desktop app that came out of it.

### New

- The desktop app: Status, Choose stacks, Setup, Backups, and Settings, with a menu bar item.
- Home mode: no domain needed; Tailscale gives every app an https address.
- Single sign-on with Pocket ID, and `homelab person add` for each member of the household.
- The phone companion: Status and Backups on your phone.
- Updates you can undo: the image each app ran before its update is kept for a week.
- `homelab db upgrade`: a PostgreSQL major-version upgrade in one command.
- **Fix it**: starts what's stopped and reconnects what's disconnected.
- Backups: Duplicati jobs made for you, restore tests without its interface, and a monthly reminder to test.
- Ad blocking without a router change.
- Alerts on the screen, on the phone, and to an outside heartbeat.
- Your own apps: add any image with `homelab custom add`.
- Builds for Windows (including ARM) and Linux.
- New apps: Docmost, RomM, Ghostfolio, Baikal, PairDrop, PsiTransfer, Pocket ID, Vikunja, Tailscale, Home Assistant, Karakeep, Grocy, and more.

### Improved

- Apps grouped into nine categories, one Compose file each.
- Start here cards for Photos, Passwords, Movies and TV, Music, and Files.
- New apps get their addresses by themselves.
- A small baseline for new households.
- Every app's page under `services/` is a small wiki.
- Getting Started, Troubleshooting, and Upgrading guides.

### Fixed

- `.env` is saved atomically, with the previous version kept as `.env.bak`.
- SQLite apps (Vaultwarden, Uptime Kuma, and more) get consistent backups.
- Domain setup could drop HTTPS from every host if Nginx Proxy Manager was still starting.
- The home address could pick a VPN's tunnel instead of the home network.
- Vaultwarden sign-ups now always close on time.

## [0.1.0-alpha] - 2026-10-09

**First release, for a Mac.** The homelab on one Mac running OrbStack.

### New

- 17 apps started by `./homelab up`, and 17 more to add with `./homelab install`.
- The `homelab` command: install, plan, status, update, domain setup, backup, watchdog, restore test, and doctor.
- Nginx Proxy Manager with CrowdSec, protecting home and internet traffic alike.
- Scheduled jobs for startup, the nightly backup, and a watchdog every 15 minutes.
- A knowledge base in `docs/` and `services/`, and a page of the subscriptions it replaces.

[Unreleased]: https://github.com/Snooper42/homelab-wizard/compare/v0.9.0-beta...HEAD
[0.9.0-beta]: https://github.com/Snooper42/homelab-wizard/compare/v0.8.0...v0.9.0-beta
[0.8.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Snooper42/homelab-wizard/releases/tag/v0.2.0
[0.1.0-alpha]: https://github.com/Snooper42/homelab-wizard/blob/v0.2.0/CHANGELOG.md
