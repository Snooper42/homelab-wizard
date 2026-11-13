import Foundation

/// One change the engine pushes on `/api/events` (`engine.Change` in
/// internal/engine/engine.go), sent as `data: {json}` per SSE event.
struct EngineChange: Decodable, Sendable {
    /// Compose services that changed, sorted.
    let apps: [String]
    /// The container runtime came up or went away.
    let runtime: Bool
    /// The status read after the change. Nil when the agent couldn't read
    /// one; then the client asks for it.
    let status: HomelabStatus?
    /// Following restarted after a gap, so changes were missed: read Status again.
    let again: Bool
    /// A page the computer sent this phone (Send to my phone): it changes
    /// nothing else, and shows as a banner with Open.
    let open: SentPage?

    enum CodingKeys: String, CodingKey {
        case apps, runtime, status, again, open
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        apps = try c.decodeIfPresent([String].self, forKey: .apps) ?? []
        runtime = try c.decodeIfPresent(Bool.self, forKey: .runtime) ?? false
        status = try c.decodeIfPresent(HomelabStatus.self, forKey: .status)
        again = try c.decodeIfPresent(Bool.self, forKey: .again) ?? false
        open = try c.decodeIfPresent(SentPage.self, forKey: .open)
    }

    /// Whether the client must fetch Status itself (not for a page sent: nothing else changed).
    var needsRefresh: Bool { open == nil && (status == nil || again) }
}

/// A page the computer sent this phone (`engine.Open`, Send to my phone):
/// one of the app's own links and its name.
struct SentPage: Decodable, Sendable, Equatable {
    let link: String
    let title: String?

    /// Where it opens: one of the app's own links (`homelab://`), with no
    /// action in it. Anything else is nil and never shows.
    var deepLink: DeepLink? {
        guard let url = URL(string: link), url.scheme?.lowercased() == DeepLink.scheme, url.query == nil else { return nil }
        return DeepLink.parse(url)
    }

    /// What the banner says.
    var words: String {
        let name = (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return "From the Computer: \(name.isEmpty ? "a Page" : name)"
    }
}
