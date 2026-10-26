---
version: 0.9.0-beta
---

# Testing

A script for testing a new build on the Mac, in order. Each step says what to do and what you should see. When something does not match, check [Troubleshooting](<Troubleshooting.md>), then stop there and make a report:

```sh
./homelab report
```

It writes `scripts/logs/report-<date>.txt` with doctor, status, the setup checklist, the jobs, Duplicati's jobs, the weekly summary, the updates waiting, which settings are set, and the logs of anything unwell. Passwords, tokens, and anything shaped like one are replaced with `[redacted …]`. Read it through, then share the file or paste it. Never paste `.env` itself, a token, or a password. The app's Setup screen has the same thing as **Make a diagnostics report**.

Type each command as shown, one line at a time. In zsh a `#` on the line is not a comment, so there are none here.

## 1. Bring the Mac up to date

If you tested an earlier build, read [Upgrading](<Upgrading.md>) first: it lists what changed and the few steps it asks of you.

```sh
cd ~/Homelab
./homelab upgrade
./homelab version
./homelab doctor
```

- `upgrade` lists what changed and what is new, asks, moves the folder forward, and runs `up` afterwards. Setup › **Update** in the app does the same, and updates the app too. (A clone from before `upgrade` existed: `git checkout main` and `git pull` once instead.)
- `version` prints the repository's version; the first run after an update builds the CLI ("Building the homelab CLI...").
- `doctor` ends without ✗ lines. Expected ! warnings: a VPN if one is on, and settings you have not filled in yet.
- If OrbStack still lists a `homelab_core` project, `upgrade` moves the containers into their category projects (`homelab migrate`, a backup first). OrbStack then lists them grouped as homelab_network, homelab_security, homelab_system, homelab_media, and so on, every app keeps its data and settings, and `doctor` no longer mentions `homelab_core`.
- With `brew install smartmontools` done, `doctor` lists each drive under **Drive health** as passed (the Mac's own SSD at least; a USB drive may say it gives no report).

## 2. The desktop app

1. The first time only, in Terminal (Linux too; on Windows, `irm https://raw.githubusercontent.com/Snooper42/homelab-wizard/main/install.ps1 | iex` in PowerShell):

   ```sh
   curl -fsSL https://raw.githubusercontent.com/Snooper42/homelab-wizard/main/install.sh | sh
   ```

   It installs the newest build from GitHub › Releases › **Latest** after checking its checksum, and opens it. Once the app is installed, it updates itself (Setup › **Update**), so skip to step 3.
2. From a browser instead: download `Homelab-Wizard-macOS.dmg`, drag **Homelab Wizard** to Applications, then clear the download flag once (the build is not signed):

   ```sh
   xattr -dr com.apple.quarantine "/Applications/Homelab Wizard.app"
   ```

3. Open it from Applications.

| Check | You should see |
|---|---|
| First screen | Setup, with the number of steps left beside it in the sidebar, unless every step is done |
| Setup › host details | macOS, OrbStack with its engine version, the homelab folder `~/Homelab`, the version, and **Disk space**: a green line for the Mac's disk (homelab folder, backups) and one for the media drive (photos, media, downloads), each with its free space. `./homelab doctor` lists the same under Disk space |
| Setup › Version | "✓ up to date" after the pull, and "build" with the commit this app was made from. Whenever GitHub has newer changes, it says how many, and a card lists them with **What is new** and **Update** |
| Sidebar, with an update waiting | **● Update ready** at the bottom of the sidebar on every screen; clicking it (or pressing Enter on it) opens Setup |
| Setup › **Update**, with changes waiting and a newer build on GitHub | The log shows the homelab files moving forward and `up`, then the app downloading and its SHA-256 checked; the app closes, and the new one opens by itself within a minute, its build commit changed. The sidebar no longer says Update ready |
| Setup, with only a newer build on GitHub | A card says a newer Homelab Wizard is ready with **Update now**, which does the app part alone |
| Window and menus | The window buttons sit at the top of the sidebar, which shows the desktop through it (as in Finder). The menu bar has View (Choose Stacks to Setup on ⌘1 to ⌘4, Settings… on ⌘,, Reload on ⌘R) and Help, and Homelab Wizard › About shows the version. Buttons show the arrow, not a hand; dragging the sidebar or the strip above a screen moves the window |
| Menu bar | One house icon. Its menu lists the apps' health and the yearly savings, and *Update ready: N new changes* once GitHub has newer changes (or *Update ready: a new Homelab Wizard* when only the app is behind, checked once an hour); clicking it opens Setup. Opening the app again from it brings the same window forward |
| Text size | ⌘+ makes the whole app bigger, ⌘− smaller (80% to 200%), ⌘0 back to the usual size; after quitting and opening again, the size is kept |
| Keyboard | Tab reaches every link that acts (Open Setup, Show, *go back to …*, Settings on an app row) and Enter or Space presses it |
| VoiceOver (⌘F5) | Picking a screen reads its heading and the sidebar button says *current page*; a finished backup or an error is read out without moving there; the search fields are read by name |
| Choose stacks › tick Speedtest Tracker | The plan says in one line that it installs 1 app and lists Speedtest Tracker only; helpers, port moves, and settings are under **Details** |
| Then **Install** | Each step ticks off; **Details** shows Compose pulling and starting. Then it is listed under Started with a link |
| Choose stacks › preset *Media automation* | The plan lists Prowlarr, Sonarr, Radarr, Lidarr, Bazarr, FlareSolverr, qBittorrent, and Seerr (Gluetun under Details as qBittorrent's VPN), says the VPN key is needed by its setting's name, and shows the field to fill in with where to find it. Do not install unless you mean to |
| Choose stacks › type "spotify" in the search box | **Add more** opens by itself; Navidrome and Feishin only |
| Choose stacks › click **Music** under Start here | The card is marked ✓, Navidrome and Feishin are ticked under Add more, and the plan lists them; clicking it again unticks both |
| Choose stacks › Presets under Add more | Only the bundles (*Media automation*, *Household*, *Ad blocking*, and the starters), no stack folders or categories; app rows have no baseline/optional badges |
| Settings › `HELPER_EMAIL` (your own address), then Setup › Make a diagnostics report › **Email it to my helper** | Mail opens a message to you, and Finder shows the report to attach |
| Setup › Make a diagnostics report › Show in Finder | Finder opens with the new report selected |
| Quit OrbStack, then look at Setup | A card *Start OrbStack* with **Open OrbStack**; clicking it starts OrbStack and the card goes away by itself within a few seconds of it answering |
| Quit while nothing runs | The app quits; the menu bar icon stays |
| Status | Four tiles at the top (running, needs a look, savings, nightly updates). Categories where every app runs are folded into one line with the apps' names; clicking one opens it, **Show every app** opens them all, and after quitting and opening again the choice is kept |
| Status › point at an app's row (or Tab to it) | Its buttons appear; each row shows one address, with the address on this machine in the tooltip |
| Status › the phone button on Vaultwarden | A QR code of its address; the phone's camera opens it (with Tailscale on in Home mode); the panel says what the phone needs and names Bitwarden |
| Status › the key button on Nginx Proxy Manager | The user name the homelab made, and **Copy** puts the password on the clipboard (cleared after 90 seconds); the password is never shown |
| Status › **This week** | The same lines as `./homelab digest` (apps, backups, restore test, attacks caught, disk space), with ✓ All well or what needs a look marked |
| Status › **What the apps keep** (after a nightly backup) | Up to six app folders with their sizes, largest first, beside **Photos per person** when Immich runs |
| Status, after an app was down for a while this week | Its row has a badge such as *96.2% up this week*; apps up over 99% have none |
| Choose stacks › tick Memos › Install (with a domain, after Set up the domain has run) | The install log ends with `domain setup --auto` and `https://notes.example.com`, which opens with a padlock without running anything else |
| `./homelab stop navidrome`, then Status | **Fix it** appears; it shows the plan (start the baseline apps that are down), and **Fix these** brings Navidrome back. After a watchdog run that saw it down, the **Watchdog** card has **Fix it** too |
| `./homelab compose crowdsec exec crowdsec cscli bouncers delete nginx_proxy_manager`, then Status (within a minute) | **Protection** says *Bans not enforced* with **Fix**; it shows the plan (remove the stale bouncer, restart CrowdSec and the proxy), and afterwards Protection says ✓ Bans enforced |
| Status › an app's row › the log icon | Its last 200 lines; **Open Dozzle** appears when Dozzle runs |
| Status › Speedtest Tracker › restart icon | The panel streams the restart and ends with "restart done"; the dot stays green |
| Status › an app's row | "up 3 days" (or however long) under each running app; a *restarted N×* badge only on one Docker had to restart |
| Backups › **Recovery kit** | The browser opens a page to print: the backup folder (`BACKUP_DESTINATION`), each backup job and what it holds, a blank line for the Secrets passphrase, the accounts, the apps that run, and the restore steps. No password or key appears on it; `recovery-kit.html` is in the homelab folder |
| Backups › Off-site jobs | Beside each job's last run, "next in N hours" (hover for the exact time); a job with no schedule shows none |
| Backups › **Moving to a new machine** › **Move out…** | The first click only asks *Click again…*; the second opens a save dialog. Cancel there: nothing happens and no app stops (the real move is in section 7) |
| Settings › **Appearance** | Each choice shows at once and is kept after reopening the app: **Dark** on a light system (the sidebar too on the Mac, the title bar on Windows), an accent swatch or **Any colour…** (the system's picker), **More** contrast, **Islands**, and **Tray icon** › **Its own colour**, which the menu bar or tray icon takes within a few seconds |
| Settings | **Appearance**, **People**, and **Phones** at the top, then only the everyday settings; **Show all settings** adds ports, versions, generated passwords, and internal addresses; searching "port" finds them even when hidden |
| Settings › type a new `HEARTBEAT_URL`, then **Test** without saving | It saves the value, then tests it; **Save** no longer counts it |
| Settings › **People**, without Pocket ID | The card says adding people uses Pocket ID, with **Install Pocket ID**, which opens Choose stacks with it ticked |
| `./homelab stop navidrome` with Status open | Its row turns *Stopped* within two seconds, without waiting for a refresh; the menu bar's health line too. `./homelab start navidrome` turns it back |
| `docker pause` an app's container (Memos), then Status | After a few seconds the row says *Not answering: no answer in time*, and **Fix it** appears. `docker unpause` it: the row is *Running* again |
| The same, left paused through two watchdog runs (30 minutes) | The second run restarts it: an alert *Homelab: restarted an app that hung* names it and why, and it is running again. A third run within 6 hours leaves it alone |
| Change an app's port in Settings (`MEMOS_PORT`), save, then Status | The row has *settings changed*; **Fix it** lists *recreate the apps whose settings changed*, and **Fix these** brings it back on the new address. Change it back the same way |
| Status › an app's update icon (Uptime Kuma) | A panel lists the releases newer than the version it runs, with the start of each one's notes and **Full notes**, then **Update** and **Cancel**. `./homelab updates notes uptime-kuma` prints the same |
| Status › **Update apps** | The list of apps with what each update brings (*2.0.1 → 2.0.2*); after **Update them**, a bar with *Updating … · 2 of 5* above the log |
| With Ollama and a model (`ollama pull llama3.2`): Status › an app's log icon › **Explain this log** | A few lines in plain words on whether something is wrong, the line that shows it, and what to try, naming the model. Without Ollama the button is not there. `./homelab logs memos --explain` prints the same |
| Settings › Phones › **Pair a phone** with **Can make changes** ticked, then open the `http://` link on a phone on the home Wi-Fi and pair | Settings › Phones shows it as *Looks only (paired over the home Wi-Fi, without encryption)* with no **Allow changes**; the same with the `https://` (Tailscale) link shows *Can make changes*, and **Restart** on the phone works |
| Settings › Phones › **Pair a phone**, then the link with `&kiosk` on an iPad or a TV's browser | After pairing it shows Status alone, larger, with the time in the corner and no buttons; stopping an app on the computer shows there within seconds, and the screen does not go dark |
| Status › **What's using power**, with an app busy | Each busy app's share of a core, and after half a minute a small line of its last minutes beside it |
| `./homelab --json status \| head -1` | The line starts with `{"schema":1,` |

If the app says it cannot find the homelab folder, use **Choose…** beside Homelab folder on Setup and pick `~/Homelab`. To try the new-machine path without touching `~/Homelab`, open the app on another Mac user account (or rename the folder for a moment): Setup offers **Set it up for me**, which makes `~/Homelab` with `.homelab-kit.json` in it, and `./homelab kit` names the build.

The window remembers itself: make it smaller and move it, quit (⌘Q), open the app again: it opens the same size in the same place. Zoom it to fill the screen (double-click the title area), quit, open: it fills the screen; zoom back: the earlier size returns.

The Dock: with an app stopped by hand (`./homelab stop memos`), the app's Dock icon shows a red *1* within seconds, like Mail's unread count; `./homelab start memos` clears it.

The accent colour: System Settings › Appearance › Accent colour › Purple, then the app's Setup › **Check again** (or reopen the app): links, buttons, the progress bar, and the selected sidebar item turn purple, on light and dark; Yellow gives buttons dark text; Multicolor brings back the blue.

Increase contrast: System Settings › Accessibility › Display › **Increase contrast** on: the app's dividers and card edges get darker and grey text gets darker too, on light and dark; off, as before.

## 3. Setup, in order

Work down the Setup screen (or `./homelab setup` in Terminal). After each step, **Check again** should turn it ✓. Each step's first line says what it gives you, then what to do.

On a homelab whose Setup was first opened less than a week ago (`data/setup.json` › `since`), *Backups leave this machine*, *Backup jobs in Duplicati*, and *Alerts when this machine is down* show last, under **Can wait a week**; the title says *· 3 can wait* and the Setup tab's number leaves them out. Done early, they count as done.

First, with a few steps ready: **Do the steps I can**. It runs each ready step in turn (its button shows *Doing: …*), and stops with *What is left needs you* or at the first step that fails, with the log saying why.

Home mode is the default (`HOMELAB_DOMAIN` empty in `.env`):

| Step | What to do | You should see |
|---|---|---|
| This laptop stays plugged in and open (a MacBook only; a Mac mini has no such step) | Unplug the charger, **Check again**; plug it back in, **Check again** | Unplugged: *It is on battery now: plug it in*; plugged in: ✓. With the lid closed and no display, a phone loses the apps within a few minutes (expected: that is what the step warns about) |
| Addresses on your tailnet (Tailscale) | With `TAILSCALE_AUTHKEY` empty: **Set up the addresses**. Tailscale's sign-in page opens in the browser; sign in (no auth key needed). In the Tailscale admin console › DNS, turn on HTTPS Certificates | ✓; `./homelab tailnet setup` lists `https://homelab.<tailnet>.ts.net:<port>` addresses, Status shows them, and Vaultwarden's opens on the phone with Tailscale on |
| Password manager account | **Open sign-ups for 10 minutes**, create the accounts at the passwords address, then close sign-ups (or wait) | The countdown, then "sign-ups closed"; a new sign-up is refused afterwards |
| Two-step sign-in | Each Vaultwarden account: Settings › Security › Two-step login (authenticator app). Nginx Proxy Manager: add a personal administrator under Users, then its avatar menu › Two-Factor Auth. Tick **Done** | Signing in again asks for the code; with a domain, **Set up the domain** still works (it uses `NPM_API_EMAIL`, which stays without it) |
| Backups leave this machine | One button per place found: **Use Proton Drive** (it makes `Homelab Backups` in the Proton Drive folder), and **Use iCloud Drive** or **Use the … drive** where those exist; the media drive is not offered. For another folder, use Settings › `BACKUP_DESTINATION` › **Choose…** and Save instead. Then **Test** beside the setting | ✓, and the test wrote and removed a file there |
| Backup jobs in Duplicati | **Create the backup jobs**, then Settings › `DUPLICATI_SECRETS_PASSPHRASE` › **Copy** into Vaultwarden, and onto the recovery kit | The plan, then (recreating Duplicati first if it still had an older folder) each job created and the first runs queued; Duplicati shows the jobs; their files appear in the Proton Drive web app (ISSUE-0003); Backups › Off-site jobs shows each ran, and the step turns ✓ |
| Alerts on the phone | **Set up the alert token** (it also makes the app's read token and the phone's login), in the phone's ntfy app add the server with user `phone` and Settings › `NTFY_PHONE_PASSWORD` › **Copy**, subscribe to the topics, add the alert address to Uptime Kuma ([Monitoring](<Monitoring.md>); Duplicati gets it from this step) | Settings › **Test** passes beside `NTFY_PUBLISH_TOKEN`, `NTFY_READ_TOKEN`, and `NTFY_PHONE_PASSWORD`; `./homelab notify test` reaches the phone, also on mobile data (ISSUE-0011), and shows under Recent alerts on Status and in the menu bar |
| Scheduled jobs | **Install the jobs** | `./homelab schedule status` lists the agent, loaded (*always*), and System Settings › Login Items & Extensions shows one homelab entry; `pmset -g assertions` lists caffeinate preventing sleep, and `doctor` says the awake job keeps the Mac up |
| Alerts when this machine is down | A healthchecks.io check (15 minutes, 15 minutes grace); its ping URL in Settings › `HEARTBEAT_URL` | After the next watchdog run (up to 15 minutes) the check turns green |
| Tailscale on phones and computers | Install Tailscale on the phone, sign in with the same account, tick **Done** | ✓; on mobile data, the apps' tailnet addresses open |
| Admin apps on the tailnet | Settings › **Admin apps on the tailnet** off (`TAILNET_ADMIN_APPS=false`), Save, then `./homelab tailnet setup` | On the phone, Nginx Proxy Manager's, AdGuard's, Duplicati's, and Dozzle's tailnet addresses no longer open, while Immich's and Vaultwarden's still do; on the Mac they open at their local address. Turn it back on afterwards if you prefer |

With a domain (in a copy, or once you are ready: Settings › `HOMELAB_DOMAIN` = your domain, Save), the tailnet step gives way to these:

| Step | What to do | You should see |
|---|---|---|
| Home DNS answers (AdGuard Home) | **Set up AdGuard** (or, if you already made a login in AdGuard's wizard, put it in Settings › `ADGUARD_USER`, `ADGUARD_PASSWORD` › Save) | ✓, and `ADGUARD_PASSWORD` is filled in |
| Cloudflare API token | Create it with the three permissions the step lists; paste it in Settings › `CLOUDFLARE_API_TOKEN`, Save, then **Test** beside it | ✓, and the test says the token can read example.com |
| Addresses and certificate | **Set up the domain**; the first time takes a few minutes (the certificate) | `https://npm.example.com` opens with a padlock, on the Mac and on your phone over Wi-Fi |
| This Mac finds its apps by name | With Proton VPN connected (*Allow LAN connections* on): **Find the apps on this Mac**, enter the Mac password once | `cat /etc/resolver/<domain>` shows `nameserver` and the Mac's address, `https://photos.example.com` opens in the browser, and an app installed afterwards opens too, with nothing run again |
| Access away from home | Create the tunnel in Cloudflare Zero Trust, paste its token in Settings › `TUNNEL_TOKEN`, **Start the tunnel** | On your phone with Wi-Fi off, `https://passwords.example.com` opens |
| Alerts on the phone, again | **Set up the domain** again so ntfy is published | The ntfy app on the phone reaches `https://ntfy.example.com` on mobile data |
| Phones and computers use the home DNS | Set the Wi-Fi DNS server on each device to the Mac's address, tick **Done** | The app names open at home |

### Memory

| Check | You should see |
|---|---|
| `./homelab plan immich-server vaultwarden navidrome feishin filebrowser syncthing` | No *Memory:* warning (about 2.2 GB of the room an 8 GB Mac has) |
| `./homelab --json plan paperless open-webui karakeep dawarich stirling-pdf immich-machine-learning` on an 8 GB Mac | A *Memory:* warning naming the heaviest; on 16 GB, none. `memory.room` is this Mac's memory less 4 GB |
| After a week of use: `./homelab doctor`'s memory line against the plan's `memory.use` | Within about a third of each other; if not, the estimates in the compose files need adjusting |

## 4. The jobs

```sh
./homelab watchdog
./homelab backup --apply
./homelab schedule status
```

- Stop one baseline app (`./homelab stop navidrome`), run `./homelab watchdog` twice: the second run shows *Homelab: something is down* in Notification Center as well as on the phone. `./homelab start navidrome` and the next run shows *recovered*.
- `watchdog` lists every check as ✓. A check that fails once only says so; it alerts when it fails twice in a row. The app's Status screen then shows **Watchdog** with all checks passed and when it ran.
- `backup` writes the database dumps and the `.env` copy into `recovery-staging` (Duplicati takes them off-site from 05:00) and ends with a summary.
- `schedule status` shows each job loaded, with a last exit code of 0 once it has run.
- The app's **Backups** screen lists each app's newest copy as Fresh, the settings file copied a moment ago, and the destination as Set; **Back up now** streams the same backup and ends with "Backup done".
- The menu bar's **Back up now** ends with "done" and the time.
- `./homelab digest` prints the same lines as Status › **This week**; `./homelab digest --send` reaches the phone as *Homelab this week*, listing what needs a look (expect the restore test until step 6). From then on it arrives each Sunday morning.
- After logging out and back in, `schedule status` still lists the jobs; the next morning there is a new dump in `recovery-staging/databases` (ISSUE-0005).
- With `HEARTBEAT_URL` set: quit OrbStack, and within 30 minutes healthchecks.io alerts (ISSUE-0006). Start OrbStack again afterwards.

## 5. The proxy and CrowdSec

```sh
./homelab update nginx-proxy-manager
./homelab logs nginx-proxy-manager
./homelab compose crowdsec exec crowdsec cscli bouncers list
```

- `update` rebuilds the proxy image with CrowdSec AppSec; `logs` shows no Lua errors (ISSUE-0001).
- `bouncers list` shows `nginx_proxy_manager` with a recent last pull, and `./homelab doctor` says *the proxy's bouncer pulled decisions … seconds ago*.
- With a domain, the ban test in [Runbooks](<Runbooks.md>) returns 403 on the phone, then loads again once lifted. Within a minute the app's Status › **Protection** lists it as a manual ban.
- With a domain, open any app from a phone on Wi-Fi, then check which address the proxy logged (ISSUE-0002):

  ```sh
  ./homelab compose nginx-proxy-manager exec nginx-proxy-manager sh -c 'tail -n 1 /data/logs/proxy-host-*_access.log'
  ```

## 6. The first restore test

Once the Homelab AppData job has run in Duplicati, the Backups screen shows **Test a restore**. Click it (or run the command):

```sh
./homelab restore-test --auto
```

- The panel shows Duplicati restoring a dozen files, then ends with "12 of 12 sampled files identical" (fewer when few files have settled for a day) and "Restore test passed". The Restore test tile says a moment ago and "in N minutes" (how long it took), hovering it lists the test on record, and `recovery-staging/restore-test` is gone again. `./homelab report` has it under "restore tests".
- Then the manual way once, as in [Backups](<Backups.md#restore-testing>): restore Homelab AppData in Duplicati to `/staging/restore-test`, run `./homelab restore-test recovery-staging/restore-test data/appdata`, and delete the folder afterwards.

## 7. The new apps (optional)

Install one at a time from Choose stacks, then open it from Status.

| App | Check |
|---|---|
| Karakeep | `https://links.example.com` opens; save a link and its page archive appears after a minute |
| Grocy | Opens; the default login is admin / admin, change it at once |
| Vikunja | Create your account with the command in [its note](<../services/household/Vikunja.md>), sign in at `https://todo.example.com`, add a task, then `./homelab compose vikunja restart vikunja`: you are still signed in and the task is there |
| Homepage | Comes with *Household*. `https://homepage.example.com` lists every running app with its icon; stop one from Status and it drops off the page within a few seconds of the page reloading |
| Syncthing | Set a GUI password first (Actions › Settings › GUI), then add a device |
| Home Assistant | Onboarding opens at `https://home.example.com` without a "400: Bad Request" |
| Open WebUI | After `brew install ollama`, `brew services start ollama`, `ollama pull llama3.2`: a chat answers |
| Tailscale | With `TAILSCALE_AUTHKEY` empty: `./homelab tailnet login` opens Tailscale's sign-in page; after signing in it says it is signed in as homelab on your tailnet. Approve the route in Tailscale's admin, then `./homelab doctor` says the route is approved |
| Small baseline | In a folder made with **Set it up for me**: `.env` has `HOMELAB_BASELINE=small` and an empty `HOMELAB_DOMAIN`, Start the homelab starts only Watchtower, Duplicati, ntfy, and Uptime Kuma, and Setup shows no password-manager step until Passwords is installed |
| Home mode by default | A fresh `git clone` into a new folder, then `./homelab up`: `.env` has an empty `HOMELAB_DOMAIN`, and Setup shows **Addresses on your tailnet** instead of the domain steps. An existing `.env` keeps its domain after `./homelab upgrade` |
| Ad blocking (Home mode) | After Home mode works: Choose stacks › **Ad blocking** › Install. The install log ends with the tailnet address to use; in the Tailscale admin console › DNS add it as a custom nameserver and turn on Override DNS servers. On the phone with Tailscale on and Wi-Fi off, `https://doubleclick.net` does not open, and AdGuard's dashboard counts the query. Setup shows **Ad blocking on every device** |
| Phone companion | Settings › Phones › name it › **Pair a phone**, and scan the QR code with the phone's camera (or `./homelab phone pair --name "My iPhone"` and open the address it prints); **Pair** | The phone shows Status and Backups with the same dots as the Mac; Safari › Share › Add to Home Screen opens it full screen. Restart, Stop, and Back up now are missing until `./homelab phone allow <id>`; `./homelab phone list` shows when it was last seen; `./homelab phone remove <id>` (or **Remove** in Settings › Phones) sends it back to the pairing form. **Send a report** on the phone opens the share sheet with `homelab-report.txt`. With mobile data and Tailscale off, the address does not open |
| Add a person | With Pocket ID running: Settings › **People** › **Add a person**, name *Test Person*, email `you+test@example.com`, tick two apps, **Add them**. Their welcome page opens: the sign-in link opens Pocket ID on a phone and adds a passkey; the page lists the two apps with their addresses and phone apps. **New sign-in link** opens a fresh page (the old link stops working); **Remove** (click twice) stops that passkey signing in (Pocket ID says the account is disabled) and the card drops them. `./homelab person` lists the same |
| Photos per person | With Immich running and two people uploading: after the nightly backup (or Backups › **Back up now**), Status has **Photos per person** with each person and their size, matching Immich › Administration › Users › storage used |
| A start page each | With Homepage running and two people added: `./homelab person apps <second person> mealie`. `https://homepage.example.com` shows a tab per person and *Everything*; `…/#<first name>` opens straight on that person's tab with only Mealie; their welcome page (`./homelab person welcome <name>`) links to it |
| Single sign-on | With Pocket ID's admin made and Karakeep running: `./homelab sso setup` lists Karakeep, then "Karakeep signs in with Pocket ID"; Karakeep's sign-in page has **Sign in with Pocket ID**, and a passkey signs in. Pocket ID › OIDC Clients lists `karakeep`. For Immich it prints the steps; after them, Immich's login has the Pocket ID button. With Vikunja running, `./homelab sso setup` connects it too: its sign-in page has **Pocket ID**, and a passkey signs in |
| Database upgrade | With Ghostfolio installed and some holdings: `./homelab db upgrade ghostfolio-db` shows the plan, then dumps, archives, and ends with "runs PostgreSQL 18 with the data loaded"; Ghostfolio signs in and shows the holdings; `.env` has `GHOSTFOLIO_DB_VERSION=18` |
| Release channels | Settings › `UPDATE_CHANNEL` = `stable`, Save: `./homelab upgrade` says there is no release on the stable channel yet (until the first tag), and goes back to listing `main`'s changes with `testing`. Once a `v*` release is published, Setup's app card names its version, and **Update** and the menu bar's *Update ready* follow it instead of the latest build |
| Upgrade and go back | With a change waiting: Setup's update card has **What is new** with the CHANGELOG entries; **Update**. Beside the version, *go back to …* (click twice) returns the folder to the earlier commit, and `./homelab upgrade` offers the update again |
| Undo an update | `./homelab update vikunja`: the log starts with its database dump. Within 15 minutes (or `./homelab watchdog`) `docker images homelab-rollback/*` lists `vikunja` when the image changed, and Status shows the rewind button on Vikunja. Click it: Vikunja restarts on the earlier image, shows *updates held*, and `./homelab updates` lists it as held; `./homelab updates release vikunja` clears it |
| @arr and qBittorrent | Install with "Connect the apps for me", set `QBITTORRENT_PASSWORD`, run `./homelab wire --apply`: Prowlarr › Settings › Apps and Sonarr › Settings › Download Clients are filled in (ISSUE-0015) |
| Export | `./homelab export --apply` (with Paperless and Immich running): `export-<date>/README.html` lists Tables, Documents, Photos, and Passwords. A CSV under `tables/moneymatter-db` opens in Numbers with the transactions; `documents/manifest.json` has the documents' tags; `photos/albums.csv` lists an album you made with its photos' paths, and each path opens |
| Move to another machine | Only with a second machine to hand: Backups › **Move out…** (click twice), save the file on a drive: the log ends with the steps for the new machine, and the old one's apps are stopped. On the new one, install Homelab Wizard, **Set it up for me**, then Backups › **Move in…** and choose the file: it stops if the media drive is not plugged in, and after it is, ends with "moved in"; Status is green and a photo, a password, and a document open. (`./homelab move out --to <drive>/homelab.tar` and `move in` do the same) |
| Uninstall (last, in a copy) | In a copy of the homelab folder: `./homelab uninstall` shows the plan and changes nothing; `--apply` removes the containers, `./homelab schedule status` lists no jobs, and the menu bar item does not come back after signing out and in. `data/` and `.env` are still there; **Start the homelab** brings it all back |
| Baikal | Setup runs at `https://dav.example.com`; add a user, then an iPhone's CalDAV account syncs a new event both ways |
| Pocket ID | `https://id.example.com/setup` makes the admin with a passkey (Face ID or Touch ID) |
| Wallos, Memos, Homebox | Each opens at its address (`subscriptions`, `notes`, `inventory`); the first account is made, and the nightly backup lists a dump for each |
| Changedetection.io | Watch a page; a test notification to `reminders` reaches the phone after **Set up the alert token** again |
| PairDrop | `https://drop.example.com` on the Mac and a phone: each sees the other and a photo goes across |
| PsiTransfer | Upload with the upload password; the link downloads on another device and stops working after its expiry |
| RomM | With a game you own in `games/roms/<platform>` on the media drive, **Scan** finds it, and an older console's game plays in the browser |
| Dawarich | After the first start's migrations, the demo sign-in works and its password changes; a Google Takeout or GPX import finishes, and the day shows on the map |
| Docmost | The first visit makes the workspace and its owner; a page with an image survives `./homelab compose docmost restart docmost`, and Settings › Members shows an invite link |
| Ghostfolio | **Get started** makes the admin and shows a security token; an imported CSV lists the holdings |
| Your own app | Choose stacks › **Add your own app** with a small image (for example `traefik/whoami`): it installs, shows in Status, and removing it leaves nothing behind |

## 8. After a few days

Once everything has run without trouble: Status › More… › **Clean up old containers** (or `./homelab cleanup`, then `./homelab cleanup --volumes`). Delete the older setup's folders only when you are sure.

## A newcomer's first run

For handing it to someone who is not technical (the 1.0 test), on an M1 MacBook Air with 8 GB. Watch without helping, and note every place they stop, hesitate, or ask; each becomes its own fix.

**What they meet, in Home mode** (counted in October 2026 against the code, before a real run):

| # | Step | Who does it | Friction |
|---|---|---|---|
| 1 | Install OrbStack: the website's download, drag it to Applications, open it, approve its helper with the Mac's password | Them | Four actions and a password prompt; the app's **Open the install guide** only opens the page (an **Install OrbStack** button is next, once it can be tried on a Mac) |
| 2 | Install Homelab Wizard: a Terminal line, or the download and **Open Anyway** in System Settings | Them | The unsigned-app warning, until the Developer ID |
| 3 | **Set it up for me** | App | None |
| 4 | OrbStack is running | App checks | None once OrbStack is open |
| 5 | **Start the homelab** | App | A long first download |
| 6 | This laptop stays plugged in and open | App checks | A sentence to read (new) |
| 7 | **Set up the addresses**: sign in to Tailscale in the browser, then turn on HTTPS Certificates in its admin console | Them | An account, and a toggle on a website the app cannot reach without an API key |
| 8 | Alerts on the phone: the ntfy app, a server, a user, and a password copied from Settings | Them | The most typing of any step |
| 9 | **Install the jobs** | App | macOS shows *Background items added* (expected) |
| 10 | Tailscale on phones and computers | Them | An app per device, the same account |
| 11, 12 | Password manager account and two-step sign-in, once Passwords is picked | Them | Accounts and an authenticator app |
| later | Backups (where they go, the jobs) and the outside check (healthchecks.io) | Them | **Can wait a week** now: not counted until then |

Removed in this pass: the router's DHCP reservation (Home mode does not need it), and backups and healthchecks.io on day one. Added: the laptop step, and the install plan's memory warning (the small baseline with every *Start here* pick uses about 2.2 GB of the 4 GB an 8 GB Mac has room for).

**What only a real Mac can prove** (tonight, and on the Air):

| Check | You should see |
|---|---|
| Setup on a fresh account (or after `rm data/setup.json`) | No *This machine keeps its address* in Home mode; backups and the outside check under **Can wait a week**; the Setup tab's number leaves them out |
| On the MacBook Air: unplug, **Check again**, plug in, **Check again** | The laptop step goes to *plug it in*, then ✓ |
| The lid closed for five minutes on the charger, no display | The phone loses the apps (expected); open, they come back within a minute |
| Choose stacks with every *Start here* pick on the Air | No memory warning; `./homelab doctor`'s memory line after a day stays under 4 GB |
| Each prompt macOS shows during the first run (OrbStack's helper, *Background items added*, notifications) | Note each one and whether the person understood it |

## Proven every night

Before a step reaches this page, CI tries it against a real Docker Engine on a Linux runner every night (`.github/workflows/nightly.yml`, the tests in `test/realdocker`), and on each pull request that changes the catalog: ntfy, Vaultwarden, Paperless with its PostgreSQL, and Nginx Proxy Manager installed; `doctor`; the alert token made and a test alert read back; data put into each app through its own API; the nightly backup; the watchdog bringing back an app that hung and one whose container was removed, with its alert in ntfy; an update and its rollback; then the homelab moved out, wiped, moved in, and the data read back. A failed night opens an issue with the run's diagnostics report. What it cannot reach (a real Mac, Windows, the Steam Machine, the phone, Proton Drive) stays in the lists below.

## Waiting for real hardware

What only the Mac, the Windows PC, or the Steam Machine can prove: each row of the parity table in [Host](<Host.md#the-same-on-every-system>) that CI shows only against fakes, and each change made since without the machine to run it on. Work down a machine's list in one session; each step says what to do and what you should see. When a step does not match, make a report (`homelab report`), note the step's number, and go on to the next. Tick the row in Host when a step passes.

### The Mac

| # | Do | You should see |
|---|---|---|
| M1 | Steps 1–6 of this page | Each as written; this closes the first-install item of the [Roadmap](<Roadmap.md#still-open-from-the-first-months>) |
| M2 | Unplug the MacBook (or pull the Mac mini's power cable on a UPS), wait 2 minutes, `pmset -g assertions` | No `PreventUserIdleSystemSleep` from `caffeinate` while on battery; plugged in again, it is back within a minute |
| M3 | Quit OrbStack, then `launchctl kickstart -k gui/$(id -u)/com.homelab.agent` | OrbStack opens by itself within a minute and the apps start |
| M4 | Stop Jellyfin, restart the Mac, log in | Jellyfin opens by itself after the drives are there (`scripts/logs/startup.log` says "opened Jellyfin") |
| M5 | `./homelab notify test` with the app closed | A notification titled *Homelab* in Notification Center, and the same on the phone through ntfy |
| M6 | With a domain: Setup › **This Mac finds its apps by name** | The password window says "Homelab needs to look up your … apps"; `cat /etc/resolver/<domain>` shows the address |
| M7 | `brew install smartmontools`, then `./homelab doctor` | A drive health line for the Mac's disk and the media drive |
| M8 | With the tray icon running and an older build of the app installed: Settings › **Update now** | The app quits and opens again on the new build within a minute (Settings shows its version), the tray icon comes back, and `~/Library/Caches/Homelab Wizard/update` is empty |
| M9 | From the menu bar item: **Update apps now** with an app behind | The item's title names the step and the app ("Updating Vikunja · 1 of 2: Vikunja downloading · 54%"), then "done" with the time |
| M10 | A camera with an RTSP stream added to Frigate (its note, Setup), then Home Assistant paired (Pairing) | Frigate shows the camera live and lists a person who walks past; Home Assistant has the camera and a person sensor that turns on |

### The Windows PC

| # | Do | You should see |
|---|---|---|
| W1 | [ISSUE-0013](<Known Issues.md#issue-0013-windows-host-profile-not-yet-run-on-the-windows-pc>)'s Verify and Also check lists, and [ISSUE-0021](<Known Issues.md#issue-0021-installing-and-updating-the-app-on-windows-and-linux-not-yet-run-everywhere>)'s | Each as written |
| W2 | On a laptop: unplug it, wait 2 minutes, then in an administrator's PowerShell `powercfg /requests` | No `homelab` request under SYSTEM while on battery; plugged in again, it is back within a minute |
| W3 | Turn off Docker Desktop's *Start when you sign in*, sign out and back in | Docker Desktop opens by itself within a minute of signing in, and `scripts\logs\startup.log` shows the apps starting |
| W4 | `homelab.cmd notify test` | A toast from *Homelab Wizard* titled *Homelab test*, and Settings › System › Notifications lists *Homelab Wizard* |
| W5 | Choose stacks with Immich and Paperless picked | The plan's memory line names the PC's memory, and warns when the picks do not fit |
| W6 | A new `.env` (`homelab.cmd up` in a fresh folder), then `findstr TZ .env` | The PC's time zone in its IANA form (for example `TZ=Europe/Berlin` for *W. Europe Standard Time*) |
| W7 | With a domain: Setup › **This PC finds its apps by name** | One approval prompt; `Get-DnsClientNrptRule` lists the domain with the address |
| W8 | Install smartmontools from smartmontools.org, then `homelab.cmd doctor` | Doctor finds `smartctl` and lists each drive: without administrator rights each says smartctl's own reason (no permission); in an administrator's terminal, a health line per drive |
| W9 | From the tray icon: **Update apps now** with an app behind | The item's title names the step and the app as it goes, then "done" with the time |
| W10 | The same with Frigate on the PC, and with an NVIDIA card: the `-tensorrt` image and its detector (Frigate's note) | The camera is live and a person is listed; with the card, Frigate's System page shows the detector on the GPU |

### The Steam Machine

| # | Do | You should see |
|---|---|---|
| S1 | [ISSUE-0012](<Known Issues.md#issue-0012-linux-host-profile-not-yet-run-on-the-steam-machine>)'s Verify and Also check lists, and [ISSUE-0014](<Known Issues.md#issue-0014-release-builds-not-yet-opened-on-a-mac-a-windows-pc-or-steamos>)'s | Each as written |
| S2 | In desktop mode: the tray icon after a reboot | It appears once in Plasma's tray, its menu opens, and **Open Homelab Wizard** opens the app |
| S3 | `./homelab notify test` | A Plasma notification titled *Homelab* (if `notify-send` is missing, note it) |
| S4 | System Settings › Power Management › *Suspend session* after 15 minutes on AC, then `./homelab doctor` | Doctor says the machine is set to sleep after 15 minutes, and that the awake job keeps it up while plugged in |
| S5 | `systemctl is-active systemd-resolved; ls /run/systemd/resolve` | Note both: they decide whether *This machine finds its apps by name* can work here |
| S6 | `which smartctl` | Note whether SteamOS has it |
| S7 | A drive or SD card plugged in, then Setup's backup step | It offers `/run/media/deck/<name>` |
| S8 | Switch to Game Mode for an hour, then back | The apps kept answering (`./homelab status`), and the agent's watchdog ran (`scripts/logs/watchdog.log`) |
| S9 | The same with Frigate on the Steam Machine, then the `-rocm` image with `/dev/dri` passed through | The camera is live and a person is listed; with `-rocm`, Frigate's System page shows the detector on the GPU |

## After testing

Tick what worked in [Known Issues](<Known Issues.md>) (the "To verify" items) and in the [To-do](<To-do.md>), and make a report for anything that did not.
