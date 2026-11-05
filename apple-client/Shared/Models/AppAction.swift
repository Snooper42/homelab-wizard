import Foundation

/// A change to one app, run on the computer by the `AppAction` method
/// (`homelab start|stop|restart <id>`).
enum AppAction: String, Sendable, CaseIterable, Identifiable {
    case start, stop, restart

    var id: Self { self }

    var title: String {
        switch self {
        case .start: "Start"
        case .stop: "Stop"
        case .restart: "Restart"
        }
    }

    /// What the row says while it runs.
    var progressTitle: String {
        switch self {
        case .start: "Starting…"
        case .stop: "Stopping…"
        case .restart: "Restarting…"
        }
    }

    var pastTense: String {
        switch self {
        case .start: "Started"
        case .stop: "Stopped"
        case .restart: "Restarted"
        }
    }

    var systemImage: String {
        switch self {
        case .start: "play.fill"
        case .stop: "stop.fill"
        case .restart: "arrow.clockwise"
        }
    }

    /// Stop takes the app away from whoever is using it, so it's confirmed
    /// first, as on the computer.
    var needsConfirmation: Bool { self == .stop }

    /// The actions an app offers. These follow the computer's row menu
    /// (web/src/status/RowMenu.tsx): nothing for a native app (it runs as
    /// its own program), Start for a stopped app, and Restart and Stop for a
    /// running one. Other states (missing, elsewhere, not running) are
    /// handled on the computer.
    static func available(for app: AppStatus) -> [AppAction] {
        guard !app.isNative else { return [] }
        switch app.state {
        case "stopped": return [.start]
        case "running": return [.restart, .stop]
        default: return []
        }
    }
}

extension AppStatus {
    /// It runs as its own program (Jellyfin on a Mac), not in a container,
    /// so a phone can't start or stop it.
    var isNative: Bool { health == "native" }

    /// Whether the computer can show its log. A native app writes its own
    /// log elsewhere, as on the computer's row menu.
    var hasLogs: Bool { !isNative && Self.isValidID(id) }

    /// Whether `id` looks like a catalog id (`nginx-proxy-manager`,
    /// `firefly-iii`). The computer checks ids against its catalog. This
    /// check means nothing else is ever sent as one.
    static func isValidID(_ id: String) -> Bool {
        guard (1...64).contains(id.utf8.count) else { return false }
        return id.utf8.allSatisfy { byte in
            switch byte {
            case UInt8(ascii: "a")...UInt8(ascii: "z"),
                 UInt8(ascii: "A")...UInt8(ascii: "Z"),
                 UInt8(ascii: "0")...UInt8(ascii: "9"),
                 UInt8(ascii: "-"), UInt8(ascii: "_"), UInt8(ascii: "."):
                true
            default:
                false
            }
        }
    }
}
