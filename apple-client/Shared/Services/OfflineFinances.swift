import CryptoKit
import Foundation

/// Finances kept on this device for when the Homelab doesn't answer (the
/// owner, Nov 13: open the app with Face ID and see the last Finances read,
/// away from home or with no signal, and have them read fresh once home).
///
/// What's kept is the computer's own answers, exactly as they came (the
/// plan read forward, the ledger, and on a member's phone what the owner
/// shares), so they're shown by the same screens and nothing is worked out
/// a second time. They are:
/// - kept only on a device that may see the plan (the view or edit level),
///   and dropped when that's taken away, the phone is unpaired or removed;
/// - sealed with AES-GCM under a key that only this device holds, in its
///   Keychain, readable only while it's unlocked and never synced or backed
///   up (`KeychainManager.deviceKey`), so the file alone opens nothing, and
///   written with complete file protection, out of the device's backups;
/// - shown to look at only: every change waits until the Homelab answers,
///   and then the newest Finances are read again, so there's nothing to merge.
struct OfflineFinances: Sendable {
    /// The computer's answers as they came, and when and at what level they were read.
    struct Answers: Sendable {
        var at: Date
        var level: FinancesLevel
        var plan: Data
        var ledger: Data?
        var shared: Data?
    }

    /// What was kept, read back.
    struct Kept: Sendable {
        let at: Date
        let level: FinancesLevel
        let plan: FinancesRead
        let ledger: LedgerRead?
        let shared: HouseholdShared?
    }

    let file: URL
    /// This device's own key; nil while the Keychain can't be read.
    let key: @Sendable () -> SymmetricKey?

    /// The Keychain item the key is kept under.
    static let keyAccount = "finances-offline-key"

    /// This device's copy, in the app's own folder, with its own key.
    static var onThisDevice: OfflineFinances {
        let folder = (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        return OfflineFinances(file: folder.appendingPathComponent("Homelab", isDirectory: true).appendingPathComponent("finances-offline.sealed")) {
            (try? KeychainManager().deviceKey(account: keyAccount)).map { SymmetricKey(data: $0) }
        }
    }

    /// Sealed with this, so a file can't pass for another kind of the app's.
    private static let purpose = Data("homelab finances offline, v1".utf8)

    private struct Stored: Codable {
        var version = 1
        var at: Date
        var level: String
        var plan: Data
        var ledger: Data?
        var shared: Data?
    }

    enum KeepError: Error { case noKey }

    /// Keeps the answers, in place of what was kept. Below the view level
    /// it keeps nothing and drops what was kept. An answer that isn't one
    /// the screens can show is refused, and what was kept stays.
    func keep(_ answers: Answers) throws {
        guard answers.level >= .view else {
            forget()
            return
        }
        _ = try APIClient.financesRead(from: answers.plan)
        if let ledger = answers.ledger { _ = try APIClient.ledgerRead(from: ledger) }
        if let shared = answers.shared { _ = try APIClient.sharedRead(from: shared) }
        guard let key = key() else { throw KeepError.noKey }
        let stored = Stored(at: answers.at, level: answers.level.rawValue, plan: answers.plan, ledger: answers.ledger, shared: answers.shared)
        let sealed = try AES.GCM.seal(try JSONEncoder().encode(stored), using: key, authenticating: Self.purpose)
        guard let bytes = sealed.combined else { throw KeepError.noKey }
        let folder = file.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
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

    /// What was kept; nil when nothing was, or while the Keychain is locked.
    /// A file this device's key doesn't open (the app put back fresh, say)
    /// is removed.
    func load() -> Kept? {
        guard let bytes = try? Data(contentsOf: file) else { return nil }
        guard let key = key() else { return nil }
        guard let box = try? AES.GCM.SealedBox(combined: bytes),
              let json = try? AES.GCM.open(box, using: key, authenticating: Self.purpose),
              let stored = try? JSONDecoder().decode(Stored.self, from: json),
              stored.version == 1,
              let plan = try? APIClient.financesRead(from: stored.plan)
        else {
            forget()
            return nil
        }
        let level = FinancesLevel(stored.level)
        guard level >= .view else {
            forget()
            return nil
        }
        return Kept(at: stored.at, level: level, plan: plan,
                    ledger: stored.ledger.flatMap { try? APIClient.ledgerRead(from: $0) },
                    shared: stored.shared.flatMap { try? APIClient.sharedRead(from: $0) })
    }

    /// Drops what was kept.
    func forget() {
        try? FileManager.default.removeItem(at: file)
    }

    /// Whether, after this failure, the kept Finances are shown: only when
    /// the Homelab couldn't be reached, never in place of a refusal.
    static func showsKept(after error: APIError) -> Bool {
        error.unreachable
    }

    /// "As of today, 9:40 AM", "As of yesterday, 10:15 PM", "As of Nov 6, 7:00 AM".
    static func asOf(_ at: Date, now: Date = Date(), calendar: Calendar = .current, locale: Locale = .current) -> String {
        let time = DateFormatter()
        time.calendar = calendar
        time.timeZone = calendar.timeZone
        time.locale = locale
        time.setLocalizedDateFormatFromTemplate("h:mm a")
        if calendar.isDate(at, inSameDayAs: now) { return "As of today, \(time.string(from: at))" }
        if let yesterday = calendar.date(byAdding: .day, value: -1, to: now), calendar.isDate(at, inSameDayAs: yesterday) {
            return "As of yesterday, \(time.string(from: at))"
        }
        let day = DateFormatter()
        day.calendar = calendar
        day.timeZone = calendar.timeZone
        day.locale = locale
        day.setLocalizedDateFormatFromTemplate(calendar.isDate(at, equalTo: now, toGranularity: .year) ? "MMM d" : "MMM d, yyyy")
        return "As of \(day.string(from: at)), \(time.string(from: at))"
    }
}
