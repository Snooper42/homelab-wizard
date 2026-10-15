---
version: 0.1.0-alpha
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
git checkout main
git pull
./homelab version
./homelab doctor
```

- `version` prints the repository's version; the first run after a pull builds the CLI ("Building the homelab CLI...").
- From now on, `./homelab upgrade` (or Setup › **Get the update** in the app) replaces the `git pull`: it lists what changed and runs `up` afterwards.
- `doctor` ends without ✗ lines. Expected ! warnings: a VPN if one is on, and settings you have not filled in yet.
- After this update, `upgrade` moves the containers into their category projects (`homelab migrate`, a backup first). OrbStack then lists them grouped as homelab_network, homelab_security, homelab_system, homelab_media, and so on, every app keeps its data and settings, and `doctor` no longer mentions `homelab_core`.
- With `brew install smartmontools` done, `doctor` lists each drive under **Drive health** as passed (the Mac's own SSD at least; a USB drive may say it gives no report).

## 2. The desktop app

1. Download the newest build: GitHub › Actions › Release › the latest green run › Artifacts › **macos**. Unzip it and open the DMG.
2. Drag **Homelab Wizard** to Applications, then clear the download flag once (the build is not signed yet):

   ```sh
   xattr -dr com.apple.quarantine "/Applications/Homelab Wizard.app"
   ```

3. Open it from Applications.

| Check | You should see |
|---|---|
| First screen | Setup, with the number of steps left beside it in the sidebar, unless every step is done |
| Setup › host details | macOS, OrbStack with its engine version, the homelab folder `~/Homelab`, the version, and **Disk space**: a green line for the Mac's disk (homelab folder, backups) and one for the media drive (photos, media, downloads), each with its free space. `./homelab doctor` lists the same under Disk space |
| Setup › Version | "✓ up to date" after the pull, and "build" with the commit this app was made from. Whenever GitHub has newer changes, it says how many, and a card lists them with **Get the update**. After a pull that changed the app, a card says a newer Homelab Wizard is ready |
| Window and menus | The window buttons sit at the top of the sidebar, which shows the desktop through it (as in Finder). The menu bar has View (Choose Stacks to Setup on ⌘1 to ⌘4, Settings… on ⌘,, Reload on ⌘R) and Help, and Homelab Wizard › About shows the version. Buttons show the arrow, not a hand; dragging the sidebar or the strip above a screen moves the window |
| Menu bar | One house icon. Its menu lists the apps' health and the yearly savings (and *Update ready* once GitHub has newer changes). Opening the app again from it brings the same window forward |
| Choose stacks › tick Speedtest Tracker › Install | Each step ticks off; **Details** shows Compose pulling and starting. Then it is listed under Started with a link |
| Choose stacks › type "spotify" in the search box | **Add more** opens by itself; Navidrome and Feishin only |
| Choose stacks › click **Music** under Start here | The card is marked ✓, Navidrome and Feishin are ticked under Add more, and the plan lists them; clicking it again unticks both |
| Choose stacks › Presets under Add more | Only the bundles and the stack folders (Immich, Paperless-ngx, MoneyMatter, …), not one per category |
| Settings › `HELPER_EMAIL` (your own address), then Setup › Make a diagnostics report › **Email it to my helper** | Mail opens a message to you, and Finder shows the report to attach |
| Setup › Make a diagnostics report › Show in Finder | Finder opens with the new report selected |
| Quit OrbStack, then look at Setup | A card *Start OrbStack* with **Open OrbStack**; clicking it starts OrbStack and the card goes away by itself within a few seconds of it answering |
| Quit while nothing runs | The app quits; the menu bar icon stays |
| Status | Four tiles at the top (running, needs a look, savings, nightly updates) and every baseline app with a green dot |
| Choose stacks › tick Memos › Install (after Set up the domain has run) | The install log ends with `domain setup --auto` and `https://notes.example.com`, which opens with a padlock without running anything else |
| `./homelab stop navidrome`, then Status | **Fix it** appears; it shows the plan (start the baseline apps that are down), and **Fix these** brings Navidrome back |
| Status › an app's row › the log icon | Its last 200 lines; **Open Dozzle** appears when Dozzle runs |
| Status › Speedtest Tracker › restart icon | The panel streams the restart and ends with "restart done"; the dot stays green |
| Status › an app's row | "up 3 days" (or however long) under each running app; a *restarted N×* badge only on one Docker had to restart |
| Backups › **Recovery kit** | The browser opens a page to print: the backup folder (`BACKUP_DESTINATION`), each backup job and what it holds, a blank line for the Secrets passphrase, the accounts, the apps that run, and the restore steps. No password or key appears on it; `recovery-kit.html` is in the homelab folder |
| Backups › Off-site jobs | Beside each job's last run, "next in N hours" (hover for the exact time); a job with no schedule shows none |

