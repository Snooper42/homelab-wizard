<p align="center">
  <img src="assets/logo.svg" alt="Homelab Wizard" width="120" height="120">
</p>

<h1 align="center">Homelab Wizard</h1>

<p align="center">
  <strong>The household's photos, documents, passwords, money, music, and books, on a Mac you own.</strong><br>
  OrbStack, Compose, and one small CLI that installs, proxies, publishes, backs up, and documents every app.
</p>

<p align="center">
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Apple%20Silicon-000000?style=for-the-badge&logo=apple&logoColor=white">
  <img alt="OrbStack" src="https://img.shields.io/badge/OrbStack-runtime-6F42C1?style=for-the-badge">
  <img alt="Go" src="https://img.shields.io/badge/Go-1.23%2B-00ADD8?style=for-the-badge&logo=go&logoColor=white">
  <img alt="Cloudflare Tunnel" src="https://img.shields.io/badge/Cloudflare-Tunnel-F38020?style=for-the-badge&logo=cloudflare&logoColor=white">
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.0--alpha-orange?style=flat-square">
  <img alt="Baseline" src="https://img.shields.io/badge/baseline-17%20apps-2ea44f?style=flat-square">
  <img alt="Optional" src="https://img.shields.io/badge/slot--in-39%20apps-2ea44f?style=flat-square">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
</p>

<p align="center">
  <a href="docs/Releasing.md#each-platforms-build"><img alt="Desktop app for macOS" src="https://img.shields.io/badge/app-macOS-000000?style=flat-square&logo=apple&logoColor=white"></a>
  <a href="docs/Releasing.md#each-platforms-build"><img alt="Desktop app for Windows: x64 and ARM64" src="https://img.shields.io/badge/app-Windows%20(x64%20%C2%B7%20ARM64)-0078D4?style=flat-square&logo=windows&logoColor=white"></a>
  <a href="docs/Releasing.md#each-platforms-build"><img alt="Desktop app for Linux: deb, rpm, Arch" src="https://img.shields.io/badge/app-Linux%20(deb%20%C2%B7%20rpm%20%C2%B7%20Arch)-FCC624?style=flat-square&logo=linux&logoColor=black"></a>
  <a href="docs/Releasing.md#each-platforms-build"><img alt="Desktop app for SteamOS: AppImage" src="https://img.shields.io/badge/app-SteamOS%20(AppImage)-1A9FFF?style=flat-square&logo=steam&logoColor=white"></a>
</p>

<p align="center">
  <a href="#in-plain-words">In plain words</a> ·
  <a href="#the-desktop-app">Desktop app</a> ·
  <a href="docs/Getting%20Started.md">Getting started</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-runs">What runs</a> ·
  <a href="#what-it-saves">What it saves</a> ·
  <a href="#how-it-fits-together">How it fits together</a> ·
  <a href="#adding-a-service">Adding a service</a> ·
  <a href="#commands">Commands</a> ·
  <a href="docs/Roadmap.md">Roadmap</a> ·
  <a href="docs/To-do.md">To-do</a> ·
  <a href="docs/Testing.md">Testing</a> ·
  <a href="docs/README.md">Knowledge base</a>
</p>

<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-status-dark.png">
  <img alt="Homelab Wizard: the Status screen, with every app running, what they replace, the watchdog's last run, what CrowdSec blocked this week, recent alerts, the photos each person keeps; categories where everything runs fold into one line" src="docs/images/app-status.png">
</picture>
</p>

---

## In plain words

### What is this?

A small private cloud that runs on a Mac at home, instead of on Apple's, Google's, or Netflix's computers. It does the jobs you would otherwise pay monthly subscriptions for (photo storage, a password manager, a budgeting app, music and audiobooks), but the apps run at home and the files stay yours.

### Why would I want it?

