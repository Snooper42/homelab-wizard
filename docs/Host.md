---
version: 0.16.0
---

# Host

## Hardware and system

| Property | Value |
|---|---|
| Model | A Mac with Apple Silicon (a Mac mini, or a MacBook kept plugged in) |
| OS | macOS (current release) |
| LAN address | 192.168.1.10, reserved in the router |
| Power | Always on charger; the homelab's awake job keeps it from sleeping (`KEEP_AWAKE`) |
| Container runtime | OrbStack, Start at login on |
| Native apps | Jellyfin, Proton Drive, and the phone companion (`homelab serve`, a scheduled job) |
| Homelab folder | `~/Homelab` (a git checkout, or a folder the desktop app made) |
| Media | `/Volumes/Media` (external drive) |

## macOS settings

| Setting | Value | Why |
|---|---|---|
| The awake job | Installed with the other jobs (Setup › **Install the jobs**); it holds a `caffeinate` assertion while on power. | The Mac must never sleep |
| System Settings › Battery › Options | "Prevent automatic sleeping on power adapter when the display is off" on | Belt and braces with the awake job |
| System Settings › General › Login Items | OrbStack, Proton Drive, Jellyfin, Homelab Wizard (its menu bar item) | Everything comes back after a login |
| Automatic login | Not available with FileVault on; after a restart someone must log in | Accepted trade-off (see [Known Issues](<Known Issues.md>)) |
| AirPlay Receiver | Leave on or off; no homelab app uses ports 5000 or 7000 | Kavita is published on 5500 for this reason |
| Firewall | On, with OrbStack allowed incoming connections | The proxy and DNS must accept LAN traffic |
| Software updates | Install manually during a maintenance window | An unattended restart leaves everything stopped until login |

## OrbStack settings

| Setting | Value |
|---|---|
| Start at login | On |
| Memory limit | At least 8 GB (Immich's machine learning and Paperless's OCR are the heaviest) |
| Rosetta | On (MoneyMatter's images are Intel-only) |
| File access | Allow access to `/Volumes` and to the Proton Drive folder when macOS asks |

## Mac-specific behaviour

- **Paths:** every path a container uses must be under `/Users`, `/Volumes`, or `/private/tmp`; OrbStack shares these.
- **Media drive:** the startup job waits up to 15 minutes for `/Volumes/Media` before starting. If the drive is unplugged while apps run, unplug it only after `./homelab stop` on the media apps.
- **Privacy prompts:** the first time a container reads `/Volumes/Media` or the Proton Drive folder, macOS may ask OrbStack for permission. Allow it, or grant Full Disk Access to OrbStack.
- **Address changes:** the proxy and DNS listen on all addresses, so switching between Wi-Fi and Ethernet keeps them working. The router reservation must follow the interface in use.
- **Sleep:** if the Mac sleeps, the tunnel drops and the watchdog alerts on wake. `./homelab doctor` reads the Mac's sleep setting and warns when the apps would sleep with it (on Linux GNOME's, on Windows the power plan's).
- **Names with a domain:** `./homelab domain resolver` writes `/etc/resolver/<domain>`, so the Mac looks up its apps in AdGuard Home even with a VPN on ([Networking](<Networking.md>)).
- **Updates of the app:** **Update now** (the line at the top of the window) replaces the running Homelab Wizard with the newest build (the Latest release, numbered `v0.9.4-beta` and on, or the newest `vX.Y.0` release with `UPDATE_CHANNEL=stable`) after checking its SHA-256 checksum, and opens it again.

## Linux and Windows hosts

The same CLI runs on Linux and Windows; it picks the host profile from the operating system (`internal/host`).

| | macOS | Linux | Windows |
|---|---|---|---|
| Run the CLI with | `./homelab` | `./homelab` | `homelab.cmd` |
| Container runtime | OrbStack | Docker Engine with the compose plugin (2.20 or newer); your user in the `docker` group | Docker Desktop with the WSL 2 backend |
| Scheduled jobs | one launchd agent, `~/Library/LaunchAgents/com.homelab.agent.plist`, which also starts the menu bar item | one systemd user unit, `~/.config/systemd/user/homelab-agent.service` | `homelab-agent` in the user's Run key; scripts in `%LOCALAPPDATA%\Homelab\jobs`, started through `homelab-run.exe` so no window opens (without it, the sign-in jobs are `.cmd` scripts in the Startup folder) |
| Jobs without a login | not possible (ISSUE-0007) | `loginctl enable-linger $USER`; `homelab doctor` warns while it is off | not possible: Docker Desktop runs only while you are signed in |
| Jellyfin | native app via Homebrew | native package from jellyfin.org; on SteamOS, Jellyfin in a container (`homelab install jellyfin`) | Windows installer from jellyfin.org |
| Installing the app | `install.sh` (the DMG) | `install.sh` (the .deb, .rpm, Arch package, or the AppImage on SteamOS) | `install.ps1` (the installer) |
| App updates | replaces the .app | replaces the AppImage, or installs the package through pkexec | unpacks the portable zip with Windows' own PowerShell (asks for approval only in Program Files) |
| Battery saver | `pmset` | `/sys/class/power_supply` | `GetSystemPowerStatus` |
| Keeping it awake on power (the awake job) | `caffeinate -s` | `systemd-inhibit`, only while on power | a power request (`SetThreadExecutionState`), only while on power |
| The sleep setting `doctor` reads | `pmset -g custom` | GNOME's idle suspend on power (`gsettings`), or KDE Plasma's | the plan's *Sleep after* on power (`powercfg`) |
| External drives | `/Volumes/<name>` | `/media/<you>/<name>`, `/run/media/<you>/<name>`, `/mnt/<name>` (counted only while mounted) | any drive letter but the system's |
| Names with a domain | `/etc/resolver/<domain>` | a systemd-resolved drop-in | a Name Resolution Policy Table rule |
| Asking for the administrator from the app | the password window | pkexec's password window | the approval prompt |
| "Needs a look" on the app's icon | a count on the Dock icon | a count on the taskbar or dock icon (KDE Plasma, Ubuntu's dock, Dash to Dock) and an orange dot on the tray icon | an orange dot on the tray icon |

