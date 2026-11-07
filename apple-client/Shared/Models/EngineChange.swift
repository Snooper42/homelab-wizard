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

    enum CodingKeys: String, CodingKey {
        case apps, runtime, status, again
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        apps = try c.decodeIfPresent([String].self, forKey: .apps) ?? []
        runtime = try c.decodeIfPresent(Bool.self, forKey: .runtime) ?? false
        status = try c.decodeIfPresent(HomelabStatus.self, forKey: .status)
        again = try c.decodeIfPresent(Bool.self, forKey: .again) ?? false
    }

    /// Whether the client must fetch Status itself.
    var needsRefresh: Bool { status == nil || again }
}
