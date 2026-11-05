import Foundation
import Observation
import SwiftUI
#if os(macOS)
import AppKit
#endif

/// Owns the app's security state: paired or not, locked or not.
///
/// ```
///             bootstrap
///                 │
///      no credential │ credential (or Keychain unreadable: fail closed)
///          ▼             ▼
///      .pairing ──► .unlocked ◄──── authenticate ──── .locked
///          ▲             │                              ▲
///          │             └── background / sleep / ⌘L ───┘
///          └──── unpair, or the computer answers 401
/// ```
///
/// Rules:
/// - The dashboard only shows while `.unlocked`. Locking stops the live
///   stream and drops every reading from memory.
/// - The app locks when it goes to the background. On macOS it also locks
///   when the app is hidden, the screens sleep, the Mac sleeps, or the user
///   session switches away.
/// - A biometric prompt makes the scene `.inactive`, not `.background`, so
///   it can't trigger a lock loop. Only `.background` locks.
/// - After a lock caused by leaving the app, the next return prompts by
///   itself, once. A cancelled prompt doesn't repeat. The person taps Unlock.
///   A manual lock (⌘L) doesn't prompt by itself at all.
/// - A change (Start, Stop, Restart) asks for the owner again unless they
///   authenticated within `changeGrace`. A device left unlocked on a table
///   can be looked at, but nothing can be stopped from it.
@MainActor
@Observable
final class AppCoordinator {
    enum Route: Equatable {
        case launching
        case pairing
        case locked
        case unlocked
    }

    private(set) var route: Route = .launching
    private(set) var device: DeviceInfo?
    /// The server as the screens name it, while unlocked.
    private(set) var serverName: String?
    private(set) var unlockError: String?
    /// Shown on the pairing screen after the computer revoked this device.
    private(set) var pairingNotice: String?
    private(set) var isAuthenticating = false
    private(set) var unlockMethod: BiometricAuthManager.Method = .passcode

    let api: APIClient
    let liveEvents: LiveEventManager

    @ObservationIgnored private let keychain: any CredentialStore
    @ObservationIgnored private let biometrics: any OwnerAuthenticator
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var scenePhase: ScenePhase = .active
    @ObservationIgnored private var autoPromptArmed = true
    /// When the owner last authenticated. This uses the monotonic clock, so
    /// changing the device's time can't stretch the grace window.
    @ObservationIgnored private var lastOwnerAuth: ContinuousClock.Instant?

    /// How long one authentication also covers changes.
    static let changeGrace: Duration = .seconds(120)

    private static let installMarkerKey = "installMarker.v1"

    init(
        keychain: any CredentialStore = KeychainManager(),
        biometrics: any OwnerAuthenticator = BiometricAuthManager(),
        defaults: UserDefaults = .standard
    ) {
        self.keychain = keychain
        self.biometrics = biometrics
        self.defaults = defaults
        api = APIClient(keychain: keychain)
        liveEvents = LiveEventManager(api: api)
        liveEvents.onUnauthorized = { [weak self] in self?.handleUnauthorized() }
        #if os(macOS)
        installMacLockTriggers()
        #endif
    }

    #if os(macOS)
    /// The observers stay for the app's lifetime, and so does the coordinator.
    @ObservationIgnored private var macObservers: [NSObjectProtocol] = []

