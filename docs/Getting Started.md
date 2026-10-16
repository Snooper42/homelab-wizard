---
version: 0.1.0-alpha
---

# Getting Started

From an empty Mac to a homelab the whole household uses, without reading any code. Set aside an afternoon; most of it is waiting for downloads.

> [!TIP]
> The desktop app's **Setup** screen walks through the same steps with a live check for each one, and does the technical ones for you. This page explains what each step is for and what to have ready.

## What you need

| | Why | Cost |
|---|---|---|
| A Mac with Apple Silicon that stays on | Every app runs on it. A Mac mini or a MacBook kept plugged in both work. | Already owned |
| A domain on Cloudflare | Gives every app an address such as `photos.example.com` with a padlock, and lets some apps work away from home. | About $11 a year |
| A cloud folder for backups | Encrypted copies of everything leave the house every night. Proton Drive is what this homelab uses. | An existing plan |
| An external drive (optional) | Movies, music, books, and photos that do not fit on the Mac. | Already owned |
| The router's admin page or app | To give the Mac an address that never changes. | |

## 1. Install the basics

1. Install OrbStack, the engine the apps run in. Homelab Wizard's Setup screen offers **Download OrbStack** if you would rather skip Terminal; with [Homebrew](https://brew.sh):

   ```sh
   brew install --cask orbstack
   ```

   Open OrbStack once and turn on **Start at login** in its settings. Also `brew install smartmontools`: it lets the homelab read each drive's health and warn before one fails.

2. Install **Homelab Wizard**: download the latest build from GitHub › Actions › Release › Artifacts › **macos**, drag it from the DMG to Applications, and clear the download flag once (the build is not signed yet):

   ```sh
   xattr -dr com.apple.quarantine "/Applications/Homelab Wizard.app"
   ```

3. Open Homelab Wizard. On a new Mac it offers **Set it up for me**: it makes `~/Homelab` from the homelab files it carries, with no git or Terminal needed. Updates then arrive with each new build of the app (Setup › **Update**), keeping your settings, data, and own apps, and saving a copy of any file you changed as `.local`.

   To work on the homelab itself instead, clone it (the first time, macOS offers to install its command line tools; accept), and `brew install go` for the `./homelab` commands:

   ```sh
   git clone git@github.com:Snooper42/homelab-wizard.git ~/Homelab
   ```

Either way, Homelab Wizard finds `~/Homelab` on its own and opens on **Setup**.

> **On Windows, Linux, or a Steam Machine** the steps are the same with that platform's pieces ([Host](<Host.md#linux-and-windows-hosts>) has the details):
>
> | | Windows 10 or 11 | Ubuntu, Debian, Fedora, Arch | Steam Machine (SteamOS, desktop mode) |
> |---|---|---|---|
> | The engine | Docker Desktop with WSL 2 (`winget install Docker.DockerDesktop`), started at sign-in | Docker Engine and its compose plugin; your user in the `docker` group | Docker Engine (SteamOS keeps its system read-only, so this part is still being tried: ISSUE-0012) |
> | The files | **Set it up for me** in the app, or `git clone` into your user folder, outside OneDrive | **Set it up for me**, or `git clone` into `~/Homelab` | **Set it up for me**, or `git clone` into `~/Homelab` |
> | The app | Artifacts › **windows** › the installer | Artifacts › **linux** › the `.deb`, `.rpm`, or Arch package | Artifacts › **linux** › the AppImage: `chmod +x`, open it, then Setup › **Add to the app menu** (right-click it there › Add to Steam to open it in Game Mode) |
> | Terminal commands | `homelab.cmd` instead of `./homelab` | `./homelab` | `./homelab` |
>
> Each app build carries the `homelab` CLI and the homelab files, so Setup's buttons work without Go or git. Setup's machine card can start the tray icon at login, and the AppImage can add itself to the app menu; both follow it if you move it or swap in a newer one.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/app-setup-dark.png">
  <img alt="The Setup screen: this machine, then the first-time checklist with its progress" src="images/app-setup.png">
</picture>

## 2. Work down the Setup screen

Each step turns into a green tick when its check passes. **Check again** re-runs every check.

