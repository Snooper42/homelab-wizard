# Homelab: native Apple client (iOS + macOS)

A SwiftUI Multiplatform client for the Homelab Wizard phone companion
(`homelab serve`, port 8099). This folder holds only source files. You make
the Xcode project yourself (steps below).

```
apple-client/
├── Shared/
│   ├── App/            HomelabClientApp.swift: @main, the Homelab menu (⌘R, ⌘L), the Mac menu bar item; AppCommands.swift: the App menu (⌥⌘S start, ⌥⌘R restart, ⌥⌘. stop, ⌥⌘L logs)
│   ├── Models/         Wire types (Status, AppStatus, EngineChange, …), AppAction, PairingCode, ServerEndpoint, DeviceCredential
│   ├── ViewModels/     AppCoordinator (lock state machine), PairingViewModel, DashboardViewModel, AppActionsViewModel
│   ├── Views/          AppCoordinatorView, PairingView, LockScreenView, DashboardView, AppDetailView, Components/
│   ├── Services/       APIClient, LiveEventManager, SSEParser, APIError, JSONCoding
│   └── Security/       KeychainManager, BiometricAuthManager, SecureLog
└── Tests/              Swift Testing unit tests: parsing, validation, lossless edits, and the lock state machine (with fake keychain and authentication)
```

## What it does

