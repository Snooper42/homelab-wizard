import Foundation

/// One thing that was done, from the computer's record of what was done
/// (internal/history, the companion's look-only `History`): "Restarted
/// Immich", when, and who did it (this computer, a phone by its name, the
/// watchdog, the nightly update). The computer redacts every line before
/// sending it, and never records a setting's value or an amount of money.
struct HistoryEntry: Decodable, Sendable, Identifiable, Equatable {
    let id: Int64
    let at: Date?
    /// start, stop, restart, update, rollback, remove, heal, settings, finances.
    let kind: String
    /// The app's id; "" for what isn't one app's.
    let app: String
    let who: String
    let text: String

    init(id: Int64, at: Date?, kind: String, app: String, who: String, text: String) {
        self.id = id
        self.at = at
        self.kind = kind
        self.app = app
        self.who = who
        self.text = text
    }

    private enum CodingKeys: String, CodingKey { case id, at, kind, app, who, text }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int64.self, forKey: .id)
        // Read as Go writes times, whatever the decoder's date strategy; a
        // zero time is none.
        at = ((try? c.decodeIfPresent(String.self, forKey: .at)) ?? nil).flatMap(GoTime.parse).flatMap { $0.timeIntervalSince1970 > 0 ? $0 : nil }
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? ""
        app = try c.decodeIfPresent(String.self, forKey: .app) ?? ""
        who = try c.decodeIfPresent(String.self, forKey: .who) ?? ""
        text = try c.decode(String.self, forKey: .text)
    }

    /// Under its line: who did it, as "by the watchdog".
    var byWho: String { who.isEmpty ? "" : "by \(who)" }
}
