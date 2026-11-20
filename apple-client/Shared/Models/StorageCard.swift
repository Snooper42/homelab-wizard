import Foundation

/// Status's Storage card on the phone (the owner's yes, Nov 20, on the
/// canvas's *Idea: Storage on Status*), as the computer's "What the apps
/// keep" (web/src/status/Cards.tsx's `Storage`): each app's folder under
/// data/appdata as the nightly backup measured it, the six largest with a
/// bar, the rest counted. From the "storage" card the phone already reads for
/// an app's page; whose photos take what stays on the computer (`phoneStorage`).
struct StorageCard: Sendable, Equatable {
    struct Row: Sendable, Equatable, Identifiable {
        let app: String
        let bytes: Int64
        var id: String { app }
    }

    /// The computer's card shows six.
    static let shownAtMost = 6

    /// The largest, largest first.
    let rows: [Row]
    /// The rest: how many, and what they keep together.
    let more: Int
    let moreBytes: Int64
    /// Every app's folder together.
    let total: Int64
    let measured: Date?

    /// Nil when no app's folder has anything in it (the computer hides the card then too).
    static func from(_ storage: JSONValue?) -> StorageCard? {
        guard case .array(let apps)? = storage?["apps"] else { return nil }
        let all = apps.compactMap { a -> Row? in
            guard case .string(let app)? = a["app"], case .number(let n)? = a["bytes"], n >= 1 else { return nil }
            return Row(app: app, bytes: Int64(n))
        }
        .enumerated().sorted { $0.element.bytes != $1.element.bytes ? $0.element.bytes > $1.element.bytes : $0.offset < $1.offset }
        .map(\.element)
        guard !all.isEmpty else { return nil }
        let shown = Array(all.prefix(shownAtMost)), rest = all.dropFirst(shownAtMost)
        var measured: Date?
        if case .string(let when)? = storage?["when"] {
            // Go writes up to nine digits of a second; the minute is enough here.
            let whole = when.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
            measured = ISO8601DateFormatter().date(from: whole)
        }
        return StorageCard(rows: shown, more: rest.count, moreBytes: rest.reduce(0) { $0 + $1.bytes },
                           total: all.reduce(0) { $0 + $1.bytes }, measured: measured)
    }

    /// Where it goes among Status's cards: before Recent Alerts, so after the watchdog and
    /// protection as on the computer; at the end when there's no alerts card.
    static func place(among names: [String]) -> Int {
        names.firstIndex(of: "alerts") ?? names.count
    }
}
