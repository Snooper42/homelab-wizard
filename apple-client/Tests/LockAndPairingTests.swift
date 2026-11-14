import CoreGraphics
import Foundation
import ImageIO
import SwiftUI
import Testing
@testable import HomelabClient

@Suite("Scanning to pair")
@MainActor
struct ScanToPairTests {
    private func model() -> PairingViewModel { PairingViewModel(api: APIClient(keychain: KeychainManager(service: "test.scan")), onPaired: { _ in }) }

    @Test func takesAnHTTPSPairingLink() {
        let m = model()
        m.scanned("https://mac.tail1234.ts.net:8099/#pair=ABCD2345")
        #expect(m.serverAddress == "https://mac.tail1234.ts.net:8099")
        #expect(m.code == "ABCD2345")
        #expect(m.errorMessage == nil)
    }

    @Test func refusesTheHomeWiFiLinkAndOtherCodes() {
        let m = model()
        m.scanned("http://mac.local:8099/#pair=ABCD2345")
        #expect(m.code.isEmpty && m.errorMessage != nil)
        m.scanned("https://example.com/menu")
        #expect(m.code.isEmpty && m.errorMessage != nil)
    }
}

// MARK: - The lock state machine

final class FakeCredentialStore: CredentialStore, @unchecked Sendable {
    private let lock = NSLock()
    private var stored: DeviceCredential?
    private var away: [AwayApp] = []
    private var _deletedAll = 0
    var failLoad = false

    init(_ credential: DeviceCredential? = nil) { stored = credential }

    func saveCredential(_ credential: DeviceCredential) throws { lock.withLock { stored = credential } }
    func loadCredential() throws -> DeviceCredential? {
        if failLoad { throw KeychainManager.KeychainError.interactionNotAllowed }
        return lock.withLock { stored }
    }
    func deleteCredential() throws { lock.withLock { stored = nil; away = [] } }
    func deleteAll() throws { lock.withLock { stored = nil; away = []; _deletedAll += 1 } }
    func saveAwayApps(_ apps: [AwayApp]) throws { lock.withLock { away = apps } }
    func loadAwayApps() throws -> [AwayApp] { lock.withLock { away } }

    var hasCredential: Bool { lock.withLock { stored != nil } }
    var deletedAll: Int { lock.withLock { _deletedAll } }
}

final class FakeOwnerAuthenticator: OwnerAuthenticator, @unchecked Sendable {
    var error: BiometricAuthManager.AuthError?
    /// Runs while the prompt is "up", to lock the app mid-prompt.
    var whilePrompting: (@MainActor @Sendable () -> Void)?
    private(set) var prompts = 0

    func availableMethod() -> BiometricAuthManager.Method { .faceID }
    func authenticate(reason: String) async throws {
        prompts += 1
        if let whilePrompting { await MainActor.run { whilePrompting() } }
        if let error { throw error }
    }
}

@Suite("Lock state machine")
@MainActor
struct LockStateMachineTests {
    private static func credential() -> DeviceCredential {
        // Port 1 on this machine: live events fail at once, no network.
        DeviceCredential(endpoint: try! ServerEndpoint.parse("https://127.0.0.1:1").endpoint,
                         token: String(repeating: "a", count: 43), deviceID: "abc123", deviceName: "Test", pairedAt: Date())
    }

