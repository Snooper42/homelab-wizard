import Foundation

/// The homelab's state (`api.Status` in internal/api/api.go). Fields the
/// phone doesn't show yet (`updates`, `stopped`) are left out, and Codable
/// ignores them.
struct HomelabStatus: Codable, Sendable, Equatable {
    var apps: [AppStatus]
    /// Baseline apps that aren't running.
    var missing: Int
    /// Running containers that aren't catalog apps.
    var unmatched: Int
    /// What the running apps replace in subscriptions per year.
    var savings: Double
    /// Apps the battery saver paused until power returns.
    var batteryPaused: [String]
    /// Some apps' pages haven't been checked yet. A refresh follows.
    var checking: Bool

    enum CodingKeys: String, CodingKey {
        case apps, missing, unmatched, savings, batteryPaused, checking
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        apps = try c.decodeIfPresent([AppStatus].self, forKey: .apps) ?? []
        missing = try c.decodeIfPresent(Int.self, forKey: .missing) ?? 0
        unmatched = try c.decodeIfPresent(Int.self, forKey: .unmatched) ?? 0
        savings = try c.decodeIfPresent(Double.self, forKey: .savings) ?? 0
        batteryPaused = try c.decodeIfPresent([String].self, forKey: .batteryPaused) ?? []
        checking = try c.decodeIfPresent(Bool.self, forKey: .checking) ?? false
    }
}

/// One app's state (`api.AppStatus`).
struct AppStatus: Codable, Sendable, Equatable, Identifiable, Hashable {
    let id: String
    let name: String
    /// running, stopped, elsewhere, missing, or "not running".
    let state: String
    /// healthy, unhealthy, starting, restarting (a crash loop), or native.
    let health: String?
    let container: String?
    /// Its address on the computer itself. Usually localhost, so not useful here.
    let url: String?
    /// Its address on the homelab domain.
    let address: String?
    /// When it last started (RFC 3339), while running.
    let since: String?
    let restarts: Int?
    let updatedAt: String?
    let held: Bool?
    let quiet: Bool?
    let waitingFor: String?
    let notAnswering: String?
    let settingsChanged: Bool?

    var isRunning: Bool { state == "running" }

    /// Running but broken, or expected and not running.
    var needsAttention: Bool {
        if let notAnswering, !notAnswering.isEmpty { return true }
        switch health {
        case "unhealthy", "restarting": return true
        default: break
        }
        return state == "missing" || state == "not running"
    }

    var startedAt: Date? { since.flatMap(GoTime.parse) }
}

/// A Status and when it was read (`api.Reading`). The `LastStatus` call
/// returns one so the screen can draw right away.
struct StatusReading: Codable, Sendable {
    let status: HomelabStatus
    let at: Date
}
