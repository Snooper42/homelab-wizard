import Foundation
import LocalAuthentication
import Security

/// The key to a household member's private Finances, kept on her own
/// iPhone or iPad so Face ID opens them (private-finances.md 3.1: "in the
/// app, the Keychain only, kSecAttrAccessibleWhenUnlockedThisDeviceOnly").
///
/// - Only after she opened them once with her recovery code or passphrase,
///   on this device; it never leaves it: this device only, while unlocked,
///   never synced or backed up, and readable only after Face ID (or Touch
///   ID) of the faces enrolled when it was kept (`.biometryCurrentSet`: a
///   face added since opens nothing, and the key goes).
/// - One per device, for the member whose phone it is (her username kept
///   beside it); it goes when the phone is unpaired (`deleteCredential`),
///   when privacy is turned off, and when it no longer opens her Finances
///   (turned off and on again elsewhere).
///
/// It holds no state: each call makes its own `LAContext` and query, and
/// reading it waits on Face ID, so the app calls it off the main actor.
struct PrivateFinancesKey: Sendable {
    static let account = "private-finances-key"
    let service: String

    init(service: String = KeychainManager().service) {
        self.service = service
    }

    private func query() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: Self.account,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }

    /// Keeps her key, in place of any kept before.
    func keep(_ raw: Data, for username: String) throws {
        forget()
        guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, .biometryCurrentSet, nil) else {
            throw KeychainManager.KeychainError.unexpectedStatus(errSecParam)
        }
        var add = query()
        add[kSecAttrAccessControl as String] = access
        add[kSecAttrGeneric as String] = Data(username.utf8)
        add[kSecAttrLabel as String] = "Homelab private Finances key"
        add[kSecValueData as String] = raw
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else {
            Log.security.error("Couldn't keep the private Finances key: \(status, privacy: .public)")
            throw KeychainManager.KeychainError.unexpectedStatus(status)
        }
        Log.security.notice("Kept the private Finances key behind Face ID (this device only)")
    }

    /// Whether a key is kept for username, asked without Face ID (its
    /// attributes only).
    func has(for username: String) -> Bool {
        var q = query()
        q[kSecReturnAttributes as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        let context = LAContext()
        context.interactionNotAllowed = true
        q[kSecUseAuthenticationContext as String] = context
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        guard status == errSecSuccess, let item = result as? [String: Any] else { return false }
        return item[kSecAttrGeneric as String] as? Data == Data(username.utf8)
    }

    /// Her key, after Face ID; nil when none is kept for her, or Face ID
    /// was cancelled or failed. It waits on Face ID: never on the main actor.
    func read(for username: String, reason: String) -> Data? {
        guard has(for: username) else { return nil }
        var q = query()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        let context = LAContext()
        context.localizedReason = reason
        context.touchIDAuthenticationAllowableReuseDuration = 0
        q[kSecUseAuthenticationContext as String] = context
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        context.invalidate()
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data, data.count == 32 else {
            Log.security.notice("The private Finances key wasn't read: \(status, privacy: .public)")
            return nil
        }
        return data
    }

    /// Drops the key from this device.
    func forget() {
        _ = SecItemDelete(query() as CFDictionary)
    }
}
