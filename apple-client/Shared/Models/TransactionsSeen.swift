import CryptoKit
import Foundation

/// Which transactions this phone has seen, so one that's new since you
/// looked has a violet dot until it's reviewed (opened and marked, swiped,
/// or Mark All Reviewed), as a mail app marks what's unread. The computer
/// keeps no such mark: it's this phone's own.
///
/// As ChangeMemory does for apps, it keeps nothing readable: only an HMAC
/// of each seen transaction's id under this device's random key from the
/// Keychain, and only for transactions still in the ledger, so it never
/// grows past it. The first look marks every transaction there as seen, so
/// only what comes in afterwards is new.
struct TransactionsSeen: Equatable, Sendable {
    private static let storeKey = "transactionsSeen.v1"

    private(set) var hashes: Set<String>

    static func load(_ defaults: UserDefaults = .standard) -> TransactionsSeen? {
        guard let data = defaults.data(forKey: storeKey),
              let list = try? JSONDecoder().decode([String].self, from: data) else { return nil }
        return TransactionsSeen(hashes: Set(list))
    }

    func save(to defaults: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(hashes.sorted()) else { return }
        defaults.set(data, forKey: Self.storeKey)
    }

    /// Every transaction there now, as seen: the first look.
    static func firstLook(_ ids: some Sequence<String>, key: SymmetricKey) -> TransactionsSeen {
        var seen = TransactionsSeen(hashes: [])
        seen.see(ids, key: key)
        return seen
    }

    func isNew(_ id: String, key: SymmetricKey) -> Bool {
        !hashes.contains(ChangeMemory.hash(id, key: key))
    }

    mutating func see(_ ids: some Sequence<String>, key: SymmetricKey) {
        for id in ids { hashes.insert(ChangeMemory.hash(id, key: key)) }
    }

    /// Only the transactions still in the ledger stay remembered.
    mutating func keep(only ids: some Sequence<String>, key: SymmetricKey) {
        hashes.formIntersection(Set(ids.map { ChangeMemory.hash($0, key: key) }))
    }
}
