import Foundation

/// What updating an app brings (`releases.Preview`, the `ReleaseNotes` phone
/// call): its project's releases newer than the version it runs, with the
/// start of each one's notes, as the computer's Update shows them first
/// (web/src/status/ReleaseNotes.tsx). The owner's yes, Nov 20, on the
/// canvas's *Idea: Update an app, notes first*.
struct ReleasePreview: Decodable, Sendable, Equatable {
    struct Release: Decodable, Sendable, Equatable, Identifiable {
        let tag: String
        let name: String?
        /// As Go wrote it (RFC 3339).
        let when: String?
        let url: String?
        let notes: String?
        var id: String { tag }

        /// "Nov 12, 2026"; nil for no day, or Go's zero time.
        var day: String? {
            guard let when else { return nil }
            let whole = when.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
            guard let date = ISO8601DateFormatter().date(from: whole),
                  Calendar(identifier: .gregorian).component(.year, from: date) >= 2000 else { return nil }
            return date.formatted(.dateTime.month(.abbreviated).day().year())
        }

        /// "1.33.0 — Passkeys", or the tag alone.
        var title: String { (name ?? "").isEmpty ? tag : "\(tag) — \(name ?? "")" }
    }

    let app: String
    let repo: String?
    let running: String?
    /// The version it runs is among the releases, so they're exactly the newer ones.
    let placed: Bool
    let releases: [Release]
    /// The project's releases page.
    let page: String?

    enum CodingKeys: String, CodingKey { case app, repo, running, placed, releases, page }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        app = try c.decodeIfPresent(String.self, forKey: .app) ?? ""
        repo = try c.decodeIfPresent(String.self, forKey: .repo).flatMap { $0.isEmpty ? nil : $0 }
        running = try c.decodeIfPresent(String.self, forKey: .running).flatMap { $0.isEmpty ? nil : $0 }
        placed = try c.decodeIfPresent(Bool.self, forKey: .placed) ?? false
        releases = try c.decodeIfPresent([Release].self, forKey: .releases) ?? []
        page = try c.decodeIfPresent(String.self, forKey: .page).flatMap { $0.isEmpty ? nil : $0 }
    }

    /// The computer shows the newest five, then how many more.
    static let shownAtMost = 5

    var shown: [Release] { Array(releases.prefix(Self.shownAtMost)) }
    var more: Int { max(0, releases.count - Self.shownAtMost) }

    /// One line on what the update brings, in the computer's words (ReleaseNotes.tsx's `summary`).
    func summary(name: String) -> String {
        let n = releases.count
        if repo == nil { return "\(name)'s image doesn't say where its releases are published. Updating pulls its newest image." }
        if placed && n == 0 { return "\(name) runs \(running ?? "its newest release"), the newest release. Updating pulls that release's newest build." }
        if n == 0 { return "\(name)'s project has published no releases." }
        if !placed {
            if let running { return "\(name) runs \(running); the newest release is \(releases[0].tag)." }
            return "The newest release of \(name) is \(releases[0].tag). Its image doesn't say which version it runs now."
        }
        let brings = n == 1 ? releases[0].tag : "\(n) releases, up to \(releases[0].tag)"
        return "\(name) runs \(running ?? "an older version"); updating brings \(brings)."
    }
}