| | iPhone | Mac and iPad |
|---|---|---|
| **Pairing** | The code, the pasted pairing link, or a scan of the computer's QR code. Optionally as a wall screen (look-only for good). | The code or the pasted link |
| **Locking** | Face ID / Touch ID / passcode at launch and on every return; an opaque cover in the app switcher | Touch ID / password; also on hide, sleep, screen lock, user switching, window close, and after five minutes behind other apps |
| **Status** | Live list, searchable by name: pinned first, then needs attention, running, stopped. Each row has its icon, "N% up" and a dot for what changed since you looked. An app the watchdog stopped because Docker kept restarting it (main #427) reads "Stopped: it restarted 5 times in an hour", in red, and counts as needing attention. The overnight line in the morning. | The same, in a three-column split view whose sidebar keeps its place, plus a menu bar item whose Needs attention list opens on the app's page |
| **An app's page** | What's wrong, its actions, its week (uptime and outages), about it (catalog), details, why it last started, addresses, logs (filter, errors and warnings in colour, Problems Only, copy with ⇧⌘C), and its settings (nightly updates, alerts, pin) | The same, with an App menu (⌥⌘S/R/./L) |
| **Changes** (allowed devices, re-authenticated) | Start, Stop (confirmed, Undo), Restart, Stop for a while, Roll back, for one app or a whole list | The same, plus keyboard shortcuts |
| **Overview** | The money card, watchdog, protection, alerts, savings | Overview in the sidebar |
| **Backups** | Each app's copy, Duplicati's jobs and their last run, restore tests, the vault export; Back up now, Test a restore | Backups in the sidebar |
| **Computer** | What it runs, nightly updates on or off, Look for problems → Fix these, a diagnostics report to share, this device (when it paired, and a warning if it paired without encryption), Unpair | Computer in the sidebar |
| **Finances** (by level) | The plan, budgets, goals, loans, Taken as done, and transactions. Editing: balances, the cushion, budgets, goal targets, what a payment costs, waiting marks, transactions, and receipt photos. | Finances in the sidebar; ⌥⌘N adds a transaction, ⇧⌘H hides amounts on every device |

## Check it first, without Xcode

On any Mac with Xcode 16 or later (or a Swift 6 toolchain):

```bash
cd apple-client && swift build && swift test
```

To also compile the iOS-only parts (the QR scanner, haptics, keyboard types), build the same package for iOS:

```bash
cd apple-client && xcodebuild -scheme HomelabClient -destination 'generic/platform=iOS' build
```

`Package.swift` builds everything in `Shared/` except the `@main` entry point, in Swift 6 language mode, and runs `Tests/`. It's the quickest way to catch what a hand review can't. These sources were written without a compiler.

## Make the Xcode project

1. In Xcode 16 or later (its SDKs make `View` main-actor isolated, which these sources rely on): **File › New › Project › Multiplatform › App.** Name it `HomelabClient`.
   Choose SwiftUI and Swift, with no Core Data and no SwiftData.
2. Delete the template's `ContentView.swift` and `HomelabClientApp.swift`.
3. Drag `apple-client/Shared` into the project. Choose *Create groups* and
   add it to the app target, both platforms. Drag `apple-client/Tests` into
   the unit test target.
4. In **Build settings** for the app target:
   - iOS Deployment Target **17.0**, macOS Deployment Target **14.0**. `@Observable`, `ContentUnavailableView` and `sensoryFeedback` need these.
   - Swift Language Version **Swift 6**.
   - On Xcode 26, set **Default Actor Isolation = nonisolated**. The new-project default is MainActor, but these sources mark `@MainActor` explicitly where needed. Under a MainActor default, the model and parser types would be main-actor-bound, and the background stream reader couldn't use them.
5. In **Info** (Info.plist keys):
   - `NSFaceIDUsageDescription`: "Face ID unlocks Homelab, which controls your servers." The Face ID prompt fails without it.
   - `NSCameraUsageDescription` (iOS): "The camera scans the pairing QR code your computer shows." Scanning to pair needs it. Without it, the scan button doesn't show.
   - Add no `NSAppTransportSecurity` exceptions. The client is https-only, and ATS stays fully on.
   - `ITSAppUsesNonExemptEncryption` = NO. The app's only encryption is the system's HTTPS and Keychain, which is exempt, so App Store Connect stops asking at each upload.
6. In **Signing & Capabilities**:
   - Choose a development team on both platforms. On macOS, the data-protection keychain needs a signed app; an unsigned one gets `errSecMissingEntitlement`.
   - macOS: **App Sandbox › Outgoing Connections (Client)**, and keep the Hardened Runtime on.
7. Make sure `Shared/App/PrivacyInfo.xcprivacy` is in the app target (both platforms). It's the privacy manifest the App Store asks for. It states no tracking and no data collected, and the one required-reason API the app uses: `UserDefaults`, for its own settings (CA92.1). The Swift package leaves it out, as a library has no use for it.

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
| Token sniffed on Wi-Fi | https only (no ATS exceptions). `ServerEndpoint` rejects `http://`. The server also makes plain-HTTP pairings look-only. | `ServerEndpoint`, `APIClient` |
| Token sent to the wrong host | The token is stored together with its origin. Every request and response URL is checked against that origin. Redirects are refused, because Foundation would copy the Authorization header onto them. A stored origin goes through the same address rules again when it's read back, and only `/api/` paths are ever built on it. | `DeviceCredential`, `ServerEndpoint`, `APIClient.check`, `RedirectRefusal` |
| Token extracted from the device or backups | Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, `kSecAttrSynchronizable=false`, and the data-protection keychain on macOS. The accessibility attribute is checked again on every read, and a mismatched item is deleted. | `KeychainManager` |
| Stale pairing after a reinstall | Keychain items survive app deletion on iOS, so the first launch after an install deletes them. | `AppCoordinator.purgeKeychainIfFreshInstall` |
| Someone else picks up the unlocked device | Face ID / Touch ID / passcode (`.deviceOwnerAuthentication`) at launch and on every return from the background. A new `LAContext` each time, with no reuse window. With no passcode set, the app refuses to open. | `BiometricAuthManager`, `AppCoordinator` |
| Mac left unattended | Also locks when the app is hidden, on screen lock, when the screens or the system sleep, on fast user switching, when its window closes, and after five minutes behind other apps (a Mac app never goes to the background by itself). These triggers are installed in the coordinator, so they work with only the menu bar item open. ⌘L locks by hand. | `AppCoordinator.installMacLockTriggers` |
| Menu bar item showing the homelab | It shows only what the unlocked app holds. Locked (including with its window closed), it says so and nothing else. | `MenuBarView` |
| App switcher snapshot | An opaque shield covers the app whenever the scene isn't active (iOS). | `PrivacyShieldView` |
| Data left in memory while locked | Locking stops the SSE stream and clears every reading. Late answers that arrive after the lock are dropped. | `LiveEventManager.clear` |
| Secrets in logs | `os.Logger` only. Tokens and codes are never interpolated. Hosts and server text are `.private`. Error log lines use payload-free `logName`. The secret types print as `<redacted>` even through `print` or `dump`. | `SecureLog`, `APIError.logName` |
| Hostile or broken stream | The SSE and ndjson parsers are bounded (4 MB per event, 8 MB per answer). The token's shape is validated, and server messages are cleaned before display. | `SSEParser`, `APIError.sanitize` |
| A planted pairing QR code | A scan only fills in the address and code, through the same https-only parser as typing. Nothing pairs until the person taps Pair, with the host in front of them. A wrong server could only issue its own token; it never sees this device's real one. | `QRScannerView`, `PairingViewModel.scanned` |
| Path injection via method names | `/api/call/<Method>` accepts only ASCII alphanumerics. | `APIClient.callRequest` |
| A change made from an unattended, unlocked device | Start, Stop and Restart ask for Face ID / Touch ID / passcode again unless the owner authenticated in the last 2 minutes. The window is measured on the monotonic clock, so changing the device time can't stretch it. | `AppCoordinator.authorizeChange` |
| Accidental or repeated changes | Stop is confirmed and offers Undo for 10 s, one app or a group. A group runs one app at a time, stops at the first failure, and authenticates once. One change at a time. Changes are never retried, and a timeout says the change may still be running. Buttons show only when the computer says `canChange`. App ids must look like catalog ids before they're sent. | `AppActionsViewModel`, `AppAction`, `APIClient.perform` |
| Card data, logs and alerts in memory | Cards, logs and command output belong to the dashboard, so locking drops them. A late answer after a lock is dropped, not stored. Log lines are shown verbatim (never parsed as Markdown) and marked `privacySensitive`. What the app copies (an address, log lines) stays on this device: on iOS it's local-only, so not on Universal Clipboard, and expires in ten minutes; on the Mac, copied log lines are marked concealed for clipboard-history apps. One card that fails to decode only costs that card. | `CardsViewModel`, `LogsViewModel`, `StatusCard`, `Clipboard` |
| Finances save losing data, or undoing another device's | Edits change only the fields they mean to (`FinancePlanEdit`) in the plan as the raw JSON sent. Its `rev` goes back, so the computer refuses a stale save, and the phone then reads the latest. The edit level, authentication, a sane amount, and never retried. | `FinancePlanEdit`, `FinancesViewModel.setBalance` |
| A receipt photo giving away where it was taken | Re-encoded from its pixels alone (`ReceiptCodec.preparePhoto`): no EXIF, GPS or camera details, at most 2000 px and 2 MB. Receipt names must be the computer's hash form before they're sent or shown. | `ReceiptCodec` |
| What's kept on the device between launches | Only the sidebar's choice (scene storage), the overnight line's hidden day, and "changed since you looked" as HMAC-SHA256 values under a random Keychain key (this device only). No app names, times, or readings are kept readable. | `ChangeMemory`, `KeychainManager.deviceKey` |
| Fix applied by accident | Fix always runs as a plan first. `fix --apply` runs only from that plan's Fix These button, after authentication. | `HomelabTasksViewModel`, `TaskOutputView` |
| Diagnostics report leaking secrets | The computer removes secrets before sending. The phone shows the whole report before the share sheet, keeps it only while that sheet is open, and never logs it. | `ComputerViewModel`, `ReportView` |
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
- "Downloading the app…" while an image is pulled. `AppAction` answers only at the end, so the phone can't see the pull happening.
- Revoking from the device. The companion has no self-unpair endpoint, so Unpair deletes the token locally and tells the person to run `homelab phone remove <id>`.
- Optional: certificate pinning. It's left out on purpose, because Tailscale and Let's Encrypt certificates rotate every 90 days.
- A look-only home Wi-Fi mode over plain http. It's left out on purpose: the token would cross the Wi-Fi in readable form (the computer makes such a device look-only for good). It's a decision to make before building it.
- Widgets, App Intents (Shortcuts) and Live Activities. They need targets and entitlements in the Xcode project, and a choice about what may show while the app is locked.
- A compile. These sources were written without a Swift toolchain and reviewed by hand, so expect a few small fixes on the first build. Run `swift build && swift test` (above) to find them.
