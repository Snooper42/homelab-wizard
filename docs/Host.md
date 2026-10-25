---
version: 0.9.0-beta
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
| System Settings > Battery > Options | "Prevent automatic sleeping on power adapter when the display is off" on | Belt and braces with the awake job |
| System Settings > General > Login Items | OrbStack, Proton Drive, Jellyfin, Homelab Wizard (its menu bar item) | Everything comes back after a login |
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
- **Updates of the app:** Setup › **Update** replaces the running Homelab Wizard with the newest build (the Latest release, numbered `v0.9.4-beta` and on, or the newest `vX.Y.0` release with `UPDATE_CHANNEL=stable`) after checking its SHA-256 checksum, and opens it again.

## Linux and Windows hosts

The same CLI runs on Linux; it picks the host profile from the operating system (`internal/host`).

| | macOS | Linux | Windows |
|---|---|---|---|
| Run the CLI with | `./homelab` | `./homelab` | `homelab.cmd` |
| Container runtime | OrbStack | Docker Engine with the compose plugin (2.20 or newer); your user in the `docker` group | Docker Desktop with the WSL 2 backend |
| Scheduled jobs | one launchd agent, `~/Library/LaunchAgents/com.homelab.agent.plist`, which also starts the menu bar item | one systemd user unit, `~/.config/systemd/user/homelab-agent.service` | `homelab-agent` in the user's Run key; scripts in `%LOCALAPPDATA%\Homelab\jobs`, started through `homelab-run.exe` so no window opens (without it, the sign-in jobs are `.cmd` scripts in the Startup folder) |
| Jobs without a login | not possible (ISSUE-0007) | `loginctl enable-linger $USER`; `homelab doctor` warns while it is off | not possible: Docker Desktop runs only while you are signed in |
| Jellyfin | native app via Homebrew | native package from jellyfin.org | Windows installer from jellyfin.org |
| Installing the app | `install.sh` (the DMG) | `install.sh` (the .deb, .rpm, Arch package, or the AppImage on SteamOS) | `install.ps1` (the installer) |
| App updates | replaces the .app | replaces the AppImage, or installs the package through pkexec | runs the installer silently (asks for approval), or unpacks the portable zip |
| Battery saver | `pmset` | `/sys/class/power_supply` | `GetSystemPowerStatus` |
| Keeping it awake (the awake job) | `caffeinate -s` | `systemd-inhibit` | a power request (`SetThreadExecutionState`) |
| The sleep setting `doctor` reads | `pmset -g custom` | GNOME's idle suspend on power (`gsettings`); none on other desktops | the plan's *Sleep after* on power (`powercfg`) |
| External drives | `/Volumes/<name>` | `/media/<you>/<name>`, `/run/media/<you>/<name>`, `/mnt/<name>` (counted only while mounted) | any drive letter but the system's |
| Names with a domain | `/etc/resolver/<domain>` | a systemd-resolved drop-in | a Name Resolution Policy Table rule |
| Asking for the administrator from the app | the password window | pkexec's password window | the approval prompt |
| "Needs a look" on the app's icon | a count on the Dock icon | a count on the taskbar or dock icon (KDE Plasma, Ubuntu's dock, Dash to Dock) and an orange dot on the tray icon | an orange dot on the tray icon |

The compose files are unchanged. Mac-only checks (folders macOS protects, AirPlay ports) are skipped elsewhere. On Windows, keep the homelab folder out of OneDrive, and set `TZ` in `.env` yourself (it is not detected). Running the homelab inside a WSL 2 distribution instead uses the Linux profile and gives faster bind mounts. Status: ISSUE-0012 (Linux), ISSUE-0013 (Windows).

## SteamOS

SteamOS keeps its system folders read-only and replaces them with every update, so nothing is installed with its package manager. The homelab runs from the AppImage (`install.sh` puts it in `~/Applications`), in desktop mode.

| | How |
|---|---|
| Container runtime | Setup › **Set up Docker for me** (`homelab runtime install --apply`): Docker's own static build and the Compose plugin, checked against their checksums, in `~/.local/share/homelab-wizard/docker`, run as you (Docker's rootless mode) as a service of yours (`systemctl --user docker`). It asks for your password once, to give your account the ID ranges containers use (`/etc/subuid`, `/etc/subgid`) and the ports from 53 up (`/etc/sysctl.d/90-homelab-ports.conf`); the home folder and `/etc` are kept across SteamOS updates |
| Starting at boot | `loginctl enable-linger` (the same setup does it), so Docker and the agent run without a login |
| The apps' files | A container's root is you, so `.env` has `PUID=0` and `PGID=0`, and `DOCKER_SOCKET` is your own socket |
| Its look | KDE Plasma's Breeze, its accent, and the app's icon count in the taskbar |
| Game Mode | The app is a desktop-mode app; the homelab keeps running in Game Mode. The AppImage's menu entry has *Add to Steam* to open it from there |

Needs from the system (SteamOS has them): `newuidmap` and `newgidmap`, the `ip` command, `/dev/net/tun`, and systemd for the user; `homelab runtime install` says which is missing. Status: ISSUE-0012.

## Taking it off this machine

`./homelab move out` packs the homelab into one file for a new machine, and `./homelab move in <file>` unpacks it there ([Commands](<Commands.md>)). `./homelab uninstall` removes the containers, images, jobs, the menu bar item at login, and the `homelab` network; the folder, `.env`, the data, and the backups stay (`--data` also deletes the apps' data, never the backups or the media drive).

## Health checks

```bash
./homelab doctor      # macOS, OrbStack, Compose, .env, media drive, backup destination, jobs
pmset -g assertions   # caffeinate (the awake job) should hold PreventUserIdleSystemSleep
```
