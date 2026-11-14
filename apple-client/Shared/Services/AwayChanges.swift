import CryptoKit
import Foundation

/// The changes made to the household's plan while the Homelab didn't answer
/// (offline Finances 2 of 3), waiting to be replayed on the computer's newest
/// once it does (`FinanceReplay`). Kept beside `OfflineFinances` and as it is:
/// sealed with AES-GCM under this device's own key (never synced or backed
/// up), complete file protection, out of backups; gone when Finances are
/// taken from this device or it's unpaired.
struct AwayChanges: Sendable {
    let file: URL
    let key: @Sendable () -> SymmetricKey?

    static var onThisDevice: AwayChanges {
        let folder = (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        return AwayChanges(file: folder.appendingPathComponent("Homelab", isDirectory: true).appendingPathComponent("finances-away.sealed")) {
            (try? KeychainManager().deviceKey(account: OfflineFinances.keyAccount)).map { SymmetricKey(data: $0) }
        }
    }

    /// Sealed with this, so the offline Finances' file can't pass for it, or it for them.
    private static let purpose = Data("homelab finances away changes, v1".utf8)

    private struct Stored: Codable {
        var version = 1
        var changes: [FinanceChange]
        /// The ledger's (offline Finances 3 of 3); none in a file from before them.
        var ledger: [LedgerChange]?
    }

    enum KeepError: Error { case noKey }

    /// Keeps the plan's `changes` and the ledger's in place of what was kept; none drops the file.
    func keep(_ changes: [FinanceChange], ledger: [LedgerChange] = []) throws {
        guard !changes.isEmpty || !ledger.isEmpty else {
            forget()
            return
        }
        guard let key = key() else { throw KeepError.noKey }
        let sealed = try AES.GCM.seal(try JSONEncoder().encode(Stored(changes: changes, ledger: ledger)), using: key, authenticating: Self.purpose)
        guard let bytes = sealed.combined else { throw KeepError.noKey }
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        #if os(iOS)
        try bytes.write(to: file, options: [.atomic, .completeFileProtection])
        #else
        try bytes.write(to: file, options: .atomic)
        #endif
        var url = file
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
    }

    /// What waits; none when nothing does or the Keychain is locked. A file
    /// this device's key doesn't open is removed.
    func load() -> (plan: [FinanceChange], ledger: [LedgerChange]) {
        guard let bytes = try? Data(contentsOf: file), let key = key() else { return ([], []) }
        guard let box = try? AES.GCM.SealedBox(combined: bytes),
              let json = try? AES.GCM.open(box, using: key, authenticating: Self.purpose),
              let stored = try? JSONDecoder().decode(Stored.self, from: json),
              stored.version == 1
        else {
            forget()
            return ([], [])
        }
        return (stored.changes, stored.ledger ?? [])
    }

    func forget() {
        try? FileManager.default.removeItem(at: file)
    }
}
