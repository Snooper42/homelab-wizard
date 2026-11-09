# Homelab: native iPhone and iPad client

A SwiftUI client for the Homelab Wizard phone companion
(`homelab serve`, port 8099). This folder holds only source files; the
scripts below make the Xcode project for you.

## Start here

You need a Mac with full Xcode (opened once, with your Apple ID added under
Xcode › Settings › Apple Accounts; a free one is enough) and this repository
cloned. Replace `com.yourname` with your own reverse-domain prefix and keep
using the same one.

On the Mac itself, Homelab Wizard (the desktop app) is the way in: the
native Mac version of this app was removed in November 2026.

**The iPhone app.** Plug the iPhone in, unlock it, tap Trust, and turn on
Settings › Privacy & Security › Developer Mode once. Check the phone's
address, then build, install, and pair (scan the QR code it shows from the
app). With a free Apple ID, run it again within 7 days to keep the app
working:

```bash
./apple-client/scripts/phone-address.sh
```

```bash
./apple-client/scripts/run-on-iphone.sh com.yourname
```

**Paired devices**: list them, or remove ones that were never used:

```bash
./apple-client/scripts/phones.sh tidy
```

**The widget** (optional): "All well" or how many apps need a look, on the
iPhone's Home Screen. Build with it by putting `HOMELAB_WIDGET=1` in front
of the run script, then turn it on in the app
under Settings › This Device. It needs an App Group, which a free Apple ID
may not be able to sign; if the build stops there, run the script again
without it.

Each script says what's wrong and what to do when something isn't ready.
The rest of this README is the detail.

```
apple-client/
├── Shared/
│   ├── App/            HomelabClientApp.swift: @main, the Homelab menu (⌘R, ⌘L); AppCommands.swift: the App menu (⌥⌘S start, ⌥⌘R restart, ⌥⌘. stop, ⌥⌘L logs)
│   ├── Models/         Wire types (Status, AppStatus, EngineChange, …), AppAction, PairingCode, ServerEndpoint, DeviceCredential
│   ├── ViewModels/     AppCoordinator (lock state machine), PairingViewModel, DashboardViewModel, AppActionsViewModel
│   ├── Views/          AppCoordinatorView, PairingView, LockScreenView, DashboardView, AppDetailView, Theme (colours, pills, the app mark), Design (cards, logo circles, round buttons, wallet cards, the ring), Components/
│   ├── Resources/      PayeeLogos.json: the payee logos and their matching rules, made from the computer's by scripts/make-payee-logos.mjs
│   ├── Assets.xcassets AccentColor, so the system's own controls are violet too
│   ├── Services/       APIClient, LiveEventManager, SSEParser, APIError, JSONCoding
│   └── Security/       KeychainManager, BiometricAuthManager, SecureLog
├── Tests/              Swift Testing unit tests: parsing, validation, lossless edits, and the lock state machine (with fake keychain and authentication)
└── scripts/            make-xcode-project.sh (the Xcode project, iPhone and iPad), run-on-iphone.sh, phone-address.sh (checks the phone's https address), phones.sh (list or remove paired devices), test-scripts.sh (runs them all against stand-ins for Xcode, the iPhone and the homelab; CI runs it)
```

## Where it fits

Three ways into the same homelab, in two roles:

- **Homelab Wizard**, the desktop app on the Mac that runs the homelab, is where it's *managed*: setup, Choose apps, installing apps, settings, Tidy Up, and pairing phones.
- **This app** is a remote control for *keeping an eye on it* from an iPhone or iPad: status, alerts, backups, Finances, and quick changes behind Face ID or Touch ID. It does no setup, on purpose.
- **The phone web page** (`homelab serve`, built from `web/`) is the same remote control in a browser. It stays a web page: it works on any phone (Android, a partner's, a visitor's) with no install and no Apple account. With a free Apple ID this app can't be shared, and lapses after 7 days.

As main adds phone-facing features to the companion, they're mirrored here (the `main #…` notes below).

## What it does

It's laid out as Homelab Wizard is on the computer: the same screens, in the same order and with the same names (Status, Backups, Finances, Setup, Settings), in a sidebar on the iPad with Homelab Wizard's name atop it, and as tabs on iPhone. ⌘2 to ⌘6 pick them, the same numbers as the computer's. Choose apps and Tidy Up are on the computer only, since a phone can't reach them yet.