    /// A Mac can be walked away from without the app going to the
    /// background, and with only the menu bar item open. So these are
    /// installed here, not on a window, and they work while no window is open:
    /// - the app is hidden
    /// - the screen locks
    /// - the screens or the Mac sleep
    /// - fast user switching
    private func installMacLockTriggers() {
        let workspace = NSWorkspace.shared.notificationCenter
        let distributed = DistributedNotificationCenter.default()
        func on(_ center: NotificationCenter, _ name: Notification.Name, _ action: @escaping @MainActor @Sendable (AppCoordinator) -> Void) {
            let token = center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    action(self)
                }
            }
            macObservers.append(token)
        }
        on(NotificationCenter.default, NSApplication.didHideNotification) { $0.lock(promptOnReturn: true) }
        on(workspace, NSWorkspace.willSleepNotification) { $0.lock() }
        on(workspace, NSWorkspace.screensDidSleepNotification) { $0.lock() }
        on(workspace, NSWorkspace.sessionDidResignActiveNotification) { $0.lock() }
        on(distributed, Notification.Name("com.apple.screenIsLocked")) { $0.lock() }
        on(distributed, Notification.Name("com.apple.screenIsUnlocked")) { $0.rearmAndRequestUnlock() }
        on(workspace, NSWorkspace.screensDidWakeNotification) { $0.rearmAndRequestUnlock() }
    }
    #endif

    // MARK: Launch

    func bootstrap() {
        guard route == .launching else { return }
        purgeKeychainIfFreshInstall()
        unlockMethod = biometrics.availableMethod()
        do {
            route = try keychain.loadCredential() == nil ? .pairing : .locked
        } catch {
            // Can't tell (for example, launched while the device is still
            // locked): stay locked. Unlocking reads it again.
            Log.security.error("Couldn't read the Keychain at launch; starting locked")
            route = .locked
        }
        autoPromptArmed = true
        Log.ui.info("Launched to \(String(describing: self.route), privacy: .public)")
    }

    /// iOS keeps Keychain items after the app is deleted. A reinstall must
    /// not quietly resume a pairing left behind on this device, so the
    /// first launch after an install deletes everything this app stored.
    private func purgeKeychainIfFreshInstall() {
        guard !defaults.bool(forKey: Self.installMarkerKey) else { return }
        do {
            try keychain.deleteAll()
            defaults.set(true, forKey: Self.installMarkerKey)
            Log.security.notice("First launch after install: cleared any earlier Keychain items")
        } catch {
            // The marker stays unset, so this runs again on the next launch.
            Log.security.error("Couldn't clear the Keychain on first launch")
        }
    }

    // MARK: Scene lifecycle

    func scenePhaseChanged(to phase: ScenePhase) {
        scenePhase = phase
        switch phase {
        case .background:
            lock(promptOnReturn: true)
        case .active:
            requestAutoUnlock()
        default:
            break
        }
    }

    /// Prompts for authentication by itself if the app is locked, in front,
    /// and armed for it. Safe to call often.
    func requestAutoUnlock() {
        guard route == .locked, scenePhase == .active, autoPromptArmed, !isAuthenticating else { return }
        autoPromptArmed = false
        Task { await unlock() }
    }

    /// Locks the UI and drops all homelab data from memory.
    /// - Parameter promptOnReturn: whether coming back should prompt by
    ///   itself. True when the app left the screen, false for a manual lock.
    func lock(promptOnReturn: Bool = false) {
        autoPromptArmed = promptOnReturn
        lastOwnerAuth = nil
        guard route == .unlocked else { return }
        liveEvents.clear()
        device = nil
        serverName = nil
        route = .locked
        Log.security.notice("Locked")
    }

    /// Re-arms the automatic prompt (for example, after the Mac wakes) and
    /// tries it.
    func rearmAndRequestUnlock() {
        autoPromptArmed = true
        requestAutoUnlock()
    }

    // MARK: Unlock

    func unlock() async {
        guard route == .locked, !isAuthenticating else { return }
        isAuthenticating = true
        defer { isAuthenticating = false }
        unlockMethod = biometrics.availableMethod()

        do {
            try await biometrics.authenticate(reason: "Unlock Homelab to see and control your servers.")
        } catch let error as BiometricAuthManager.AuthError {
            unlockError = error.errorDescription
            return
        } catch {
            unlockError = BiometricAuthManager.AuthError.unavailable.errorDescription
            return
        }

        // Something may have locked the app again while the prompt was up.
        guard route == .locked else { return }
        lastOwnerAuth = ContinuousClock.now
        do {
            guard let credential = try keychain.loadCredential() else {
                route = .pairing
                return
            }
            unlockError = nil
            serverName = credential.endpoint.displayName
            route = .unlocked
            liveEvents.start()
            Task { await refreshDevice() }
        } catch {
            unlockError = APIError.from(error).errorDescription
        }
    }

    /// Asks the computer what this device may do. It also confirms the
    /// device is still paired.
    func refreshDevice() async {
        do {
            let me = try await api.me()
            guard route == .unlocked else { return }
            device = me
        } catch {
            let apiError = APIError.from(error)
            if apiError == .unauthorized { handleUnauthorized() }
        }
    }

    // MARK: Changes

    /// Whether the owner may make a change now. Within `changeGrace` of the
    /// last authentication, the answer is yes. Otherwise it prompts again.
    /// The answer is no while locked or if the prompt is dismissed.
    func authorizeChange(reason: String) async -> Bool {
        guard route == .unlocked else { return false }
        if let last = lastOwnerAuth, ContinuousClock.now - last < Self.changeGrace {
            return true
        }
        do {
            try await biometrics.authenticate(reason: reason)
        } catch {
            return false
        }
        // It may have locked while the prompt was up.
        guard route == .unlocked else { return false }
        lastOwnerAuth = ContinuousClock.now
        return true
    }

    // MARK: Pairing

    func didPair(_ device: DeviceInfo) {
        pairingNotice = nil
        self.device = device
        serverName = (try? keychain.loadCredential())?.endpoint.displayName
        // The app left the screen while the pairing request was out: it is
        // paired now, but it opens locked, like any return from the background.
        guard scenePhase == .active else {
            serverName = nil
            self.device = nil
            autoPromptArmed = true
            route = .locked
            return
        }
        // The person just entered a one-time code from the computer, which
        // proves presence for this session.
        route = .unlocked
        liveEvents.start()
    }

    /// Forgets the device here. The token is deleted from the Keychain. The
    /// computer still lists the device until `homelab phone remove <id>`.
    func unpair() {
        lastOwnerAuth = nil
        liveEvents.clear()
        do {
            try keychain.deleteCredential()
        } catch {
            Log.security.error("Couldn't delete the credential while unpairing")
        }
        device = nil
        serverName = nil
        route = .pairing
    }

    private func handleUnauthorized() {
        guard route != .pairing else { return }
        Log.security.notice("The computer no longer accepts this device; unpairing")
        unpair()
        pairingNotice = "The computer removed this device. Make a new code on the computer to pair again."
    }
}