    private static func device() -> DeviceInfo {
        try! JSONDecoder().decode(DeviceInfo.self, from: Data(#"{"id":"abc123","name":"Test","canChange":true}"#.utf8))
    }

    private static func defaults(installed: Bool) -> UserDefaults {
        let d = UserDefaults(suiteName: "homelab.tests.\(UUID().uuidString)")!
        if installed { d.set(true, forKey: "installMarker.v1") }
        return d
    }

    /// The tests' clock: moved forward by hand.
    private final class TestClock {
        var now = ContinuousClock.now
        func wait(_ d: Duration) { now = now.advanced(by: d) }
    }

    private func make(store: FakeCredentialStore, auth: FakeOwnerAuthenticator = FakeOwnerAuthenticator(), installed: Bool = true,
                      defaults: UserDefaults? = nil, clock: TestClock = TestClock()) -> AppCoordinator {
        AppCoordinator(keychain: store, biometrics: auth, defaults: defaults ?? Self.defaults(installed: installed), now: { clock.now })
    }

    @Test func aFreshInstallClearsWhatAnEarlierOneLeft() {
        let store = FakeCredentialStore(Self.credential())
        let c = make(store: store, installed: false)
        c.bootstrap()
        #expect(store.deletedAll == 1)
        #expect(!store.hasCredential)
        #expect(c.route == .pairing)
    }

    @Test func pairedStartsLocked() {
        let c = make(store: FakeCredentialStore(Self.credential()))
        c.bootstrap()
        #expect(c.route == .locked)
    }

    @Test func anUnreadableKeychainFailsClosed() {
        let store = FakeCredentialStore(Self.credential())
        store.failLoad = true
        let c = make(store: store)
        c.bootstrap()
        #expect(c.route == .locked)
    }

    @Test func unlockThenTheBackgroundLocksAndForgets() async {
        let auth = FakeOwnerAuthenticator()
        let c = make(store: FakeCredentialStore(Self.credential()), auth: auth)
        c.lockAfter = .rightAway
        c.bootstrap()
        await c.unlock()
        #expect(c.route == .unlocked)
        #expect(auth.prompts == 1)
        c.requestedAppID = "jellyfin"
        c.scenePhaseChanged(to: .background)
        #expect(c.route == .locked)
        #expect(c.liveEvents.status == nil)
        #expect(c.serverName == nil)
        #expect(c.requestedAppID == nil)
        // Locked: no change is authorized, and no prompt is shown for one.
        #expect(await c.authorizeChange(reason: "test") == false)
        #expect(auth.prompts == 1)
    }

    // Lock After (the owner, Nov 14: not Face ID "every single second").
    @Test func backWithinLockAfterTheAppIsAsItWasLeft() async {
        let auth = FakeOwnerAuthenticator(), clock = TestClock()
        let c = make(store: FakeCredentialStore(Self.credential()), auth: auth, clock: clock)
        c.lockAfter = .fiveMinutes
        c.bootstrap()
        await c.unlock()
        c.requestedAppID = "jellyfin"
        c.scenePhaseChanged(to: .background)
        clock.wait(.seconds(4 * 60 + 59))
        c.scenePhaseChanged(to: .active)
        #expect(c.route == .unlocked)
        #expect(c.requestedAppID == "jellyfin")
        #expect(auth.prompts == 1)
        // Leaving ended the change grace: a change asks again.
        #expect(await c.authorizeChange(reason: "test"))
        #expect(auth.prompts == 2)
    }

    @Test func awayLongerThanLockAfterItLocksOnReturn() async {
        let auth = FakeOwnerAuthenticator(), clock = TestClock()
        let c = make(store: FakeCredentialStore(Self.credential()), auth: auth, clock: clock)
        c.lockAfter = .oneMinute
        c.bootstrap()
        await c.unlock()
        c.requestedAppID = "jellyfin"
        c.scenePhaseChanged(to: .background)
        clock.wait(.seconds(60))
        c.scenePhaseChanged(to: .active)
        #expect(c.requestedAppID == nil)
        #expect(c.serverName == nil)
        // Locked, and it asks by itself as it comes back.
        try? await Task.sleep(for: .milliseconds(50))
        #expect(auth.prompts == 2)
    }

    @Test func lockingTheScreenLocksWhateverLockAfterSays() async {
        let c = make(store: FakeCredentialStore(Self.credential()))
        c.lockAfter = .fifteenMinutes
        c.bootstrap()
        await c.unlock()
        c.scenePhaseChanged(to: .background)
        c.screenLocked()
        #expect(c.route == .locked)
        #expect(c.serverName == nil)
    }

    @Test func lockAfterIsKeptOnThisDevice() {
        let d = Self.defaults(installed: true)
        let c = make(store: FakeCredentialStore(Self.credential()), defaults: d)
        c.lockAfter = .oneMinute
        #expect(make(store: FakeCredentialStore(Self.credential()), defaults: d).lockAfter == .oneMinute)
        #expect(LockAfter.read(Self.defaults(installed: true)) == LockAfter.standard)
        #expect(LockAfter.fiveMinutes.words.hasPrefix("Back within 5 minutes, the app opens as you left it"))
        #expect(LockAfter.oneMinute.words.hasPrefix("Back within 1 minute,"))
        #expect(LockAfter.rightAway.words == "The app locks as soon as it leaves the screen.")
    }

    @Test func aCancelledPromptStaysLockedQuietly() async {
        let auth = FakeOwnerAuthenticator()
        auth.error = .cancelled
        let c = make(store: FakeCredentialStore(Self.credential()), auth: auth)
        c.bootstrap()
        await c.unlock()
        #expect(c.route == .locked)
        #expect(c.unlockError == nil)
    }

    @Test func aFailedPromptSaysSo() async {
        let auth = FakeOwnerAuthenticator()
        auth.error = .noPasscode
        let c = make(store: FakeCredentialStore(Self.credential()), auth: auth)
        c.bootstrap()
        await c.unlock()
        #expect(c.route == .locked)
        #expect(c.unlockError != nil)
    }

    @Test func aChangeRightAfterUnlockNeedsNoSecondPrompt() async {
        let auth = FakeOwnerAuthenticator()
        let c = make(store: FakeCredentialStore(Self.credential()), auth: auth)
        c.bootstrap()
        await c.unlock()
        #expect(await c.authorizeChange(reason: "test"))
        #expect(auth.prompts == 1) // within the grace
        c.lock()
    }

    @Test func aChangeAfterPairingAsksAndALockMidPromptWins() async {
        let auth = FakeOwnerAuthenticator()
        let store = FakeCredentialStore()
        let c = make(store: store, auth: auth)
        c.bootstrap()
        #expect(c.route == .pairing)
        try? store.saveCredential(Self.credential())
        c.didPair(Self.device())
        #expect(c.route == .unlocked)
        // Pairing proves the code, not the owner: the first change asks.
        auth.whilePrompting = { [weak c] in c?.lock() }
        #expect(await c.authorizeChange(reason: "test") == false)
        #expect(auth.prompts == 1)
        #expect(c.route == .locked)
    }

    @Test func pairingThatFinishesInTheBackgroundOpensLocked() {
        let store = FakeCredentialStore()
        let c = make(store: store)
        c.bootstrap()
        c.scenePhaseChanged(to: .background)
        try? store.saveCredential(Self.credential())
        c.didPair(Self.device())
        #expect(c.route == .locked)
        #expect(c.device == nil)
    }

    @Test func theComputerRemovingThisDeviceUnpairsIt() async {
        let store = FakeCredentialStore(Self.credential())
        let c = make(store: store)
        c.bootstrap()
        await c.unlock()
        c.liveEvents.onUnauthorized?()
        #expect(c.route == .pairing)
        #expect(!store.hasCredential)
        #expect(c.pairingNotice != nil)
    }
}