| Step | What you do | What it gives you |
|---|---|---|
| **OrbStack is running** | Nothing, once OrbStack is open. | The engine for every app. |
| **The homelab is started** | Click **Start the homelab**. The first start downloads every app and takes a while. | The everyday apps running, and a settings file with a strong, unique password for each one. |
| **This machine keeps its address** | In the router's app, reserve the Mac's current address (the step shows it), then tick **Done**. | Phones can always find the Mac. |
| **Home DNS answers** | Open AdGuard Home from the step, finish its short wizard, then put the login you made in **Settings**. | The home network learns the apps' names, and ads are blocked for every device that uses it. |
| **Cloudflare API token** | Create a token with the three permissions the step lists, and paste it in **Settings**. Never paste it anywhere else. | Lets the homelab get the padlock certificate and publish addresses. |
| **Addresses and certificate** | Click **Set up the domain**. The first certificate takes a few minutes. | `https://` addresses for every app, on the Mac and on phones at home. |
| **Password manager account** | Click **Open sign-ups for 10 minutes**, create an account for each person at the passwords address, and let the window close. | Vaultwarden, used through the Bitwarden apps, for everyone's passwords. |
| **Two-step sign-in** | In each Vaultwarden account turn on two-step login with an authenticator app (keep the recovery code with the recovery kit). In Nginx Proxy Manager add a personal administrator and turn on Two-Factor Auth for it, then tick **Done**. | A stolen password alone opens neither the vault nor the proxy. The homelab's own proxy account (`NPM_API_EMAIL`) keeps it off, because the homelab signs in with it. |
| **Access away from home** | Create a tunnel in Cloudflare Zero Trust, paste its token in **Settings**, and click **Start the tunnel**. | Photos, passwords, documents, and music work on mobile data, with no ports opened on the router. |
| **Backups leave this machine** | Click the button for where they should go: **Use Proton Drive**, **Use iCloud Drive** (or Google Drive, OneDrive, Dropbox, whichever syncs on this Mac), or **Use the … drive** for an external drive. Each makes a *Homelab Backups* folder there. Any other folder: **Settings** › `BACKUP_DESTINATION` › **Choose…**. | Somewhere safe for the nightly encrypted backups: a cloud drive survives fire and theft, an external drive restores faster. |
| **Backup jobs in Duplicati** | Click **Create the backup jobs**. Then, in **Settings**, **Copy** `DUPLICATI_SECRETS_PASSPHRASE` into Vaultwarden and write it on paper: it is the one key to every backup. | Settings, databases, and photos encrypted into the backup folder every night. |
| **Alerts on the phone** | Click **Set up the alert token**. In the ntfy app on your phone, add the ntfy address with user `phone` and the password from **Settings** › `NTFY_PHONE_PASSWORD` › **Copy**, then subscribe to the alert topics. | A message on the phone when an app, the tunnel, or a backup fails. |
| **Scheduled jobs** | Click **Install the jobs**. | The homelab starts after a restart, backs up at night, and checks itself every 15 minutes. |
| **Alerts when this machine is down** | Create a free check at healthchecks.io (15-minute period and grace) and put its ping address in **Settings**. | An email when the Mac itself stops, which the homelab cannot report on its own. |
| **Phones and computers use the home DNS** | On each device, set the Wi-Fi DNS server to the Mac's address, then tick **Done**. | The app names work on every device at home. |

If a step does not turn green, click **Make a diagnostics report** at the top of Setup. It writes one file with every check and log, with all passwords and tokens removed, that you can share when asking for help.

## 3. Choose more apps

Open **Choose stacks**. **Start here** has the five things most homes want first: Photos, Passwords, Movies and TV, Music, and Files. Click the ones you want. Every other app is under **Add more**, where each app says what it does and which subscription it can replace. Tick what you want, or pick a preset such as *Household* (smart home, groceries, to-dos, saved links, and a start page) or *Media automation*, and the plan on the right shows exactly what will start before you click **Install**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/app-choose-dark.png">
  <img alt="Choose stacks: apps by category, presets, and the install plan" src="images/app-choose.png">
</picture>

## 4. Set up each person's phone

| Install | To | Sign in at |
|---|---|---|
| Bitwarden | Use the shared password manager | the passwords address, with the account from step 2 |
| Immich | Back up photos and browse them by face, place, or thing | the photos address |
| ntfy | Get the homelab's alerts (the person who looks after it) | the ntfy address, as user `phone` |
| Jellyfin or Infuse | Watch the movies and shows you own | the Jellyfin address |
| Any Subsonic music app, or Feishin in a browser | Listen to your music | the music address |

Everything else opens in a web browser. Install **Homepage** from Choose stacks for one start page with every app on it, kept up to date by the homelab; the [Inventory](<Inventory.md>) lists every address too.

With a domain and **Pocket ID** installed, each person can have their own sign-in: `./homelab person add "Anna Smith" --email anna@example.com` makes their account and a welcome page to send them, with a one-time link to set up a passkey (Face ID or Touch ID), the apps they use, and their own tab on the start page. `./homelab sso setup` then lets Karakeep, Paperless-ngx, Mealie, Vikunja, and Open WebUI sign in with it.

For the person who looks after the homelab: Settings › **Phones** › **Pair a phone** shows a QR code. Scanned on the phone, it opens Status and Backups in the phone's browser (Share › Add to Home Screen keeps it as an app), at home or over Tailscale.

## 5. Day to day

- **Status** shows every app with a coloured dot. Restart, update, stop, or read the log of any app from its row; the menu bar icon shows the same at a glance.
- **Updates** install themselves at night. Pause them from Status or the menu bar before something important. If an update breaks an app, the rewind button on its row puts the previous version back (kept for a week), and an app that stays unwell after an update is put back by itself.
- **Backups** run at night. The **Backups** screen shows each app's newest copy and when a restore was last proven; once a month, restore a few files to prove they work ([Backups](<Backups.md>)), and the homelab reminds you.
- **When something breaks**, an alert arrives on the phone. Open Status, read the app's log, and restart it. If that does not help, make a diagnostics report.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/app-logs-dark.png">
  <img alt="Status with an app's log open, and the restart, update, stop, and log buttons on each row" src="images/app-logs.png">
</picture>

## Where to go next

- [Troubleshooting](<Troubleshooting.md>): symptoms and their usual fixes.
- [Testing](<Testing.md>): the checklist for trying a new build.
- [Runbooks](<Runbooks.md>): step-by-step procedures, such as making an app public or updating the proxy.
- [Disaster Recovery](<Disaster Recovery.md>): moving to a new machine, rebuilding from the backups, and the printable recovery kit.
- [Disaster Recovery](<Disaster Recovery.md>): rebuilding on another Mac from the backups.
- [Savings](<Savings.md>): what each app can replace, and what that is worth.
