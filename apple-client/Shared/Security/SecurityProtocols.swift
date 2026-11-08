import Foundation

/// Where the device credential is kept. The app uses `KeychainManager`.
/// Tests use a fake, so the lock rules can be checked without a keychain.
protocol CredentialStore: Sendable {
    func saveCredential(_ credential: DeviceCredential) throws
    func loadCredential() throws -> DeviceCredential?
    func deleteCredential() throws
    func deleteAll() throws
}

/// Asks the device owner to prove they're present. The app uses
/// `BiometricAuthManager`. Tests use a fake.
protocol OwnerAuthenticator: Sendable {
    func availableMethod() -> BiometricAuthManager.Method
    /// Returns once the owner has authenticated. Otherwise throws `BiometricAuthManager.AuthError`.
    func authenticate(reason: String) async throws
}

extension KeychainManager: CredentialStore {}
extension BiometricAuthManager: OwnerAuthenticator {}
