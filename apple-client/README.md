# Homelab: native Apple client (iOS + macOS)

A SwiftUI Multiplatform client for the Homelab Wizard phone companion
(`homelab serve`, port 8099). This folder holds only source files. You make
the Xcode project yourself (steps below).

```
apple-client/
├── Shared/
│   ├── App/            HomelabClientApp.swift: @main, the Homelab menu (⌘R, ⌘L)
│   ├── Models/         Wire types (Status, AppStatus, EngineChange, …), AppAction, PairingCode, ServerEndpoint, DeviceCredential
│   ├── ViewModels/     AppCoordinator (lock state machine), PairingViewModel, DashboardViewModel, AppActionsViewModel
│   ├── Views/          AppCoordinatorView, PairingView, LockScreenView, DashboardView, AppDetailView, Components/
│   ├── Services/       APIClient, LiveEventManager, SSEParser, APIError, JSONCoding
│   └── Security/       KeychainManager, BiometricAuthManager, SecureLog
└── Tests/              Swift Testing unit tests for parsing and validation
```

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
   - Add no `NSAppTransportSecurity` exceptions. The client is https-only, and ATS stays fully on.
6. In **Signing & Capabilities**:
   - Choose a development team on both platforms. On macOS, the data-protection keychain needs a signed app; an unsigned one gets `errSecMissingEntitlement`.
   - macOS: **App Sandbox › Outgoing Connections (Client)**, and keep the Hardened Runtime on.

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
| App settings | `POST /api/call/SetAppSetting` `[id, "updates"\|"alerts", bool]` | A change: hold or release updates, watchdog alerts on or off |
| Computer | `Host`, `SetUpdatesPaused` `[bool]` (a change), `Report` (secrets removed by the computer; up to 3 min) | |
| Start / Stop / Restart / Roll back | `POST /api/call/AppAction` `[id, "start"\|"stop"\|"restart"\|"rollback"]`; Stop for a while is `StopUntil` `[id, RFC 3339]` | Needs `canChange` and https. One change from a phone at a time. `{result: null, log}`, or 500 `{error, log}` |

All requests after pairing send `Authorization: Bearer <token>`. The token
is 32 random bytes, base64url-encoded. The **server** keeps only its SHA-256
hash. The client receives the token itself, once.

## Security model

| Threat | Mitigation | Where |
|---|---|---|
| Token sniffed on Wi-Fi | https only (no ATS exceptions). `ServerEndpoint` rejects `http://`. The server also makes plain-HTTP pairings look-only. | `ServerEndpoint`, `APIClient` |
| Token sent to the wrong host | The token is stored together with its origin. Every request and response URL is checked against that origin. Redirects are refused, because Foundation would copy the Authorization header onto them. | `DeviceCredential`, `APIClient.check`, `RedirectRefusal` |
| Token extracted from the device or backups | Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, `kSecAttrSynchronizable=false`, and the data-protection keychain on macOS. The accessibility attribute is checked again on every read, and a mismatched item is deleted. | `KeychainManager` |
| Stale pairing after a reinstall | Keychain items survive app deletion on iOS, so the first launch after an install deletes them. | `AppCoordinator.purgeKeychainIfFreshInstall` |
| Someone else picks up the unlocked device | Face ID / Touch ID / passcode (`.deviceOwnerAuthentication`) at launch and on every return from the background. A new `LAContext` each time, with no reuse window. With no passcode set, the app refuses to open. | `BiometricAuthManager`, `AppCoordinator` |
| Mac left unattended | Also locks when the app is hidden, on screen lock, when the screens or the system sleep, and on fast user switching. ⌘L locks by hand. | `MacLockTriggers` |
| App switcher snapshot | An opaque shield covers the app whenever the scene isn't active (iOS). | `PrivacyShieldView` |
| Data left in memory while locked | Locking stops the SSE stream and clears every reading. Late answers that arrive after the lock are dropped. | `LiveEventManager.clear` |
| Secrets in logs | `os.Logger` only. Tokens and codes are never interpolated. Hosts and server text are `.private`. Error log lines use payload-free `logName`. The secret types print as `<redacted>` even through `print` or `dump`. | `SecureLog`, `APIError.logName` |
| Hostile or broken stream | The SSE and ndjson parsers are bounded (4 MB per event, 8 MB per answer). The token's shape is validated, and server messages are cleaned before display. | `SSEParser`, `APIError.sanitize` |
| Path injection via method names | `/api/call/<Method>` accepts only ASCII alphanumerics. | `APIClient.callRequest` |
| A change made from an unattended, unlocked device | Start, Stop and Restart ask for Face ID / Touch ID / passcode again unless the owner authenticated in the last 2 minutes. The window is measured on the monotonic clock, so changing the device time can't stretch it. | `AppCoordinator.authorizeChange` |
| Accidental or repeated changes | Stop is confirmed and offers Undo for 10 s. One change at a time. Changes are never retried, and a timeout says the change may still be running. Buttons show only when the computer says `canChange`. App ids must look like catalog ids before they're sent. | `AppActionsViewModel`, `AppAction`, `APIClient.perform` |
| Card data, logs and alerts in memory | Cards, logs and command output belong to the dashboard, so locking drops them. A late answer after a lock is dropped, not stored. Log lines are shown verbatim (never parsed as Markdown) and marked `privacySensitive`. One card that fails to decode only costs that card. | `CardsViewModel`, `LogsViewModel`, `StatusCard` |
| Fix applied by accident | Fix always runs as a plan first. `fix --apply` runs only from that plan's Fix These button, after authentication. | `HomelabTasksViewModel`, `TaskOutputView` |
| Diagnostics report leaking secrets | The computer removes secrets before sending. The phone shows the whole report before the share sheet, keeps it only while that sheet is open, and never logs it. | `ComputerViewModel`, `ReportView` |
| Command output kept or shown | Docker's output is kept only for a failure's Details: the last 400 lines, cleaned, in memory, dropped on lock. It's never logged. | `APIError.sanitizeLog` |

## Not built yet

- Update. The phone method list (`phoneMethods` in cmd/homelab/serve.go) has no `ReleaseNotes` and no way to learn that an update exists. The computer offers Update only behind its release notes, so the phone doesn't offer a blind update. This needs a backend method first.
- Finances editing, the ledger, receipts, budgets, goals and loans (`SaveFinances`, `FinancesLedger`, …). Read-only Finances is built:
  - the money card (`FinancesWall`) in Overview, for any Finances level;
  - the plan (`Finances`) for view and edit: accounts today, net worth, and each pay period with its payments.
  Amounts stay hidden until tapped and hide again on lock. None show while the plan's Hide amounts is on.
- "Downloading the app…" while an image is pulled. `AppAction` answers only at the end, so the phone can't see the pull happening.
- Revoking from the device. The companion has no self-unpair endpoint, so Unpair deletes the token locally and tells the person to run `homelab phone remove <id>`.
- Optional: certificate pinning. It's left out on purpose, because Tailscale and Let's Encrypt certificates rotate every 90 days.