| | iPhone | iPad |
|---|---|---|
| **Pairing** | The code, the pasted pairing link, or a scan of the computer's QR code. Optionally as a wall screen (look-only for good). | The code or the pasted link |
| **Away from home** (ADR-0023) | With the computer set up for it (Setup › Reach Finances away from home) and paired at home afterwards: a read that can't reach home (Status, an app's page, Finances to look at) goes through the Cloudflare tunnel instead, sealed end to end with a key agreed at pairing (`TunnelSeal`, tested against the computer's own vectors), with the household's service token for Cloudflare Access. Home is tried first, for 4 seconds; after the tunnel answered, it goes first for 5 minutes, or until the phone's network changes (Wi-Fi to cellular, home again, a VPN on or off: `NetworkKind`, never the Wi-Fi's name), when home is tried first again. Changes, Settings, and live updates wait until home. **Away mode:** when neither home nor the tunnel answers (Cloudflare down, say) and nothing was read, Status lists just the apps on the internet (the catalog's `public` ones with an https address), as last read and kept in the Keychain beside the pairing (this phone only, behind the app's Face ID), each with whether its own address answers and Open; everything else comes back by itself when the computer answers. | The same |
| **Locking** | Face ID / Touch ID / passcode at launch and on every return; an opaque cover in the app switcher | The same |
| **Status** | On iPhone it opens with a card: a ring of the apps running out of all of them, and the one that needs a look with its Start (or Restart) and Logs, or "All well" and the night's line; then four tiles: Backups (opens the Backups tab), Saved, Updates and Checks. The floating glass tab bar shrinks as you scroll (iOS 26 and later). Then the live list, searchable by name, grouped as the computer's Status: Needs a look first, then the pinned apps, then each category (Media, Photos, …) and Other. A group where all is fine starts folded, its apps' names on one line; what you open or fold is remembered (names only). Each row has its icon, "N% up" and a dot for what changed since you looked; on iPhone those apps are also listed together at the top, and Mark as Seen clears the dots. An app the watchdog stopped because Docker kept restarting it (main #427) reads "Stopped: it restarted 5 times in an hour", in red, and counts as needing a look. One the battery saver paused reads "Paused on battery", and one waiting for its drive "Waiting for the Media drive", both in orange. Start the stopped leaves out all of these, as the computer's Start them does. Needs a look counts as the computer's does: unwell, not answering, missing, or stopped when nobody stopped it on purpose. Rows use the computer's words for each state. The overnight line in the morning. Each state has its own shape as well as colour: a circle when up, a triangle to look at, a cross when down (main #449). With VoiceOver, what changes is said as it changes, in the row's words ("Vikunja and Immich: Restarting", main #451). Atop every other screen, one line says "All well", or the one thing that needs you (main #470). A stopped app nobody stopped says when, and why when Docker knows ("Stopped at 3:12 AM: it ran out of memory"); a crash is a cross (main #474). | The same, in a three-column split view whose sidebar keeps its place, plus a menu bar item whose Needs a look list opens on the app's page, and how many need a look on the Dock icon while unlocked |
| **An app's page** | What's wrong, its actions, its week (uptime and outages), about it (catalog, and another app here that does much the same job, main #438), its backup (the last nightly run, its copy, the restore test, and Back up now), its updates (when it was last updated, and whether its updates are held), where it can be reached from (home, tailnet, or the internet through the Cloudflare Tunnel), details, why it last started, addresses, logs (filter, errors and warnings in colour, Problems Only, copy with ⇧⌘C), and its settings (nightly updates, alerts, pin) Under Nightly updates, Only on Sundays (or the days set on the computer, "Only on Saturdays and Sundays"), main #457.. Its log can Follow: read again every 4 seconds while open, at the newest line, until switched off, closed, locked, or a read fails | The same, with an App menu (⌥⌘S/R/./L) |
| **Links into the app** (`homelab://`) | `homelab://status`, `homelab://app/<id>`, `homelab://app/<id>?do=restart`, `start`, `stop` or `logs`, `homelab://backups`, `homelab://finances` and `homelab://finances/<page>` (transactions, budgets, bills, accounts, investments, goals, recurring, spending, inbox, cashflow, review), and `homelab://tidy/inbox` (Status for now: Tidy Up's Inbox is the computer's). The app unlocks as always first. **A link never changes anything by itself:** anyone can send one, so an action link opens the app's page with the action waiting for one confirming tap, and only on a device allowed changes (then Face ID, as the button). A link names an app by its exact id; anything unknown or malformed opens Status (`DeepLink`). | Not yet (iPhone only) |
| **Changes** (allowed devices, re-authenticated) | Start, Stop (confirmed, Undo), Restart, Stop for a while, Roll back, for one app or a whole list; a long press on a row opens its menu, as the phone page's does since main #447. A change waits its turn behind the computer's other jobs (main #425). | The same, plus keyboard shortcuts and a right-click menu |
| **Status, below the apps** | The money card, watchdog, protection (with what CrowdSec stopped today, also on the proxy's and CrowdSec's own pages, main #430), alerts, savings (with what the apps have saved so far, month by month, main #437). When the watchdog has alerted that memory is nearly full, its card names the three biggest apps, with Stop (main #458); a failing check whose alerts are snoozed on the computer says until when (main #469) | The same, below the app list, as on the computer |
| **Backups** | It opens with a card: a ring of the copies that are fresh, when the last backup ran and where to, and Back Up Now and Test a Restore. Then each app's copy, grouped as on the computer (stale, up to date, paused, not copied yet), beside the night before's, with a warning when one shrank to less than half (main #435), Duplicati's jobs and their last run, restore tests, the vault export; Back up now, Test a restore | Backups in the sidebar |
| **Setup and Settings** | Settings is laid out as the system's own: the homelab on top (what this device may do, with This Device behind it: how it paired, its ID, Unpair), the switches (nightly updates, the lock, the widget) with coloured icon tiles, the homelab's settings a section a row with its icon, then Send a report and About. Setup: what the machine runs, and Look for problems → Fix these. Settings: the homelab's settings (`.env`) as the computer's Settings shows them, by section, searchable, each by its name for people with its key, help and a switch where it's on or off, the everyday ones first; a device allowed changes changes the everyday ones (with Face ID), while a password or token shows only as set, and secrets and the settings the phone connects through are changed on the computer (needs the computer's Homelab Wizard with main #491); nightly updates on or off, a diagnostics report to share, this device (when it paired, and a warning if it paired without encryption), Unpair. What this device may do is read again every 5 minutes and after a failed change, so a phone whose changes were given for a while only (main #455) loses its buttons when they end; one removed on the computer is unpaired within seconds (main #456) | Computer in the sidebar |
| **Finances** (by level) | Its home, as Settings is laid out: checking now and after the next paycheck, net worth with its line over three months and this month's change, then Transactions, Budgets, Bills, Investments, Accounts, Goals and Loans, each one tap away on a page of its own. On Investments, where Finances may be changed, Read Now reads Ghostfolio again and Add a Holding records a buy or a sale there (in an account, or a new one), with Face ID first, from a ticker or name Ghostfolio looks up. Transactions as Wallet shows a card's: checking's card on top, your other accounts as small cards to switch to (each with its logo and balance; not homes, cars or collectibles), then what happened with each payee's logo; one new since you looked has a violet dot until it's reviewed (this phone remembers only an HMAC of each seen transaction's id, under its own key). A transaction's page: its logo big, the amount, the day, what it paid, the account, its category, note (without the bank's own wording, as the computer leaves it out), tags and receipt, Edit, and the other times at that payee. Checking now and after the next paycheck, each opening how it adds up row by row, the computer's own steps (main #482). The plan, budgets, goals, loans, Taken as done, and transactions; money from someone outside the household says who from (main #483). Investments, as Ghostfolio last read them on the computer (main #489): the total, what went in, the gain and this month's change, a row a holding, each opening its worth at each read. Editing: balances, the cushion, budgets, goal targets, what a payment costs, waiting marks, transactions, and receipt photos. | Finances in the sidebar; ⌥⌘N adds a transaction, ⇧⌘H hides amounts on every device |

## The look

A plain iPhone app, as the owner chose: the system's large titles, tab bar, lists and back buttons, SF Pro, light and dark following the phone, with a violet accent. `Shared/Views/Theme.swift` holds the colours, with no other product's name, logo or artwork; `Shared/Views/Design.swift` the pieces every screen is built from:
- **Colours:** a violet accent (also the asset catalog's `AccentColor`, set as the global accent by `make-xcode-project.sh`), a warm grey canvas behind white cards (blue-black behind dark ones), ink and a quieter ink for text, and calm status colours (`success`, `warning`, `caution`, `danger`, `info`). Every colour has a light and a dark value, and as text each keeps at least 4.5:1 contrast on its card.
- **Pieces (Design.swift):** a card (`.card()`, radius 20, a soft two-layer shadow), a round logo circle (`LogoCircle`: 48 pt in lists, 58 pt in a grid, 96 pt on a transaction), a round action button (`RoundActionButton`: Open, Restart, Stop, Logs), a gradient wallet card and its stack (`WalletCard`, `WalletStack`), a ring of running out of total (`ProgressRing`), and a state pill with a dot (`DotPill`). Buttons give a light tap you can feel, and numbers roll from one value to the next.
- **Payee logos:** a payee's brand mark in a circle on the brand's colour, its initials on a colour its name picks when it has no brand, else the icon of its category in the category's colour. The brands are the computer's own (`web/src/finances/logos.ts`: simple-icons, CC0, about 335), and so are the rules that read a bank's wording ("SQ *BLUE BOTTLE", "AMZN MKTP US*2K4") and match it to one. `node apple-client/scripts/make-payee-logos.mjs` (after `npm ci` in the repo's root) writes them to `Shared/Resources/PayeeLogos.json`, with the category colours from `web/dist/style.css`, and writes what the computer's functions answer for a few thousand payees to `Tests/Resources/PayeeVectors.json`; the tests check the app's Swift port answers the same, and CI checks both files are current. Nothing is fetched: which bank you use stays on the phone.
- **Shapes:** states and counts in tinted pills, an app without an icon yet on a soft tile of its state's colour, and rounded bordered buttons.
- **App logos:** every app the homelab knows has its logo in the app itself, on the same rounded tile (`Shared/Assets.xcassets/AppLogos`, one 180 px PNG each), so the lists look alike on every device and nothing is fetched for them. They're from [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) (Apache 2.0; see `licenses/`), credited under Settings › About. An app without one shows the icon the computer kept from the app itself, and failing that its state on a tile. After apps are added to the catalog, `python3 scripts/fetch-app-logos.py` (Pillow and PyYAML) fetches the new ones; a name the logo set spells differently goes in its `ALIASES`.
- **The app mark and icon:** a violet server rack on a white tile (turned inside out in November 2026, as Proton Mail's icon is), on the pairing and lock screens, at launch, and on the app-switcher cover. The app icon is the same, with one mint "running" light. `scripts/make-app-icon.py` (Pillow) draws it from shapes into `Shared/Assets.xcassets/AppIcon.appiconset`: one 1024 px iPhone and iPad icon edge to edge with its iOS 18 dark and tinted variants.

## Check it first, without an Xcode project

On a Mac with **full Xcode** 16 or later installed and selected. The Command Line Tools alone aren't enough: SwiftUI's `@State` and `@Entry` are macros whose plugin ships only with Xcode, so a build with the tools fails on every `@State` with "plugin for module 'SwiftUIMacros' not found". Select Xcode once (`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, then `xcode-select -p` shows a path inside Xcode.app), or prefix a single build with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

```bash
cd apple-client && swift build && swift test
```

To also compile the iOS-only parts (the QR scanner, haptics, keyboard types), build the same package for iOS:

```bash
cd apple-client && xcodebuild -scheme HomelabClient -destination 'generic/platform=iOS' build
```

`Package.swift` builds everything in `Shared/` except the `@main` entry point, in Swift 6 language mode, and runs `Tests/`.

The same checks run on every change on GitHub's Mac runner (`.github/workflows/apple-client.yml`): `swift build` and `swift test`, the package for iOS, the iPhone app from the generated project (unsigned), the screenshots in the simulator, and `scripts/test-scripts.sh`. The package is built and tested for macOS too, where `swift test` runs, though there's no Mac app. A compiler warning fails the job, since in Swift 6 most are data races waiting to become errors.

## Make the Xcode project

**The quickest way (iPhone app):** `apple-client/scripts/run-on-iphone.sh com.yourname`, with the iPhone plugged in, unlocked, trusting this Mac, and Developer Mode on (Settings › Privacy & Security › Developer Mode). It checks the phone's address first (`phone-address.sh`, below), makes the project, builds and signs for that phone (`-allowProvisioningDeviceRegistration` adds it to a free Personal Team), installs and opens it with `devicectl`, and shows a pairing QR code to scan in the app. With a free Apple ID the app works for 7 days; run it again to renew. The first time, the phone has to trust the Apple ID: Settings › General › VPN & Device Management.

**The quick way (Xcode):** `apple-client/scripts/make-xcode-project.sh com.yourname` makes it with XcodeGen (installed with Homebrew if missing), with every setting below, in `~/Developer/HomelabClient-xcode`, outside the repository, pointing at this checkout's `Shared/`. Then pick an iPhone and press ⌘R in Xcode. By hand:

1. In Xcode 16 or later (its SDKs make `View` main-actor isolated, which these sources rely on): **File › New › Project › iOS › App.** Name it `HomelabClient`.
   Choose SwiftUI and Swift, with no Core Data and no SwiftData.
2. Delete the template's `ContentView.swift` and `HomelabClientApp.swift`.
3. Drag `apple-client/Shared` into the project. Choose *Create groups* and
   add it to the app target. Drag `apple-client/Tests` into
   the unit test target.
4. In **Build settings** for the app target:
   - iOS Deployment Target **17.0**. `@Observable`, `ContentUnavailableView` and `sensoryFeedback` need these.
   - Swift Language Version **Swift 6**.
   - On Xcode 26, set **Default Actor Isolation = nonisolated**. The new-project default is MainActor, but these sources mark `@MainActor` explicitly where needed. Under a MainActor default, the model and parser types would be main-actor-bound, and the background stream reader couldn't use them.
5. In **Info** (Info.plist keys):
   - `NSFaceIDUsageDescription`: "Face ID unlocks Homelab, which controls your servers." The Face ID prompt fails without it.
   - `NSCameraUsageDescription` (iOS): "The camera scans the pairing QR code your computer shows." Scanning to pair needs it. The first tap on Scan asks for the camera; if it's refused, the app says how to allow it, and the address and code can still be typed.
   - `NSLocalNetworkUsageDescription`: "Homelab talks to your homelab on the home network." iOS asks before an app reaches a home-network address such as the one `homelab.<your domain>` resolves to; this is the reason the prompt shows. Allow it, or the connection fails.
   - `ITSAppUsesNonExemptEncryption` = NO. The app's only encryption is the system's HTTPS and Keychain, which is exempt, so App Store Connect stops asking at each upload.
6. In **Signing & Capabilities**:
   - Choose a development team.
7. Make sure `Shared/App/PrivacyInfo.xcprivacy` is in the app target. It's the privacy manifest the App Store asks for. It states no tracking and no data collected, and the one required-reason API the app uses: `UserDefaults`, for its own settings (CA92.1). The Swift package leaves it out, as a library has no use for it.

## The day you sign

The app is built for a free Apple ID today (the owner's call, Nov 9, 2026): no push notifications, the widget only where its App Group signs, and a re-install with the cable every 7 days. Everything that needs the paid Apple Developer Program is built, tested, and kept compiling behind one switch. The day you join:

1. **Join** the Apple Developer Program, with the same Apple ID, and note the **team ID** (10 characters, developer.apple.com › Membership).
2. **Make the project signed:** `HOMELAB_SIGNED=1 apple-client/scripts/make-xcode-project.sh com.yourname TEAMID`. It turns on the widget and its App Group (as `HOMELAB_WIDGET=1` does), push notifications (`aps-environment`), and the code under `#if HOMELAB_SIGNED`. Without it, the project is the same as before. `scripts/test-scripts.sh` checks all three ways, and CI builds the signed app on every change, so it keeps compiling.
3. **An APNs key for the computer:** developer.apple.com › Certificates, IDs & Profiles › Keys › **+**, Apple Push Notifications service, download the `.p8` once, and put it in the homelab's Settings (the alerts then go to the app as well as ntfy). *Built when push lands.*
4. **TestFlight for the partner's phone:** Xcode › Product › Archive › Distribute App › TestFlight, then invite them in App Store Connect; their phone installs from the TestFlight app and stops needing the cable.
5. **Export compliance:** the app's sealing for away from home (`TunnelSeal`: Curve25519 and AES-GCM from CryptoKit) is encryption beyond HTTPS, so before the first TestFlight upload set `ITSAppUsesNonExemptEncryption` as App Store Connect's questions lead (standard algorithms from the system, for the app's own data, usually count as exempt) rather than the `NO` the project says today.
6. **Notarise the Mac app** too while signed: `docs/Releasing.md`.

Keep this list current as features that need signing land.

## Pair an iPhone over the home network (no Tailscale)

Tailscale is never needed. The phone needs an **https** address, and the homelab's domain gives it one at home: `https://homelab.<your domain>`, served by Nginx Proxy Manager with the domain's certificate. The Wi-Fi's DNS (AdGuard, or the router's custom DNS) sends that name to the homelab. The companion answers it only from the home network: anything that comes through the Cloudflare tunnel gets a 403, so it is never on the internet. Since the proxy says it reached it over https (`X-Forwarded-Proto`), the companion counts it as encrypted, and the phone may make changes and see Finances.

`apple-client/scripts/phone-address.sh` checks the whole way from the Mac, without changing anything: the domain in `.env`, that the name resolves to a home address, that the certificate is trusted (the iPhone refuses one that isn't, and so does this app), and that the companion answers behind the proxy (401, "not paired", without a token). Each failure says what to look at.

A VPN on the phone (Proton VPN, say) usually brings its own DNS, so `homelab.<your domain>` can't be found while it's on at home. The app then says the address couldn't be found. Let the VPN use the home network (its LAN or custom-DNS setting), or turn it off at home. Away from home, the phone reaches the companion through the Cloudflare tunnel instead, once the computer is set up for it (**Away from home**, above), with the VPN on or off.

Plain `http://<this Mac>:8099` from the phone stays refused: the token would cross the Wi-Fi in readable form.

## Paired devices

`apple-client/scripts/phones.sh` lists the phones and Macs paired with the homelab on this Mac. `phones.sh tidy` removes the ones never used (a pairing that failed half way, for example while the Keychain refused the token), after asking. `phones.sh remove <id>` removes one by its ID, never by name: two devices can share a name, and `homelab phone remove <name>` would take the first. The run scripts make no new code when the device is already paired and in use, so rebuilding doesn't leave duplicates.

## The server contract (read from the Go sources)

The companion on 8099 (`internal/companion/server.go`) doesn't serve the
engine's `/v1/*` routes to devices. It wraps them:

| Need | Request | Notes |
|---|---|---|
| Pair | `POST /api/pair` `{code, name, kiosk}` | Answers `{token, device}`. The code is 8 characters, works once, for 10 minutes. 10 wrong codes lead to a 429. |
| Who am I | `GET /api/me` | `{id, name, canChange, finances}` |
| Status (`/v1/status`) | `POST /api/call/Status` `[]` | `{result: Status, log}`. `LastStatus` answers at once with the last reading. |
| Cards (`/v1/cards`) | `POST /api/call/StatusBoard` `[n, ["watchdog","savings","protection","alerts"]]` | ndjson: `{"result":Status}`, then `{"event":"status:card","data":Card}` for each card |
| Live (`/v1/events`) | `GET /api/events` | SSE: `data: <engine.Change>`, plus a `: still here` heartbeat every 30 s |
| Back up now, Test a restore, Fix | `POST /api/call/Homelab` `["backup"\|"restore-test"\|"fix", "", apply]` | Changes. Fix runs first without `apply` (a plan), then with it |
| App settings | `POST /api/call/SetAppSetting` `[id, "updates"\|"alerts"\|"pinned", bool]` | A change: hold or release updates, watchdog alerts on or off, pin to the top |
| Computer | `Host`, `SetUpdatesPaused` `[bool]` (a change), `Report` (secrets removed by the computer; up to 3 min) | |
| Start / Stop / Restart / Roll back | `POST /api/call/AppAction` `[id, "start"\|"stop"\|"restart"\|"rollback"]`; Stop for a while is `StopUntil` `[id, RFC 3339]` | Needs `canChange` and https. One change from a phone at a time. `{result: null, log}`, or 500 `{error, log}` |

All requests after pairing send `Authorization: Bearer <token>`. The token
is 32 random bytes, base64url-encoded. The **server** keeps only its SHA-256
hash. The client receives the token itself, once.

## Security model

| Threat | Mitigation | Where |
|---|---|---|
| Token sniffed on Wi-Fi | https only, with no exceptions: `ServerEndpoint` rejects any `http://` address (the Mac app's plain http to the companion on the same Mac went with it, and an endpoint it stored reads as corrupt and is deleted). There are no ATS exceptions. The server also makes plain-HTTP pairings from the network look-only. | `ServerEndpoint`, `APIClient` |
| Token sent to the wrong host | The token is stored together with its origin. Every request and response URL is checked against that origin. Redirects are refused, because Foundation would copy the Authorization header onto them. A stored origin goes through the same address rules again when it's read back, and only `/api/` paths are ever built on it. | `DeviceCredential`, `ServerEndpoint`, `APIClient.check`, `RedirectRefusal` |
| Token extracted from the device or backups | Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, `kSecAttrSynchronizable=false`, and the data-protection keychain on macOS. The accessibility attribute is checked again on every read, and a mismatched item is deleted. | `KeychainManager` |
| Stale pairing after a reinstall | Keychain items survive app deletion on iOS, so the first launch after an install deletes them. | `AppCoordinator.purgeKeychainIfFreshInstall` |
| Someone else picks up the unlocked device | Face ID / Touch ID / passcode (`.deviceOwnerAuthentication`) at launch and on every return from the background. A new `LAContext` each time, with no reuse window. With no passcode set, the app refuses to open. | `BiometricAuthManager`, `AppCoordinator` |
| App switcher snapshot | An opaque shield covers the app whenever the scene isn't active (iOS). | `PrivacyShieldView` |
| Data left in memory while locked | Locking stops the SSE stream and clears every reading. Late answers that arrive after the lock are dropped. | `LiveEventManager.clear` |
| Secrets in logs | `os.Logger` only. Tokens and codes are never interpolated. Hosts and server text are `.private`. Error log lines use payload-free `logName`. The secret types print as `<redacted>` even through `print` or `dump`. | `SecureLog`, `APIError.logName` |
| Hostile or broken stream | The SSE and ndjson parsers are bounded (4 MB per event, 8 MB per answer). The token's shape is validated, and server messages are cleaned before display. | `SSEParser`, `APIError.sanitize` |
| A planted pairing QR code | A scan only fills in the address and code, through the same https-only parser as typing. Nothing pairs until the person taps Pair, with the host in front of them. A wrong server could only issue its own token; it never sees this device's real one. | `QRScannerView`, `PairingViewModel.scanned` |
| Path injection via method names | `/api/call/<Method>` accepts only ASCII alphanumerics. | `APIClient.callRequest` |
| A change made from an unattended, unlocked device | Start, Stop and Restart ask for Face ID / Touch ID / passcode again unless the owner authenticated in the last 2 minutes. The window is measured on the monotonic clock, so changing the device time can't stretch it. | `AppCoordinator.authorizeChange` |
| Accidental or repeated changes | Stop is confirmed and offers Undo for 10 s (30 s with VoiceOver or Switch Control on, and announced), one app or a group. A group runs one app at a time, stops at the first failure, and authenticates once. One change at a time. Changes are never retried, and a timeout says the change may still be running. Buttons show only when the computer says `canChange`. App ids must look like catalog ids before they're sent. | `AppActionsViewModel`, `AppAction`, `APIClient.perform` |
| Card data, logs and alerts in memory | Cards, logs and command output belong to the dashboard, so locking drops them. A late answer after a lock is dropped, not stored. Log lines are shown verbatim (never parsed as Markdown) and marked `privacySensitive`. What the app copies (an address, log lines) stays on this device: on iOS it's local-only, so not on Universal Clipboard, and expires in ten minutes; on the Mac, copied log lines are marked concealed for clipboard-history apps. One card that fails to decode only costs that card. | `CardsViewModel`, `LogsViewModel`, `StatusCard`, `Clipboard` |
| Finances save losing data, or undoing another device's | Edits change only the fields they mean to (`FinancePlanEdit`) in the plan as the raw JSON sent. Its `rev` goes back, so the computer refuses a stale save, and the phone then reads the latest. The edit level, authentication, a sane amount, and never retried. | `FinancePlanEdit`, `FinancesViewModel.setBalance` |
| A receipt photo giving away where it was taken | Re-encoded from its pixels alone (`ReceiptCodec.preparePhoto`): no EXIF, GPS or camera details, at most 2000 px and 2 MB. Receipt names must be the computer's hash form before they're sent or shown. | `ReceiptCodec` |
| What's kept on the device between launches | Only the sidebar's choice and which Status groups are open (scene storage, group names only), the widget's one line where it's turned on (below), the overnight line's hidden day, and "changed since you looked" as HMAC-SHA256 values under a random Keychain key (this device only). No app names, times, or readings are kept readable. | `ChangeMemory`, `KeychainManager.deviceKey` |
| The widget showing the homelab without Face ID | Built only with `HOMELAB_WIDGET=1`, and off on each device until turned on (with Face ID or Touch ID) under Settings › This Device. It shows only "All well" or a count, and when it was read: never app names. The unlocked app writes that one line to the App Group on each Status read; the widget has no token and reads nothing from the network. It's hidden while the device is locked (`privacySensitive`), only the Home Screen size is offered (no Lock Screen widget), and turning it off or unpairing deletes the line. | `WidgetSummaryStore`, `Widget/HomelabWidget.swift` |
| A phone changing what it shouldn't in `.env` | Settings travel only over the https link and never to a wall screen; a secret's value is never sent (and dropped if it were). A device allowed changes may save only everyday settings, after Face ID or Touch ID: the computer refuses every secret and the settings a phone connects through (the companion, bind addresses, domain and proxy key, proxy ports, AdGuard's DNS address, Tailscale), and saves nothing if it refuses one. Keys are checked for their shape before they're sent, and values are never logged. | `ComputerViewModel.saveForm`, `APIClient.saveSettings`, main #491 |
| Fix applied by accident | Fix always runs as a plan first. `fix --apply` runs only from that plan's Fix These button, after authentication. | `HomelabTasksViewModel`, `TaskOutputView` |
| Diagnostics report leaking secrets | The computer removes secrets before sending. The phone shows the whole report before the share sheet, keeps it only while that sheet is open, and never logs it. | `ComputerViewModel`, `ReportView` |
| A logo carrying more than a picture | The bundled logos are re-encoded from their pixels alone when fetched (no metadata), and the app names them only by catalog-shaped ids. Apps with one never ask the computer for their icon. | `scripts/fetch-app-logos.py`, `BundledLogo` |
| Command output kept or shown | Docker's output is kept only for a failure's Details: the last 400 lines, cleaned, in memory, dropped on lock. It's never logged. | `APIError.sanitizeLog` |

## Not built yet

- Update. The phone method list (`phoneMethods` in cmd/homelab/serve.go) has no `ReleaseNotes` and no way to learn that an update exists. The computer offers Update only behind its release notes, so the phone doesn't offer a blind update. This needs a backend method first.
- Finances editing beyond balances, budgets, goal targets, payment amounts and transactions: a payment's schedule and accounts, adding or removing payments, accounts, goal shares, transfers and split transactions. What's built:
  - turning the plan's Hide amounts on or off for every device (as ⌘⇧H on the computer);
  - typing in an account's balance or the cushion (the least checking should hold), changing a budget's amount, a goal's target or what a planned payment costs (not a card payoff, whose amount means the card's other spending), and marking a paycheck or payment as not in the balances yet (Taken as done) (`SaveFinances`, edit level). This edits the plan as the raw JSON the computer sent and sends it back whole, with its `rev`. Nothing the phone doesn't show is lost, and the computer refuses the save if another device saved first;
  - the money card (`FinancesWall`) in Overview, for any Finances level;
  - the plan (`Finances`) for view and edit: accounts today, net worth, and each pay period with its payments;
  - budgets, goals and loans from the same view;
  - transactions (`FinancesLedger`), newest first by month, searchable;
  - adding a transaction (`SaveFinancesLedger`, edit level): money in or out of one account, with payee, category, day and note. It's appended to the raw ledger and sent back with its `rev`. The computer gives it its id and checks it;
  - changing or deleting a transaction (by its id; transfers and splits stay on the computer). Everything else it holds, such as tags, bank id and receipt, is kept;
  - receipts: a kept one opens from its transaction (`FinancesReceipt`; pictures through a capped thumbnail, PDFs in PDFKit), and a photo can be attached to a new one (`SaveFinancesReceipt`). It's shrunk and re-encoded as JPEG with no metadata, so no location leaves the device.
  Amounts stay hidden until tapped and hide again on lock. None show while the plan's Hide amounts is on.
- Investments: reading them now and adding a buy or a sale. The holdings Ghostfolio last gave are in the plan already (each account's `holdings`, the plan's `holdingsRead`), so the Investments card draws from `Finances` today (`FinanceInvestments`). The computer can now also be asked, from a device with Finances' **edit** level and over the https link only:
  - `FinancesReadInvestments`, no arguments: reads Ghostfolio now and keeps what each account holds on the plan's account of the same name. It answers `{view, unmatched, accounts, holdings}`: `view` is the plan read forward, as `Finances` answers; `unmatched` the names of Ghostfolio's accounts nothing here matched; `accounts` and `holdings` how many Ghostfolio has, matched or not (`0` and `0` still means the token worked and Ghostfolio is empty). A wrong or missing `GHOSTFOLIO_SECURITY_TOKEN`, or Ghostfolio not running, is an error in words, never with the token.
  - `FinancesFindSymbol`, `["<what was typed>"]`: up to 8 matches, each `{symbol, name, currency, dataSource}`. Nothing typed finds nothing. Only the typed ticker or name leaves the homelab, when Ghostfolio looks it up.
  - `FinancesAddInvestment`, `[{account, symbol, dataSource, currency, shares, total, date, sold}]`: puts a buy (or, `sold: true`, a sale) into Ghostfolio, then reads again and answers as `FinancesReadInvestments` does. `account` is the plan account's `id` (investment or retirement); or send `newName` instead to make a new investment account, in Ghostfolio and the plan by one name. `symbol`, `dataSource` and `currency` are a match from `FinancesFindSymbol`; `shares` more than 0; `total` what was paid (or got) for them all, without a minus; `date` `YYYY-MM-DD`, not in the future. What's wrong is said before Ghostfolio is asked.
  The computer's card does the same (main: internal/ghostfolio, shared by the app and `homelab serve`). On the phone these still need a view: an Add form and a Read now button, both behind Face ID or Touch ID as other Finances saves are.
- "Downloading the app…" while an image is pulled. `AppAction` answers only at the end, so the phone can't see the pull happening.
- Revoking from the device. The companion has no self-unpair endpoint, so Unpair deletes the token locally and tells the person to run `homelab phone remove <id>` (or `scripts/phones.sh remove <id>`).
- The last Status while the computer can't be reached (the phone page does this since main #453). It's left out on purpose: it would keep readings on the device, and this app keeps none, nor anything once locked.
- When this device's changes end (`homelab phone until`, main #455). `/api/me` doesn't say, so the app can't show it before it happens.
- Optional: certificate pinning. It's left out on purpose, because Tailscale and Let's Encrypt certificates rotate every 90 days.
- A look-only home Wi-Fi mode over plain http. It's left out on purpose: the token would cross the Wi-Fi in readable form (the computer makes such a device look-only for good). It's a decision to make before building it.
- App Intents (Shortcuts) and Live Activities. They need targets in the Xcode project, and a choice about what may run or show without unlocking. (The widget is built: see Start here.)
- Snoozing a failing check's alerts from the phone (main #469): `SnoozeCheck` isn't a phone method, so the phone only shows until when.
- The iPhone app run against a real `homelab serve`. The iPhone app builds on the Mac runner; it hasn't been installed on a phone yet (`run-on-iphone.sh`).