If the app says it cannot find the homelab folder, use **Choose…** beside Homelab folder on Setup and pick `~/Homelab`. To try the new-machine path without touching `~/Homelab`, open the app on another Mac user account (or rename the folder for a moment): Setup offers **Set it up for me**, which makes `~/Homelab` with `.homelab-kit.json` in it, and `./homelab kit` names the build.

## 3. Setup, in order

Work down the Setup screen (or `./homelab setup` in Terminal). After each step, **Check again** should turn it ✓.

| Step | What to do | You should see |
|---|---|---|
| Home DNS answers (AdGuard Home) | **Set up AdGuard** (or, if you already made a login in AdGuard's wizard, put it in Settings › `ADGUARD_USER`, `ADGUARD_PASSWORD` › Save) | ✓, and `ADGUARD_PASSWORD` is filled in |
| Cloudflare API token | Create it with the three permissions the step lists; paste it in Settings › `CLOUDFLARE_API_TOKEN`, Save, then **Test** beside it | ✓, and the test says the token can read example.com |
| Addresses and certificate | **Set up the domain**; the first time takes a few minutes (the certificate) | `https://npm.example.com` opens with a padlock, on the Mac and on your phone over Wi-Fi |
| Password manager account | **Open sign-ups for 10 minutes**, create the accounts at `https://passwords.example.com`, then close sign-ups (or wait) | The countdown, then "sign-ups closed"; a new sign-up is refused afterwards |
| Two-step sign-in | Each Vaultwarden account: Settings › Security › Two-step login (authenticator app). Nginx Proxy Manager: add a personal administrator under Users, then its avatar menu › Two-Factor Auth. Tick **Done** | Signing in again asks for the code; **Set up the domain** still works (it uses `NPM_API_EMAIL`, which stays without it) |
| Access away from home | Create the tunnel in Cloudflare Zero Trust, paste its token in Settings › `TUNNEL_TOKEN`, **Start the tunnel** | On your phone with Wi-Fi off, `https://passwords.example.com` opens |
| Backups leave this machine | One button per place found: **Use Proton Drive** (it makes `Homelab Backups` in the Proton Drive folder), and **Use iCloud Drive** or **Use the … drive** where those exist; the media drive is not offered. For another folder, use Settings › `BACKUP_DESTINATION` › **Choose…** and Save instead. Then **Test** beside the setting | ✓, and the test wrote and removed a file there |
| Backup jobs in Duplicati | **Create the backup jobs**, then Settings › `DUPLICATI_SECRETS_PASSPHRASE` › **Copy** into Vaultwarden, and onto the recovery kit | The plan, then (recreating Duplicati first if it still had an older folder) each job created and the first runs queued; Duplicati shows the jobs; their files appear in the Proton Drive web app (ISSUE-0003); Backups › Off-site jobs shows each ran, and the step turns ✓ |
| Alerts on the phone | **Set up the alert token** (it also makes the app's read token and the phone's login), in the phone's ntfy app add the server with user `phone` and Settings › `NTFY_PHONE_PASSWORD` › **Copy**, subscribe to the topics, add the alert address to Uptime Kuma ([Monitoring](<Monitoring.md>); Duplicati gets it from this step), then **Set up the domain** again so ntfy is published | Settings › **Test** passes beside `NTFY_PUBLISH_TOKEN`, `NTFY_READ_TOKEN`, and `NTFY_PHONE_PASSWORD`; `./homelab notify test` reaches the phone, also on mobile data (ISSUE-0011), and shows under Recent alerts on Status and in the menu bar |
| Scheduled jobs | **Install the jobs** | `./homelab schedule status` lists five jobs, loaded (the awake and serve jobs say *always*); `pmset -g assertions` lists caffeinate preventing sleep, and `doctor` says the awake job keeps the Mac up |
| Alerts when this machine is down | A healthchecks.io check (15 minutes, 15 minutes grace); its ping URL in Settings › `HEARTBEAT_URL` | After the next watchdog run (up to 15 minutes) the check turns green |

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
- `./homelab digest --send` reaches the phone as *Homelab this week*, listing what needs a look (expect the restore test until step 6). From then on it arrives each Sunday morning.
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
- The ban test in [Runbooks](<Runbooks.md>) returns 403 on the phone, then loads again once lifted. Within a minute the app's Status › **Protection** lists it as a manual ban.
- Open any app from a phone on Wi-Fi, then check which address the proxy logged (ISSUE-0002):

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
| Tailscale | With an auth key in Settings: install, approve the route in Tailscale's admin, then `./homelab doctor` says the route is approved |
| Small baseline | In a folder made with **Set it up for me**: `.env` has `HOMELAB_BASELINE=small` and an empty `HOMELAB_DOMAIN`, Start the homelab starts only Watchtower, Duplicati, ntfy, and Uptime Kuma, and Setup shows no password-manager step until Passwords is installed |
| Home mode | In a copy with `HOMELAB_DOMAIN=` and HTTPS Certificates on in Tailscale's DNS settings: `./homelab tailnet setup` lists `https://homelab.<tailnet>.ts.net:<port>` addresses, Vaultwarden's opens on the phone with Tailscale on, and Setup shows **Addresses on your tailnet** instead of the domain steps |
| Ad blocking (Home mode) | After Home mode works: Choose stacks › **Ad blocking** › Install. The install log ends with the tailnet address to use; in the Tailscale admin console › DNS add it as a custom nameserver and turn on Override DNS servers. On the phone with Tailscale on and Wi-Fi off, `https://doubleclick.net` does not open, and AdGuard's dashboard counts the query. Setup shows **Ad blocking on every device** |
| Phone companion | Settings › Phones › name it › **Pair a phone**, and scan the QR code with the phone's camera (or `./homelab phone pair --name "My iPhone"` and open the address it prints); **Pair** | The phone shows Status and Backups with the same dots as the Mac; Safari › Share › Add to Home Screen opens it full screen. Restart, Stop, and Back up now are missing until `./homelab phone allow <id>`; `./homelab phone list` shows when it was last seen; `./homelab phone remove <id>` (or **Remove** in Settings › Phones) sends it back to the pairing form. **Send a report** on the phone opens the share sheet with `homelab-report.txt`. With mobile data and Tailscale off, the address does not open |
| Add a person | `./homelab person add "Test Person" --email you+test@example.com`: it ends with the welcome page's path. Open it: the sign-in link opens Pocket ID on a phone and adds a passkey; the page lists the running apps with their addresses and phone apps. `./homelab person remove test` stops that passkey signing in (Pocket ID says the account is disabled) |
| Photos per person | With Immich running and two people uploading: after the nightly backup (or Backups › **Back up now**), Status has **Photos per person** with each person and their size, matching Immich › Administration › Users › storage used |
| A start page each | With Homepage running and two people added: `./homelab person apps <second person> mealie`. `https://homepage.example.com` shows a tab per person and *Everything*; `…/#<first name>` opens straight on that person's tab with only Mealie; their welcome page (`./homelab person welcome <name>`) links to it |
| Single sign-on | With Pocket ID's admin made and Karakeep running: `./homelab sso setup` lists Karakeep, then "Karakeep signs in with Pocket ID"; Karakeep's sign-in page has **Sign in with Pocket ID**, and a passkey signs in. Pocket ID › OIDC Clients lists `karakeep`. For Immich it prints the steps; after them, Immich's login has the Pocket ID button. With Vikunja running, `./homelab sso setup` connects it too: its sign-in page has **Pocket ID**, and a passkey signs in |
| Database upgrade | With Ghostfolio installed and some holdings: `./homelab db upgrade ghostfolio-db` shows the plan, then dumps, archives, and ends with "runs PostgreSQL 18 with the data loaded"; Ghostfolio signs in and shows the holdings; `.env` has `GHOSTFOLIO_DB_VERSION=18` |
| Release channels | Settings › `UPDATE_CHANNEL` = `stable`, Save: `./homelab upgrade` says there is no release on the stable channel yet (until the first tag), and goes back to listing `main`'s changes with `testing` |
| Upgrade and go back | With a change waiting: Setup's update card has **What is new** with the CHANGELOG entries; **Get the update**. Beside the version, *go back to …* (click twice) returns the folder to the earlier commit, and `./homelab upgrade` offers the update again |
| Undo an update | `./homelab update vikunja`: the log starts with its database dump. Within 15 minutes (or `./homelab watchdog`) `docker images homelab-rollback/*` lists `vikunja` when the image changed, and Status shows the rewind button on Vikunja. Click it: Vikunja restarts on the earlier image, shows *updates held*, and `./homelab updates` lists it as held; `./homelab updates release vikunja` clears it |
| @arr and qBittorrent | Install with "Connect the apps for me", set `QBITTORRENT_PASSWORD`, run `./homelab wire --apply`: Prowlarr › Settings › Apps and Sonarr › Settings › Download Clients are filled in (ISSUE-0015) |
| Export | `./homelab export --apply` (with Paperless and Immich running): `export-<date>/README.html` lists Tables, Documents, Photos, and Passwords. A CSV under `tables/moneymatter-db` opens in Numbers with the transactions; `documents/manifest.json` has the documents' tags; `photos/albums.csv` lists an album you made with its photos' paths, and each path opens |
| Move to another machine | Only with a second machine to hand: `./homelab move out --to <drive>/homelab.tar` ends with the steps for the new machine, and the old one's apps are stopped. On the new one, in a new homelab folder: `./homelab move in <drive>/homelab.tar` stops if the media drive is not plugged in, and after it is, ends with "moved in"; Status is green and a photo, a password, and a document open |
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

## After testing

Tick what worked in [Known Issues](<Known Issues.md>) (the "To verify" items) and in the [To-do](<To-do.md>), and make a report for anything that did not.
