import Foundation

/// Where the device credential is kept. The app uses `KeychainManager`.
/// Tests use a fake, so the lock rules can be checked without a keychain.
protocol CredentialStore: Sendable {
    func saveCredential(_ credential: DeviceCredential) throws
    func loadCredential() throws -> DeviceCredential?
    /// Deletes the credential, and Away mode's apps with it.
    func deleteCredential() throws
    func deleteAll() throws
    /// Away mode's apps (`AwayApp`), kept with the same protection as the credential.
    func saveAwayApps(_ apps: [AwayApp]) throws
    func loadAwayApps() throws -> [AwayApp]
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
