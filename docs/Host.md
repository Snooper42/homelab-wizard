---
version: 0.1.0-alpha
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
| Repository | `~/Homelab` |
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
- **Sleep:** if the Mac sleeps, the tunnel drops and the watchdog alerts on wake.

## Linux and Windows hosts

The same CLI runs on Linux; it picks the host profile from the operating system (`internal/host`).

| | macOS | Linux | Windows |
|---|---|---|---|
| Run the CLI with | `./homelab` | `./homelab` | `homelab.cmd` |
| Container runtime | OrbStack | Docker Engine with the compose plugin (2.20 or newer); your user in the `docker` group | Docker Desktop with the WSL 2 backend |
| Scheduled jobs | launchd agents in `~/Library/LaunchAgents` | systemd user units in `~/.config/systemd/user` (`homelab-startup.service`, `homelab-backup.timer`, `homelab-watchdog.timer`) | Task Scheduler tasks `Homelab\backup` and `Homelab\watchdog`, plus `homelab-startup` in the user's Run key; scripts in `%LOCALAPPDATA%\Homelab\jobs`, started through `homelab-run.exe` so no window opens (without it, the sign-in job is `homelab-startup.cmd` in the Startup folder) |
| Jobs without a login | not possible (ISSUE-0007) | `loginctl enable-linger $USER`; `homelab doctor` warns while it is off | not possible: Docker Desktop runs only while you are signed in |
| Jellyfin | native app via Homebrew | native package from jellyfin.org | Windows installer from jellyfin.org |

The compose files are unchanged. Mac-only checks (folders macOS protects, AirPlay ports) are skipped elsewhere. On Windows, keep the homelab folder out of OneDrive, and set `TZ` in `.env` yourself (it is not detected). Running the homelab inside a WSL 2 distribution instead uses the Linux profile and gives faster bind mounts. Status: ISSUE-0012 (Linux), ISSUE-0013 (Windows).

## Health checks

```bash
./homelab doctor      # macOS, OrbStack, Compose, .env, media drive, backup destination, jobs
pmset -g assertions   # caffeinate (the awake job) should hold PreventUserIdleSystemSleep
```
