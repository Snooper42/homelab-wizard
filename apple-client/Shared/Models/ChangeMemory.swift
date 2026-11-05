import CryptoKit
import Foundation

/// What changed since you looked: each app as you last saw it, so a row
/// that changed meanwhile has a dot saying how (restarted, updated,
/// stopped, started), as the computer's Status does (web/src/status/changed.ts).
///
/// Unlike the computer, it keeps no app's name or times readable: what's
/// stored is a one-way hash of each app's id, whether it was running, and
/// hashes of when it started and was last updated. That's enough to tell
/// "changed" from "the same", and nothing more.
enum ChangeMemory {
    struct Seen: Codable, Equatable, Sendable {
        let up: Bool
        let since: String
        let updated: String
    }

    typealias Memory = [String: Seen]

    private static let key = "statusSeen.v1"

    static func hash(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).prefix(12).map { String(format: "%02x", $0) }.joined()
    }

    /// The apps as they are now, as what was seen.
    static func memory(of apps: [AppStatus]) -> Memory {
        var out: Memory = [:]
        for app in apps {
            out[hash(app.id)] = Seen(up: app.isRunning, since: hash(app.since ?? ""), updated: hash(app.updatedAt ?? ""))
        }
        return out
    }

    /// How an app changed since it was seen, or nil when it didn't (or
    /// wasn't there to see), by the computer's rules.
    static func change(of app: AppStatus, since memory: Memory?) -> String? {
        guard let was = memory?[hash(app.id)] else { return nil }
        if was.up && !app.isRunning { return "Stopped since you looked" }
        if !was.up && app.isRunning { return "Started since you looked" }
        guard app.isRunning, let since = app.since, !since.isEmpty,
              was.since != hash(""), hash(since) != was.since
        else { return nil }
        if let updated = app.updatedAt, !updated.isEmpty, hash(updated) != was.updated {
            return "Updated since you looked"
        }
        return "Restarted since you looked"
    }

    static func load(_ defaults: UserDefaults = .standard) -> Memory? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(Memory.self, from: data)
    }

    static func save(_ apps: [AppStatus], to defaults: UserDefaults = .standard) {
        guard !apps.isEmpty, let data = try? JSONEncoder().encode(memory(of: apps)) else { return }
        defaults.set(data, forKey: key)
    }
}