The compose files are unchanged. Mac-only checks (folders macOS protects, AirPlay ports) are skipped elsewhere. On Windows, keep the homelab folder out of OneDrive; a new `.env` takes the PC's time zone (Windows' name, turned into the one containers take by CLDR's table). Running the homelab inside a WSL 2 distribution instead uses the Linux profile and gives faster bind mounts. Status: ISSUE-0012 (Linux), ISSUE-0013 (Windows).

## SteamOS

SteamOS keeps its system folders read-only and replaces them with every update, so nothing is installed with its package manager. The homelab runs from the AppImage (`install.sh` puts it in `~/Applications`), in desktop mode.

| | How |
|---|---|
| Container runtime | Setup › **Set up Docker for me** (`homelab runtime install --apply`): Docker's own static build and the Compose plugin, checked against their checksums, in `~/.local/share/homelab-wizard/docker`, run as you (Docker's rootless mode) as a service of yours (`systemctl --user docker`). It asks for your password once, to give your account the ID ranges containers use (`/etc/subuid`, `/etc/subgid`) and the ports from 53 up (`/etc/sysctl.d/90-homelab-ports.conf`); the home folder and `/etc` are kept across SteamOS updates |
| Starting at boot | `loginctl enable-linger` (the same setup does it), so Docker and the agent run without a login |
| The apps' files | A container's root is you, so `.env` has `PUID=0` and `PGID=0`, and `DOCKER_SOCKET` is your own socket |
| This machine's own apps | The phone companion and Ollama are reached at this machine's address (`HOST_GATEWAY`), since Docker run as you cannot reach its loopback |
| Its look | KDE Plasma's Breeze, its accent, and the app's icon count in the taskbar |
| Game Mode | The app is a desktop-mode app; the homelab keeps running in Game Mode. The AppImage's menu entry has *Add to Steam* to open it from there |