- **Your things stay yours.** Photos, documents, and passwords live on hardware in your home, not on a company's servers where prices, terms, or accounts can change under you.
- **It saves money.** Used to the full, it can stand in for 37 paid services worth about $4,300 a year ([what it saves](#what-it-saves)). Part of that, like streaming, only counts for movies and music you already own.
- **One place, one backup.** Instead of a dozen accounts and logins, everything sits together and is backed up together every night.

### What you can use it for

| When you want to… | Open | Instead of paying for |
|---|---|---|
| Back up phone photos and find them by face, place, or thing | Immich | iCloud+ 2 TB |
| Keep everyone's passwords | Vaultwarden (through the Bitwarden app) | 1Password Families |
| Sign in to the apps with Face ID instead of a password per app | Pocket ID | a single sign-on service |
| Scan and search receipts, letters, and paperwork | Paperless-ngx | Evernote |
| Plan the budget | MoneyMatter | YNAB |
| Watch your movies and shows | Jellyfin | Netflix, Hulu, Disney+, and others, for what you own |
| Listen to your music | Navidrome (Feishin in a browser) | Spotify Family |
| Listen to audiobooks and podcasts | Audiobookshelf | Audible, Pocket Casts |
| Read e-books and comics | Calibre-Web, Komga | Kindle Unlimited, Marvel Unlimited |
| Save articles and links to read later | Karakeep | Raindrop.io, Pocket |
| Keep the household's how-tos, manuals, and notes in a wiki | Docmost | Notion, Confluence |
| See where you have been, with trips on a map | Dawarich | Google Maps Timeline, Life360 history |
| Track investments and net worth | Ghostfolio | Ghostfolio Premium, a portfolio tracker |
| Keep recipes and plan meals | Mealie | Plan to Eat |
| Keep the grocery list, pantry, and chores | Grocy | a shopping-list app |
| Keep to-do lists and projects | Vikunja | Todoist |
| Run the lights, locks, and sensors | Home Assistant | each device's own cloud app |
| Ask an AI assistant privately | Open WebUI | some ChatGPT use |
| Reach everything at home while away, with ads blocked there too | Tailscale (with AdGuard Home) | a VPN subscription, NextDNS |

Each app has its own address, such as photos.example.com. Photos, passwords, documents, music, audiobooks, books, and comics also work away from home; the budget and movies work only on the home network.

### What does Homelab Wizard do?

The apps above are free, but each one takes hours to set up by hand, and all of them need to be kept running, updated, and backed up. Homelab Wizard is the part that does that work:

- **Installs apps for you.** Pick what you want in the app; it sets up everything each one needs.
- **Shows how everything is doing.** A status page and a menu bar icon show at a glance if something is down, and alerts arrive on the phone through the ntfy app, including when a disk is filling up.
- **Backs up every night**, encrypted, to Proton Drive. It sets the backup jobs up itself, and once a month it proves the backups work by restoring a sample and comparing every file, keeping a record of each test and how long it took.
- **Updates the apps overnight**, with a pause button. Each app's previous version is kept for a week, so a bad update is undone in one click (or by itself, when an app stays unwell after one).
- **Connects apps that work together**, so they are ready the first time you open them.
- **Gives each person their own sign-in and start page.** Adding someone makes their account, a welcome page with their apps and a one-time link to set up Face ID, and a tab on the start page with only the apps they use.
- **Works from the phone.** A paired phone shows the same status and backups, and can restart an app or back up now.
- **Keeps itself current.** When a newer version is on GitHub, the app lists what changed and gets it in one click, and can go back to the version before.
- **Lets you leave.** One command copies everyone's data out in open formats, another moves the whole homelab to a new computer, and a printable recovery kit says where the backups are and how to restore them.

### Is it safe?

Nothing on the Mac is opened directly to the internet. The apps that work away from home go through a secure tunnel (Cloudflare) and past a filter (CrowdSec) that blocks known attackers; everything else only answers inside the home network. Passwords are stored encrypted, and backups are encrypted before they leave the house.

### What if the Mac breaks?

The nightly backup holds the settings, passwords, documents, databases, and photos, so everything can be rebuilt on another computer; the printed recovery kit (Backups › **Recovery kit**) says how. Movies, music, audiobooks, and comics on the media drive are not in the backup; they are too large for Proton Drive and can be obtained again.

### What do I need to do?

Very little. Install the app for what you use (Immich for photos, Bitwarden for passwords) and sign in once; everything else opens in a web browser. The Mac needs to stay on, plugged in, and connected to the media drive.

## Highlights

| | |
|---|---|
| 🧱 **A small, crucial baseline**<br>Only what the household uses every day runs by default. Thirty-nine more apps are configured, documented, and one click away. | 🧩 **Slot in anything**<br>Add a service block (or a stack folder) with an `x-homelab` label, and the CLI installs, proxies, publishes, backs up, and documents it like the rest. |
| 🔒 **No open ports**<br>Public apps go out through a Cloudflare Tunnel, into Nginx Proxy Manager, past CrowdSec. Everything else stays on the LAN. | 💾 **Backups that restore**<br>Databases dumped nightly, then encrypted by Duplicati into Proton Drive through jobs the CLI creates. A one-click restore test has Duplicati restore a sample and compares hashes. |
| 🗓️ **Runs itself**<br>launchd starts the baseline at login, backs up at 03:30, and every 15 minutes checks each app, the public path, and the free space on every disk. Alerts arrive through ntfy. | 📚 **Docs that cannot drift**<br>Ports, addresses, images, and backup coverage in every note are generated from the compose files. CI fails if they are stale. |
| ↩️ **Updates you can undo**<br>A dump before every update, the previous image kept for a week, automatic rollback of an app that stays unwell, and `homelab upgrade --back` for the homelab itself. | 👪 **A household, not one admin**<br>Pocket ID passkeys for the apps that support single sign-on, a welcome page and a start-page tab for each person, and their photos' share on Status. |

> [!NOTE]
> **0.1.0-alpha.** Tested against fakes of Docker, Nginx Proxy Manager, AdGuard Home, Cloudflare, Duplicati, and ntfy, built from their source and API docs. First bring-up on the Mac is tracked in [Known Issues](docs/Known%20Issues.md).

## The desktop app

Homelab Wizard is also a desktop app for the Mac, Windows, and Linux, over the same engine as the CLI and following each platform's look and conventions: pick apps, watch them, finish the setup, and change settings, without a terminal. **Status** (the picture at the top) shows every app with its buttons, the watchdog's last run, what CrowdSec blocked this week, the latest alerts, and each person's photos. A house icon in the menu bar shows how everything is doing and backs up on demand, and Settings › **Phones** pairs a phone with a QR code, which then shows Status and Backups in its browser.

<table>
<tr>
<td width="50%"><strong>Choose stacks</strong><br>Tick apps or a preset; the plan shows what will start, which ports move, and which settings are written.<br><br><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-choose-dark.png">
  <img alt="Choose stacks: apps by category with what each replaces, presets, and the install plan" src="docs/images/app-choose.png">
</picture></td>
<td width="50%"><strong>Setup</strong><br>This machine (runtime, jobs, free space on each disk), then the first-time setup as a checklist, checked live, with a button for every step the engine can do, and the homelab's own updates from GitHub.<br><br><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-setup-dark.png">
  <img alt="Setup: this machine, then the first-time checklist with progress" src="docs/images/app-setup.png">
</picture></td>
</tr>
<tr>
<td><strong>Backups</strong><br>Each app's newest database copy, each off-site job's last and next run, the last restore test and how long it took, Back up now, Test a restore, and the printable Recovery kit.<br><br><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-backups-dark.png">
  <img alt="Backups: last backup, fresh copies, destination, restore test, and each app's newest copy" src="docs/images/app-backups.png">
</picture></td>
<td><strong>Settings</strong><br><code>.env</code> as a form. Passwords and tokens are never shown back: Test checks one with its service, and Copy hands it to the password manager.<br><br><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-settings-dark.png">
  <img alt="Settings: .env as a grouped form" src="docs/images/app-settings.png">
</picture></td>
</tr>
<tr>
<td><strong>Phones</strong><br>Pair a phone with a QR code; it can only look until you let it make changes, and Remove stops it at once.<br><br><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-phones-dark.png">
  <img alt="Settings › Phones: two paired phones, and a QR code to pair another" src="docs/images/app-phones.png">
</picture></td>
<td><strong>On the phone</strong><br>Status and Backups in the phone's browser, at home or over Tailscale, kept on the Home Screen like an app.<br><br><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/app-phone-dark.png">
  <img alt="The phone companion: Status on a phone, every app with its dot" src="docs/images/app-phone.png">
</picture></td>
</tr>
</table>

**Get it:** GitHub › Actions › Release › the latest green run › Artifacts.

| Platform | Artifact | Install |
|---|---|---|
| macOS (Apple Silicon and Intel) | **macos** › `Homelab-Wizard-macOS.dmg` | Drag the app onto Applications in the DMG, then run `xattr -dr com.apple.quarantine "/Applications/Homelab Wizard.app"` once (the build is not signed yet) |
| Windows 10 and 11, x64 or ARM | **windows** › `Homelab-Wizard-Windows-Setup.exe` | Run the installer (SmartScreen: More info › Run anyway, while unsigned); it installs the build for your PC's processor. Or unzip `Homelab-Wizard-Windows-portable.zip` (`-ARM64-portable.zip` on a Snapdragon PC) |
| Ubuntu, Debian, Fedora, Arch | **linux** › the `.deb`, `.rpm`, or `.pkg.tar.zst` | `sudo apt install ./homelab-wizard_*.deb` (or `dnf install`, `pacman -U`) |
| SteamOS, or any Linux without WebKitGTK | **linux** › `Homelab-Wizard-x86_64.AppImage` | `chmod +x` it and open it; Setup › **Add to the app menu** puts it in the menu, where SteamOS offers Add to Steam for Game Mode |

Each build carries the `homelab` CLI too, so Setup's buttons work without Go. What each one contains: [Releasing](docs/Releasing.md#each-platforms-build). Building it yourself: [app/README.md](app/README.md). The pictures are made with `make screenshots`.

## Quick start

```bash
brew install --cask orbstack         # then OrbStack > Settings > Start at login
brew install go                      # ./homelab builds itself on first run
git clone git@github.com:Snooper42/homelab-wizard.git ~/Homelab
cd ~/Homelab
./homelab doctor                     # checks the Mac, OrbStack, and settings
./homelab up                         # creates .env with generated secrets, starts the baseline
```

Then open the desktop app's **Setup** screen (or run `./homelab setup`) and work down the checklist: AdGuard, the domain and certificate, passwords, the tunnel, backups, alerts, and scheduled jobs. [Getting Started](docs/Getting%20Started.md) walks through it without commands; the [runbook](docs/Runbooks.md#first-time-bring-up) has the same steps as commands.

Afterwards, `./homelab upgrade` (or Setup › **Update**) brings in new versions, and [Upgrading](docs/Upgrading.md) says what each one asks of you.

## What runs

Every app the homelab can run. Baseline apps start with `./homelab up`; optional ones are a command (or a tick in the app) away. Each name links to the app's page, a small wiki for tinkering: its ports, address, and data folders; how it works under the hood; where its files live; everyday use; how it connects to the other apps; ideas to try; useful commands; its API; and links to the upstream docs, then how it is backed up and fixed.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
### Network

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [Nginx Proxy Manager](<services/network/Nginx Proxy Manager.md>) | Reverse proxy and TLS for every hostname, with CrowdSec blocking built in | Baseline | https://npm.example.com | ngrok Hobbyist |
| [AdGuard Home](<services/network/AdGuard Home.md>) | LAN DNS with ad blocking; answers *.domain with this Mac's address | Baseline | https://ads.example.com | NextDNS Pro |
| [Ad blocking on the tailnet](<services/network/Ad blocking on the tailnet.md>) | Sends DNS from your Tailscale devices to AdGuard Home, so ads are blocked at home and away | Optional: `./homelab install tailnet-dns` |  |  |
| [Tailscale](<services/network/Tailscale.md>) | Reach the home network from anywhere, privately, without opening router ports | Optional: `./homelab install tailscale` |  |  |
| [Speedtest Tracker](<services/network/Speedtest Tracker.md>) | Measures the internet connection on a schedule and keeps the history | Optional: `./homelab install speedtest-tracker` | https://speedtest.example.com |  |
| [Cloudflare Tunnel](<services/network/Cloudflare Tunnel.md>) | Publishes the public apps through Cloudflare without opening router ports | Baseline |  | ngrok Hobbyist |

### Security

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [CrowdSec](<services/security/CrowdSec.md>) | Reads the proxy's logs, bans attackers, and pulls the community blocklist | Baseline |  | Cloudflare Pro (WAF) |
| [Vaultwarden](<services/security/Vaultwarden.md>) | Password manager for the Bitwarden apps | Baseline | https://passwords.example.com | 1Password Families |
| [Uptime Kuma](<services/security/Uptime Kuma.md>) | Watches every app and alerts through ntfy when one goes down | Baseline | https://uptime.example.com | UptimeRobot Solo |
| [ntfy](<services/security/ntfy.md>) | Push notifications for alerts from every other service | Baseline | https://ntfy.example.com | Pushbullet Pro |
| [Pocket ID](<services/security/Pocket ID.md>) | One sign-in with passkeys for the household's apps (OpenID Connect) | Optional: `./homelab install pocket-id` | https://id.example.com |  |

### System

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [Watchtower](<services/system/Watchtower.md>) | Updates opted-in containers every night at 4 AM and reports to ntfy | Baseline |  |  |
| [Duplicati](<services/system/Duplicati.md>) | Encrypted, versioned backups to Proton Drive | Baseline | https://backups.example.com | Backblaze Personal Backup |
| [Homarr](<services/system/Homarr.md>) | Dashboard with live container status | Optional: `./homelab install homarr` | https://homarr.example.com |  |
| [Homepage](<services/system/Homepage.md>) | Simple dashboard of links and widgets | Optional: `./homelab install homepage` | https://homepage.example.com |  |
| [Dozzle](<services/system/Dozzle.md>) | Live logs of every container, in the browser | Optional: `./homelab install dozzle` | https://logs.example.com | Papertrail (paid plan) |
| [Phone companion](<services/system/Phone companion.md>) | Status, alerts, and backups on your phones, each paired with a code; home network and tailnet only | Native app | https://homelab.example.com |  |

### Cloud & Files

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [File Browser](<services/cloud and files/File Browser.md>) | Browse and share files on the media drive | Optional: `./homelab install filebrowser` | https://files.example.com | Dropbox Plus |
| [Syncthing](<services/cloud and files/Syncthing.md>) | Keeps folders in sync between your devices, with no cloud in between | Optional: `./homelab install syncthing` | https://sync.example.com |  |
| [Baikal](<services/cloud and files/Baikal.md>) | Calendars and contacts for every phone and computer (CalDAV and CardDAV) | Optional: `./homelab install baikal` | https://dav.example.com |  |
| [PairDrop](<services/cloud and files/PairDrop.md>) | AirDrop between any devices on the home network, from the browser | Optional: `./homelab install pairdrop` | https://drop.example.com |  |
| [PsiTransfer](<services/cloud and files/PsiTransfer.md>) | Send large files to anyone with a link that expires | Optional: `./homelab install psitransfer` | https://send.example.com | WeTransfer Starter |
| [Dawarich](<services/cloud and files/Dawarich.md>) | Where you have been, from the phone's location history, on a map with trips and stats | Optional: `./homelab install dawarich` | https://location.example.com |  |
| [Immich](<services/cloud and files/Immich.md>) | Photo and video backup with face and object search | Baseline | https://photos.example.com | iCloud+ 2 TB |

### Documents

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [FreshRSS](<services/documents/FreshRSS.md>) | RSS reader | Optional: `./homelab install freshrss` | https://freshrss.example.com | Feedly Pro |
| [Stirling PDF](<services/documents/Stirling PDF.md>) | Merge, split, convert, and sign PDFs | Optional: `./homelab install stirling-pdf` | https://pdf.example.com | Adobe Acrobat Pro |
| [Open WebUI](<services/documents/Open WebUI.md>) | Private AI chat with models that run on this machine (Ollama) | Optional: `./homelab install open-webui` | https://ai.example.com |  |
| [Changedetection.io](<services/documents/Changedetection.io.md>) | Watches web pages for price drops, restocks, and changes, and tells you through ntfy | Optional: `./homelab install changedetection` | https://watch.example.com | changedetection.io (hosted) |
| [Memos](<services/documents/Memos.md>) | Quick notes from any device, with tags and search | Optional: `./homelab install memos` | https://notes.example.com |  |
| [Docmost](<services/documents/Docmost.md>) | The household wiki, with pages, spaces, comments, and diagrams | Optional: `./homelab install docmost` | https://wiki.example.com |  |
| [Karakeep](<services/documents/Karakeep.md>) | Saved links and read-later, with full-page archives and search | Optional: `./homelab install karakeep` | https://links.example.com | Raindrop.io Pro |
| [Paperless-ngx](<services/documents/Paperless-ngx.md>) | Scanned documents with OCR and full-text search | Baseline | https://docs.example.com | Evernote Advanced |

### Finance

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [Wallos](<services/finance/Wallos.md>) | Every subscription you still pay for, with renewal dates and the yearly total | Optional: `./homelab install wallos` | https://subscriptions.example.com |  |
| [MoneyMatter](<services/finance/MoneyMatter.md>) | Budget tracker | Baseline | https://money.example.com | YNAB |
| [Ghostfolio](<services/finance/Ghostfolio.md>) | Investments and net worth across every account, with performance and dividends | Optional: `./homelab install ghostfolio` | https://invest.example.com | Ghostfolio Premium |

### Media

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [Navidrome](<services/media/Navidrome.md>) | Music server for the Subsonic apps and Feishin | Baseline | https://navidrome.example.com | Spotify Premium Family |
| [Feishin](<services/media/Feishin.md>) | Web music player for Navidrome | Baseline | https://music.example.com | Spotify Premium Family |
| [Audiobookshelf](<services/media/Audiobookshelf.md>) | Audiobooks and podcasts | Baseline | https://audiobooks.example.com | Audible Premium Plus, Pocket Casts Plus |
| [Calibre-Web](<services/media/Calibre-Web.md>) | E-book library and reader for the Calibre library | Baseline | https://books.example.com | Kindle Unlimited |
| [Komga](<services/media/Komga.md>) | Comics and manga reader | Baseline | https://comics.example.com | Marvel Unlimited, DC Universe Infinite |
| [Kavita](<services/media/Kavita.md>) | Books, comics, and manga reader | Optional: `./homelab install kavita` | https://kavita.example.com |  |
| [RomM](<services/media/RomM.md>) | The game library, with artwork, saves, and play in the browser | Optional: `./homelab install romm` | https://games.example.com |  |
| [Jellyfin](<services/media/Jellyfin.md>) | Movies and TV, installed natively (not in a container) so it can use hardware transcoding | Native app | https://jellyfin.example.com | Plex Pass, Netflix Standard, Hulu (No Ads), Disney+ Premium, HBO Max Standard, Peacock Premium Plus, Paramount+ Premium, Apple TV |

### Media Automation

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [Prowlarr](<services/media automation/Prowlarr.md>) | Indexer manager for the *arr apps | Optional: `./homelab install prowlarr` | https://prowlarr.example.com |  |
| [Sonarr](<services/media automation/Sonarr.md>) | TV show automation | Optional: `./homelab install sonarr` | https://sonarr.example.com | Trakt VIP |
| [Radarr](<services/media automation/Radarr.md>) | Movie automation | Optional: `./homelab install radarr` | https://radarr.example.com | Trakt VIP |
| [Lidarr](<services/media automation/Lidarr.md>) | Music automation | Optional: `./homelab install lidarr` | https://lidarr.example.com |  |
| [Bazarr](<services/media automation/Bazarr.md>) | Subtitles for Sonarr and Radarr | Optional: `./homelab install bazarr` | https://bazarr.example.com |  |
| [FlareSolverr](<services/media automation/FlareSolverr.md>) | Solves Cloudflare challenges for Prowlarr's indexers (http://flaresolverr:8191) | Optional: `./homelab install flaresolverr` |  |  |
| [Seerr](<services/media automation/Seerr.md>) | Media requests for Jellyfin (successor to Overseerr and Jellyseerr) | Optional: `./homelab install seerr` | https://seerr.example.com | Trakt VIP |
| [LazyLibrarian](<services/media automation/LazyLibrarian.md>) | E-book and audiobook automation | Optional: `./homelab install lazylibrarian` | https://lazylibrarian.example.com |  |
| [qBittorrent](<services/media automation/qBittorrent.md>) | Torrent client; it has no network except the ProtonVPN tunnel | Optional: `./homelab install qbittorrent` | https://qbittorrent.example.com |  |
| [Gluetun](<services/media automation/Gluetun.md>) | ProtonVPN tunnel that qBittorrent's traffic is forced through | Optional: `./homelab install gluetun` |  |  |

### Household

| App | What it does | Runs | Address | Replaces |
|---|---|---|---|---|
| [Mealie](<services/household/Mealie.md>) | Recipes and meal planning | Optional: `./homelab install mealie` | https://mealie.example.com | Plan to Eat |
| [Vikunja](<services/household/Vikunja.md>) | To-do lists and projects, shared with the household | Optional: `./homelab install vikunja` | https://todo.example.com | Todoist Pro |
| [Home Assistant](<services/household/Home Assistant.md>) | Smart-home hub for lights, locks, sensors, and automations | Optional: `./homelab install home-assistant` | https://home.example.com | Homey Premium |
| [Grocy](<services/household/Grocy.md>) | Groceries and household stock, chores, and shared to-dos | Optional: `./homelab install grocy` | https://grocy.example.com | AnyList Complete (household) |
| [Homebox](<services/household/Homebox.md>) | What you own, where it is, and its receipts, serial numbers, and warranties | Optional: `./homelab install homebox` | https://inventory.example.com |  |

58 apps: 17 baseline (started by `./homelab up`), 39 optional, 2 native. Databases and caches that apps need start with them and are not listed.
<!-- END homelab:generated -->

Ports and local addresses for every app, and the helpers: [Inventory](docs/Inventory.md).

## What it saves

Used to the full, the homelab can replace **37 paid services worth about $4,287 a year** ($5,127 at month-to-month prices), or roughly **$4,251 a year** after the domain and electricity. Streaming video alone is $1,327 of that. US list prices before tax, checked October 2026.

| Stack | Replaces | Monthly | Annual plan | Paid monthly for a year |
|---|---|---:|---:|---:|
| Network | 2 services | $11.99 | $115.90 | $143.88 |
| Security | 4 services | $47.98 | $459.87 | $575.76 |
| System | 2 services | $16.00 | $183.00 | $192.00 |
| Cloud & Files | 3 services | $29.98 | $323.76 | $359.76 |
| Documents | 5 services | $74.97 | $697.75 | $899.64 |
| Finance | 2 services | $18.32 | $149.00 | $219.84 |
| Media | 14 services | $205.82 | $2,137.94 | $2,469.84 |
| Media Automation | 1 service | $5.00 | $60.00 | $60.00 |
| Household | 4 services | $17.19 | $159.87 | $206.28 |
| **Everything** | **37 services** | **$427.25** | **$4,287.09** | **$5,127.00** |

Each saving is tagged **Direct** (the app does the same job), **Library** (needs media you own: films, music, books), or **Equivalent** (a paid product with the same function). Direct savings alone come to $1,376 a year; the baseline apps without the optional ones, $3,292.

<details>
<summary><strong>Network</strong>: $115.90 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| AdGuard Home | NextDNS Pro | Direct | $1.99 | $19.90 |
| Cloudflare Tunnel + Nginx Proxy Manager | ngrok Hobbyist | Equivalent | $10.00 | $96.00 |

</details>

<details>
<summary><strong>Security</strong>: $459.87 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| Vaultwarden | 1Password Families | Direct | $7.99 | $71.88 |
| Uptime Kuma | UptimeRobot Solo | Equivalent | $10.00 | $108.00 |
| ntfy | Pushbullet Pro | Equivalent | $4.99 | $39.99 |
| CrowdSec | Cloudflare Pro (WAF) | Equivalent | $25.00 | $240.00 |

</details>

<details>
<summary><strong>System</strong>: $183.00 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| Duplicati | Backblaze Personal Backup | Direct | $9.00 | $99.00 |
| Dozzle (optional) | Papertrail (paid plan) | Equivalent | $7.00 | $84.00 |

</details>

<details>
<summary><strong>Cloud & Files</strong>: $323.76 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| File Browser (optional) | Dropbox Plus | Equivalent | $11.99 | $119.88 |
| Immich | iCloud+ 2 TB | Direct | $9.99 | $119.88 |
| PsiTransfer (optional) | WeTransfer Starter | Equivalent | $8.00 | $84.00 |

</details>

<details>
<summary><strong>Documents</strong>: $697.75 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| Paperless-ngx | Evernote Advanced | Direct | $24.99 | $249.99 |
| Stirling PDF (optional) | Adobe Acrobat Pro | Direct | $29.99 | $239.88 |
| FreshRSS (optional) | Feedly Pro | Direct | $8.00 | $72.00 |
| Karakeep (optional) | Raindrop.io Pro | Direct | $3.00 | $28.00 |
| Changedetection.io (optional) | changedetection.io (hosted) | Direct | $8.99 | $107.88 |

</details>

<details>
<summary><strong>Finance</strong>: $149.00 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| MoneyMatter | YNAB | Direct | $14.99 | $109.00 |
| Ghostfolio (optional) | Ghostfolio Premium | Direct | $3.33 † | $40.00 |

</details>

<details>
<summary><strong>Media</strong>: $2,137.94 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| Jellyfin | Plex Pass | Direct | $6.99 | $69.99 |
| Jellyfin | Netflix Standard | Library | $19.99 | $239.88 |
| Jellyfin | Hulu (No Ads) | Library | $18.99 | $227.88 |
| Jellyfin | Disney+ Premium | Library | $21.49 | $214.99 |
| Jellyfin | HBO Max Standard | Library | $18.49 | $184.99 |
| Jellyfin | Peacock Premium Plus | Library | $19.99 | $199.99 |
| Jellyfin | Paramount+ Premium | Library | $13.99 | $139.99 |
| Jellyfin | Apple TV | Library | $14.99 | $119.00 |
| Navidrome + Feishin | Spotify Premium Family | Library | $21.99 | $263.88 |
| Audiobookshelf | Audible Premium Plus | Library | $14.95 | $149.50 |
| Audiobookshelf | Pocket Casts Plus | Direct | $3.99 | $39.99 |
| Calibre-Web | Kindle Unlimited | Library | $11.99 | $143.88 |
| Komga | Marvel Unlimited | Library | $9.99 | $68.99 |
| Komga | DC Universe Infinite | Library | $7.99 | $74.99 |

</details>

<details>
<summary><strong>Media Automation</strong>: $60.00 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| Sonarr + Radarr + Seerr (optional) | Trakt VIP | Equivalent | $5.00 † | $60.00 |

</details>

<details>
<summary><strong>Household</strong>: $159.87 a year</summary>

| App | Replaces | Kind | Monthly | Annual plan |
|---|---|---|---:|---:|
| Mealie (optional) | Plan to Eat | Direct | $5.95 | $49.00 |
| Vikunja (optional) | Todoist Pro | Direct | $7.00 | $60.00 |
| Grocy (optional) | AnyList Complete (household) | Equivalent | $1.25 † | $14.99 |
| Home Assistant (optional) | Homey Premium | Equivalent | $2.99 | $35.88 |

</details>

Conditions, running costs, and price sources for every row: [Savings](docs/Savings.md).

## How it fits together

```text
Internet ─► Cloudflare ─► Tunnel (outbound only) ─┐
                                                  ▼
LAN ─► AdGuard (*.example.com → Mac) ─► Nginx Proxy Manager + CrowdSec ─► app by service name
                                                  │
           OrbStack, one shared "homelab" network ┘   Jellyfin and the phone companion natively on the Mac
Tailscale devices, anywhere ─► tailnet ─► the same proxy (and AdGuard, with ad blocking on the tailnet)
```

| Piece | Where |
|---|---|
| `compose.yaml` | Categories, presets, and native apps |
| `compose/<category>.yaml` | The platform and single-container apps: one Compose project per category (`homelab_network`, `homelab_media`, …), grouped that way in OrbStack |
| `stacks/<name>/compose.yaml` | Apps with their own database: Immich, Paperless-ngx, MoneyMatter (`budget-tracker`), Karakeep, RomM, Ghostfolio, Docmost, Dawarich, and the Cloudflare Tunnel |
| `dockerfiles/npm-crowdsec/` | Nginx Proxy Manager with CrowdSec's Lua bouncer built in |
| `cmd/`, `internal/` | The `homelab` CLI (Go, single binary, no runtime) |
| `docs/`, `services/` | The knowledge base: one note per app, Obsidian-friendly |

See [Architecture](docs/Architecture.md) and [Decisions](docs/Decisions.md).

## Adding a service

The quick way, for any container image: **Add your own app** at the bottom of the app's Choose stacks screen, or

```bash
./homelab custom add wiki --image ghcr.io/requarks/wiki:2 --port 3000 --volume /wiki/data --install
```

It goes into `stacks/custom/compose.yaml` with the same metadata as the catalog, a free port, a `https://wiki.example.com` address after `domain setup`, and its folders under `data/appdata/wiki`, which the nightly backup already covers. Like `.env`, the custom stack is yours alone: git ignores it, so `git pull` keeps working. `./homelab custom` lists your apps; `./homelab custom remove wiki` takes one out (its data stays).

To add an app to the catalog itself (with documentation, presets, and wiring), write the service by hand:

```yaml
  myapp:
    <<: *service
    image: example/myapp:latest
    profiles: [optional]
    ports:
      - ${BIND_IP:-127.0.0.1}:${MYAPP_PORT:-8123}:8080
    volumes:
      - ./data/appdata/myapp:/config
    labels:
      - com.centurylinklabs.watchtower.enable=true
    x-homelab:
      name: My App
      category: documents
      description: What it is for
      subdomain: myapp
      web: 8080
```

```bash
./homelab docs && make check          # creates its note, checks everything
./homelab install myapp               # starts it
./homelab domain setup                # https://myapp.example.com
```

Multi-container apps get their own `stacks/<name>/` folder. The full guide and checklist are in [Contributing](docs/Contributing.md).

## Commands

```bash
./homelab                       # interactive menu
./homelab status                # what runs, health, addresses
./homelab install '*-arr'       # slot in apps by name, alias, bundle, or category
./homelab update <app>          # dump its database, pull (or rebuild), and recreate
./homelab rollback <app>        # back to the image before its last update
./homelab domain setup          # proxy hosts, LAN DNS, certificate, tunnel hostnames
./homelab backup                # database dumps, volume archives, .env copy
./homelab watchdog              # public path check with ntfy alerts
./homelab schedule install      # the launchd jobs
./homelab person add "Anna Smith" --email anna@example.com   # an account, a welcome page, a start-page tab
./homelab sso setup             # the apps sign in with Pocket ID
./homelab phone pair            # the phone companion
./homelab export                # everyone's data in open formats, in one folder
./homelab move out              # to a new machine (then move in there)
./homelab compose immich ps     # docker compose for any project
```

Commands that change something show a plan first and ask (or need `--apply` when not in a terminal). Full list: [Commands](docs/Commands.md).

## Development

```bash
make check            # gofmt, go vet, tests, catalog and docs validation
make compose-config   # docker compose config for every project
```

See [CONTRIBUTING](CONTRIBUTING.md). Changes are recorded in the [CHANGELOG](CHANGELOG.md).
