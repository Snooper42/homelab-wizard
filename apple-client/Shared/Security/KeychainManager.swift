import Foundation
import Security

/// Stores the device credential in the Keychain, and only there.
///
/// What every item gets:
/// - `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`: readable only while the
///   device is unlocked. It's never in iCloud Keychain or a backup, and it
///   never moves to another device.
/// - `kSecAttrSynchronizable = false`: explicitly not synced.
/// - `kSecUseDataProtectionKeychain = true`: on macOS, uses the iOS-style
///   data-protection keychain, not the legacy file keychain whose ACLs work
///   differently. Ignored on iOS.
///
/// A save deletes the old item and adds a new one, so a stored item never
/// keeps older, weaker attributes. A load checks the accessibility
/// attribute again and deletes any item that doesn't match.
struct KeychainManager: Sendable {
    enum KeychainError: LocalizedError, Equatable {
        /// The device is locked, so the item can't be read yet.
        case interactionNotAllowed
        /// The app isn't signed with a keychain entitlement (errSecMissingEntitlement).
        case missingEntitlement
        case unexpectedStatus(OSStatus)
        case corruptItem

        var errorDescription: String? {
            switch self {
            case .interactionNotAllowed:
                "Unlock this device to continue."
            case .missingEntitlement:
                "This build can't use the Keychain. Sign it with a development team."
            case .unexpectedStatus(let status):
                "The Keychain refused (\(status))."
            case .corruptItem:
                "The stored pairing couldn't be read. Pair again."
            }
        }
    }

    let service: String
    private let account = "paired-server"

    init(service: String = (Bundle.main.bundleIdentifier ?? "com.homelab.client") + ".device-credential") {
        self.service = service
    }

    // MARK: Credential

    func saveCredential(_ credential: DeviceCredential) throws {
        let data = try JSONEncoder().encode(credential)
        try delete(account: account)

        var query = baseQuery(account: account)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        query[kSecValueData as String] = data
        query[kSecAttrLabel as String] = "Homelab device token"

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw Self.error(for: status) }
        Log.security.notice("Stored the device credential in the Keychain (this device only)")
    }

    /// The stored credential. Nil if none is stored, or if the stored item
    /// failed a check and was deleted.
    func loadCredential() throws -> DeviceCredential? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecReturnAttributes as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw Self.error(for: status) }

        guard let item = result as? [String: Any],
              let data = item[kSecValueData as String] as? Data
        else {
            throw KeychainError.corruptItem
        }

        // Fail closed. An item stored with any other accessibility (an older
        // build, or a tampered keychain) is deleted, not trusted.
        let accessible = item[kSecAttrAccessible as String] as? String
        guard accessible == (kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String) else {
            Log.security.fault("Deleted a stored credential with the wrong accessibility")
            try delete(account: account)
            return nil
        }

        guard let credential = try? JSONDecoder().decode(DeviceCredential.self, from: data),
              DeviceCredential.isWellFormed(token: credential.token)
        else {
            Log.security.error("Deleted a stored credential that couldn't be read")
            try delete(account: account)
            return nil
        }
        return credential
    }

    func deleteCredential() throws {
        try delete(account: account)
        Log.security.notice("Deleted the device credential from the Keychain")
    }

    /// Deletes every item this app stored under `service`. Runs on the first
    /// launch after an install, because on iOS Keychain items outlive
    /// deleting the app.
    func deleteAll() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecUseDataProtectionKeychain as String: true,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw Self.error(for: status) }
    }

    // MARK: A device-only key

    /// A random 256-bit key kept under `account`, made the first time it's
    /// asked for, with the same accessibility as the credential. It keys
    /// hashes kept outside the Keychain (ChangeMemory), so they can't be
    /// matched against a list of guesses without this device unlocked.
    func deviceKey(account keyAccount: String = "change-memory-key") throws -> Data {
        var query = baseQuery(account: keyAccount)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data, data.count == 32 { return data }
        guard status == errSecItemNotFound || status == errSecSuccess else { throw Self.error(for: status) }

        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw KeychainError.unexpectedStatus(errSecParam)
        }
        let key = Data(bytes)
        try delete(account: keyAccount)
        var add = baseQuery(account: keyAccount)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        add[kSecValueData as String] = key
        let added = SecItemAdd(add as CFDictionary, nil)
        guard added == errSecSuccess else { throw Self.error(for: added) }
        return key
    }

    // MARK: Internals

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }

    private func delete(account: String) throws {
        let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw Self.error(for: status) }
    }

    private static func error(for status: OSStatus) -> KeychainError {
        // The status code is an OSStatus, not a secret.
        Log.security.error("Keychain status \(status, privacy: .public)")
        switch status {
        case errSecInteractionNotAllowed: return .interactionNotAllowed
        case errSecMissingEntitlement: return .missingEntitlement
        default: return .unexpectedStatus(status)
        }
    }
}
