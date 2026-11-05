import Foundation

/// A change to one app, run on the computer by the `AppAction` method
/// (`homelab start|stop|restart <id>`, `homelab rollback <id> --apply`).
///
/// Update isn't here. The computer offers it only behind the release notes,
/// and there's no phone method for those (or for whether an update exists).
enum AppAction: String, Sendable, CaseIterable, Identifiable {
    case start, stop, restart, rollback

    var id: Self { self }

    var title: String {
        switch self {
        case .start: "Start"
        case .stop: "Stop"
        case .restart: "Restart"
        case .rollback: "Roll Back"
        }
    }

    /// What the row says while it runs.
    var progressTitle: String {
        switch self {
        case .start: "Starting…"
        case .stop: "Stopping…"
        case .restart: "Restarting…"
        case .rollback: "Rolling back…"
        }
    }

    var pastTense: String {
        switch self {
        case .start: "Started"
        case .stop: "Stopped"
        case .restart: "Restarted"
        case .rollback: "Rolled back"
        }
    }

    var systemImage: String {
        switch self {
        case .start: "play.fill"
        case .stop: "stop.fill"
        case .restart: "arrow.clockwise"
        case .rollback: "clock.arrow.circlepath"
        }
    }

    /// Stop takes the app away from whoever is using it, and Roll back
    /// changes its version and holds its updates. Both are confirmed first.
    var needsConfirmation: Bool { self == .stop || self == .rollback }

    /// The everyday ones, which a row swipe offers. Roll back is only on
    /// the app's page and in its menu.
    var isEveryday: Bool { self != .rollback }

    func confirmationTitle(for app: AppStatus) -> String {
        switch self {
        case .rollback: "Roll back \(app.name)?"
        default: "\(title) \(app.name)?"
        }
    }

    func confirmationMessage(for app: AppStatus) -> String {
        switch self {
        case .stop:
            "\(app.name) stays stopped until you start it again. Anyone using it right now loses it."
        case .rollback:
            "\(app.name) goes back to the version it ran before its last update, and its updates are held until you release them on the computer (homelab updates release \(app.id))."
        default:
            ""
        }
    }

    /// The actions an app offers. These follow the computer's row menu
    /// (web/src/status/RowMenu.tsx): nothing for a native app (it runs as
    /// its own program), Start for a stopped app, and Restart and Stop for a
    /// running one. Other states (missing, elsewhere, not running) are
    /// handled on the computer.
    /// Roll back is offered while the version before the last update is
    /// still kept (`updatedAt` set, as on the app's page).
    static func available(for app: AppStatus) -> [AppAction] {
        guard !app.isNative else { return [] }
        var out: [AppAction]
        switch app.state {
        case "stopped": out = [.start]
        case "running": out = [.restart, .stop]
        default: out = []
        }
        if let updated = app.updatedAt, !updated.isEmpty {
            out.append(.rollback)
        }
        return out
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