Needs from the system (SteamOS has them): `newuidmap` and `newgidmap`, the `ip` command, `/dev/net/tun`, and systemd for the user; `homelab runtime install` says which is missing. Status: ISSUE-0012.

## The same on every system

The parity audit of October 2026 ([Roadmap](<Roadmap.md#012-the-same-on-every-system>), Goal 1): every feature on each system, read from the code (the `runtime.GOOS` switches and the `*_darwin`, `*_windows`, `*_linux`, and `*_other` files). Each cell is **works**, **works differently** (and how), **missing** (and what), or **can't** (and why). Linux means GNOME and KDE Plasma on a desktop distribution; SteamOS is Plasma in desktop mode, with Docker run as you.

*Proven by* says what shows it today. "Unit tests" run on all three systems' runners on every pull request (CI's `check` and `test` jobs) but against fakes of the system's tools; "click-through" is `make app-smoke`, which draws the app as each system on Ubuntu's Chromium. "The real-Docker run" is `test/realdocker` against a real Docker Engine on Ubuntu, every night and on each pull request that changes the catalog. No cell is proven on a real machine yet; those steps are in [Testing › Waiting for real hardware](<Testing.md#waiting-for-real-hardware>), and *on the machine* names them (M for the Mac, W for the Windows PC, S for the Steam Machine). A row without it is shown by CI on each system already (free space, the jobs' logs, the homelab files), or has nothing to show yet (signed builds).

### Setting up

| Feature | macOS | Windows | Linux | SteamOS | Proven by |
|---|---|---|---|---|---|
| Choose stacks, the install plan, `up` | works | works | works | works | unit and end-to-end tests (fake docker) on each runner; on Linux, `install` and `up` start every app of the real-Docker run; on the machine: M1, W1, W5, S1 |
| Setup's checklist and **Do the N I can do for you** | works | works | works | works | unit tests on each runner; click-through; on the machine: M1, W1, S1 |
| The container runtime set up for you | can't: OrbStack is an app with its own installer and licence; Setup links to it | can't: Docker Desktop needs WSL 2 and an administrator's install; Setup links to it | works where there is no Docker: Docker in the home folder, run as you (`runtime install`) | works: the same, always (the system is read-only) | unit tests; the route run once by hand on Linux (ISSUE-0012); on the machine: S1 |
| The runtime started when it is down (Setup › **Start**) | works: opens OrbStack | works: opens Docker Desktop | works: the user service, else the system's after the password (pkexec) | works: `systemctl --user start docker` | unit tests of the profile only; on the machine: M3, W3, S14 |
| Memory planning (what fits) | works: `sysctl hw.memsize` | works: `GlobalMemoryStatusEx` | works: `/proc/meminfo` | works: `/proc/meminfo` | each runner reads its own memory; on the machine: W5 |
| Time zone in a new `.env` | works: `/etc/localtime` | works differently: Windows' zone (`tzutil /g`) turned into its IANA name by CLDR's table | works: `/etc/localtime` | works: `/etc/localtime` | changed and read back for real on each runner (`systemsetup`, `tzutil`, `timedatectl`), and a new `.env` takes it; unit tests; on the machine: W6 |
| The machine's name and model in Settings › This Mac | works | works | works | works | read on each runner from the system's own source (a virtual machine's model there); unit tests on each runner; on the machine: M1, W1, S1 |
| Kopia's repository on a second drive (Setup's step, `kopia repository`) | works: `/Volumes/<name>` | works: a drive letter | works: `/media`, `/run/media` | works: `/run/media/deck/<name>` | unit tests on each runner; on Linux by hand in the sandbox, against the real image: a move to another folder, and an exFAT drive mounted as you; on the machine: M1, W20, S16 |
| Ollama for the AI apps (Setup's step, once Open WebUI or Paperless-AI is installed) | works: `brew install ollama`, as a Homebrew service | works: `winget install Ollama.Ollama`, started at sign-in | works differently: Ollama's install script, then `OLLAMA_HOST=0.0.0.0` so containers reach it | works differently: the standalone build in the home folder (the system is read-only), started with `OLLAMA_HOST=0.0.0.0 ollama serve` | unit tests of the step in each system's words; on the machine: M10, W10, S9 |

### Running

| Feature | macOS | Windows | Linux | SteamOS | Proven by |
|---|---|---|---|---|---|
| Status, live from the runtime | works | works | works | works | unit tests; click-through; on Linux, read from real containers in the real-Docker run, and the app's page drawn against them; on the machine: M1, W1, S1 |
| A native app (Jellyfin) started from Status | works: opens the app | works differently: starts the `JellyfinServer` service after approval, or its tray app | works differently: starts `jellyfin.service` after the password | works differently: Jellyfin in a container (`jellyfin-container`), which `install jellyfin` and the Movies and TV pick give on SteamOS (it takes no native install); started like any other app | `TestNativeAppOpensForReal` on the macOS runner (the Jellyfin cask installed, opened as Status's button opens it, and its server answering); on SteamOS, unit tests of the swap (`TestOnSteamOSJellyfinIsTheContainer`) and the container started in the nightly catalog job (Ubuntu); on the machine: M12, W12, S17; said on screen: Status's **Start** button says what Windows and Linux ask for (click-through as each) |
| Starting the apps after a restart (the agent's startup) | works: waits for OrbStack, asking it to open | works: waits for Docker Desktop, asking it to open | works: Docker's service starts at boot; a user service (Docker Desktop's, Docker run as you) is asked to start | works: Docker's user service, with lingering, asked to start | end-to-end test (fake docker) on each runner; on the machine: M3, W3, S8 |
| Native apps opened after a restart | works: the startup opens Jellyfin | works differently: its service starts at boot by itself | works differently: its service starts at boot by itself | works differently: the container starts with Docker, like the other apps | `TestNativeAppsOpenAfterARestartForReal` on the macOS runner (Jellyfin quit, then opened by the startup's step, and answering); on SteamOS, as the row above; on the machine: M4, W18, S17 |
| Waiting for an external drive before starting | works: `/Volumes/<name>` | works: a drive letter | works: `/media`, `/run/media`, `/mnt` | works: `/run/media/deck/<name>` | a real drive on each runner (a disk image on macOS, a VHD on Windows, a loop device on Linux) found, read, then taken away and seen missing; unit tests; on the machine: M4, S7 |
| The machine's history and its containers (Beszel's agent) | works differently: the agent sees OrbStack's Linux VM, not the Mac's own CPU, memory, and sensors | works differently: the agent sees Docker Desktop's WSL VM, not the PC's own | works: the machine itself, on its own network | works: the same, through Docker run as you | the real-Docker run (Linux): the hub reaches the agent and the system is up; on the machine: M18, W19; said on screen: Choose stacks, under Beszel, as a Mac and as Windows (click-through as each) |
| Free space per disk | works: `statfs` | works: `GetDiskFreeSpaceEx` | works: `statfs` | works: `statfs` | that drive's space read on each runner; unit tests on each runner |
| A drive's own health (SMART) | works: `smartctl` from Homebrew | works differently: `smartctl` found in Program Files too; reading a drive needs an administrator, which the hint says | works differently: reading a disk needs root, so as you it reads nothing | can't: SteamOS has no smartctl and its system takes no packages (the hint says so) | unit tests (parser); on the machine: M7, W8, S6 |
| A detector chip for Frigate (Coral, graphics) | can't: containers reach no USB device and no Apple graphics (Docker runs in a Linux VM), so it detects on the processor | works differently: an NVIDIA card through WSL 2 (the `-tensorrt` image); a USB Coral can't be passed through | works differently: by hand, as Frigate's note says: a USB Coral, Intel graphics (OpenVINO), AMD (`-rocm`), or NVIDIA (`-tensorrt`, with its container toolkit); the homelab adds none of them itself | works differently: its AMD graphics through `/dev/dri` with the `-rocm` image, by hand | none: the nightly run detects on the processor; on the machine: M11, W11, S10; said on screen: Choose stacks, under Frigate, as each system (click-through as each) |
| Battery saver (heavy apps paused on battery) | works: `pmset` | works: `GetSystemPowerStatus` | works: `/sys/class/power_supply` | works: the same | each runner's own source read (on mains power, no battery); unit tests of each reader; on the machine: M16, W16 |
| Keeping it awake on power (the awake job) | works: `caffeinate -s`, which holds only on power | works: a power request, withdrawn on battery (looked at every minute) | works differently: `systemd-inhibit`, stopped on battery and started again on power, once Setup's step (or `homelab awake allow`) has let this account block sleep: Linux refuses it to a job outside a login session | works differently: the same | held for real on each runner and seen in the system's own list (`pmset -g assertions`, `powercfg /requests`, `systemd-inhibit --list`), then gone when the job stops; on Ubuntu, polkit seen refusing it and then allowing it after `homelab awake allow`; unit tests of the power switching on each runner; on the machine: M2, W2, S13; said on screen: Setup's step *This machine stays awake while plugged in* (Linux and SteamOS) |
| The sleep setting `doctor` warns about | works: `pmset -g custom` | works: the plan's *Sleep after* (`powercfg`) | works: GNOME's (`gsettings`), and KDE Plasma's (`powerdevilrc`, or Plasma 5's `powermanagementprofilesrc`) | works: Plasma's | changed and read back on each runner: `pmset` and `powercfg` for real, GNOME's keys through `gsettings` and Plasma's `powerdevilrc` in a test's own settings; unit tests of the parsers; on the machine: S4 |

### The background jobs

| Feature | macOS | Windows | Linux | SteamOS | Proven by |
|---|---|---|---|---|---|
| The agent (startup, watchdog, nightly backup, awake, phone companion) installed and read back | works: one launchd agent | works: the Run key and `homelab-run.exe`, no window | works: one systemd user unit | works: the same | installed, read back, run, and removed for real on each runner, nothing left (`TestJobsInstalledForReal`); on Linux, the watchdog brings back a hung app and a removed one in the real-Docker run; unit tests of each file's content; on the machine: M1, W1, S1 |
| The jobs without a sign-in | can't: FileVault needs someone to log in, and OrbStack runs in the session (ISSUE-0007) | can't: Docker Desktop runs only while you are signed in | works: `loginctl enable-linger` (`doctor` warns while off) | works: the runtime setup turns lingering on | unit tests; on the machine: S1 |
| The jobs' logs trimmed | works | works | works | works | unit tests on each runner |

### Alerts and the tray

| Feature | macOS | Windows | Linux | SteamOS | Proven by |
|---|---|---|---|---|---|
| ntfy alerts and the outside heartbeat | works | works | works | works | unit tests (httptest); on Linux, a test alert and the watchdog's alert arrive in a real ntfy in the real-Docker run; on the machine: M5, W4, S3 |
| A notification on this machine's screen | works: Notification Center (`osascript`) | works: a toast through PowerShell, under *Homelab Wizard*, a name registered for your account first (Windows drops toasts from a name it does not know) | works: `notify-send` (needs libnotify's tool) | works: `notify-send` | the watchdog's call on Windows seen in Windows' own toast history, on macOS in Notification Center's own record (usernoted's database), and on Ubuntu arriving at a notification server on D-Bus (a test's); none on a real desktop; on the machine: M5, W4, S3 |
| The tray item (menu bar item on a Mac) | works: a helper inside the bundle | works: `--tray` | works differently: needs a status-notifier tray; KDE has one, GNOME only with the AppIndicator extension (Ubuntu's is on, Fedora's is not) | works: Plasma's tray | on Ubuntu, started for real: it registers with a status notifier watcher on D-Bus (a test's), and its menu is read and clicked there; on the macOS runner, started for real: its menu bar item clicked, its menu read through System Events, and Quit clicked; on the Windows runner, started for real, its icon found in Windows' record of the notification area (`NotifyIconSettings`), its menu opened as a right click opens it, read, and Quit chosen; unit tests of its menu; on the machine: M15, W15, S2; said on screen: Settings › This Mac (This machine), under Tray icon, on GNOME (click-through) |
| The tray started at login | works: a LaunchAgent | works: the Run key | works: `~/.config/autostart` | works: the same, pointing at the AppImage | turned on, run as at login, and turned off for real on each runner: launchd loads its LaunchAgent on macOS, the Run value's command runs on Windows, `gio launch` starts its autostart entry on Linux; a real login is M15, W15, and S2; unit tests (Linux); on the machine: M15, W15, S2 |
| "Needs a look" on the app's icon | works: a count on the Dock icon | works differently: an orange dot on the tray icon (the taskbar has no count for this kind of app) | works differently: a count on the taskbar on KDE and Ubuntu's dock (Unity launcher API); the tray dot elsewhere | works: Plasma's taskbar count | on Ubuntu, the count sent for real over D-Bus (the Unity launcher API) and heard on a session bus of the test's own; unit tests (Linux); on the macOS runner, the Dock count set through the app's call and read back from the Dock's own record (`lsappinfo`), then cleared; the tray dot cannot be read back on a runner (no Windows API for another program's icon), W13; on the machine: M13, W13, S11; said on screen: Settings › This PC or This machine, under Tray icon, on Windows and GNOME (click-through as each) |

### Updating

| Feature | macOS | Windows | Linux | SteamOS | Proven by |
|---|---|---|---|---|---|
| The homelab files (**Update now**, `upgrade`) | works | works | works | works | unit and end-to-end tests on each runner |
| The app replaces itself (checksum checked) | works: replaces the .app | works: the portable zip unpacked by PowerShell, after approval only in Program Files (the installer, silently, only for a release without the zip) | works differently: the .deb, .rpm, or Arch package through pkexec; a tarball install cannot replace itself (run `install.sh` again) | works: replaces the AppImage | a good download, a bad checksum, a cut-off download, and a full disk on each runner; the helpers run for real: the Mac's and the AppImage's on Ubuntu and macOS, the portable zip's in PowerShell on Windows, and the disk image opened with `hdiutil` on macOS; the AppImage swap run once by hand (ISSUE-0021); on the machine: M8, W1, W21, W22, S1; said on screen: the update line at the top of the window says to download the newest build when a copy cannot replace itself, and why a build did not go in place (`update.log`) |
| Installing the app | works: `install.sh` (the DMG) | works: `install.ps1` (the installer) | works: `install.sh` (the package for the distribution) | works: `install.sh` (the AppImage in `~/Applications`) | `install.sh` run on Ubuntu 24.04 once; the release run starts the AppImage; on the machine: M1, W1, S1 |
| Signed builds | works differently: signed ad hoc, so the first open asks (System Settings › Privacy & Security › **Open Anyway**) until 1.0's Developer ID | works differently: unsigned, so SmartScreen asks (**More info › Run anyway**) until 1.0's certificate | works differently: packages are checksummed, not signed | works differently: the same | the release run |

### Names, addresses, and the administrator

| Feature | macOS | Windows | Linux | SteamOS | Proven by |
|---|---|---|---|---|---|
| This machine finds its apps by name (with a domain) | works: `/etc/resolver/<domain>` | works: a Name Resolution Policy Table rule | works differently: a systemd-resolved drop-in, then a restart of resolved; on a system without resolved it says to set the DNS server instead | works differently: the same, if SteamOS runs resolved (to check on the Steam Machine) | set and taken back for real on each runner, read in the system's own DNS (`scutil --dns`, the NRPT policy, `resolvectl status`); the script that sudo or pkexec runs, run on Ubuntu and macOS; on the machine: M6, W7, S5 |
| Undoing it (`domain resolver --undo`) | works: the resolver file removed (only one homelab wrote), the cache flushed | works: the rule with homelab's comment removed, after approval | works: the drop-in removed, resolved restarted | works: the same | each runner removes what it set and the system's DNS no longer has it; `uninstall` says when something is left; on the machine: M6, W7 |
| The hosts file (`domain setup --dns hosts`; `domain resolver --undo` takes homelab's lines out) | works: `/etc/hosts`, then the DNS cache flushed | works: `drivers\etc\hosts`, the cache cleared | works: `/etc/hosts` | works: `/etc/hosts` (kept across updates) | written, looked up, and taken back for real on each runner, the file then as it was; on the machine: M17, W17, S15 |
| Asking for the administrator from the app | works: the password window | works: the approval prompt | works: pkexec's window (needs a polkit agent: GNOME and KDE have one) | works: Plasma's polkit agent | the password window's script run on Ubuntu and macOS (without the window); the elevated copy run on the Windows runner, which approves by itself; none on a real desktop; on the machine: M6, W7, S13 |
| The tailnet addresses (Home mode) | works | works | works | works | unit tests; on the machine: M1, W1, S1 |

### The app's look

| Feature | macOS | Windows | Linux | SteamOS | Proven by |
|---|---|---|---|---|---|
| Its look | works: the translucent sidebar, the app menu | works: Mica on Windows 11 (22621 and later), Segoe UI Variable | works: Adwaita on GNOME, Breeze on KDE | works: Breeze | click-through as Mac, Windows, GNOME, KDE, and SteamOS, light and dark, with axe; on the machine: M14, W14, S12 |
| The system's accent colour | works | works | works differently: KDE's, and GNOME's from GNOME 47 (older GNOME has none) | works: KDE's | set and read back for real on macOS (`defaults`) and Windows (the registry), and on Ubuntu through `gsettings` and a `kdeglobals` of the test's own; unit tests of the readers; on the machine: M1, W1, S1; said on screen: Settings › Appearance, under Accent, when the desktop gives none (click-through) |
| The app menu | works: the menu bar's menus | can't: Windows apps of this kind have none; the sidebar and shortcuts do its work | can't: the same | can't: the same | click-through; on the machine: M14 |
| Keyboard shortcuts, text size, screen reader landmarks | works: ⌘ | works: Ctrl, F1, F5 | works: Ctrl, F1, F5 | works: the same | click-through |
| Words in the app and the CLI | works | works: the system's own words ("tray icon", "this PC", its own hosts file) | works: the same | works: the same | a test over every Go string (`TestNoMacOnlyWordsElsewhere`) and every frontend string (`app/preview/words.mjs`): Mac words only in Mac code, or in text naming each system; the click-through reads each screen as each other system for them |
| The generated notes' tables | works | works: the address column is headed "On this machine" | works | works | `homelab validate` |

### What the audit turned into

A *works differently* cell that a person would notice says so on the screen where it shows: its row's *Proven by* names that screen (*said on screen*), and the click-through draws it as that system. The rest are not seen on a screen: the time zone, Ollama's step (already in each system's words), the native app after a restart, Jellyfin as a container on SteamOS (it is listed as *Jellyfin in a container*), a drive's health (`homelab doctor` says what it needs), and the signed builds, whose question comes before the app opens, so [Getting Started](<Getting Started.md>) says how to answer it.

Each *missing* cell is an item of [0.12](<Roadmap.md#012-the-same-on-every-system>); the ones with a fix that a runner can prove come first (done: keeping awake only on power on Windows and Linux, Plasma's sleep setting, the memory and the time zone on Windows, smartctl found on Windows and the SteamOS hint): the startup asking Docker Desktop to open, a toast Windows shows, undoing the names (`domain resolver --undo`), and the wording. Jellyfin on SteamOS is now a container (`jellyfin-container`, which `install jellyfin` gives there). The jobs without a sign-in on macOS and Windows stay as they are until a route exists.

## Taking it off this machine

`./homelab move out` packs the homelab into one file for a new machine, and `./homelab move in <file>` unpacks it there ([Commands](<Commands.md>)). `./homelab uninstall` removes the containers, images, jobs, the menu bar item at login, and the `homelab` network; the folder, `.env`, the data, and the backups stay (`--data` also deletes the apps' data, never the backups or the media drive).

## Health checks

```bash
./homelab doctor      # macOS, OrbStack, Compose, .env, media drive, backup destination, jobs
pmset -g assertions   # caffeinate (the awake job) should hold PreventUserIdleSystemSleep
```
