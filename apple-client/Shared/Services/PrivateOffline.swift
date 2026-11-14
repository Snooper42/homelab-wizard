import Foundation

/// A household member's private Finances kept on her own phone for when the
/// Homelab doesn't answer (2E step 6: "Both, yours look-only"; hers open and
/// change offline). Only what's sealed is kept: her envelope as last read,
/// and the newest change she made while it didn't answer (sealed too), with
/// the rev it builds on and how many changes it holds. Never her key, never
/// plain Finances, as the phone's page keeps them (privacy.ts's `Kept`).
/// The file has complete data protection and stays out of backups; it goes
/// when the phone is unpaired, Finances are taken from it, or privacy is
/// turned off.
struct PrivateOffline: Sendable {
    struct Pending: Codable, Sendable, Equatable {
        /// The rev the change builds on.
        var was: String
        /// The change, sealed, without a rev (as the computer takes it).
        var envelope: PrivateSeal.Envelope
        /// How many changes it holds (each save made away replaces the one before).
        var count: Int
    }

    struct Kept: Codable, Sendable, Equatable {
        var username: String
        /// When the envelope was last read from the computer.
        var at: Date
        /// Her envelope as last read, with its rev.
        var envelope: PrivateSeal.Envelope
        var pending: Pending?

        /// The newest she has here: what waits (at the rev it builds on), or the last read.
        var newest: PrivateSeal.Envelope {
            guard let pending else { return envelope }
            var e = pending.envelope
            e.rev = pending.was
            return e
        }
    }

    let file: URL

    /// This device's copy, beside the owner's offline Finances.
    static var onThisDevice: PrivateOffline {
        let folder = (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        return PrivateOffline(file: folder.appendingPathComponent("Homelab", isDirectory: true).appendingPathComponent("private-finances.json"))
    }

    func load() -> Kept? {
        guard let data = try? Data(contentsOf: file), let kept = try? JSONDecoder().decode(Kept.self, from: data) else { return nil }
        return kept
    }

    func keep(_ kept: Kept) {
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(kept)
            #if os(iOS)
            try data.write(to: file, options: [.atomic, .completeFileProtection])
            #else
            try data.write(to: file, options: .atomic)
            #endif
            var url = file
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? url.setResourceValues(values)
        } catch {
            Log.ui.error("Couldn't keep the private Finances for offline")
        }
    }

    func forget() {
        try? FileManager.default.removeItem(at: file)
    }
}
